import React, { useState, useEffect } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';
import SpeechService, { TTS_VOICES } from '../services/SpeechService';
import { getConsent, setConsent, CONSENT_EVENT } from '../utils/cameraConsent';
import './AccessibilitySettingsModal.css';

const FONT_OPTIONS = [
  { value: 'opendyslexic', label: 'OpenDyslexic', desc: 'Dyslexia-friendly font' },
  { value: 'default',      label: 'Standard',     desc: 'System default font' },
];

const FONT_SIZE_OPTIONS = [
  { value: 'normal', label: 'Normal',      sample: 'Aa' },
  { value: 'large',  label: 'Large',       sample: 'Aa' },
  { value: 'xl',     label: 'Extra Large', sample: 'Aa' },
];

const LETTER_SPACING_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'wide',   label: 'Wide'   },
  { value: 'wider',  label: 'Wider'  },
];

const LINE_HEIGHT_OPTIONS = [
  { value: 'normal',  label: 'Normal'  },
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'loose',   label: 'Loose'   },
];

export default function AccessibilitySettingsModal() {
  const { settings, updateSetting, resetSettings, modalOpen, setModalOpen } =
    useAccessibility();

  const [cameraOn, setCameraOn] = useState(getConsent() === 'granted');
  useEffect(() => {
    const onChange = () => setCameraOn(getConsent() === 'granted');
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  if (!modalOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) setModalOpen(false);
  };

  return (
    <div
      className="a11y-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="a11y-modal-title"
      onClick={handleOverlayClick}
    >
      <div className="a11y-modal">
        {/* Header */}
        <div className="a11y-modal-header">
          <h2 id="a11y-modal-title" className="a11y-modal-title">
            Accessibility Settings
          </h2>
          <button
            className="a11y-close-btn"
            onClick={() => setModalOpen(false)}
            aria-label="Close accessibility settings"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="a11y-modal-body">

          {/* Font */}
          <section className="a11y-section">
            <h3 className="a11y-section-label">Font</h3>
            <div className="a11y-btn-group">
              {FONT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`a11y-option-btn a11y-font-btn ${settings.font === opt.value ? 'active' : ''}`}
                  onClick={() => updateSetting('font', opt.value)}
                  style={{
                    fontFamily:
                      opt.value === 'opendyslexic'
                        ? 'OpenDyslexic, sans-serif'
                        : "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  }}
                >
                  <span className="a11y-opt-label">{opt.label}</span>
                  <span className="a11y-opt-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Text Size */}
          <section className="a11y-section">
            <h3 className="a11y-section-label">Text Size</h3>
            <div className="a11y-btn-group">
              {FONT_SIZE_OPTIONS.map((opt, i) => (
                <button
                  key={opt.value}
                  className={`a11y-option-btn ${settings.fontSize === opt.value ? 'active' : ''}`}
                  onClick={() => updateSetting('fontSize', opt.value)}
                  style={{ fontSize: ['1rem', '1.15rem', '1.35rem'][i] }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* Letter Spacing */}
          <section className="a11y-section">
            <h3 className="a11y-section-label">Letter Spacing</h3>
            <div className="a11y-btn-group">
              {LETTER_SPACING_OPTIONS.map((opt, i) => (
                <button
                  key={opt.value}
                  className={`a11y-option-btn ${settings.letterSpacing === opt.value ? 'active' : ''}`}
                  onClick={() => updateSetting('letterSpacing', opt.value)}
                  style={{ letterSpacing: ['normal', '0.06em', '0.14em'][i] }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* Line Height */}
          <section className="a11y-section">
            <h3 className="a11y-section-label">Line Height</h3>
            <div className="a11y-btn-group">
              {LINE_HEIGHT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`a11y-option-btn ${settings.lineHeight === opt.value ? 'active' : ''}`}
                  onClick={() => updateSetting('lineHeight', opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* Reading Voice */}
          <section className="a11y-section">
            <h3 className="a11y-section-label">Reading Voice</h3>
            <div className="a11y-voice-row">
              <select
                className="a11y-voice-select"
                value={settings.ttsVoice}
                onChange={(e) => updateSetting('ttsVoice', e.target.value)}
                aria-label="Choose the reading voice"
              >
                {TTS_VOICES.map(v => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="a11y-voice-preview-btn"
                onClick={() => SpeechService.speak('Hello! Let us read together.', { rate: 0.9 })}
                aria-label="Preview the selected voice"
              >
                🔊 Preview
              </button>
            </div>
          </section>

          {/* Expression sensing (camera) — privacy-first, opt-in */}
          <section className="a11y-section">
            <h3 className="a11y-section-label">Expression Sensing</h3>
            <label className="a11y-toggle-row">
              <input
                type="checkbox"
                checked={cameraOn}
                onChange={(e) => setConsent(e.target.checked ? 'granted' : 'denied')}
                aria-label="Enable on-device expression sensing"
              />
              <span className="a11y-toggle-text">
                Use the camera to gently adapt games to how I'm feeling.
                <span className="a11y-toggle-note">
                  Runs 100% on this device — no video or images are ever sent or saved.
                </span>
              </span>
            </label>
          </section>

          {/* Live Preview */}
          <div className="a11y-preview" aria-label="Text preview">
            <p>The quick brown fox jumps over the lazy dog.</p>
            <p className="a11y-preview-letters">b &nbsp; d &nbsp; p &nbsp; q &nbsp; n &nbsp; u</p>
          </div>
        </div>

        {/* Footer */}
        <div className="a11y-modal-footer">
          <button className="a11y-reset-btn" onClick={resetSettings}>
            Reset to Default
          </button>
          <button className="a11y-done-btn" onClick={() => setModalOpen(false)}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
