/**
 * Skill-graph schema.
 *
 * The graph is the curriculum spine: a DAG of skills with prerequisites and
 * mastery criteria. The tutor cannot modify it; humans author it, code
 * validates it, the planner walks it.
 *
 * Phoneme notation is ARPAbet without stress digits (K, AE, T ...), matching
 * CMUdict so the decodability verifier can align graphemes to pronunciations.
 */
import { z } from "zod";

export const ARPABET = new Set([
  "AA", "AE", "AH", "AO", "AW", "AY", "B", "CH", "D", "DH", "EH", "ER", "EY", "F", "G", "HH",
  "IH", "IY", "JH", "K", "L", "M", "N", "NG", "OW", "OY", "P", "R", "S", "SH", "T", "TH",
  "UH", "UW", "V", "W", "Y", "Z", "ZH",
]);

export const Phoneme = z.string().refine((p) => ARPABET.has(p), {
  message: "phoneme must be an ARPAbet symbol without stress digits",
});

/** One pronunciation alternative for a grapheme, e.g. ["K","S"] for <x>. */
export const PhonemeSeq = z.array(Phoneme).min(1);

export const NodeId = z
  .string()
  .regex(/^[a-z]+:[a-z0-9_.-]+$/, "node ids look like kind:name, e.g. gpc:sh or hw:the");

const NodeBase = z.object({
  id: NodeId,
  label: z.string().min(1),
  /** UFLI lesson number in which the skill is introduced. */
  lesson: z.number().int().positive(),
  prerequisites: z.array(NodeId).default([]),
  notes: z.string().optional(),
});

/** Grapheme–phoneme correspondence. */
export const GpcNode = NodeBase.extend({
  kind: z.literal("gpc"),
  /**
   * Letters as written. A single "_" marks the split in a VCe pattern
   * ("a_e"): exactly one taught consonant grapheme sits in the gap.
   */
  grapheme: z.string().regex(/^[a-z]+(_[a-z]+)?$/),
  /** Alternatives; a word is decodable if any alternative aligns. */
  phonemes: z.array(PhonemeSeq).min(1),
  isConsonant: z.boolean(),
  /** "initial" restricts the grapheme to word start (e.g. consonant <y>). */
  position: z.enum(["any", "initial"]).default("any"),
  /** Optional orthographic context: letters that must follow (soft <c> before e, i, y). */
  context: z.object({ before: z.array(z.string().length(1)).min(1) }).optional(),
  examples: z.array(z.string()).default([]),
});

/** Irregular high-frequency word taught as a whole ("heart word"). */
export const HeartWordNode = NodeBase.extend({
  kind: z.literal("heart_word"),
  word: z.string().regex(/^[a-z']+$/),
  /** The part that must be learned by heart, for the activity script. */
  irregularPart: z.string().optional(),
});

/** Phonemic-awareness skill (oral, no letters). */
export const PaNode = NodeBase.extend({
  kind: z.literal("pa"),
  skill: z.enum([
    "isolate_initial", "isolate_final", "isolate_medial",
    "blend", "segment", "substitute_initial", "substitute_final", "substitute_medial",
    "delete_initial", "delete_final",
  ]),
  /** Number of phonemes the skill operates over (2, 3, 4...). */
  arity: z.number().int().min(2).max(6).optional(),
});

/** Non-GPC teaching point: a rule, a review checkpoint, a syllable type. */
export const ConceptNode = NodeBase.extend({
  kind: z.literal("concept"),
  concept: z.enum(["review", "vce_pattern", "doubling_rule", "syllable_type", "suffix", "other"]),
});

/** Fluency checkpoint on a text type. */
export const FluencyNode = NodeBase.extend({
  kind: z.literal("fluency"),
  textType: z.string(),
  targetAccuracy: z.number().min(0).max(1).default(0.95),
});

export const SkillNode = z.discriminatedUnion("kind", [
  GpcNode, HeartWordNode, PaNode, ConceptNode, FluencyNode,
]);

export const MasteryCriterion = z.object({
  /** Bayesian Knowledge Tracing P(known) required. */
  pKnown: z.number().min(0).max(1).default(0.95),
  /** Consecutive sessions the criterion must hold. */
  sessions: z.number().int().min(1).default(2),
  /** Median response time ceiling for automaticity, in ms. */
  maxResponseMs: z.number().int().positive().default(2000),
});

export const SkillGraph = z.object({
  version: z.string(),
  source: z.string(),
  status: z.enum(["draft", "reviewed"]),
  notes: z.string().optional(),
  mastery: MasteryCriterion.default({ pKnown: 0.95, sessions: 2, maxResponseMs: 2000 }),
  nodes: z.array(SkillNode).min(1),
});

export type Phoneme = z.infer<typeof Phoneme>;
export type GpcNode = z.infer<typeof GpcNode>;
export type HeartWordNode = z.infer<typeof HeartWordNode>;
export type PaNode = z.infer<typeof PaNode>;
export type ConceptNode = z.infer<typeof ConceptNode>;
export type FluencyNode = z.infer<typeof FluencyNode>;
export type SkillNode = z.infer<typeof SkillNode>;
export type SkillGraph = z.infer<typeof SkillGraph>;
export type MasteryCriterion = z.infer<typeof MasteryCriterion>;
