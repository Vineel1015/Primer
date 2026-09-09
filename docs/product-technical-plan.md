# Primer — Product & Technical Plan

*v0.1 · 9 September 2026 · Builds on [research/01-landscape-brief.md](../research/01-landscape-brief.md)*

---

## 1. Decisions this plan takes

The brief ended with six open decisions. This plan resolves them. Each is a bet, not a fact; change one and the downstream sections change with it.

| Decision | Call | Why |
|---|---|---|
| **Wedge** | **Learning to read, ages 4–7 (Pre-K → 1st).** Two loops: a deterministic *structured-decoding loop* on an open scope-and-sequence, plus an LLM-native *story-and-talk loop* (personalized decodable text + comprehension dialogue). | Reading is where the pain (40% of 4th graders below Basic) and the purchase intent are. The decoding loop is table stakes; the story-and-talk loop is the square nobody occupies and the only part that needs an LLM. |
| **Curriculum base** | **Adopt UFLI Foundations** (128 lessons, free, structured literacy) as the spine; encode it as a skill graph. Do not author our own sequence in v1. | Spend novelty on the tutor, not the syllabus. Mentava is the cautionary tale for home-grown phonics. |
| **Modality & device** | **Voice-first for the child, touch for manipulation; iPad/iPhone native first.** Android in Phase 3. Weekly printable decodable booklet (PDF). | Four-year-olds don't type. Native gives on-device ML, audio-pipeline control, and Apple Pencil. Print gets the child off the screen — parents' #1 worry — and is cheap. |
| **Speech strategy** | **Own it, narrowly.** On-device child ASR specialized for *verification against expected text* (did they say "cat"? which phoneme was wrong?), not open transcription. Cloud STT only for the free-speech comprehension dialogue. Audio processed and deleted; never stored by default. | Verification is a much easier problem than transcription and tolerates 15% WER. No license target left (SoapBox → Curriculum Associates; Ello proprietary). Process-and-delete fits COPPA's audio exception. |
| **Price** | **$29/month, $249/year; founding cohort $19/month.** Consumer, parent-paid. No school sales in v1. | Inference cost lands at ~$4–7/month per daily-active child (see §6). $29 gives margin and signals "tutor," not "app." Mentava proves $500 exists; ABCmouse proves $13 is a crowded floor. |
| **Evidence plan** | **Pre/post with external DIBELS at beta; pre-registered waitlist RCT (n≈400) in Phase 3 with a university partner.** | No causal study of LLM tutoring exists for this age. Being the first is a moat and a sales asset. |
| **LLM** | **Claude.** Real-time dialogue on `claude-sonnet-5`; authoring, verification and parent reports on `claude-opus-5`; classification on `claude-haiku-4-5`. | Amira already runs on Claude for K–3, so the path through Anthropic's minors policy is proven. Model split is a cost/latency call and is revisable. |

**Explicitly not in v1:** open-ended chat, math, writing beyond letter formation and dictated sentences, Android, school/district sales, dedicated hardware, languages other than English, ages 8+.

---

## 2. Product

### 2.1 Who it's for
A parent of a 4–7-year-old who wants their child reading — ahead, on time, or catching up — and who would pay for a tutor if one were affordable and available at 6:45 pm. The child is the user; the parent is the customer and the co-tutor.

### 2.2 The promise
> **Twenty minutes a day with a tutor that listens, remembers, and reads with your child.**

Three things make it different from the apps already on the iPad:
1. **It listens** — hears the child read and blend, and corrects the specific sound they got wrong.
2. **It remembers** — a learner model that carries across days and months: what's mastered, what's shaky, what they love, what worked last time.
3. **It talks about the story** — every day ends with a real conversation about what they just read.

### 2.3 The daily session (target 15–20 minutes)

| Segment | Minutes | Engine | What happens |
|---|---|---|---|
| **Warm-up** | 2 | Deterministic | Rapid review of yesterday's sounds and heart words, spaced-repetition picks. |
| **New skill** | 3 | Deterministic + recorded voice | Today's grapheme–phoneme correspondence or PA skill from the UFLI spine, taught the UFLI way (explicit, multisensory: hear it, say it, trace it). |
| **Word work** | 5 | Deterministic + ASR | Blending, segmenting, word building with movable letters. ASR verifies each attempt; a wrong phoneme triggers a targeted correction move. |
| **Story** | 6 | LLM-authored, verified, ASR-read | A decodable story generated for *this* child (their dog, their dinosaur phase) using only taught patterns. Child reads aloud; tutor supports on stuck words with a scripted hierarchy (wait → sound cue → blend together → model). |
| **Talk** | 3 | LLM dialogue | Comprehension and oral language: retell, predict, "why did…?", one new vocabulary word in context. Turn-taking, one question at a time. |
| **Wrap** | 1 | Deterministic | Progress moment for the child; daily note to the parent. |

