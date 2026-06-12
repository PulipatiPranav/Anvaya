import React from 'react';
import { useNavigate } from 'react-router-dom';
import './GameShell.css';

const EMOTION_EMOJI = {
  Happy:   '😄',
  Sad:     '😢',
  Angry:   '😠',
  Surprise:'😲',
  Neutral: '😊',
};

/**
 * GameShell — unified page wrapper for every game.
 *
 * Props:
 *   title     {string}  Game title shown in the nav bar.
 *   emotion   {string}  Current detected emotion label (optional).
 *   confidence{number}  Emotion confidence 0–1 (optional).
 *   children  {node}    Game content — rendered inside .game-shell__content.
 */
export default function GameShell({ title, emotion, confidence, children }) {
  const navigate = useNavigate();

  return (
    <div className="game-shell">
      <nav className="game-shell__nav">
        <button
          className="game-shell__back"
          onClick={() => navigate('/games')}
          aria-label="Back to games list"
        >
          ← Games
        </button>

        {title && <h1 className="game-shell__title">{title}</h1>}

        {emotion ? (
          <span className="game-shell__emotion-badge" title={`Detected emotion: ${emotion}`}>
            {EMOTION_EMOJI[emotion] ?? '🎮'} {emotion}
            {confidence > 0 && (
              <small>{Math.round(confidence * 100)}%</small>
            )}
          </span>
        ) : (
          <span style={{ width: 80 }} />
        )}
      </nav>

      <main className="game-shell__content">
        {children}
      </main>
    </div>
  );
}
