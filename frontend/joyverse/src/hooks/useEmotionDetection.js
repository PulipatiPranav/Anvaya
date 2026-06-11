import { useEffect, useRef, useState, useCallback } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import { applyEmotionTheme } from "../utils/EmotionThemeMap";
import { ML_BASE } from "../config/api";

/**
 * useEmotionDetection — Phase A+B improved pipeline
 *
 * Key improvements over the original:
 *
 *  Phase A — Stability:
 *   • Uses TFLite probability vector (not just the label string) for all
 *     smoothing and thresholding decisions.
 *   • EMA (exponential moving average) over probability vectors replaces the
 *     raw 5-label majority vote.  Smoother, more responsive, confidence-aware.
 *   • Confidence threshold: predictions below CONF_THRESHOLD are silently
 *     discarded; the last known good emotion is kept.
 *   • Hysteresis: a candidate emotion must persist for HOLD_FRAMES consecutive
 *     EMA-winning frames before the reported emotion changes.  Kills flicker.
 *   • Default polling reduced 2000 → 500 ms (4× more responsive).
 *
 *  Phase B — Preprocessing:
 *   • Nose-tip (landmark 4) used as origin instead of landmark 0 (chin-tip).
 *     The nose tip is more geometrically stable across head rotations.
 *   • Landmark quality gate: requires a minimum face spread (inter-ocular
 *     distance ≥ MIN_IOD_PX) before sending to the ML service.  Guards against
 *     marginal or occluded detections reaching the model.
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
 *   intervalTime     — ms between ML calls (default 500)
 *   apiUrl           — ML service endpoint
 *   confThreshold    — minimum EMA confidence to commit an emotion (default 0.55)
 *   holdFrames       — consecutive frames required before emotion changes (default 2)
 *   emaAlpha         — EMA weight for new observations (default 0.35)
 */

// TFLite model2 class order — must match keypoint_classifier_label.csv
const EMOTION_CLASSES = ["Angry", "Happy", "Neutral", "Sad", "Surprise"];
const NUM_CLASSES     = EMOTION_CLASSES.length;

// Phase B constants
const NOSE_TIP_IDX  = 4;   // MediaPipe landmark index for nose tip
const LEFT_EYE_IDX  = 33;  // Outer left eye corner
const RIGHT_EYE_IDX = 263; // Outer right eye corner
const MIN_IOD_PX    = 20;  // Minimum inter-ocular distance in pixels to accept landmarks

const useEmotionDetection = ({
  intervalTime  = 500,
  apiUrl        = `${ML_BASE}/predict`,
  confThreshold = 0.55,
  holdFrames    = 2,
  emaAlpha      = 0.35,
} = {}) => {
  const [emotion,                setEmotion]          = useState("Neutral");
  const [confidence,             setConfidence]       = useState(0);
  const [sessionDominantEmotion, setSessionDominant]  = useState("Neutral");
  const [manualEmotion,          setManualEmotionState] = useState(null);

  // EMA state: smoothed probability vector over EMOTION_CLASSES
  const emaProbs       = useRef(null);        // float[NUM_CLASSES] | null (uninitialised)
  const candidateLabel = useRef("Neutral");   // emotion currently building hold count
  const holdCount      = useRef(0);           // consecutive EMA-winning frames for candidate

  // Session accumulator — maps label → weighted confidence sum (for finalizeSession)
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
      refineLandmarks:        true,   // 478 landmarks (468 + 10 iris) → 956 floats
      minDetectionConfidence: 0.5,
      minTrackingConfidence:  0.5,
    });

    faceMesh.onResults(async (results) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (!results.multiFaceLandmarks?.length) return;

      const landmarksArray = results.multiFaceLandmarks[0];
      const now = Date.now();
      if (now - lastPredictionTime.current < intervalTime) return;
      lastPredictionTime.current = now;

      // ── Phase B: landmark quality gate ───────────────────────────────────
      const toPixel = (lm) => [lm.x * canvas.width, lm.y * canvas.height];
      const leftEyePx  = toPixel(landmarksArray[LEFT_EYE_IDX]);
      const rightEyePx = toPixel(landmarksArray[RIGHT_EYE_IDX]);
      const iod = Math.hypot(
        rightEyePx[0] - leftEyePx[0],
        rightEyePx[1] - leftEyePx[1]
      );
      if (iod < MIN_IOD_PX) return; // face too small / occluded — skip

      // ── Phase B: nose-tip centred normalisation ───────────────────────────
      const noseTip = toPixel(landmarksArray[NOSE_TIP_IDX]);
      const pts     = landmarksArray.map((lm) => toPixel(lm));
      const rel     = pts.map(([x, y]) => [x - noseTip[0], y - noseTip[1]]);
      const flat    = rel.flat();                    // 478×2 = 956 floats
      const maxAbs  = Math.max(...flat.map(Math.abs)) || 1;
      const normalized = flat.map((v) => v / maxAbs);

      try {
        const response = await fetch(apiUrl, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ landmarks: normalized }),
        });

        if (!response.ok) return;

        const data = await response.json();

        // ── Phase A: use probability vector when available ────────────────
        let probs = null;

        if (Array.isArray(data.probabilities) && data.probabilities.length === NUM_CLASSES) {
          // TFLite model2 returns calibrated softmax probs — use them directly
          probs = data.probabilities;
        } else if (data.expression || data.emotion) {
          // Fallback: older server returns only a label — build a one-hot-ish vector
          const raw   = data.expression || data.emotion;
          const label = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
          const idx   = EMOTION_CLASSES.indexOf(label);
          if (idx === -1) return;
          probs = EMOTION_CLASSES.map((_, i) => (i === idx ? 0.8 : 0.05));
        } else {
          return;
        }

        // ── Phase A: EMA update ───────────────────────────────────────────
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

        // ── Phase A: confidence threshold ─────────────────────────────────
        if (maxConf < confThreshold) return; // too uncertain — keep last emotion

        // ── Phase A: hysteresis ───────────────────────────────────────────
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
      } catch {
        // ML service unavailable — keep last known emotion
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
  }, [apiUrl, intervalTime, confThreshold, holdFrames, emaAlpha]);

  // ── Apply emotion theme to document ────────────────────────────────────────
  useEffect(() => {
    const effective = manualEmotion ?? emotion;
    applyEmotionTheme(effective);
  }, [emotion, manualEmotion]);

  // ── Public API ──────────────────────────────────────────────────────────────
  const finalizeSession = useCallback(() => {
    // Use confidence-weighted accumulator rather than raw label majority
    const accum = sessionAccum.current;
    const dominant =
      Object.keys(accum).length > 0
        ? Object.entries(accum).sort((a, b) => b[1] - a[1])[0][0]
        : "Neutral";
    setSessionDominant(dominant);
    // Reset all EMA state for next session
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
    confidence,                              // NEW — exposed for UI/debug use
    sessionDominantEmotion,
    finalizeSession,
    setManualEmotion,
    videoRef,
    canvasRef,
  };
};

export default useEmotionDetection;
