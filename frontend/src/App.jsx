/**
 * Composant racine de l'application Mars Climate Viewer.
 *
 * - ThemeProvider : applique le theme MUI dark spatial (glassmorphism)
 * - CssBaseline : reset CSS normalise par MUI
 * - StarField : fond anime d'etoiles CSS
 * - BrowserRouter + Routes : navigation entre les pages
 * - Suspense + lazy : SlicePage, TimeSeriesPage, AnimationPage et TestSelectors
 *   sont charges a la demande pour eviter que Plotly.js (~1 MB) bloque le chargement
 *   de la page d'accueil
 */
import { lazy, Suspense, Component, useState, useEffect, useMemo, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { CircularProgress, Box, Typography, Button } from '@mui/material';
import i18n from './i18n';
import Home from './pages/Home';
import { MarsProvider } from './context/MarsContext';
import { ToastProvider } from './context/ToastContext';
import { AppThemeProvider, useThemeMode } from './context/ThemeContext';
import StarField from './components/StarField';
import Sidebar, { SIDEBAR_WIDTH_EXPANDED, SIDEBAR_WIDTH_COLLAPSED } from './components/Sidebar';
import PageTransition from './components/PageTransition';
import { LazyMotion, domAnimation } from 'framer-motion';
import KeyboardShortcutsDialog from './components/KeyboardShortcutsDialog';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// mars.glb (~220 KB, meshopt-compressed) is lazy-loaded only when the Home page hero is visible.
// No preload — the 3D globe is not worth blocking TTI on other pages.

// Chargement differe : ces pages ne sont telechargees que quand l'utilisateur y navigue
const SlicePage = lazy(() => import('./pages/SlicePage'));
const TimeSeriesPage = lazy(() => import('./pages/TimeSeriesPage'));
const AnimationPage = lazy(() => import('./pages/AnimationPage'));
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const CrossSectionPage = lazy(() => import('./pages/CrossSectionPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const HovmollerPage = lazy(() => import('./pages/HovmollerPage'));
const ZonalMeanPage = lazy(() => import('./pages/ZonalMeanPage'));
const WindRosePage = lazy(() => import('./pages/WindRosePage'));
const DifferencePage = lazy(() => import('./pages/DifferencePage'));
const TemporalProfilePage = lazy(() => import('./pages/TemporalProfilePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

/** Spinner affiche pendant le chargement des pages lazy */
const Loading = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
    <CircularProgress />
  </Box>
);

/** ErrorBoundary — attrape les erreurs de rendu React pour eviter un ecran blanc */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="50vh" gap={2}>
          <Typography variant="h5" color="error">{i18n.t('error.boundary')}</Typography>
          <Button variant="contained" onClick={() => { this.setState({ hasError: false }); window.location.replace('/'); }}>
            {i18n.t('error.backHome')}
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const sidebarWidth = sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  // Revient en haut de page à chaque changement de route.
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  const toggleShortcuts = useCallback(() => setShortcutsOpen(v => !v), []);

  const globalShortcuts = useMemo(() => ({
    '?': () => setShortcutsOpen(v => !v),
    Escape: () => {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else setShortcutsOpen(false);
    },
  }), []);
  useKeyboardShortcuts(globalShortcuts);

  return (
    <>
      <KeyboardShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', minHeight: '100vh' }}>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => { setSidebarCollapsed(prev => !prev); setTimeout(() => window.dispatchEvent(new Event('resize')), 250); }}
          onShortcutsOpen={toggleShortcuts}
        />
        <Box
          component="main"
          sx={{
            flex: 1,
            minHeight: '100vh',
            ml: { xs: 0, md: `${sidebarWidth}px` },
            pt: { xs: 7, md: 0 },
            transition: 'margin-left 0.2s ease',
          }}
        >
          <Suspense fallback={<Loading />}>
            <LazyMotion features={domAnimation}>
            {/* key={pathname} rejoue le fondu d'entrée à chaque page. Pas
                d'AnimatePresence : il re-parentait le Canvas R3F de l'accueil
                pendant la navigation, ce qui plantait Three.js. */}
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={<PageTransition><Home /></PageTransition>} />
                <Route path="/slice" element={<PageTransition><SlicePage /></PageTransition>} />
                <Route path="/timeseries" element={<PageTransition><TimeSeriesPage /></PageTransition>} />
                <Route path="/animation" element={<PageTransition><AnimationPage /></PageTransition>} />
                <Route path="/explore" element={<PageTransition><ExplorePage /></PageTransition>} />
                <Route path="/crosssection" element={<PageTransition><CrossSectionPage /></PageTransition>} />
                <Route path="/profile" element={<PageTransition><ProfilePage /></PageTransition>} />
                <Route path="/hovmoller" element={<PageTransition><HovmollerPage /></PageTransition>} />
                <Route path="/zonalmean" element={<PageTransition><ZonalMeanPage /></PageTransition>} />
                <Route path="/windrose" element={<PageTransition><WindRosePage /></PageTransition>} />
                <Route path="/difference" element={<PageTransition><DifferencePage /></PageTransition>} />
                <Route path="/temporal-profile" element={<PageTransition><TemporalProfilePage /></PageTransition>} />
                <Route path="*" element={<PageTransition><NotFoundPage /></PageTransition>} />
              </Routes>
            </LazyMotion>
          </Suspense>
        </Box>
      </Box>
    </>
  );
}

function AppWithTheme() {
  const { mode } = useThemeMode();
  return (
    <>
      {mode === 'dark' && <StarField />}
      <ErrorBoundary>
        <ToastProvider>
          <MarsProvider>
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </MarsProvider>
        </ToastProvider>
      </ErrorBoundary>
    </>
  );
}

function App() {
  return (
    <AppThemeProvider>
      <AppWithTheme />
    </AppThemeProvider>
  );
}

export default App;
