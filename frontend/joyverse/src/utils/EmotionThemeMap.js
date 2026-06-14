/**
 * Central emotion → visual theme mapping.
 *
 * applyEmotionTheme() uses two fixed-position overlay divs (#jv-bg-a / #jv-bg-b)
 * that crossfade via CSS opacity transitions.  This is the only way to smoothly
 * transition between background-images; native CSS cannot transition background-image.
 */

export const EmotionThemeMap = {
  Happy: {
    backgroundImage: "url('/gameBackgrounds/happy.jpg')",
    backgroundColor: '#fffde7',
    cssVars: {
      '--card-color':       '#F8FD89',
      '--button-bg':        '#EDD1B0',
      '--button-hover-bg':  '#e2c0a0',
      '--button-text':      '#333333',
      '--text-color':       '#333333',
      '--score-color':      '#EDD1B0',
    },
    cardStyle: { backgroundColor: '#F8FD89', color: '#333333' },
  },
  Sad: {
    backgroundImage: "url('/gameBackgrounds/sad.jpg')",
    backgroundColor: '#e8f5e9',
    cssVars: {
      '--card-color':       '#D8FAD2',
      '--button-bg':        '#CDE8B0',
      '--button-hover-bg':  '#b9d9a2',
      '--button-text':      '#3B2F2F',
      '--text-color':       '#3B2F2F',
      '--score-color':      '#CDE8B0',
    },
    cardStyle: { backgroundColor: '#D8FAD2', color: '#3B2F2F' },
  },
  Angry: {
    backgroundImage: "url('/gameBackgrounds/angry.jpg')",
    backgroundColor: '#e0f7fa',
    cssVars: {
      '--card-color':       '#A5F7E1',
      '--button-bg':        '#96ADFC',
      '--button-hover-bg':  '#8198f0',
      '--button-text':      '#223344',
      '--text-color':       '#223344',
      '--score-color':      '#96ADFC',
    },
    cardStyle: { backgroundColor: '#A5F7E1', color: '#223344' },
  },
  Neutral: {
    backgroundImage: "url('/gameBackgrounds/neutral.jpg')",
    backgroundColor: '#fafafa',
    cssVars: {
      '--card-color':       '#F9F9F3',
      '--button-bg':        '#E6E6FA',
      '--button-hover-bg':  '#d8d8ef',
      '--button-text':      '#2C2C2C',
      '--text-color':       '#2C2C2C',
      '--score-color':      '#E6E6FA',
    },
    cardStyle: { backgroundColor: '#F9F9F3', color: '#2C2C2C' },
  },
  Surprise: {
    backgroundImage: "url('/gameBackgrounds/surprise.jpg')",
    backgroundColor: '#fff3e0',
    cssVars: {
      '--card-color':       '#FFDAB9',
      '--button-bg':        '#FFFACD',
      '--button-hover-bg':  '#f2eebf',
      '--button-text':      '#4B0082',
      '--text-color':       '#4B0082',
      '--score-color':      '#FFFACD',
    },
    cardStyle: { backgroundColor: '#FFDAB9', color: '#4B0082' },
  },
};

/** Inline React style for a game card based on detected emotion. */
export function getCardStyle(emotion) {
  return EmotionThemeMap[emotion]?.cardStyle ?? EmotionThemeMap.Neutral.cardStyle;
}

// ── Crossfade implementation ──────────────────────────────────────────────────

const LAYER_BASE_STYLE = [
  'position:fixed',
  'inset:0',
  'background-size:cover',
  'background-position:center',
  'background-repeat:no-repeat',
  'pointer-events:none',
  'transition:opacity 0.85s ease',
].join(';');

let _activeLayer = 'a'; // which layer is currently the front (opacity:1)
let _initialised = false;

function _ensureLayers() {
  let a = document.getElementById('jv-bg-a');
  let b = document.getElementById('jv-bg-b');

  if (!a) {
    a = document.createElement('div');
    a.id = 'jv-bg-a';
    a.setAttribute('aria-hidden', 'true');
    a.style.cssText = `${LAYER_BASE_STYLE};z-index:-2;opacity:1;`;
    document.body.prepend(a);
  }
  if (!b) {
    b = document.createElement('div');
    b.id = 'jv-bg-b';
    b.setAttribute('aria-hidden', 'true');
    b.style.cssText = `${LAYER_BASE_STYLE};z-index:-1;opacity:0;`;
    document.body.prepend(b);
  }
  return [a, b];
}

/**
 * Applies an emotion theme to the document.
 * First call: immediate (no animation). Subsequent calls: 0.85 s opacity crossfade.
 */
export function applyEmotionTheme(emotion) {
  const theme = EmotionThemeMap[emotion];
  if (!theme) return;

  // Expose the mood to CSS so the UI can tune visual intensity / motion
  // (calming for Angry/Sad, vibrant for Happy/Surprise) — see global.css.
  document.documentElement.setAttribute('data-emotion', emotion);

  // Respect the user's reduced-motion preference: swap the crossfade for an
  // instant change so nothing animates for vestibular-sensitive children.
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fade = reduceMotion ? 'none' : 'opacity 0.85s ease';

  const [layerA, layerB] = _ensureLayers();

  // Strip any direct body background so the layers show through
  document.body.style.removeProperty('background-image');
  document.body.style.removeProperty('background-size');
  document.body.style.removeProperty('background-position');
  document.body.style.removeProperty('background-repeat');

  if (!_initialised) {
    // First call — set instantly, no fade
    layerA.style.transition = 'none';
    layerA.style.backgroundImage = theme.backgroundImage;
    layerA.style.opacity = '1';
    layerB.style.opacity = '0';
    _activeLayer = 'a';
    _initialised = true;
    // Restore transition after next paint
    requestAnimationFrame(() => {
      layerA.style.transition = fade;
    });
  } else {
    // Subsequent calls — crossfade between layers
    const front = _activeLayer === 'a' ? layerA : layerB;
    const back  = _activeLayer === 'a' ? layerB : layerA;

    front.style.transition = fade;
    back.style.transition  = fade;
    back.style.backgroundImage = theme.backgroundImage;
    back.style.zIndex = '-1';
    front.style.zIndex = '-2';

    // Trigger reflow so the transition picks up the old opacity
    void back.offsetHeight;

    back.style.opacity  = '1';
    front.style.opacity = '0';

    _activeLayer = _activeLayer === 'a' ? 'b' : 'a';
  }

  // Update CSS custom properties on :root
  const root = document.documentElement;
  Object.entries(theme.cssVars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}
