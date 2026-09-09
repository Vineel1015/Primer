import { describe, expect, it } from "vitest";
import { Lexicon } from "../src/decodability/lexicon.js";
import { checkWord, tokenize, verify } from "../src/decodability/verifier.js";
import { loadSkillGraph, loadUfli, taughtSetFromMastered, taughtSetFromNodes, taughtSetThroughLesson } from "../src/skill-graph/index.js";

const graph = loadUfli();
const lex = Lexicon.core();
const at = (lesson: number) => taughtSetThroughLesson(graph, lesson);
const status = (word: string, lesson: number, allow: string[] = []) =>
  checkWord(word, at(lesson), lex, new Set(allow.map((w) => w.toLowerCase()))).status;

describe("tokenize", () => {
  it("strips punctuation and splits on whitespace and dashes", () => {
    expect(tokenize('"Sam sat," said Dad — on the mat!')).toEqual(["Sam", "sat", "said", "Dad", "on", "the", "mat"]);
  });
  it("keeps internal apostrophes", () => {
    expect(tokenize("can't stop")).toEqual(["can't", "stop"]);
  });
});

describe("single-word decodability against the UFLI draft", () => {
  it("decodes CVC words once their GPCs are taught", () => {
    expect(status("mat", 4)).toBe("decodable");
    expect(status("sat", 4)).toBe("decodable");
    expect(status("pat", 4)).toBe("not_decodable"); // p is lesson 5
    expect(status("pat", 5)).toBe("decodable");
  });

  it("rejects words whose letters are taught but whose sounds are not", () => {
    // w-a-s segments orthographically, but /W AA Z/ is not short-a + /s/
    const wasTaught = taughtSetFromMastered(graph, ["gpc:w", "gpc:a", "gpc:s"]);
    const r = checkWord("was", wasTaught, lex);
    expect(r.status).toBe("not_decodable");
    expect(r.reason).toMatch(/no taught grapheme for "as" in \/W AA Z\//);
    // once taught as a heart word it passes
    expect(status("was", 14)).toBe("heart_word");
  });

  it("handles short o in both CMUdict vowels", () => {
    expect(status("on", 9)).toBe("decodable");   // AA
    expect(status("dog", 13)).toBe("decodable");  // AO
  });

  it("handles <x> = /ks/ and <qu> = /kw/", () => {
    expect(status("fox", 23)).toBe("decodable");
    expect(status("quit", 24)).toBe("decodable");
    expect(status("quit", 23)).toBe("not_decodable");
  });

  it("restricts consonant <y> to word-initial position", () => {
    expect(status("yes", 22)).toBe("decodable");
    expect(status("my", 26)).toBe("not_decodable"); // y as vowel not yet taught
    expect(status("my", 27)).toBe("heart_word");
  });

  it("unlocks plural -s /z/, FLSZ, -all and -ck at the right lessons", () => {
    expect(status("dogs", 27)).toBe("not_decodable");
    expect(status("dogs", 28)).toBe("decodable");
    expect(status("cats", 26)).toBe("decodable"); // /s/ plural needs only <s>
    expect(status("hill", 29)).toBe("decodable");
    expect(status("ball", 30)).toBe("decodable");
    expect(status("duck", 30)).toBe("not_decodable");
    expect(status("duck", 31)).toBe("decodable");
    expect(status("ducks", 31)).toBe("decodable");
  });

  it("prefers digraphs over their component letters", () => {
    expect(status("ship", 31)).toBe("not_decodable");
    expect(status("ship", 32)).toBe("decodable");
    expect(status("this", 34)).toBe("decodable");
    expect(status("thin", 34)).toBe("decodable");
    expect(status("when", 35)).toBe("decodable");
    expect(status("sink", 37)).toBe("decodable");
  });

  it("aligns VCe patterns across the medial consonant", () => {
    expect(status("cake", 38)).toBe("not_decodable");
    const cake = checkWord("cake", at(39), lex);
    expect(cake.status).toBe("decodable");
    expect(cake.segmentation?.map((s) => s.grapheme)).toEqual(["c", "a_e", "k"]);
    expect(status("bike", 39)).toBe("not_decodable");
    expect(status("bike", 40)).toBe("decodable");
    expect(status("cute", 42)).toBe("decodable");
    expect(status("tune", 42)).toBe("decodable");
    expect(status("these", 43)).toBe("decodable");
  });

  it("handles -ed with all three sounds and doubled consonants", () => {
    expect(status("jumped", 44)).toBe("not_decodable");
    expect(status("jumped", 45)).toBe("decodable");
    expect(status("hopped", 45)).toBe("decodable");
    expect(status("landed", 45)).toBe("decodable");
    // "wanted" has /AA/ after <w>, which short-a does not cover — correctly not decodable
    expect(status("wanted", 45)).toBe("not_decodable");
    // -ing is a morphology lesson (46); the sounds <i>+<ng> are decodable well before it
    expect(status("jumping", 36)).toBe("decodable");
    expect(status("jumping", 35)).toBe("not_decodable");
  });

  it("passes allow-listed proper nouns and taught heart words", () => {
    expect(status("Rex", 4, ["Rex"])).toBe("allow_listed");
    expect(status("the", 3)).toBe("heart_word");
    expect(status("the", 2)).toBe("not_decodable");
  });

  it("marks words missing from the lexicon and reports orthographic segmentability", () => {
    const r = checkWord("zorblat", at(26), lex);
    expect(r.status).toBe("unknown_pronunciation");
    expect(r.orthographicallyDecodable).toBe(true);
    const r2 = checkWord("qat", at(26), lex); // <q> alone is never taught
    expect(r2.orthographicallyDecodable).toBe(false);
  });

  it("gives a useful reason on failure", () => {
    const r = checkWord("ship", at(31), lex);
    expect(r.reason).toMatch(/no taught grapheme for "ship"/);
  });
});

describe("verify() over a text", () => {
  it("passes a decodable sentence at lesson 10 with a name on the allow list", () => {
    const report = verify("Sam sat on a mat.", at(10), lex, { allowList: ["Sam"] });
    expect(report.pass).toBe(true);
    expect(report.ratio).toBe(1);
    expect(report.words.map((w) => w.status)).toEqual([
      "allow_listed", "decodable", "decodable", "heart_word", "decodable",
    ]);
  });

  it("fails when an untaught pattern appears and names it", () => {
    const report = verify("The dog is fat.", at(10), lex);
    expect(report.pass).toBe(false);
    expect(report.failures.map((w) => w.word)).toEqual(["dog"]);
  });

  it("applies the threshold to the counted words only", () => {
    const text = "Sam sat. Sam sat. Sam sat. Sam sat. Sam sat. 7";
    const nine = verify(text, at(4), lex, { allowList: ["Sam"], threshold: 0.95 });
    expect(nine.counted).toBe(10);
    expect(nine.pass).toBe(true);
    const withMiss = verify(text.replace("7", "ship"), at(4), lex, { allowList: ["Sam"], threshold: 0.95 });
    expect(withMiss.ratio).toBeCloseTo(10 / 11);
    expect(withMiss.pass).toBe(false);
    expect(verify(text.replace("7", "ship"), at(4), lex, { allowList: ["Sam"], threshold: 0.9 }).pass).toBe(true);
  });

  it("treats unknown words as failures by default and passes them in orthographic mode", () => {
    const strict = verify("The zog sat.", at(26), lex);
    expect(strict.pass).toBe(false);
    const loose = verify("The zog sat.", at(26), lex, { unknownWords: "orthographic" });
    expect(loose.pass).toBe(true);
  });
});

describe("context-sensitive graphemes", () => {
  it("applies a soft-c rule only before e, i, y", () => {
    const g = loadSkillGraph({
      version: "t", source: "t", status: "draft",
      nodes: [
        { id: "gpc:c-k", kind: "gpc", grapheme: "c", phonemes: [["K"]], isConsonant: true, label: "c", lesson: 1 },
        { id: "gpc:c-s", kind: "gpc", grapheme: "c", phonemes: [["S"]], isConsonant: true, context: { before: ["e", "i", "y"] }, label: "soft c", lesson: 2 },
        { id: "gpc:e", kind: "gpc", grapheme: "e", phonemes: [["EH"]], isConsonant: false, label: "e", lesson: 1 },
        { id: "gpc:n", kind: "gpc", grapheme: "n", phonemes: [["N"]], isConsonant: true, label: "n", lesson: 1 },
        { id: "gpc:t", kind: "gpc", grapheme: "t", phonemes: [["T"]], isConsonant: true, label: "t", lesson: 1 },
        { id: "gpc:a", kind: "gpc", grapheme: "a", phonemes: [["AE"]], isConsonant: false, label: "a", lesson: 1 },
      ],
    });
    const local = new Lexicon().add("cent", ["S", "EH", "N", "T"]).add("cat", ["K", "AE", "T"]);
    const taught = taughtSetFromNodes(g.nodes);
    expect(checkWord("cent", taught, local).status).toBe("decodable");
    expect(checkWord("cat", taught, local).segmentation?.[0]?.nodeId).toBe("gpc:c-k");
  });
});

describe("CMUdict parsing", () => {
  it("parses both layouts, strips stress, merges variants, skips comments", () => {
    const text = [
      ";;; comment",
      "CAT  K AE1 T",
      "the dh ah0",
      "the(2) dh iy0 # comment",
      "!EXCLAMATION-POINT  EH2 K S",
    ].join("\n");
    const l = Lexicon.fromCmuDict(text);
    expect(l.get("cat")).toEqual([["K", "AE", "T"]]);
    expect(l.get("the")).toEqual([["DH", "AH"], ["DH", "IY"]]);
    expect(l.has("!exclamation-point")).toBe(false);
  });
});
