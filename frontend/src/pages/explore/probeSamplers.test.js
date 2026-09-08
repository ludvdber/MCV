import { describe, it, expect, beforeEach } from 'vitest';
import { probeAxes, fixedProbeDims, sampleProbe, probeAltKm, effectiveProbePoint } from './probeSamplers';
import { largeDataStore } from './largeDataStore';
import { setAnimationFrame, clearAnimationFrame } from './probeBus';

/**
 * La sonde liee met en correspondance des vues HETEROGENES par DIMENSIONS
 * physiques. Le piege permanent : une vue doit refuser de se prononcer quand
 * le point sonde ne porte pas les dimensions dont elle a besoin — repondre
 * quand meme afficherait une valeur prise a une coordonnee arbitraire.
 */

describe('probeAxes', () => {
  it('donne (lon, lat) aux cartes', () => {
    for (const type of ['slice', 'animation', 'difference']) {
      expect(probeAxes({ type }), type).toEqual({ x: 'lon', y: 'lat' });
    }
  });

  it('lit l orientation d un hovmoller dans les params, sinon dans la reponse', () => {
    expect(probeAxes({ type: 'hovmoller', params: { hovmollerType: 'longitude' } })).toEqual({ x: 'lon', y: 'time' });
    expect(probeAxes({ type: 'hovmoller', params: {}, data: { type: 'longitude' } })).toEqual({ x: 'lon', y: 'time' });
    // Defaut historique : latitude.
    expect(probeAxes({ type: 'hovmoller', params: {} })).toEqual({ x: 'lat', y: 'time' });
  });

  it('les params priment sur la reponse en cas de desaccord', () => {
    // La reponse peut venir d un cache anterieur a un changement d orientation.
    expect(probeAxes({ type: 'hovmoller', params: { hovmollerType: 'latitude' }, data: { type: 'longitude' } }))
      .toEqual({ x: 'lat', y: 'time' });
  });

  it('donne son axe horizontal a une coupe selon sa direction', () => {
    expect(probeAxes({ type: 'crosssection', params: { crossSectionType: 'zonal' } })).toEqual({ x: 'lon', y: 'alt' });
    expect(probeAxes({ type: 'crosssection', params: { crossSectionType: 'meridional' } })).toEqual({ x: 'lat', y: 'alt' });
  });

  it('donne (lat, alt) a la moyenne zonale et (time, alt) au profil temporel', () => {
    expect(probeAxes({ type: 'zonalmean' })).toEqual({ x: 'lat', y: 'alt' });
    expect(probeAxes({ type: 'temporalprofile' })).toEqual({ x: 'time', y: 'alt' });
  });

  it('renvoie null pour une vue que la sonde ne sait pas lire', () => {
    expect(probeAxes({ type: 'windrose' })).toBeNull();
    expect(probeAxes({ type: 'profile' })).toBeNull();
    expect(probeAxes(null)).toBeNull();
    expect(probeAxes(undefined)).toBeNull();
  });
});

describe('fixedProbeDims', () => {
  it('convertit l INDEX de temps en heures locales', () => {
    // params.time est un index 0-47 ; les axes des autres vues sont en heures.
    // Publier l index brut ferait pointer le reticule 2x trop loin.
    expect(fixedProbeDims({ type: 'slice', params: { time: 28 }, data: {} }).time).toBe(14);
  });

  it('publie l altitude REELLE en km, pas l index de niveau', () => {
    expect(fixedProbeDims({ type: 'slice', params: { time: 0 }, data: { altitudeValue: 25.3 } }))
      .toEqual({ time: 0, alt: 25.3 });
  });

  it('n invente rien quand la vue ne connait pas la dimension', () => {
    expect(fixedProbeDims({ type: 'slice', params: {}, data: {} })).toEqual({});
    expect(fixedProbeDims(null)).toEqual({});
  });

  it('une animation publie l heure de la frame AFFICHEE', () => {
    const r = { id: 'anim1', type: 'animation', params: {}, data: { altitudeValue: 10 } };
    clearAnimationFrame('anim1');
    expect(fixedProbeDims(r).time).toBe(0);
    setAnimationFrame('anim1', 30);
    expect(fixedProbeDims(r).time).toBe(15);
    clearAnimationFrame('anim1');
  });

  it('une coupe publie la coordonnee qu elle FIGE, pas celle qu elle parcourt', () => {
    const zonale = { type: 'crosssection', params: { crossSectionType: 'zonal', time: 24 }, data: { fixedCoordinate: -40 } };
    expect(fixedProbeDims(zonale)).toEqual({ time: 12, lat: -40 });
    const merid = { type: 'crosssection', params: { crossSectionType: 'meridional', time: 24 }, data: { fixedCoordinate: 30 } };
    expect(fixedProbeDims(merid)).toEqual({ time: 12, lon: 30 });
  });

  it('la moyenne zonale n offre que le temps (la longitude est moyennee)', () => {
    const r = { type: 'zonalmean', params: { time: 10 }, data: { altitudeValue: 5 } };
    expect(fixedProbeDims(r)).toEqual({ time: 5 });
  });

  it('un hovmoller n offre que son altitude', () => {
    expect(fixedProbeDims({ type: 'hovmoller', params: { time: 4 }, data: { altitudeValue: 8 } }))
      .toEqual({ alt: 8 });
  });

  it('un profil temporel offre le point ou il a ete pris', () => {
    expect(fixedProbeDims({ type: 'temporalprofile', params: {}, data: { latitude: -40, longitude: 30 } }))
      .toEqual({ lat: -40, lon: 30 });
  });

  it('lit les donnees d une animation dans le magasin externe', () => {
    // result.data est null pour une animation : les frames vivent hors React.
    const r = { id: 'anim2', type: 'animation', params: {}, data: null };
    largeDataStore.set('anim2', { altitudeValue: 42 });
    expect(fixedProbeDims(r).alt).toBe(42);
    largeDataStore.delete('anim2');
  });
});

