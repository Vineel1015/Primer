/**
 * Quick decodability check from the terminal.
 *
 *   npm run verify -- --lesson 31 "The duck sat on a log."
 *   npm run verify -- --lesson 39 --allow Sam,Rex --orthographic "Sam and Rex make a cake."
 *   npm run verify -- --mastered gpc:a,gpc:m,gpc:s,gpc:t "Sam sat."
 */
import { Lexicon } from "../decodability/lexicon.js";
import { verify } from "../decodability/verifier.js";
import { loadUfli, taughtSetFromMastered, taughtSetThroughLesson } from "../skill-graph/index.js";

const args = process.argv.slice(2);
let lesson: number | undefined;
let mastered: string[] | undefined;
let allow: string[] = [];
let threshold: number | undefined;
let orthographic = false;
const textParts: string[] = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i]!;
  if (a === "--lesson") lesson = Number(args[++i]);
  else if (a === "--mastered") mastered = args[++i]!.split(",");
  else if (a === "--allow") allow = args[++i]!.split(",");
  else if (a === "--threshold") threshold = Number(args[++i]);
  else if (a === "--orthographic") orthographic = true;
  else textParts.push(a);
}

const text = textParts.join(" ").trim();
if (!text || (lesson === undefined && mastered === undefined)) {
  console.error("usage: verify (--lesson N | --mastered id,id,...) [--allow Name,Name] [--threshold 0.95] [--orthographic] \"text\"");
  process.exit(2);
}

const graph = loadUfli();
const taught = mastered ? taughtSetFromMastered(graph, mastered) : taughtSetThroughLesson(graph, lesson!);
const lexicon = Lexicon.load();
const report = verify(text, taught, lexicon, {
  allowList: allow,
  unknownWords: orthographic ? "orthographic" : "fail",
  ...(threshold !== undefined ? { threshold } : {}),
});

const scope = mastered ? `${mastered.length} mastered nodes` : `through lesson ${lesson}`;
console.log(`Taught: ${scope} · ${taught.gpcs.length} GPCs · ${taught.heartWords.size} heart words · lexicon ${lexicon.size} words\n`);
for (const w of report.words) {
  const seg = w.segmentation ? w.segmentation.map((s) => `${s.grapheme}→${s.phonemes.join("")}`).join(" ") : "";
  const mark = w.status === "decodable" || w.status === "heart_word" || w.status === "allow_listed" ? "✓" : w.status === "non_word" ? "·" : "✗";
  console.log(`${mark} ${w.token.padEnd(14)} ${w.status.padEnd(22)} ${seg}${w.reason ? `— ${w.reason}` : ""}`);
}
console.log(`\n${report.passed}/${report.counted} pass (${(report.ratio * 100).toFixed(1)}%) · threshold ${(report.threshold * 100).toFixed(0)}% · ${report.pass ? "PASS" : "FAIL"}`);
process.exit(report.pass ? 0 : 1);
