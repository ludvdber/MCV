import { describe, it, expect } from 'vitest';
import {
  weightedStats, computeRegionStats, datasetContext,
  genLabel, resultLabel, nextResultId, visibleResultIds,
} from './exploreUtils';

/** i18n de test : renvoie la cle, ce qui rend les libelles verifiables. */
const t = (cle) => cle;

describe('weightedStats', () => {
  it('renvoie null sur un echantillon vide', () => {
    expect(weightedStats([], [])).toBeNull();
  });

  it('calcule les moments arithmetiques', () => {
    const s = weightedStats([1, 2, 3, 4], [1, 1, 1, 1]);
    expect(s.n).toBe(4);
    expect(s.min).toBe(1);
    expect(s.max).toBe(4);
    expect(s.mean).toBeCloseTo(2.5, 10);
    // Ecart-type de POPULATION (division par n), pas d'echantillon (n-1).
    expect(s.stddev).toBeCloseTo(Math.sqrt(1.25), 10);
  });

  it('a poids egaux, la moyenne ponderee egale l arithmetique', () => {
    const s = weightedStats([5, 10, 15], [2, 2, 2]);
    expect(s.weightedMean).toBeCloseTo(s.mean, 10);
    expect(s.weightedStddev).toBeCloseTo(s.stddev, 10);
  });

  it('la ponderation deplace reellement la moyenne', () => {
    // Sans poids la moyenne vaut 5,5 ; en ecrasant le 10 elle tombe vers 1.
    const s = weightedStats([1, 10], [99, 1]);
    expect(s.mean).toBeCloseTo(5.5, 10);
    expect(s.weightedMean).toBeCloseTo((99 * 1 + 10) / 100, 10);
  });

  it('retombe sur l arithmetique quand la somme des poids est nulle', () => {
    // Cas reel : une bande centree exactement sur un pole, ou cos(lat) = 0.
    const s = weightedStats([2, 4], [0, 0]);
    expect(s.weightedMean).toBeCloseTo(3, 10);
    expect(s.weightedStddev).toBeCloseTo(1, 10);
  });

  it('la mediane ponderee franchit le seuil a la moitie des poids', () => {
    // Valeurs triees 1,2,3 ; poids 1,1,8 -> seuil a 5, atteint sur le 3.
    expect(weightedStats([1, 2, 3], [1, 1, 8]).weightedMedian).toBe(3);
    // Meme echantillon a poids egaux : la mediane redevient centrale.
    expect(weightedStats([1, 2, 3], [1, 1, 1]).weightedMedian).toBe(2);
  });

  it('trie avant de chercher la mediane, meme sur une entree desordonnee', () => {
    expect(weightedStats([30, 10, 20], [1, 1, 1]).weightedMedian).toBe(20);
  });

  it('gere un echantillon a une seule valeur', () => {
    const s = weightedStats([7], [0.5]);
    expect(s).toMatchObject({ n: 1, min: 7, max: 7, mean: 7, stddev: 0, weightedMedian: 7 });
  });
});

