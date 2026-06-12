/**
 * /api/tts — Server-side text-to-speech via espeak-ng.
 *
 * Why this exists:
 *   The browser Web Speech API (speechSynthesis) is unreliable on Linux/Chromium
 *   (Brave, Chrome) — it silently enqueues utterances that never play. This route
 *   synthesizes audio server-side with espeak-ng and streams a WAV that the
 *   frontend plays via a plain HTML5 <audio> element, which works in every browser.
 *
 * GET /api/tts?text=...&rate=...&pitch=...
 *   text  — words to speak (capped at 500 chars; UI strings only, never user data)
 *   rate  — words per minute, 80–250 (default 150)
 *   pitch — 0–99 (default 50)
 *
 * Security / privacy:
 *   • No auth: an <audio> src request cannot carry the JWT header. Input is capped
 *     and only ever contains non-sensitive UI text (game instructions, words).
 *   • The spoken text is NEVER logged (no facial/biometric/PII concern, but we keep
 *     logs clean per project policy).
 *   • espeak-ng is spawned with an argv array (no shell) → no command injection.
 */
import express from 'express';
import { spawn } from 'child_process';

const router = express.Router();

// Cache the availability check so we don't probe espeak-ng on every request.
let _espeakAvailable = null;

function checkEspeak() {
  return new Promise((resolve) => {
    if (_espeakAvailable !== null) return resolve(_espeakAvailable);
    const probe = spawn('espeak-ng', ['--version']);
    probe.on('error', () => { _espeakAvailable = false; resolve(false); });
    probe.on('close', (code) => { _espeakAvailable = code === 0; resolve(_espeakAvailable); });
  });
}

router.get('/', async (req, res) => {
  const available = await checkEspeak();
  if (!available) {
    // Frontend falls back to the browser Web Speech API on 503.
    return res.status(503).json({ error: 'Server TTS unavailable' });
  }

  const text = String(req.query.text || '').slice(0, 500).trim();
  if (!text) {
    return res.status(400).json({ error: 'Missing text' });
  }

  const rate  = Math.min(250, Math.max(80, parseInt(req.query.rate, 10)  || 150));
  const pitch = Math.min(99,  Math.max(0,  parseInt(req.query.pitch, 10) || 50));

  // argv array — text passed as a single argument, no shell interpolation.
  const args = [
    '-s', String(rate),
    '-p', String(pitch),
    '-v', 'en-us+f3',   // clearer female-ish voice, gentler for children
    '--stdout',
    text,
  ];

  const proc = spawn('espeak-ng', args);

  res.set('Content-Type', 'audio/wav');
  res.set('Cache-Control', 'no-store');

  proc.on('error', () => {
    _espeakAvailable = false;
    if (!res.headersSent) res.status(503).json({ error: 'TTS failed' });
  });

  // Discard espeak-ng stderr (phoneme warnings, etc.) — never log the text.
  proc.stderr.resume();

  proc.stdout.pipe(res);

  // If the client disconnects mid-stream, kill the synth process.
  res.on('close', () => { try { proc.kill('SIGKILL'); } catch (_) {} });
});

export default router;
