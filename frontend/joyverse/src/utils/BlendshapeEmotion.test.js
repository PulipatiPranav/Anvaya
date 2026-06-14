import { describe, it, expect } from 'vitest';
import { classifyFromBlendshapes } from './BlendshapeEmotion';

// Helper: build a categories array from a sparse map of blendshape→score.
function bs(overrides = {}) {
  return Object.entries(overrides).map(([categoryName, score]) => ({ categoryName, score }));
}

describe('BlendshapeEmotion', () => {
  it('returns null for empty input', () => {
    expect(classifyFromBlendshapes([])).toBeNull();
    expect(classifyFromBlendshapes(null)).toBeNull();
  });

  it('classifies a relaxed face as Neutral', () => {
    // A relaxed face still reports all categories, just at near-zero scores.
    const relaxed = bs({
      mouthSmileLeft: 0.03, mouthSmileRight: 0.02, browDownLeft: 0.02,
      jawOpen: 0.04, eyeWideLeft: 0.03, browInnerUp: 0.02,
    });
    expect(classifyFromBlendshapes(relaxed).emotion).toBe('Neutral');
  });

  it('classifies strong smile as Happy', () => {
    const r = classifyFromBlendshapes(bs({ mouthSmileLeft: 0.8, mouthSmileRight: 0.8 }));
    expect(r.emotion).toBe('Happy');
  });

  it('REGRESSION: a smile is never read as Angry or Sad', () => {
    // Smile plus some brow noise must still resolve to Happy, not negative.
    const r = classifyFromBlendshapes(bs({
      mouthSmileLeft: 0.8, mouthSmileRight: 0.8,
      browDownLeft: 0.3, browDownRight: 0.3, mouthFrownLeft: 0.2,
    }));
    expect(r.emotion).not.toBe('Angry');
    expect(r.emotion).not.toBe('Sad');
    expect(r.emotion).toBe('Happy');
  });

  it('classifies frown + inner brow as Sad', () => {
    const r = classifyFromBlendshapes(bs({
      mouthFrownLeft: 0.7, mouthFrownRight: 0.7, browInnerUp: 0.4,
    }));
    expect(r.emotion).toBe('Sad');
  });

  it('classifies lowered brows + mouth press as Angry', () => {
    const r = classifyFromBlendshapes(bs({
      browDownLeft: 0.8, browDownRight: 0.8, mouthPressLeft: 0.4, mouthPressRight: 0.4,
    }));
    expect(r.emotion).toBe('Angry');
  });

  it('classifies open jaw + wide eyes + raised brows as Surprise', () => {
    const r = classifyFromBlendshapes(bs({
      jawOpen: 0.7, eyeWideLeft: 0.6, eyeWideRight: 0.6,
      browOuterUpLeft: 0.6, browOuterUpRight: 0.6,
    }));
    expect(r.emotion).toBe('Surprise');
  });

  it('always returns a normalized 5-class probability vector', () => {
    const r = classifyFromBlendshapes(bs({ mouthSmileLeft: 0.5, mouthSmileRight: 0.5 }));
    expect(r.probabilities).toHaveLength(5);
    const sum = r.probabilities.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});
