import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, alpha, useColorScheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const ThemeContext = createContext(null);

const MODE_KEY = 'mcv-theme-mode';
const CONTRAST_KEY = 'mcv-high-contrast';

/** Couleurs du design system (dark) */
const MARS = '#e05a2b';
const CYAN = '#38bdf8';
/** Couleurs adaptees au clair */
const MARS_LIGHT = '#c44b1f';
const CYAN_LIGHT = '#0284c7';

/**
 * Thème unique piloté par CSS variables (`cssVariables`) et deux color schemes.
 *
 * Bascule clair/sombre = MUI retourne l'attribut `data-theme` sur <html> et les
 * variables CSS changent : AUCUN re-render de l'arbre React (contrairement à
 * l'ancien `mode === 'dark' ? darkTheme : lightTheme`). Le sélecteur est calé
 * sur `data-theme` pour partager l'attribut avec les variables de `index.css`
 * (`--mars-orange`, `--bg-surface`…), qui restent la source des tokens « glass ».
 *
 * Les styles de composants propres à un scheme passent par `theme.applyStyles(
 * 'dark' | 'light', …)` : on reproduit EXACTEMENT les anciens overrides, pas de
 * dérive visuelle. Le contraste élevé reste géré à part (attribut `data-contrast`).
 */
const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-theme' },
  defaultColorScheme: 'dark',
  colorSchemes: {
    dark: {
      palette: {
        mode: 'dark',
        primary: { main: MARS },
        secondary: { main: CYAN },
        background: { default: '#020818', paper: 'rgba(13, 27, 64, 0.6)' },
        text: { primary: 'rgba(255, 255, 255, 0.95)', secondary: 'rgba(255, 255, 255, 0.75)' },
      },
    },
    light: {
      palette: {
        mode: 'light',
        primary: { main: MARS_LIGHT },
        secondary: { main: CYAN_LIGHT },
        background: { default: '#f0f2f5', paper: '#ffffff' },
        text: { primary: '#1a1a2e', secondary: '#64748b' },
      },
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
      styleOverrides: (themeParam) => ({
        body: {
          ...themeParam.applyStyles('dark', { background: '#020818' }),
          ...themeParam.applyStyles('light', { background: '#f0f2f5' }),
        },
        '*, *::before, *::after': {
          '&:focus-visible': { outline: `2px solid ${CYAN}`, outlineOffset: 2 },
        },
      }),
    },
    MuiPaper: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          backgroundImage: 'none',
          borderRadius: 16,
          ...t.applyStyles('dark', {
            backgroundColor: 'rgba(13, 27, 64, 0.6)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(56, 189, 248, 0.12)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }),
          // En thème clair, le fond, l'aplatissement du glass et l'ombre du
          // Paper sont pilotés par index.css ([data-theme='light'] .MuiPaper-root,
          // en !important) : source unique qui rend toutes les surfaces blanches
          // opaques. On ne garde ici que la bordure structurelle (largeur + style),
          // dont index.css ne fixe que la couleur. Évite un doublon mort : l'ancienne
          // ombre 0 1px 4px était déjà écrasée par le 0 1px 6px d'index.css.
          ...t.applyStyles('light', {
            border: '1px solid rgba(0, 0, 0, 0.08)',
          }),
        }),
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          ...t.applyStyles('dark', {
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(56, 189, 248, 0.2)' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(56, 189, 248, 0.4)' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: CYAN,
              boxShadow: `0 0 12px ${alpha(CYAN, 0.15)}`,
            },
          }),
          ...t.applyStyles('light', {
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0, 0, 0, 0.18)' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0, 0, 0, 0.35)' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: MARS_LIGHT,
              boxShadow: `0 0 8px ${alpha(MARS_LIGHT, 0.15)}`,
            },
          }),
        }),
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: ({ theme: t }) => ({
          ...t.applyStyles('dark', {
            backgroundColor: 'rgba(13, 27, 64, 0.9)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(56, 189, 248, 0.12)',
          }),
          ...t.applyStyles('light', {
            backgroundColor: '#ffffff',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
          }),
        }),
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          ...t.applyStyles('dark', {
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(56, 189, 248, 0.12)',
          }),
          ...t.applyStyles('light', {
            border: '1px solid rgba(0, 0, 0, 0.1)',
          }),
        }),
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          ...t.applyStyles('light', {
            '&.active': {
              backgroundColor: alpha(MARS_LIGHT, 0.08),
              borderLeftColor: MARS_LIGHT,
              color: MARS_LIGHT,
            },
          }),
        }),
      },
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: ({ theme: t }) => ({
          fontWeight: 600,
          letterSpacing: '0.05em',
          ...t.applyStyles('dark', {
            background: `linear-gradient(135deg, ${MARS}, #ff7043)`,
            boxShadow: `0 4px 20px ${alpha(MARS, 0.4)}`,
            '&:hover': {
              background: `linear-gradient(135deg, #ff7043, ${MARS})`,
              boxShadow: `0 6px 28px ${alpha(MARS, 0.6)}`,
            },
          }),
          ...t.applyStyles('light', {
            background: `linear-gradient(135deg, ${MARS_LIGHT}, #ff7043)`,
            boxShadow: `0 4px 20px ${alpha(MARS_LIGHT, 0.4)}`,
            '&:hover': {
              background: `linear-gradient(135deg, #ff7043, ${MARS_LIGHT})`,
              boxShadow: `0 6px 28px ${alpha(MARS_LIGHT, 0.6)}`,
            },
          }),
        }),
        outlinedSecondary: ({ theme: t }) => ({
          ...t.applyStyles('dark', {
            borderColor: alpha(CYAN, 0.5),
            color: CYAN,
            '&:hover': {
              borderColor: CYAN,
              backgroundColor: alpha(CYAN, 0.08),
              boxShadow: `0 0 16px ${alpha(CYAN, 0.2)}`,
            },
          }),
          ...t.applyStyles('light', {
            borderColor: alpha(CYAN_LIGHT, 0.5),
            color: CYAN_LIGHT,
            '&:hover': {
              borderColor: CYAN_LIGHT,
              backgroundColor: alpha(CYAN_LIGHT, 0.08),
              boxShadow: `0 0 16px ${alpha(CYAN_LIGHT, 0.2)}`,
            },
          }),
        }),
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          ...t.applyStyles('dark', {
            color: MARS,
            '& .MuiSlider-thumb': { boxShadow: `0 0 8px ${alpha(MARS, 0.4)}` },
          }),
          ...t.applyStyles('light', {
            color: MARS_LIGHT,
            '& .MuiSlider-thumb': { boxShadow: `0 0 8px ${alpha(MARS_LIGHT, 0.4)}` },
          }),
        }),
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          ...t.applyStyles('dark', {
            borderColor: alpha(CYAN, 0.2),
            '&.Mui-selected': {
              backgroundColor: alpha(MARS, 0.2),
              color: '#fff',
              borderColor: alpha(MARS, 0.5),
              '&:hover': { backgroundColor: alpha(MARS, 0.3) },
            },
          }),
          ...t.applyStyles('light', {
            borderColor: alpha(CYAN_LIGHT, 0.2),
            '&.Mui-selected': {
              backgroundColor: alpha(MARS_LIGHT, 0.2),
              color: '#fff',
              borderColor: alpha(MARS_LIGHT, 0.5),
              '&:hover': { backgroundColor: alpha(MARS_LIGHT, 0.3) },
            },
          }),
        }),
      },
    },
  },
});

