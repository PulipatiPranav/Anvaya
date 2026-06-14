# JoyVerse — One-Page Summary

**JoyVerse** is a free, browser-based suite of literacy games for children with
dyslexia (≈ ages 6–12), wrapped in adaptive difficulty, progress tracking that
proves growth, on-device expression sensing, and a therapist dashboard — built
privacy-first and accessibility-first.

## The problem it addresses
Dyslexia (≈ 1 in 10 children) needs frequent, systematic literacy practice — but
practice is repetitive (kids disengage) and progress is hard to see (everyone
loses motivation). JoyVerse makes the practice engaging and the progress visible.

## What it does
- **12 learning games** across every core reading-skill domain: phonological
  awareness, phonics/decoding, fluency, sight words, rapid naming, morphology,
  reversal (b/d/p/q) discrimination, and working memory.
- **Adapts** to each child (difficulty + optional on-device expression sensing).
- **Proves growth** — per-skill baseline→now trends, streaks, weekly summaries,
  and a recommended next focus, for both child and therapist.
- **Therapist dashboard** — assign practice, monitor between sessions, "growth at
  a glance", printable reports.
- **Accessibility built in** — OpenDyslexic font, adjustable text, reliable TTS
  with selectable voices.

## Why it's different
Not just a pile of games — a **loop**: assess → personalize → practice → measure
growth. Plus a **privacy-first** emotion feature (on-device, opt-in, nothing
stored) and **evidence-aligned** design (mapped to structured-literacy skills,
including RAN, a well-established reading-difficulty indicator).

## Tech (at a glance)
React 19 + Vite frontend · Node/Express + MongoDB backend · JWT auth + RBAC ·
MediaPipe Face Landmarker (on-device blendshapes) for emotion · espeak-ng TTS.
No ML server; all emotion processing is in-browser.

## Honest status
Advanced prototype, **pilot-ready**. Feature-complete, privacy- and
accessibility-first, tests passing. **Not** a diagnostic tool, **not** clinically
validated yet, **English-literacy only**. Next step: a consent-based pilot at an
institution to gather real growth data.

## What it is / isn't
✅ Evidence-*aligned* practice + progress monitoring to **complement** a specialist.
❌ Not a diagnosis. ❌ Not a replacement for a specialist or a full curriculum.

---
*Full docs: [docs/README.md](README.md) · Pedagogy: [METHODOLOGY.md](METHODOLOGY.md)
· Pitch guide: [PITCH.md](PITCH.md)*
