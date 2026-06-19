import { useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';

// Shared canvas so multiple rapid calls don't stack canvases in the DOM.
let _canvas = null;
let _confetti = null;

function getConfettiInstance() {
  if (_confetti) return _confetti;
  _canvas = document.createElement('canvas');
  Object.assign(_canvas.style, {
    position: 'fixed', inset: '0',
    width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '9999',
  });
  document.body.appendChild(_canvas);
  _confetti = confetti.create(_canvas, { resize: true, useWorker: true });
  return _confetti;
}

// Precompute the ❌ emoji as a confetti shape once.
const WRONG_SHAPE = confetti.shapeFromText({ text: '❌', scalar: 2 });

/**
 * useFeedbackEffect — fires a canvas-confetti burst on correct/wrong answers.
 *
 * Usage:
 *   const triggerFeedback = useFeedbackEffect();
 *   triggerFeedback('correct');   // rainbow confetti burst
 *   triggerFeedback('wrong');     // falling ❌ particles
 *
 * Respects prefers-reduced-motion by skipping the animation silently.
 */
export default function useFeedbackEffect() {
  const reduceMotion = useRef(
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  const trigger = useCallback((result) => {
    if (reduceMotion.current) return;
    if (result !== 'correct' && result !== 'wrong') return;

    const fire = getConfettiInstance();

    if (result === 'correct') {
      // Three-cannon burst: left, right, and center top — fills the whole screen.
      fire({
        particleCount: 120,
        angle: 60,
        spread: 70,
        origin: { x: 0, y: 1 },
        colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff'],
        scalar: 1.4,
        gravity: 0.8,
        ticks: 300,
        startVelocity: 55,
      });
      fire({
        particleCount: 120,
        angle: 120,
        spread: 70,
        origin: { x: 1, y: 1 },
        colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff'],
        scalar: 1.4,
        gravity: 0.8,
        ticks: 300,
        startVelocity: 55,
      });
      fire({
        particleCount: 60,
        angle: 90,
        spread: 100,
        origin: { x: 0.5, y: 1 },
        colors: ['#ffffff', '#ffd93d', '#6bcb77'],
        scalar: 1.2,
        gravity: 0.7,
        ticks: 260,
        startVelocity: 65,
      });
    } else {
      // Staggered rain — 6 waves fired 90ms apart so Xs appear at different
      // vertical positions, like actual raindrops rather than one simultaneous burst.
      const xs = [0.05, 0.15, 0.27, 0.38, 0.5, 0.62, 0.73, 0.85, 0.95];
      const WAVES = 6;
      for (let wave = 0; wave < WAVES; wave++) {
        setTimeout(() => {
          // Each wave picks a random subset of columns so no two waves look identical.
          xs.filter(() => Math.random() > 0.45).forEach(x => {
            fire({
              particleCount: 1,
              angle: 270,
              spread: 8,
              origin: { x, y: 0 },
              shapes: [WRONG_SHAPE],
              scalar: 2.6,
              gravity: 1.6,
              startVelocity: 12 + Math.random() * 6,
              drift: (Math.random() - 0.5) * 0.4,
              ticks: 240,
              colors: ['#ff2d2d'],
            });
          });
        }, wave * 90);
      }
    }
  }, []);

  return trigger;
}
