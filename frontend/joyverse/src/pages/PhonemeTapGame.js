import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import './PhonemeTapGame.css';
import useEmotionDetection from '../hooks/useEmotionDetection';
import useGameSessionLogger from '../hooks/useGameSessionLogger';
import GameShell from '../components/GameShell';
import FeedbackGif from '../components/FeedbackGif';
import TTSButton from '../components/TTSButton';
import AdaptiveSuggestion from '../components/AdaptiveSuggestion';
import useAdaptiveDifficulty from '../hooks/useAdaptiveDifficulty';
import SpeechService from '../services/SpeechService';
import { PHONICS_LEVEL_ORDER, PhonicsLevelMeta } from '../constants/PhonicsLevel';
import axios from 'axios';
import { API_BASE } from '../config/api';

const WORDS_PER_ROUND = 8;

function calcAccuracy(expected, actual) {
  if (expected === 0) return 0;
  return Math.round((1 - Math.abs(expected - actual) / expected) * 100);
}

export default function PhonemeTapGame() {
  const { emotion, confidence, videoRef, canvasRef } = useEmotionDetection();

  const [phonicsLevel, setPhonicsLevel] = useState('CVC');
  const [difficulty,   setDifficulty]   = useState('easy');

  const [wordList,    setWordList]    = useState([]);
  const [currentIdx,  setCurrentIdx]  = useState(0);
  const [taps,        setTaps]        = useState(0);
  const [submitted,   setSubmitted]   = useState(false);
  const [score,       setScore]       = useState(0);
  const [wordResults, setWordResults] = useState([]);
  const [gameOver,    setGameOver]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [loadError,   setLoadError]   = useState('');
  const [roundsDone,  setRoundsDone]  = useState(0);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  const sessionStartRef = useRef(new Date());
  const username = localStorage.getItem('username');
  const { endSession } = useGameSessionLogger({ username, difficulty, expression: emotion, score, phonicsLevel });

  // Adaptive difficulty: ask the engine for a recommendation once a round ends,
  // re-fetching after each completed round so it reflects the latest performance.
  const recommendation = useAdaptiveDifficulty('phonemetap', difficulty, {
    enabled: gameOver,
    refreshKey: roundsDone,
  });

  const loadWords = useCallback(async (level, diff) => {
    setLoading(true);
    setLoadError('');
    try {
      const fetchAt = async (d) => {
        const params = new URLSearchParams({ level, gameType: 'phoneme_tap' });
        if (d) params.set('difficulty', d);
        const r = await fetch(`${API_BASE}/api/phonics?${params}`);
        if (!r.ok) throw new Error('fetch failed');
        return r.json();
      };

      let raw = await fetchAt(diff);
      // Some levels (e.g. Advanced Patterns) have no content at every difficulty.
      // Fall back to any difficulty for the level rather than showing nothing.
      if (!raw || raw.length === 0) {
        raw = await fetchAt(null);
      }

      if (!raw || raw.length === 0) {
        setLoadError('No phoneme content found for this level. Try a different combination.');
        setWordList([]);
        setLoading(false);
        return;
      }

      const shuffled = [...raw].sort(() => Math.random() - 0.5).slice(0, WORDS_PER_ROUND);
      setWordList(shuffled);
    } catch {
      setLoadError('Could not load game content. Check that the backend is running and the database is seeded.');
      setWordList([]);
    }
    setCurrentIdx(0);
    setTaps(0);
    setSubmitted(false);
    setScore(0);
    setWordResults([]);
    setGameOver(false);
    sessionStartRef.current = new Date();
    setLoading(false);
  }, []);

  useEffect(() => {
    loadWords(phonicsLevel, difficulty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phonicsLevel, difficulty]);

  useEffect(() => {
    const word = wordList[currentIdx]?.word;
    if (word && !submitted && !gameOver) {
      const t = setTimeout(() => SpeechService.speak(word, { rate: 0.75 }), 300);
      return () => clearTimeout(t);
    }
  }, [currentIdx, wordList, submitted, gameOver]);

  const current = wordList[currentIdx];

  const handleTap = () => {
    if (submitted || gameOver) return;
    setTaps(t => t + 1);
  };

  const handleSubmit = () => {
    if (!current || taps === 0) return;
    const expected = current.syllables;
    const correct  = taps === expected;
    const accuracy = calcAccuracy(expected, taps);
    const result   = { word: current.word, expectedPhonemes: expected, actualTaps: taps, correct, accuracy };

    setWordResults(prev => [...prev, result]);
    if (correct) setScore(s => s + 10);
    setSubmitted(true);
  };

  const handleNext = () => {
    const nextIdx = currentIdx + 1;
    if (nextIdx >= wordList.length) {
      const allResults = [...wordResults];
      const finalScore = allResults.reduce((s, r) => s + (r.correct ? 10 : 0), 0);
      const overallAccuracy = allResults.length
        ? Math.round(allResults.reduce((s, r) => s + r.accuracy, 0) / allResults.length)
        : 0;

      setGameOver(true);
      setSuggestionDismissed(false);
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });

      const moodAtStart = localStorage.getItem('selectedEmotion') || 'neutral';
      axios.post(`${API_BASE}/api/phoneme-tap`, {
        username,
        phonicsLevel,
        difficulty,
        startTime:   sessionStartRef.current.toISOString(),
        endTime:     new Date().toISOString(),
        score:       finalScore,
        wordResults: allResults,
        overallAccuracy,
        moodAtStart,
      })
        .catch(err => console.error('Failed to save phoneme tap session:', err))
        // Re-fetch the adaptive recommendation once the new session is persisted.
        .finally(() => setRoundsDone(n => n + 1));

      endSession();
    } else {
      setCurrentIdx(nextIdx);
      setTaps(0);
      setSubmitted(false);
    }
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
      <GameShell title="Phoneme Tap" emotion={emotion} confidence={confidence}>
        <div className="ptg-container">
          <div className="ptg-card" style={cardStyle}>
            <p className="ptg-loading">Loading words…</p>
          </div>
        </div>
        <video  ref={videoRef}  autoPlay style={{ display: 'none' }} />
        <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
      </GameShell>
    );
  }

  if (loadError) {
    return (
      <GameShell title="Phoneme Tap" emotion={emotion} confidence={confidence}>
        <div className="ptg-container">
          <div className="ptg-card" style={cardStyle}>
            <h1 className="ptg-title">Phoneme Tap</h1>
            <p className="ptg-error">{loadError}</p>
          </div>
        </div>
        <video  ref={videoRef}  autoPlay style={{ display: 'none' }} />
        <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
      </GameShell>
    );
  }

  if (gameOver) {
    const total    = wordResults.length;
    const correct  = wordResults.filter(r => r.correct).length;
    const accuracy = total ? Math.round(wordResults.reduce((s, r) => s + r.accuracy, 0) / total) : 0;

    return (
      <GameShell title="Phoneme Tap" emotion={emotion} confidence={confidence}>
        <div className="ptg-container">
          <div className="ptg-card" style={cardStyle}>
            <h1 className="ptg-title">Phoneme Tap</h1>
            <div className="ptg-summary">
              <h2>Round complete! 🎉</h2>
              <p className="ptg-stat">Score: <strong>{score}</strong></p>
              <p className="ptg-stat">Correct: <strong>{correct}/{total}</strong></p>
              <p className="ptg-stat">Accuracy: <strong>{accuracy}%</strong></p>
              <div className="ptg-results-list">
                {wordResults.map((r, i) => (
                  <div key={i} className={`ptg-result-row ${r.correct ? 'correct' : 'wrong'}`}>
                    <span className="ptg-result-word">{r.word}</span>
                    <span className="ptg-result-detail">
                      {r.correct ? '✅' : '❌'} Expected {r.expectedPhonemes} · Tapped {r.actualTaps}
                    </span>
                  </div>
                ))}
              </div>
              {!suggestionDismissed && (
                <AdaptiveSuggestion
                  recommendation={recommendation}
                  onAccept={(level) => { setDifficulty(level); loadWords(phonicsLevel, level); }}
                  onDismiss={() => setSuggestionDismissed(true)}
                />
              )}
              <button className="ptg-btn ptg-btn--primary" onClick={() => loadWords(phonicsLevel, difficulty)}>
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

  const expectedPhonemes = current?.syllables ?? 0;
  const isCorrect        = submitted && taps === expectedPhonemes;
  const isWrong          = submitted && taps !== expectedPhonemes;

  return (
    <GameShell title="Phoneme Tap" emotion={emotion} confidence={confidence}>
      <FeedbackGif result={isCorrect ? 'correct' : isWrong ? 'wrong' : null} />
      <div className="ptg-container">
        <div className="ptg-card" style={cardStyle}>
          <div className="ptg-controls">
            <div className="ptg-select-group">
              <label htmlFor="ptg-level">Phonics Level:</label>
              <select id="ptg-level" value={phonicsLevel} onChange={e => setPhonicsLevel(e.target.value)}>
                {PHONICS_LEVEL_ORDER.map(lv => (
                  <option key={lv} value={lv}>{PhonicsLevelMeta[lv].label}</option>
                ))}
              </select>
            </div>
            <div className="ptg-select-group">
              <label htmlFor="ptg-diff">Difficulty:</label>
              <select id="ptg-diff" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                <option value="easy">🟢 Easy</option>
                <option value="medium">🟡 Medium</option>
                <option value="hard">🔴 Hard</option>
              </select>
            </div>
            <p className="ptg-progress">Word {currentIdx + 1} of {wordList.length}</p>
          </div>

          <div className="ptg-scorebar">
            <span>⭐ Score: {score}</span>
            <span>🎯 {wordResults.length > 0
              ? `${Math.round(wordResults.reduce((s, r) => s + r.accuracy, 0) / wordResults.length)}% accuracy`
              : 'tap each sound'}</span>
          </div>

          {current && (
            <div className="ptg-word-card">
              <div className="ptg-word-row">
                <span className="ptg-word">{current.word}</span>
                <TTSButton text={current.word} size="md" rate={0.75} label={`Hear "${current.word}"`} />
              </div>
              <div className="ptg-instruction-row">
                <p className="ptg-instruction">Listen, then tap once for each sound you hear.</p>
                <TTSButton
                  text="Listen, then tap once for each sound you hear."
                  size="sm"
                  label="Read instructions aloud"
                />
              </div>
            </div>
          )}

          <div className="ptg-circles-row">
            {Array.from({ length: taps }).map((_, i) => (
              <div
                key={i}
                className={`ptg-circle ${isCorrect ? 'ptg-circle--correct' : isWrong ? 'ptg-circle--wrong' : 'ptg-circle--active'}`}
              />
            ))}
            {submitted && isWrong && (
              <span className="ptg-expected-hint">(expected {expectedPhonemes})</span>
            )}
          </div>

          {!submitted && (
            <button className="ptg-tap-btn" onClick={handleTap} aria-label="Tap once per sound">
              TAP
            </button>
          )}

          <div className="ptg-action-row">
            {!submitted && taps > 0 && (
              <button className="ptg-btn ptg-btn--secondary" onClick={handleSubmit}>
                Submit ({taps} tap{taps !== 1 ? 's' : ''})
              </button>
            )}
            {!submitted && taps > 0 && (
              <button className="ptg-btn ptg-btn--ghost" onClick={() => setTaps(0)}>Reset</button>
            )}
            {submitted && (
              <>
                <p className={`ptg-feedback ${isCorrect ? 'ptg-feedback--correct' : 'ptg-feedback--wrong'}`}>
                  {isCorrect
                    ? `✅ Correct! "${current.word}" has ${expectedPhonemes} sounds.`
                    : `❌ "${current.word}" has ${expectedPhonemes} sound${expectedPhonemes !== 1 ? 's' : ''}. You tapped ${taps}.`}
                </p>
                <button className="ptg-btn ptg-btn--primary" onClick={handleNext}>
                  {currentIdx + 1 < wordList.length ? 'Next Word →' : 'See Results'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <video  ref={videoRef}  autoPlay style={{ display: 'none' }} />
      <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
    </GameShell>
  );
}
