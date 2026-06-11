// import React, { useState, useEffect } from "react";
// import axios from "axios";
// import confetti from "canvas-confetti";
// import useEmotionDetection from "../hooks/useEmotionDetection";
// import "./Quiz.css";

// const Quiz = () => {
//   const { emotion, videoRef, canvasRef } = useEmotionDetection();
//   const [questions, setQuestions] = useState([]);
//   const [currentQuestion, setCurrentQuestion] = useState(0);
//   const [score, setScore] = useState(0);
//   const [showScore, setShowScore] = useState(false);
//   const [difficulty, setDifficulty] = useState("Easy");

//   useEffect(() => {
//     const fetchQuestions = async () => {
//       try {
//         const response = await axios.get(`${API_BASE}/api/questions?difficulty=${difficulty}`);
//         setQuestions(response.data);
//         setCurrentQuestion(0);
//         setScore(0);
//         setShowScore(false);
//       } catch (error) {
//         console.error("Error fetching quiz data:", error);
//       }
//     };
//     fetchQuestions();

//     document.body.style.overflow = "auto";
//     return () => {
//       document.body.style.overflow = "hidden";
//     };
//   }, [difficulty]);

//   const handleAnswerClick = (selected) => {
//     if (selected === questions[currentQuestion].answer) {
//       setScore(score + 1);
//     }

//     const nextQuestion = currentQuestion + 1;
//     if (nextQuestion < questions.length) {
//       setCurrentQuestion(nextQuestion);
//     } else {
//       setShowScore(true);
//       confetti();
//     }
//   };

//   const handleReplay = () => {
//     setCurrentQuestion(0);
//     setScore(0);
//     setShowScore(false);
//   };

//   const handleDifficultyChange = (level) => {
//     setDifficulty(level);
//   };

//   return (
//     <div className="quiz-container">
//       <div className="game-card">
//         <h2 className="game-title">Fun Quiz!</h2>
//         <p className="game-text emotion-text">Detected Emotion: {emotion}</p>

//         <div className="difficulty-selector">
//           {["Easy", "Medium", "Hard"].map((level) => (
//             <button key={level} className="game-button" onClick={() => handleDifficultyChange(level)}>
//               {level}
//             </button>
//           ))}
//         </div>

//         {questions.length === 0 ? (
//           <p className="game-text">Loading questions...</p>
//         ) : showScore ? (
//           <div className="game-score">
//             <p className="game-text">You scored {score} out of {questions.length}! 🎉</p>
//             <button className="game-button" onClick={handleReplay}>Replay Quiz</button>
//           </div>
//         ) : (
//           <>
//             <p className="game-question">{questions[currentQuestion].question}</p>
//             <div className="quiz-options">
//               {questions[currentQuestion].options.map((option, index) => (
//                 <button
//                   key={index}
//                   className="quiz-option-btn"
//                   onClick={() => handleAnswerClick(option.text)}
//                 >
//                   <img src={option.image} alt={option.text} className="quiz-option-image" />
//                   {/* <div className="quiz-text">{option.text}</div> */}
//                 </button>
//               ))}
//             </div>
//             <p className="game-text">Question {currentQuestion + 1} of {questions.length}</p>
//           </>
//         )}

//         <video ref={videoRef} autoPlay style={{ display: "none" }} />
//         <canvas ref={canvasRef} width={640} height={480} style={{ display: "none" }} />
//       </div>
//     </div>
//   );
// };

// export default Quiz;














import React, { useState, useEffect } from "react";
import axios from "axios";
import confetti from "canvas-confetti";
import useEmotionDetection from "../hooks/useEmotionDetection";
import useGameSessionLogger from "../hooks/useGameSessionLogger";
import TTSButton from "../components/TTSButton";
import "./Quiz.css";

import { API_BASE } from '../config/api';
const emotionToDifficulty = {
  Happy: "Hard",
  Sad: "Easy",
  Neutral: "Easy",
  Angry: "Medium",
  Surprise: "Medium",
};


const Quiz = () => {
  const { emotion, sessionDominantEmotion, finalizeSession, videoRef, canvasRef } = useEmotionDetection();
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [showScore, setShowScore] = useState(false);
  const [difficulty, setDifficulty] = useState("Easy");
  
  const username = localStorage.getItem("username");
  const { endSession } = useGameSessionLogger({ username, difficulty, expression: emotion ,score});
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/questions?difficulty=${difficulty}`);
        setQuestions(response.data);
        setCurrentQuestion(0);
        setScore(0);
        setShowScore(false);
      } catch (error) {
        console.error("Error fetching quiz data:", error);
      }
    };
    fetchQuestions();

    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "hidden";
    };
  }, [difficulty]);
  useEffect(() => {
    // When quiz ends (showScore becomes true), call endSession
    if (showScore) {
      endSession(score);
    }
  }, [showScore, endSession]);
  const handleAnswerClick = (selected) => {
    if (selected === questions[currentQuestion].answer) {
      setScore(score + 20);
    }

    const nextQuestion = currentQuestion + 1;
    if (nextQuestion < questions.length) {
      setCurrentQuestion(nextQuestion);
    } else {
      finalizeSession(); // Collect dominant emotion
      setShowScore(true);
      confetti();
    }
  };

  const handleReplay = () => {
    const nextEmotion = sessionDominantEmotion || "Neutral";
    const nextDifficulty = emotionToDifficulty[nextEmotion] || "Medium";
    setDifficulty(nextDifficulty);

    setCurrentQuestion(0);
    setScore(0);
    setShowScore(false);
  };
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
    <div className="quiz-container">
      <div className="game-card" style={{
    backgroundColor: getEmotionStyles(emotion).backgroundColor,
    color: getEmotionStyles(emotion).color,
    '--text-color': getEmotionStyles(emotion).color,
  }}>
        <h2 className="game-title">Fun Quiz!</h2>
        <p className="game-text emotion-text">Detected Emotion: {emotion}</p>
        <p className="game-text">Difficulty: {difficulty}</p>

        {questions.length === 0 ? (
          <p className="game-text">Loading questions...</p>
        ) : showScore ? (
          <div className="game-score">
            <p className="game-text">You scored {score} out of {questions.length*20}! 🎉</p>
            <p className="game-text">Session Emotion: {sessionDominantEmotion}</p>
            <p className="game-text">Next Difficulty: {emotionToDifficulty[sessionDominantEmotion] || "Medium"}</p>
            <button className="game-button" onClick={handleReplay}>Replay Quiz</button>
          </div>
        ) : (
          <>
            <div className="tts-inline" style={{ justifyContent: "center" }}>
              <p className="game-question" style={{ margin: 0 }}>{questions[currentQuestion].question}</p>
              <TTSButton
                text={questions[currentQuestion].question}
                size="sm"
                label="Read question aloud"
              />
            </div>
            <div className="quiz-options">
              {questions[currentQuestion].options.map((option, index) => (
                <button key={index} className="quiz-option-btn" onClick={() => handleAnswerClick(option.text)}>
                  <img src={option.image} alt={option.text} className="quiz-option-image" />
                </button>
              ))}
            </div>
            <p className="game-text">Question {currentQuestion + 1} of {questions.length}</p>
          </>
        )}

        <video ref={videoRef} autoPlay style={{ display: "none" }} />
        <canvas ref={canvasRef} width={640} height={480} style={{ display: "none" }} />
      </div>
    </div>
  );
};

export default Quiz;
