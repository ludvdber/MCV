import { useMemo } from 'react';
import { useThemeMode } from '../context/ThemeContext';
import { useMediaQuery, useTheme } from '@mui/material';

/**
 * Returns Plotly layout colors and responsive sizing adapted to the current theme.
 */
export function usePlotlyTheme() {
  const { mode } = useThemeMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return useMemo(() => {
    const isDark = mode === 'dark';
    return {
      isDark,
      fontColor: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(30,30,50,0.9)',
      gridColor: isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      paperBg: 'rgba(0,0,0,0)',
      plotBg: 'rgba(0,0,0,0)',
      arrowColor: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(30,30,50,0.7)',
      accentColor: isDark ? '#e05a2b' : '#c44b1f',
      accentColorLight: isDark ? '#ff7043' : '#e05a2b',
      subtleTextColor: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(30,30,50,0.5)',
      titleSize: isMobile ? 12 : 16,
      axisLabelSize: isMobile ? 10 : 12,
      // Marge basse : les descendantes du titre d'axe (le « g » de Longitude,
      // police Rajdhani) etaient coupees a 40/50px — valable pour TOUTES les vues.
      margin: isMobile
        ? { t: 50, r: 10, b: 52, l: 45 }
        : { t: 80, r: 30, b: 64, l: 70 },
    };
  }, [mode, isMobile]);
}
