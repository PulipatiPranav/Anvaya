/**
 * SpeechService — reliable text-to-speech.
 *
 * Strategy (in priority order):
 *   1. SERVER AUDIO (primary): fetch a WAV from the backend `/api/tts` endpoint
 *      (espeak-ng) and play it through an HTML5 <audio> element. This works in
 *      every browser and is immune to the Chromium/Brave-on-Linux bug where
 *      speechSynthesis silently enqueues utterances that never play.
 *   2. WEB SPEECH (fallback): browser speechSynthesis, used only if the server
 *      endpoint is unreachable (e.g. a deploy without espeak-ng). Includes the
 *      resume() + watchdog workarounds for Chromium/Linux.
 *
 * Public API:
 *   init()                       — call once at app startup
 *   isSupported()                — true if any TTS path is available
 *   speak(text, opts)            — opts: { rate, pitch, lang, onEnd, onWord }
 *                                   onWord(index, total) fires per spoken word
 *   stop()                       — stop all playback
 *   isSpeaking()                 — true while audio/synthesis is active
 */

import { API_BASE } from '../config/api';

// ── Module state ───────────────────────────────────────────────────────────────
let _voicesReady   = false;
let _serverTtsOk   = null;   // null = untried, true = works, false = unavailable
let _currentAudio  = null;   // active HTMLAudioElement (server path)
let _wordTimer     = null;   // word-highlight interval (server path)
let _audioUnlocked = false;

const _pendingVoiceCalls = [];

// ── Web Speech voice pre-warm (only matters for the fallback path) ─────────────
function _prewarmVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    _voicesReady = true;
  } else {
    const onReady = () => {
      if (_voicesReady) return;
      _voicesReady = true;
      window.speechSynthesis.onvoiceschanged = null;
      _pendingVoiceCalls.splice(0).forEach(fn => fn());
    };
    window.speechSynthesis.onvoiceschanged = onReady;
    setTimeout(() => { if (!_voicesReady) onReady(); }, 3000);
  }
}

// HTML5 audio autoplay needs a prior user gesture. Unlock on first interaction
// by playing a near-silent clip so later auto-spoken prompts aren't blocked.
function _installAudioUnlock() {
  if (typeof window === 'undefined' || _audioUnlocked) return;
  const unlock = () => {
    if (_audioUnlocked) return;
    _audioUnlocked = true;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}

function _pickVoice(langPrefix) {
  try {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    return (
      voices.find(v => v.lang.startsWith(langPrefix) && !v.localService) ||
      voices.find(v => v.lang.startsWith(langPrefix)) ||
      voices[0]
    );
  } catch (_) {
    return null;
  }
}

function _clearWordTimer() {
  if (_wordTimer) { clearInterval(_wordTimer); _wordTimer = null; }
}

function _stopAll() {
  _clearWordTimer();
  if (_currentAudio) {
    try { _currentAudio.pause(); _currentAudio.onended = null; _currentAudio.onerror = null; _currentAudio.src = ''; } catch (_) {}
    _currentAudio = null;
  }
  try { window.speechSynthesis.cancel(); } catch (_) {}
}

// ── Web Speech fallback ────────────────────────────────────────────────────────
function _speakWebSpeech(cleanText, { rate, pitch, lang, onEnd, onWord }) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) { onEnd?.(); return; }
  const words = cleanText.split(/\s+/);

  const run = () => {
    try { window.speechSynthesis.cancel(); } catch (_) {}
    setTimeout(() => {
      let ended = false;
      let watchdog;
      const done = () => {
        if (ended) return;
        ended = true;
        clearTimeout(watchdog);
        onEnd?.();
      };
      try {
        window.speechSynthesis.resume(); // Chromium/Linux: re-activate suspended engine
        const utt = new SpeechSynthesisUtterance(cleanText);
        utt.rate = rate; utt.pitch = pitch; utt.lang = lang;
        const voice = _pickVoice(lang.slice(0, 2));
        if (voice) utt.voice = voice;
        if (onWord) {
          utt.onboundary = (e) => {
            if (e.name === 'word' || e.charIndex != null) {
              const idx = cleanText.slice(0, e.charIndex).trim().split(/\s+/).length - 1;
              onWord(Math.max(0, Math.min(idx, words.length - 1)), words.length);
            }
          };
        }
        utt.onend = done;
        utt.onerror = (e) => { if (e?.error !== 'interrupted') done(); };
        window.speechSynthesis.speak(utt);
        const estMs = Math.max(words.length * 700, 6000);
        watchdog = setTimeout(() => { try { window.speechSynthesis.cancel(); } catch (_) {} done(); }, estMs);
      } catch (err) {
        done();
      }
    }, 60);
  };

  if (_voicesReady) run();
  else _pendingVoiceCalls.push(run);
}

