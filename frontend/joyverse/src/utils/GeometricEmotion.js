/**
 * GeometricEmotion — facial-expression classification from MediaPipe FaceMesh
 * landmark geometry. No ML model required.
 *
 * Why geometric instead of the TFLite model:
 *   The previous 22 KB landmark-MLP (model2/keypoint_classifier.tflite) was an
 *   opaque black box whose training preprocessing could not be reproduced at
 *   inference time, producing systematic mislabels (smiles read as "Angry",
 *   neutral faces as "Sad"). FaceMesh already gives sub-pixel-stable landmarks,
 *   so we can compute interpretable geometric features directly and far more
 *   reliably for the gross emotions this app needs (happy / neutral / sad /
 *   angry / surprise).
 *
 * Output classes (fixed order — must match EMOTION_CLASSES in the hook):
 *   ["Angry", "Happy", "Neutral", "Sad", "Surprise"]
 *
 * All measurements are normalized by face height (forehead→chin) so they are
 * invariant to how close the child sits to the camera. Landmarks are converted
 * to aspect-correct pixel space first (x*width, y*height) so vertical and
 * horizontal distances are comparable.
 */

export const EMOTION_CLASSES = ['Angry', 'Happy', 'Neutral', 'Sad', 'Surprise'];

// MediaPipe FaceMesh landmark indices
const IDX = {
  FOREHEAD: 10, CHIN: 152,
  MOUTH_L: 61, MOUTH_R: 291,
  LIP_TOP: 13, LIP_BOT: 14,          // inner lip centers (mouth opening)
  L_EYE_TOP: 159, L_EYE_BOT: 145, L_EYE_OUT: 33, L_EYE_IN: 133,
  R_EYE_TOP: 386, R_EYE_BOT: 374, R_EYE_OUT: 263, R_EYE_IN: 362,
  L_BROW: 105, R_BROW: 334,          // mid eyebrow
  L_BROW_IN: 55, R_BROW_IN: 285,     // inner eyebrow
  L_CHEEK: 234, R_CHEEK: 454,
};

// Soft hinge: how far x is above a threshold (never negative)
const pos = (x) => (x > 0 ? x : 0);

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/**
 * Compute geometric features from a MediaPipe landmark array.
 * @param {Array<{x:number,y:number}>} landmarks
 * @param {number} width  source frame width  (default 640)
 * @param {number} height source frame height (default 480)
 * @returns {object|null} feature object, or null if landmarks are unusable
 */
export function computeFeatures(landmarks, width = 640, height = 480) {
  if (!landmarks || landmarks.length < 468) return null;
  const P = (i) => {
    const lm = landmarks[i];
    if (!lm) return null;
    return [lm.x * width, lm.y * height];
  };

  const forehead = P(IDX.FOREHEAD), chin = P(IDX.CHIN);
  if (!forehead || !chin) return null;

  const faceH = dist(forehead, chin);
  if (faceH < 1) return null;

  const mouthL = P(IDX.MOUTH_L), mouthR = P(IDX.MOUTH_R);
  const lipTop = P(IDX.LIP_TOP), lipBot = P(IDX.LIP_BOT);
  const lEyeTop = P(IDX.L_EYE_TOP), lEyeBot = P(IDX.L_EYE_BOT);
  const rEyeTop = P(IDX.R_EYE_TOP), rEyeBot = P(IDX.R_EYE_BOT);
  const lBrow = P(IDX.L_BROW), rBrow = P(IDX.R_BROW);
  const lBrowIn = P(IDX.L_BROW_IN), rBrowIn = P(IDX.R_BROW_IN);

  // Mouth-corner lift (smile): corners above lip-center → positive (y grows downward)
  const cornerY    = (mouthL[1] + mouthR[1]) / 2;
  const lipCenterY = (lipTop[1] + lipBot[1]) / 2;
  const smile = (lipCenterY - cornerY) / faceH;

  // Mouth opening and width
  const mouthOpen = (lipBot[1] - lipTop[1]) / faceH;
  const mouthW    = dist(mouthL, mouthR) / faceH;

  // Eye openness (average of both eyes)
  const eyeOpen = (((lEyeBot[1] - lEyeTop[1]) + (rEyeBot[1] - rEyeTop[1])) / 2) / faceH;

  // Eyebrow raise: gap between eyebrow and eye top (larger = raised)
  const browRaise = (((lEyeTop[1] - lBrow[1]) + (rEyeTop[1] - rBrow[1])) / 2) / faceH;

  // Inner-brow vertical gap (small = brows lowered, anger) and horizontal
  // distance between inner brows (small = furrowed together, anger)
  const innerBrowGap  = (((lEyeTop[1] - lBrowIn[1]) + (rEyeTop[1] - rBrowIn[1])) / 2) / faceH;
  const innerBrowDist = dist(lBrowIn, rBrowIn) / faceH;

  return { smile, mouthOpen, mouthW, eyeOpen, browRaise, innerBrowGap, innerBrowDist };
}

// Sharpening factor for the softmax — makes a clear expression confidently
// exceed the hook's confidence threshold while leaving ambiguous frames low.
const SHARPEN = 2.2;

function softmax(scores) {
  const m = Math.max(...scores);
  const exps = scores.map((s) => Math.exp((s - m) * SHARPEN));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
}

/**
 * Classify an emotion probability vector from FaceMesh landmarks.
 * @returns {{ probabilities:number[], emotion:string, confidence:number, features:object }|null}
 */
export function classifyEmotion(landmarks, width = 640, height = 480) {
  const f = computeFeatures(landmarks, width, height);
  if (!f) return null;

  // ── Per-emotion scores (tuned around population-average neutral baselines) ──
  // HAPPY — corners lifted and/or mouth widened; open-mouth + smile = laughing.
  const happy =
      28 * pos(f.smile - 0.012)
    +  9 * pos(f.mouthW - 0.44)
    +  4 * pos(f.mouthOpen - 0.06) * (f.smile > 0.02 ? 1 : 0);

  // SURPRISE — raised brows, wide eyes, round open mouth; suppressed by smiling.
  const surprise =
      14 * pos(f.browRaise - 0.17)
    + 18 * pos(f.eyeOpen - 0.072)
    + 10 * pos(f.mouthOpen - 0.11)
    - 25 * pos(f.smile - 0.05);

  // SAD — mouth corners pulled down, narrowed eyes, inner brow raised (oblique).
  const sad =
      26 * pos(-f.smile - 0.012)
    + 14 * pos(0.05 - f.eyeOpen)
    +  8 * pos(f.innerBrowGap - 0.155);

  // ANGRY — inner brows lowered and drawn together, lips pressed; killed by smile.
  const angry =
      16 * pos(0.10 - f.innerBrowGap)
    + 12 * pos(0.15 - f.innerBrowDist)
    +  6 * pos(0.03 - f.mouthOpen)
    - 30 * pos(f.smile - 0.025);

  // NEUTRAL — constant floor; wins when nothing else is strongly expressed.
  const neutral = 1.0;

  // Order must match EMOTION_CLASSES: [Angry, Happy, Neutral, Sad, Surprise]
  const scores = [
    pos(angry),
    pos(happy),
    neutral,
    pos(sad),
    pos(surprise),
  ];

  const probabilities = softmax(scores);
  let maxI = 0;
  for (let i = 1; i < probabilities.length; i++) {
    if (probabilities[i] > probabilities[maxI]) maxI = i;
  }

  return {
    probabilities,
    emotion: EMOTION_CLASSES[maxI],
    confidence: probabilities[maxI],
    features: f,
  };
}

export default classifyEmotion;
