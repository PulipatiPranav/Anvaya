/**
 * /api/emotion
 *
 * POST /predict — Proxy landmark data to Flask TFLite inference server
 *
 * Security:
 *  • requireAuth — must be logged-in child or therapist
 *  • Body contains facial landmark coordinates (floats), NOT images
 *  • No landmark data is persisted; only the returned emotion label is used
 */
import express from 'express';
import axios from 'axios';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const FLASK_URL = process.env.FLASK_EMOTION_URL || 'http://127.0.0.1:5000/predict';

router.post('/predict', requireAuth, async (req, res) => {
  try {
    const response = await axios.post(FLASK_URL, req.body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    });
    res.status(200).json(response.data);
  } catch (error) {
    // Don't log req.body — it contains facial landmark coordinates
    console.error('[emotion] Flask proxy error:', error.message);
    res.status(500).json({ error: 'Emotion detection failed' });
  }
});

export default router;
