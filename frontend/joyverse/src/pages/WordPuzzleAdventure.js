import React, { useState, useEffect } from "react";
import useFeedbackEffect from '../hooks/useFeedbackEffect';
import "./WordPuzzleAdventure.css";
import useEmotionDetection from "../hooks/useEmotionDetection";
import useGameSessionLogger from "../hooks/useGameSessionLogger";
import TTSButton from "../components/TTSButton";
import GameShell from "../components/GameShell";
import FeedbackGif from "../components/FeedbackGif";
import { API_BASE } from '../config/api';
const WordPuzzleAdventure = () => {
  const { emotion, confidence, videoRef, canvasRef } = useEmotionDetection();
  const triggerFeedback = useFeedbackEffect();
  const [difficulty, setDifficulty] = useState("easy");
  const [shuffledWords, setShuffledWords] = useState([]);
  const [allFetchedWords, setAllFetchedWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedLetters, setSelectedLetters] = useState([]);
  const [shuffledLetters, setShuffledLetters] = useState([]);
  const [hintVisible, setHintVisible] = useState(false);
  const [score, setScore] = useState(0);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [feedback, setFeedback] = useState("");
  const username = localStorage.getItem("username");
  const { endSession } = useGameSessionLogger({
  username,
  difficulty,
  expression: emotion,
  score,
});
  useEffect(() => {
    fetchQuestions(difficulty);
  }, [difficulty]);

  useEffect(() => {
    if (gameCompleted) {
    triggerFeedback('correct');

    (async () => {
      await endSession(score); 
    })();
  }
}, [gameCompleted]);

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const fetchQuestions = async (level) => {
    try {
      const response = await fetch(`${API_BASE}/api/wordQuestions/${level}`);
      const data = await response.json();
      if (data.length === 0) {
        alert("No questions found for this difficulty!");
        setShuffledWords([]);
        return;
      }
      setAllFetchedWords(data);
      initializeGame(data);
    } catch (error) {
      console.error("Failed to fetch questions:", error);
    }
  };

  const shuffleArray = (array) => {
    let shuffled = [...array];
    let attempts = 0;
    while (shuffled.join("") === array.join("") && attempts < 10) {
      shuffled = [...array].sort(() => Math.random() - 0.5);
      attempts++;
    }
    return shuffled;
  };

  const initializeGame = (questions) => {
    const allWords = shuffleArray(questions);
    const levelWords = allWords.slice(0, 5);
    setShuffledWords(levelWords);
    setCurrentIndex(0);
    setSelectedLetters(Array(levelWords[0].word.length).fill(""));
    setShuffledLetters(shuffleArray([...levelWords[0].word]));
    setScore(0);
    setHintVisible(false);
    setGameCompleted(false);
    setFeedback("");
  };

  const handleLetterClick = (letter, index) => {
    if (!letter) return;
    const newSelection = [...selectedLetters];
    const emptyIndex = newSelection.findIndex((char) => char === "");
    if (emptyIndex === -1) return;
    newSelection[emptyIndex] = letter;
    setSelectedLetters(newSelection);
    const updatedShuffled = [...shuffledLetters];
    updatedShuffled[index] = null;
    setShuffledLetters(updatedShuffled);

    const formedWord = newSelection.join("");
    if (!newSelection.includes("")) {
      const correctWord = shuffledWords[currentIndex].word;
      if (formedWord === correctWord) {
        triggerFeedback('correct');
        setFeedback("Correct! 🎉");
        setScore(score + 20);
        setTimeout(() => {
          setFeedback("");
          nextWord();
        }, 1500);
      } else {
        triggerFeedback('wrong');
        setFeedback("Oops! That's incorrect. ❌");
        setTimeout(() => {
          setFeedback("");
          nextWord();
        }, 1500);
      }
    }
  };

  const nextWord = () => {
    if (currentIndex + 1 >= shuffledWords.length) {
      setGameCompleted(true);
    } else {
      const newIndex = currentIndex + 1;
      const nextWord = shuffledWords[newIndex].word;
      setCurrentIndex(newIndex);
      setSelectedLetters(Array(nextWord.length).fill(""));
      setShuffledLetters(shuffleArray([...nextWord]));
      setHintVisible(false);
    }
  };

  const handleAnswerClick = (index) => {
    const letterToRemove = selectedLetters[index];
    if (letterToRemove !== "") {
      const newSelection = [...selectedLetters];
      newSelection[index] = "";
      setSelectedLetters(newSelection);
      const restored = [...shuffledLetters];
      for (let i = 0; i < restored.length; i++) {
        if (restored[i] === null) {
          restored[i] = letterToRemove;
          break;
        }
      }
      setShuffledLetters(restored);
    }
  };

  const handleReplay = () => {
    initializeGame(shuffleArray(allFetchedWords));
  };

  const currentWordObj = shuffledWords[currentIndex] || {};
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
    <GameShell title="Word Quest" emotion={emotion} confidence={confidence}>
    <FeedbackGif result={!feedback ? null : feedback.startsWith('Correct') ? 'correct' : 'wrong'} />
    <div className="quiz-container" style={{ padding: 0, minHeight: 'auto' }}>
      <div className="game-card" style={{
    backgroundColor: getEmotionStyles(emotion).backgroundColor,
    color: getEmotionStyles(emotion).color,
    '--text-color': getEmotionStyles(emotion).color,
  }}>
        <h2 className="game-title">Word Puzzle Adventure</h2>
        <div className="tts-inline" style={{ justifyContent: "center", marginBottom: "6px" }}>
          <span className="game-text">Unscramble the letters to form the correct word!</span>
          <TTSButton text="Unscramble the letters to form the correct word!" size="sm" label="Read instructions aloud" />
        </div>

        <div className="wpa-difficulty">
          <label htmlFor="wpa-diff">Choose Difficulty: </label>
          <select
            id="wpa-diff"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            aria-label="Choose difficulty"
          >
            <option value="easy">🟢 Easy</option>
            <option value="medium">🟡 Medium</option>
            <option value="hard">🔴 Hard</option>
          </select>
        </div>

        <p className="game-text">Score: {score}</p>

        {gameCompleted ? (
          <div className="game-score">
            <p className="game-text">You completed the game! 🎉</p>
            <p className="game-text">Final Score: {score}</p>
            <button className="game-button" onClick={handleReplay}>
              Play Again
            </button>
          </div>
        ) : (
          <>
            {currentWordObj.image && (
              currentWordObj.image.startsWith('http')
                ? <img src={currentWordObj.image} alt="word clue" className="word-puzzle-image" />
                : <span className="word-puzzle-emoji" role="img" aria-label={currentWordObj.word}>{currentWordObj.image}</span>
            )}
            <div className="word-slot-container">
              {selectedLetters.map((letter, index) => (
                <div
                  key={index}
                  className={`word-slot ${letter ? "filled" : ""}`}
                  onClick={() => handleAnswerClick(index)}
                >
                  {letter}
                </div>
              ))}
            </div>
            <div className="word-letters">
              {shuffledLetters.map((letter, index) => (
                <button
                  key={index}
                  className="quiz-option-btn"
                  onClick={() => handleLetterClick(letter, index)}
                  disabled={!letter}
                  style={{ visibility: letter ? "visible" : "hidden" }}
                >
                  {letter}
                </button>
              ))}
            </div>
            <div className="difficulty-selector">
              <button className="game-button" onClick={() => setHintVisible(true)}>
                Show Hint
              </button>
              <button className="game-button" onClick={nextWord}>
                Skip
              </button>
            </div>
            {hintVisible && currentWordObj.hint && (
              <div className="tts-inline" style={{ justifyContent: "center" }}>
                <p className="game-text" style={{ margin: 0 }}>{currentWordObj.hint}</p>
                <TTSButton text={currentWordObj.hint} size="sm" label="Read hint aloud" />
              </div>
            )}
            {feedback && (
              <p className="game-text">{feedback}</p>
            )}
          </>
        )}
        <video ref={videoRef} autoPlay style={{ display: "none" }} />
        <canvas ref={canvasRef} width={640} height={480} style={{ display: "none" }} />
      </div>
    </div>
    </GameShell>
  );
};

export default WordPuzzleAdventure;
