import { useEffect, useRef } from "react";
import axios from "axios";
import { API_BASE } from "../config/api";

/**
 * useGameSessionLogger
 *
 * Accumulates emotion expressions during a game session and POSTs the full
 * session record to the backend when endSession() is called.
 *
 * Now also reads the child's self-reported mood from WelcomeScreen
 * (stored in localStorage as "selectedEmotion") and attaches it to the
 * session payload as moodAtStart — visible in the therapist dashboard.
 */
const useGameSessionLogger = ({ username, difficulty, expression, score, phonicsLevel = null }) => {
  const startTimeRef   = useRef(new Date());
  const expressionsRef = useRef([]);

  useEffect(() => {
    if (expression) {
      expressionsRef.current.push({
        expression,
        timestamp: new Date().toISOString(),
      });
    }
  }, [expression]);

  const endSession = async () => {
    const endTime = new Date();
    const gameName =
      window.location.pathname.replace("/", "").trim() || "unknown";

    // Capture the mood the child self-reported on WelcomeScreen
    const moodAtStart =
      localStorage.getItem("selectedEmotion") || "neutral";

    const sessionData = {
      username,
      difficulty:  difficulty ? difficulty.toLowerCase() : "easy",
      startTime:   startTimeRef.current.toISOString(),
      endTime:     endTime.toISOString(),
      expressions: expressionsRef.current,
      gameName,
      score,
      moodAtStart,
      phonicsLevel: phonicsLevel || null,
    };

    try {
      await axios.post(`${API_BASE}/api/sessions`, sessionData);
      console.log("Game session saved!");
    } catch (err) {
      console.error("Failed to save session:", err);
    }
  };

  return { endSession };
};

export default useGameSessionLogger;