// ── Server audio (primary) ─────────────────────────────────────────────────────
function _speakServer(cleanText, opts, onServerFail) {
  const { rate, pitch, onEnd, onWord } = opts;
  const words = cleanText.split(/\s+/);

  // Map Web-Speech-style rate (1 = normal) to espeak words-per-minute.
  const wpm   = Math.min(250, Math.max(80, Math.round(150 * rate)));
  const ePitch = Math.min(99, Math.max(0, Math.round(50 * pitch)));
  const url = `${API_BASE}/api/tts?text=${encodeURIComponent(cleanText)}&rate=${wpm}&pitch=${ePitch}`;

  const audio = new Audio();
  audio.src = url;
  _currentAudio = audio;

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    _clearWordTimer();
    if (_currentAudio === audio) _currentAudio = null;
    onEnd?.();
  };

  audio.onerror = () => {
    if (settled) return;
    // Server path failed — remember and fall back to Web Speech.
    _serverTtsOk = false;
    _clearWordTimer();
    if (_currentAudio === audio) _currentAudio = null;
    onServerFail();
  };

  audio.onended = finish;

  audio.onplaying = () => {
    _serverTtsOk = true;
    if (onWord && words.length > 0) {
      _clearWordTimer();
      _wordTimer = setInterval(() => {
        const dur = audio.duration;
        if (!dur || !isFinite(dur)) return;
        const frac = Math.min(1, audio.currentTime / dur);
        const idx = Math.min(words.length - 1, Math.floor(frac * words.length));
        onWord(idx, words.length);
      }, 80);
    }
  };

  audio.play().catch(() => {
    // Autoplay blocked or network error → fall back.
    if (settled) return;
    _serverTtsOk = (_serverTtsOk === true) ? true : false;
    _clearWordTimer();
    if (_currentAudio === audio) _currentAudio = null;
    onServerFail();
  });
}

// ── Public service ─────────────────────────────────────────────────────────────
const SpeechService = {
  init() {
    _prewarmVoices();
    _installAudioUnlock();
  },

  isSupported() {
    return typeof window !== 'undefined' &&
      (typeof Audio !== 'undefined' || 'speechSynthesis' in window);
  },

  /**
   * @param {string} text
   * @param {object} opts
   * @param {number}   opts.rate   — 1 = normal (default 0.85)
   * @param {number}   opts.pitch  — 1 = normal (default 1)
   * @param {string}   opts.lang   — BCP-47 (default 'en-US')
   * @param {function} opts.onEnd  — fires when speech finishes or fails
   * @param {function} opts.onWord — fires (wordIndex, totalWords) as words are spoken
   */
  speak(text, { rate = 0.85, pitch = 1, lang = 'en-US', onEnd, onWord } = {}) {
    if (!this.isSupported() || !text?.toString().trim()) { onEnd?.(); return; }

    const cleanText = String(text).trim();
    _stopAll();

    const opts = { rate, pitch, lang, onEnd, onWord };

    // Prefer server audio unless we already learned it's unavailable.
    if (_serverTtsOk !== false && typeof Audio !== 'undefined') {
      _speakServer(cleanText, opts, () => _speakWebSpeech(cleanText, opts));
    } else {
      _speakWebSpeech(cleanText, opts);
    }
  },

  stop() {
    _stopAll();
  },

  isSpeaking() {
    if (_currentAudio && !_currentAudio.paused) return true;
    try { return window.speechSynthesis.speaking; } catch (_) { return false; }
  },
};

if (typeof window !== 'undefined') {
  _prewarmVoices();
  _installAudioUnlock();
}

export default SpeechService;
