# Primer — Landscape & Evidence Brief

*Research pass, 9 September 2026. Sources linked inline; company-reported numbers are flagged as such.*

---

## 0. One correction before anything else

The text you pasted is **Y Combinator's Fall 2026 Request for Startups, "The Primer," written by Andrew Miklas** — not an Anthropic document ([YC RFS](https://www.ycombinator.com/rfs)). YC's fuller framing (via a [third-party mirror](https://modelence.com/yc-rfs-fall-2026/the-primer)) is more specific than the paragraph you have:

- Ages **4–10**; start with **reading and phonics**, expand to early writing, arithmetic, comprehension.
- Product shape they imagine: per-child profile of mastered skills, a **skill graph** with prerequisites, real-time difficulty adjustment from answers *and response time*, **voice-friendly interaction for pre-readers**, bite-sized gamified lessons, a **parent dashboard**.
- "The tutor supplements teachers and parents; it does not replace them." Strict child-safe generation; "transparent explanations of what the AI is teaching and why."

That matters because it tells you what a YC partner will pattern-match against.

---

## 1. TL;DR

1. **The problem is real and getting worse.** On the 2024 NAEP, ~40% of US 4th graders read *below Basic* — the worst in 30+ years; only 31% are Proficient. Math recovered slightly (24% below Basic). ([Hechinger](https://hechingerreport.org/naep-test-2024-dismal-report/), [NAGB](https://www.nagb.gov/news-and-events/news-releases/2025/nations-report-card-decline-in-reading-progress-in-math.html))
2. **We know what works pedagogically, and it's not mysterious.** Systematic phonics (d≈0.41, 0.55 when started in K/1), structured literacy, learning-trajectory math (Building Blocks: 0.47–1.07). Human tutoring averages 0.37 SD; *nobody* has replicated Bloom's two sigma. Well-built intelligent tutoring systems already match human tutors on drillable skills (VanLehn: 0.76 vs 0.79).
3. **Nobody has shipped — or rigorously tested — an LLM-conversational tutor for ages 4–7.** The closest products (Ello, Amira, Bookbot) are speech-recognition + scripted pedagogy. Super Teacher *explicitly* avoids LLMs; Mentava sells "humans, not AI." Khanmigo and Wild Zebra start at grade 2. Stanford's 2026 review found 20 causal studies out of 800+ papers and names early elementary and literacy as gaps. That gap is the opportunity and the risk.
4. **Speech is the moat and the wall.** Adapted Whisper hits ~12–16% WER on children's speech; Ello trained on 130k hours of proprietary child audio; even Amira gets "she doesn't let me finish my sentences." Phoneme-level scoring of a 5-year-old is the hard engineering problem, not the LLM.
5. **The LLM's real contribution is not decoding drills** (a solved ITS problem). It's the upper strand of Scarborough's rope — oral language, vocabulary, comprehension dialogue, "why" questions — plus infinite personalized decodable text, writing feedback, math misconception diagnosis, and explaining to parents what's happening and why. That's also where "learns the child over years" lives.
6. **Unit economics don't close yet at mass-market pricing.** Real-time voice APIs run roughly $0.04–0.23/min; 20 min/day is 600 min/month → $24–$140/month in inference vs. a $8–15/month consumer price point. Hybrid architecture (on-device ASR, scripted core loop, LLM only where it earns its cost) or premium pricing is required. Mentava proves a niche will pay $500/month.
7. **Trust and regulation are now first-order product constraints.** COPPA's 2025 amendments classify voiceprints as personal information (compliance deadline April 2026), FTC 6(b) inquiry on companion bots, California SB 243, Common Sense Media saying no AI toys under 5, and a live parent revolt against Amira's voice recording in New Mexico. Build privacy as a feature, not a policy page.
8. **Retention is the business.** Kids' education apps churn ~7.4%/month; top reasons are "child lost interest" (36%) and "aged out" (24%). Khanmigo saw 15% engagement when it waited to be asked. Visible progress to parents is what lowers churn.

---

## 2. What the evidence says works

### Effect sizes worth memorizing

| Intervention | Effect (SD) | Population | Source |
|---|---|---|---|
| Human tutoring, pooled (96 RCTs) | **0.37** — stronger in early grades; none reached 2σ | PreK–12 | [Nickow, Oreopoulos & Quan 2024](https://journals.sagepub.com/doi/abs/10.3102/00028312231208687); [Ed Next on 2σ](https://www.educationnext.org/two-sigma-tutoring-separating-science-fiction-from-science-fact/) |
| Systematic phonics (NRP meta-analysis) | **0.41**; **0.55** when begun in K/1st; effects persisted | K–6 | [Ehri et al. 2001](https://journals.sagepub.com/doi/10.3102/00346543071003393) |
| Building Blocks preschool math | **0.47** vs. another curriculum; **1.07** vs. control; fadeout mixed | Pre-K | [Clements & Sarama](https://www.researchgate.net/publication/258933028_Mathematics_Learned_by_Young_Children_in_an_Intervention_Based_on_Learning_Trajectories_A_Large-Scale_Cluster_Randomized_Trial) |
| Intelligent tutoring systems (50 evals) | **0.66** median | Mixed | [Kulik & Fletcher 2016](https://journals.sagepub.com/doi/abs/10.3102/0034654315581420) |
| Human tutor / step-based ITS / substep ITS vs. none | **0.79 / 0.76 / 0.40** | Mixed | [VanLehn 2011](https://arxiv.org/pdf/1812.09628) |
| ITS in US K–12 (18 studies, 77 effects) | **0.27** | K–12 | [2025 meta-analysis](https://arxiv.org/abs/2511.04997) |
| GPT-4 (Copilot) after-school tutoring, 6 weeks | **0.23** English / **0.31** composite; "1.5–2 years of schooling"; largest for girls and higher-baseline students | Nigerian secondary | [World Bank 2025](https://ideas.repec.org/p/wbk/wbrwps/11125.html) |
| Custom AI tutor vs. active-learning class | **>2×** learning gains, less time | Harvard undergrads | [Kestin et al., Sci Reports 2025](https://www.nature.com/articles/s41598-025-97652-6) |
| Tutor CoPilot (LLM assists human tutor) | **+4 pp** mastery; **+9 pp** for lower-rated tutors; ~$20/tutor/yr | Elementary math, 1,000 students | [Wang et al. 2024](https://arxiv.org/pdf/2410.03017) |
| LearnLM + Eedi, expert-supervised | Comparable to human tutors; +5.5 pp on novel problems | UK secondary math, n=165 | [arXiv 2512.23633](https://arxiv.org/abs/2512.23633) |

### What to take from it

- **The bar for "as good as a private tutor" is ~0.4 SD, not 2.0.** That's achievable; ITS already do it on structured skills. The claim to make is credible and testable.
- **Every rigorous LLM-tutor RCT is secondary/college.** There is no causal evidence for LLM tutoring at ages 4–8. Stanford SCALE's 2026 review (20 causal studies out of 800+ papers) says: guardrailed tutors beat open chatbots; gains sometimes vanish when the tool is removed; no high-quality US K-12 classroom studies; early elementary and literacy are "sparse." ([SCALE](https://scale.stanford.edu/research-in-action/understanding-evidence-base-ai-k12-education)) A 2025 review of 28 K-12 studies found AI-ITS advantages "negligible" vs. non-AI tutoring that also used active learning ([SciAm](https://www.scientificamerican.com/article/alpha-schools-ai-teaching-model-is-expanding-does-it-work/)). **Running the first credible RCT for this age band is a strategic asset, not just science.**
- **Fadeout is the trap for a consumer product.** Bailey & Duncan's "trifecta": durable effects require skills that are *malleable, fundamental, and wouldn't have developed anyway*. Decoding is fundamental and malleable — but affluent early adopters' kids will learn to read regardless, so their measured gains fade by 3rd grade. ([Bailey et al. 2020](https://journals.sagepub.com/doi/abs/10.1177/1529100620915848)) Durable impact lives with at-risk kids (who don't buy $15/mo apps) or in going *beyond* what school would deliver — which is the "thinking, reasoning" part of the Primer vision.
- **Pedagogy is the product.** The most instructive document in this pass is a literacy specialist's [teardown of Mentava](https://picturesareforbabies.com/blog/reviews/mentava/): it *looks* rigorous, but teaches blending with letters from day one (turning phonemic awareness into phonics), skips substitution/deletion tasks, has no systematic review, no fluency work, and the founder admitted not knowing the orthographic-mapping literature. Result: kids who decode early but may hit the 4th-grade slump. An LLM does not fix a bad scope-and-sequence; it amplifies it.
- **Open scaffolding exists.** UFLI Foundations is a free, widely adopted structured-literacy scope & sequence; Storiza (ICLS 2025) already generates decodable stories aligned to UFLI lessons 10–128 from child prompts ([ISLS](https://repository.isls.org/handle/1/11320)). Fine-tuned 8B models beat zero-shot GPT-4o on reading-level control ([arXiv 2605.13709](https://arxiv.org/abs/2605.13709)). Illustrative Mathematics is the open math analogue. [Learning Commons](https://learningcommons.org/) (CZI spin-out) publishes standards-mapped, machine-readable curriculum infrastructure and co-built Anthropic's Claude for Teachers skills.

---

## 3. Competitive landscape

| Product | Ages | Subjects | How it works / AI | Price | Evidence | Notes |
|---|---|---|---|---|---|---|
| **Ello** ([site](https://www.ello.com/)) | 4–9 | Reading, now math | Proprietary child ASR (130k+ hrs, phoneme-level, "outperforms Whisper"), physical + digital decodables, 700 GenAI-assisted books, kid-made stories | $9.99/mo (+$0.99 SNAP) | Company: "88% read more after 4 weeks." No published RCT. | $20M+ raised (Goodwater, Reed Hastings, YC); ~89 staff. Closest consumer comp. |
| **Amira Learning** (merged w/ Istation) | K–3 | Reading assessment + tutoring, dyslexia screen | Proprietary child ASR; uses **Claude** for generative features; "Intelligent Growth Engine" | ~$20/student/yr (schools) | Company-cited: ES 0.40; Woodcock +0.64; Utah study "1.5 yrs growth." | 1,800+ districts. **New Mexico mandate → parent backlash**: "she doesn't let me finish my sentences," voice-recording fears, 5 districts opted out, state cut retention to 48h. ([ABQ Journal](https://www.abqjournal.com/news/amid-parent-backlash-aps-keeps-ai-reading-program-with-changes/3110194)) |
| **Mentava** | 3.5–5 | Reading only (to ~2nd-grade decoding) | Linear self-paced app + human coach on messaging; markets "humans, not AI" | **$500/mo** | None independent; strong selection effects | Proves a premium niche exists. Pedagogy critiqued (see §2). |
| **Duolingo ABC** | 3–8 | Reading/writing | Gamified phonics, tracing | Free | Company: +28% literacy in 9 weeks | Free incumbent; no AI tutor. |
| **Khan Academy Kids / Khanmigo** | 2–8 / K–12 | Reading, math | Kids app is adaptive, no LLM; Khanmigo is GPT/Gemini Socratic chat | Free / $4/mo | — | Kids: 21M learners. Khanmigo: only **15%** of eligible students engaged → redesign to proactive help, summer 2026. ([Learning Standard](https://thelearningstandard.org/news/khan-academy-revamps-ai-tutor-after-low-student-usage)) |
| **Synthesis Tutor** | 5–11 | Math | Adaptive, digital manipulatives, step-by-step | Subscription | App-store ratings only | Ad Astra/SpaceX-school lineage. |
| **Super Teacher** | Elementary | Math (+) | Animated voice tutors; **deterministic, no LLM** by design | $15/mo or $10/mo annual | None published | 20k families; schools in NY/NJ/HI. ([TechCrunch](https://techcrunch.com/2025/10/28/super-teacher-is-building-an-ai-tutor-for-elementary-schools-catch-it-at-disrupt-2025/)) |
| **Wild Zebra** | Grades 2–9 | Math, reading comprehension | Socratic LLM, lessons grounded in kid's interests, teacher dashboard | Schools | Pilots, 6k students | $8M raised (Trilogy). Starts *after* the 4–7 window. |
| **Bookbot** | Early readers | Reading | Child ASR incl. single-phoneme detection (patent) | Subscription | Company: +33.5% in 6 weeks | 64 languages. |
| **ABCmouse / Homer / Lingokids** | 2–8 | Broad | Curriculum + games, adaptive-ish | ~$8–13/mo | — | ABCmouse: top-grossing US kids learning app (~$20.5M app revenue, 2023). |
| **Alpha School / 2 Hour Learning** | K–12 | All | IXL-style adaptive apps + human "guides"; not LLM-driven | $40–75k/yr | MAP "2.6× growth" (self-reported, selective admissions). Unbound Academy charter (open admission): **10% math / 28% ELA proficient** vs. predicted 60/65. | Expanding to ~50 campuses. ([Economy of Meaning](https://theeconomyofmeaning.com/2026/09/01/do-we-know-the-alpha-and-omega-of-alpha-school/)) |
| **Miko** | 5–10 | Companion robot | NLP chat, games | $199 + sub | — | Common Sense: avoid AI toys ≤5, "extreme caution" 6–12. |

**Reading of the board:** the reading-app incumbents own *speech + decodables*; the LLM tutors own *grades 2+*; the free giants own *distribution*. The empty square is **LLM-native, voice-first, ages 4–7, across reading + writing + arithmetic, sold to parents** — exactly the RFS. It's empty partly because it's hard (speech, cost, safety) and partly because the LLM players don't have literacy expertise.

---

## 4. The hard parts, ranked

### 4.1 Children's speech recognition
- Whisper adapted for kids: **15.9% WER**, 11.8% with filtering, on the MyST corpus; runs on a Raspberry Pi at RTF 0.23–0.41 ([arXiv 2507.14451](https://arxiv.org/abs/2507.14451)). Adult English is ~5%. Four-year-olds are worse than MyST (grades 3–5).
- SoapBox Labs (now inside Curriculum Associates) shows lower agreement with human raters on **phoneme blending** than on word reading ([Frontiers 2026](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2026.1671946/full)) — the exact task that matters most in K.
- Ello's 130k-hour proprietary dataset is the real moat in this category. Options: license (few options left), fine-tune open models on MyST/CSLU + your own consented data, or design the product so ASR errors are cheap (short, predictable utterances; confirm rather than assume).
- Real-time speech-to-speech APIs (GPT-Realtime-2, Gemini Live) give 300ms–2.3s to first audio — fine for conversation, not for phoneme scoring.

### 4.2 Cost per learning-minute
- Pricing sources conflict, but the range is roughly **$0.04–0.23 per minute** of voice interaction ([one comparison](https://webscraft.org/blog/gptrealtime2-vs-gemini-live-api-scho-obrati-dlya-golosovogo-agenta-u-2026-rotsi?lang=en), [another](https://tokencost.app/blog/openai-gpt-realtime-2-voice-pricing)). At 20 min/day that's $24–$140/mo — versus an $8.13/mo average kids-ed subscription. A pure "LLM voice on every turn" design is 3–15× underwater. Design the loop so most turns are on-device ASR + deterministic logic, and the LLM is invoked for generation, diagnosis and dialogue where it changes the outcome.

### 4.3 Retention
- Kids' ed apps: **7.4%/mo churn** (≈60%/yr); education apps' D30 retention ~2% ([RetentionCheck](https://retentioncheck.com/churn-benchmarks/kids-education-apps), [Business of Apps](https://www.businessofapps.com/data/education-app-benchmarks/)). Apps with clear progression and strong parent reporting: 5–7%; without: 8–12%.
- Two levers the evidence supports: **proactive, not waiting-to-be-asked** (Khanmigo's lesson) and **parents seeing measurable progress** (churn driver #1 is "child lost interest"; #2 is "aged out" — a 4–10 span is a retention feature).

### 4.4 Trust, safety, regulation
- **COPPA 2025 amendments** (effective June 2025, compliance by 22 April 2026): voiceprints are biometric personal information; an audio-only exception exists if you delete immediately after responding; using kids' data to train AI needs *separate* verifiable parental consent; written retention policy required. ([Akin](https://www.akingump.com/en/insights/ai-law-and-regulation-tracker/new-coppa-obligations-for-ai-technologies-collecting-data-from-children))
- FTC Section 6(b) inquiry into companion chatbots (Sept 2025); California **SB 243** (Jan 2026) requires AI disclosure and 3-hourly "not human" reminders for minors on companion bots. A tutor that has a name and a personality will get read as a companion by regulators.
- **Common Sense Media** (Jan 2026): no AI toys for ≤5, extreme caution 6–12; launched a Youth AI Safety Institute in May 2026. They rated Ello highly — that endorsement is worth pursuing.
- **Anthropic's own rules**: Claude.ai is 18+ with no parental-consent path, but products built on the API may serve minors with age gating, content filtering, monitoring, AI disclosure, and stated COPPA compliance; Anthropic can supply a child-safety system prompt and reserves audit rights ([guidelines](https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors)). Amira already runs on Claude, so the path is proven.
- Parents: 72% say AI should be part of their child's education, but parents of *young* children specifically worry about interfering with foundational skills; support skews high-income and college-educated ([KidsAITools survey summary](https://www.kidsaitools.com/en/articles/parents-survey-ai-schools-2026)). Position as "the thing that gets your kid *off* the screen reading real books" (Ello ships physical books for a reason).

### 4.5 Hallucination in pedagogy
- Super Teacher's pitch is "deterministic so it's never wrong." That's a real parent fear. Structure: LLM proposes, a verifier/scope-and-sequence disposes. Never let the model improvise a phonics rule, a math fact, or a letter formation. Let it improvise stories, encouragement, questions, and explanations to parents.

---

## 5. What an LLM actually adds (the pitch that survives scrutiny)

Scripted ITS + child ASR (Ello/Amira) already deliver the decoding loop. The Primer story needs the LLM to do what they *can't*:

1. **Oral language and comprehension dialogue** — the strand of Scarborough's rope that apps ignore because it needs conversation: retelling, predicting, "why did the fox do that?", vocabulary in context. This is also where "teaches thinking" begins.
2. **Infinite, personalized, level-locked text** — decodable stories about *this* child's dog, constrained to the phonics patterns taught so far (Storiza shows the pattern; Ello did 700 books with humans in the loop).
3. **Writing** — the RFS names it and nobody serves it: dictation → composition, feedback on a 6-year-old's sentence, handwriting via stylus is an open problem.
4. **Arithmetic misconception diagnosis** — a child who says "12 + 9 = 111" is doing something specific; a dialogue finds it, a multiple-choice grader doesn't.
5. **Parent as co-tutor** — explain what was taught today and why, give the 5-minute thing to do at dinner. "Transparent explanations of what the AI is teaching and why" is in the RFS verbatim.
6. **A longitudinal learner model** — the Primer's defining trait. Nobody has this; it's also the hardest thing to make legible and safe.

---

## 6. Open decisions before building

| Decision | Options | What the research says |
|---|---|---|
| **Wedge** | Reading (YC's suggestion) vs. early math (no ASR dependency) vs. comprehension/oral language (LLM-native) | Reading is where the pain and the purchase intent are; math avoids the speech wall; oral language is the least contested square. A defensible sequence: *reading-comprehension dialogue + generated decodables on top of an open scope-and-sequence*, then arithmetic. |
| **Speech strategy** | License / fine-tune open / design around errors | No obvious license target left; plan for fine-tuning with consented, deleted-fast audio and a UX that tolerates 15% WER. |
| **Price tier** | Mass ($8–15/mo) vs. premium ($50–500/mo, "tutor replacement") | Economics point premium-first while inference costs fall; Mentava/Alpha show the willingness; mass market requires the hybrid architecture. |
| **Device** | iPad/Fire tablet app vs. dedicated hardware vs. voice-only | Tablets are where 68% of 0–8s already are; hardware ≈ "AI toy" in Common Sense's eyes. |
| **Evidence plan** | Testimonials vs. pre/post vs. RCT | No RCT exists for LLM tutoring at this age. Run one early (DIBELS/Acadience pre-post with a waitlist control is cheap); it's a moat against every "88% read more" claim. |
| **Curriculum base** | Build own vs. adopt UFLI / Illustrative Math | Adopt open, evidence-based scope-and-sequence; spend the novelty budget on the tutor, not the syllabus. |

---

## 7. Source list

**The ask** — [YC RFS](https://www.ycombinator.com/rfs) · [The Primer (mirror)](https://modelence.com/yc-rfs-fall-2026/the-primer)

**Evidence** — [Nickow et al. 2024](https://journals.sagepub.com/doi/abs/10.3102/00028312231208687) · [Ed Next on 2σ](https://www.educationnext.org/two-sigma-tutoring-separating-science-fiction-from-science-fact/) · [Ehri et al. 2001](https://journals.sagepub.com/doi/10.3102/00346543071003393) · [Kulik & Fletcher 2016](https://journals.sagepub.com/doi/abs/10.3102/0034654315581420) · [ITS K-12 meta 2025](https://arxiv.org/abs/2511.04997) · [Building Blocks](https://www.researchgate.net/publication/258933028_Mathematics_Learned_by_Young_Children_in_an_Intervention_Based_on_Learning_Trajectories_A_Large-Scale_Cluster_Randomized_Trial) · [Bailey et al. 2020 fadeout](https://journals.sagepub.com/doi/abs/10.1177/1529100620915848) · [World Bank Nigeria](https://ideas.repec.org/p/wbk/wbrwps/11125.html) · [Kestin et al. 2025](https://www.nature.com/articles/s41598-025-97652-6) · [Tutor CoPilot](https://arxiv.org/pdf/2410.03017) · [LearnLM/Eedi RCT](https://arxiv.org/abs/2512.23633) · [Stanford SCALE 2026](https://scale.stanford.edu/research-in-action/understanding-evidence-base-ai-k12-education) · [SciAm on Alpha](https://www.scientificamerican.com/article/alpha-schools-ai-teaching-model-is-expanding-does-it-work/) · [Alpha evidence critique](https://theeconomyofmeaning.com/2026/09/01/do-we-know-the-alpha-and-omega-of-alpha-school/) · [NAEP 2024](https://hechingerreport.org/naep-test-2024-dismal-report/)

**Products** — [Ello](https://www.ello.com/) · [Ello Series A](https://finance.yahoo.com/news/ello-world-most-advanced-ai-181200440.html) · [Ello GenAI books](https://finance.yahoo.com/news/ello-leverages-genai-launch-largest-131500632.html) · [Amira IGE](https://amiralearning.com/newsroom/amira-learning-unveils-ai-powered-intelligent-growth-engine) · [Amira NM backlash](https://www.abqjournal.com/news/amid-parent-backlash-aps-keeps-ai-reading-program-with-changes/3110194) · [NBC on Amira](https://www.nbcnews.com/news/education/ai-reading-tool-amira-new-mexico-parents-schools-privacy-concerns-rcna591161) · [Mentava](https://www.mentava.com/) · [Mentava teardown](https://picturesareforbabies.com/blog/reviews/mentava/) · [Duolingo ABC](https://apps.apple.com/us/app/learn-to-read-duolingo-abc/id1440502568) · [Khan Kids](https://play.google.com/store/apps/details?id=org.khankids.android) · [Khanmigo redesign](https://thelearningstandard.org/news/khan-academy-revamps-ai-tutor-after-low-student-usage) · [Synthesis](https://www.synthesis.com/tutor) · [Super Teacher](https://techcrunch.com/2025/10/28/super-teacher-is-building-an-ai-tutor-for-elementary-schools-catch-it-at-disrupt-2025/) · [Wild Zebra](https://www.thesaasnews.com/news/wild-zebra-raises-6m-seed/) · [Bookbot](https://apps.apple.com/us/app/bookbot-phonics-books-for-kids/id1325919626) · [ABCmouse revenue](https://www.statista.com/statistics/1537269/highest-grossing-us-learning-apps-children/) · [YC AI-learning cos](https://www.ycombinator.com/companies/industry/AI-Enhanced%20Learning)

**Speech & generation** — [Whisper for kids](https://arxiv.org/abs/2507.14451) · [SoapBox vs. humans](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2026.1671946/full) · [Storiza](https://repository.isls.org/handle/1/11320) · [Compact LLM story gen](https://arxiv.org/abs/2605.13709) · [Voice API pricing A](https://webscraft.org/blog/gptrealtime2-vs-gemini-live-api-scho-obrati-dlya-golosovogo-agenta-u-2026-rotsi?lang=en) · [Voice API pricing B](https://tokencost.app/blog/openai-gpt-realtime-2-voice-pricing)

**Market & retention** — [Kids ed churn](https://retentioncheck.com/churn-benchmarks/kids-education-apps) · [Education app benchmarks](https://www.businessofapps.com/data/education-app-benchmarks/) · [Parent survey 2026](https://www.kidsaitools.com/en/articles/parents-survey-ai-schools-2026)

**Regulation & trust** — [COPPA & AI (Akin)](https://www.akingump.com/en/insights/ai-law-and-regulation-tracker/new-coppa-obligations-for-ai-technologies-collecting-data-from-children) · [FTC 6(b)](https://www.ftc.gov/news-events/news/press-releases/2025/09/ftc-launches-inquiry-ai-chatbots-acting-companions) · [SB 243](https://www.billtrack50.com/info/blog/regulating-ai-companions-before-they-raise-our-kids) · [Common Sense AI toys](https://www.commonsensemedia.org/press-releases/common-sense-media-warns-against-ai-toy-companions-after-research-reveals-safety-risks) · [Anthropic minors guidelines](https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors) · [Claude for Teachers](https://www.anthropic.com/news/claude-for-teachers) · [Learning Commons](https://learningcommons.org/)
