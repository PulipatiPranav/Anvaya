import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import "./App.css";
import { AccessibilityProvider, useAccessibility } from "./context/AccessibilityContext";
import AccessibilitySettingsModal from "./components/AccessibilitySettingsModal";
import CameraConsentModal from "./components/CameraConsentModal";
import ErrorBoundary from "./components/ErrorBoundary";
import SpeechService from "./services/SpeechService";
import { EmotionProvider } from "./hooks/useEmotionDetection";

// Routed pages are code-split so the login screen no longer downloads every
// game's code up front. Each chunk loads on demand behind <Suspense>.
const WordPuzzleAdventure = lazy(() => import("./pages/WordPuzzleAdventure"));
const MathGame            = lazy(() => import("./pages/MathGame"));
const Games               = lazy(() => import("./pages/Games"));
const Quiz                = lazy(() => import("./pages/Quiz"));
const LoginPage           = lazy(() => import("./pages/LoginPage"));
const TherapistDashboard  = lazy(() => import("./pages/TherapistDashboard"));
const WelcomeScreen       = lazy(() => import("./pages/WelcomeScreen"));
const SyllableTapGame     = lazy(() => import("./pages/SyllableTapGame"));
const ShapeMemoryGame     = lazy(() => import("./pages/ShapeMemoryGame"));
const LetterBridge        = lazy(() => import("./pages/LetterBridge"));
const MirrorWordsGame     = lazy(() => import("./pages/MirrorWordsGame"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const PhonemeTapGame      = lazy(() => import("./pages/PhonemeTapGame"));
const LetterSoundGame     = lazy(() => import("./pages/LetterSoundGame"));
const ConfusableLetterGame = lazy(() => import("./pages/ConfusableLetterGame"));
const RANGame             = lazy(() => import("./pages/RANGame"));
const VerbalMemoryGame    = lazy(() => import("./pages/VerbalMemoryGame"));
const ReportPage          = lazy(() => import("./pages/ReportPage"));
const ReadingFluency      = lazy(() => import("./pages/ReadingFluency"));
const SightWordDrill      = lazy(() => import("./pages/SightWordDrill"));
const MorphologyGame      = lazy(() => import("./pages/MorphologyGame"));
const AchievementDashboard = lazy(() => import("./pages/AchievementDashboard"));
const MyProgress           = lazy(() => import("./pages/MyProgress"));

/** Friendly full-screen loader shown while a route chunk downloads. */
function RouteLoading() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', gap: '16px', fontFamily: 'var(--font-opendyslexic, sans-serif)',
    }}>
      <div className="route-spinner" aria-hidden="true" />
      <p style={{ color: 'var(--text-secondary, #6b7280)', margin: 0 }}>Loading…</p>
    </div>
  );
}

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

/** Routes wrapped in an error boundary that auto-resets when the path changes. */
function AppRoutes() {
  const location = useLocation();

  // Stop any in-progress speech whenever the route changes, so TTS never
  // bleeds from one screen (or a closed game) into the next.
  useEffect(() => {
    SpeechService.stop();
  }, [location.pathname]);

  return (
    <ErrorBoundary resetKey={location.pathname} homeHref="/games">
      <Suspense fallback={<RouteLoading />}>
        <Routes location={location}>
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
          <Route path="/reading-fluency"     element={<ReadingFluency />} />
          <Route path="/sight-words"         element={<SightWordDrill />} />
          <Route path="/morphology-builder"  element={<MorphologyGame />} />
          <Route path="/achievements"        element={<AchievementDashboard />} />
          <Route path="/my-progress"         element={<MyProgress />} />
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
      </Suspense>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <AccessibilityProvider>
      <Router>
        <EmotionProvider>
          <AppRoutes />

          {/* Global accessibility modal + FAB rendered on every route */}
          <AccessibilitySettingsModal />
          <AccessibilityFAB />
          <CameraConsentModal />
        </EmotionProvider>
      </Router>
    </AccessibilityProvider>
  );
}

export default App;
