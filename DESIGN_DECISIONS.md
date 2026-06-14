# JoyVerse — Design Decisions (Redesign Pass)

*What changed in this pass, and the reasoning — for a child-facing, dyslexia-first
educational product. Companion to `UI_AUDIT.md`.*

## Guiding principle

The app already had a strong design system, so the highest-value work was **not**
restyling — it was **accessibility hardening, reading comfort, and emotional
regulation**, plus **cohesion** at the surfaces every child touches. Every change
is additive and token-driven; **the OpenDyslexic font family is unchanged** (a
hard constraint — it's a dyslexia accessibility feature, not a style choice).

Where a trade-off appeared, **accessibility won over aesthetics.**

## Decisions

### 1. Respect `prefers-reduced-motion` globally
**Decision:** a global media query reduces all animations/transitions to ~0 when
the user's OS requests reduced motion, and the emotion background crossfade
switches to an instant change.
**Why:** many children — especially neurodivergent and vestibular-sensitive ones
— are made anxious or unwell by motion. Honoring the OS setting is a baseline
accessibility duty the app was missing. It's the single biggest a11y win here and
carries zero risk to functionality.

### 2. Reading-measure constraint (`--measure`, `.readable`)
**Decision:** introduce a `--measure: 64ch` token and a `.readable` utility
(max-width + 1.7 line-height) for prose containers.
**Why:** unbounded line length is one of the most documented reading-comfort
problems for dyslexic readers; the eye loses the line on the return sweep. Capping
to ~50–70 characters with generous leading directly reduces reading fatigue.

### 3. Emotion-adaptive *intensity* (not just color)
**Decision:** `applyEmotionTheme()` now sets `data-emotion` on `<html>`. CSS uses
it to **lower visual stimulation for calming moods** (Angry: desaturate + lighten
the background, slow celebratory motion; Sad: gently soften) while **keeping
vibrancy for Happy/Surprise**. A `--ui-motion-scale` variable slows "pop" feedback
in calming states.
**Why:** the brief's emotion-first goal is *emotional regulation*. Previously the
system changed palette but a frustrated child received the same animation energy
as a delighted one. Now the interface actively de-escalates: less saturation, less
motion, more calm — exactly when a struggling child needs it.

### 4. GameShell tap targets + contrast (cascades to all 12 games)
**Decision:** the shared game wrapper's back button is now a ≥48px tap target at
1rem; the title is larger; the emotion badge has a higher-contrast label
(`#4b5563` over the old `#6b7280`) and a bigger hit area.
**Why:** `GameShell` wraps every game, so one change improves all of them.
Children and touch users need large, obvious targets (44–48px); the old controls
were ~0.9rem with small padding. Contrast was raised to meet WCAG AA.

### 5. Touch-first feedback on the games hub
**Decision:** game cards gained an `:active` pressed state, larger game-name
labels, and a soft entrance animation (auto-disabled under reduced-motion).
**Why:** children mostly use touch, where `:hover` never fires — they need a
clear *pressed* response so a tap feels acknowledged. Bigger labels aid decoding;
the gentle entrance adds delight without distraction.

### 6. Reassuring loading (skeletons)
**Decision:** a `.skeleton` shimmer utility, applied first to the child **My
Progress** screen (content-shaped placeholders instead of a bare "Loading…").
**Why:** skeletons communicate *what is coming* and feel faster and calmer than a
spinner or blank screen — reducing the "did it break?" anxiety for a child.

## Deliberately deferred (documented, not done this pass)

To protect functionality and stay honest about scope, these are recommended next
but not yet implemented:

- **Migrate per-game ad-hoc styling onto `gs-*` tokens** (Mirror Words, Word
  Quest, Syllable Tap, etc.) and retire duplicated `getEmotionStyles()` helpers.
  This is the largest cohesion lever but touches many files; it should be done
  game-by-game with visual checks.
- **Replace the native `alert()`** in Word Quest's "no questions" path with the
  in-app error pattern.
- **Skeletons for the Therapist dashboard** data sections.
- **Retire legacy tokens** (`--padding-10`, `--br-30`, `--font-size-19/24/32`)
  once no rules reference them.

## Verification

- Frontend build: clean. Frontend tests: 15/15. Backend tests: 18/18.
- No font-family changes. No functional/route changes. All edits are additive CSS
  + two small JS hooks (`data-emotion`, reduced-motion crossfade).

See the end of `pages/global.css`, `components/GameShell.css`, `pages/Games.css`,
`pages/MyProgress.*`, and `utils/EmotionThemeMap.js` for the implementation.
