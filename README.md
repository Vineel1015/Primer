# Primer

An adaptive reading tutor for ages 4–7. See [docs/product-technical-plan.md](docs/product-technical-plan.md) for the plan and [research/01-landscape-brief.md](research/01-landscape-brief.md) for the research behind it.

## Phase 0 status

Built:

- **Skill-graph schema** (`src/skill-graph/schema.ts`) — zod schema for GPC, heart-word, phonemic-awareness, concept and fluency nodes with prerequisites and mastery criteria.
- **Graph loader and queries** (`src/skill-graph/graph.ts`) — validation (unique ids, prerequisites exist, acyclic, lesson ordering, no duplicate GPCs), topological order, taught-set through a lesson or from a mastery record, planner frontier.
- **UFLI Foundations encoding** (`data/curriculum/ufli-foundations.json`) — **draft**, lessons 1–46. GPC order is believed accurate; heart-word placements are approximate. Must be reviewed against the UFLI manual before use with children.
- **Decodability verifier** (`src/decodability/verifier.ts`) — aligns a word's letters to its dictionary pronunciation over the taught graphemes, so "was" is correctly *not* decodable even when w, a, s are taught. Handles VCe splits, multi-phoneme graphemes, positional and context constraints, heart words, allow-listed names, and unknown words.
- **Lexicon** (`src/decodability/lexicon.ts`) — bundled ~230-word K–1 core; optional full CMUdict via `npm run lexicon:cmudict`.

- **Author pipeline** (`src/author/`) — generate → verify → feed back → regenerate, up to 3 rounds; falls back to the human story bank. Constraints (taught GPCs, heart words, names, a decodable word bank, focus grapheme, child's interests) are built deterministically from the skill graph. Claude Opus 5 authors via structured outputs; an optional Haiku 4.5 gate reviews content. The LLM is behind a `StoryGenerator` interface so the loop is unit-tested with a scripted fake.
- **Story bank** (`data/stories/bank.json`) — three human-written seed stories, each verified at its lesson by the tests. Target for Phase 0 is coverage of lessons 1–40.
- **Author eval** (`src/eval/author-eval.ts`) — runs the cases in `data/eval/author-cases.json` against the API and reports first-pass decodability, pass rate, rounds and cost. Gate from the plan: mean first-pass decodability ≥ 90% before generated stories reach a child.

Not yet: mastery engine (BKT), session planner, any app.

## Use

```bash
npm install
npm test
npm run graph:check
npm run verify -- --lesson 31 "The duck sat on a log."
npm run verify -- --lesson 39 --allow Sam,Rex "Sam and Rex make a cake."
```

`verify` exits 0 on pass, 1 on fail, so it can gate a content pipeline.

With `ANTHROPIC_API_KEY` set (or an `ant auth login` profile):

```bash
npm run author -- --lesson 20 --name Maya --interests "her dog Rex,mud" --allow Rex
npm run eval:author -- --limit 3
```

## Conventions

- Phonemes are ARPAbet without stress digits, matching CMUdict.
- Node ids are `kind:name` (`gpc:sh`, `hw:the`, `pa:blend_3`).
- The skill graph is data, reviewed by the literacy lead; code never edits it at runtime.
