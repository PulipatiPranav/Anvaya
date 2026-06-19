import { useEffect, useState } from "react";
import "./ShapeMemoryGame.css";
import useEmotionDetection from "../hooks/useEmotionDetection";
import useFeedbackEffect from '../hooks/useFeedbackEffect';
import useGameSessionLogger from "../hooks/useGameSessionLogger";
import GameShell from "../components/GameShell";
import TTSButton from "../components/TTSButton";

const shapes = ["⬤", "▲", "■", "★"];
const totalTiles = 16;

const levelSettings = {
  easy:   { revealTime: 5000, gameTime: 45, allowedClicks: 15 },
  medium: { revealTime: 5000, gameTime: 30, allowedClicks: 10 },
  hard:   { revealTime: 2500, gameTime: 30, allowedClicks: 7  },
};

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function ShapeMemoryGame() {
  const { emotion, confidence, videoRef, canvasRef } = useEmotionDetection();
  const triggerFeedback = useFeedbackEffect();

  const [tileValues,    setTileValues]    = useState([]);
  const [revealed,      setRevealed]      = useState([]);
  const [correctTiles,  setCorrectTiles]  = useState([]);
  const [wrongTiles,    setWrongTiles]    = useState([]);
  const [currentTarget, setCurrentTarget] = useState("");
  const [score,         setScore]         = useState(0);
  const [totalTarget,   setTotalTarget]   = useState(0);
  const [timeLeft,      setTimeLeft]      = useState(0);
  const [isGameOver,    setIsGameOver]    = useState(false);
  const [level,         setLevel]         = useState("easy");
  const [isStarting,    setIsStarting]    = useState(true);
  const [clicksLeft,    setClicksLeft]    = useState(0);

  const username = localStorage.getItem("username");
  const { endSession } = useGameSessionLogger({ username, difficulty: level, expression: emotion, score });

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setupGame(); }, [level]);

  useEffect(() => {
    if (timeLeft > 0 && !isGameOver) {
      const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !isGameOver && !isStarting) {
      setIsGameOver(true);
    }
  }, [timeLeft, isGameOver, isStarting]);

  useEffect(() => {
    if (isGameOver) endSession();
  }, [isGameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  const setupGame = () => {
    const { revealTime, gameTime, allowedClicks } = levelSettings[level];
    setIsStarting(true);

    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    setCurrentTarget(shape);

    const pool = [];
    for (let i = 0; i < totalTiles; i++) {
      pool.push(shapes[Math.floor(Math.random() * shapes.length)]);
    }
    const shuffled = shuffleArray(pool);
    setTileValues(shuffled);
    setRevealed(new Array(totalTiles).fill(true));
    setCorrectTiles(new Array(totalTiles).fill(false));
    setWrongTiles(new Array(totalTiles).fill(false));
    setScore(0);
    setIsGameOver(false);
    setClicksLeft(allowedClicks);
    setTimeLeft(revealTime / 1000);
    setTotalTarget(shuffled.filter(v => v === shape).length);

    let countdown = revealTime / 1000;
    const interval = setInterval(() => {
      countdown -= 1;
      setTimeLeft(countdown);
    }, 1000);

    setTimeout(() => {
      clearInterval(interval);
      setRevealed(new Array(totalTiles).fill(false));
      setTimeLeft(gameTime);
      setIsStarting(false);
    }, revealTime);
  };

  const handleClick = (index) => {
    if (revealed[index] || correctTiles[index] || isGameOver || isStarting) return;

    const updatedRevealed = [...revealed];
    updatedRevealed[index] = true;
    setRevealed(updatedRevealed);

    if (tileValues[index] === currentTarget) {
      const updatedCorrect = [...correctTiles];
      updatedCorrect[index] = true;
      setCorrectTiles(updatedCorrect);
      triggerFeedback('correct');
      setScore(prev => prev + 1);
      if (score + 1 === totalTarget) setIsGameOver(true);
    } else {
      const updatedWrong = [...wrongTiles];
      updatedWrong[index] = true;
      setWrongTiles(updatedWrong);
      triggerFeedback('wrong');

      setClicksLeft(prev => {
        const next = prev - 1;
        if (next <= 0) setTimeout(() => setIsGameOver(true), 1000);
        return next;
      });

      setTimeout(() => {
        setRevealed(prev => { const t = [...prev]; t[index] = false; return t; });
        setWrongTiles(prev => { const t = [...prev]; t[index] = false; return t; });
      }, 1000);
    }
  };

  const promptText = isStarting
    ? `Memorize the tiles! Target shape is: ${currentTarget}`
    : `Find all tiles with: ${currentTarget}`;

  return (
    <GameShell title="Shape Memory" emotion={emotion} confidence={confidence}>
      <div className="smg-container">
        <div className="smg-controls">
          <label htmlFor="level-select">Choose Level:</label>
          <select id="level-select" value={level} onChange={e => setLevel(e.target.value)} className="smg-dropdown">
            <option value="easy">🟢 Easy</option>
            <option value="medium">🟡 Medium</option>
            <option value="hard">🔴 Hard</option>
          </select>
        </div>

        <div className="tts-inline" style={{ justifyContent: "center" }}>
          <p className="smg-prompt" style={{ margin: 0 }}>
            {isStarting ? "Memorize the tiles! Target shape is:" : "Find all tiles with:"}{" "}
            <span className="smg-target-shape">{currentTarget}</span>
          </p>
          <TTSButton text={promptText} size="sm" label="Read instructions aloud" />
        </div>

        <p className="smg-timer">{isStarting ? `Memorizing… ${timeLeft}s` : `Time Left: ${timeLeft}s`}</p>
        <p className="smg-clicks-left">Chances Left: {clicksLeft}</p>

        <div className="smg-grid smg-grid-4x4">
          {tileValues.map((shape, idx) => {
            const isRevealed = revealed[idx];
            const isCorrect  = correctTiles[idx];
            const isWrong    = wrongTiles[idx];
            return (
              <div
                key={idx}
                className={`smg-tile ${
                  isCorrect ? "smg-correct" : isWrong ? "smg-wrong" : isRevealed ? "smg-revealed" : "smg-hidden"
                }`}
                onClick={() => handleClick(idx)}
              >
                {isRevealed || isCorrect || isWrong ? shape : ""}
              </div>
            );
          })}
        </div>

        <p className="smg-score">Score: {score} / {totalTarget}</p>

        {isGameOver && (
          <div className="smg-end-screen">
            <p className="smg-result-text">
              {score === totalTarget ? "🎉 You Win!" : clicksLeft <= 0 ? "❌ No more chances!" : "⏰ Time's Up!"}
            </p>
            <button onClick={setupGame} className="smg-reset-button">Play Again</button>
          </div>
        )}

        <video  ref={videoRef}  autoPlay style={{ display: "none" }} />
        <canvas ref={canvasRef} width={640} height={480} style={{ display: "none" }} />
      </div>
    </GameShell>
  );
}

export default ShapeMemoryGame;
