/**
 * Decodability verifier.
 *
 * A word is decodable for a child iff its letters can be segmented into taught
 * graphemes whose taught phonemes, concatenated, equal one of the word's
 * dictionary pronunciations. This is stricter than a letters-only check: "was"
 * segments into w-a-s but /w AA z/ does not match short-a + /s/, so it is
 * (correctly) not decodable until it is taught as a heart word.
 *
 * Also passes: taught heart words, and allow-listed proper nouns (the child's
 * name, pet, sibling).
 *
 * The verifier is deterministic and has no LLM in it. It is the gate between
 * the Author and the child.
 */
import type { GpcNode } from "../skill-graph/schema.js";
import type { TaughtSet } from "../skill-graph/graph.js";
import type { Lexicon, Pronunciation } from "./lexicon.js";

export interface Segment {
  grapheme: string;
  phonemes: string[];
  nodeId: string;
}

export type WordStatus =
  | "decodable"
  | "heart_word"
  | "allow_listed"
  | "not_decodable"
  | "unknown_pronunciation"
  | "non_word";

export interface WordResult {
  /** As it appeared in the text. */
  token: string;
  /** Normalised lookup form. */
  word: string;
  status: WordStatus;
  /** Present for decodable words: the grapheme-by-grapheme reading. */
  segmentation?: Segment[];
  /** For unknown_pronunciation: whether the letters alone segment into taught graphemes. */
  orthographicallyDecodable?: boolean;
  /** Human-readable explanation of a failure. */
  reason?: string;
}

export interface VerifyOptions {
  /** Minimum fraction of counted words that must pass. Default 0.95. */
  threshold?: number;
  /** Proper nouns allowed regardless of decodability (case-insensitive). */
  allowList?: Iterable<string>;
  /**
   * How to treat words missing from the lexicon:
   *  - "fail" (default): they count as failures — the safe choice for the Author gate.
   *  - "orthographic": pass if the letters segment into taught graphemes.
   */
  unknownWords?: "fail" | "orthographic";
}

export interface VerifyReport {
  words: WordResult[];
  /** Words that took part in the ratio (excludes non-words such as bare numbers/punctuation). */
  counted: number;
  passed: number;
  ratio: number;
  threshold: number;
  pass: boolean;
  failures: WordResult[];
}

const PASSING: ReadonlySet<WordStatus> = new Set(["decodable", "heart_word", "allow_listed"]);

export function tokenize(text: string): string[] {
  return text
    .split(/[\s—–-]+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, ""))
    .filter((t) => t.length > 0);
}

export function verify(
  text: string,
  taught: TaughtSet,
  lexicon: Lexicon,
  options: VerifyOptions = {},
): VerifyReport {
  const threshold = options.threshold ?? 0.95;
  const allow = new Set([...(options.allowList ?? [])].map((w) => w.toLowerCase()));
  const words = tokenize(text).map((token) => checkWord(token, taught, lexicon, allow, options.unknownWords ?? "fail"));
  const countedWords = words.filter((w) => w.status !== "non_word");
  const passedWords = countedWords.filter((w) => isPass(w));
  const ratio = countedWords.length === 0 ? 1 : passedWords.length / countedWords.length;
  return {
    words,
    counted: countedWords.length,
    passed: passedWords.length,
    ratio,
    threshold,
    pass: ratio >= threshold,
    failures: countedWords.filter((w) => !isPass(w)),
  };
}

function isPass(w: WordResult): boolean {
  return PASSING.has(w.status) || (w.status === "unknown_pronunciation" && w.orthographicallyDecodable === true && w.reason === undefined);
}