describe('sampleProbe', () => {
  const carte = {
    type: 'slice',
    data: {
      latitudes: [-40, 0, 40],
      longitudes: [-180, -90, 0, 90],
      data: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]],
    },
  };

  it('echantillonne au plus proche voisin sur les deux axes', () => {
    expect(sampleProbe(carte, { lat: 38, lon: 88 })).toBe(12);
    expect(sampleProbe(carte, { lat: -1, lon: 2 })).toBe(7);
  });

  it('REFUSE de se prononcer si une dimension requise manque', () => {
    // Un survol de hovmoller n a pas de longitude a offrir a une carte :
    // repondre quand meme afficherait la valeur d une longitude arbitraire.
    expect(sampleProbe(carte, { lat: 0, time: 12 })).toBeNull();
    expect(sampleProbe(carte, { lon: 0 })).toBeNull();
  });

  it('renvoie null sans resultat, sans sonde ou sans donnees', () => {
    expect(sampleProbe(null, { lat: 0, lon: 0 })).toBeNull();
    expect(sampleProbe(carte, null)).toBeNull();
    expect(sampleProbe({ type: 'slice', data: null }, { lat: 0, lon: 0 })).toBeNull();
  });

  it('renvoie null — pas NaN — sur une cellule masquee', () => {
    const trouee = { type: 'slice', data: { ...carte.data, data: [[NaN, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]] } };
    expect(sampleProbe(trouee, { lat: -40, lon: -180 })).toBeNull();
  });

  it('la longitude est CIRCULAIRE : -179 tombe pres de 180, pas pres de -90', () => {
    const grille360 = {
      type: 'slice',
      data: { latitudes: [0], longitudes: [0, 90, 180, 270], data: [[10, 20, 30, 40]] },
    };
    // Sur une convention 0-360, -179 equivaut a 181 : le noeud le plus proche
    // est 180. Une distance non repliee choisirait 0 (le premier candidat).
    expect(sampleProbe(grille360, { lat: 0, lon: -179 })).toBe(30);
    // Ecart de plus d un tour : c est le modulo qui l attrape.
    expect(sampleProbe(grille360, { lat: 0, lon: 361 })).toBe(10);
  });

  it('la latitude n est PAS circulaire', () => {
    // 100 deg n est pas une latitude ; le plus proche reste 40, pas -40.
    expect(sampleProbe(carte, { lat: 100, lon: 0 })).toBe(11);
  });

  it('lit une animation sur sa frame AFFICHEE, pas sur la frame 0', () => {
    const r = {
      id: 'anim3', type: 'animation', data: null,
    };
    largeDataStore.set('anim3', {
      latitudes: [0], longitudes: [0],
      frames: [[[100]], [[200]], [[300]]],
    });
    clearAnimationFrame('anim3');
    expect(sampleProbe(r, { lat: 0, lon: 0 })).toBe(100);
    setAnimationFrame('anim3', 2);
    expect(sampleProbe(r, { lat: 0, lon: 0 })).toBe(300);
    // Un index au-dela de la derniere frame est borne, pas undefined.
    setAnimationFrame('anim3', 99);
    expect(sampleProbe(r, { lat: 0, lon: 0 })).toBe(300);
    clearAnimationFrame('anim3');
    largeDataStore.delete('anim3');
  });

  it('renvoie null sur une animation sans frames', () => {
    const r = { id: 'vide', type: 'animation', data: { frames: [] } };
    expect(sampleProbe(r, { lat: 0, lon: 0 })).toBeNull();
  });

  it('echantillonne un hovmoller sur (temps, coordonnee spatiale)', () => {
    const r = {
      type: 'hovmoller',
      params: { hovmollerType: 'latitude' },
      data: { times: [0, 6, 12], spatialCoords: [-40, 0, 40], data: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] },
    };
    expect(sampleProbe(r, { time: 12, lat: 0 })).toBe(8);
    // Sans temps, pas de reponse.
    expect(sampleProbe(r, { lat: 0 })).toBeNull();
  });

  it('un hovmoller en longitude replie sa coordonnee', () => {
    const r = {
      type: 'hovmoller',
      params: { hovmollerType: 'longitude' },
      data: { times: [0], spatialCoords: [0, 90, 180, 270], data: [[1, 2, 3, 4]] },
    };
    expect(sampleProbe(r, { time: 0, lon: -179 })).toBe(3);
  });

  it('echantillonne une coupe sur (altitude, coordonnee horizontale)', () => {
    const r = {
      type: 'crosssection',
      params: { crossSectionType: 'meridional' },
      data: { altitudes: [0, 10, 20], horizontalCoords: [-40, 0, 40], data: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] },
    };
    expect(sampleProbe(r, { alt: 10, lat: 40 })).toBe(6);
    expect(sampleProbe(r, { lat: 40 })).toBeNull();
  });

  it('echantillonne la moyenne zonale et le profil temporel', () => {
    const zm = {
      type: 'zonalmean',
      data: { altitudes: [0, 10], latitudes: [-40, 40], data: [[1, 2], [3, 4]] },
    };
    expect(sampleProbe(zm, { alt: 10, lat: 40 })).toBe(4);
    expect(sampleProbe(zm, { alt: 10 })).toBeNull();

    const tp = {
      type: 'temporalprofile',
      data: { altitudes: [0, 10], times: [0, 12], data: [[1, 2], [3, 4]] },
    };
    expect(sampleProbe(tp, { alt: 0, time: 12 })).toBe(2);
    expect(sampleProbe(tp, { alt: 0 })).toBeNull();
  });

  it('renvoie null pour une vue non echantillonnable', () => {
    expect(sampleProbe({ type: 'windrose', data: {} }, { lat: 0, lon: 0 })).toBeNull();
  });
});

