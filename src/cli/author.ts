/**
 * Generate one verified story from the terminal (calls the Claude API).
 *
 *   npm run author -- --lesson 20 --name Maya --interests "her dog Rex,mud" --allow Rex
 *   npm run author -- --lesson 31 --name Ivy --model claude-sonnet-5 --effort medium --safety
 */
import Anthropic from "@anthropic-ai/sdk";
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
  loadStoryBank,
  storyText,
  type Effort,
} from "../author/index.js";

const args = process.argv.slice(2);
let lesson = 10;
let name: string | undefined;
let interests: string[] = [];
let allow: string[] = [];
let model = DEFAULT_AUTHOR_MODEL;
let effort: Effort = "high";
let rounds = 3;
let safety = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i]!;
  if (a === "--lesson") lesson = Number(args[++i]);
  else if (a === "--name") name = args[++i];
  else if (a === "--interests") interests = args[++i]!.split(",").map((s) => s.trim());
  else if (a === "--allow") allow = args[++i]!.split(",").map((s) => s.trim());
  else if (a === "--model") model = args[++i]!;
  else if (a === "--effort") effort = args[++i] as Effort;
  else if (a === "--rounds") rounds = Number(args[++i]);
  else if (a === "--safety") safety = true;
}

const client = new Anthropic();
const graph = loadUfli();
const lexicon = Lexicon.load();
const constraints = buildConstraints(graph, { lesson }, { ...(name ? { name } : {}), interests, allowList: allow });
const author = new Author(claudeStoryGenerator(client, { model, effort }), lexicon, {
  maxRounds: rounds,
  ...(safety ? { safetyGate: claudeSafetyGate(client) } : {}),
});

console.log(`Lesson ${lesson} · focus <${constraints.focus?.grapheme ?? "-"}> · ${constraints.wordBank.length} bank words · ${constraints.heartWords.length} heart words · model ${model} (${effort})\n`);
const started = Date.now();
const result = await author.write(constraints);
const secs = ((Date.now() - started) / 1000).toFixed(1);

for (const a of result.attempts) {
  const r = a.report;
  const verdict = !a.story ? `no story (${a.stopReason})` : r ? `${r.passed}/${r.counted} decodable (${(r.ratio * 100).toFixed(0)}%)${r.pass ? "" : " FAIL"}` : "";
  console.log(`round ${a.round}: ${verdict}${a.textProblems.length ? ` · ${a.textProblems.length} text problem(s)` : ""}${a.safetyProblems.length ? ` · safety: ${a.safetyProblems.join("; ")}` : ""}`);
  if (r && !r.pass) for (const f of r.failures) console.log(`   ✗ ${f.token}: ${f.reason ?? f.status}`);
}

if (result.ok && result.story) {
  console.log(`\n# ${result.story.title}\n\n${storyText(result.story)}\n`);
} else {
  const fb = fallbackStory(loadStoryBank(), lesson);
  console.log(`\nAuthor failed after ${result.rounds} round(s).`);
  if (fb) console.log(`Fallback from story bank: "${fb.title}" (lesson ${fb.lesson})\n\n${fb.sentences.join(" ")}\n`);
}

const u = result.usage;
console.log(`${secs}s · ${result.rounds} round(s) · in ${u.inputTokens} + cached ${u.cacheReadTokens} (+${u.cacheWriteTokens} written) · out ${u.outputTokens} · ≈ $${estimateCostUsd(u, model).toFixed(4)}`);
process.exit(result.ok ? 0 : 1);