export function checkWord(
  token: string,
  taught: TaughtSet,
  lexicon: Lexicon,
  allow: ReadonlySet<string> = new Set(),
  unknownWords: "fail" | "orthographic" = "fail",
): WordResult {
  const word = token.toLowerCase();
  if (!/^[a-z]+(?:'[a-z]+)?$/.test(word)) {
    return { token, word, status: "non_word", reason: "not an alphabetic word" };
  }
  if (allow.has(word)) return { token, word, status: "allow_listed" };
  if (taught.heartWords.has(word)) return { token, word, status: "heart_word" };

  const letters = word.replace(/'/g, "");
  const prons = lexicon.get(word);
  if (!prons) {
    const ortho = segmentOrthographic(letters, taught.gpcs);
    const result: WordResult = {
      token,
      word,
      status: "unknown_pronunciation",
      orthographicallyDecodable: ortho !== null,
    };
    if (ortho && unknownWords === "orthographic") result.segmentation = ortho;
    else result.reason = ortho
      ? "no pronunciation in lexicon (letters do segment into taught graphemes)"
      : "no pronunciation in lexicon and letters do not segment into taught graphemes";
    return result;
  }

  let deepest = 0;
  for (const pron of prons) {
    const { segments, deepest: d } = align(letters, pron, taught.gpcs);
    if (segments) return { token, word, status: "decodable", segmentation: segments };
    deepest = Math.max(deepest, d);
  }
  return {
    token,
    word,
    status: "not_decodable",
    reason: deepest >= letters.length
      ? `letters align but pronunciation /${prons[0]!.join(" ")}/ needs an untaught sound`
      : `no taught grapheme for "${letters.slice(deepest)}" in /${prons[0]!.join(" ")}/`,
  };
}

/** Dynamic-programming alignment of letters to one pronunciation over the taught GPCs. */
export function align(
  letters: string,
  pron: Pronunciation,
  gpcs: readonly GpcNode[],
): { segments: Segment[] | null; deepest: number } {
  const consonants = gpcs.filter((g) => g.isConsonant && !g.grapheme.includes("_"));
  const memo = new Map<string, Segment[] | null>();
  let deepest = 0;

  const go = (i: number, j: number): Segment[] | null => {
    if (i === letters.length) return j === pron.length ? [] : null;
    const key = `${i}:${j}`;
    if (memo.has(key)) return memo.get(key)!;
    if (i > deepest) deepest = i;

    let result: Segment[] | null = null;
    search: for (const g of gpcs) {
      if (g.position === "initial" && i !== 0) continue;
      const split = g.grapheme.indexOf("_");

      if (split === -1) {
        if (!letters.startsWith(g.grapheme, i)) continue;
        const next = i + g.grapheme.length;
        if (g.context && !(letters[next] !== undefined && g.context.before.includes(letters[next]!))) continue;
        for (const alt of g.phonemes) {
          if (!seqAt(pron, j, alt)) continue;
          const rest = go(next, j + alt.length);
          if (rest) {
            result = [{ grapheme: g.grapheme, phonemes: alt, nodeId: g.id }, ...rest];
            break search;
          }
        }
        continue;
      }

      // VCe pattern: <pre> + one taught consonant grapheme + <post>
      const pre = g.grapheme.slice(0, split);
      const post = g.grapheme.slice(split + 1);
      if (!letters.startsWith(pre, i)) continue;
      const ci = i + pre.length;
      for (const c of consonants) {
        if (!letters.startsWith(c.grapheme, ci)) continue;
        const pi = ci + c.grapheme.length;
        if (!letters.startsWith(post, pi)) continue;
        const next = pi + post.length;
        for (const valt of g.phonemes) {
          for (const calt of c.phonemes) {
            const alt = [...valt, ...calt];
            if (!seqAt(pron, j, alt)) continue;
            const rest = go(next, j + alt.length);
            if (rest) {
              result = [
                { grapheme: g.grapheme, phonemes: valt, nodeId: g.id },
                { grapheme: c.grapheme, phonemes: calt, nodeId: c.id },
                ...rest,
              ];
              break search;
            }
          }
        }
      }
    }
    memo.set(key, result);
    return result;
  };

  return { segments: go(0, 0), deepest };
}

/** Letters-only segmentation, used when a word has no known pronunciation. */
export function segmentOrthographic(letters: string, gpcs: readonly GpcNode[]): Segment[] | null {
  const consonants = gpcs.filter((g) => g.isConsonant && !g.grapheme.includes("_"));
  const memo = new Map<number, Segment[] | null>();
  const go = (i: number): Segment[] | null => {
    if (i === letters.length) return [];
    if (memo.has(i)) return memo.get(i)!;
    let result: Segment[] | null = null;
    search: for (const g of gpcs) {
      if (g.position === "initial" && i !== 0) continue;
      const split = g.grapheme.indexOf("_");
      if (split === -1) {
        if (!letters.startsWith(g.grapheme, i)) continue;
        const next = i + g.grapheme.length;
        if (g.context && !(letters[next] !== undefined && g.context.before.includes(letters[next]!))) continue;
        const rest = go(next);
        if (rest) {
          result = [{ grapheme: g.grapheme, phonemes: g.phonemes[0]!, nodeId: g.id }, ...rest];
          break;
        }
        continue;
      }
      const pre = g.grapheme.slice(0, split);
      const post = g.grapheme.slice(split + 1);
      if (!letters.startsWith(pre, i)) continue;
      const ci = i + pre.length;
      for (const c of consonants) {
        if (!letters.startsWith(c.grapheme, ci)) continue;
        const pi = ci + c.grapheme.length;
        if (!letters.startsWith(post, pi)) continue;
        const rest = go(pi + post.length);
        if (rest) {
          result = [
            { grapheme: g.grapheme, phonemes: g.phonemes[0]!, nodeId: g.id },
            { grapheme: c.grapheme, phonemes: c.phonemes[0]!, nodeId: c.id },
            ...rest,
          ];
          break search;
        }
      }
    }
    memo.set(i, result);
    return result;
  };
  return go(0);
}

function seqAt(pron: Pronunciation, j: number, alt: readonly string[]): boolean {
  if (j + alt.length > pron.length) return false;
  for (let k = 0; k < alt.length; k++) if (pron[j + k] !== alt[k]) return false;
  return true;
}
