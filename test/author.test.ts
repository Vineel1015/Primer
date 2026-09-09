import { describe, expect, it } from "vitest";
import { Lexicon } from "../src/decodability/lexicon.js";
import { verify } from "../src/decodability/verifier.js";
import { loadUfli, taughtSetThroughLesson } from "../src/skill-graph/index.js";
import {
  Author,
  AUTHOR_SYSTEM_PROMPT,
  buildConstraints,
  checkStoryText,
  decodableWordBank,
  estimateCostUsd,
  fallbackStory,
  loadStoryBank,
  renderConstraints,
  renderFeedback,
  type GenerateRequest,
  type GenerateResult,
  type Story,
  type StoryGenerator,
} from "../src/author/index.js";

const graph = loadUfli();
const lex = Lexicon.core();
const usage = { inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 0 };

// Default title is allow-listed/decodable at lesson 10 so tests exercise the body, not the title.
const story = (sentences: string[], title = "Sam Sat"): Story => ({ title, sentences, focusWords: [] });

/** A generator that returns scripted drafts in order and records what it was asked. */
function scripted(drafts: (Story | null)[], stopReasons: (string | null)[] = []): { gen: StoryGenerator; requests: GenerateRequest[] } {
  const requests: GenerateRequest[] = [];
  let i = 0;
  const gen: StoryGenerator = async (req) => {
    requests.push(req);
    const s = drafts[i] ?? null;
    const stopReason = stopReasons[i] ?? "end_turn";
    i++;
    const result: GenerateResult = { story: s, rawText: s ? JSON.stringify(s) : "", stopReason, usage };
    return result;
  };
  return { gen, requests };
}

describe("constraints and word bank", () => {
  it("builds a word bank of decodable words at a lesson, excluding heart words", () => {
    const bank = decodableWordBank(taughtSetThroughLesson(graph, 10), lex);
    expect(bank).toContain("mat");
    expect(bank).toContain("on");
    expect(bank).not.toContain("dog"); // g is lesson 13
    expect(bank).not.toContain("the"); // heart word, listed separately
  });

  it("picks the most recent GPC as the focus and puts the child's name on the allow list", () => {
    const c = buildConstraints(graph, { lesson: 20 }, { name: "Maya", allowList: ["Rex"], interests: ["mud"] });
    expect(c.focus?.grapheme).toBe("w");
    expect(c.allowList).toEqual(["Maya", "Rex"]);
    expect(c.heartWords).toContain("the");
    expect(c.pointLabel).toBe("through lesson 20");
  });

  it("renders the request with GPCs, heart words, names, bank and length", () => {
    const c = buildConstraints(graph, { lesson: 10 }, { name: "Sam", interests: ["cats"] });
    const text = renderConstraints(c);
    expect(text).toContain("a → /AE/");
    expect(text).toContain("o → /AA/ or /AO/");
    expect(text).toContain("Heart words allowed: a, is, of, the");
    expect(text).toContain("Names allowed: Sam");
    expect(text).toMatch(/Word bank .*: .*mat/);
    expect(text).toContain("5–9 sentences");
    expect(text).not.toContain("sh →");
  });

  it("keeps the system prompt free of per-request content so it can cache", () => {
    expect(AUTHOR_SYSTEM_PROMPT).not.toMatch(/lesson \d/);
    expect(AUTHOR_SYSTEM_PROMPT.length).toBeGreaterThan(500);
  });
});

describe("text checks", () => {
  it("flags long sentences, missing punctuation, digits, contractions and blocked words", () => {
    const problems = checkStoryText(
      story(["Sam sat on the big red mat by the door", "Sam sat.", "Sam has 2 hats.", "Sam can't sit.", "Sam is dumb."]),
      { minSentences: 2, maxSentences: 9, maxWordsPerSentence: 7 },
    );
    expect(problems).toEqual(expect.arrayContaining([
      expect.stringMatching(/sentence 1 has 10 words/),
      expect.stringMatching(/sentence 1 does not end/),
      expect.stringMatching(/sentence 3 contains a digit/),
      expect.stringMatching(/sentence 4 contains a contraction/),
      expect.stringMatching(/sentence 5 uses a blocked word "dumb"/),
    ]));
  });

  it("flags too few or too many sentences", () => {
    expect(checkStoryText(story(["Sam sat."]), { minSentences: 3, maxSentences: 9, maxWordsPerSentence: 7 })).toContainEqual(expect.stringMatching(/only 1 sentences/));
  });

  it("passes a clean story", () => {
    expect(checkStoryText(story(["Sam sat.", "Sam sat on a mat.", "Tap, tap!"]), { minSentences: 3, maxSentences: 9, maxWordsPerSentence: 7 })).toEqual([]);
  });
});

