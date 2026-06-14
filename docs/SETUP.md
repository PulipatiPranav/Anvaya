# JoyVerse — Setup & Deployment

## Prerequisites

- **Node.js ≥ 20**
- **MongoDB** — local (`mongod`) or a cloud URI (MongoDB Atlas)
- **espeak-ng** — for server-side text-to-speech (optional; without it, TTS falls
  back to the browser's Web Speech API)
  - Debian/Ubuntu: `sudo apt install espeak-ng`
  - Fedora: `sudo dnf install espeak-ng`
  - macOS: `brew install espeak-ng`

---

## Local development

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — set MONGO_URI, JWT_SECRET (32+ random chars), CORS_ORIGINS
```

Generate a strong JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Seed the database (once — idempotent, safe to re-run):
```bash
node --env-file=.env seeds/seedPhonics.js
```

Start the API:
```bash
node --env-file=.env app.js     # http://localhost:4000
# or: npm run dev   (auto-restart on change; needs env loaded)
```

### 2. Frontend

```bash
cd frontend/joyverse
npm install
cp .env.example .env             # REACT_APP_API_URL defaults to http://localhost:4000
npm start                        # Vite dev server → http://localhost:3000
```

Open **http://localhost:3000**.

### 3. Verify

```bash
curl http://localhost:4000/api/health     # {"status":"ok","db":"connected",...}
```

---

## Environment variables

### Backend (`backend/.env`)
| Var | Required | Notes |
|---|---|---|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | 32+ random chars |
| `JWT_EXPIRES_IN` | – | e.g. `8h` |
| `CORS_ORIGINS` | ✅ (prod) | Comma-separated frontend URL(s) |
| `NODE_ENV` | – | `production` when deploying |
| `PORT` | – | Defaults to 4000; most hosts inject this |

### Frontend (`frontend/joyverse/.env`, build-time)
| Var | Required | Notes |
|---|---|---|
| `REACT_APP_API_URL` | ✅ (prod) | Base URL of the deployed backend, no trailing slash |

---

## Production deployment

JoyVerse is a standard two-part web app: a **static frontend** and a **Node API**
talking to **MongoDB**. It deploys cleanly on most platforms (Render, Railway,
Fly.io, a VPS, etc.). The pattern is the same everywhere:

### Backend
1. Provision MongoDB (Atlas free tier is fine to start).
2. Set env vars: `MONGO_URI`, `JWT_SECRET`, `CORS_ORIGINS=https://your-frontend`,
   `NODE_ENV=production`. (`PORT` is usually injected by the host.)
3. Install `espeak-ng` on the host (for server TTS). On a VPS: the package above.
   On a container: add it to your image. Without it, TTS still works via the
   browser fallback.
4. Run the seed once against the production DB:
   `node --env-file=.env seeds/seedPhonics.js`
5. Start: `node app.js` (or `npm start`).
6. Point your uptime monitor at `GET /api/health`.

### Frontend
1. Build with the API URL baked in:
   ```bash
   REACT_APP_API_URL=https://your-backend-domain npm run build
   ```
2. Serve the `build/` directory as static files **with SPA fallback** — every
   unknown path must return `index.html` (React Router uses client-side routing).
   Most static hosts have a one-line "rewrite all to /index.html" setting.

### Notes & gotchas
- **CORS:** `CORS_ORIGINS` must exactly match the frontend's origin (scheme +
  host, no trailing slash), or the browser will block API calls.
- **MediaPipe:** Face Landmarker model files load from a CDN at runtime, so the
  deployed app needs outbound internet for expression sensing. (Everything else
  works offline-of-CDN; emotion just won't activate.)
- **HTTPS is required for the webcam.** Browsers only allow `getUserMedia` on
  secure origins (https) or `localhost`. Any real deployment must be HTTPS.
- **File permissions:** keep `.env` at `chmod 600` on the server.

---

## Dependency security

Run `npm audit` in each package. Known residuals (safe to leave):
- **Backend:** a few `tar`/`node-pre-gyp` advisories are transitive build-time
  deps of `bcrypt` (used only during `npm install`, never on the request path).
  Fixing requires a breaking bcrypt major bump that risks existing hashes.
- **Frontend:** residual advisories are in `vite`/`esbuild`/`vitest` — dev/build
  tooling that does **not** ship in the production bundle.

Run the **non-breaking** `npm audit fix` freely; avoid `npm audit fix --force`
unless you re-verify the build and tests afterward.
