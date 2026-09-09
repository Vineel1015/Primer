/**
 * Download the CMU Pronouncing Dictionary (BSD licence) into data/lexicon/.
 * Not committed; the core lexicon covers tests and the CLI without it.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const URL_ = "https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict";
const dest = fileURLToPath(new URL("../data/lexicon/cmudict.dict", import.meta.url));

const res = await fetch(URL_);
if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);
const text = await res.text();
mkdirSync(fileURLToPath(new URL("../data/lexicon/", import.meta.url)), { recursive: true });
writeFileSync(dest, text, "utf8");
console.log(`saved ${text.split("\n").length} lines to ${dest}`);
