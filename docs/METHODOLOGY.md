# JoyVerse — Methodology & Pedagogy

*How JoyVerse is designed, what evidence it draws on, and — honestly — what it is and isn't.*

This document is written for therapists, special-education teachers, school
leaders, and parents who want to understand the thinking behind the platform
before piloting it.

---

## 1. Design philosophy

JoyVerse is built around the principles of **structured literacy** — the
approach endorsed by the *Science of Reading* and the International Dyslexia
Association for learners with dyslexia. Structured literacy instruction is:

- **Explicit** — skills are taught directly, not discovered incidentally.
- **Systematic & cumulative** — content follows a logical sequence, each step
  building on the last.
- **Multisensory** — learners see, hear, and act (tap, build, speak).
- **Diagnostic / responsive** — practice adapts to the learner's performance.

Every game maps to a recognised component of skilled reading. JoyVerse is not a
loose collection of games; it is a practice system organised around the
reading-skill domains that the research literature identifies as central to
dyslexia.

---

## 2. Skill domains → games

| Reading-skill domain | Why it matters for dyslexia | JoyVerse game(s) |
|---|---|---|
| **Phonological & phonemic awareness** | The strongest predictor of early reading; weak phoneme awareness is a core deficit in dyslexia. | Phoneme Tap, Fun with Syllables |
| **Phonics / decoding** | Mapping graphemes→phonemes is the skill explicit instruction targets. | Letter Sound Match, Letter Bridging, Word Quest |
| **Orthographic mapping / sight words** | Fluent readers store words for instant retrieval; spaced repetition builds this. | Sight Word Drill (SM-2 spaced repetition) |
| **Letter / symbol discrimination** | b/d/p/q reversals are a classic friction point. | Mirror Words, Letter Trainer |
| **Reading fluency** | Bridges decoding and comprehension; measured in WPM + accuracy. | Reading Fluency |
| **Rapid Automatized Naming (RAN)** | RAN speed is one of the best-established predictors of reading difficulty, independent of phonological awareness (the "double-deficit" model). | Rapid Naming |
| **Morphological awareness** | Understanding prefixes/suffixes/roots supports decoding and vocabulary. | Word Builder |
| **Working memory** | Verbal working memory underpins holding sounds/words while decoding. | Sequence Memory |

---

## 3. Scope & sequence

Phonics content follows a systematic, cumulative progression (defined in
`constants/PhonicsLevel.js` and the seeded content):

1. **CVC** — consonant–vowel–consonant (cat, dog, sit)
2. **Blends** — consonant blends (flag, step, swim)
3. **Digraphs** — two letters / one sound (chat, ship, that, when)
4. **Vowel Patterns** — long vowels & vowel teams (rain, boat, feet)
5. **Advanced Patterns** — complex / irregular spellings (light, caught, knight)

The same level vocabulary is shared across games so a learner working at, say,
the *Digraphs* level encounters consistent content whether they are tapping
phonemes, matching sounds, or building words.

---

## 4. The learning loop: assess → personalize → practice → measure

JoyVerse closes the loop that turns "fun games" into an intervention:

- **Assess (baseline).** A learner's earliest sessions in each skill establish a
  baseline, captured automatically.
- **Personalize.** A *recommended focus* points the learner toward the skill
  that most needs attention (`/api/progress` → `recommendedFocus`). Within each
  game, an adaptive-difficulty engine suggests level changes based on recent
  accuracy and a frustration signal.
- **Practice.** The games themselves.
- **Measure growth (re-assess).** Progress is reported as a *change from
  baseline* — e.g. "reading speed 48 → 63 WPM" — on both the child-facing
  **My Progress** screen and the therapist's **Growth at a glance** panel. This
  is the "is it working?" evidence, surfaced continuously rather than only at a
  formal re-test.

---

## 5. Engagement

Sustained practice is what produces measurable growth, so JoyVerse includes
light engagement scaffolding: daily goals, practice streaks, achievement
badges, and a weekly highlights summary. These are designed to encourage
*consistency*, not to gamify away the learning.

---

## 6. Privacy — expression sensing

JoyVerse can use the webcam to read facial expressions and gently adapt games to
how a learner is feeling. This is built privacy-first:

- **On-device only.** Facial-landmark detection (MediaPipe) and the expression
  classifier (a transparent geometric model — see `utils/GeometricEmotion.js`)
  run entirely in the browser.
- **Nothing is uploaded or stored.** No video frames or images ever leave the
  device or reach the server. Only a coarse expression label (e.g. "happy",
  "frustrated") is used in the moment and, optionally, logged as an aggregate
  signal.
- **Off by default, opt-in.** The camera stays off until a user explicitly
  consents, and it can be toggled any time in Accessibility settings.

The expression signal is intentionally treated as a *soft* aid (mood/frustration
sensing for adaptation), not a clinical measurement.

---

## 7. Honest scope — what this is and isn't

- ✅ **Is:** evidence-*aligned* structured-literacy practice with progress
  monitoring and adaptive difficulty, designed to complement a therapist's or
  teacher's instruction.
- ❌ **Is not (yet):** a diagnostic instrument. JoyVerse does not diagnose
  dyslexia. The RAN and phoneme activities are aligned with screening indicators
  used in the research literature, but they are practice/monitoring tools, not a
  validated assessment battery.
- ❌ **Is not:** a replacement for a qualified specialist. It is most powerful as
  the at-home practice + monitoring layer between sessions.

### Roadmap to strengthen the clinical claim
1. **Formal baseline assessment battery** — short, standardized timed RAN +
   phoneme-segmentation + nonsense-word decoding tasks producing a norm-referenced
   baseline, with scheduled re-assessment.
2. **Efficacy pilot** — a small pre/post study with consenting families and a
   partner clinician to gather real growth data.
3. **External content review** — a structured-literacy specialist validates the
   scope & sequence and every item a child sees.

---

*Questions or pilot interest: anvayasupport@gmail.com*
