# Primer

An adaptive reading tutor for ages 4–7. See [docs/product-technical-plan.md](docs/product-technical-plan.md) for the plan and [research/01-landscape-brief.md](research/01-landscape-brief.md) for the research behind it.

## Phase 0 status

Built:

- **Skill-graph schema** (`src/skill-graph/schema.ts`) — zod schema for GPC, heart-word, phonemic-awareness, concept and fluency nodes with prerequisites and mastery criteria.
- **Graph loader and queries** (`src/skill-graph/graph.ts`) — validation (unique ids, prerequisites exist, acyclic, lesson ordering, no duplicate GPCs), topological order, taught-set through a lesson or from a mastery record, planner frontier.
- **UFLI Foundations encoding** (`data/curriculum/ufli-foundations.json`) — **draft**, lessons 1–46. GPC order is believed accurate; heart-word placements are approximate. Must be reviewed against the UFLI manual before use with children.
- **Decodability verifier** (`src/decodability/verifier.ts`) — aligns a word's letters to its dictionary pronunciation over the taught graphemes, so "was" is correctly *not* decodable even when w, a, s are taught. Handles VCe splits, multi-phoneme graphemes, positional and context constraints, heart words, allow-listed names, and unknown words.
- **Lexicon** (`src/decodability/lexicon.ts`) — bundled ~230-word K–1 core; optional full CMUdict via `npm run lexicon:cmudict`.

Not yet: mastery engine (BKT), session planner, Author pipeline and evals, any app.

## Use

```bash
npm install
npm test
npm run graph:check
npm run verify -- --lesson 31 "The duck sat on a log."
npm run verify -- --lesson 39 --allow Sam,Rex "Sam and Rex make a cake."
```

`verify` exits 0 on pass, 1 on fail, so it can gate a content pipeline.

## Conventions

- Phonemes are ARPAbet without stress digits, matching CMUdict.
- Node ids are `kind:name` (`gpc:sh`, `hw:the`, `pa:blend_3`).
- The skill graph is data, reviewed by the literacy lead; code never edits it at runtime.
