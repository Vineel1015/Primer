/**
 * Claude-backed StoryGenerator and SafetyGate.
 *
 * Model choices follow the plan: Opus 5 authors (quality matters, runs
 * nightly, not latency-bound); Haiku 4.5 gates (cheap second opinion on
 * content). Both are overridable.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { GenerateResult, SafetyGate, StoryGenerator, Usage } from "./author.js";
import { Story } from "./schema.js";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface ClaudeAuthorOptions {
  model?: string;
  effort?: Effort;
  maxTokens?: number;
}

export const DEFAULT_AUTHOR_MODEL = "claude-opus-5";
export const DEFAULT_SAFETY_MODEL = "claude-haiku-4-5";

export function usageOf(u: Anthropic.Usage): Usage {
  return {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
  };
}

export function claudeStoryGenerator(client: Anthropic, options: ClaudeAuthorOptions = {}): StoryGenerator {
  const model = options.model ?? DEFAULT_AUTHOR_MODEL;
  const effort = options.effort ?? "high";
  const max_tokens = options.maxTokens ?? 16000;

  return async (req): Promise<GenerateResult> => {
    const response = await client.messages.parse({
      model,
      max_tokens,
      // Frozen system text with a cache breakpoint: every child, every night, same prefix.
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      messages: req.messages,
      thinking: { type: "adaptive" },
      output_config: { effort, format: zodOutputFormat(Story) },
    });

    const rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return {
      story: response.stop_reason === "refusal" ? null : (response.parsed_output ?? null),
      rawText,
      stopReason: response.stop_reason,
      usage: usageOf(response.usage),
    };
  };
}

const SafetyVerdictSchema = z.object({
  safe: z.boolean().describe("true only if every sentence is appropriate for a four-year-old at bedtime"),
  problems: z.array(z.string()).describe("Specific problems, quoting the sentence; empty if safe"),
});

const SAFETY_SYSTEM_PROMPT = `You review very short stories written for children aged four to seven who are learning to read. Judge only content and tone. A story is safe if a careful parent would happily read it aloud at bedtime: no fear or peril beyond mild silliness, no harm to people or animals, no weapons, no insults or unkindness that goes unresolved, no romance, no references to adult topics, nothing that mocks a group of people. Mild mess, mild mischief and gentle surprises are fine. Be strict about content and lenient about literary quality — the stories are deliberately simple and repetitive.`;

export function claudeSafetyGate(client: Anthropic, model: string = DEFAULT_SAFETY_MODEL): SafetyGate {
  return async (story) => {
    const response = await client.messages.parse({
      model,
      max_tokens: 1024,
      system: [{ type: "text", text: SAFETY_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `Title: ${story.title}\n\n${story.sentences.join("\n")}` }],
      output_config: { format: zodOutputFormat(SafetyVerdictSchema) },
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return { ok: false, problems: ["safety gate could not evaluate the story"] };
    }
    return { ok: response.parsed_output.safe, problems: response.parsed_output.problems };
  };
}
