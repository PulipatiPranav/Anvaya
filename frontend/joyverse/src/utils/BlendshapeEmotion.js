/**
 * BlendshapeEmotion — map MediaPipe Face Landmarker blendshapes to an emotion.
 *
 * The Face Landmarker outputs 52 ARKit-style blendshape coefficients in [0,1]
 * (mouthSmileLeft, browDownLeft, jawOpen, …). These are ML-derived and far more
 * robust across faces / lighting / pose than hand-tuned landmark geometry — yet
 * they're still produced 100% on-device, so the privacy story is unchanged.
 *
 * Returns the SAME shape as GeometricEmotion.classifyEmotion:
 *   { emotion, probabilities }  with probabilities in EMOTION_CLASSES order.
 * This keeps the EMA / hysteresis / theming pipeline in the hook untouched.
 */
import { EMOTION_CLASSES } from './GeometricEmotion';

/**
 * @param {Array<{categoryName: string, score: number}>} categories
 * @returns {{emotion: string, probabilities: number[]}|null}
 */
export function classifyFromBlendshapes(categories) {
  if (!Array.isArray(categories) || categories.length === 0) return null;

  const b = {};
  for (const c of categories) b[c.categoryName] = c.score;
  const g = (k) => b[k] || 0;
  const avg2 = (a, c) => (g(a) + g(c)) / 2;

  const smile       = avg2('mouthSmileLeft', 'mouthSmileRight');
  const frown       = avg2('mouthFrownLeft', 'mouthFrownRight');
  const browDown    = avg2('browDownLeft', 'browDownRight');
  const browOuterUp = avg2('browOuterUpLeft', 'browOuterUpRight');
  const browInnerUp = g('browInnerUp');
  const jawOpen     = g('jawOpen');
  const eyeWide     = avg2('eyeWideLeft', 'eyeWideRight');
  const mouthPress  = avg2('mouthPressLeft', 'mouthPressRight');
  const sneer       = avg2('noseSneerLeft', 'noseSneerRight');

  // When clearly smiling, damp the negative/surprise readings so a happy face
  // is never misread (the original production bug we guard against).
  const smiling   = smile > 0.35;
  const negDamp   = smiling ? 0.35 : 1;

  const happy    = smile * 1.3;
  const surprise = (jawOpen * 0.6 + eyeWide * 0.8 + browOuterUp * 0.7 + browInnerUp * 0.3)
                   * (smiling ? 0.5 : 1);
  const sad      = (frown * 1.2 + browInnerUp * 0.5) * negDamp;
  const angry    = (browDown * 1.2 + mouthPress * 0.5 + sneer * 0.5) * negDamp;

  // Neutral has a baseline so a relaxed face wins when nothing else is strong.
  const scores = {
    Angry:    angry,
    Happy:    happy,
    Neutral:  0.22,
    Sad:      sad,
    Surprise: surprise,
  };

  const vec = EMOTION_CLASSES.map((c) => Math.max(0, scores[c] || 0));
  const sum = vec.reduce((a, c) => a + c, 0) || 1;
  const probabilities = vec.map((v) => v / sum);

  let maxI = 0;
  for (let i = 1; i < probabilities.length; i++) {
    if (probabilities[i] > probabilities[maxI]) maxI = i;
  }
  return { emotion: EMOTION_CLASSES[maxI], probabilities };
}

export default classifyFromBlendshapes;
