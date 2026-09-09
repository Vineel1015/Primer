/**
 * Author eval harness. Runs the Author over data/eval/author-cases.json against
 * the real API and reports the metrics the plan gates on:
 *
 *   - first-pass decodability ratio (headline; gate ≥ 0.90 mean before shipping)
 *   - final pass rate within maxRounds
 *   - mean rounds, tokens and cost per verified story
 *
 * Writes a JSON report to eval-results/author-<timestamp>.json.
 *
 *   npm run eval:author                       # all cases, Opus 5
 *   npm run eval:author -- --limit 3 --model claude-sonnet-5 --effort medium
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
  storyText,
  type AuthorResult,
  type ChildProfile,
  type Effort,
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
for (let i = 0; i < args.length; i++) {
  const a = args[i]!;
  if (a === "--limit") limit = Number(args[++i]);
  else if (a === "--model") model = args[++i]!;
  else if (a === "--effort") effort = args[++i] as Effort;
  else if (a === "--safety") safety = true;
  else if (a === "--only") only = args[++i];
}

const casesPath = new URL("../../data/eval/author-cases.json", import.meta.url);
const allCases = Cases.parse(JSON.parse(readFileSync(casesPath, "utf8"))).cases;
const cases = allCases.filter((c) => !only || c.id === only).slice(0, limit);

const client = new Anthropic();
const graph = loadUfli();
const lexicon = Lexicon.load();
const author = new Author(claudeStoryGenerator(client, { model, effort }), lexicon, {
  ...(safety ? { safetyGate: claudeSafetyGate(client) } : {}),
});

interface CaseResult {
  id: string;
  lesson: number;
  ok: boolean;
  rounds: number;
  firstPassRatio: number | null;
  finalRatio: number | null;
  costUsd: number;
  seconds: number;
  story?: { title: string; text: string };
  failures: { round: number; words: string[]; textProblems: string[] }[];
}

const results: CaseResult[] = [];
console.log(`Author eval · ${cases.length} case(s) · ${model} (${effort})${safety ? " · safety gate on" : ""}\n`);

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
  const row: CaseResult = {
    id: c.id,
    lesson: c.lesson,
    ok: result.ok,
    rounds: result.rounds,
    firstPassRatio: result.firstPassRatio,
    finalRatio: last?.report?.ratio ?? null,
    costUsd: estimateCostUsd(result.usage, model),
    seconds,
    failures: result.attempts
      .filter((a) => a.report && !a.report.pass || a.textProblems.length)
      .map((a) => ({ round: a.round, words: [...new Set(a.report?.failures.map((f) => f.word) ?? [])], textProblems: a.textProblems })),
  };
  if (result.story) row.story = { title: result.story.title, text: storyText(result.story) };
  results.push(row);

  const fp = row.firstPassRatio === null ? "  —  " : `${(row.firstPassRatio * 100).toFixed(0).padStart(3)}%`;
  console.log(`${row.ok ? "✓" : "✗"} ${c.id.padEnd(16)} L${String(c.lesson).padStart(2)}  first-pass ${fp}  rounds ${row.rounds}  $${row.costUsd.toFixed(3)}  ${seconds.toFixed(0)}s${row.story ? `  "${row.story.title}"` : ""}`);
  for (const f of row.failures) console.log(`     round ${f.round}: ${[...f.words, ...f.textProblems].join(", ")}`);
}

const n = results.length;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Number.NaN);
const summary = {
  model, effort, safety, cases: n,
  passRate: mean(results.map((r) => (r.ok ? 1 : 0))),
  meanFirstPassRatio: mean(results.map((r) => r.firstPassRatio).filter((x): x is number => x !== null)),
  firstPassAtThreshold: mean(results.map((r) => ((r.firstPassRatio ?? 0) >= 0.95 ? 1 : 0))),
  meanRounds: mean(results.map((r) => r.rounds)),
  meanCostUsd: mean(results.map((r) => r.costUsd)),
  totalCostUsd: results.reduce((a, r) => a + r.costUsd, 0),
};

console.log(`\npass rate ${(summary.passRate * 100).toFixed(0)}% · mean first-pass decodability ${(summary.meanFirstPassRatio * 100).toFixed(1)}% · first-pass ≥95%: ${(summary.firstPassAtThreshold * 100).toFixed(0)}% · mean rounds ${summary.meanRounds.toFixed(2)} · mean $${summary.meanCostUsd.toFixed(3)}/story · total $${summary.totalCostUsd.toFixed(3)}`);

const outDir = fileURLToPath(new URL("../../eval-results/", import.meta.url));
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = `${outDir}author-${stamp}.json`;
writeFileSync(outPath, JSON.stringify({ summary, results }, null, 2));
console.log(`report: ${outPath}`);
