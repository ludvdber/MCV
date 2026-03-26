import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'mcv-theme-mode';
const CONTRAST_KEY = 'mcv-high-contrast';

/** Couleurs du design system */
const MARS = '#e05a2b';
const CYAN = '#38bdf8';

/** Composants partages entre les deux themes */
function sharedComponents(mars, cyan) {
  return {
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          background: `linear-gradient(135deg, ${mars}, #ff7043)`,
          boxShadow: `0 4px 20px ${alpha(mars, 0.4)}`,
          fontWeight: 600,
          letterSpacing: '0.05em',
          '&:hover': {
            background: `linear-gradient(135deg, #ff7043, ${mars})`,
            boxShadow: `0 6px 28px ${alpha(mars, 0.6)}`,
          },
        },
        outlinedSecondary: {
          borderColor: alpha(cyan, 0.5),
          color: cyan,
          '&:hover': {
            borderColor: cyan,
            backgroundColor: alpha(cyan, 0.08),
            boxShadow: `0 0 16px ${alpha(cyan, 0.2)}`,
          },
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          color: mars,
          '& .MuiSlider-thumb': {
            boxShadow: `0 0 8px ${alpha(mars, 0.4)}`,
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderColor: alpha(cyan, 0.2),
          '&.Mui-selected': {
            backgroundColor: alpha(mars, 0.2),
            color: '#fff',
            borderColor: alpha(mars, 0.5),
            '&:hover': {
              backgroundColor: alpha(mars, 0.3),
            },
          },
        },
      },
    },
  };
}

/** Theme dark — spatial futuriste glassmorphism */
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: MARS },
    secondary: { main: CYAN },
    background: {
      default: '#020818',
      paper: 'rgba(13, 27, 64, 0.6)',
    },
    text: {
      primary: 'rgba(255, 255, 255, 0.95)',
      secondary: 'rgba(255, 255, 255, 0.75)',
    },
  },
  typography: {
    fontFamily: "'Rajdhani', 'Roboto', sans-serif",
    h3: { fontFamily: "'Orbitron', sans-serif", fontWeight: 700 },
    h4: { fontFamily: "'Orbitron', sans-serif", fontWeight: 700 },
    h5: { fontFamily: "'Orbitron', sans-serif", fontWeight: 700 },
    h6: { fontFamily: "'Orbitron', sans-serif", fontWeight: 400 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { background: '#020818' },
        '*, *::before, *::after': {
          '&:focus-visible': { outline: `2px solid ${CYAN}`, outlineOffset: 2 },
        },
      },
    },
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
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(56, 189, 248, 0.2)' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(56, 189, 248, 0.4)' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: CYAN,
            boxShadow: `0 0 12px ${alpha(CYAN, 0.15)}`,
          },
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(13, 27, 64, 0.9)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(56, 189, 248, 0.12)',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(56, 189, 248, 0.12)',
        },
      },
    },
    ...sharedComponents(MARS, CYAN),
  },
});

/** Couleurs adaptees au clair */
const MARS_LIGHT = '#c44b1f';
const CYAN_LIGHT = '#0284c7';

/** Theme clair — fond blanc, adapte pour publications */
const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: MARS_LIGHT },
    secondary: { main: CYAN_LIGHT },
    background: {
      default: '#f0f2f5',
      paper: '#ffffff',
    },
    text: {
      primary: '#1a1a2e',
      secondary: '#64748b',
    },
  },
  typography: {
    fontFamily: "'Rajdhani', 'Roboto', sans-serif",
    h3: { fontFamily: "'Orbitron', sans-serif", fontWeight: 700 },
    h4: { fontFamily: "'Orbitron', sans-serif", fontWeight: 700 },
    h5: { fontFamily: "'Orbitron', sans-serif", fontWeight: 700 },
    h6: { fontFamily: "'Orbitron', sans-serif", fontWeight: 400 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { background: '#f0f2f5' },
        '*, *::before, *::after': {
          '&:focus-visible': { outline: `2px solid ${MARS_LIGHT}`, outlineOffset: 2 },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#ffffff',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
          borderRadius: 16,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0, 0, 0, 0.18)' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0, 0, 0, 0.35)' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: MARS_LIGHT,
            boxShadow: `0 0 8px ${alpha(MARS_LIGHT, 0.15)}`,
          },
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#ffffff',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          '&.active': {
            backgroundColor: alpha(MARS_LIGHT, 0.08),
            borderLeftColor: MARS_LIGHT,
            color: MARS_LIGHT,
          },
        },
      },
    },
    ...sharedComponents(MARS_LIGHT, CYAN_LIGHT),
  },
});

function loadMode() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'dark';
  } catch {
    return 'dark';
  }
}

export function AppThemeProvider({ children }) {
  const [mode, setMode] = useState(loadMode);
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem(CONTRAST_KEY) === 'true');

  // Sync data-theme and data-contrast attributes on <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    if (highContrast) document.documentElement.setAttribute('data-contrast', 'high');
    else document.documentElement.removeAttribute('data-contrast');
  }, [mode, highContrast]);

  const toggleTheme = useCallback(() => {
    setMode(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const toggleContrast = useCallback(() => {
    setHighContrast(prev => {
      const next = !prev;
      localStorage.setItem(CONTRAST_KEY, String(next));
      return next;
    });
  }, []);

  const theme = mode === 'dark' ? darkTheme : lightTheme;

  const ctx = useMemo(() => ({ mode, toggleTheme, highContrast, toggleContrast }), [mode, toggleTheme, highContrast, toggleContrast]);

  return (
    <ThemeContext.Provider value={ctx}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

/**
 * @returns {{ mode: 'dark'|'light', toggleTheme: () => void, highContrast: boolean, toggleContrast: () => void }}
 */
export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within AppThemeProvider');
  return ctx;
}
