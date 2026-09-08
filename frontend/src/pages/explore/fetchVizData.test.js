import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `fetchVizData` est la SOURCE UNIQUE du mapping type de vue -> endpoint : le
 * lancement manuel, le rejeu de session et le permalien passent tous par elle.
 * Une erreur de nom de parametre y devient donc invisible (Spring applique
 * silencieusement sa valeur par defaut), d'ou des assertions sur les noms
 * EXACTS envoyes, pas seulement sur l'endpoint atteint.
 */
vi.mock('../../services/api', () => {
  const fabrique = (nom) => vi.fn((params) => Promise.resolve({ data: { appele: nom, params } }));
  return {
    getSlice: fabrique('slice'),
    getTimeSeries: fabrique('timeseries'),
    getAnimation: fabrique('animation'),
    getProfile: fabrique('profile'),
    getCrossSection: fabrique('crosssection'),
    getHovmoller: fabrique('hovmoller'),
    getZonalMean: fabrique('zonalmean'),
    getWindRose: fabrique('windrose'),
    getDifference: fabrique('difference'),
    getTemporalProfile: fabrique('temporalprofile'),
    getTides: fabrique('tides'),
    getTransect: fabrique('transect'),
  };
});

const { fetchVizData } = await import('./fetchVizData');
const api = await import('../../services/api');

const P = {
  dataset: 'mean_MY35_Ls0_30', variable: 'TT', time: 24, altitude: 49,
  lat: -40, lon: 30, lat1: 0, lon1: 0, lat2: 10, lon2: 10,
  datasetB: 'mean_MY35_Ls30_60',
};

beforeEach(() => { vi.clearAllMocks(); });

describe('fetchVizData — routage', () => {
  it.each([
    ['slice', 'getSlice'],
    ['timeseries', 'getTimeSeries'],
    ['animation', 'getAnimation'],
    ['profile', 'getProfile'],
    ['crosssection', 'getCrossSection'],
    ['hovmoller', 'getHovmoller'],
    ['zonalmean', 'getZonalMean'],
    ['windrose', 'getWindRose'],
    ['temporalprofile', 'getTemporalProfile'],
    ['difference', 'getDifference'],
    ['tides', 'getTides'],
    ['transect', 'getTransect'],
  ])('%s appelle %s', async (type, fn) => {
    await fetchVizData(type, { ...P, crossSectionType: 'zonal' });
    expect(api[fn]).toHaveBeenCalledTimes(1);
  });

  it('deplie la reponse : renvoie `data`, pas l enveloppe Axios', async () => {
    const d = await fetchVizData('slice', P);
    expect(d.appele).toBe('slice');
  });

  it('leve sur un type inconnu plutot que de renvoyer undefined', async () => {
    await expect(fetchVizData('inexistant', P)).rejects.toThrow('Unknown viz type: inexistant');
  });
});

describe('fetchVizData — noms de parametres', () => {
  it('renomme lat/lon en latitude/longitude pour les endpoints ponctuels', async () => {
    // Le controleur declare `latitude` : envoyer `lat` ferait appliquer le
    // defaut sans erreur ni journal.
    for (const type of ['timeseries', 'profile', 'windrose', 'temporalprofile']) {
      vi.clearAllMocks();
      await fetchVizData(type, P);
      const appel = Object.values(api).find((f) => f.mock?.calls.length)?.mock.calls[0][0];
      expect(appel, type).toMatchObject({ latitude: -40, longitude: 30 });
      expect(appel, type).not.toHaveProperty('lat');
    }
  });

  it('la coupe envoie la coordonnee FIXE selon sa direction', async () => {
    await fetchVizData('crosssection', { ...P, crossSectionType: 'meridional' });
    expect(api.getCrossSection).toHaveBeenCalledWith(expect.objectContaining({
      type: 'meridional', fixedCoordinate: 30,
    }));
    vi.clearAllMocks();
    await fetchVizData('crosssection', { ...P, crossSectionType: 'zonal' });
    expect(api.getCrossSection).toHaveBeenCalledWith(expect.objectContaining({
      type: 'zonal', fixedCoordinate: -40,
    }));
  });

  it('le hovmoller retombe sur « latitude » quand l orientation manque', async () => {
    await fetchVizData('hovmoller', P);
    expect(api.getHovmoller).toHaveBeenCalledWith(expect.objectContaining({ type: 'latitude' }));
  });

  it('la difference envoie datasetA / datasetB, pas dataset', async () => {
    await fetchVizData('difference', P);
    const appel = api.getDifference.mock.calls[0][0];
    expect(appel.datasetA).toBe(P.dataset);
    expect(appel.datasetB).toBe(P.datasetB);
    expect(appel).not.toHaveProperty('dataset');
  });

  it('le transect envoie ses deux extremites', async () => {
    await fetchVizData('transect', P);
    expect(api.getTransect).toHaveBeenCalledWith(expect.objectContaining({
      lat1: 0, lon1: 0, lat2: 10, lon2: 10,
    }));
  });

  it('n envoie pas d altitude aux vues qui n en ont pas', async () => {
    // Un profil vertical parcourt toutes les altitudes ; la moyenne zonale
    // aussi. Leur en passer une n aurait aucun sens.
    await fetchVizData('profile', P);
    expect(api.getProfile.mock.calls[0][0]).not.toHaveProperty('altitude');
    await fetchVizData('zonalmean', P);
    expect(api.getZonalMean.mock.calls[0][0]).not.toHaveProperty('altitude');
  });

  it('propage l erreur d origine (le message i18n backend doit survivre)', async () => {
    api.getSlice.mockRejectedValueOnce(Object.assign(new Error('brut'), {
      response: { data: { message: 'Altitude hors bornes' } },
    }));
    const err = await fetchVizData('slice', P).catch((e) => e);
    expect(err.response.data.message).toBe('Altitude hors bornes');
  });
});
