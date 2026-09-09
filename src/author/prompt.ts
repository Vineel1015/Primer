/**
 * Prompts for the Author.
 *
 * The system prompt is frozen text so it caches across every child and every
 * night; everything that varies goes in the user turn.
 */
import type { VerifyReport } from "../decodability/verifier.js";
import type { AuthorConstraints } from "./constraints.js";

export const AUTHOR_SYSTEM_PROMPT = `You write very short stories for children who are just learning to read, following structured-literacy practice. The child will read your story aloud, sounding out each word, so every word must be one they can decode with the letter-sounds they have been taught so far.

Rules that cannot be broken:
1. Use ONLY words from these three sources: (a) words made entirely of the taught grapheme–phoneme correspondences listed in the request, (b) the listed heart words, (c) the listed names. If a word is not decodable with the taught list and is not a listed heart word or name, do not use it — not even common words like "and", "you", "look" or "said" unless they appear in the lists.
2. Prefer words from the word bank. You may use other words only if you are certain every sound in them is spelled with a taught correspondence.
3. No contractions, numbers, abbreviations, hyphens or made-up words.
4. Keep sentences short: never more than the stated maximum words per sentence.
5. The story must be a small, complete event with a beginning and an end — something happens, something changes. Warm and a little funny is ideal. Repetition of words and sentence shapes is good for beginners.
6. Practise the focus grapheme: use it in at least three different words.
7. Weave in the child's interests and name where the word lists allow it. Never invent a name that is not listed.
8. Content must be gentle and safe for a four-year-old: no fear, harm, weapons, insults, or anything a parent would not want read aloud at bedtime.

If a verifier rejects words, rewrite using only allowed words; do not argue and do not re-use a rejected word.`;

export function renderConstraints(c: AuthorConstraints): string {
  const gpcLines = [...c.taught.gpcs]
    .sort((a, b) => a.lesson - b.lesson)
    .map((g) => {
      const sounds = g.phonemes.map((p) => `/${p.join(" ")}/`).join(" or ");
      const eg = g.examples.length ? ` (as in ${g.examples.slice(0, 2).join(", ")})` : "";
      return `  ${g.grapheme.replace("_", "_")} → ${sounds}${eg}`;
    })
    .join("\n");

  const interests = c.profile.interests?.length ? c.profile.interests.join("; ") : "none given";
  const focus = c.focus ? `${c.focus.grapheme} → ${c.focus.phonemes.map((p) => `/${p.join(" ")}/`).join(" or ")}` : "none";

  return [
    `Curriculum point: ${c.pointLabel}.`,
    `Child: ${c.profile.name ?? "(no name given)"}. Interests: ${interests}.`,
    ``,
    `Taught grapheme–phoneme correspondences (ARPAbet sounds):`,
    gpcLines || "  (none)",
    ``,
    `Focus grapheme to practise (use in at least 3 different words): ${focus}`,
    `Heart words allowed: ${c.heartWords.length ? c.heartWords.join(", ") : "(none)"}`,
    `Names allowed: ${c.allowList.length ? c.allowList.join(", ") : "(none)"}`,
    `Word bank (all decodable now): ${c.wordBank.length ? c.wordBank.join(", ") : "(none yet)"}`,
    ``,
    `Length: ${c.targetSentences[0]}–${c.targetSentences[1]} sentences, at most ${c.maxWordsPerSentence} words per sentence.`,
    `Write the story now.`,
  ].join("\n");
}

export function renderFeedback(report: VerifyReport | null, textProblems: string[], safetyProblems: string[]): string {
  const lines: string[] = [];
  if (report && !report.pass) {
    const seen = new Set<string>();
    const rejected = report.failures.filter((f) => (seen.has(f.word) ? false : (seen.add(f.word), true)));
    lines.push(`The verifier rejected ${rejected.length} word(s) (${report.passed}/${report.counted} passed; ${(report.threshold * 100).toFixed(0)}% required):`);
    for (const f of rejected) lines.push(`  - "${f.token}": ${f.reason ?? f.status}`);
    lines.push(`Rewrite the story so none of these words appear. Replace them with words from the word bank or the allowed lists. Keep the title, characters and shape of the story where you can.`);
  }
  if (textProblems.length) {
    lines.push(`Text problems:`);
    for (const p of textProblems) lines.push(`  - ${p}`);
  }
  if (safetyProblems.length) {
    lines.push(`Content problems:`);
    for (const p of safetyProblems) lines.push(`  - ${p}`);
  }
  if (!lines.length) lines.push("The story could not be parsed. Reply with a valid story in the required format.");
  return lines.join("\n");
}
