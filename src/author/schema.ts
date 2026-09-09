/**
 * The Author's output contract. Kept deliberately flat so it round-trips
 * through structured outputs without surprises; length and content limits are
 * enforced by textChecks.ts, not by the schema.
 */
import { z } from "zod";

export const Story = z.object({
  title: z.string().describe("A short title using only allowed words"),
  sentences: z
    .array(z.string())
    .describe("The story, one sentence per element, each ending with . ! or ?"),
  focusWords: z
    .array(z.string())
    .describe("Words in the story that practise the focus grapheme"),
});

export type Story = z.infer<typeof Story>;

export function storyText(story: Story): string {
  return story.sentences.join(" ");
}
