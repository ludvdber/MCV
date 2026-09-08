import { describe, it, expect, vi, afterEach } from 'vitest';
import { compactLayout } from './compactPlot';
import { scrollViewerIntoView } from './scrollToViewer';
import { formatTime } from './formatTime';
import { isSurfaceVariable } from './variableUtils';
import { SERIES_COLORS } from './seriesColors';

/**
 * Quatre helpers minuscules mais lus par toutes les vues : le mode compact des
 * cellules, le defilement mobile, la conversion pas de temps -> heure locale et
 * la question « cette variable a-t-elle une altitude ».
 */

describe('compactLayout', () => {
  const complet = {
    title: { text: 'Un titre' },
    margin: { l: 80, r: 40, t: 60, b: 80 },
    xaxis: { title: { text: 'Longitude' }, tickfont: { size: 14, color: '#fff' }, gridcolor: '#333' },
    yaxis: { title: { text: 'Latitude' } },
    paper_bgcolor: '#000',
  };

  it('retire le titre : la cellule le porte deja dans son en-tete', () => {
    expect(compactLayout(complet).title).toBeUndefined();
  });

  it('retire les titres d axes', () => {
    const c = compactLayout(complet);
    expect(c.xaxis.title).toBeUndefined();
    expect(c.yaxis.title).toBeUndefined();
  });

  it('resserre les marges', () => {
    expect(compactLayout(complet).margin).toEqual({ l: 42, r: 8, t: 8, b: 26 });
  });

  it('reduit la taille des ticks sans perdre leurs autres reglages', () => {
    const c = compactLayout(complet);
    expect(c.xaxis.tickfont).toEqual({ size: 10, color: '#fff' });
  });

  it('conserve tout le reste du layout (couleurs, grille, theme)', () => {
    const c = compactLayout(complet);
    expect(c.paper_bgcolor).toBe('#000');
    expect(c.xaxis.gridcolor).toBe('#333');
  });

  it('ne modifie pas le layout d origine', () => {
    compactLayout(complet);
    expect(complet.title).toEqual({ text: 'Un titre' });
    expect(complet.xaxis.tickfont.size).toBe(14);
  });

  it('tolere un layout sans axes', () => {
    const c = compactLayout({});
    expect(c.xaxis).toEqual({ title: undefined, tickfont: { size: 10 } });
  });
});

describe('scrollViewerIntoView', () => {
  const largeur = (px) => Object.defineProperty(window, 'innerWidth', { value: px, configurable: true });
  // `vi.spyOn(window, 'matchMedia')` echoue ici : jsdom ne fournit PAS cette
  // API, c'est le bouchon de src/test/setup.js qui la pose. On la REDEFINIT
  // donc, ce qui permet aussi de tester le cas ou elle manque tout a fait.
  const media = (valeur) => Object.defineProperty(window, 'matchMedia',
    { value: valeur, configurable: true, writable: true });
  const matchMediaOrigine = window.matchMedia;

  afterEach(() => { vi.restoreAllMocks(); largeur(1024); media(matchMediaOrigine); });

  const faireElement = () => ({ style: {}, scrollIntoView: vi.fn() });

  it('ne fait rien sans element', () => {
    expect(() => scrollViewerIntoView(null)).not.toThrow();
  });

  it('ne defile PAS sur un ecran large : le graphique y est deja visible', () => {
    largeur(1200);
    const el = faireElement();
    scrollViewerIntoView(el);
    expect(el.scrollIntoView).not.toHaveBeenCalled();
  });

  it('ne defile pas exactement au point de rupture (900 px)', () => {
    largeur(900);
    const el = faireElement();
    scrollViewerIntoView(el);
    expect(el.scrollIntoView).not.toHaveBeenCalled();
  });

  it('defile en douceur sous 900 px', () => {
    largeur(390);
    media(() => ({ matches: false }));
    const el = faireElement();
    scrollViewerIntoView(el);
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('respecte prefers-reduced-motion (defilement instantane)', () => {
    largeur(390);
    media(() => ({ matches: true }));
    const el = faireElement();
    scrollViewerIntoView(el);
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('laisse la place du bouton de menu flottant', () => {
    largeur(390);
    media(() => ({ matches: false }));
    const el = faireElement();
    scrollViewerIntoView(el);
    expect(el.style.scrollMarginTop).toBe('72px');
  });

  it('defile quand meme si matchMedia n existe pas', () => {
    largeur(390);
    // C'est exactement l'etat de jsdom sans bouchon, et de certains navigateurs
    // embarques : l'appel optionnel doit tenir et le defilement avoir lieu.
    media(undefined);
    const el = faireElement();
    expect(() => scrollViewerIntoView(el)).not.toThrow();
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });
});

describe('formatTime', () => {
  it('convertit le pas k en heure locale k x 0,5 h, minuit a k = 0', () => {
    // L'ancienne formule (k+1)*0,5 decalait TOUT l'affichage d'une demi-heure
    // par rapport a la coordonnee `time` des fichiers.
    expect(formatTime(0)).toBe('0h');
    expect(formatTime(1)).toBe('0.5h');
    expect(formatTime(24)).toBe('12h');
    expect(formatTime(47)).toBe('23.5h');
  });
});

describe('isSurfaceVariable', () => {
  it('reconnait les variables de surface', () => {
    expect(isSurfaceVariable('MTSF')).toBe(true);
    expect(isSurfaceVariable('P0')).toBe(true);
  });

  it('rejette les variables a altitude', () => {
    expect(isSurfaceVariable('TT')).toBe(false);
    expect(isSurfaceVariable('UU')).toBe(false);
  });

  it('renvoie false — pas undefined — sur un code inconnu ou absent', () => {
    // Le retour alimente des conditions d'affichage : un undefined y serait
    // falsy par accident, ce qui marche jusqu'au jour ou on le compare a false.
    expect(isSurfaceVariable('INEXISTANT')).toBe(false);
    expect(isSurfaceVariable(null)).toBe(false);
  });
});

describe('SERIES_COLORS', () => {
  it('fournit quatre couleurs distinctes pour les quatre points comparables', () => {
    expect(SERIES_COLORS).toHaveLength(4);
    expect(new Set(SERIES_COLORS).size).toBe(4);
  });

  it('ne contient que des hex, lisibles a la fois par Plotly et par CSS', () => {
    // Les puces du formulaire et les courbes lisent la MEME liste : une valeur
    // en `var(--token)` casserait le trace Plotly sans erreur visible.
    for (const c of SERIES_COLORS) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