If the child is tired or frustrated, the session shortens from the end (Talk → Story), never from the beginning. Mastery isn't gated by session; the planner picks up where the child is.

### 2.4 The tutor
- Has a name and a consistent voice (working name TBD). It is a **guide, not a friend**: no idle chat mode, no "how was your day," no relationship talk. Every exchange is bound to a task. This is both pedagogy and regulatory positioning (companion-bot laws).
- Discloses that it is a computer program in child language at first use and in parent-facing copy (SB 243 pattern, applied by default).
- Patience is the product. Never sighs, never rushes, never gives up on a word. Warmth without flattery: specific praise for effort and strategy ("you went back and blended it"), not "amazing!"

### 2.5 The parent side
- **Daily note** (3 lines, pushed at session end): what was taught, one thing that went well, one thing to try at dinner.
- **Weekly progress**: skill-graph view (sounds mastered / in progress / next), oral reading fluency trend, minutes and sessions, plus the printable booklet of this week's stories.
- **Learner profile**: the narrative model the tutor keeps about the child — interests, what motivates, what frustrates — *visible and editable by the parent*. Transparency about what the AI knows and is teaching is in the RFS verbatim.
- **Controls**: session length cap, voice on/off, data export, delete everything.

### 2.6 What "adaptive" means here (concretely)
1. **Which skill next** — planner walks the skill graph by prerequisite mastery, not calendar.
2. **How much practice** — mastery estimate per node from correctness *and response time*; spaced review scheduled from decay.
3. **What text** — stories constrained to the child's taught set and their interests, at a difficulty the mastery model predicts is ~90–95% accurate (the fluency-building zone).
4. **How to help** — correction move chosen from the error type (wrong phoneme, skipped sound, guessed from the picture) and from what has worked for this child before.
5. **What to talk about** — dialogue questions scaled to the child's oral-language level as observed in prior talks.

---

## 3. Pedagogy spine

### 3.1 Skill graph
UFLI's 128 lessons decompose into ~300 nodes: phonemic-awareness skills (blending, segmenting, substitution, deletion), grapheme–phoneme correspondences in UFLI order, heart words, syllable types, and fluency targets. Each node carries prerequisites, a mastery criterion, activity templates, and a decodability contribution (the words it unlocks). Versioned JSON, reviewed by the literacy lead; the tutor cannot modify it.

### 3.2 Mastery model
Bayesian Knowledge Tracing per node (learn/slip/guess parameters seeded from literature, refined from data), with response-time as an additional signal for automaticity. A node is "mastered" at P(known) ≥ 0.95 across two sessions with sub-2s responses; "fluent" adds a fluency probe. Spaced review via decaying activation. Nothing exotic; the value is in the data being about *this* child.

### 3.3 Decodability
A word is decodable for a child iff every grapheme maps to a taught correspondence *or* the word is a taught heart word *or* it's on the child's proper-noun allow-list (their name, pet, sibling). The Author must produce text where ≥ 95% of tokens pass; the Verifier enforces it deterministically. This is what makes LLM-generated stories safe to hand to a beginning reader.

### 3.4 Correction hierarchy (scripted, not improvised)
Wait 3s → highlight the grapheme → give the sound → blend it together with them → say the word → move on and revisit. Which rung to start on is adaptive; the rungs are fixed.

### 3.5 Comprehension dialogue design
Grounded in the story text; one question per turn; questions escalate from literal (who/what) to inferential (why/what next) as the child succeeds; the tutor never asks a question it can't check against the text or the child's prior answer; vocabulary target is one word per story, used three times. Dialogue ends in ≤ 6 turns or on disengagement.

### 3.6 Writing in v1
Letter formation (trace-with-feedback, stroke order, on tablet), and dictation: the child says a sentence, the tutor writes it, the child reads it back. Real composition feedback is Phase 3.

---

## 4. Technical architecture

### 4.1 Principle: LLM proposes, curriculum disposes
The language model never decides *what* to teach or whether the child got it right. It writes stories, asks questions, phrases corrections, and explains to parents — always inside a structured envelope that deterministic code validates. Every LLM output is JSON with a fixed schema of allowed "moves"; anything off-schema is discarded and a scripted fallback plays.

