/**
 * Deterministic text checks that sit alongside decodability: length, shape,
 * and a small blocklist. The LLM safety gate (safety.ts) is the second line;
 * these are the cheap first line and run on every generation.
 */
import { tokenize } from "../decodability/verifier.js";
import type { Story } from "./schema.js";

export interface TextCheckOptions {
  minSentences: number;
  maxSentences: number;
  maxWordsPerSentence: number;
  blocklist?: readonly string[];
}

/** Words that never belong in a bedtime decodable, whatever the lesson. */
export const DEFAULT_BLOCKLIST: readonly string[] = [
  "kill", "killed", "dead", "die", "died", "gun", "guns", "blood", "hate", "hates",
  "stupid", "dumb", "idiot", "shut", "hell", "damn", "drunk", "beer", "cigarette",
];

export function checkStoryText(story: Story, opts: TextCheckOptions): string[] {
  const problems: string[] = [];
  const block = new Set((opts.blocklist ?? DEFAULT_BLOCKLIST).map((w) => w.toLowerCase()));

  if (!story.title.trim()) problems.push("title is empty");
  if (story.sentences.length < opts.minSentences) problems.push(`only ${story.sentences.length} sentences; need at least ${opts.minSentences}`);
  if (story.sentences.length > opts.maxSentences) problems.push(`${story.sentences.length} sentences; at most ${opts.maxSentences} allowed`);

  story.sentences.forEach((s, i) => {
    const words = tokenize(s);
    if (words.length === 0) problems.push(`sentence ${i + 1} is empty`);
    if (words.length > opts.maxWordsPerSentence) problems.push(`sentence ${i + 1} has ${words.length} words; at most ${opts.maxWordsPerSentence} allowed: "${s}"`);
    if (!/[.!?]["']?\s*$/.test(s)) problems.push(`sentence ${i + 1} does not end with . ! or ?: "${s}"`);
    if (/\d/.test(s)) problems.push(`sentence ${i + 1} contains a digit: "${s}"`);
    if (/\w'\w/.test(s)) problems.push(`sentence ${i + 1} contains a contraction or possessive: "${s}"`);
    for (const w of words) if (block.has(w.toLowerCase())) problems.push(`sentence ${i + 1} uses a blocked word "${w}"`);
  });

  for (const w of tokenize(story.title)) if (block.has(w.toLowerCase())) problems.push(`title uses a blocked word "${w}"`);
  return problems;
}
