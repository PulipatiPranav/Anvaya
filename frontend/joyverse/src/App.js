import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import { AccessibilityProvider, useAccessibility } from "./context/AccessibilityContext";
import AccessibilitySettingsModal from "./components/AccessibilitySettingsModal";
import WordPuzzleAdventure from "./pages/WordPuzzleAdventure";
import MathGame from "./pages/MathGame";
import Games from "./pages/Games";
import Quiz from "./pages/Quiz";
import LoginPage from "./pages/LoginPage";
import TherapistDashboard from "./pages/TherapistDashboard";
import WelcomeScreen from "./pages/WelcomeScreen";
import SyllableTapGame from "./pages/SyllableTapGame";
import ShapeMemoryGame from "./pages/ShapeMemoryGame";
import LetterBridge from "./pages/LetterBridge";
import MirrorWordsGame from "./pages/MirrorWordsGame";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import PhonemeTapGame          from "./pages/PhonemeTapGame";
import LetterSoundGame         from "./pages/LetterSoundGame";
import ConfusableLetterGame    from "./pages/ConfusableLetterGame";
import RANGame                 from "./pages/RANGame";
import VerbalMemoryGame        from "./pages/VerbalMemoryGame";
import ReportPage              from "./pages/ReportPage";

/** Floating accessibility button — inside provider so it can read context. */
function AccessibilityFAB() {
  const { setModalOpen } = useAccessibility();
  return (
    <button
      className="a11y-fab"
      onClick={() => setModalOpen(true)}
      aria-label="Open accessibility settings"
      title="Accessibility settings"
    >
      ♿
      <span className="a11y-fab-tooltip">Accessibility</span>
    </button>
  );
}

function App() {
  return (
    <AccessibilityProvider>
      <Router>
        <Routes>
          <Route path="/"                    element={<Navigate to="/loginpage" />} />
          <Route path="/loginpage"           element={<LoginPage />} />
          <Route path="/welcomepage"         element={<WelcomeScreen />} />
          <Route path="/games"               element={<Games />} />
          <Route path="/wordpuzzleadventure" element={<WordPuzzleAdventure />} />
          <Route path="/mathgame"            element={<MathGame />} />
          <Route path="/quiz"                element={<Quiz />} />
          <Route path="/syllabletapgame"     element={<SyllableTapGame />} />
          <Route path="/shapememorygame"     element={<ShapeMemoryGame />} />
          <Route path="/letterbridge"        element={<LetterBridge />} />
          <Route path="/mirrorword"          element={<MirrorWordsGame />} />
          <Route path="/phonemetap"          element={<PhonemeTapGame />} />
          <Route path="/lettersound"         element={<LetterSoundGame />} />
          <Route path="/confusableletter"    element={<ConfusableLetterGame />} />
          <Route path="/ran"                 element={<RANGame />} />
          <Route path="/verbalmemory"        element={<VerbalMemoryGame />} />
          <Route path="/therapistdashboard"  element={<TherapistDashboard />} />
          <Route path="/report/:childUsername" element={<ReportPage />} />
          <Route path="/superadmin"          element={<SuperAdminDashboard />} />
          <Route path="*"                    element={
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', minHeight: '100vh', gap: '24px',
              fontFamily: 'var(--font-opendyslexic)', textAlign: 'center', padding: '24px',
            }}>
              <span style={{ fontSize: '4rem' }} aria-hidden="true">🗺️</span>
              <h1 style={{ fontSize: '2rem', margin: 0, color: 'var(--text-primary)' }}>Page not found</h1>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>This page doesn't exist. Let's go somewhere fun!</p>
              <a href="/loginpage" style={{
                background: 'var(--brand-primary)', color: '#fff',
                padding: '12px 28px', borderRadius: 'var(--radius-md)',
                fontWeight: 700, textDecoration: 'none',
              }}>Go to Login</a>
            </div>
          } />
        </Routes>

        {/* Global accessibility modal + FAB rendered on every route */}
        <AccessibilitySettingsModal />
        <AccessibilityFAB />
      </Router>
    </AccessibilityProvider>
  );
}

export default App;
