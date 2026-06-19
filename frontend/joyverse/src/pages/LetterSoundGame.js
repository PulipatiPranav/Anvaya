import React, { useState, useEffect, useCallback, useRef } from 'react';
import useFeedbackEffect from '../hooks/useFeedbackEffect';
import './LetterSoundGame.css';
import useEmotionDetection from '../hooks/useEmotionDetection';
import useGameSessionLogger from '../hooks/useGameSessionLogger';
import GameShell from '../components/GameShell';
import FeedbackGif from '../components/FeedbackGif';
import TTSButton from '../components/TTSButton';
import SpeechService from '../services/SpeechService';
import { PHONICS_LEVEL_ORDER, PhonicsLevelMeta } from '../constants/PhonicsLevel';
import axios from 'axios';
import { API_BASE } from '../config/api';

const QUESTIONS_PER_ROUND = 8;

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function LetterSoundGame() {
  const { emotion, confidence, videoRef, canvasRef } = useEmotionDetection();
  const triggerFeedback = useFeedbackEffect();

  const [phonicsLevel, setPhonicsLevel] = useState('CVC');
  const [difficulty,   setDifficulty]   = useState('easy');

  const [questions,  setQuestions]  = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected,   setSelected]   = useState(null);
  const [score,      setScore]      = useState(0);
  const [results,    setResults]    = useState([]);
  const [gameOver,   setGameOver]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [loadError,  setLoadError]  = useState('');

  const questionStartRef = useRef(null);
  const sessionStartRef  = useRef(new Date());
  const username = localStorage.getItem('username');
  const { endSession } = useGameSessionLogger({ username, difficulty, expression: emotion, score, phonicsLevel });

  const loadQuestions = useCallback(async (level, diff) => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({ level, gameType: 'letter_sound', difficulty: diff });
      const res = await fetch(`${API_BASE}/api/phonics?${params}`);
      if (!res.ok) throw new Error('fetch failed');
      const raw = await res.json();

      if (!raw || raw.length === 0) {
        setLoadError('No letter-sound content found for this level. Try a different combination.');
        setQuestions([]);
        setLoading(false);
        return;
      }

      const picked = shuffle(raw).slice(0, QUESTIONS_PER_ROUND);
      setQuestions(picked);
    } catch {
      setLoadError('Could not load game content. Check that the backend is running and the database is seeded.');
      setQuestions([]);
    }
    setCurrentIdx(0);
    setSelected(null);
    setScore(0);
    setResults([]);
    setGameOver(false);
    sessionStartRef.current = new Date();
    setLoading(false);
  }, []);

  useEffect(() => {
    loadQuestions(phonicsLevel, difficulty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phonicsLevel, difficulty]);

  const current = questions[currentIdx];

  useEffect(() => {
    if (current && !selected && !gameOver) {
      questionStartRef.current = Date.now();
      const t = setTimeout(() => {
        SpeechService.speak(current.question, { rate: 0.7 });
      }, 400);
      return () => clearTimeout(t);
    }
  }, [currentIdx, current, selected, gameOver]);

  const handleSelect = (option) => {
    if (selected || gameOver) return;

    const reactionTimeMs = questionStartRef.current
      ? Math.round(Date.now() - questionStartRef.current)
      : 0;

    const correct = option === current.correct;
    const result  = {
      letter:         current.question,
      selectedOption: option,
      correct,
      reactionTimeMs,
    };

    setSelected(option);
    setResults(prev => [...prev, result]);
    triggerFeedback(correct ? 'correct' : 'wrong');

    if (correct) {
      setScore(s => s + 10);
      SpeechService.speak('Correct!', { rate: 1.0 });
    } else {
      SpeechService.speak(`Not quite. The answer is ${current.correct}.`, { rate: 0.85 });
    }

    // Give the spoken feedback time to finish before moving on (longer when
    // incorrect, since that message is longer) — prevents the next question's
    // narration cutting across the feedback.
    const advanceDelay = correct ? 1800 : 2800;
    setTimeout(() => {
      const nextIdx = currentIdx + 1;
      if (nextIdx >= questions.length) {
        finishGame([...results, result]);
      } else {
        setCurrentIdx(nextIdx);
        setSelected(null);
      }
    }, advanceDelay);
  };

  const finishGame = (allResults) => {
    setGameOver(true);
    triggerFeedback('correct');

    const total             = allResults.length;
    const correct           = allResults.filter(r => r.correct).length;
    const overallAccuracy   = total ? Math.round((correct / total) * 100) : 0;
    const avgReactionTimeMs = total
      ? Math.round(allResults.reduce((s, r) => s + r.reactionTimeMs, 0) / total)
      : 0;
    const finalScore  = correct * 10;
    const moodAtStart = localStorage.getItem('selectedEmotion') || 'neutral';

    axios.post(`${API_BASE}/api/letter-sound`, {
      username,
      phonicsLevel,
      difficulty,
      startTime:        sessionStartRef.current.toISOString(),
      endTime:          new Date().toISOString(),
      score:            finalScore,
      questionResults:  allResults,
      overallAccuracy,
      avgReactionTimeMs,
      moodAtStart,
    }).catch(err => console.error('Failed to save letter-sound session:', err));

    endSession();
  };

  const getEmotionStyles = (em) => {
    switch (em) {
      case 'Happy':    return { backgroundColor: '#F8FD89', color: '#333333' };
      case 'Sad':      return { backgroundColor: '#D8FAD2', color: '#3B2F2F' };
      case 'Angry':    return { backgroundColor: '#A5F7E1', color: '#223344' };
      case 'Surprise': return { backgroundColor: '#FFDAB9', color: '#4B0082' };
      default:         return { backgroundColor: '#F9F9F3', color: '#2C2C2C' };
    }
  };
  const cardStyle = getEmotionStyles(emotion);


  if (loading) {
    return (
      <GameShell title="Letter Sound Match" emotion={emotion} confidence={confidence}>
        <div className="lsg-container">
          <div className="lsg-card" style={cardStyle}>
            <p className="lsg-loading">Loading questions…</p>
          </div>
        </div>
        <video  ref={videoRef}  autoPlay style={{ display: 'none' }} />
        <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
      </GameShell>
    );
  }

  if (loadError) {
    return (
      <GameShell title="Letter Sound Match" emotion={emotion} confidence={confidence}>
        <div className="lsg-container">
          <div className="lsg-card" style={cardStyle}>
            <h1 className="lsg-title">Letter Sound Match</h1>
            <p className="lsg-error">{loadError}</p>
          </div>
        </div>
        <video  ref={videoRef}  autoPlay style={{ display: 'none' }} />
        <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
      </GameShell>
    );
  }

  if (gameOver) {
    const total        = results.length;
    const correctCount = results.filter(r => r.correct).length;
    const accuracy     = total ? Math.round((correctCount / total) * 100) : 0;
    const avgRT        = total
      ? Math.round(results.reduce((s, r) => s + r.reactionTimeMs, 0) / total)
      : 0;

    return (
      <GameShell title="Letter Sound Match" emotion={emotion} confidence={confidence}>
        <div className="lsg-container">
          <div className="lsg-card" style={cardStyle}>
            <h1 className="lsg-title">Letter Sound Match</h1>
            <div className="lsg-summary">
              <h2>Round complete! 🎉</h2>
              <p className="lsg-stat">Score: <strong>{score}</strong></p>
              <p className="lsg-stat">Correct: <strong>{correctCount}/{total}</strong></p>
              <p className="lsg-stat">Accuracy: <strong>{accuracy}%</strong></p>
              <p className="lsg-stat">Avg reaction time: <strong>{(avgRT / 1000).toFixed(1)}s</strong></p>
              <div className="lsg-results-list">
                {results.map((r, i) => (
                  <div key={i} className={`lsg-result-row ${r.correct ? 'correct' : 'wrong'}`}>
                    <span className="lsg-result-letter">{r.letter}</span>
                    <span className="lsg-result-detail">
                      {r.correct ? '✅' : `❌ → ${r.selectedOption}`}
                      &nbsp;·&nbsp;{(r.reactionTimeMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                ))}
              </div>
              <button className="lsg-btn lsg-btn--primary" onClick={() => loadQuestions(phonicsLevel, difficulty)}>
                Play Again
              </button>
            </div>
          </div>
        </div>
        <video  ref={videoRef}  autoPlay style={{ display: 'none' }} />
        <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
      </GameShell>
    );
  }

  const shuffledOptions = current ? shuffle(current.options) : [];

  return (
    <GameShell title="Letter Sound Match" emotion={emotion} confidence={confidence}>
      <FeedbackGif result={selected && current ? (selected === current.correct ? 'correct' : 'wrong') : null} />
      <div className="lsg-container">
        <div className="lsg-card" style={cardStyle}>
          <div className="lsg-controls">
            <div className="lsg-select-group">
              <label htmlFor="lsg-level">Phonics Level:</label>
              <select id="lsg-level" value={phonicsLevel} onChange={e => setPhonicsLevel(e.target.value)}>
                {PHONICS_LEVEL_ORDER.map(lv => (
                  <option key={lv} value={lv}>{PhonicsLevelMeta[lv].label}</option>
                ))}
              </select>
            </div>
            <div className="lsg-select-group">
              <label htmlFor="lsg-diff">Difficulty:</label>
              <select id="lsg-diff" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                <option value="easy">🟢 Easy</option>
                <option value="medium">🟡 Medium</option>
                <option value="hard">🔴 Hard</option>
              </select>
            </div>
          </div>

          <div className="lsg-statusbar">
            <span>Question {currentIdx + 1} / {questions.length}</span>
            <span>⭐ {score}</span>
          </div>

          {current && (
            <>
              <div className="lsg-letter-panel">
                <span className="lsg-letter-display">{current.question}</span>
                <button
                  className="lsg-play-btn"
                  onClick={() => SpeechService.speak(current.question, { rate: 0.7 })}
                  aria-label={`Hear the sound of ${current.question}`}
                  title="Play sound again"
                >
                  🔊
                </button>
              </div>
              <div className="lsg-prompt-row">
                <p className="lsg-prompt">Which word starts with this sound?</p>
                <TTSButton
                  text="Which word starts with this sound?"
                  size="sm"
                  label="Read the question aloud"
                />
              </div>

              <div className="lsg-options">
                {shuffledOptions.map(opt => {
                  let cls = 'lsg-option';
                  if (selected) {
                    if (opt === current.correct) cls += ' lsg-option--correct';
                    else if (opt === selected)   cls += ' lsg-option--wrong';
                    else                          cls += ' lsg-option--dimmed';
                  }
                  return (
                    <button
                      key={opt}
                      className={cls}
                      onClick={() => handleSelect(opt)}
                      disabled={!!selected}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
      <video  ref={videoRef}  autoPlay style={{ display: 'none' }} />
      <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
    </GameShell>
  );
}
