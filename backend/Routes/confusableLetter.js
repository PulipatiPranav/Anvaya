/**
 * /api/confusable-letter
 *
 * GET  /content   — Game content (public — needed before login for game setup)
 * GET  /summary   — Aggregated pair accuracy
 * POST /          — Save session
 * GET  /          — Fetch sessions by username
 *
 * Security: POST and GET / and GET /summary require auth. GET /content is public.
 * Children restricted to own username.
 */
import express from 'express';
import ConfusableContent from '../models/ConfusableContent.js';
import ConfusableSession from '../models/ConfusableSession.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function resolveUsername(req, res) {
  if (req.user.role === 'child') return req.user.username;
  const u = req.query.username || req.body.username;
  if (!u) { res.status(400).json({ error: 'username required' }); return null; }
  return u;
}

// GET /api/confusable-letter/summary?username= — must be before GET /
router.get('/summary', requireAuth, async (req, res) => {
  const username = resolveUsername(req, res);
  if (!username) return;
  try {
    const sessions = await ConfusableSession.find({ username });
    if (!sessions.length) return res.json({ sessions: 0, avgAccuracy: 0, pairAccuracy: {} });

    const avgAccuracy = Math.round(
      sessions.reduce((s, x) => s + (x.overallAccuracy || 0), 0) / sessions.length
    );

    const pairTotals = {};
    sessions.forEach(s => {
      if (s.pairAccuracy) {
        for (const [pair, acc] of s.pairAccuracy) {
          if (!pairTotals[pair]) pairTotals[pair] = [];
          pairTotals[pair].push(acc);
        }
      }
    });
    const pairAccuracy = {};
    for (const [pair, vals] of Object.entries(pairTotals)) {
      pairAccuracy[pair] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }

    res.json({ sessions: sessions.length, avgAccuracy, pairAccuracy });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/confusable-letter/content?pair=bd&type=letter_id&difficulty=easy — public
router.get('/content', async (req, res) => {
  const { pair, type, difficulty } = req.query;
  const filter = {};
  if (pair)       filter.pair = pair;
  if (type)       filter.type = type;
  if (difficulty) filter.difficulty = difficulty;
  try {
    const docs = await ConfusableContent.find(filter);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/confusable-letter — save session
router.post('/', requireAuth, async (req, res) => {
  try {
    const data = { ...req.body, username: req.user.username };
    const session = new ConfusableSession(data);
    await session.save();
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save session' });
  }
});

// GET /api/confusable-letter?username=
router.get('/', requireAuth, async (req, res) => {
  const username = resolveUsername(req, res);
  if (!username) return;
  try {
    const sessions = await ConfusableSession.find({ username }).sort({ createdAt: -1 }).limit(20);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