/** Lecture directe du localStorage : sert de valeur initiale avant que
 *  useColorScheme ne se résolve (évite un flash de mode au premier rendu). */
function storedMode() {
  try {
    const m = localStorage.getItem(MODE_KEY);
    if (m === 'light' || m === 'dark') return m;
  } catch { /* accès localStorage refusé */ }
  return 'dark';
}

/**
 * Pont entre useColorScheme (MUI) et l'API historique useThemeMode.
 * Doit vivre SOUS le MuiThemeProvider (useColorScheme requiert le contexte vars).
 */
function ThemeModeBridge({ children }) {
  const { mode, systemMode, setMode } = useColorScheme();
  // mode peut être 'system' ou undefined (avant résolution) -> on retombe sur le
  // scheme effectif, avec le localStorage comme filet initial.
  const resolved = (mode === 'system' ? systemMode : mode) || storedMode();

  const [highContrast, setHighContrast] = useState(() => {
    try { return localStorage.getItem(CONTRAST_KEY) === 'true'; } catch { return false; }
  });

  useEffect(() => {
    if (highContrast) document.documentElement.setAttribute('data-contrast', 'high');
    else document.documentElement.removeAttribute('data-contrast');
  }, [highContrast]);

  const toggleTheme = useCallback(() => {
    setMode(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setMode]);

  const toggleContrast = useCallback(() => {
    setHighContrast(prev => {
      const next = !prev;
      try { localStorage.setItem(CONTRAST_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const ctx = useMemo(
    () => ({ mode: resolved, toggleTheme, highContrast, toggleContrast }),
    [resolved, toggleTheme, highContrast, toggleContrast],
  );

  return <ThemeContext.Provider value={ctx}>{children}</ThemeContext.Provider>;
}

export function AppThemeProvider({ children }) {
  return (
    <MuiThemeProvider
      theme={theme}
      defaultMode="dark"
      modeStorageKey={MODE_KEY}
      colorSchemeStorageKey="mcv-color-scheme"
      disableTransitionOnChange
    >
      <CssBaseline />
      <ThemeModeBridge>{children}</ThemeModeBridge>
    </MuiThemeProvider>
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
