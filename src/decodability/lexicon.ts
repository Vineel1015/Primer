/**
 * Pronunciation lexicon: word -> list of ARPAbet pronunciations (no stress).
 *
 * Two sources:
 *  - data/lexicon/core.json — a small hand-checked K–1 vocabulary that ships
 *    with the repo so tests and the CLI work offline.
 *  - data/lexicon/cmudict.dict — the full CMU Pronouncing Dictionary
 *    (~135k words), downloaded by `npm run lexicon:cmudict`. Loaded when present.
 */
import { existsSync, readFileSync } from "node:fs";

export type Pronunciation = string[];

const CORE_PATH = new URL("../../data/lexicon/core.json", import.meta.url);
const CMUDICT_PATH = new URL("../../data/lexicon/cmudict.dict", import.meta.url);

export class Lexicon {
  private readonly entries = new Map<string, Pronunciation[]>();

  get size(): number {
    return this.entries.size;
  }

  has(word: string): boolean {
    return this.entries.has(normalize(word));
  }

  get(word: string): Pronunciation[] | undefined {
    return this.entries.get(normalize(word));
  }

  add(word: string, pron: Pronunciation): this {
    const w = normalize(word);
    const list = this.entries.get(w) ?? [];
    const key = pron.join(" ");
    if (!list.some((p) => p.join(" ") === key)) list.push(pron);
    this.entries.set(w, list);
    return this;
  }

  merge(other: Lexicon): this {
    for (const [w, prons] of other.entries) for (const p of prons) this.add(w, p);
    return this;
  }

  /** The bundled core vocabulary. */
  static core(): Lexicon {
    const raw = JSON.parse(readFileSync(CORE_PATH, "utf8")) as Record<string, Pronunciation[]>;
    const lex = new Lexicon();
    for (const [w, prons] of Object.entries(raw)) for (const p of prons) lex.add(w, p);
    return lex;
  }

  /** Core plus CMUdict if it has been downloaded. */
  static load(): Lexicon {
    const lex = Lexicon.core();
    if (existsSync(CMUDICT_PATH)) lex.merge(Lexicon.fromCmuDict(readFileSync(CMUDICT_PATH, "utf8")));
    return lex;
  }

  /**
   * Parse CMUdict text. Accepts both the classic `WORD  PH ON` layout and the
   * cmusphinx `word ph on` layout; `word(2)` variants become alternatives;
   * stress digits are stripped; `;;;` comments and non-alphabetic
   * headwords are skipped.
   */
  static fromCmuDict(text: string): Lexicon {
    const lex = new Lexicon();
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith(";;;")) continue;
      const hashAt = line.indexOf(" #");
      const clean = hashAt === -1 ? line : line.slice(0, hashAt);
      const [head, ...phones] = clean.split(/\s+/);
      if (!head || phones.length === 0) continue;
      const word = head.replace(/\(\d+\)$/, "");
      if (!/^[a-z][a-z'\-.]*$/i.test(word)) continue;
      lex.add(word, phones.map((p) => p.replace(/\d+$/, "").toUpperCase()));
    }
    return lex;
  }
}

function normalize(word: string): string {
  return word.toLowerCase();
}
