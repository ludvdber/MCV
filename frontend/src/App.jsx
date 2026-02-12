/**
 * Composant racine de l'application Mars Climate Viewer.
 *
 * - ThemeProvider : applique le theme MUI (orange Mars #d84315)
 * - CssBaseline : reset CSS normalise par MUI
 * - BrowserRouter + Routes : navigation entre les pages
 * - Suspense + lazy : SlicePage, TimeSeriesPage, AnimationPage et TestSelectors
 *   sont charges a la demande pour eviter que Plotly.js (~1 MB) bloque le chargement
 *   de la page d'accueil
 */
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CircularProgress, Box } from '@mui/material';
import Home from './pages/Home';

// Chargement differe : ces pages ne sont telechargees que quand l'utilisateur y navigue
const SlicePage = lazy(() => import('./pages/SlicePage'));
const TimeSeriesPage = lazy(() => import('./pages/TimeSeriesPage'));
const AnimationPage = lazy(() => import('./pages/AnimationPage'));
const TestSelectors = lazy(() => import('./pages/TestSelectors'));

/** Theme MUI — couleur primaire orange Mars */
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#d84315',
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
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/slice" element={<SlicePage />} />
            <Route path="/timeseries" element={<TimeSeriesPage />} />
            <Route path="/animation" element={<AnimationPage />} />
            <Route path="/test" element={<TestSelectors />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
