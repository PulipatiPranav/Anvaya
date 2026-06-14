# JoyVerse — Architecture

*For developers. How the system is built and why.*

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 5, React Router |
| Styling | Plain CSS with CSS variables (accessibility theming) |
| Backend | Node.js (≥20), Express |
| Database | MongoDB (Mongoose ODM) |
| Auth | JWT (Bearer tokens) + bcrypt password hashing |
| Emotion | MediaPipe Face Landmarker (blendshapes), on-device |
| Speech | Server-side `espeak-ng` → WAV, with browser Web Speech fallback |

There is **no Python / Flask / ML server** — earlier prototypes used a TFLite
emotion model served over Flask; that was abandoned in favour of on-device
inference. The `transformer/` directory contains those abandoned experiments and
is not part of the running application.

## Repository layout

```
Anvaya/
├── backend/                  Express API + MongoDB models
│   ├── app.js                Express app: middleware, route mounting, error handler
│   ├── Routes/               One file per resource (auth, progress, analytics, games…)
│   ├── models/               Mongoose schemas (sessions, content, users)
│   ├── middleware/auth.js    requireAuth / requireRole / requireOwnData (RBAC)
│   ├── utils/                Pure logic (sm2.js, adaptiveDifficulty.js) — unit-tested
│   ├── seeds/seedPhonics.js  Seeds phonics content (idempotent: deleteMany + insertMany)
│   └── test/                 node:test unit tests
├── frontend/joyverse/
│   ├── src/pages/            One component per game + dashboards (lazy-loaded)
│   ├── src/components/        Shared UI (GameShell, modals, TTSButton, ErrorBoundary)
│   ├── src/hooks/             useEmotionDetection (EmotionProvider), session logger…
│   ├── src/services/          SpeechService, PhonicsContentService
│   ├── src/utils/             BlendshapeEmotion, GeometricEmotion, logout, cameraConsent
│   ├── src/context/           AccessibilityContext
│   └── vite.config.js
├── docs/                     This documentation
└── transformer/              Abandoned ML experiments (not used by the app)
```

## Request flow

1. The React app calls the API at `REACT_APP_API_URL` (see `src/config/api.js`).
2. A global Axios interceptor (`src/index.js`) attaches the JWT from
   `localStorage` and redirects to login on a 401.
3. Express applies security middleware, routes the request, and the route uses
   `middleware/auth.js` guards before touching the database.

## Authentication & authorization

- **Roles:** `child`, `therapist`, `superadmin` (encoded in the JWT).
- `requireAuth` — verifies the Bearer token, attaches `req.user`.
- `requireRole(...roles)` — RBAC gate.
- `requireOwnData` — a child may only access their own records; therapists/admins
  may access any. Used by e.g. `/api/progress/:username`.
- `requireTherapistOwnsChild` — a therapist may only act on their own children.
- Passwords are hashed with bcrypt; the login route accepts all bcrypt variants.

## The emotion pipeline (on-device)

- A single **`<EmotionProvider>`** (in `src/hooks/useEmotionDetection.js`) is
  mounted once in `App`, above the routes, so the webcam persists across game
  navigation (no on/off flicker).
- The camera activates only when: signed in **AND** the route is in the games
  area **AND** the user has granted consent (`utils/cameraConsent.js`,
  default off).
- **MediaPipe Face Landmarker** (`@mediapipe/tasks-vision`, dynamically imported
  so it's code-split) runs in `VIDEO` mode and outputs 52 blendshape
  coefficients. `utils/BlendshapeEmotion.js` maps those to an emotion
  probability vector; `utils/GeometricEmotion.js` is a landmark-geometry
  fallback. Both return the identical `{ emotion, probabilities }` shape.
- The hook applies EMA smoothing + hysteresis + a confidence threshold before
  changing the displayed emotion (avoids flicker), and drives the colour theme.
- **Nothing leaves the device** — only model files load from a CDN.

## The progress system

- `GET /api/progress/:username` (`Routes/progress.js`) derives everything from
  **existing** session collections — it writes nothing and adds no collections,
  so it can't affect gameplay.
- It computes per-skill trends (phonics, fluency, rapid naming, working memory),
  baseline→latest deltas, streaks/daily-goal, weekly highlights, and a
  recommended focus.
- Consumed by the child **My Progress** page and the therapist **Growth at a
  glance** panel.

## Adaptive difficulty & spaced repetition

- `utils/adaptiveDifficulty.js` — a pure function: given recent accuracy + a
  frustration score, recommends a level change (non-blocking, dismissible).
- `utils/sm2.js` — the SM-2 spaced-repetition scheduler used by Sight Word Drill.
- Both are unit-tested in `backend/test/`.

## Security middleware (backend `app.js`)

- `helmet` (security headers), `cors` (origin allowlist via `CORS_ORIGINS`),
  `express-rate-limit` (stricter on `/api/auth`), `express.json` body-size limit
  (64 kb), and a custom request-body sanitizer (`stripMongoOperators`) that
  removes Mongo-operator keys (`$…`, `…​.…`) to prevent NoSQL injection — a
  hand-rolled replacement since `express-mongo-sanitize` v2 is incompatible with
  Express 5's read-only `req.query`.
- Global error handler never leaks stack traces outside development.
- `GET /api/health` reports status + DB connectivity for uptime monitors.

## Testing

- **Backend:** `npm test` (node:test) — SM-2, adaptive difficulty, password.
- **Frontend:** `npm test` (Vitest) — GeometricEmotion + BlendshapeEmotion,
  including the "a smile is never read as Angry/Sad" regression guard.

## Build

- Frontend: `npm run build` → static files in `build/` (serve with SPA fallback
  to `index.html`).
- Backend: `node app.js` (or `npm start`), reads config from environment.

See [SETUP.md](SETUP.md) for the step-by-step run & deploy guide.
