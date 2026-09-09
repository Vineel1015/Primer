/**
 * Everything the Author is allowed to know about the child and the curriculum
 * point, assembled deterministically from the skill graph and the mastery record.
 */
import type { GpcNode } from "../skill-graph/schema.js";
import type { SkillGraph } from "../skill-graph/schema.js";
import { taughtSetFromMastered, taughtSetThroughLesson, type TaughtSet } from "../skill-graph/graph.js";
import { Lexicon } from "../decodability/lexicon.js";
import { decodableWordBank } from "./wordbank.js";

export interface ChildProfile {
  /** First name; goes on the allow-list automatically. */
  name?: string;
  /** Things the child loves, in the parent's words: "dinosaurs", "her dog Rex". */
  interests?: string[];
  /** Extra proper nouns allowed regardless of decodability (pets, siblings). */
  allowList?: string[];
}

export type CurriculumPoint = { lesson: number } | { mastered: string[] };

export interface AuthorConstraints {
  pointLabel: string;
  taught: TaughtSet;
  /** The most recently introduced GPC — the story should practise it. */
  focus: GpcNode | undefined;
  heartWords: string[];
  allowList: string[];
  wordBank: string[];
  targetSentences: [min: number, max: number];
  maxWordsPerSentence: number;
  profile: ChildProfile;
}

export interface ConstraintOptions {
  targetSentences?: [number, number];
  maxWordsPerSentence?: number;
  /** Curated lexicon to draw the word bank from. Defaults to the bundled core. */
  curated?: Lexicon;
}

export function buildConstraints(
  graph: SkillGraph,
  point: CurriculumPoint,
  profile: ChildProfile = {},
  options: ConstraintOptions = {},
): AuthorConstraints {
  const taught = "lesson" in point
    ? taughtSetThroughLesson(graph, point.lesson)
    : taughtSetFromMastered(graph, point.mastered);
  const pointLabel = "lesson" in point ? `through lesson ${point.lesson}` : `${point.mastered.length} mastered skills`;

  const focus = [...taught.gpcs].sort((a, b) => b.lesson - a.lesson)[0];
  const allowList = [...new Set([profile.name, ...(profile.allowList ?? [])].filter((w): w is string => !!w))];

  return {
    pointLabel,
    taught,
    focus,
    heartWords: [...taught.heartWords].sort(),
    allowList,
    wordBank: decodableWordBank(taught, options.curated ?? Lexicon.core()),
    targetSentences: options.targetSentences ?? [5, 9],
    maxWordsPerSentence: options.maxWordsPerSentence ?? 7,
    profile,
  };
}
