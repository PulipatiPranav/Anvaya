import React, { useState, useEffect, useRef } from "react";
import useFeedbackEffect from '../hooks/useFeedbackEffect';
import "./MirrorWordsGame.css";
import useEmotionDetection from "../hooks/useEmotionDetection";
import useGameSessionLogger from "../hooks/useGameSessionLogger";
import TTSButton from "../components/TTSButton";
import GameShell from "../components/GameShell";
import FeedbackGif from "../components/FeedbackGif";
import { API_BASE } from '../config/api';
import { getCardStyle } from '../utils/EmotionThemeMap';

/** Render the question, enlarging/colouring the target letter or word in quotes. */
function renderQuestion(text) {
  if (!text) return null;
  const m = text.match(/"([^"]+)"/);
  if (!m) return <span>{text}</span>;
  const [before, after] = text.split(m[0]);
  return (
    <>
      <span>{before}</span>
      <span className="mirror-target">{m[1]}</span>
      <span>{after}</span>
    </>
  );
}

const MirrorWordsGame = () => {
  const { emotion, confidence, videoRef, canvasRef } = useEmotionDetection();
  const triggerFeedback = useFeedbackEffect();
  const [level, setLevel] = useState("Easy");
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [displayOptions, setDisplayOptions] = useState([]);
  const scoreRef = useRef(0);
  const cardStyle = getCardStyle(emotion);

  const username = localStorage.getItem("username");
  const { endSession } = useGameSessionLogger({ username, difficulty: level, expression: emotion, score });

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/mirrorquestions/${level}`);
        const data = await res.json();
        setQuestions(Array.isArray(data) ? data : []);
        setCurrent(0);
        setSelected(null);
        setFeedback("");
        setScore(0);
        scoreRef.current = 0;
        setShowResult(false);
      } catch (error) {
        console.error("Error fetching questions:", error);
      }
    };
    fetchQuestions();
  }, [level]);

  const filteredQuestions = questions;

  // Shuffle the options each time the question changes so position can't be
  // memorised — the child must actually discriminate the correct glyph.
  useEffect(() => {
    const q = questions[current];
    if (q?.options) {
      setDisplayOptions([...q.options].sort(() => Math.random() - 0.5));
    } else {
      setDisplayOptions([]);
    }
  }, [current, questions]);

  const handleSelect = (option) => {
    if (selected) return;
    setSelected(option);
    const isCorrect = option === filteredQuestions[current].correct;
    triggerFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) {
      setFeedback("Correct! 🎉");
      const next = scoreRef.current + 10;
      scoreRef.current = next;
      setScore(next);
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
          triggerFeedback('correct');
          endSession(scoreRef.current);
        }
      }, 1200);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const handleLevelChange = (e) => {
    setLevel(e.target.value);
    setCurrent(0);
    setSelected(null);
    setFeedback("");
    setScore(0);
    scoreRef.current = 0;
    setShowResult(false);
  };

  const resetGame = () => {
    setCurrent(0);
    setSelected(null);
    setFeedback("");
    setScore(0);
    scoreRef.current = 0;
    setShowResult(false);
    // Re-shuffle the first question's options
    const q = questions[0];
    if (q?.options) setDisplayOptions([...q.options].sort(() => Math.random() - 0.5));
  };

  const currentQ = filteredQuestions[current];

  return (
    <GameShell title="Mirror Words" emotion={emotion} confidence={confidence}>
      <FeedbackGif result={!feedback ? null : feedback.startsWith('Correct') ? 'correct' : 'wrong'} />
      <div className="mirror-game-container" style={cardStyle}>
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
                <span className="mirror-question-text">{renderQuestion(currentQ?.question)}</span>
                {currentQ?.question && (
                  <TTSButton
                    text={currentQ.question}
                    label="Read question aloud"
                    size="sm"
                  />
                )}
              </div>
              <div className="mirror-options">
                {displayOptions.map((option, index) => {
                  let stateClass = "";
                  if (selected) {
                    if (option === currentQ.correct) stateClass = "correct";
                    else if (option === selected) stateClass = "incorrect";
                  }
                  return (
                    <button
                      key={index}
                      className={`mirror-option ${selected === option ? "selected" : ""} ${stateClass}`}
                      onClick={() => handleSelect(option)}
                      disabled={!!selected}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
            {feedback && (
              <div className={`mirror-feedback ${feedback === "Correct! 🎉" ? "correct" : "incorrect"}`}>
                {feedback}
              </div>
            )}
          </>
        ) : (
          <div className="mirror-final-score">
            <h2>Level Completed!</h2>
            <br />
            <p>Your Final Score: {score}</p>
            <br />
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
