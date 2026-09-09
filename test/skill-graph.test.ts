import { describe, expect, it } from "vitest";
import {
  SkillGraphError,
  frontier,
  loadSkillGraph,
  loadUfli,
  nodesThroughLesson,
  taughtSetThroughLesson,
  topologicalOrder,
} from "../src/skill-graph/index.js";

const tiny = () => ({
  version: "t",
  source: "test",
  status: "draft" as const,
  nodes: [
    { id: "gpc:a", kind: "gpc" as const, grapheme: "a", phonemes: [["AE"]], isConsonant: false, label: "a", lesson: 1 },
    { id: "gpc:m", kind: "gpc" as const, grapheme: "m", phonemes: [["M"]], isConsonant: true, label: "m", lesson: 2, prerequisites: ["gpc:a"] },
    { id: "hw:the", kind: "heart_word" as const, word: "the", label: "the", lesson: 2 },
  ],
});

describe("skill graph validation", () => {
  it("accepts a well-formed graph and applies defaults", () => {
    const g = loadSkillGraph(tiny());
    expect(g.mastery.pKnown).toBe(0.95);
    expect(g.nodes[0]!.prerequisites).toEqual([]);
  });

  it("rejects unknown prerequisites", () => {
    const bad = tiny();
    bad.nodes[1]!.prerequisites = ["gpc:zzz"];
    expect(() => loadSkillGraph(bad)).toThrow(/unknown node "gpc:zzz"/);
  });

  it("rejects prerequisites introduced in a later lesson", () => {
    const bad = tiny();
    bad.nodes[0] = { ...bad.nodes[0]!, prerequisites: ["gpc:m"] } as never;
    expect(() => loadSkillGraph(bad)).toThrow(/introduced later/);
  });

  it("rejects cycles", () => {
    const bad = tiny();
    bad.nodes[0] = { ...bad.nodes[0]!, lesson: 2, prerequisites: ["gpc:m"] } as never;
    expect(() => loadSkillGraph(bad)).toThrow(/cycle/);
  });

  it("rejects duplicate ids and duplicate GPCs", () => {
    const bad = tiny();
    bad.nodes.push({ ...bad.nodes[0]!, id: "gpc:a2" } as never);
    expect(() => loadSkillGraph(bad)).toThrow(/defined more than once/);
    const dup = tiny();
    dup.nodes.push({ ...dup.nodes[2]! });
    expect(() => loadSkillGraph(dup)).toThrow(/duplicate node id/);
  });

  it("rejects non-ARPAbet phonemes", () => {
    const bad = tiny();
    bad.nodes[0] = { ...bad.nodes[0]!, phonemes: [["ae"]] } as never;
    expect(() => loadSkillGraph(bad)).toThrow(SkillGraphError);
  });
});

describe("bundled UFLI graph", () => {
  const graph = loadUfli();

  it("loads, is a DAG, and is marked draft", () => {
    expect(graph.status).toBe("draft");
    expect(graph.nodes.length).toBeGreaterThan(80);
    expect(topologicalOrder(graph)).toHaveLength(graph.nodes.length);
  });

  it("introduces the 26 single-letter GPCs in lessons 1–26 in UFLI order", () => {
    const order = graph.nodes
      .filter((n) => n.kind === "gpc" && n.lesson <= 26)
      .sort((a, b) => a.lesson - b.lesson)
      .map((n) => (n.kind === "gpc" ? n.grapheme : ""))
      .join("");
    expect(order).toBe("amstpfinodcugbekhrlwjyxquvz");
  });

  it("computes the taught set through a lesson", () => {
    const t = taughtSetThroughLesson(graph, 10);
    expect(t.gpcs.map((g) => g.grapheme).sort()).toEqual(["a", "d", "f", "i", "m", "n", "o", "p", "s", "t"]);
    expect(t.heartWords).toEqual(new Set(["the", "a", "of", "is"]));
    expect(nodesThroughLesson(graph, 1).map((n) => n.id)).toContain("gpc:a");
  });

  it("orders longer graphemes first in the taught set", () => {
    const t = taughtSetThroughLesson(graph, 46);
    const idx = (g: string) => t.gpcs.findIndex((n) => n.grapheme === g);
    expect(idx("ing")).toBeLessThan(idx("ng"));
    expect(idx("ng")).toBeLessThan(idx("n"));
  });

  it("exposes a planner frontier from a mastery record", () => {
    const next = frontier(graph, ["pa:blend_2", "pa:isolate_initial", "gpc:a"]);
    const ids = next.map((n) => n.id);
    expect(ids).toContain("gpc:m");
    expect(ids).toContain("pa:blend_3");
    expect(ids).not.toContain("gpc:s");
  });
});
