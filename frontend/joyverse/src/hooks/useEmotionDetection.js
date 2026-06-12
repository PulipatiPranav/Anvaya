import { useEffect, useRef, useState, useCallback } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import { applyEmotionTheme } from "../utils/EmotionThemeMap";
import { classifyEmotion, EMOTION_CLASSES } from "../utils/GeometricEmotion";

/**
 * useEmotionDetection — FaceMesh + geometric expression classifier.
 *
 * Emotion is computed LOCALLY from MediaPipe FaceMesh landmark geometry
 * (see utils/GeometricEmotion.js). This replaced the previous TFLite landmark
 * model, which systematically mislabeled smiles as "Angry" and neutral faces
 * as "Sad" because its training-time preprocessing could not be reproduced.
 * Running locally also means detection no longer depends on the Python ML
 * server being up.
 *
 * Smoothing pipeline (unchanged, kept because it works well):
 *   • EMA over the geometric probability vector (smooth, confidence-aware)
 *   • Confidence threshold: frames below confThreshold are discarded
 *   • Hysteresis: a winner must persist holdFrames frames before it is reported
 *
 * Returns:
 *   emotion                — current smoothed emotion label
 *   confidence             — EMA-smoothed confidence for current emotion (0–1)
 *   sessionDominantEmotion — dominant emotion since last finalizeSession()
 *   finalizeSession()      — compute & store dominant, reset EMA state
 *   setManualEmotion(e)    — override detected emotion (null to resume)
 *   videoRef / canvasRef   — attach to hidden <video> and <canvas> elements
 *
 * Options (all optional):
 *   intervalTime  — ms between classifications (default 400)
 *   confThreshold — minimum EMA confidence to commit an emotion (default 0.5)
 *   holdFrames    — consecutive frames required before emotion changes (default 2)
 *   emaAlpha      — EMA weight for new observations (default 0.4)
 */

const NUM_CLASSES = EMOTION_CLASSES.length;

// Landmark quality gate
const LEFT_EYE_IDX  = 33;   // outer left eye corner
const RIGHT_EYE_IDX = 263;  // outer right eye corner
const MIN_IOD_PX    = 20;   // minimum inter-ocular distance (px) to accept a face

const useEmotionDetection = ({
  intervalTime  = 400,
  confThreshold = 0.5,
  holdFrames    = 2,
  emaAlpha      = 0.4,
} = {}) => {
  const [emotion,                setEmotion]            = useState("Neutral");
  const [confidence,             setConfidence]         = useState(0);
  const [sessionDominantEmotion, setSessionDominant]    = useState("Neutral");
  const [manualEmotion,          setManualEmotionState] = useState(null);

  // EMA state: smoothed probability vector over EMOTION_CLASSES
  const emaProbs       = useRef(null);
  const candidateLabel = useRef("Neutral");
  const holdCount      = useRef(0);

  // Session accumulator — maps label → weighted confidence sum
  const sessionAccum   = useRef({});

  const videoRef           = useRef(null);
  const canvasRef          = useRef(null);
  const lastPredictionTime = useRef(0);

  // ── Webcam + FaceMesh loop ──────────────────────────────────────────────────
  useEffect(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const ctx    = canvas?.getContext("2d");

    if (!video || !canvas || !ctx) return;

    const faceMesh = new FaceMesh({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces:            1,
      refineLandmarks:        true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence:  0.5,
    });

    faceMesh.onResults((results) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (!results.multiFaceLandmarks?.length) return;

      const landmarksArray = results.multiFaceLandmarks[0];
      const now = Date.now();
      if (now - lastPredictionTime.current < intervalTime) return;
      lastPredictionTime.current = now;

      // ── Landmark quality gate ────────────────────────────────────────────
      const toPixel = (lm) => [lm.x * canvas.width, lm.y * canvas.height];
      const leftEyePx  = toPixel(landmarksArray[LEFT_EYE_IDX]);
      const rightEyePx = toPixel(landmarksArray[RIGHT_EYE_IDX]);
      const iod = Math.hypot(
        rightEyePx[0] - leftEyePx[0],
        rightEyePx[1] - leftEyePx[1]
      );
      if (iod < MIN_IOD_PX) return; // face too small / occluded — skip

      // ── Geometric emotion classification (local — no ML server required) ──
      const result = classifyEmotion(landmarksArray, canvas.width, canvas.height);
      if (!result || result.probabilities.length !== NUM_CLASSES) return;
      const probs = result.probabilities;

      // ── EMA update ───────────────────────────────────────────────────────
      if (!emaProbs.current) {
        emaProbs.current = [...probs];
      } else {
        emaProbs.current = emaProbs.current.map(
          (p, i) => emaAlpha * probs[i] + (1 - emaAlpha) * p
        );
      }

      const maxConf = Math.max(...emaProbs.current);
      const maxIdx  = emaProbs.current.indexOf(maxConf);
      const winner  = EMOTION_CLASSES[maxIdx];

      // Accumulate for session dominant (weighted by confidence)
      sessionAccum.current[winner] =
        (sessionAccum.current[winner] || 0) + maxConf;

      // ── Confidence threshold ─────────────────────────────────────────────
      if (maxConf < confThreshold) return; // too uncertain — keep last emotion

      // ── Hysteresis ───────────────────────────────────────────────────────
      if (winner === candidateLabel.current) {
        holdCount.current++;
      } else {
        candidateLabel.current = winner;
        holdCount.current      = 1;
      }

      if (holdCount.current >= holdFrames && !manualEmotion) {
        setEmotion(winner);
        setConfidence(Math.round(maxConf * 100) / 100);
      }
    });

    const camera = new Camera(video, {
      onFrame: async () => { await faceMesh.send({ image: video }); },
      width:  640,
      height: 480,
    });

    camera.start();
    return () => camera.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalTime, confThreshold, holdFrames, emaAlpha]);

  // ── Apply emotion theme to document ────────────────────────────────────────
  useEffect(() => {
    const effective = manualEmotion ?? emotion;
    applyEmotionTheme(effective);
  }, [emotion, manualEmotion]);

  // ── Public API ──────────────────────────────────────────────────────────────
  const finalizeSession = useCallback(() => {
    const accum = sessionAccum.current;
    const dominant =
      Object.keys(accum).length > 0
        ? Object.entries(accum).sort((a, b) => b[1] - a[1])[0][0]
        : "Neutral";
    setSessionDominant(dominant);
    emaProbs.current       = null;
    candidateLabel.current = "Neutral";
    holdCount.current      = 0;
    sessionAccum.current   = {};
  }, []);

  const setManualEmotion = useCallback((label) => {
    setManualEmotionState(label);
    if (label) setEmotion(label);
  }, []);

  const effectiveEmotion = manualEmotion ?? emotion;

  return {
    emotion:                effectiveEmotion,
    confidence,
    sessionDominantEmotion,
    finalizeSession,
    setManualEmotion,
    videoRef,
    canvasRef,
  };
};

export default useEmotionDetection;
