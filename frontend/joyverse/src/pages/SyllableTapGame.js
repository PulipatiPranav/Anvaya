import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './SyllableTapGame.css';
import useEmotionDetection from "../hooks/useEmotionDetection";
import useGameSessionLogger from "../hooks/useGameSessionLogger";
import TTSButton from "../components/TTSButton";
import GameShell from "../components/GameShell";
import { API_BASE } from '../config/api';
// const hardcodedWords = {
//   easy: [
//     { word: 'cat', syllables: 1, split: ['cat'] },
//     { word: 'apple', syllables: 2, split: ['ap', 'ple'] },
//     { word: 'banana', syllables: 3, split: ['ba', 'na', 'na'] },
//     { word: 'dog', syllables: 1, split: ['dog'] },
//     { word: 'cookie', syllables: 2, split: ['cook', 'ie'] }
//   ],
//   medium: [
//     { word: 'elephant', syllables: 3, split: ['el', 'e', 'phant'] },
//     { word: 'computer', syllables: 3, split: ['com', 'pu', 'ter'] },
//     { word: 'umbrella', syllables: 3, split: ['um', 'brel', 'la'] },
//     { word: 'giraffe', syllables: 2, split: ['gi', 'raffe'] },
//     { word: 'vacation', syllables: 3, split: ['va', 'ca', 'tion'] }
//   ],
//   hard: [
//     { word: 'helicopter', syllables: 4, split: ['hel', 'i', 'cop', 'ter'] },
//     { word: 'mathematics', syllables: 4, split: ['math', 'e', 'mat', 'ics'] },
//     { word: 'encyclopedia', syllables: 6, split: ['en', 'cy', 'clo', 'pe', 'di', 'a'] },
//     { word: 'refrigerator', syllables: 5, split: ['re', 'fri', 'ge', 'ra', 'tor'] },
//     { word: 'architecture', syllables: 4, split: ['ar', 'chi', 'tec', 'ture'] }
//   ]
// };

