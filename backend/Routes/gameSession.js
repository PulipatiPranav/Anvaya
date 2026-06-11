/**
 * /api/sessions
 *
 * POST / — Save a completed game session
 * GET  / — Fetch sessions (child: own only; therapist: by username query)
 *
 * Security:
 *  • requireAuth on all endpoints
 *  • POST: username is taken from JWT — body username is ignored
 *  • GET:  children are restricted to their own username
 *  • Removed PII console.log of request body
 */
import express from 'express';
import mongoose from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

const expressionSchema = new mongoose.Schema({
  expression: { type: String, required: true },
  timestamp:  { type: Date,   required: true },
});

const gameSessionSchema = new mongoose.Schema({
  username:     { type: String, required: true },
  difficulty:   { type: String, enum: ['easy', 'medium', 'hard'], required: true },
  startTime:    { type: Date,   required: true },
  endTime:      { type: Date,   required: true },
  gameName:     { type: String, required: true },
  expressions:  [expressionSchema],
  score:        { type: Number, required: true },
  moodAtStart:  { type: String, default: null },
  phonicsLevel: { type: String, default: null },
});

const GameSession = mongoose.models.GameSession || mongoose.model('GameSession', gameSessionSchema);

// POST /api/sessions — save a new session
router.post('/', requireAuth, async (req, res) => {
  try {
    const { difficulty, startTime, endTime, expressions, gameName, score, moodAtStart, phonicsLevel } = req.body;

    // Username always comes from the authenticated JWT — never trust body
    const username = req.user.username;

    const session = new GameSession({
      username,
      difficulty,
      startTime,
      endTime,
      expressions,
      gameName,
      score,
      moodAtStart:  moodAtStart  || null,
      phonicsLevel: phonicsLevel || null,
    });

    await session.save();
    res.status(201).json({ message: 'Session saved successfully' });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: 'Invalid session data', details: Object.keys(err.errors) });
    }
    console.error('[sessions] Save error:', err.message);
    res.status(500).json({ error: 'Failed to save session' });
  }
});

// GET /api/sessions?username= — fetch sessions
router.get('/', requireAuth, async (req, res) => {
  try {
    let { username } = req.query;

    if (req.user.role === 'child') {
      // Children can only see their own sessions
      username = req.user.username;
    } else if (!username) {
      return res.status(400).json({ error: 'username query parameter is required' });
    }

    const sessions = await GameSession.find({ username }).sort({ createdAt: -1 });
    res.json(sessions);
  } catch (err) {
    console.error('[sessions] Fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

export default router;
