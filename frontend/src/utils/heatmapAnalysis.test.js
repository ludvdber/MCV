import { describe, it, expect } from 'vitest';
import { computeHeatmapCustomData, computeAnomalyZ } from './heatmapAnalysis';

/**
 * Analyse des cellules d'un heatmap : anomalie zonale, gradients, percentile.
 *
 * Le module n'avait aucun test alors qu'il alimente les infobulles avec des
 * quantites scientifiques. Le point sensible est la LONGITUDE, qui est
 * periodique : la grille GEM-Mars va de -176 a 180 par pas de 4, donc la
 * premiere et la derniere colonne sont voisines.
 */

/** Axes de la grille native GEM-Mars. */
const LONS = Array.from({ length: 90 }, (_, j) => -176 + 4 * j);
const LATS = Array.from({ length: 45 }, (_, i) => -88 + 4 * i);

/** Index des champs dans customdata. */
const ANOMALIE = 0, GRAD_LAT = 1, GRAD_LON = 2, PERCENTILE = 3;

describe('computeHeatmapCustomData', () => {

  describe('gradient longitudinal sur un axe qui fait le tour', () => {

    it('traite la première et la dernière colonne comme voisines', () => {
      // Champ en marche d'escalier : une seule colonne differe. Si la couture
      // etait ignoree, le gradient de la colonne 0 ne la verrait jamais.
      // Mesure contre l'ancien code : il rendait 0 au lieu de -12,5.
      const z = LATS.map(() => LONS.map((_, j) => (j === 89 ? 100 : 0)));
      const cd = computeHeatmapCustomData(z, LATS, LONS);

      // colonne 0 : voisin ouest = colonne 89 (valeur 100), voisin est = colonne 1 (0)
      expect(cd[0][0][GRAD_LON]).toBeCloseTo((0 - 100) / (2 * 4), 6);
      // colonne 89 : voisin ouest = colonne 88 (0), voisin est = colonne 0 (0)
      expect(cd[0][89][GRAD_LON]).toBeCloseTo(0, 6);
    });

    it('donne le même résultat qu’une différence centrée pour les colonnes intérieures', () => {
      const z = LATS.map(() => LONS.map((_, j) => j * j));
      const cd = computeHeatmapCustomData(z, LATS, LONS);
      for (const j of [1, 17, 45, 88]) {
        const attendu = ((j + 1) ** 2 - (j - 1) ** 2) / (LONS[j + 1] - LONS[j - 1]);
        expect(cd[0][j][GRAD_LON]).toBeCloseTo(attendu, 6);
      }
    });

    it('un champ purement zonal a un gradient longitudinal nul PARTOUT, bords compris', () => {
      // Verifie apres coup : ce cas passait DEJA avant la correction, un champ
      // constant en longitude annulant toute difference quel que soit le cote
      // choisi. Il est garde comme filet, pas comme preuve. Le seul test qui
      // echoue sur l'ancien code est celui de la marche d'escalier ci-dessus.
      const z = LATS.map((la) => LONS.map(() => la * 2));
      const cd = computeHeatmapCustomData(z, LATS, LONS);
      for (let j = 0; j < LONS.length; j++) {
        expect(cd[22][j][GRAD_LON]).toBeCloseTo(0, 9);
      }
    });
  });

  describe('grille régionale : les bords restent des bords', () => {

    it('n’enjambe pas la couture quand l’axe ne fait pas le tour', () => {
      // -50 a -10 : un secteur, pas la planete. Refermer l'axe ici relierait
      // deux points distants de 40 degres et fabriquerait un gradient absurde.
      const lons = [-50, -40, -30, -20, -10];
      const lats = [0, 10];
      const z = [[0, 1, 2, 3, 100], [0, 1, 2, 3, 100]];
      const cd = computeHeatmapCustomData(z, lats, lons);

      // colonne 0 : difference AVANT, (1-0)/10
      expect(cd[0][0][GRAD_LON]).toBeCloseTo(0.1, 6);
      // colonne 4 : difference ARRIERE, (100-3)/10
      expect(cd[0][4][GRAD_LON]).toBeCloseTo(9.7, 6);
    });
  });

  describe('gradient latitudinal', () => {

    it('garde des bords ouverts : les pôles ne se rejoignent pas', () => {
      // La latitude n'est PAS periodique. Le pole sud et le pole nord ne sont
      // pas voisins, meme si le premier et le dernier indice se touchent dans
      // le tableau.
      const z = LATS.map((_, i) => LONS.map(() => (i === 0 ? 1000 : 0)));
      const cd = computeHeatmapCustomData(z, LATS, LONS);
      // derniere latitude : difference arriere entre deux zeros
      expect(cd[44][10][GRAD_LAT]).toBeCloseTo(0, 6);
      // premiere latitude : difference avant, (0 - 1000) / 4
      expect(cd[0][10][GRAD_LAT]).toBeCloseTo(-250, 6);
    });
  });

  describe('anomalie zonale et percentile', () => {

    it('l’anomalie est l’écart à la moyenne de la même latitude', () => {
      const lats = [0, 10];
      const lons = [0, 90, 180, 270];
      const z = [[10, 20, 30, 40], [5, 5, 5, 5]];
      const cd = computeHeatmapCustomData(z, lats, lons);

      expect(cd[0][0][ANOMALIE]).toBeCloseTo(10 - 25, 6);
      expect(cd[0][3][ANOMALIE]).toBeCloseTo(40 - 25, 6);
      expect(cd[1][2][ANOMALIE]).toBeCloseTo(0, 6);
    });

    it('le percentile situe la valeur dans la distribution globale', () => {
      const lats = [0, 10];
      const lons = [0, 90, 180, 270];
      const z = [[1, 2, 3, 4], [5, 6, 7, 8]];
      const cd = computeHeatmapCustomData(z, lats, lons);

      expect(cd[0][0][PERCENTILE]).toBeCloseTo(0, 6);    // la plus petite
      expect(cd[1][3][PERCENTILE]).toBeCloseTo(87.5, 6); // la plus grande : 7/8
    });

    it('les cellules masquées ne polluent ni la moyenne ni le percentile', () => {
      const lats = [0];
      const lons = [0, 90, 180, 270];
      const z = [[10, NaN, 30, null]];
      const cd = computeHeatmapCustomData(z, lats, lons);

      // moyenne zonale sur les seules valeurs presentes : (10+30)/2 = 20
      expect(cd[0][0][ANOMALIE]).toBeCloseTo(-10, 6);
      expect(cd[0][2][ANOMALIE]).toBeCloseTo(10, 6);
      // une cellule masquee rend une ligne neutre
      expect(cd[0][1]).toEqual([0, 0, 0, 0, '-', 0]);
      expect(cd[0][3]).toEqual([0, 0, 0, 0, '-', 0]);
    });
  });
});

