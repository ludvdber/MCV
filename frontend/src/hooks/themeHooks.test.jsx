import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { AppThemeProvider } from '../context/ThemeContext';
import { useInk, HOME_SURFACE } from './useInk';
import { usePlotlyTheme } from './usePlotlyTheme';
import { useResolvedColorscale } from './useResolvedColorscale';
import { usePlotRef } from './usePlotRef';
import { contrastRatio, compositeOver } from '../utils/contrast';

/** Les deux hooks de theme doivent vivre SOUS le provider MUI. */
const dansLeTheme = ({ children }) => <AppThemeProvider>{children}</AppThemeProvider>;

beforeEach(() => {
  try { localStorage.clear(); } catch { /* mode prive */ }
});

describe('useInk', () => {
  it('derive une encre qui passe AA sur la surface reelle du bloc', () => {
    // C est tout l interet du hook : les couleurs d accent ont ete choisies
    // sur fond sombre. Posees en texte sur une teinte de leur propre couleur,
    // elles tombent tres bas (1,90 mesure pour le cyan).
    const { result } = renderHook(() => useInk('#38bdf8'), { wrapper: dansLeTheme });
    const fond = compositeOver('#38bdf8', 0.15, HOME_SURFACE.dark);
    expect(contrastRatio(result.current, fond)).toBeGreaterThanOrEqual(4.5);
  });

  it('tient aussi pour l orange de marque', () => {
    const { result } = renderHook(() => useInk('#e05a2b'), { wrapper: dansLeTheme });
    const fond = compositeOver('#e05a2b', 0.15, HOME_SURFACE.dark);
    expect(contrastRatio(result.current, fond)).toBeGreaterThanOrEqual(4.5);
  });

  it('tient pour une couleur AJOUTEE demain, ce que des jetons fixes ne font pas', () => {
    for (const c of ['#7c3aed', '#16a34a', '#facc15', '#111111', '#ffffff']) {
      const { result } = renderHook(() => useInk(c), { wrapper: dansLeTheme });
      const fond = compositeOver(c, 0.15, HOME_SURFACE.dark);
      expect(contrastRatio(result.current, fond), c).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('accepte une teinte plus opaque et reste lisible dessus', () => {
    const { result } = renderHook(() => useInk('#38bdf8', 0.4), { wrapper: dansLeTheme });
    const fond = compositeOver('#38bdf8', 0.4, HOME_SURFACE.dark);
    expect(contrastRatio(result.current, fond)).toBeGreaterThanOrEqual(4.5);
  });

  it('declare les deux surfaces de l accueil', () => {
    expect(HOME_SURFACE).toEqual({ light: '#ffffff', dark: '#0a1230' });
  });

  it('renvoie une couleur hexadecimale exploitable en CSS', () => {
    const { result } = renderHook(() => useInk('#38bdf8'), { wrapper: dansLeTheme });
    expect(result.current).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('usePlotlyTheme', () => {
  it('fournit toutes les cles que les viewers consomment', () => {
    const { result } = renderHook(() => usePlotlyTheme(), { wrapper: dansLeTheme });
    for (const cle of ['isDark', 'fontColor', 'gridColor', 'paperBg', 'plotBg',
      'arrowColor', 'accentColor', 'accentColorLight', 'subtleTextColor',
      'titleSize', 'axisLabelSize', 'margin']) {
      expect(result.current, cle).toHaveProperty(cle);
    }
  });

  it('rend le fond du graphe TRANSPARENT', () => {
    // Le papier Plotly doit laisser voir la carte MUI derriere : une couleur
    // en dur y creerait un rectangle qui ne suit pas la bascule de theme.
    const { result } = renderHook(() => usePlotlyTheme(), { wrapper: dansLeTheme });
    expect(result.current.paperBg).toBe('rgba(0,0,0,0)');
    expect(result.current.plotBg).toBe('rgba(0,0,0,0)');
  });

  it('laisse assez de marge basse pour les descendantes des titres d axes', () => {
    // Le « g » de Longitude (Rajdhani) etait coupe a 40/50 px.
    const { result } = renderHook(() => usePlotlyTheme(), { wrapper: dansLeTheme });
    expect(result.current.margin.b).toBeGreaterThanOrEqual(52);
  });

  it('memoise : deux rendus sans changement rendent le MEME objet', () => {
    // Cet objet est une dependance des effets de trace : une nouvelle
    // reference a chaque rendu relancerait un Plotly.react a chaque frappe.
    const { result, rerender } = renderHook(() => usePlotlyTheme(), { wrapper: dansLeTheme });
    const premier = result.current;
    rerender();
    expect(result.current).toBe(premier);
  });

  it('le mode par defaut est sombre', () => {
    const { result } = renderHook(() => usePlotlyTheme(), { wrapper: dansLeTheme });
    expect(result.current.isDark).toBe(true);
  });
});

describe('useResolvedColorscale', () => {
  it('en auto, suit la variable AFFICHEE plutot que celle du formulaire', () => {
    // Le formulaire peut deja pointer la variable suivante alors que le
    // graphe montre encore la precedente : la palette doit decrire ce qui
    // est a l ecran.
    const { result } = renderHook(() => useResolvedColorscale('auto', 'TT', 'H2O'));
    expect(Array.isArray(result.current.name)).toBe(true);
  });

  it('retombe sur la variable selectionnee quand rien n est encore affiche', () => {
    const { result } = renderHook(() => useResolvedColorscale('auto', null, 'TT'));
    expect(Array.isArray(result.current.name)).toBe(true);
    const autre = renderHook(() => useResolvedColorscale('auto', null, 'H2O'));
    expect(autre.result.current.name).toBe('Viridis');
  });

  it('rend les STOPS des palettes non natives, pas leur nom', () => {
    // Plotly v3 ne connait pas « Plasma » : lui passer le nom ferait
    // silencieusement retomber sur la palette par defaut.
    const { result } = renderHook(() => useResolvedColorscale('Plasma', 'TT', 'TT'));
    expect(Array.isArray(result.current.name)).toBe(true);
  });

  it('rend le nom des palettes natives', () => {
    const { result } = renderHook(() => useResolvedColorscale('Cividis', 'TT', 'TT'));
    expect(result.current.name).toBe('Cividis');
  });

  it('transmet le sens d affichage de l option', () => {
    expect(renderHook(() => useResolvedColorscale('Roma', 'TT', 'TT')).result.current.reverse).toBe(true);
    expect(renderHook(() => useResolvedColorscale('Vik', 'TT', 'TT')).result.current.reverse).toBe(false);
  });

  it('laisse passer une valeur inconnue telle quelle', () => {
    const { result } = renderHook(() => useResolvedColorscale('Portland', 'TT', 'TT'));
    expect(result.current).toEqual({ name: 'Portland', reverse: false });
  });

  it('memoise sur ses trois entrees', () => {
    const { result, rerender } = renderHook(
      ({ c, d, s }) => useResolvedColorscale(c, d, s),
      { initialProps: { c: 'auto', d: 'TT', s: 'TT' } },
    );
    const premier = result.current;
    rerender({ c: 'auto', d: 'TT', s: 'TT' });
    expect(result.current).toBe(premier);
    rerender({ c: 'auto', d: 'H2O', s: 'TT' });
    expect(result.current).not.toBe(premier);
  });
});

describe('usePlotRef', () => {
  it('rend un ref conteneur et un ref synthetique vers le graphe Plotly', () => {
    const { result } = renderHook(() => usePlotRef());
    const [conteneur, exportRef] = result.current;
    expect(conteneur.current).toBeNull();
    // Sans conteneur monte, le ref synthetique vaut null (jamais undefined :
    // ExportMenu teste `plotRef.current` avant d appeler Plotly).
    expect(exportRef.current).toBeNull();
  });

  it('trouve le noeud Plotly a l interieur du conteneur', () => {
    const { result } = renderHook(() => usePlotRef());
    const [conteneur, exportRef] = result.current;
    const boite = document.createElement('div');
    const graphe = document.createElement('div');
    graphe.className = 'js-plotly-plot';
    boite.appendChild(graphe);
    conteneur.current = boite;
    expect(exportRef.current).toBe(graphe);
  });

  it('renvoie null si le conteneur ne contient pas de graphe', () => {
    const { result } = renderHook(() => usePlotRef());
    const [conteneur, exportRef] = result.current;
    conteneur.current = document.createElement('div');
    expect(exportRef.current).toBeNull();
  });

  it('garde la meme paire de refs entre deux rendus', () => {
    const { result, rerender } = renderHook(() => usePlotRef());
    const avant = result.current;
    rerender();
    expect(result.current[0]).toBe(avant[0]);
    expect(result.current[1]).toBe(avant[1]);
  });
});
