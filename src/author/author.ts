/**
 * The Author: generate → verify → feed back → regenerate, at most `maxRounds`
 * times. The model proposes; the verifier disposes. On exhaustion the result is
 * `ok: false` and the caller falls back to the human-written story bank.
 *
 * The LLM call is injected as a `StoryGenerator` so the loop is testable with a
 * scripted fake; `claude.ts` provides the real one.
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { TaughtSet } from "../skill-graph/graph.js";
import type { Lexicon } from "../decodability/lexicon.js";
import { verify, type VerifyReport } from "../decodability/verifier.js";
import type { AuthorConstraints } from "./constraints.js";
import { AUTHOR_SYSTEM_PROMPT, renderConstraints, renderFeedback } from "./prompt.js";
import { storyText, type Story } from "./schema.js";
import { checkStoryText } from "./textChecks.js";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export const ZERO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

export interface GenerateRequest {
  system: string;
  messages: Anthropic.MessageParam[];
}

export interface GenerateResult {
  story: Story | null;
  /** The assistant's raw text, echoed back on retry so the model sees its own draft. */
  rawText: string;
  stopReason: string | null;
  usage: Usage;
}

export type StoryGenerator = (req: GenerateRequest) => Promise<GenerateResult>;

export interface SafetyVerdict {
  ok: boolean;
  problems: string[];
}
export type SafetyGate = (story: Story) => Promise<SafetyVerdict>;

export interface AuthorOptions {
  maxRounds?: number;
  threshold?: number;
  unknownWords?: "fail" | "orthographic";
  safetyGate?: SafetyGate;
}

export interface Attempt {
  round: number;
  story: Story | null;
  report: VerifyReport | null;
  textProblems: string[];
  safetyProblems: string[];
  stopReason: string | null;
  usage: Usage;
}

export interface AuthorResult {
  ok: boolean;
  story?: Story;
  report?: VerifyReport;
  rounds: number;
  attempts: Attempt[];
  usage: Usage;
  /** Decodability ratio of the very first draft — the headline eval metric. */
  firstPassRatio: number | null;
}

export class Author {
  private readonly maxRounds: number;
  private readonly threshold: number;
  private readonly unknownWords: "fail" | "orthographic";
  private readonly safetyGate: SafetyGate | undefined;

  constructor(
    private readonly generate: StoryGenerator,
    private readonly lexicon: Lexicon,
    options: AuthorOptions = {},
  ) {
    this.maxRounds = options.maxRounds ?? 3;
    this.threshold = options.threshold ?? 0.95;
    this.unknownWords = options.unknownWords ?? "fail";
    this.safetyGate = options.safetyGate;
  }

  async write(constraints: AuthorConstraints): Promise<AuthorResult> {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: renderConstraints(constraints) }];
    const attempts: Attempt[] = [];
    let usage = ZERO_USAGE;
    let firstPassRatio: number | null = null;

    for (let round = 1; round <= this.maxRounds; round++) {
      const gen = await this.generate({ system: AUTHOR_SYSTEM_PROMPT, messages });
      usage = addUsage(usage, gen.usage);

      const attempt = this.assess(round, gen, constraints.taught, constraints);
      attempts.push(attempt);
      if (round === 1 && attempt.report) firstPassRatio = attempt.report.ratio;

      if (attempt.story && attempt.report?.pass && attempt.textProblems.length === 0) {
        const safety = this.safetyGate ? await this.safetyGate(attempt.story) : { ok: true, problems: [] };
        attempt.safetyProblems = safety.problems;
        if (safety.ok) {
          return { ok: true, story: attempt.story, report: attempt.report, rounds: round, attempts, usage, firstPassRatio };
        }
      }

      if (gen.stopReason === "refusal") break;

      messages.push({ role: "assistant", content: gen.rawText || "(no output)" });
      messages.push({ role: "user", content: renderFeedback(attempt.report, attempt.textProblems, attempt.safetyProblems) });
    }

    return { ok: false, rounds: attempts.length, attempts, usage, firstPassRatio };
  }

  private assess(round: number, gen: GenerateResult, taught: TaughtSet, c: AuthorConstraints): Attempt {
    if (!gen.story) {
      return {
        round, story: null, report: null, textProblems: [], safetyProblems: [],
        stopReason: gen.stopReason, usage: gen.usage,
      };
    }
    const report = verify(`${gen.story.title} ${storyText(gen.story)}`, taught, this.lexicon, {
      threshold: this.threshold,
      allowList: c.allowList,
      unknownWords: this.unknownWords,
    });
    const textProblems = checkStoryText(gen.story, {
      minSentences: c.targetSentences[0],
      maxSentences: c.targetSentences[1],
      maxWordsPerSentence: c.maxWordsPerSentence,
    });
    return { round, story: gen.story, report, textProblems, safetyProblems: [], stopReason: gen.stopReason, usage: gen.usage };
  }
}
