import React from 'react';
import successGif from '../assets/successGif.gif';
import failureGif from '../assets/failureGif.gif';
import './FeedbackGif.css';

/**
 * FeedbackGif — a brief, fun GIF that pops up on a correct/incorrect answer.
 *
 * Drop-in and stateless: it renders only while `result` is truthy, so it rides
 * on a game's EXISTING feedback state (which already shows + clears on a timer).
 * It's an overlay with pointer-events: none, so it never blocks gameplay.
 *
 *   <FeedbackGif result={isCorrect ? 'correct' : answered ? 'wrong' : null} />
 */
export default function FeedbackGif({ result }) {
  if (result !== 'correct' && result !== 'wrong') return null;
  const isCorrect = result === 'correct';
  return (
    <div className="feedback-gif-overlay" aria-hidden="true">
      <img
        key={result}
        src={isCorrect ? successGif : failureGif}
        alt=""
        className={`feedback-gif-img feedback-gif-img--${result}`}
      />
    </div>
  );
}
