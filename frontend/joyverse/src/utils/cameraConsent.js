/**
 * Camera / expression-sensing consent.
 *
 * Expression sensing is OFF by default (privacy-first). The webcam only turns
 * on after the user explicitly grants consent, and all processing happens
 * on-device — no video or images are ever uploaded or stored.
 *
 * Stored in localStorage as 'granted' | 'denied' | null (never asked).
 * Changes broadcast a window event so the live <EmotionProvider> can react
 * without a page reload.
 */
const KEY = 'joyverse-emotion-consent';
export const CONSENT_EVENT = 'emotion-consent-changed';

export function getConsent() {
  try {
    return localStorage.getItem(KEY); // 'granted' | 'denied' | null
  } catch {
    return null;
  }
}

export function setConsent(value) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* storage unavailable — still broadcast so the in-memory state updates */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

export function hasConsent() {
  return getConsent() === 'granted';
}