describe('computeRegionStats', () => {
  const grille = {
    // 3 latitudes x 4 longitudes, valeur = 10*i + j
    data: [[0, 1, 2, 3], [10, 11, 12, 13], [20, 21, 22, 23]],
    latitudes: [-60, 0, 60],
    longitudes: [-90, -30, 30, 90],
  };
  const tout = { latMin: -90, latMax: 90, lonMin: -180, lonMax: 180 };

  it('renvoie null si la grille n est pas exploitable', () => {
    expect(computeRegionStats(null, tout)).toBeNull();
    expect(computeRegionStats({}, tout)).toBeNull();
    expect(computeRegionStats({ data: [[1]], latitudes: [0] }, tout)).toBeNull();
  });

  it('renvoie null quand aucune cellule ne tombe dans la region', () => {
    expect(computeRegionStats(grille, { latMin: 80, latMax: 89, lonMin: 0, lonMax: 10 })).toBeNull();
  });

  it('borne la region aux deux axes', () => {
    const s = computeRegionStats(grille, { latMin: -10, latMax: 10, lonMin: -40, lonMax: 40 });
    // Une seule latitude (0) et deux longitudes (-30, 30) : valeurs 11 et 12.
    expect(s.n).toBe(2);
    expect(s.values).toEqual([11, 12]);
    expect(s.mean).toBeCloseTo(11.5, 10);
  });

  it('ignore les trous sans les compter comme des zeros', () => {
    const trouee = { ...grille, data: [[0, null, 2, 3], [10, NaN, 12, 13], [20, 21, 22, 23]] };
    const s = computeRegionStats(trouee, tout);
    expect(s.n).toBe(10);
    expect(s.values).not.toContain(null);
    expect(s.values.some(Number.isNaN)).toBe(false);
  });

  it('pondere par cos(lat) : les mailles polaires pesent moins', () => {
    // Grille DISSYMETRIQUE : avec des bandes symetriques autour de l'equateur
    // les deux moyennes coincident quoi qu'il arrive, et le test passerait
    // meme sans ponderation. Ici l'equateur (0) porte le 0 et la bande a
    // 60 deg (poids cos 60 = 0,5) porte le 100.
    const dissym = { data: [[0, 0], [100, 100]], latitudes: [0, 60], longitudes: [-90, 90] };
    const s = computeRegionStats(dissym, tout);
    expect(s.mean).toBeCloseTo(50, 10);
    expect(s.weightedMean).toBeCloseTo((1 * 0 + 0.5 * 100) / 1.5, 10);
    expect(s.weightedMean).toBeLessThan(s.mean);
  });

  it('sur une grille symetrique, les deux moyennes coincident (et c est normal)', () => {
    // Contre-exemple garde volontairement : un test de ponderation ecrit sur
    // une grille centree sur l'equateur passerait meme SANS ponderation.
    const s = computeRegionStats(grille, tout);
    expect(s.weightedMean).toBeCloseTo(s.mean, 10);
  });

  it('recopie les bornes demandees dans le resultat', () => {
    const bornes = { latMin: -10, latMax: 10, lonMin: -40, lonMax: 40 };
    expect(computeRegionStats(grille, bornes)).toMatchObject(bornes);
  });

  it('ne renvoie jamais un poids negatif au-dela des poles', () => {
    // Une latitude hors [-90, 90] (donnee corrompue) donnerait cos < 0 et une
    // moyenne ponderee absurde ; Math.max(0, ...) la neutralise.
    const bizarre = { data: [[4], [8]], latitudes: [100, 0], longitudes: [0] };
    const s = computeRegionStats(bizarre, tout);
    expect(s.weightedMean).toBeCloseTo(8, 10);
  });
});

describe('datasetContext', () => {
  it('privilegie le Ls reel d un fichier individuel', () => {
    expect(datasetContext({
      params: { dataset: 'IND_MY34_LS5.00' }, data: { actualLs: 1.8912 },
    })).toBe('MY34 · Ls 1.89°');
  });

  it('resume un MEAN en plage de Ls', () => {
    expect(datasetContext({ params: { dataset: 'mean_MY35_Ls60_90' }, data: {} }))
      .toBe('MY35 · Ls 60-90°');
  });

  it('retombe sur le libelle brut quand rien n est reconnu', () => {
    expect(datasetContext({ datasetLabel: 'Jeu perso', params: { dataset: 'peu_importe' } }))
      .toBe('Jeu perso');
    expect(datasetContext({ params: {} })).toBe('');
  });

  it('ignore un Ls reel sans annee martienne dans l identifiant', () => {
    expect(datasetContext({ datasetLabel: 'brut', params: { dataset: 'sans_annee' }, data: { actualLs: 3 } }))
      .toBe('brut');
  });
});