export default function SyllableTapGame() {
  const { emotion, confidence, videoRef, canvasRef } = useEmotionDetection();
  const [difficulty, setDifficulty] = useState('easy');
  const [wordPool, setWordPool] = useState([]);
  const [usedWords, setUsedWords] = useState([]);
  const [currentWord, setCurrentWord] = useState(null);
  const [taps, setTaps] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [isFirstWord, setIsFirstWord] = useState(true);
  const username = localStorage.getItem("username");
  const { endSession } = useGameSessionLogger({ username, difficulty, expression: emotion,score });
useEffect(() => {
    fetchWords(difficulty);
  }, []);

  const fetchWords = async (level) => {
    try {
      const res = await axios.get(`${API_BASE}/api/syllable-game/${level}`);
      const words = res.data;
      setDifficulty(level);
      setUsedWords([]);
      setWordPool(words);
      setGameComplete(false);
      setScore(0);
      setIsFirstWord(true);
      pickNewWord(words, []);
    } catch (err) {
      console.error('Error fetching syllable game questions:', err);
    }
  };

  const pickNewWord = (availableWords, used) => {
    const unusedWords = availableWords.filter(
      (w) => !used.some((usedWord) => usedWord.word === w.word)
    );

    if (unusedWords.length === 0) {
      setCurrentWord(null);
      setGameComplete(true);
      // submitScore();
      endSession();
      return;
    }

    const random = unusedWords[Math.floor(Math.random() * unusedWords.length)];
    setCurrentWord(random);
    setUsedWords([...used, random]);
    setTaps(0);
    setFeedback('');
  };

  // const submitScore = async () => {
  //   try {
  //     await axios.post('http://localhost:5000/api/scores', {
  //       score,
  //       difficulty
  //     });
  //     console.log('🎯 Score submitted successfully');
  //   } catch (err) {
  //     console.error('❌ Failed to submit score:', err);
  //   }
  // };
const handleDifficultyChange = (e) => {
    fetchWords(e.target.value);
  };

  const handleTap = () => {
    if (feedback) return;
    setTaps((prev) => prev + 1);
  };

  const handleSubmit = () => {
    if (!currentWord) return;
    if (taps === currentWord.syllables) {
      setFeedback('✅ Great job!');
      setScore((prev) => prev + 20);
    } else {
      setFeedback(`❌ Oops! It has ${currentWord.syllables} syllables.`);
    }
  };

  const nextWord = () => {
    setIsFirstWord(false);
    pickNewWord(wordPool, usedWords);
  };

  const repeatGame = () => {
    fetchWords(difficulty);
  };


  useEffect(() => {
    fetchWords(difficulty);
  }, []);
  const getEmotionStyles = (emotion) => {
  switch (emotion) {
    case "Happy":
      return { backgroundColor: "#F8FD89", color: "#333333" }; 
    case "Sad":
      return { backgroundColor: "#D8FAD2", color: "#3B2F2F" }; 
    case "Angry":
      return { backgroundColor: "#A5F7E1", color: "#223344" }; 
    case "Surprise":
      return { backgroundColor: "#FFDAB9", color: "#4B0082" }; 
    case "Neutral":
    default:
      return { backgroundColor: "#F9F9F3", color: "#2C2C2C" }; 
  }
};

  return (
  <GameShell title="Fun with Syllables" emotion={emotion} confidence={confidence}>
  <div className="game-container" style={{ padding: 0 }}>
  <div className="game-card" style={{
    backgroundColor: getEmotionStyles(emotion).backgroundColor,
    color: getEmotionStyles(emotion).color,
    '--text-color': getEmotionStyles(emotion).color,
  }}>
    <h2 className="game-title">Syllable Tap</h2>

    <div className="difficulty-select">
      <label htmlFor="difficulty">Difficulty: </label>
      <select id="difficulty" value={difficulty} onChange={handleDifficultyChange}>
        <option value="easy">🟢 Easy</option>
        <option value="medium">🟡 Medium</option>
        <option value="hard">🔴 Hard</option>
      </select>
    </div>

    <div className="game-content">
      {currentWord ? (
        <>
          <div className="tts-inline" style={{ justifyContent: "center" }}>
            <p className="current-word" style={{ margin: 0 }}>{currentWord.word}</p>
            <TTSButton text={currentWord.word} size="md" label="Say the word aloud" />
          </div>

          {isFirstWord && (
            <div className="syllable-split">
              {currentWord.split.map((syllable, idx) => (
                <span key={idx} className="syllable">{syllable}</span>
              ))}
            </div>
          )}

          <p className="tap-count">Taps: {taps}</p>
          <div>
             <button onClick={handleTap} className="game-button">Tap</button>
          </div>
          <div className="button-group">
            {!feedback && taps > 0 && (
              <button onClick={handleSubmit} className="game-button secondary">Submit</button>
            )}
            {feedback && (
              <button onClick={nextWord} className="game-button">Next Word</button>
            )}
          </div>

          <p className={`feedback-message ${feedback.startsWith('✅') ? 'correct' : feedback.startsWith('❌') ? 'wrong' : ''}`}>
            {feedback}
          </p>
        </>
      ) : gameComplete ? (
        <div className="game-complete">
          <p>You completed all words in <strong>{difficulty}</strong> mode!</p>
          <p>Your score: {score}/{wordPool.length * 20}</p>
          <div className="button-group">
            <button onClick={repeatGame} className="game-button">🔁 Repeat All Words</button>
          </div>
        </div>
      ) : (
        <p className="loading-message">Loading...</p>
      )}
    </div>

    <video ref={videoRef} autoPlay style={{ display: "none" }} />
    <canvas ref={canvasRef} width={640} height={480} style={{ display: "none" }} />
  </div>
  </div>
  </GameShell>
);
}