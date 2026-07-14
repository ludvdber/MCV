/**
 * Tests des recettes de sessions (persistance + permalien de session).
 * Fonctions pures : pas de DOM, pas de reseau.
 */
import { describe, it, expect } from 'vitest';
import { buildSessionRecipe, encodeRecipe, decodeRecipe, isReplayable } from './sessionRecipes.js';

const slice = (id, over = {}) => ({
  id,
  type: 'slice',
  params: { dataset: 'mean_MY28_Ls0_30', variable: 'TT', time: 24, altitude: 18 },
  data: { stats: {} },
  datasetLabel: 'MY28',
  ...over,
});

describe('isReplayable', () => {
  it('accepte une slice serveur', () => {
    expect(isReplayable(slice('1'))).toBe(true);
  });

  it('exclut les derives client (amplitude, |V|)', () => {
    expect(isReplayable(slice('1', { derived: 'amplitude' }))).toBe(false);
    expect(isReplayable(slice('1', { derived: 'wsp' }))).toBe(false);
  });

  it('exclut la difference rapide client (pas de datasetB)', () => {
    expect(isReplayable({ type: 'difference', params: { dataset: 'a' } })).toBe(false);
    expect(isReplayable({ type: 'difference', params: { dataset: 'a', datasetB: 'b' } })).toBe(true);
  });
});

describe('buildSessionRecipe', () => {
  it('reduit chaque resultat a { type, params } et garde layout + vue active', () => {
    const state = {
      resultsById: {
        a: slice('a'),
        b: slice('b', { type: 'transect', params: { dataset: 'd', variable: 'TT', time: 0, lat1: -10, lon1: 20, lat2: 10, lon2: 30 } }),
      },
      resultOrder: ['a', 'b'],
      activeResult: 'b',
      layout: 4,
    };
    const r = buildSessionRecipe(state, 'Tempete MY35');
    expect(r.name).toBe('Tempete MY35');
    expect(r.layout).toBe(4);
    expect(r.activeIdx).toBe(1);
    expect(r.results).toHaveLength(2);
    expect(r.results[1].params.lat1).toBe(-10);
    // pas de payload parasite
    expect(r.results[0].data).toBeUndefined();
    expect(r.results[0].params.datasetB).toBeUndefined();
  });

  it('ignore les resultats non rejouables sans casser l indice actif', () => {
    const state = {
      resultsById: {
        a: slice('a'),
        d: slice('d', { derived: 'amplitude' }),
        b: slice('b'),
      },
      resultOrder: ['a', 'd', 'b'],
      activeResult: 'b',
      layout: 2,
    };
    const r = buildSessionRecipe(state, null);
    expect(r.results).toHaveLength(2);
    expect(r.activeIdx).toBe(1); // b est le 2e rejouable
  });
});

describe('encodeRecipe / decodeRecipe', () => {
  it('aller-retour fidele, y compris accents et degres', () => {
    const recipe = {
      name: 'Tempête Ls 270°',
      layout: 2,
      activeIdx: 0,
      results: [{ type: 'slice', params: { dataset: 'IND_MY34_LS5.00', variable: 'H2O', time: 0, altitude: 18 } }],
    };
    const encoded = encodeRecipe(recipe);
    // base64url : utilisable tel quel dans une query string
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeRecipe(encoded)).toEqual(recipe);
  });

  it('rejette les chaines corrompues sans lever', () => {
    expect(decodeRecipe('%%%pas-du-base64%%%')).toBeNull();
    expect(decodeRecipe(encodeRecipe({ nope: true }))).toBeNull();
  });
});
