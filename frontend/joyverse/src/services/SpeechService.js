/**
 * SpeechService — thin wrapper around the browser Web Speech API.
 *
 * Fixes:
 *  1. Chrome cancel+speak race: 50 ms delay after cancel().
 *  2. Async voice loading: waits for voiceschanged, with a 2 s hard fallback
 *     so the button never stays permanently silent (critical on Linux/Firefox
 *     where voiceschanged may fire late or not at all with speech-dispatcher).
 *  3. Voice selection: prefers a non-local English voice, falls back to any
 *     English voice, then any voice.
 */

let _voicesReady = false;
let _voiceLoadCallbacks = [];

function _flushCallbacks() {
  _voicesReady = true;
  _voiceLoadCallbacks.forEach(fn => fn());
  _voiceLoadCallbacks = [];
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    _voicesReady = true;
  } else {
    // Primary: event-driven
    window.speechSynthesis.addEventListener('voiceschanged', _flushCallbacks, { once: true });
    // Fallback: force-ready after 2 s so TTS is never permanently blocked
    setTimeout(() => {
      if (!_voicesReady) _flushCallbacks();
    }, 2000);
  }
}

function _pickVoice(lang) {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(v => v.lang.startsWith(lang) && !v.localService) ||
    voices.find(v => v.lang.startsWith(lang)) ||
    voices[0] ||
    null
  );
}

const SpeechService = {
  isSupported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  },

  speak(text, { rate = 0.85, pitch = 1, lang = 'en-US', onEnd } = {}) {
    if (!this.isSupported() || !text) return;
    window.speechSynthesis.cancel();

    const _doSpeak = () => {
      const utterance    = new SpeechSynthesisUtterance(text);
      utterance.rate     = rate;
      utterance.pitch    = pitch;
      utterance.lang     = lang;
      const voice        = _pickVoice(lang.slice(0, 2));
      if (voice) utterance.voice = voice;
      if (onEnd) utterance.onend = onEnd;
      window.speechSynthesis.speak(utterance);
    };

    // 50 ms delay ensures Chrome's async cancel() completes before we enqueue
    if (_voicesReady) {
      setTimeout(_doSpeak, 50);
    } else {
      _voiceLoadCallbacks.push(() => setTimeout(_doSpeak, 50));
    }
  },

  stop() {
    if (!this.isSupported()) return;
    window.speechSynthesis.cancel();
  },

  isSpeaking() {
    if (!this.isSupported()) return false;
    return window.speechSynthesis.speaking;
  },
};

export default SpeechService;
