/**
 * Author eval harness. Runs the Author over data/eval/author-cases.json and
 * reports the metrics the plan gates on:
 *
 *   - first-pass decodability ratio (headline; gate ≥ 0.90 mean before shipping)
 *   - final pass rate within maxRounds
 *   - mean rounds, tokens and cost per verified story
 *
 * Writes a JSON report to eval-results/author-<generator>-<timestamp>.json.
 *
 *   npm run eval:author                                   # Opus 5, all cases
 *   npm run eval:author -- --limit 3 --model claude-sonnet-5 --effort medium
 *   npm run eval:author -- --generator mock               # offline: proves the harness, says nothing about Claude
 */
import Anthropic from "@anthropic-ai/sdk";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { Lexicon } from "../decodability/lexicon.js";
import { loadUfli } from "../skill-graph/index.js";
import {
  Author,
  buildConstraints,
  claudeSafetyGate,
  claudeStoryGenerator,
  DEFAULT_AUTHOR_MODEL,
  estimateCostUsd,
  fallbackStory,
  hasAnthropicCredentials,
  loadStoryBank,
  mockStoryGenerator,
  NO_CREDENTIALS_MESSAGE,
  storyText,
  type AuthorResult,
  type ChildProfile,
  type Effort,
  type StoryGenerator,
} from "../author/index.js";

const Cases = z.object({
  cases: z.array(z.object({
    id: z.string(),
    lesson: z.number().int().positive(),
    profile: z.object({
      name: z.string().optional(),
      interests: z.array(z.string()).optional(),
      allowList: z.array(z.string()).optional(),
    }),
  })),
});

const args = process.argv.slice(2);
let limit = Number.POSITIVE_INFINITY;
let model = DEFAULT_AUTHOR_MODEL;
let effort: Effort = "high";
let safety = false;
let only: string | undefined;
let generatorKind: "claude" | "mock" = "claude";
let seed = 1;
for (let i = 0; i < args.length; i++) {
  const a = args[i]!;
  if (a === "--limit") limit = Number(args[++i]);
  else if (a === "--model") model = args[++i]!;
  else if (a === "--effort") effort = args[++i] as Effort;
  else if (a === "--safety") safety = true;
  else if (a === "--only") only = args[++i];
  else if (a === "--generator") generatorKind = args[++i] as "claude" | "mock";
  else if (a === "--seed") seed = Number(args[++i]);
}

const casesPath = new URL("../../data/eval/author-cases.json", import.meta.url);
const allCases = Cases.parse(JSON.parse(readFileSync(casesPath, "utf8"))).cases;
const cases = allCases.filter((c) => !only || c.id === only).slice(0, limit);

let generator: StoryGenerator;
let safetyGate: ReturnType<typeof claudeSafetyGate> | undefined;
if (generatorKind === "mock") {
  generator = mockStoryGenerator({ seed });
  model = "mock";
} else {
  if (!hasAnthropicCredentials()) {
    console.error(NO_CREDENTIALS_MESSAGE);
    process.exit(2);
  }
  const client = new Anthropic();
  generator = claudeStoryGenerator(client, { model, effort });
  if (safety) safetyGate = claudeSafetyGate(client);
}

const graph = loadUfli();
const lexicon = Lexicon.load();
const bank = loadStoryBank();
const author = new Author(generator, lexicon, safetyGate ? { safetyGate } : {});

interface CaseResult {
  id: string;
  lesson: number;
  ok: boolean;
  usedFallback: boolean;
  rounds: number;
  firstPassRatio: number | null;
  finalRatio: number | null;
  costUsd: number;
  seconds: number;
  story?: { title: string; text: string };
  failures: { round: number; words: string[]; textProblems: string[] }[];
}

const banner = generatorKind === "mock"
  ? `Author eval · MOCK generator (seed ${seed}) · proves the harness only; numbers say nothing about Claude`
  : `Author eval · ${model} (${effort})${safety ? " · safety gate on" : ""}`;
console.log(`${banner}\n${cases.length} case(s)\n`);

