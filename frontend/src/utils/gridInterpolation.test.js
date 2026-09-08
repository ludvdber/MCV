import { describe, it, expect } from 'vitest';
import { nativeStep, upsampleLatLonGrid } from './gridInterpolation';

/**
 * Les valeurs creees ici ne sont PAS des sorties du modele : le contrat verifie
 * est donc double — l'interpolation doit etre exacte sur les noeuds natifs (une
 * valeur du modele ne doit jamais etre remplacee par une moyenne) et chaque
 * point invente doit etre marque pour le tooltip.
 */

const NATIF = 'interpole';

describe('nativeStep', () => {
  it('renvoie le pas d un axe regulier', () => {
    expect(nativeStep([-4, 0, 4, 8])).toBe(4);
  });

  it('renvoie une valeur POSITIVE sur un axe decroissant', () => {
    expect(nativeStep([8, 4, 0])).toBe(4);
  });

  it('renvoie null quand il n y a pas deux points', () => {
    expect(nativeStep([])).toBeNull();
    expect(nativeStep([0])).toBeNull();
    expect(nativeStep(null)).toBeNull();
    expect(nativeStep(undefined)).toBeNull();
  });
});

describe('upsampleLatLonGrid — cas ou rien ne doit changer', () => {
  const data = [[0, 10], [20, 30]];
  const lats = [0, 4];
  const lons = [0, 4];

  it('pas cible nul ou absent : passe-plat', () => {
    for (const cible of [0, null, undefined]) {
      const r = upsampleLatLonGrid(data, lats, lons, cible, NATIF);
      expect(r.isInterpolated).toBe(false);
      expect(r.data).toBe(data);
      expect(r.text).toBeNull();
    }
  });

  it('grille trop petite : passe-plat', () => {
    const r = upsampleLatLonGrid([[1, 2]], [0], lons, 2, NATIF);
    expect(r.isInterpolated).toBe(false);
  });

  it('donnee non tabulaire : passe-plat', () => {
    const r = upsampleLatLonGrid(null, lats, lons, 2, NATIF);
    expect(r.isInterpolated).toBe(false);
  });

  it('axe sans pas exploitable : passe-plat', () => {
    expect(upsampleLatLonGrid(data, [0], lons, 2, NATIF).isInterpolated).toBe(false);
    expect(upsampleLatLonGrid(data, lats, [0], 2, NATIF).isInterpolated).toBe(false);
  });

  it('cible plus GROSSIERE que le natif : passe-plat (on ne degrade jamais)', () => {
    // Facteur arrondi a 1 : demander du 8 deg sur une grille a 4 deg ne doit
    // pas sous-echantillonner, seulement ne rien faire.
    const r = upsampleLatLonGrid(data, lats, lons, 8, NATIF);
    expect(r.isInterpolated).toBe(false);
    expect(r.data).toBe(data);
  });
});

describe('upsampleLatLonGrid — interpolation', () => {
  // Grille 3x3 a 4 deg, valeur = 10*i + j : chaque valeur dit d ou elle vient.
  const data = [[0, 1, 2], [10, 11, 12], [20, 21, 22]];
  const lats = [-4, 0, 4];
  const lons = [-4, 0, 4];

  it('double la resolution en conservant les extremites des axes', () => {
    const r = upsampleLatLonGrid(data, lats, lons, 2, NATIF);
    expect(r.isInterpolated).toBe(true);
    expect(r.latitudes).toEqual([-4, -2, 0, 2, 4]);
    expect(r.longitudes).toEqual([-4, -2, 0, 2, 4]);
    expect(r.data).toHaveLength(5);
    expect(r.data[0]).toHaveLength(5);
  });

  it('reproduit EXACTEMENT les valeurs du modele sur les noeuds natifs', () => {
    const r = upsampleLatLonGrid(data, lats, lons, 2, NATIF);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(r.data[i * 2][j * 2]).toBe(data[i][j]);
        expect(r.text[i * 2][j * 2]).toBe('');
      }
    }
  });

  it('interpole bilineairement entre quatre noeuds', () => {
    const r = upsampleLatLonGrid(data, lats, lons, 2, NATIF);
    // Milieu de la premiere maille : moyenne de 0, 1, 10, 11.
    expect(r.data[1][1]).toBeCloseTo(5.5, 10);
    // Milieu d une arete horizontale : moyenne de 0 et 1.
    expect(r.data[0][1]).toBeCloseTo(0.5, 10);
    // Milieu d une arete verticale : moyenne de 0 et 10.
    expect(r.data[1][0]).toBeCloseTo(5, 10);
  });

  it('marque chaque point invente, et seulement ceux-la', () => {
    const r = upsampleLatLonGrid(data, lats, lons, 2, NATIF);
    expect(r.text[1][1]).toBe(NATIF);
    expect(r.text[0][1]).toBe(NATIF);
    expect(r.text[2][2]).toBe('');
    // Aucun point cree n echappe au marquage.
    const marques = r.text.flat().filter(Boolean).length;
    const natifs = 3 * 3;
    expect(marques).toBe(5 * 5 - natifs);
  });

  it('ne fabrique rien au-dessus d un trou', () => {
    const trouee = [[0, null, 2], [10, 11, 12], [20, 21, 22]];
    const r = upsampleLatLonGrid(trouee, lats, lons, 2, NATIF);
    // Le noeud natif manquant reste null...
    expect(r.data[0][2]).toBeNull();
    // ...et les points crees qui s appuient dessus aussi, sans marquage.
    expect(r.data[1][1]).toBeNull();
    expect(r.text[1][1]).toBe('');
  });

  it('reste dans l enveloppe [min, max] des donnees reelles', () => {
    const r = upsampleLatLonGrid(data, lats, lons, 1, NATIF);
    const plates = r.data.flat().filter((v) => v != null);
    expect(Math.min(...plates)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...plates)).toBeLessThanOrEqual(22);
  });

  it('accepte des facteurs differents par axe', () => {
    // Latitude a 4 deg, longitude a 8 deg, cible 4 deg : seule la longitude bouge.
    const r = upsampleLatLonGrid(data, lats, [-8, 0, 8], 4, NATIF);
    expect(r.isInterpolated).toBe(true);
    expect(r.latitudes).toEqual(lats);
    expect(r.longitudes).toEqual([-8, -4, 0, 4, 8]);
  });

  it('interpole aussi la DERNIERE ligne et la derniere colonne', () => {
    // Le repli i = nLat-2 / fr = 1 evite un debordement sur le bord haut :
    // sans lui la derniere rangee interpolee lirait data[nLat] (undefined).
    const r = upsampleLatLonGrid(data, lats, lons, 2, NATIF);
    expect(r.data[4][3]).toBeCloseTo(21.5, 10);
    expect(r.data[3][4]).toBeCloseTo(17, 10);
    expect(r.data.flat().every((v) => v === null || Number.isFinite(v))).toBe(true);
  });

  it('sans libelle, les points crees portent une marque vide', () => {
    const r = upsampleLatLonGrid(data, lats, lons, 2);
    expect(r.isInterpolated).toBe(true);
    expect(r.text[1][1]).toBe('');
  });
});
