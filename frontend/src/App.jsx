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
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CircularProgress, Box } from '@mui/material';
import Home from './pages/Home';
import { MarsProvider } from './context/MarsContext';
import StarField from './components/StarField';
import Sidebar, { SIDEBAR_WIDTH_PX } from './components/Sidebar';

// Chargement differe : ces pages ne sont telechargees que quand l'utilisateur y navigue
const SlicePage = lazy(() => import('./pages/SlicePage'));
const TimeSeriesPage = lazy(() => import('./pages/TimeSeriesPage'));
const AnimationPage = lazy(() => import('./pages/AnimationPage'));
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const CrossSectionPage = lazy(() => import('./pages/CrossSectionPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

/** Couleurs du design system */
const MARS = '#e05a2b';
const CYAN = '#38bdf8';

/** Theme MUI dark — spatial futuriste glassmorphism */
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: MARS,
    },
    secondary: {
      main: CYAN,
    },
    background: {
      default: '#020818',
      paper: 'rgba(13, 27, 64, 0.6)',
    },
    text: {
      primary: 'rgba(255, 255, 255, 0.95)',
      secondary: 'rgba(255, 255, 255, 0.6)',
    },
  },
  typography: {
    fontFamily: "'Rajdhani', 'Roboto', sans-serif",
    h3: { fontFamily: "'Orbitron', sans-serif", fontWeight: 700 },
    h4: { fontFamily: "'Orbitron', sans-serif", fontWeight: 700 },
    h5: { fontFamily: "'Orbitron', sans-serif", fontWeight: 700 },
    h6: { fontFamily: "'Orbitron', sans-serif", fontWeight: 400 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: '#020818',
        },
      },
    },

    /** Paper — glassmorphism */
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(13, 27, 64, 0.6)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(56, 189, 248, 0.12)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          borderRadius: 16,
        },
      },
    },

    /** Button contained — gradient Mars + glow */
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          background: `linear-gradient(135deg, ${MARS}, #ff7043)`,
          boxShadow: `0 4px 20px ${alpha(MARS, 0.4)}`,
          fontWeight: 600,
          letterSpacing: '0.05em',
          '&:hover': {
            background: `linear-gradient(135deg, #ff7043, ${MARS})`,
            boxShadow: `0 6px 28px ${alpha(MARS, 0.6)}`,
          },
        },
        outlinedSecondary: {
          borderColor: alpha(CYAN, 0.5),
          color: CYAN,
          '&:hover': {
            borderColor: CYAN,
            backgroundColor: alpha(CYAN, 0.08),
            boxShadow: `0 0 16px ${alpha(CYAN, 0.2)}`,
          },
        },
      },
    },

    /** Slider — couleur Mars */
    MuiSlider: {
      styleOverrides: {
        root: {
          color: MARS,
          '& .MuiSlider-thumb': {
            boxShadow: `0 0 8px ${alpha(MARS, 0.4)}`,
          },
        },
      },
    },

    /** TextField — focus cyan */
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(56, 189, 248, 0.2)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(56, 189, 248, 0.4)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: CYAN,
            boxShadow: `0 0 12px ${alpha(CYAN, 0.15)}`,
          },
        },
      },
    },

    /** Select — dropdown glassmorphism */
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(13, 27, 64, 0.9)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(56, 189, 248, 0.12)',
        },
      },
    },

    /** ToggleButton — pour le speed control */
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(56, 189, 248, 0.2)',
          color: 'rgba(255, 255, 255, 0.6)',
          '&.Mui-selected': {
            backgroundColor: alpha(MARS, 0.2),
            color: '#fff',
            borderColor: alpha(MARS, 0.5),
            '&:hover': {
              backgroundColor: alpha(MARS, 0.3),
            },
          },
        },
      },
    },

    /** Alert — bordure glass */
    MuiAlert: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(56, 189, 248, 0.12)',
        },
      },
    },
  },
});

/** Spinner affiche pendant le chargement des pages lazy */
const Loading = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
    <CircularProgress />
  </Box>
);

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <StarField />
      <MarsProvider>
        <BrowserRouter>
          <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            <Box
              component="main"
              sx={{
                flex: 1,
                minHeight: '100vh',
                ml: { xs: 0, md: `${SIDEBAR_WIDTH_PX}px` },
                pt: { xs: 7, md: 0 },
              }}
            >
              <Suspense fallback={<Loading />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/slice" element={<SlicePage />} />
                  <Route path="/timeseries" element={<TimeSeriesPage />} />
                  <Route path="/animation" element={<AnimationPage />} />
                  <Route path="/explore" element={<ExplorePage />} />
                  <Route path="/crosssection" element={<CrossSectionPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </Box>
          </Box>
        </BrowserRouter>
      </MarsProvider>
    </ThemeProvider>
  );
}

export default App;
