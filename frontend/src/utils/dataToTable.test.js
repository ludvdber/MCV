import { describe, it, expect } from 'vitest';
import {
  gridToTable, grid2DToTable, timeSeriesToTable, profileToTable, animationToTable,
} from './dataToTable.js';

/**
 * Non-regression : une reponse serveur inattendue ne doit JAMAIS lever.
 *
 * Ces fonctions tournent pendant le rendu (useMemo des pages de visualisation).
 * Une exception ici remontait jusqu'a l'ErrorBoundary racine et effacait
 * l'application entiere, barre laterale comprise, sur 9 pages sur 10.
 * Le contrat est donc : entree inattendue -> tableau vide, jamais d'exception.
 */

// Ce que peut contenir `data` quand la reponse est tronquee, vide, ou remplacee
// par la page HTML d'un proxy inverse.
const MALFORMED = [
  ['undefined', undefined],
  ['null', null],
  ['tableau vide', []],
  ['chaine (page HTML d\'un proxy)', '<html><body>502 Bad Gateway</body></html>'],
  ['nombre', 42],
  ['objet', { unexpected: true }],
];

describe('dataToTable — robustesse aux reponses malformees', () => {
  for (const [label, bad] of MALFORMED) {
    it(`gridToTable ne leve pas sur ${label}`, () => {
      const out = gridToTable(bad, bad, bad, 'TT');
      expect(out.rows).toEqual([]);
      expect(out.columns).toHaveLength(3);
    });

    it(`grid2DToTable ne leve pas sur ${label}`, () => {
      const out = grid2DToTable(bad, bad, bad, 'Altitude (km)', 'Latitude (°)', 'TT');
      expect(out.rows).toEqual([]);
    });

    it(`timeSeriesToTable ne leve pas sur ${label}`, () => {
      expect(timeSeriesToTable(bad, 'K').rows).toEqual([]);
    });

    it(`profileToTable ne leve pas sur ${label}`, () => {
      expect(profileToTable(bad, bad, 'K').rows).toEqual([]);
    });

    it(`animationToTable ne leve pas sur ${label}`, () => {
      const out = animationToTable(bad, bad, bad, 'TT');
      expect(out.rows).toEqual([]);
      expect(out.columns).toHaveLength(5);
    });
  }

  it('grille dont une ligne est nulle : les lignes valides sont conservees', () => {
    const out = grid2DToTable([[1, 2], null, [3, 4]], [0, 1, 2], [10, 20], 'row', 'col', 'TT');
    expect(out.rows).toHaveLength(4);
    // La ligne nulle est sautee, pas comblee : l'index 2 garde sa coordonnee.
    expect(out.rows.at(-1)).toEqual({ row: 2, col: 20, value: 4 });
  });

  it('animation dont une frame est nulle : les frames valides sont conservees', () => {
    const out = animationToTable([[[1]], null, [[2]]], [0], [0], 'TT');
    expect(out.rows.map(r => r.value)).toEqual([1, 2]);
    expect(out.rows.map(r => r.timestep)).toEqual([0, 2]);
  });
});

describe('dataToTable — conversion nominale', () => {
  it('gridToTable produit une ligne par cellule, coordonnees comprises', () => {
    const out = gridToTable([[1, 2], [3, 4]], [-45, 45], [0, 180], 'TT');
    expect(out.columns.map(c => c.label)).toEqual(['Latitude (°)', 'Longitude (°)', 'TT']);
    expect(out.rows).toEqual([
      { row: -45, col: 0, value: 1 },
      { row: -45, col: 180, value: 2 },
      { row: 45, col: 0, value: 3 },
      { row: 45, col: 180, value: 4 },
    ]);
  });

  it('timeSeriesToTable indexe le temps par demi-heures', () => {
    const out = timeSeriesToTable([210, 211], 'K');
    expect(out.columns[2].label).toBe('Value (K)');
    expect(out.rows).toEqual([
      { timestep: 0, time: '0.5', value: 210 },
      { timestep: 1, time: '1.0', value: 211 },
    ]);
  });

  it('profileToTable retombe sur l\'index quand les altitudes manquent', () => {
    expect(profileToTable([5, 6], undefined).rows).toEqual([
      { alt: 0, value: 5 },
      { alt: 1, value: 6 },
    ]);
  });

  it('animationToTable parcourt frame puis latitude puis longitude', () => {
    const out = animationToTable([[[1, 2]], [[3, 4]]], [0], [10, 20], 'TT');
    expect(out.rows).toEqual([
      { timestep: 0, time: '0.5', lat: 0, lon: 10, value: 1 },
      { timestep: 0, time: '0.5', lat: 0, lon: 20, value: 2 },
      { timestep: 1, time: '1.0', lat: 0, lon: 10, value: 3 },
      { timestep: 1, time: '1.0', lat: 0, lon: 20, value: 4 },
    ]);
  });
});
