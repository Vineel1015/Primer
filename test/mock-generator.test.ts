import { describe, expect, it } from "vitest";
import { Lexicon } from "../src/decodability/lexicon.js";
import { loadUfli } from "../src/skill-graph/index.js";
import { Author, buildConstraints, hasAnthropicCredentials, mockStoryGenerator } from "../src/author/index.js";

const graph = loadUfli();
const lex = Lexicon.core();

describe("mock story generator", () => {
  it("drives the Author to a verified story at several lessons without slipping", async () => {
    const author = new Author(mockStoryGenerator({ slipRate: 0, seed: 7 }), lex);
    for (const lesson of [6, 14, 26, 39]) {
      const result = await author.write(buildConstraints(graph, { lesson }, { name: "Sam" }));
      expect(result.ok, `lesson ${lesson}`).toBe(true);
      expect(result.rounds, `lesson ${lesson}`).toBe(1);
    }
  });

  it("slips on the first draft and recovers on feedback", async () => {
    const author = new Author(mockStoryGenerator({ slipRate: 1, seed: 3 }), lex);
    const result = await author.write(buildConstraints(graph, { lesson: 10 }, { name: "Sam" }));
    expect(result.ok).toBe(true);
    expect(result.rounds).toBe(2);
    expect(result.firstPassRatio).toBeLessThan(1);
    expect(result.attempts[0]!.report!.failures.length).toBeGreaterThan(0);
  });

  it("is deterministic for a given seed", async () => {
    const c = buildConstraints(graph, { lesson: 20 }, { name: "Maya" });
    const a = await new Author(mockStoryGenerator({ seed: 11 }), lex).write(c);
    const b = await new Author(mockStoryGenerator({ seed: 11 }), lex).write(c);
    expect(a.story).toEqual(b.story);
  });
});

describe("credential pre-flight", () => {
  it("reports whatever the environment has without throwing", () => {
    expect(typeof hasAnthropicCredentials()).toBe("boolean");
  });
});
