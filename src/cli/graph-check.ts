/**
 * Validate the bundled skill graph and print a lesson-by-lesson summary.
 *
 *   npm run graph:check
 */
import { loadUfli, topologicalOrder } from "../skill-graph/index.js";

const graph = loadUfli();
const order = topologicalOrder(graph);
const byKind = new Map<string, number>();
for (const n of graph.nodes) byKind.set(n.kind, (byKind.get(n.kind) ?? 0) + 1);

console.log(`${graph.source} — version ${graph.version} — status: ${graph.status}`);
console.log(`${graph.nodes.length} nodes: ${[...byKind].map(([k, v]) => `${v} ${k}`).join(", ")}`);
console.log(`topological order covers ${order.length}/${graph.nodes.length} nodes\n`);

const lessons = [...new Set(graph.nodes.map((n) => n.lesson))].sort((a, b) => a - b);
for (const L of lessons) {
  const items = graph.nodes
    .filter((n) => n.lesson === L)
    .map((n) => (n.kind === "gpc" ? `<${n.grapheme}>` : n.kind === "heart_word" ? `♥${n.word}` : n.id));
  console.log(`L${String(L).padStart(3)}  ${items.join("  ")}`);
}
