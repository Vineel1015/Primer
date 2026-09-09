/**
 * The decodable word bank: every curated word the child can already read.
 * Given to the Author so it writes from a known vocabulary instead of guessing.
 *
 * The bank is drawn from the curated core lexicon only, never from CMUdict —
 * CMUdict is fine for *checking* any word the model uses, but as a source of
 * words it is full of names, jargon and junk a five-year-old should not meet.
 */
import type { TaughtSet } from "../skill-graph/graph.js";
import { Lexicon } from "../decodability/lexicon.js";
import { checkWord } from "../decodability/verifier.js";

export function decodableWordBank(taught: TaughtSet, curated: Lexicon = Lexicon.core()): string[] {
  const words: string[] = [];
  for (const word of curated.words()) {
    if (taught.heartWords.has(word)) continue;
    if (checkWord(word, taught, curated).status === "decodable") words.push(word);
  }
  return words.sort();
}
