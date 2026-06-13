import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getConsent, setConsent, CONSENT_EVENT } from '../utils/cameraConsent';
import './CameraConsentModal.css';

// Paths that make up the child games area (mirrors EmotionProvider).
const GAME_PATHS = new Set([
  '/welcomepage', '/games', '/achievements',
  '/wordpuzzleadventure', '/mathgame', '/quiz', '/syllabletapgame',
  '/shapememorygame', '/letterbridge', '/mirrorword', '/phonemetap',
  '/lettersound', '/confusableletter', '/ran', '/verbalmemory',
  '/reading-fluency', '/sight-words', '/morphology-builder',
]);

/**
 * One-time consent prompt for on-device expression sensing.
 * Shown only when the user is in the games area, signed in, and has not yet
 * made a choice. Privacy-first: declining is the safe default and the feature
 * can be toggled later in Accessibility settings.
 */
export default function CameraConsentModal() {
  const location = useLocation();
  const [choice, setChoice] = useState(getConsent());

  useEffect(() => {
    const onChange = () => setChoice(getConsent());
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  let hasToken = false;
  try { hasToken = !!localStorage.getItem('token'); } catch (_) {}

  const shouldAsk = hasToken && choice == null && GAME_PATHS.has(location.pathname);
  if (!shouldAsk) return null;

  return (
    <div className="cc-overlay" role="dialog" aria-modal="true" aria-labelledby="cc-title">
      <div className="cc-modal">
        <div className="cc-icon" aria-hidden="true">📷✨</div>
        <h2 id="cc-title" className="cc-title">Turn on friendly expression sensing?</h2>
        <p className="cc-body">
          JoyVerse can gently notice when a game feels too hard and adjust to help —
          using your camera to read facial expressions.
        </p>
        <ul className="cc-points">
          <li>🔒 It runs <strong>entirely on this device</strong>.</li>
          <li>🚫 No video or pictures are <strong>ever sent or saved</strong>.</li>
          <li>🎚️ You can turn it on or off anytime in Settings.</li>
        </ul>
        <div className="cc-actions">
          <button className="cc-btn cc-btn--allow" onClick={() => setConsent('granted')}>
            Turn it on
          </button>
          <button className="cc-btn cc-btn--deny" onClick={() => setConsent('denied')}>
            Not now
          </button>
        </div>
        <p className="cc-foot">A parent or teacher can decide this with you.</p>
      </div>
    </div>
  );
}