describe('computeAnomalyZ', () => {

  it('retire la moyenne de chaque latitude et rend le maximum absolu', () => {
    const lats = [0, 10];
    const z = [[10, 20, 30], [5, 5, 5]];
    const { anomalyZ, maxAbsAnomaly } = computeAnomalyZ(z, lats);

    expect(anomalyZ[0]).toEqual([-10, 0, 10]);
    expect(anomalyZ[1]).toEqual([0, 0, 0]);
    expect(maxAbsAnomaly).toBe(10);
  });

  it('propage les cellules masquées sans les compter', () => {
    const lats = [0];
    const z = [[10, NaN, 30]];
    const { anomalyZ, maxAbsAnomaly } = computeAnomalyZ(z, lats);

    expect(anomalyZ[0][0]).toBeCloseTo(-10, 6);
    expect(Number.isNaN(anomalyZ[0][1])).toBe(true);
    expect(anomalyZ[0][2]).toBeCloseTo(10, 6);
    expect(maxAbsAnomaly).toBe(10);
  });

  it('une latitude entièrement masquée ne fait pas exploser le calcul', () => {
    const { anomalyZ, maxAbsAnomaly } = computeAnomalyZ([[NaN, NaN]], [0]);
    expect(anomalyZ[0].every(Number.isNaN)).toBe(true);
    expect(maxAbsAnomaly).toBe(0);
  });
});
