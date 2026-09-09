/**
 * Human-written decodable stories: the floor the Author falls back to.
 * Every story is verified at its own lesson by the test suite.
 */
import { readFileSync } from "node:fs";
import { z } from "zod";
import type { Story } from "./schema.js";

const BANK_PATH = new URL("../../data/stories/bank.json", import.meta.url);

export const BankStory = z.object({
  id: z.string(),
  lesson: z.number().int().positive(),
  title: z.string(),
  sentences: z.array(z.string()).min(1),
  allowList: z.array(z.string()).default([]),
  focusWords: z.array(z.string()).default([]),
});
export type BankStory = z.infer<typeof BankStory>;

export const StoryBankFile = z.object({ stories: z.array(BankStory) });

export function loadStoryBank(): BankStory[] {
  return StoryBankFile.parse(JSON.parse(readFileSync(BANK_PATH, "utf8"))).stories;
}

/** The most advanced bank story the child can read at this lesson, if any. */
export function fallbackStory(bank: BankStory[], lesson: number): BankStory | undefined {
  return bank.filter((s) => s.lesson <= lesson).sort((a, b) => b.lesson - a.lesson)[0];
}

export function toStory(s: BankStory): Story {
  return { title: s.title, sentences: s.sentences, focusWords: s.focusWords };
}