const results: CaseResult[] = [];
for (const c of cases) {
  const profile: ChildProfile = {};
  if (c.profile.name) profile.name = c.profile.name;
  if (c.profile.interests) profile.interests = c.profile.interests;
  if (c.profile.allowList) profile.allowList = c.profile.allowList;
  const constraints = buildConstraints(graph, { lesson: c.lesson }, profile);

  const started = Date.now();
  let result: AuthorResult;
  try {
    result = await author.write(constraints);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      console.log(`${c.id}: rate limited, skipping`);
      continue;
    }
    throw err;
  }
  const seconds = (Date.now() - started) / 1000;
  const last = result.attempts.at(-1);
  const fb = result.ok ? undefined : fallbackStory(bank, c.lesson);

  const row: CaseResult = {
    id: c.id,
    lesson: c.lesson,
    ok: result.ok,
    usedFallback: !result.ok && !!fb,
    rounds: result.rounds,
    firstPassRatio: result.firstPassRatio,
    finalRatio: last?.report?.ratio ?? null,
    costUsd: generatorKind === "mock" ? estimateCostUsd(result.usage, DEFAULT_AUTHOR_MODEL) : estimateCostUsd(result.usage, model),
    seconds,
    failures: result.attempts
      .filter((a) => (a.report && !a.report.pass) || a.textProblems.length)
      .map((a) => ({ round: a.round, words: [...new Set(a.report?.failures.map((f) => f.word) ?? [])], textProblems: a.textProblems })),
  };
  if (result.story) row.story = { title: result.story.title, text: storyText(result.story) };
  else if (fb) row.story = { title: `${fb.title} (bank fallback)`, text: fb.sentences.join(" ") };
  results.push(row);

  const fp = row.firstPassRatio === null ? "  —  " : `${(row.firstPassRatio * 100).toFixed(0).padStart(3)}%`;
  const mark = row.ok ? "✓" : row.usedFallback ? "↩" : "✗";
  console.log(`${mark} ${c.id.padEnd(16)} L${String(c.lesson).padStart(2)}  first-pass ${fp}  rounds ${row.rounds}  $${row.costUsd.toFixed(3)}  ${seconds.toFixed(1)}s${row.story ? `  "${row.story.title}"` : ""}`);
  for (const f of row.failures) console.log(`     round ${f.round} rejected: ${[...f.words, ...f.textProblems].join(", ")}`);
}

const n = results.length;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Number.NaN);
const summary = {
  generator: generatorKind,
  model: generatorKind === "mock" ? `mock (cost priced as ${DEFAULT_AUTHOR_MODEL})` : model,
  effort, safety, cases: n,
  passRate: mean(results.map((r) => (r.ok ? 1 : 0))),
  fallbackRate: mean(results.map((r) => (r.usedFallback ? 1 : 0))),
  meanFirstPassRatio: mean(results.map((r) => r.firstPassRatio).filter((x): x is number => x !== null)),
  firstPassAtThreshold: mean(results.map((r) => ((r.firstPassRatio ?? 0) >= 0.95 ? 1 : 0))),
  meanRounds: mean(results.map((r) => r.rounds)),
  meanCostUsd: mean(results.map((r) => r.costUsd)),
  totalCostUsd: results.reduce((a, r) => a + r.costUsd, 0),
  gate: { meanFirstPassRatioAtLeast: 0.9 },
};
const gatePassed = summary.meanFirstPassRatio >= summary.gate.meanFirstPassRatioAtLeast;

console.log(`\npass rate ${(summary.passRate * 100).toFixed(0)}% · fallback ${(summary.fallbackRate * 100).toFixed(0)}% · mean first-pass decodability ${(summary.meanFirstPassRatio * 100).toFixed(1)}% (gate ≥ 90%: ${gatePassed ? "PASS" : "FAIL"}) · first-pass ≥95%: ${(summary.firstPassAtThreshold * 100).toFixed(0)}% · mean rounds ${summary.meanRounds.toFixed(2)} · mean $${summary.meanCostUsd.toFixed(3)}/story · total $${summary.totalCostUsd.toFixed(3)}`);
if (generatorKind === "mock") console.log("MOCK RUN — these figures describe the mock generator, not Claude.");

const outDir = fileURLToPath(new URL("../../eval-results/", import.meta.url));
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = `${outDir}author-${generatorKind}-${stamp}.json`;
writeFileSync(outPath, JSON.stringify({ summary, results }, null, 2));
console.log(`report: ${outPath}`);
