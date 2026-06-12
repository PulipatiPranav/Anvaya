import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import "./MirrorWordsGame.css";
import useEmotionDetection from "../hooks/useEmotionDetection";
import useGameSessionLogger from "../hooks/useGameSessionLogger";
import TTSButton from "../components/TTSButton";
import GameShell from "../components/GameShell";
import { API_BASE } from '../config/api';
const MirrorWordsGame = () => {
  const { emotion, confidence, videoRef, canvasRef } = useEmotionDetection();
  const [level, setLevel] = useState("Easy");
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [questions, setQuestions] = useState([]);
    const username = localStorage.getItem("username");
  const { endSession } = useGameSessionLogger({ username, difficulty:level, expression: emotion ,score});
  useEffect(() => {
  const fetchQuestions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/mirrorquestions/${level}`);
      const data = await res.json();
      setQuestions(data);
      setCurrent(0);
      setSelected(null);
      setFeedback("");
      setScore(0);
      setShowResult(false);
    } catch (error) {
      console.error("Error fetching questions:", error);
    }
  };

  fetchQuestions();
}, [level]);

const filteredQuestions = questions;

  const fireConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  const handleSelect = (option) => {
    setSelected(option);
    const isCorrect = option === filteredQuestions[current].correct;

    if (isCorrect) {
      setFeedback("Correct! 🎉");
      setScore((prev) => prev + 10);
    } else {
      setFeedback("Incorrect ❌");
    }
  };

  useEffect(() => {
    if (selected !== null) {
      const timer = setTimeout(() => {
        if (current + 1 < filteredQuestions.length) {
          setCurrent((prev) => prev + 1);
          setSelected(null);
          setFeedback("");
        } else {
          setShowResult(true);
          fireConfetti();
          endSession(score);
        }
      }, 1000); // Delay in ms before moving to next question or result

      return () => clearTimeout(timer);
    }
  }, [selected]);

  const handleLevelChange = (e) => {
    setLevel(e.target.value);
    setCurrent(0);
    setSelected(null);
    setFeedback("");
    setScore(0);
    setShowResult(false);
  };

  const resetGame = () => {
    setCurrent(0);
    setSelected(null);
    setFeedback("");
    setScore(0);
    setShowResult(false);
  };

  return (
    <GameShell title="Mirror Words" emotion={emotion} confidence={confidence}>
    <div className="mirror-game-container">
      <div className="mirror-game-title">Mirror Words</div>
      
      <div className="mirror-level-selector">
        <label htmlFor="level">Choose Level: </label>
        <select id="level" value={level} onChange={handleLevelChange}>
          <option value="Easy">🟢 Easy</option>
          <option value="Medium">🟡 Medium</option>
          <option value="Hard">🔴 Hard</option>
        </select>
      </div>

      {!showResult ? (
        <>
          <div className="mirror-score">Score: {score}</div>
          <div className="mirror-game-board">
            <div className="mirror-game-question">
              <span>{filteredQuestions[current]?.question}</span>
              {filteredQuestions[current]?.question && (
                <TTSButton
                  text={filteredQuestions[current].question}
                  label="Read question aloud"
                  size="sm"
                />
              )}
            </div>
            <div className="mirror-options">
              {filteredQuestions[current]?.options.map((option, index) => (
                <button
                  key={index}
                  className={`mirror-option ${
                    selected === option ? "selected" : ""
                  }`}
                  onClick={() => handleSelect(option)}
                  disabled={!!selected}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          {feedback && (
              <div
                className={`mirror-feedback ${
                  feedback === "Correct! 🎉" ? "correct" : "incorrect"
                }`}
              >
                {feedback}
              </div>
            )}
          
        </>
      ) : (
        <div className="mirror-final-score">
          <h2>Level Completed!</h2>
          <br></br>
          <p>Your Final Score: {score}</p>
          <br></br>
          <button className="mirror-reset-button" onClick={resetGame}>
            Play Again
          </button>
        </div>
      )}
      <video ref={videoRef} autoPlay style={{ display: "none" }} />
      <canvas ref={canvasRef} width={640} height={480} style={{ display: "none" }} />
    </div>
    </GameShell>
  );
};

export default MirrorWordsGame;