### 4.2 Components

```
┌─────────────────────────── iPad / iPhone app (Swift) ───────────────────────────┐
│  Activity Player  ·  Audio pipeline  ·  On-device child ASR (verification)     │
│  Recorded-voice bank  ·  TTS playback cache  ·  Tracing canvas  ·  Offline queue│
└───────────────┬───────────────────────────────────────────────────┬─────────────┘
                │ events, ASR scores, free-speech audio (streamed)  │ session plan,
                ▼                                                   │ content, TTS
┌────────────────────────────── API (TypeScript) ─────────────────────────────────┐
│  Session Planner ── Mastery Engine (BKT) ── Skill Graph (versioned)             │
│  Tutor Brain ──┬── Dialogue  (claude-sonnet-5, real-time)                       │
│                ├── Author    (claude-opus-5, stories + activities, batch)        │
│                └── Reporter  (claude-opus-5, parent notes, learner narrative)   │
│  Verifier: decodability · level · safety · schema        Cloud STT/TTS adapters │
│  Learner Store (Postgres): mastery, events, narrative profile, parent prefs      │
│  Privacy layer: audio process-and-delete, retention jobs, export, erase         │
└─────────────────────────────────────────────────────────────────────────────────┘
                │
┌───────────────▼──────────── ML pipeline (Python) ───────────────────────────────┐
│  Child-ASR fine-tuning (MyST, CSLU, consented in-house)  ·  Eval harness         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Client (Swift / SwiftUI).** Owns the session loop so a flaky network never stalls a 5-year-old: the day's plan and content are fetched at session start; activities run locally; ASR scoring is on-device; only the Talk segment needs a live round-trip. Recorded human voice for the ~2,000 fixed utterances (letter sounds must be phonetically exact — a voice actor and a speech-language pathologist, not TTS). TTS only for generated text, cached by hash.

**Speech.** Two paths:
- *Verification (on-device):* a Whisper-small or wav2vec2-CTC model fine-tuned on children's speech, run with constrained decoding against the expected word/phoneme sequence and forced alignment. Output is a per-phoneme confidence, not a transcript. Fine-tune first on MyST + CSLU Kids (public), then on in-house audio from families who opt in under a *separate* consent. Target: ≤ 8% word-verification error on K–1 speakers by beta, measured against human raters.
- *Free speech (cloud):* the Talk segment streams audio to cloud STT; transcript goes to Dialogue; audio is discarded on response. No voiceprints, no speaker models.

**Tutor Brain (Claude).**
- *Dialogue* — `claude-sonnet-5`, adaptive thinking at `effort: "low"`, streaming, structured output (`output_config.format`) with a schema of allowed moves (`ask`, `affirm`, `rephrase`, `vocab`, `close`). System prompt = Anthropic's child-safety prompt + our tutor charter + the story text + the child's narrative profile, with `cache_control` on the stable prefix so each turn pays for ~300 fresh tokens. Latency budget: ≤ 700 ms to first token.
- *Author* — `claude-opus-5`, runs nightly per child via the Batches API (50% off) to pre-generate tomorrow's story and three alternates from the planner's constraint set (taught GPCs, heart words, allow-list, interests, target length, target accuracy). Generate → Verify → regenerate with the verifier's diff as feedback, up to 3 rounds; else fall back to the human-written story bank for that lesson. `fallbacks: "default"` enabled per Anthropic's guidance for Opus 5.
- *Reporter* — `claude-opus-5`, nightly: writes the parent note from the event log, and proposes an update to the narrative learner profile (what engaged them, what strategy worked, what to avoid), which is stored as a diff the parent can see and revert.

**Verifier layer (deterministic, no LLM).** Decodability check against the child's taught set; length and sentence-complexity bounds; profanity/blocklist; schema validation; a `claude-haiku-4-5` safety classifier as a second gate on anything child-facing. Every rejection is logged with a reason; rejection rates are a tracked quality metric.

**Learner Store (Postgres).** Per-child mastery table, event stream (every attempt, ASR score, response time), narrative profile (versioned), parent preferences, consent records. No raw audio at rest.

**Privacy layer.** Audio deleted on response (COPPA audio exception); written retention policy enforced by scheduled jobs; child data never used for model training without separate verifiable parental consent; export and full erase as one-click parent actions; on-device processing wherever it removes a data flow.

### 4.3 Session-time latency budget (Talk segment)
Child stops speaking → endpointing 200 ms → STT 300 ms → Dialogue first token 500 ms → TTS first audio 250 ms ≈ **1.25 s**, masked by a pre-recorded acknowledgement ("Mm-hm…") chosen by the client at 400 ms. Anything over 2.5 s plays a scripted fallback question.

### 4.4 Evaluation harness (built before the features)
- **Author evals:** decodability pass rate, level-control error, safety-classifier flags, story quality rubric graded by `claude-opus-5` + weekly human spot-check. Gate: ≥ 90% first-pass decodability before shipping generated stories to any child.
- **Dialogue evals:** replayed transcripts scored on a rubric — one question per turn, grounded in text, age-appropriate vocabulary, no teaching of phonics content (that's the spine's job), correct handling of "I don't know." Gate on regression before any prompt or model change.
- **ASR evals:** word-verification and phoneme-error agreement vs. human raters on a held-out K–1 set, stratified by age, accent, and background noise.
- **Pedagogy review:** the literacy lead signs off on every skill-graph and correction-hierarchy change.

---

## 5. Safety & trust posture

| Threat | Control |
|---|---|
| Model says something inappropriate to a child | Task-bound dialogue only; structured output schema; Anthropic child-safety prompt; Haiku classifier gate; scripted fallback on any rejection; all child-facing text logged for review. |
| Model teaches a phonics rule wrong | It can't: skill content is authored by humans and delivered by deterministic activities. The LLM only phrases and converses. |
| Companion-bot dynamics | No idle chat, no emotional-relationship language, AI disclosure to child and parent, session cap (25 min hard), no streaks that punish missing a day. |
| Voice data | Process-and-delete; no voiceprints; opt-in-only research audio under separate consent; on-device verification. State it plainly on the website, as Anthropic's minors policy requires. |
| COPPA | Verifiable parental consent via card + confirmation; written retention policy; no third-party ad SDKs, ever; data map maintained from day one. |
| Screen time | 20-minute sessions, printed booklets, parent-facing "read this tonight" — the product's job is to make the child read *off* the app. |
| Selection-effect hype | Publish the pre/post with its limitations; run the RCT; never quote "X% of kids improved" without a comparison. |

---

## 6. Unit economics (per daily-active child, 20 min/day, 30 days)

| Line | Assumption | $/month |
|---|---|---|
| Dialogue (`claude-sonnet-5`) | 15 LLM turns/day; ~4k cached + 300 fresh input, 120 output tokens per turn | ≈ 1.2 |
| Author (`claude-opus-5`, Batches) | 1 story + 3 alternates/night, 2 verify rounds avg, batch pricing | ≈ 1.5 |
| Reporter (`claude-opus-5`) | 1 note + profile diff/night | ≈ 1.0 |
| Safety classifier (`claude-haiku-4-5`) | every child-facing generation | ≈ 0.2 |
| Cloud STT (Talk only) | 3 min/day | ≈ 0.5 |
| Cloud TTS (generated text only, cached) | ~3k chars/day | ≈ 1.5 |
| On-device ASR, recorded voice | — | 0 |
| **Total inference & speech** | | **≈ $6** |

Realistic usage is 4–5 sessions/week, so blended cost is ~$4/month. At $29/month that's an 85%+ gross margin on inference; at $19 founding pricing, still ~80%. Sensitivity: the two levers that could double this are premium TTS voices (avoid: use mid-tier neural TTS + recorded voice bank) and moving Dialogue to Opus 5 (+$1.8/mo — affordable if quality demands it).

---

## 7. Roadmap

### Phase 0 — Spine & proof (weeks 0–6)
- Encode UFLI into the skill graph; build the decodability verifier and the human-written story bank for lessons 1–40.
- Record the voice bank (voice actor + SLP review).
- Author pipeline v0 with eval harness; hit ≥ 90% first-pass decodability on lessons 1–40.
- Wizard-of-Oz sessions with 10 families: a human plays the tutor with the planned script and moves. Learn what a 5-year-old actually does.
- **Exit:** session script validated with children; verifier and evals green; literacy lead hired or contracted.

### Phase 1 — Alpha (weeks 6–16)
- iPad app: Warm-up, New skill, Word work, Story (with on-device ASR v0 fine-tuned on public corpora), Wrap. Talk segment uses cloud STT + Dialogue behind a flag.
- Parent app surface: daily note, weekly progress, consent, delete.
- 50 families, free, weekly interviews. Instrument everything.
- **Exit:** ≥ 4 sessions/week median; session completion ≥ 80%; ASR word-verification error ≤ 12%; zero safety incidents in logged transcripts.

### Phase 2 — Beta & first evidence (weeks 16–30)
- Talk segment on by default; personalized stories for lessons 1–80; printable booklets; learner narrative profile visible to parents.
- ASR v1 fine-tuned on consented in-house audio; target ≤ 8% verification error.
- 300 families at $19 founding price. External DIBELS 8 pre/post at weeks 0 and 12 by remote assessors; publish results with limitations.
- **Exit:** monthly churn ≤ 5%; DIBELS composite gain vs. norms reported honestly; cost/child ≤ $7.

### Phase 3 — Scale & rigor (weeks 30–52)
- Full UFLI coverage (128 lessons); early math module (counting → addition/subtraction within 20, learning-trajectory sequence) reusing the planner, ASR-light; dictation/composition feedback.
- Android. Public launch at $29/month.
- Pre-registered waitlist RCT, n≈400, 12 weeks, university partner as independent evaluator.
- Common Sense Media review; SOC 2 start.
- **Exit:** RCT enrolled; 5,000 paying families; inference cost ≤ $5/child.

---

## 8. Team for the first year

| Role | Why it's non-negotiable |
|---|---|
| Founder / product | Owns the session design and the parent experience. |
| **Literacy lead** (structured-literacy practitioner, ideally with dyslexia background) | The Mentava failure mode is not having this person. Signs off on every pedagogical change. |
| iOS engineer (audio + on-device ML) | The client *is* the product for the child. |
| Backend / LLM engineer (TypeScript, Claude API, evals) | Tutor Brain, verifier, evals. |
| Speech ML engineer (Python) | Child-ASR fine-tuning is the technical moat. Can start fractional. |
| Designer (children's UX) | Four-year-old affordances are a specialty. |
| Fractional: SLP for voice bank, privacy counsel, research partner | Phase-specific. |

Six people plus fractional; ~18 months of runway at seed scale covers Phases 0–3 including the RCT.

---

## 9. Metrics that matter

**Learning:** words-correct-per-minute trend on level-matched probes; nodes mastered per week; DIBELS composite at pre/post; RCT effect size (target ≥ 0.3 SD, which is "as good as a tutor").
**Engagement:** sessions/week (target ≥ 4), session completion (≥ 80%), Story-segment read-aloud rate, Talk-segment turns.
**Business:** monthly churn (≤ 5%), trial→paid, cost per daily-active child, parent NPS.
**Quality & safety:** verifier rejection rate, safety flags per 1,000 generations (target 0 shipped), ASR verification error, latency p95 on Talk.

---

## 10. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Child ASR isn't good enough for 4-year-olds | High | Verification-not-transcription design; confirm-don't-assume UX; start at 5–6 and extend down as accuracy allows. |
| Generated stories are decodable but boring | Medium | Interest slots and the child's own characters; human story bank as floor; quality rubric in evals; kids vote. |
| Parents don't trust an AI with their 5-year-old | Medium | Recorded human voice, task-bound dialogue, visible learner profile, process-and-delete audio, Common Sense review, publish evidence. |
| Gains fade / affluent-family selection effects | High | Say so; measure against norms; RCT; build the comprehension and thinking layer that school doesn't deliver. |
| Regulatory shift (companion-bot laws widen) | Medium | Already designed as a non-companion; disclosure by default; privacy counsel from Phase 1. |
| Free incumbents add an LLM (Khan Kids, Duolingo ABC) | Medium | They lack child ASR and structured-literacy depth; move fast on evidence and the learner model. |
| Inference cost spikes with usage | Low | Hybrid design keeps LLM to ~15 turns/day; batch pre-generation; caching; model split revisable. |

---

## 11. First two weeks

1. Hire or contract the literacy lead; begin the UFLI skill-graph encoding together.
2. Stand up the TypeScript API skeleton, the skill-graph schema, and the decodability verifier with tests.
3. Author pipeline v0 on `claude-opus-5` + eval harness; measure first-pass decodability on lessons 1–20.
4. Download MyST and CSLU Kids; baseline Whisper-small WER on K–1 speakers.
5. Recruit 10 families for Wizard-of-Oz sessions; write the session script.
6. Draft the privacy architecture and consent flow with counsel; publish the data map.
