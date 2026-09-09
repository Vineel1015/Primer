/**
 * Loading, validating and querying a skill graph.
 *
 * Structural rules enforced beyond the zod schema:
 *  - node ids are unique
 *  - every prerequisite exists
 *  - the prerequisite relation is acyclic
 *  - a prerequisite is introduced in the same or an earlier lesson
 *  - no two GPC nodes share the same grapheme *and* phoneme alternative
 */
import { readFileSync } from "node:fs";
import {
  SkillGraph as SkillGraphSchema,
  type GpcNode,
  type SkillGraph,
  type SkillNode,
} from "./schema.js";

export class SkillGraphError extends Error {
  constructor(message: string, public readonly problems: string[] = []) {
    super(problems.length ? `${message}\n  - ${problems.join("\n  - ")}` : message);
    this.name = "SkillGraphError";
  }
}

/** Everything a child has been taught up to some point: the inputs to decodability. */
export interface TaughtSet {
  gpcs: GpcNode[];
  heartWords: Set<string>;
  nodeIds: Set<string>;
}

export function loadSkillGraph(json: unknown): SkillGraph {
  const parsed = SkillGraphSchema.safeParse(json);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new SkillGraphError("skill graph failed schema validation", problems);
  }
  const graph = parsed.data;
  const problems = structuralProblems(graph);
  if (problems.length) throw new SkillGraphError("skill graph failed structural checks", problems);
  return graph;
}

export function loadSkillGraphFile(path: string | URL): SkillGraph {
  return loadSkillGraph(JSON.parse(readFileSync(path, "utf8")));
}

export function structuralProblems(graph: SkillGraph): string[] {
  const problems: string[] = [];
  const byId = new Map<string, SkillNode>();

  for (const node of graph.nodes) {
    if (byId.has(node.id)) problems.push(`duplicate node id "${node.id}"`);
    byId.set(node.id, node);
  }

  for (const node of graph.nodes) {
    for (const p of node.prerequisites) {
      const pre = byId.get(p);
      if (!pre) {
        problems.push(`"${node.id}" requires unknown node "${p}"`);
      } else if (pre.lesson > node.lesson) {
        problems.push(`"${node.id}" (lesson ${node.lesson}) requires "${p}" introduced later (lesson ${pre.lesson})`);
      }
    }
  }

  // cycle detection by DFS colouring
  const state = new Map<string, 0 | 1 | 2>();
  const visit = (id: string, trail: string[]): void => {
    const s = state.get(id) ?? 0;
    if (s === 2) return;
    if (s === 1) {
      problems.push(`prerequisite cycle: ${[...trail, id].join(" -> ")}`);
      return;
    }
    state.set(id, 1);
    for (const p of byId.get(id)?.prerequisites ?? []) if (byId.has(p)) visit(p, [...trail, id]);
    state.set(id, 2);
  };
  for (const node of graph.nodes) visit(node.id, []);

  const seen = new Set<string>();
  for (const node of graph.nodes) {
    if (node.kind !== "gpc") continue;
    for (const alt of node.phonemes) {
      const key = `${node.grapheme}=${alt.join(" ")}`;
      if (seen.has(key)) problems.push(`GPC "${key}" is defined more than once (second: "${node.id}")`);
      seen.add(key);
    }
  }

  return problems;
}

export function nodeById(graph: SkillGraph, id: string): SkillNode {
  const node = graph.nodes.find((n) => n.id === id);
  if (!node) throw new SkillGraphError(`unknown node "${id}"`);
  return node;
}

/** Prerequisite-respecting order; ties broken by lesson, then id. */
export function topologicalOrder(graph: SkillGraph): SkillNode[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const n of graph.nodes) {
    indegree.set(n.id, n.prerequisites.length);
    for (const p of n.prerequisites) dependents.set(p, [...(dependents.get(p) ?? []), n.id]);
  }
  const ready = graph.nodes.filter((n) => n.prerequisites.length === 0);
  const out: SkillNode[] = [];
  const byLessonThenId = (a: SkillNode, b: SkillNode) => a.lesson - b.lesson || a.id.localeCompare(b.id);
  while (ready.length) {
    ready.sort(byLessonThenId);
    const n = ready.shift()!;
    out.push(n);
    for (const d of dependents.get(n.id) ?? []) {
      const left = (indegree.get(d) ?? 0) - 1;
      indegree.set(d, left);
      if (left === 0) ready.push(byId.get(d)!);
    }
  }
  return out;
}

/** All nodes introduced in lessons 1..lesson. */
export function nodesThroughLesson(graph: SkillGraph, lesson: number): SkillNode[] {
  return graph.nodes.filter((n) => n.lesson <= lesson);
}

export function taughtSetFromNodes(nodes: Iterable<SkillNode>): TaughtSet {
  const gpcs: GpcNode[] = [];
  const heartWords = new Set<string>();
  const nodeIds = new Set<string>();
  for (const n of nodes) {
    nodeIds.add(n.id);
    if (n.kind === "gpc") gpcs.push(n);
    else if (n.kind === "heart_word") heartWords.add(n.word.toLowerCase());
  }
  // Longest graphemes first so alignment tries <sh> before <s>; purely a search-order hint.
  gpcs.sort((a, b) => b.grapheme.length - a.grapheme.length);
  return { gpcs, heartWords, nodeIds };
}

export function taughtSetThroughLesson(graph: SkillGraph, lesson: number): TaughtSet {
  return taughtSetFromNodes(nodesThroughLesson(graph, lesson));
}

/** Taught set from an explicit mastery record (what the planner will use). */
export function taughtSetFromMastered(graph: SkillGraph, masteredIds: Iterable<string>): TaughtSet {
  const wanted = new Set(masteredIds);
  return taughtSetFromNodes(graph.nodes.filter((n) => wanted.has(n.id)));
}

/**
 * Nodes whose prerequisites are all mastered but which are not themselves
 * mastered: the planner's candidate set for "what next".
 */
export function frontier(graph: SkillGraph, masteredIds: Iterable<string>): SkillNode[] {
  const done = new Set(masteredIds);
  return graph.nodes
    .filter((n) => !done.has(n.id) && n.prerequisites.every((p) => done.has(p)))
    .sort((a, b) => a.lesson - b.lesson || a.id.localeCompare(b.id));
}
