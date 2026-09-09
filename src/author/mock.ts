/**
 * A stand-in StoryGenerator for running the pipeline without API credentials.
 *
 * It reads the allowed vocabulary out of the rendered request (the same text
 * the model sees), composes a small repetitive story from it, and — to exercise
 * the feedback loop the way a real model would — slips one tempting untaught
 * word into the first draft. On feedback it removes every rejected word.
 *
 * Its output says nothing about Claude's quality. It exists so the harness,
 * the reporting and the fallback path can be run and tested offline.
 */
import type { GenerateRequest, GenerateResult, StoryGenerator } from "./author.js";
import type { Story } from "./schema.js";

export interface MockOptions {
  /** Probability that the first draft includes an untaught "tempting" word. Default 0.5. */
  slipRate?: number;
  /** Seed for the deterministic PRNG so eval runs are reproducible. */
  seed?: number;
  /** Simulated token usage per call. */
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };
}

/**
 * Common words a real model reaches for. Ordered so the first few are never
 * decodable within lessons 1–46 (vowel teams, y-as-vowel), which keeps the
 * simulated slip a genuine slip rather than an accidental pass.
 */
const TEMPTING = ["look", "little", "happy", "friend", "play", "jump", "fun", "run", "big", "and"];

export function mockStoryGenerator(options: MockOptions = {}): StoryGenerator {
  const slipRate = options.slipRate ?? 0.5;
  const rand = mulberry32(options.seed ?? 1);
  const usage = options.usage ?? { inputTokens: 350, outputTokens: 220, cacheReadTokens: 1400, cacheWriteTokens: 0 };

  return async (req: GenerateRequest): Promise<GenerateResult> => {
    const first = String(req.messages[0]?.content ?? "");
    const vocab = parseVocabulary(first);
    const rejected = collectRejected(req.messages);
    const isRetry = req.messages.length > 1;

    const story = compose(vocab, rejected, isRetry ? 0 : slipRate, rand);
    return { story, rawText: JSON.stringify(story), stopReason: "end_turn", usage: { ...usage } };
  };
}

interface Vocab {
  names: string[];
  heart: string[];
  bank: string[];
  focus: string | undefined;
  minSentences: number;
  maxSentences: number;
  maxWords: number;
}

function parseVocabulary(text: string): Vocab {
  const list = (label: string): string[] => {
    const m = text.match(new RegExp(`^${label}[^:]*: (.*)$`, "m"));
    if (!m || !m[1] || m[1].startsWith("(")) return [];
    return m[1].split(",").map((w) => w.trim()).filter(Boolean);
  };
  const focus = text.match(/^Focus grapheme[^:]*: (\S+)/m)?.[1];
  const len = text.match(/Length: (\d+)–(\d+) sentences, at most (\d+) words/);
  return {
    names: list("Names allowed"),
    heart: list("Heart words allowed"),
    bank: list("Word bank"),
    focus: focus === "none" ? undefined : focus,
    minSentences: Number(len?.[1] ?? 5),
    maxSentences: Number(len?.[2] ?? 9),
    maxWords: Number(len?.[3] ?? 7),
  };
}

function collectRejected(messages: GenerateRequest["messages"]): Set<string> {
  const out = new Set<string>();
  for (const m of messages) {
    if (m.role !== "user" || typeof m.content !== "string") continue;
    for (const hit of m.content.matchAll(/^ {2}- "([^"]+)":/gm)) out.add(hit[1]!.toLowerCase());
  }
  return out;
}

function compose(v: Vocab, rejected: Set<string>, slipRate: number, rand: () => number): Story {
  const ok = (w: string) => !rejected.has(w.toLowerCase());
  const bank = v.bank.filter(ok);
  const names = v.names.filter(ok);
  const heart = v.heart.filter(ok);
  const subject = names[0] ?? pick(bank, rand) ?? "it";
  const article = heart.includes("a") ? "a " : "";
  const focusWords = v.focus ? bank.filter((w) => w.includes(v.focus!.replace("_", ""))) : [];

  const nouns = bank.filter((w) => w.length >= 3);
  const verbs = bank.filter((w) => /s$/.test(w) && w.length >= 4); // crude: "naps", "taps", "digs"
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  // Function words are only usable when the curriculum has actually made them readable.
  const allowed = new Set([...bank, ...heart]);
  const has = (...ws: string[]) => ws.every((w) => allowed.has(w));

  const sentences: string[] = [];
  const target = Math.min(v.maxSentences, Math.max(v.minSentences, 5));
  for (let i = 0; sentences.length < target; i++) {
    const n = pick(nouns, rand) ?? "it";
    const f = pick(focusWords, rand) ?? n;
    const vb = pick(verbs, rand);
    const shapes = [
      has("sat", "on") ? `${cap(subject)} sat on ${article}${n}.` : has("sat", "at") ? `${cap(subject)} sat at ${article}${n}.` : undefined,
      has("has") ? `${cap(subject)} has ${article}${f}.` : undefined,
      vb ? `${cap(subject)} ${vb}.` : undefined,
      `${cap(f)}, ${f}, ${f}!`,
      has("the", "is", "on") ? `The ${f} is on the ${n}.` : has("sat") ? `${cap(subject)} sat.` : `${cap(f)}.`,
    ].filter((s): s is string => s !== undefined);
    let s = shapes[i % shapes.length]!;
    if (s.split(" ").length > v.maxWords) s = `${cap(f)}.`;
    sentences.push(s);
  }

  // First-draft slip: two tempting untaught words, the way a real model drifts.
  // Two, so a ~22-word story lands below the 95% gate and the feedback path runs.
  if (slipRate > 0 && rand() < slipRate) {
    const slips = TEMPTING.filter((w) => !allowed.has(w)).slice(0, 2);
    if (slips.length) {
      const at = Math.floor(rand() * sentences.length);
      sentences[at] = `${cap(subject)} is ${slips.join(", ")}.`;
    }
  }

  const title = cap(subject === "it" ? (nouns[0] ?? "It") : subject);
  return { title, sentences, focusWords: [...new Set(focusWords.slice(0, 4))] };
}

function pick<T>(xs: T[], rand: () => number): T | undefined {
  return xs.length ? xs[Math.floor(rand() * xs.length)] : undefined;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
