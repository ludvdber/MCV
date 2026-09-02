import { describe, it, expect } from 'vitest';
import { isUsablePayload } from './useVisualizationPage';

/**
 * Filtre d'entree de TOUTES les pages de visualisation.
 *
 * Un HTTP 200 ne garantit pas un corps exploitable : derriere un proxy inverse
 * d'institution, une reponse tronquee ou une page d'erreur HTML arrivent avec
 * le meme code de statut. Ce filtre transforme ces cas en message d'erreur
 * explicite ; sans lui, l'application entiere tombait dans l'ErrorBoundary.
 *
 * Les enveloppes « valides » ci-dessous sont les formes REELLES renvoyees par
 * les dix endpoints, verifiees contre le serveur.
 */

describe('isUsablePayload — corps refuses', () => {
  const rejected = {
    'undefined': undefined,
    'null': null,
    'chaine vide (corps vide)': '',
    'JSON tronque (axios rend la chaine brute)': '{"data":[[1,2],[3,',
    'page HTML d\'un proxy 502': '<html><body>502 Bad Gateway</body></html>',
    'nombre': 42,
    'booleen': true,
    'objet vide': {},
    'objet sans aucun tableau': { dataset: 'x', variable: 'TT', timeIndex: 24 },
    'data null': { data: null, latitudes: null, longitudes: null },
    'tableaux tous vides': { data: [], latitudes: [], longitudes: [] },
    'tableau vide (multipoint sans resultat)': [],
  };
  for (const [label, body] of Object.entries(rejected)) {
    it(`refuse : ${label}`, () => expect(isUsablePayload(body)).toBe(false));
  }
});

describe('isUsablePayload — enveloppes reelles des endpoints', () => {
  const accepted = {
    slice: { dataset: 'd', variable: 'TT', timeIndex: 24, data: [[1, 2]], latitudes: [0], longitudes: [0, 10] },
    timeseries: { dataset: 'd', latitude: 0, longitude: 0, values: [210, 211] },
    animation: { frameCount: 48, frames: [[[1]]], latitudes: [0], longitudes: [0] },
    crosssection: { type: 'meridional', fixedCoordinate: 0, altitudes: [0, 1], horizontalCoords: [-45], data: [[1], [2]] },
    profile: { latitude: 0, longitude: 0, altitudes: [0, 1], values: [210, 205] },
    hovmoller: { type: 'latitude', times: [0], spatialCoords: [-45], data: [[1]] },
    zonalmean: { latitudes: [-45], altitudes: [0], data: [[1]] },
    windrose: { latitude: 0, longitude: 0, uu: [1, 2], vv: [3, 4] },
    'temporal-profile': { latitude: 0, longitude: 0, altitudes: [0], times: [0], data: [[1]] },
    difference: { datasetA: 'a', datasetB: 'b', data: [[0.5]], latitudes: [0], longitudes: [0] },
    'multipoint (tableau de profils)': [{ values: [1], altitudes: [0] }],
  };
  for (const [name, body] of Object.entries(accepted)) {
    it(`accepte : ${name}`, () => expect(isUsablePayload(body)).toBe(true));
  }

  it('accepte une grille partielle : les gardes de rendu prennent le relais', () => {
    // `data` manquant mais les axes presents : le corps passe le filtre reseau,
    // ce sont les gardes Array.isArray des viewers qui affichent l'etat vide.
    expect(isUsablePayload({ latitudes: [0], longitudes: [0] })).toBe(true);
  });
});
