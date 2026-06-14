<div align="center">

# 🌈 JoyVerse

### _Literacy games that adapt to the child — and prove they're growing._

**A free, browser-based learning platform for children with dyslexia** — with
adaptive difficulty, on-device (privacy-first) expression sensing, progress
tracking that shows real growth, and a therapist dashboard.

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite)
![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=flat-square&logo=mongodb)

</div>

---

## What is JoyVerse?

A suite of **12 literacy games** covering every core reading-skill domain for
dyslexia — phonics, phonological awareness, fluency, sight words, rapid naming,
morphology, b/d/p/q reversal practice, and working memory — wrapped in the things
that make practice stick:

- **It adapts** to each child (difficulty + optional on-device expression sensing).
- **It proves growth** — per-skill trends, streaks, weekly summaries, and a
  recommended next focus, for both the child and their therapist.
- **It's built for trust** — expression sensing runs **100% on-device, opt-in,
  nothing recorded**; and the whole UI is accessibility-first (OpenDyslexic font,
  adjustable text, reliable text-to-speech).

> **Honest status:** an advanced, pilot-ready prototype. Feature-complete and
> privacy-first, but **not** a diagnostic tool and **not** yet clinically
> validated. See [docs/BUSINESS.md](docs/BUSINESS.md).

## 📚 Documentation

Full docs live in **[`docs/`](docs/README.md)**:

| Doc | For |
|---|---|
| [Overview](docs/OVERVIEW.md) | What it is (no code) |
| [Summary](docs/SUMMARY.md) | One-page reference |
| [Methodology](docs/METHODOLOGY.md) | Pedagogy & clinical thinking |
| [Architecture](docs/ARCHITECTURE.md) | How it's built (developers) |
| [Setup & Deployment](docs/SETUP.md) | Run it / ship it |
| [Business](docs/BUSINESS.md) | Value & positioning |
| [Pitch guide](docs/PITCH.md) | Approaching institutions (with templates) |

## 🚀 Quick start

```bash
# Backend
cd backend && npm install
cp .env.example .env          # set MONGO_URI, JWT_SECRET, CORS_ORIGINS
node --env-file=.env seeds/seedPhonics.js     # seed content (once)
node --env-file=.env app.js                   # → http://localhost:4000

# Frontend (new terminal)
cd frontend/joyverse && npm install
cp .env.example .env
npm start                                      # → http://localhost:3000
```

Requires **Node ≥ 20**, **MongoDB**, and (for server-side voice) **espeak-ng**.
Full guide: [docs/SETUP.md](docs/SETUP.md).

## 🧱 Tech stack

**Frontend:** React 19 · Vite 5 · React Router · MediaPipe Face Landmarker (on-device)
**Backend:** Node ≥20 · Express · MongoDB/Mongoose · JWT + bcrypt
**Speech:** espeak-ng (server) with browser Web Speech fallback

There is **no ML server** — facial expression sensing runs entirely in the
browser via MediaPipe blendshapes; no video or images ever leave the device.

## 🔒 Privacy & safety

- Expression sensing is **off by default**, opt-in, and processed **on-device**.
- Auth via JWT with role-based access (child / therapist / superadmin); children
  can only access their own data.
- Security middleware: Helmet, CORS allowlist, rate limiting, body-size limits,
  NoSQL-injection sanitisation.

## 🧪 Tests

```bash
cd backend && npm test            # node:test — SM-2, adaptive difficulty, auth
cd frontend/joyverse && npm test  # Vitest — emotion classifiers + regression guards
```

## License & contact

Built to help children with dyslexia learn — and to learn from real use.
Contact: **anvayasupport@gmail.com**
