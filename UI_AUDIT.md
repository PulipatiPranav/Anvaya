# JoyVerse — UI / UX Audit

*A full-repository audit through the lenses of product design, child learning
experience, UX psychology, and dyslexia accessibility.*

## Honest headline

JoyVerse is **not** a messy app. It already has a genuinely mature foundation:

- A real **semantic design-token system** in `pages/global.css` (surfaces, text,
  brand, status, borders, shadows, radius, an 8-pt-ish spacing scale, typography,
  transitions).
- A unified game wrapper (`GameShell`) and a coherent `gs-*` component family
  (cards, buttons, question boxes, options, feedback, complete panel).
- A thoughtful **emotional check-in onboarding** ("How are you?") and a smooth
  **emotion background crossfade** (`EmotionThemeMap`).
- Global **focus-visible** styles, a **skip-to-content** link, and shared
  loading / error / empty utilities.
- Accessibility controls (font, size, spacing, line-height) via a context.

So this audit is about **targeted refinement, accessibility hardening, and
emotion-regulation depth** — not a teardown. The biggest real problem is
*cohesion drift*: the polished `gs-*` system isn't used everywhere, so older
games carry a second, ad-hoc visual language.

Scope reviewed: all routes/pages (`src/pages`, `src/App.js`), shared components
(`src/components`), styling architecture (`global.css`, `GameShell.css`, per-page
CSS), emotion pipeline (`EmotionThemeMap`, `useEmotionDetection`), onboarding
(`WelcomeScreen`, `LoginPage`), and state handling (loading/error/empty).

---

## 1. Visual Problems

1. **Two visual languages (cohesion drift).** The modern system (`GameShell`,
   `gs-card`, `gs-btn`, gradient title pills, glass cards) coexists with older
   per-game styling that hardcodes hex colors and shapes — e.g. Mirror Words
   (`#f97316`, `#fef3c7`, `#fde68a`), Word Quest, Syllable Tap, and the per-game
   `getEmotionStyles()` helpers that duplicate emotion colors inline. Result:
   inconsistent buttons, radii, and palettes between games.
2. **Legacy tokens linger.** `--padding-10`, `--br-30`, `--font-size-19/24/32`,
   `--color-peachpuff`, etc. sit alongside the clean scale — noise that invites
   inconsistent reuse.
3. **Low-contrast micro-text.** Small meta text uses light greys
   (`#6b7280`, `--text-muted #718096`) — e.g. the GameShell emotion-badge
   percentage — which is borderline against translucent/photo backgrounds.
4. **Text over busy photo backgrounds.** Emotion backgrounds are full-bleed
   photos; most content sits on blurred glass cards (good), but headings/subtitles
   on the games hub and welcome sit directly on the photo with only a text-shadow.

## 2. UX Problems

1. **Tap targets below child/mobile guidance.** Several controls are < 44px:
   `GameShell` back button (`0.9rem`, `8px 16px`), emotion badge, and some inline
   selects. Children and touch users need ≥ 44–48px.
2. **Inconsistent "back" affordance.** Games use the `GameShell` back button;
   some screens add their own back/again buttons in different places.
3. **Spinners as the only loading affordance.** Functional but not reassuring;
   data screens (My Progress, Therapist dashboard) would feel faster with
   skeletons.
4. **Native `alert()` for an error path.** Word Quest uses `alert("No questions
   found…")` — jarring and un-childlike.

## 3. Accessibility Problems

1. **No global `prefers-reduced-motion` support.** Crossfades, pops, bounces,
   spinners, and the GIF feedback all animate regardless of the user's OS setting.
   For neurodivergent / vestibular-sensitive children this is a real issue.
2. **No reading-measure constraint.** Nothing caps line length; long lines on
   wide screens hurt dyslexic tracking (ideal ≈ 50–70 characters).
3. **Emotion badge contrast** (above) can fail WCAG AA at small sizes.
4. **Selects/labels** in some games rely on color/size alone for state.
5. Focus styles are good globally, but a few custom buttons override them.

## 4. Child Experience Problems

1. **Cohesion = trust.** Where games look ad-hoc, the app feels less "safe and
   professionally built" — the exact feeling parents need.
2. **Calm vs. stimulation isn't tuned to emotion.** The emotion system changes
   *colors and background*, but visual *intensity* is constant — a frustrated
   child gets the same animation energy as a happy one. Emotional regulation
   wants the opposite.
3. **Reward moments are good but uneven.** Confetti + the new success/failure
   GIFs are great; some games still end on plain text.

## 5. Dyslexia-Specific Problems

1. **Line length unbounded** (above) — the single highest-impact reading-comfort
   gap.
2. **Line-height is global (1.5)** and adjustable — good — but long prose blocks
   (Reading Fluency passages, instructions) don't get extra leading.
3. **Busy backgrounds behind text** reduce decoding ease, especially under the
   non-card text.
4. The font itself (OpenDyslexic) is correct and **must not change** — confirmed
   and preserved.

## 6. Performance Problems

1. **Largely fine.** Routes are code-split (lazy + Suspense), the vision runtime
   is dynamically imported, and chunks are reasonable.
2. **Per-game `getEmotionStyles()` duplication** recomputes inline style objects
   each render and duplicates the central theme map — minor churn + drift.
3. **Heavy `backdrop-filter: blur()`** is used widely; on low-end devices many
   simultaneous blurs can cost paint time (acceptable, worth noting).

## 7. Recommended Improvements (prioritized)

**P0 — accessibility & calm (global, low-risk, high-impact)**
- Add a global `prefers-reduced-motion` guard; make the emotion crossfade honor it.
- Add a reading-measure token (`--measure`) + `.readable` utility for prose.
- Tune **emotional intensity**: calmer, lower-stimulation visuals for Angry/Sad;
  keep vibrancy for Happy/Surprise (emotional regulation).

**P1 — cohesion & child trust**
- Polish `GameShell` (it wraps all 12 games): larger tap targets, stronger
  contrast, gentler hierarchy → cascades everywhere.
- Raise micro-text contrast to meet AA.
- Onboarding & games hub: calmer headings, comfortable spacing, obvious next step.

**P2 — polish & consistency (incremental)**
- Migrate ad-hoc game styling onto `gs-*` tokens; retire `getEmotionStyles()`
  duplication in favor of the central map.
- Replace `alert()` with the in-app error pattern.
- Skeleton loaders for data screens.
- Remove legacy tokens once references are gone.

See `DESIGN_DECISIONS.md` for what was implemented in this pass and why.
