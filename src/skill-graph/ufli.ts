import { loadSkillGraphFile } from "./graph.js";
import type { SkillGraph } from "./schema.js";

export const UFLI_GRAPH_PATH = new URL("../../data/curriculum/ufli-foundations.json", import.meta.url);

let cached: SkillGraph | undefined;

/** The bundled UFLI Foundations encoding (draft until reviewed by the literacy lead). */
export function loadUfli(): SkillGraph {
  cached ??= loadSkillGraphFile(UFLI_GRAPH_PATH);
  return cached;
}