describe("Author loop", () => {
  const constraints = buildConstraints(graph, { lesson: 10 }, { name: "Sam" }, { targetSentences: [3, 9] });

  it("accepts a verified first draft in one round", async () => {
    const { gen, requests } = scripted([story(["Sam sat on a mat.", "Sam is fit.", "Sam naps on the mat."])]);
    const result = await new Author(gen, lex).write(constraints);
    expect(result.ok).toBe(true);
    expect(result.rounds).toBe(1);
    expect(result.firstPassRatio).toBe(1);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.system).toBe(AUTHOR_SYSTEM_PROMPT);
    expect(requests[0]!.messages).toHaveLength(1);
  });

  it("feeds rejected words back and accepts the corrected second draft", async () => {
    const bad = story(["Sam sat on a ship.", "The ship is big.", "Sam naps."]);
    const good = story(["Sam sat on a mat.", "The mat is fat.", "Sam naps."]);
    const { gen, requests } = scripted([bad, good]);
    const result = await new Author(gen, lex).write(constraints);

    expect(result.ok).toBe(true);
    expect(result.rounds).toBe(2);
    expect(result.firstPassRatio).toBeCloseTo(10 / 13); // 13 words incl. title; "ship" ×2 and "big" rejected
    expect(result.usage.inputTokens).toBe(200);

    const second = requests[1]!.messages;
    expect(second).toHaveLength(3);
    expect(second[1]).toEqual({ role: "assistant", content: JSON.stringify(bad) });
    const feedback = second[2]!.content as string;
    expect(feedback).toMatch(/"ship": no taught grapheme/);
    expect(feedback).toMatch(/"big": no taught grapheme/);
    expect(feedback).not.toMatch(/"Sam"/);
  });

  it("gives up after maxRounds and reports every attempt", async () => {
    const bad = story(["Sam sat on a ship.", "Sam sat.", "Sam sat."]);
    const { gen } = scripted([bad, bad, bad, bad]);
    const result = await new Author(gen, lex, { maxRounds: 3 }).write(constraints);
    expect(result.ok).toBe(false);
    expect(result.rounds).toBe(3);
    expect(result.attempts.every((a) => a.report && !a.report.pass)).toBe(true);
  });

  it("treats text problems as failures even when every word is decodable", async () => {
    const longSentence = story(["Sam sat on a mat on a mat on a mat.", "Sam sat.", "Sam sat."]);
    const fixed = story(["Sam sat on a mat.", "Sam sat.", "Sam sat."]);
    const { gen, requests } = scripted([longSentence, fixed]);
    const result = await new Author(gen, lex).write(constraints);
    expect(result.ok).toBe(true);
    expect(result.rounds).toBe(2);
    expect(requests[1]!.messages[2]!.content as string).toMatch(/Text problems:/);
  });

  it("stops immediately on a refusal", async () => {
    const { gen, requests } = scripted([null], ["refusal"]);
    const result = await new Author(gen, lex).write(constraints);
    expect(result.ok).toBe(false);
    expect(result.rounds).toBe(1);
    expect(requests).toHaveLength(1);
  });

  it("runs the safety gate on a verified draft and retries when it objects", async () => {
    const draft = story(["Sam sat on a mat.", "Sam is sad.", "Sam naps."]);
    const { gen, requests } = scripted([draft, draft]);
    let calls = 0;
    const safetyGate = async () => (++calls === 1 ? { ok: false, problems: ["too sad"] } : { ok: true, problems: [] });
    const result = await new Author(gen, lex, { safetyGate }).write(constraints);
    expect(result.ok).toBe(true);
    expect(result.rounds).toBe(2);
    expect(calls).toBe(2);
    expect(requests[1]!.messages[2]!.content as string).toMatch(/Content problems:\n {2}- too sad/);
  });

  it("verifies the title as well as the body", async () => {
    const { gen } = scripted([story(["Sam sat.", "Sam sat.", "Sam sat."], "The Ship")]);
    const result = await new Author(gen, lex, { maxRounds: 1 }).write(constraints);
    expect(result.ok).toBe(false);
    expect(result.attempts[0]!.report!.failures.map((f) => f.word)).toEqual(["ship"]);
  });
});

describe("feedback rendering", () => {
  it("de-duplicates repeated rejected words", () => {
    const report = verify("ship ship dog", taughtSetThroughLesson(graph, 10), lex);
    const text = renderFeedback(report, [], []);
    expect(text.match(/^ {2}- "ship"/gm)).toHaveLength(1);
    expect(text).toMatch(/rejected 2 word\(s\)/);
  });
});

describe("story bank", () => {
  const bank = loadStoryBank();

  it("has stories that verify at their own lesson", () => {
    for (const s of bank) {
      const report = verify(`${s.title} ${s.sentences.join(" ")}`, taughtSetThroughLesson(graph, s.lesson), lex, { allowList: s.allowList });
      expect(report.failures.map((f) => f.word), `${s.id} at lesson ${s.lesson}`).toEqual([]);
    }
  });

  it("falls back to the most advanced readable story", () => {
    expect(fallbackStory(bank, 20)?.lesson).toBe(14);
    expect(fallbackStory(bank, 40)?.lesson).toBe(31);
    expect(fallbackStory(bank, 3)).toBeUndefined();
  });
});

describe("cost estimate", () => {
  it("prices cache reads at 10% and writes at 125% of input", () => {
    const u = { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 1_000_000 };
    expect(estimateCostUsd(u, "claude-opus-5")).toBeCloseTo(5 + 0.5 + 6.25);
    expect(estimateCostUsd(u, "claude-opus-5", true)).toBeCloseTo((5 + 0.5 + 6.25) / 2);
    expect(Number.isNaN(estimateCostUsd(u, "unknown"))).toBe(true);
  });
});
