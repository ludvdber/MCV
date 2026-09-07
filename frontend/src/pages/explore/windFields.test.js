import { describe, it, expect } from 'vitest';
import {
  windRequestFor, windKeyOf, requestFromKey, windTargetKeys, windFieldFor,
} from './useWindFields.js';
import { exploreReducer, A } from './ExploreContext.jsx';
import { MAX_WIND_FIELDS } from './exploreConstants.jsx';
import { INDIVIDUAL_PREFIX } from '../../constants';

/**
 * Le vent de la console : une carte, un champ.
 *
 * Le defaut corrige ici est visuel et silencieux — en grille, une seule carte
 * animait son vent parce qu'un champ unique vivait dans l'etat. Les regles
 * testees ci-dessous sont celles qui empechent la situation inverse : un champ
 * affiche sous une carte qu'il ne decrit pas.
 */

const slice = (id, params) => ({ id, type: 'slice', params });

/** Etat minimal : seules les cles lues par les fonctions testees. */
function etat(over = {}) {
  return {
    showWind: false, showWindParticles: true, windAllViews: true,
    layout: 4, activeResult: 'a', gridIds: ['a', 'b'], windFields: {},
    resultsById: {
      a: slice('a', { dataset: 'mean_MY28_Ls0_30', time: 4, altitude: 10 }),
      b: slice('b', { dataset: 'mean_MY28_Ls0_30', time: 4, altitude: 60 }),
    },
    ...over,
  };
}

describe('champ de vent : adressage', () => {
  it('la cle porte le jeu de donnees, le pas de temps et l altitude', () => {
    const req = windRequestFor({ dataset: 'mean_MY28_Ls0_30', time: 4, altitude: 10 });
    expect(req).toEqual({ dataset: 'mean_MY28_Ls0_30', time: 4, altitude: 10 });
    expect(windKeyOf(req)).toBe('mean_MY28_Ls0_30|4|10');
  });

  it('un fichier annuel n a qu un pas de temps : ramene a 0', () => {
    // Meme normalisation que pour la carte : sinon le serveur refuse l'instant.
    const req = windRequestFor({ dataset: `${INDIVIDUAL_PREFIX}MY34_Ls0_30`, time: 7, altitude: 10 });
    expect(req.time).toBe(0);
  });

  it('la cle se relit comme une requete (elle EST la requete)', () => {
    const req = { dataset: 'mean_MY28_Ls0_30', time: 4, altitude: 10 };
    expect(requestFromKey(windKeyOf(req))).toEqual(req);
  });

  it('sans altitude exploitable, aucune requete', () => {
    expect(windRequestFor({ dataset: 'mean_MY28_Ls0_30', time: 0 })).toBeNull();
    expect(windRequestFor({ altitude: 10 })).toBeNull();
  });
});

describe('champ de vent : quelles vues en demandent un', () => {
  it('deux altitudes affichees = deux champs', () => {
    expect(windTargetKeys(etat())).toEqual(['mean_MY28_Ls0_30|4|10', 'mean_MY28_Ls0_30|4|60']);
  });

  it('deux vues identiques ne comptent qu une fois', () => {
    const s = etat({
      resultsById: {
        a: slice('a', { dataset: 'mean_MY28_Ls0_30', time: 4, altitude: 10 }),
        b: slice('b', { dataset: 'mean_MY28_Ls0_30', time: 4, altitude: 10 }),
      },
    });
    expect(windTargetKeys(s)).toEqual(['mean_MY28_Ls0_30|4|10']);
  });

  it('vue active seule quand la bascule est levee', () => {
    expect(windTargetKeys(etat({ windAllViews: false }))).toEqual(['mean_MY28_Ls0_30|4|10']);
  });

  it('aucune couche de vent allumee : aucune requete', () => {
    expect(windTargetKeys(etat({ showWind: false, showWindParticles: false }))).toEqual([]);
  });

  it('une carte de UU ou VV EST le vent : rien a superposer', () => {
    const s = etat({
      gridIds: ['a'],
      resultsById: { a: slice('a', { dataset: 'mean_MY28_Ls0_30', time: 4, altitude: 10, variable: 'UU' }) },
    });
    expect(windTargetKeys(s)).toEqual([]);
  });

  it('les vues non cartographiques sont ignorees', () => {
    const s = etat({
      gridIds: ['a', 'p'],
      resultsById: {
        ...etat().resultsById,
        p: { id: 'p', type: 'profile', params: { dataset: 'mean_MY28_Ls0_30', time: 4, altitude: 10 } },
      },
    });
    expect(windTargetKeys(s)).toEqual(['mean_MY28_Ls0_30|4|10']);
  });

  it('en vue simple, seule la vue active compte', () => {
    expect(windTargetKeys(etat({ layout: 1 }))).toEqual(['mean_MY28_Ls0_30|4|10']);
  });
});

describe('champ de vent : ce que recoit chaque vue', () => {
  const champA = { lats: [0], lons: [0], u: [1], v: [1] };
  const champB = { lats: [0], lons: [0], u: [9], v: [9] };
  const s = etat({ windFields: { 'mean_MY28_Ls0_30|4|10': champA, 'mean_MY28_Ls0_30|4|60': champB } });

  it('chaque carte recoit le champ de SON altitude', () => {
    expect(windFieldFor(s, s.resultsById.a, true)).toBe(champA);
    expect(windFieldFor(s, s.resultsById.b, false)).toBe(champB);
  });

  it('bascule levee : les vues inactives n affichent rien', () => {
    const s1 = { ...s, windAllViews: false };
    expect(windFieldFor(s1, s1.resultsById.a, true)).toBe(champA);
    expect(windFieldFor(s1, s1.resultsById.b, false)).toBeNull();
  });

  it('champ pas encore arrive : null, jamais celui d une autre altitude', () => {
    const s2 = { ...s, windFields: { 'mean_MY28_Ls0_30|4|10': champA } };
    expect(windFieldFor(s2, s2.resultsById.b, false)).toBeNull();
  });
});

describe('cache de champs de vent', () => {
  it('borne a MAX_WIND_FIELDS, la plus ancienne cle partant en premier', () => {
    let s = { windFields: {} };
    for (let i = 0; i < MAX_WIND_FIELDS + 3; i++) {
      s = exploreReducer(s, { type: A.SET_WIND_FIELD, key: `d|0|${i}`, value: { i } });
    }
    const cles = Object.keys(s.windFields);
    expect(cles).toHaveLength(MAX_WIND_FIELDS);
    expect(cles[0]).toBe('d|0|3');
    expect(cles.at(-1)).toBe(`d|0|${MAX_WIND_FIELDS + 2}`);
  });

  it('reecrire une cle existante ne consomme pas de place', () => {
    let s = { windFields: {} };
    s = exploreReducer(s, { type: A.SET_WIND_FIELD, key: 'd|0|1', value: { v: 1 } });
    s = exploreReducer(s, { type: A.SET_WIND_FIELD, key: 'd|0|1', value: { v: 2 } });
    expect(Object.keys(s.windFields)).toEqual(['d|0|1']);
    expect(s.windFields['d|0|1']).toEqual({ v: 2 });
  });
});
