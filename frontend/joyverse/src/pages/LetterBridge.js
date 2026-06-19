import React, { useState, useRef, useEffect, useCallback } from 'react';
import LineDrawer from '../components/LineDrawer';
import './LetterBridge.css';
import useEmotionDetection from "../hooks/useEmotionDetection";
import useFeedbackEffect from '../hooks/useFeedbackEffect';
import useGameSessionLogger from "../hooks/useGameSessionLogger";
import TTSButton from "../components/TTSButton";
import GameShell from "../components/GameShell";
import PhonicsContentService from "../services/PhonicsContentService";
import { PHONICS_LEVEL_ORDER, PhonicsLevelMeta } from "../constants/PhonicsLevel";
import { getCardStyle } from '../utils/EmotionThemeMap';

const GAME_DURATION = 60;

const LetterBridge = () => {
  const { emotion, confidence, videoRef, canvasRef } = useEmotionDetection();
  const triggerFeedback = useFeedbackEffect();

  const [phonicsLevel, setPhonicsLevel] = useState('CVC');
  const [difficulty, setDifficulty]     = useState('easy');
  const [letters, setLetters]           = useState([]);
  const [validWords, setValidWords]     = useState([]);
  const [selected, setSelected]         = useState({});
  const [formedWords, setFormedWords]   = useState([]);
  const [positions, setPositions]       = useState([]);
  const [isValid, setIsValid]           = useState(true);
  const [blinkingCols, setBlinkingCols] = useState([]);
  const [score, setScore]               = useState(0);
  const [timeLeft, setTimeLeft]         = useState(GAME_DURATION);
  const [gameOver, setGameOver]         = useState(false);
  const [loading, setLoading]           = useState(false);
  const [loadError, setLoadError]       = useState('');

  const cardStyle = getCardStyle(emotion);

  const wrapperRef  = useRef(null);
  const letterRefs  = useRef({});
  const username    = localStorage.getItem("username");
  const { endSession } = useGameSessionLogger({ username, difficulty, expression: emotion, score, phonicsLevel });

  const initializeGame = useCallback(async (level, diff) => {
    setLoading(true);
    setLoadError('');
    try {
      const sets = await PhonicsContentService.getLetterBridgeSets(level, diff);
      if (!sets || sets.length === 0) {
        setLoadError('No content found for this level and difficulty. Try a different combination.');
        setLetters([]);
        setValidWords([]);
        setLoading(false);
        return;
      }
      const randomSet = sets[Math.floor(Math.random() * sets.length)];
      setLetters(randomSet.letters);
      setValidWords(randomSet.validWords);
    } catch {
      setLoadError('Could not load game content. Check that the backend is running and the database is seeded.');
      setLetters([]);
      setValidWords([]);
    }
    setTimeLeft(GAME_DURATION);
    setScore(0);
    setFormedWords([]);
    setSelected({});
    setGameOver(false);
    setPositions([]);
    setLoading(false);
  }, []);

  useEffect(() => {
    initializeGame(phonicsLevel, difficulty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phonicsLevel, difficulty]);

  useEffect(() => {
    if (timeLeft <= 0) {
      setGameOver(true);
      endSession();
      return;
    }
    const timer = setInterval(() => { setTimeLeft(t => t - 1); }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (Object.keys(selected).length === letters.length && letters.length > 0 && !gameOver) {
      const word = letters.map((_, col) => selected[col]).join('');
      const valid = validWords.includes(word);
      setIsValid(valid);

      if (valid) {
        triggerFeedback('correct');
        setFormedWords(prev => {
          if (!prev.includes(word)) {
            setScore(prevScore => prevScore + 10);
            return [...prev, word];
          }
          return prev;
        });
      } else {
        triggerFeedback('wrong');
        setBlinkingCols(Object.keys(selected).map(Number));
        setTimeout(() => setBlinkingCols([]), 500);
      }
      setTimeout(() => { setSelected({}); setPositions([]); }, 1000);
    }
  }, [selected, gameOver, letters, validWords]);

  useEffect(() => {
    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    const newPositions = [];
    for (let i = 0; i < letters.length; i++) {
      const char = selected[i];
      if (char && letterRefs.current[`${i}-${char}`]) {
        const rect = letterRefs.current[`${i}-${char}`].getBoundingClientRect();
        newPositions.push({
          x: rect.left - wrapperRect.left + rect.width  / 2,
          y: rect.top  - wrapperRect.top  + rect.height / 2,
        });
      }
    }
    setPositions(newPositions);
  }, [selected, letters]);

  const handleSelect = (column, letter) => {
    if (gameOver) return;
    const nextCol = Object.keys(selected).length;
    if (parseInt(column) === nextCol) {
      setSelected(prev => ({ ...prev, [column]: letter }));
    }
  };

  const handleRestart = () => { initializeGame(phonicsLevel, difficulty); };

  return (
    <GameShell title="Letter Bridging" emotion={emotion} confidence={confidence}>
    <div className="game-card" style={cardStyle}>
      <div style={{ textAlign: "center", marginBottom: "10px" }}>
        <p className="game-instructions" style={{ margin: "0 0 8px" }}>
          Tap one letter from each column, left to right, to form a valid word!
        </p>
        <TTSButton
          text="Tap one letter from each column, left to right, to form a valid word!"
          size="sm"
          label="Read instructions aloud"
        />
      </div>

      <div className="game-info-bar">
        <p>⏱️ Time Left: <strong>{timeLeft}s</strong></p>
        <p>⭐ Score: <strong>{score}</strong></p>

        <div className="game-difficulty-select">
          <label htmlFor="phonics-level">Phonics Level:</label>
          <select
            id="phonics-level"
            value={phonicsLevel}
            onChange={e => setPhonicsLevel(e.target.value)}
          >
            {PHONICS_LEVEL_ORDER.map(lv => (
              <option key={lv} value={lv}>{PhonicsLevelMeta[lv].label}</option>
            ))}
          </select>
        </div>

        <div className="game-difficulty-select">
          <label htmlFor="difficulty">Difficulty:</label>
          <select id="difficulty" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
            <option value="easy">🟢 Easy</option>
            <option value="medium">🟡 Medium</option>
            <option value="hard">🔴 Hard</option>
          </select>
        </div>
      </div>

      {loading && <p style={{ textAlign: 'center', padding: '20px' }}>Loading content…</p>}
      {loadError && <p style={{ textAlign: 'center', color: '#c00', padding: '20px' }}>{loadError}</p>}

      {!loading && !loadError && letters.length > 0 && (
        <>
          <div className="game-grid-wrapper" ref={wrapperRef}>
            <div className="game-grid">
              {letters.map((col, colIndex) => (
                <div key={colIndex} className="game-column">
                  {col.map((letter, rowIndex) => {
                    const isSelected = selected[colIndex] === letter;
                    const isBlinking = blinkingCols.includes(colIndex) && isSelected;
                    return (
                      <div
                        key={rowIndex}
                        className={`game-letter ${isSelected ? 'selected' : ''} ${isBlinking ? 'blink-red' : ''}`}
                        onClick={() => handleSelect(colIndex, letter)}
                        ref={el => (letterRefs.current[`${colIndex}-${letter}`] = el)}
                      >
                        {letter}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <LineDrawer positions={positions} isValid={isValid} />
          </div>

          <div className="game-word-list">
            <h3>Words Formed:</h3>
            {formedWords.map((word, idx) => (
              <span key={idx} className="game-word-pill">{word}</span>
            ))}
          </div>

          {gameOver && (
            <div className="game-over">
              <h2>⏰ Time's Up!</h2>
              <p>Your final score: <strong>{score}</strong></p>
              <button className="game-btn" onClick={handleRestart}>Play Again</button>
            </div>
          )}
        </>
      )}

      <video  ref={videoRef}  autoPlay style={{ display: "none" }} />
      <canvas ref={canvasRef} width={640} height={480} style={{ display: "none" }} />
    </div>
    </GameShell>
  );
};

export default LetterBridge;
