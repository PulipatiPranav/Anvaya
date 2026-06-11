/**
 * /api/verbal-memory
 *
 * GET  /summary  — Aggregated working memory stats
 * POST /         — Save session
 * GET  /         — Fetch sessions by username
 *
 * Security: requireAuth on all. Children restricted to own username.
 */
import express from 'express';
import VerbalMemorySession from '../models/VerbalMemorySession.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function resolveUsername(req, res) {
  if (req.user.role === 'child') return req.user.username;
  const u = req.query.username || req.body.username;
  if (!u) { res.status(400).json({ error: 'username required' }); return null; }
  return u;
}

// GET /api/verbal-memory/summary?username= — before GET /
router.get('/summary', requireAuth, async (req, res) => {
  const username = resolveUsername(req, res);
  if (!username) return;
  try {
    const sessions = await VerbalMemorySession.find({ username }).sort({ createdAt: 1 });
    if (!sessions.length)
      return res.json({ sessions: 0, avgAccuracy: 0, avgWMS: 0, peakSequenceLength: 0, longitudinal: [] });

    const avgAccuracy = Math.round(
      sessions.reduce((s, x) => s + (x.overallAccuracy || 0), 0) / sessions.length
    );
    const avgWMS = Math.round(
      sessions.reduce((s, x) => s + (x.workingMemoryScore || 0), 0) / sessions.length
    );
    const peakSequenceLength = Math.max(...sessions.map(s => s.maxSequenceLength || 0));

    const longitudinal = sessions.map(s => ({
      date:               s.createdAt,
      mode:               s.mode,
      difficulty:         s.difficulty,
      maxSequenceLength:  s.maxSequenceLength,
      overallAccuracy:    s.overallAccuracy,
      workingMemoryScore: s.workingMemoryScore,
    }));

    res.json({ sessions: sessions.length, avgAccuracy, avgWMS, peakSequenceLength, longitudinal });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/verbal-memory — save session
router.post('/', requireAuth, async (req, res) => {
  try {
    const data = { ...req.body, username: req.user.username };
    const session = new VerbalMemorySession(data);
    await session.save();
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save session' });
  }
});

// GET /api/verbal-memory?username=
router.get('/', requireAuth, async (req, res) => {
  const username = resolveUsername(req, res);
  if (!username) return;
  try {
    const sessions = await VerbalMemorySession.find({ username }).sort({ createdAt: -1 }).limit(20);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
