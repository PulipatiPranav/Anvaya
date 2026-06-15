import {
  useEffect, useRef, useState, useCallback,
  createContext, useContext,
} from "react";
import { useLocation } from "react-router-dom";
import { Camera } from "@mediapipe/camera_utils";
import { applyEmotionTheme } from "../utils/EmotionThemeMap";
import { classifyEmotion, EMOTION_CLASSES } from "../utils/GeometricEmotion";
import { classifyFromBlendshapes } from "../utils/BlendshapeEmotion";
import { getConsent, CONSENT_EVENT } from "../utils/cameraConsent";

// MediaPipe Face Landmarker assets (loaded on-device; only model files come
// from the CDN — no user data is ever sent). Pinned to the installed version.
const MP_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MP_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

/**
 * Emotion detection — MediaPipe Face Landmarker (blendshapes) + classifier.
 *
 * Architecture (persistent webcam):
 *   The camera + classifier run in ONE place — <EmotionProvider>, mounted once
 *   in App above the routes. Because the provider never unmounts while the app
 *   is open, the webcam stays on across game navigation (no on/off flicker).
 *   It is gated by route AND by explicit consent, so the camera is only active
 *   inside the child games area after the user opts in (off on login /
 *   therapist / admin screens, and off entirely until consent is granted).
 *
 *   Games keep calling useEmotionDetection() exactly as before and receive the
 *   same { emotion, confidence, videoRef, canvasRef, ... } shape — but emotion
 *   comes from the shared provider and the refs they render are inert.
 *
 * Emotion is computed on-device from the Face Landmarker's 52 ML blendshape
 * coefficients (see utils/BlendshapeEmotion.js), with the geometric classifier
 * (utils/GeometricEmotion.js) kept as a fallback. No ML server is involved and
 * no video or images ever leave the device — only model files load from a CDN.
 */

const NUM_CLASSES = EMOTION_CLASSES.length;

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

    const video = videoRef.current;
    if (!video) return;

    let camera = null;
    let landmarker = null;
    let cancelled = false;

    // Shared post-classification pipeline (EMA → hysteresis → state).
    // Unchanged from the previous implementation — only the source of the
    // probability vector (blendshapes instead of raw geometry) is new.
    const ingest = (result) => {
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
    };

    (async () => {
      try {
        // Loaded on demand (only after consent activates the camera), keeping
        // the vision runtime out of the initial bundle.
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const fileset = await FilesetResolver.forVisionTasks(MP_WASM);
        landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MP_MODEL, delegate: 'CPU' },
          outputFaceBlendshapes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        if (cancelled) { try { landmarker.close(); } catch (_) {} return; }

        camera = new Camera(video, {
          onFrame: async () => {
            if (!landmarker || cancelled || video.readyState < 2) return;
            const now = Date.now();
            if (now - lastPredictionTime.current < intervalTime) return;
            lastPredictionTime.current = now;

            let results;
            try { results = landmarker.detectForVideo(video, performance.now()); }
            catch (_) { return; }

            const categories = results?.faceBlendshapes?.[0]?.categories;
            let result = null;
            if (categories && categories.length) {
              result = classifyFromBlendshapes(categories);
            } else if (results?.faceLandmarks?.[0]) {
              // Fallback to the proven geometric classifier if no blendshapes.
              result = classifyEmotion(results.faceLandmarks[0], 640, 480);
            }
            ingest(result);
          },
          width:  640,
          height: 480,
        });
        camera.start().catch(() => { /* camera unavailable — degrade silently */ });
      } catch (_) {
        // tasks-vision / model failed to load — emotion sensing degrades silently
      }
    })();

    return () => {
      cancelled = true;
      try { camera?.stop(); } catch (_) {}
      try { landmarker?.close(); } catch (_) {}
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
