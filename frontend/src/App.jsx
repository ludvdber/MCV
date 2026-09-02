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
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import { MarsProvider } from './context/MarsContext';
import { ToastProvider } from './context/ToastContext';
import { AppThemeProvider, useThemeMode } from './context/ThemeContext';
import StarField from './components/StarField';
import Sidebar, { SIDEBAR_WIDTH_EXPANDED, SIDEBAR_WIDTH_COLLAPSED } from './components/Sidebar';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import PageTransition from './components/PageTransition';
import { LazyMotion, domAnimation } from 'framer-motion';
import KeyboardShortcutsDialog from './components/KeyboardShortcutsDialog';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// mars.glb (~220 KB, meshopt-compressed) is lazy-loaded only when the Home page hero is visible.
// No preload — the 3D globe is not worth blocking TTI on other pages.

// Chargement differe : ces pages ne sont telechargees que quand l'utilisateur y navigue.
// Home aussi : il importe Three.js/R3F (globe + systeme solaire, ~1,1 Mo) qui,
// en import statique, se retrouvait modulepreload sur TOUTES les routes.
const Home = lazy(() => import('./pages/Home'));
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
const LegalPage = lazy(() => import('./pages/LegalPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

/* ─── SEO par route ────────────────────────────────────────────────────────
   Une SPA ne change ni <title> ni description au fil de la navigation : les
   moteurs voyaient douze pages identiques. Ce bloc met a jour titre, meta
   description, balises Open Graph / Twitter et lien canonique a chaque
   changement de route ET de langue (Google rend le JavaScript). */

// Injecte par Vite (define) depuis SITE_URL de vite.config.js — l'IASB ne change
// l'URL qu'a un seul endroit (voir le bloc SITE_URL de vite.config.js).
const SITE_URL = __SITE_URL__;
const BRAND = 'Mars Climate Viewer';

/** route → [cle i18n du nom de page, cle i18n de la description].
 *  L'accueil est traite a part (titre = marque + promesse). */
const ROUTE_META = {
  '/slice':            ['nav.slice', 'meta.slice'],
  '/timeseries':       ['nav.timeseries', 'meta.timeseries'],
  '/animation':        ['nav.animation', 'meta.animation'],
  '/explore':          ['nav.explore', 'meta.explore'],
  '/crosssection':     ['nav.crosssection', 'meta.crosssection'],
  '/profile':          ['nav.profile', 'meta.profile'],
  '/hovmoller':        ['nav.hovmoller', 'meta.hovmoller'],
  '/zonalmean':        ['nav.zonalmean', 'meta.zonalmean'],
  '/windrose':         ['nav.windrose', 'meta.windrose'],
  '/difference':       ['nav.difference', 'meta.difference'],
  '/temporal-profile': ['nav.temporalprofile', 'meta.temporalprofile'],
  '/legal':            ['nav.legal', 'meta.legal'],
};

function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function usePageMeta(pathname) {
  const { t, i18n: i18next } = useTranslation();
  useEffect(() => {
    const entry = ROUTE_META[pathname];
    const title = pathname === '/'
      ? `${BRAND} · ${t('meta.homeTitle')}`
      : entry ? `${t(entry[0])} · ${BRAND}` : BRAND;
    const desc = t(entry ? entry[1] : 'meta.home');

    document.title = title;
    upsertMeta('name', 'description', desc);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', desc);
    upsertMeta('property', 'og:url', SITE_URL + pathname);
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', desc);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = SITE_URL + pathname;
  }, [pathname, t, i18next.language]);
}

/** Spinner affiche pendant le chargement des pages lazy */
const Loading = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
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
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 2 }}>
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
  const { t } = useTranslation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const sidebarWidth = sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  // Titre, description, Open Graph et canonique suivent la route et la langue.
  usePageMeta(location.pathname);

  // Revient en haut de page à chaque changement de route.
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  // La console Explorer réclame de la largeur : la nav se replie en rail
  // d'icônes à l'entrée (le bouton d'expansion reste visible sur le bord),
  // et se redéploie en quittant la page.
  useEffect(() => {
    // Synchro état↔route assumée (l'utilisateur peut ensuite replier/déplier).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarCollapsed(location.pathname === '/explore');
    const id = setTimeout(() => window.dispatchEvent(new Event('resize')), 260);
    return () => clearTimeout(id);
  }, [location.pathname]);

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
            // minWidth 0 : sans lui, la min-content d'une page (ex. rangee
            // d'onglets de l'Explorer) se propage et force un scroll horizontal.
            minWidth: 0,
            minHeight: '100vh',
            ml: { xs: 0, md: `${sidebarWidth}px` },
            pt: { xs: 7, md: 0 },
            transition: 'margin-left 0.2s ease',
          }}
        >
          <Suspense fallback={<Loading />}>
            <LazyMotion features={domAnimation}>
            {/* key={pathname} : reinitialise le filet de securite en changeant
                de route (une page plantee redevient saine des qu'on la quitte). */}
            <RouteErrorBoundary key={location.pathname} t={t}>
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
                <Route path="/legal" element={<PageTransition><LegalPage /></PageTransition>} />
                <Route path="*" element={<PageTransition><NotFoundPage /></PageTransition>} />
              </Routes>
            </RouteErrorBoundary>
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
