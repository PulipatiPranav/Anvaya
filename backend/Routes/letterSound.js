/**
 * /api/letter-sound
 *
 * POST /         — Save a completed session
 * GET  /         — Fetch sessions by username
 * GET  /summary  — Aggregated stats by phonics level
 *
 * Security: requireAuth on all. Children restricted to own username.
 */
import express from 'express';
import LetterSoundSession from '../models/LetterSoundSession.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function resolveUsername(req, res) {
  if (req.user.role === 'child') return req.user.username;
  const u = req.query.username || req.body.username;
  if (!u) { res.status(400).json({ error: 'username is required' }); return null; }
  return u;
}

// GET /api/letter-sound/summary?username=
router.get('/summary', requireAuth, async (req, res) => {
  const username = resolveUsername(req, res);
  if (!username) return;
  try {
    const sessions = await LetterSoundSession.find({ username });
    if (sessions.length === 0) return res.json({ sessions: 0, avgAccuracy: 0, avgReactionTimeMs: 0, byLevel: {} });

    const byLevel = {};
    sessions.forEach(s => {
      const lv = s.phonicsLevel || 'unknown';
      if (!byLevel[lv]) byLevel[lv] = { totalAccuracy: 0, totalReaction: 0, count: 0 };
      byLevel[lv].totalAccuracy += s.overallAccuracy;
      byLevel[lv].totalReaction += s.avgReactionTimeMs;
      byLevel[lv].count += 1;
    });
    Object.keys(byLevel).forEach(lv => {
      byLevel[lv].avgAccuracy       = +(byLevel[lv].totalAccuracy / byLevel[lv].count).toFixed(1);
      byLevel[lv].avgReactionTimeMs = +(byLevel[lv].totalReaction / byLevel[lv].count).toFixed(0);
    });

    const avgAccuracy       = +(sessions.reduce((s, x) => s + x.overallAccuracy,   0) / sessions.length).toFixed(1);
    const avgReactionTimeMs = +(sessions.reduce((s, x) => s + x.avgReactionTimeMs, 0) / sessions.length).toFixed(0);

    res.json({ sessions: sessions.length, avgAccuracy, avgReactionTimeMs, byLevel });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute summary' });
  }
});

// POST /api/letter-sound — save session
router.post('/', requireAuth, async (req, res) => {
  try {
    const data = { ...req.body, username: req.user.username };
    const session = new LetterSoundSession(data);
    await session.save();
    res.status(201).json({ message: 'Letter sound session saved' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/letter-sound?username=
router.get('/', requireAuth, async (req, res) => {
  const username = resolveUsername(req, res);
  if (!username) return;
  try {
    const sessions = await LetterSoundSession.find({ username }).sort({ createdAt: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch letter sound sessions' });
  }
});

export default router;
