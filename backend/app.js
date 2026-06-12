import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
dotenv.config();

// ── Route imports ────────────────────────────────────────────────────────────
import authRoutes            from './Routes/auth.js';
import childRoutes           from './Routes/child.js';
import gameSessionRoutes     from './Routes/gameSession.js';
import quizRoutes            from './Routes/quiz.js';
import wordQuestionsRoutes   from './Routes/wordQuestions.js';
import syllableRoutes        from './Routes/syllableGame.js';
import mirrorQuestionRoutes  from './Routes/mirrorQuestion.js';
import superadminRoutes      from './Routes/superadmin.js';
import emotionRoutes         from './Routes/emotion.js';
import phonicsContentRoutes  from './Routes/phonicsContent.js';
import phonemeTapRoutes      from './Routes/phonemeTap.js';
import letterSoundRoutes     from './Routes/letterSound.js';
import confusableLetterRoutes from './Routes/confusableLetter.js';
import ranRoutes             from './Routes/ran.js';
import verbalMemoryRoutes    from './Routes/verbalMemory.js';
import assignedSessionsRoutes from './Routes/assignedSessions.js';
import readingProgressRoutes  from './Routes/readingProgress.js';
import adaptationLogRoutes    from './Routes/adaptationLog.js';
import analyticsRoutes        from './Routes/analytics.js';
import reportsRoutes          from './Routes/reports.js';

// ── Startup guard ────────────────────────────────────────────────────────────
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('[FATAL] JWT_SECRET is missing or too short (min 32 chars). Set it in .env and restart.');
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.error('[FATAL] MONGO_URI is missing. Set it in .env and restart.');
  process.exit(1);
}

// ── MongoDB ──────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000,  // fail fast if Atlas unreachable at startup
  heartbeatFrequencyMS:     10000,  // ping Atlas every 10 s to keep the connection alive
  socketTimeoutMS:          45000,  // close sockets idle for 45 s
})
  .then(() => console.log('[db] Connected to MongoDB'))
  .catch((err) => { console.error('[db] Connection error:', err.message); process.exit(1); });

mongoose.connection.on('disconnected', () => console.warn('[db] MongoDB disconnected — attempting reconnect'));
mongoose.connection.on('reconnected',  () => console.log('[db] MongoDB reconnected'));

const app = express();

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow webcam iframe in some browsers
}));

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (Postman, curl, same-origin) in dev
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ── Body parsing ─────────────────────────────────────────────────────────────
// Limit body size — prevents large payload attacks.
// Landmark arrays are ~956 floats ≈ 8 KB. 64 KB is generous.
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

// ── NoSQL injection sanitization ──────────────────────────────────────────────
// express-mongo-sanitize v2 is incompatible with Express 5 (req.query is a
// read-only getter in Express 5; the package tries to set it and throws).
// This replaces it: recursively strip keys starting with '$' or containing '.'
// from req.body only (req.query values are plain strings — not operator objects).
function stripMongoOperators(value) {
  if (Array.isArray(value)) return value.map(stripMongoOperators);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !k.startsWith('$') && !k.includes('.'))
        .map(([k, v]) => [k, stripMongoOperators(v)])
    );
  }
  return value;
}
app.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = stripMongoOperators(req.body);
  }
  next();
});

// ── Rate limiting ─────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 20,                   // 20 login attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
  skipSuccessfulRequests: true, // Only count failures
});

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1-minute window
  max: 300,                 // 300 requests per IP per minute (generous for games)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

app.use(generalLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────

// Public — no auth required
app.use('/api/auth',           loginLimiter, authRoutes);

// Educational content — public read-only
app.use('/api/phonics',             phonicsContentRoutes);
app.use('/api/wordQuestions',       wordQuestionsRoutes);
app.use('/api/syllable-game',       syllableRoutes);
app.use('/api/mirrorquestions',     mirrorQuestionRoutes);
app.use('/api',                     quizRoutes); // GET /api/questions

// Emotion detection proxy — auth-gated (requires child or therapist JWT)
app.use('/api/emotion',             emotionRoutes);

// Game data — auth-gated (see individual routes)
app.use('/api/sessions',            gameSessionRoutes);
app.use('/api/phoneme-tap',         phonemeTapRoutes);
app.use('/api/letter-sound',        letterSoundRoutes);
app.use('/api/confusable-letter',   confusableLetterRoutes);
app.use('/api/ran',                 ranRoutes);
app.use('/api/verbal-memory',       verbalMemoryRoutes);
app.use('/api/adaptation-log',      adaptationLogRoutes);
app.use('/api/assigned-sessions',   assignedSessionsRoutes);

// Therapist / clinical data — auth-gated (see individual routes)
app.use('/api/reading-progress',    readingProgressRoutes);
app.use('/api/analytics',           analyticsRoutes);
app.use('/api/reports',             reportsRoutes);
app.use('/api/children',            childRoutes);

// Admin — auth-gated (see individual routes)
app.use('/api/superadmin',          superadminRoutes);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  // Never leak stack traces or internal details in production
  if (process.env.NODE_ENV !== 'development') {
    console.error('[error]', err.message);
    return res.status(err.status || 500).json({ error: 'Internal server error' });
  }
  console.error('[error]', err);
  return res.status(err.status || 500).json({ error: err.message });
});

app.listen(4000, () => console.log('[server] Running on port 4000'));