describe('genLabel', () => {
  const p = { variable: 'TT', time: 24, altitude: 49, lat: -40, lon: 30 };

  it('traduit le code variable quand il est connu', () => {
    expect(genLabel('slice', p, t)).toBe('variable.TT 12h · alt49');
  });

  it('garde le code brut pour une variable inconnue', () => {
    expect(genLabel('slice', { ...p, variable: 'ZZZ' }, t)).toBe('ZZZ 12h · alt49');
  });

  it('affiche l altitude REELLE en km quand elle est connue', () => {
    // Un index de modele ne dit rien a un lecteur ; « 49 » n'est pas 49 km.
    expect(genLabel('slice', p, t, 12.4)).toBe('variable.TT 12h · 12 km');
  });

  it.each([
    ['timeseries', 'variable.TT (-40°, 30°)'],
    ['animation', 'variable.TT · alt49'],
    ['profile', 'explore.tab_profile_short variable.TT (-40°, 30°)'],
    ['hovmoller', 'explore.tab_hovmoller_short variable.TT · alt49'],
    ['zonalmean', 'explore.tab_zonalmean_short variable.TT 12h'],
    ['windrose', 'explore.tab_windrose_short (-40°, 30°)'],
    ['difference', 'Δ variable.TT'],
    ['temporalprofile', 'T-Prof variable.TT (-40°, 30°)'],
    ['tides', 'explore.tab_tides_short variable.TT · alt49'],
    ['transect', 'explore.tab_transect_short variable.TT 12h'],
  ])('libelle le type %s', (type, attendu) => {
    expect(genLabel(type, p, t)).toBe(attendu);
  });

  it('nomme la coupe par sa direction ET la coordonnee FIXE', () => {
    // Une coupe meridionale fige la longitude, une zonale fige la latitude :
    // inverser les deux etiquetterait la coupe avec l'axe qu'elle parcourt.
    expect(genLabel('crosssection', { ...p, crossSectionType: 'meridional' }, t))
      .toBe('explore.tab_meridional_short variable.TT lon30°');
    expect(genLabel('crosssection', { ...p, crossSectionType: 'zonal' }, t))
      .toBe('explore.tab_zonal_short variable.TT lat-40°');
  });

  it('retombe sur le seul nom de variable pour un type inconnu', () => {
    expect(genLabel('inconnu', p, t)).toBe('variable.TT');
  });
});

describe('resultLabel', () => {
  const base = { type: 'slice', params: { variable: 'TT', time: 24, altitude: 49 }, data: {} };

  it('renvoie une chaine vide sur un resultat absent', () => {
    expect(resultLabel(null, t)).toBe('');
  });

  it('recalcule le libelle a partir du type et des params (reactif a la langue)', () => {
    expect(resultLabel(base, t)).toBe('variable.TT 12h · alt49');
  });

  it('etiquette les couches derivees sans passer par genLabel', () => {
    expect(resultLabel({ ...base, derived: 'amplitude' }, t)).toBe('Δ24h variable.TT alt49');
    expect(resultLabel({ ...base, derived: 'wsp' }, t)).toBe('|V| 12h alt49');
  });

  it('garde le code brut d une variable derivee inconnue', () => {
    expect(resultLabel({ ...base, params: { ...base.params, variable: 'ZZZ' }, derived: 'amplitude' }, t))
      .toBe('Δ24h ZZZ alt49');
  });

  it('conserve le libelle FIGE d une difference client (non recomposable)', () => {
    const diff = { type: 'difference', params: { variable: 'TT' }, label: 'Δ A − B' };
    expect(resultLabel(diff, t)).toBe('Δ A − B');
  });

  it('recompose une difference SERVEUR (datasetB present)', () => {
    const diff = { type: 'difference', params: { variable: 'TT', datasetB: 'mean_MY35_Ls0_30' }, label: 'fige' };
    expect(resultLabel(diff, t)).toBe('Δ variable.TT');
  });

  it('utilise l altitude reelle portee par la reponse', () => {
    expect(resultLabel({ ...base, data: { altitudeValue: 12.4 } }, t)).toBe('variable.TT 12h · 12 km');
  });
});

describe('nextResultId', () => {
  it('ne produit jamais deux fois le meme identifiant dans la meme milliseconde', () => {
    // C'est LE defaut que ce compteur corrige : `Date.now().toString()` seul
    // donnait deux onglets pour une seule vue quand deux vues naissaient
    // dans la meme milliseconde.
    const ids = new Set(Array.from({ length: 500 }, () => nextResultId()));
    expect(ids.size).toBe(500);
  });

  it('reste prefixe par un horodatage (ordre lisible dans la session)', () => {
    expect(nextResultId()).toMatch(/^\d{13}-\d+$/);
  });
});

describe('visibleResultIds', () => {
  it('en disposition simple, seule la vue active est visible', () => {
    expect(visibleResultIds({ layout: 1, activeResult: 'a', gridIds: ['b', 'c'] })).toEqual(['a']);
  });

  it('en disposition simple sans vue active, rien n est visible', () => {
    expect(visibleResultIds({ layout: 1, activeResult: null, gridIds: ['b'] })).toEqual([]);
  });

  it('en grille, le contenu explicite de la grille fait foi', () => {
    expect(visibleResultIds({ layout: 4, activeResult: 'a', gridIds: ['b', 'c'] })).toEqual(['b', 'c']);
  });
});
