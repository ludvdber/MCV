import { describe, it, expect } from 'vitest';
import { niveauxContour, niveauxPourBornes, etendueGrille } from './contourLevels';

/**
 * Ce module existe pour une seule raison : une trace `contour` aux niveaux
 * AUTOMATIQUES les perd quand Plotly redessine sans recalculer, et plante
 * alors dans makeCrossings sur un tableau de niveaux vide. Les deux proprietes
 * a tenir sont donc, dans cet ordre :
 *
 *   1. la bande rendue n'est JAMAIS vide, quelle que soit l'entree ;
 *   2. elle vaut exactement ce que Plotly aurait calcule seul, sinon la
 *      correction changerait toutes les figures au passage.
 *
 * La seconde ne se demontre pas par le raisonnement : la premiere version
 * ecrite « au bon sens » s'ecartait de Plotly sur 11 etendues sur 18. Les
 * attendus ci-dessous ont ete RELEVES sur Plotly lui-meme, dans un navigateur,
 * en lisant `_fullData[0].contours` apres un newPlot aux niveaux automatiques.
 */

/** [min, max, ncontours, start, end, size] — mesures contre Plotly 3.x. */
const MESURES = [
  [113.7, 227.5, 15, 120, 220, 10],
  [110, 190, 15, 120, 180, 10],
  [0, 1, 15, 0.1, 0.9, 0.1],
  [-30, 30, 15, -25, 25, 5],
  [1e-8, 4.2e-6, 15, 5e-7, 4e-6, 5e-7],
  [140.6, 173.6, 15, 145, 170, 5],
  [612, 1013, 15, 650, 1000, 50],
  [-1.5e-3, 2.4e-3, 15, -1e-3, 2e-3, 5e-4],
  [1e-3, 2e-3, 15, 1.1e-3, 1.9e-3, 1e-4],
  [-88, 88, 10, -80, 80, 20],
  [-7.2, 21.4, 10, -5, 20, 5],
  [200, 201, 15, 200.1, 200.9, 0.1],
  [0, 1e6, 15, 1e5, 9e5, 1e5],
  [-1e5, -1e4, 15, -9e4, -2e4, 1e4],
  [3, 7, 15, 3.5, 6.5, 0.5],
  [123.456, 789.012, 15, 150, 750, 50],
  [-0.04, 0.04, 15, -0.03, 0.03, 0.01],
  // Etendue si serree, ou ncontours si petit, que le premier multiple passe
  // au-dela du dernier : Plotly rabat alors les deux bornes sur leur milieu,
  // ce qui laisse un niveau unique plutot qu'aucun.
  [0, 10, 1, 10, 10, 20],
  [0, 100, 1, 100, 100, 200],
  [5, 6, 1, 5, 5, 2],
  [-1, 1, 1, 0, 0, 5],
  [0, 3, 2, 2, 2, 2],
];

/* Les quatre etendues REELLES, relevees sur /api/data/zonalmean avec les
 * vraies donnees GEM-Mars. Elles portent le cas que les etendues synthetiques
 * ne produisaient pas : un minimum infime mais NON NUL (3,6e-11 pour H2O,
 * 7e-6 pour PX), ou l'egalite exacte de Plotly ne mord pas et ou une regle
 * « strictement superieur » ecrivait un niveau de trop. */
const MESURES_REELLES = [
  ['TT', 113.73518, 227.53223, 120, 220, 10],
  ['H2O', 3.561055e-11, 0.0045019016, 0, 0.0045, 5e-4],
  ['UU', -155.40833, 167.53165, -150, 150, 50],
  ['PX', 7.0010883e-6, 776.279, 0, 700, 100],
];

const proche = (a, b) => Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b));

describe('niveauxPourBornes', () => {
  it('reproduit exactement les niveaux calcules par Plotly', () => {
    for (const [min, max, nc, start, end, size] of MESURES) {
      const n = niveauxPourBornes(min, max, nc);
      expect(proche(n.size, size), `pas pour [${min}, ${max}]: ${n.size} au lieu de ${size}`).toBe(true);
      expect(proche(n.start, start), `debut pour [${min}, ${max}]: ${n.start} au lieu de ${start}`).toBe(true);
      expect(proche(n.end, end), `fin pour [${min}, ${max}]: ${n.end} au lieu de ${end}`).toBe(true);
    }
  });

  it('reproduit Plotly sur les etendues reelles de la moyenne zonale', () => {
    for (const [nom, min, max, start, end, size] of MESURES_REELLES) {
      const n = niveauxPourBornes(min, max);
      expect([nom, n.start, n.end, n.size]).toEqual([nom, start, end, size]);
    }
  });

  it('rend toujours une bande NON VIDE, y compris sur les entrees degenerees', () => {
    // C'est la propriete qui empeche la panne : une bande vide donne zero
    // niveau, et makeCrossings lit alors pathinfo[0].z sur un tableau vide.
    const entrees = [
      [0, 0], [5, 5], [-3, -3], [1, 0], [NaN, 10], [10, NaN],
      [undefined, undefined], [null, null], [Infinity, 1], [-Infinity, Infinity],
      [1e-300, 1e-299], [0, Number.MIN_VALUE],
    ];
    for (const [min, max] of entrees) {
      const n = niveauxPourBornes(min, max);
      expect(Number.isFinite(n.start), `debut fini pour [${min}, ${max}]`).toBe(true);
      expect(Number.isFinite(n.end), `fin finie pour [${min}, ${max}]`).toBe(true);
      expect(n.size > 0, `pas strictement positif pour [${min}, ${max}]`).toBe(true);
      expect(n.start <= n.end, `bande a l endroit pour [${min}, ${max}]`).toBe(true);
      // Le critere de boucle de Plotly (emptyPathinfo) : au moins un niveau.
      const niveaux = Math.floor((n.end + n.size / 10 - n.start) / n.size) + 1;
      expect(niveaux, `au moins un niveau pour [${min}, ${max}]`).toBeGreaterThanOrEqual(1);
    }
  });

  it('enleve les miettes binaires du produit', () => {
    // Plotly publie 0.0045000000000000005, qui se retrouve tel quel sur
    // l etiquette de la derniere ligne de niveau.
    const n = niveauxPourBornes(3.561055e-11, 0.0045019016);
    expect(String(n.end)).toBe('0.0045');
  });
});

describe('etendueGrille', () => {
  it('ignore les mailles masquees et les valeurs non finies', () => {
    expect(etendueGrille([[1, null, 3], [NaN, 2, undefined], [Infinity, -1, 'x']]))
      .toEqual({ min: -1, max: 3 });
  });

  it('rend null quand rien n est exploitable', () => {
    expect(etendueGrille([])).toBe(null);
    expect(etendueGrille([[null, NaN]])).toBe(null);
    expect(etendueGrille(null)).toBe(null);
    expect(etendueGrille('pas une grille')).toBe(null);
  });
});

describe('niveauxContour', () => {
  it('calcule depuis la grille affichee', () => {
    const grille = [[113.73518, 170], [190, 227.53223]];
    expect(niveauxContour(grille)).toEqual({ start: 120, end: 220, size: 10 });
  });

  it('rend une bande utilisable meme sur une grille entierement masquee', () => {
    const n = niveauxContour([[null, null], [NaN, null]]);
    expect(n.size).toBeGreaterThan(0);
    expect(n.start).toBeLessThanOrEqual(n.end);
  });
});
