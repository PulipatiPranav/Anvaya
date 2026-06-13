import {
  useEffect, useRef, useState, useCallback,
  createContext, useContext,
} from "react";
import { useLocation } from "react-router-dom";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import { applyEmotionTheme } from "../utils/EmotionThemeMap";
import { classifyEmotion, EMOTION_CLASSES } from "../utils/GeometricEmotion";
import { getConsent, CONSENT_EVENT } from "../utils/cameraConsent";

/**
 * Emotion detection — FaceMesh + geometric expression classifier.
 *
 * Architecture (persistent webcam):
 *   The camera + classifier run in ONE place — <EmotionProvider>, mounted once
 *   in App above the routes. Because the provider never unmounts while the app
 *   is open, the webcam stays on across game navigation (no on/off flicker).
 *   It is gated by route so the camera is only active inside the child games
 *   area and is off on login / therapist / admin screens.
 *
 *   Games keep calling useEmotionDetection() exactly as before and receive the
 *   same { emotion, confidence, videoRef, canvasRef, ... } shape — but emotion
 *   comes from the shared provider and the refs they render are inert.
 *
 * Emotion itself is computed locally from FaceMesh landmark geometry (see
 * utils/GeometricEmotion.js) — no ML server required.
 */

const NUM_CLASSES = EMOTION_CLASSES.length;

// Landmark quality gate
const LEFT_EYE_IDX  = 33;
const RIGHT_EYE_IDX = 263;
const MIN_IOD_PX    = 20;

// ── Internal hook: owns the camera + classification. Gated by `active`. ────────
function useEmotionDetectionInternal({
  active        = true,
  intervalTime  = 400,
  confThreshold = 0.5,
  holdFrames    = 2,
  emaAlpha      = 0.4,
} = {}) {
  const [emotion,                setEmotion]            = useState("Neutral");
  const [confidence,             setConfidence]         = useState(0);
  const [sessionDominantEmotion, setSessionDominant]    = useState("Neutral");
  const [manualEmotion,          setManualEmotionState] = useState(null);

  const emaProbs       = useRef(null);
  const candidateLabel = useRef("Neutral");
  const holdCount      = useRef(0);
  const sessionAccum   = useRef({});

  const videoRef           = useRef(null);
  const canvasRef          = useRef(null);
  const lastPredictionTime = useRef(0);

  useEffect(() => {
    if (!active) return;             // camera off outside the games area

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

      const toPixel = (lm) => [lm.x * canvas.width, lm.y * canvas.height];
      const leftEyePx  = toPixel(landmarksArray[LEFT_EYE_IDX]);
      const rightEyePx = toPixel(landmarksArray[RIGHT_EYE_IDX]);
      const iod = Math.hypot(rightEyePx[0] - leftEyePx[0], rightEyePx[1] - leftEyePx[1]);
      if (iod < MIN_IOD_PX) return;

      const result = classifyEmotion(landmarksArray, canvas.width, canvas.height);
      if (!result || result.probabilities.length !== NUM_CLASSES) return;
      const probs = result.probabilities;

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

      sessionAccum.current[winner] = (sessionAccum.current[winner] || 0) + maxConf;

      if (maxConf < confThreshold) return;

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

    camera.start().catch(() => { /* camera unavailable — degrade silently */ });
    return () => {
      try { camera.stop(); } catch (_) {}
      try { faceMesh.close(); } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, intervalTime, confThreshold, holdFrames, emaAlpha]);

  // Apply emotion theme as the (effective) emotion changes
  useEffect(() => {
    const effective = manualEmotion ?? emotion;
    applyEmotionTheme(effective);
  }, [emotion, manualEmotion]);

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
    emotion: effectiveEmotion,
    confidence,
    sessionDominantEmotion,
    finalizeSession,
    setManualEmotion,
    videoRef,
    canvasRef,
  };
}

// ── Shared provider: runs one camera, gated to the child games area ────────────
const EmotionContext = createContext(null);

// Routes where the child-facing webcam should be active.
const CAMERA_PATHS = new Set([
  '/welcomepage', '/games', '/achievements',
  '/wordpuzzleadventure', '/mathgame', '/quiz', '/syllabletapgame',
  '/shapememorygame', '/letterbridge', '/mirrorword', '/phonemetap',
  '/lettersound', '/confusableletter', '/ran', '/verbalmemory',
  '/reading-fluency', '/sight-words', '/morphology-builder',
]);

export function EmotionProvider({ children }) {
  const location = useLocation();
  let hasToken = false;
  try { hasToken = !!localStorage.getItem('token'); } catch (_) {}

  // Expression sensing is opt-in: the camera only runs after explicit consent.
  const [consent, setConsentState] = useState(getConsent());
  useEffect(() => {
    const onChange = () => setConsentState(getConsent());
    window.addEventListener(CONSENT_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(CONSENT_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const active = hasToken && consent === 'granted' && CAMERA_PATHS.has(location.pathname);

  const api = useEmotionDetectionInternal({ active });

  return (
    <EmotionContext.Provider value={api}>
      {children}
      {/* Single persistent hidden camera surface for the whole games area */}
      <video  ref={api.videoRef}  autoPlay playsInline muted style={{ display: 'none' }} />
      <canvas ref={api.canvasRef} width={640} height={480} style={{ display: 'none' }} />
    </EmotionContext.Provider>
  );
}

// ── Public hook used by every game (unchanged call sites) ──────────────────────
const INERT = {
  emotion: 'Neutral', confidence: 0, sessionDominantEmotion: 'Neutral',
  finalizeSession: () => {}, setManualEmotion: () => {},
};

const useEmotionDetection = () => {
  const ctx = useContext(EmotionContext);
  // Inert refs so a game's <video ref={videoRef}> still renders harmlessly;
  // the real camera lives in the provider.
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const source = ctx ?? INERT;
  return {
    emotion:                source.emotion,
    confidence:             source.confidence,
    sessionDominantEmotion: source.sessionDominantEmotion,
    finalizeSession:        source.finalizeSession,
    setManualEmotion:       source.setManualEmotion,
    videoRef,
    canvasRef,
  };
};

export default useEmotionDetection;