describe('probeAltKm', () => {
  it('renvoie l altitude en km, ou null', () => {
    expect(probeAltKm({ type: 'slice', data: { altitudeValue: 25.3 } })).toBe(25.3);
    expect(probeAltKm({ type: 'slice', data: {} })).toBeNull();
    expect(probeAltKm(null)).toBeNull();
  });

  it('va la chercher dans le magasin externe pour une animation', () => {
    largeDataStore.set('anim4', { altitudeValue: 7 });
    expect(probeAltKm({ id: 'anim4', type: 'animation', data: null })).toBe(7);
    largeDataStore.delete('anim4');
  });
});

describe('effectiveProbePoint', () => {
  beforeEach(() => { clearAnimationFrame('x'); });

  it('renvoie null pour une vue illisible par la sonde', () => {
    expect(effectiveProbePoint({ type: 'windrose' }, { lat: 0 })).toBeNull();
  });

  it('sans sonde, se reduit aux coordonnees fixes de la vue', () => {
    const r = { type: 'slice', params: { time: 24 }, data: { altitudeValue: 25 } };
    expect(effectiveProbePoint(r, null)).toEqual({ time: 12, alt: 25 });
  });

  it('la sonde ne recouvre QUE les dimensions portees par les axes de la vue', () => {
    // C est le point de tout le mecanisme : quatre vues a des heures
    // differentes montrent chacune SON heure, pas celle de la vue survolee.
    const r = { type: 'slice', params: { time: 24 }, data: { altitudeValue: 25 } };
    const pt = effectiveProbePoint(r, { lat: -38, lon: 12, time: 3, alt: 90 });
    expect(pt).toEqual({ time: 12, alt: 25, lat: -38, lon: 12 });
  });

  it('ignore les dimensions absentes du point sonde', () => {
    const r = { type: 'slice', params: { time: 24 }, data: {} };
    expect(effectiveProbePoint(r, { lat: -38 })).toEqual({ time: 12, lat: -38 });
  });

  it('un profil temporel garde son point et prend temps et altitude de la sonde', () => {
    const r = { type: 'temporalprofile', params: {}, data: { latitude: -40, longitude: 30 } };
    expect(effectiveProbePoint(r, { time: 6, alt: 12, lat: 0, lon: 0 }))
      .toEqual({ lat: -40, lon: 30, time: 6, alt: 12 });
  });
});
