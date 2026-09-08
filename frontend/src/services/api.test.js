import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import i18n from '../i18n';
import api, {
  getCatalog, getIndividualCatalog, getSlice, getTimeSeries, getAnimation,
  getProfile, getWind, getCrossSection, getAltitudes, getHovmoller,
  getZonalMean, getTides, getWindRose, getDifference, getTemporalProfile,
  getTransect, exportSliceCSV, exportSliceNetCDF, exportTimeSeriesCSV,
  exportProfileCSV, exportCrossSectionCSV, exportHovmollerCSV,
  exportZonalMeanCSV, exportWindRoseCSV, exportDifferenceCSV,
  exportTemporalProfileCSV,
} from './api';

/**
 * On branche un ADAPTATEUR Axios plutot que de bouchonner `axios.get` : les
 * deux intercepteurs (langue, normalisation des erreurs) et la couche de cache
 * restent alors dans le chemin teste, ce qui est justement ce qu'on veut
 * verifier. Rien ne sort sur le reseau.
 */
let appels;
let repondre;

const reponseOk = (config, data = { ok: true }) => ({
  data, status: 200, statusText: 'OK', headers: {}, config,
});

beforeEach(() => {
  appels = [];
  repondre = (config) => Promise.resolve(reponseOk(config));
  api.defaults.adapter = (config) => { appels.push(config); return repondre(config); };
});

afterEach(() => { vi.restoreAllMocks(); });

/** Parametres uniques par test : le cache du module est partage entre eux. */
let graine = 0;
const uniques = (extra = {}) => ({ dataset: `d${graine++}`, ...extra });

describe('intercepteur de requete — langue', () => {
  it('envoie Accept-Language depuis la langue i18n courante', async () => {
    await i18n.changeLanguage('fr');
    await getSlice(uniques());
    expect(appels[0].headers['Accept-Language']).toBe('fr');
  });

  it('ne garde que la partie langue d une locale regionale', async () => {
    // Le backend n a que 5 bundles : « fr-BE » n en designe aucun et
    // retomberait sur l anglais alors que « fr » existe.
    await i18n.changeLanguage('fr-BE');
    await getSlice(uniques());
    expect(appels[0].headers['Accept-Language']).toBe('fr');
    await i18n.changeLanguage('en');
  });

  it('vise /api en base, donc la meme origine qu en production', () => {
    expect(api.defaults.baseURL).toBe('/api');
  });

  it('laisse 30 s aux requetes lourdes (animation, marees)', () => {
    expect(api.defaults.timeout).toBe(30000);
  });
});

describe('intercepteur de reponse — normalisation des erreurs', () => {
  /** Fabrique un echec d adaptateur, comme Axios le presente aux intercepteurs. */
  const echec = (forme) => {
    repondre = () => Promise.reject(Object.assign(new Error('brut'), forme));
  };

  it('traduit un serveur injoignable', async () => {
    echec({ response: undefined, code: 'ERR_NETWORK' });
    await expect(getSlice(uniques())).rejects.toThrow(i18n.t('error.network'));
  });

  it('distingue un DELAI DEPASSE d une panne reseau', async () => {
    // Les deux arrivent sans `response` : sans le test sur le code, un serveur
    // lent serait annonce comme injoignable, ce qui envoie chercher au mauvais
    // endroit (connexion vs charge).
    echec({ response: undefined, code: 'ECONNABORTED' });
    await expect(getSlice(uniques())).rejects.toThrow(i18n.t('error.timeout'));
  });

  it('traduit un 429 en message de limitation', async () => {
    echec({ response: { status: 429, data: {} } });
    await expect(getSlice(uniques())).rejects.toThrow(i18n.t('error.rateLimit'));
  });

  it('traduit toute la famille 5xx', async () => {
    for (const status of [500, 502, 503]) {
      echec({ response: { status, data: {} } });
      await expect(getSlice(uniques()), String(status)).rejects.toThrow(i18n.t('error.server'));
    }
  });

  it('NE TOUCHE PAS a un 4xx : le backend y met deja son message traduit', async () => {
    // Les pages preferent `err.response.data.message` : le remplacer ici
    // ecraserait un message precis (« altitude hors bornes ») par un generique.
    echec({ response: { status: 400, data: { message: 'Altitude hors bornes' } }, message: 'brut' });
    await expect(getSlice(uniques())).rejects.toThrow('brut');
  });

  it('relaie une annulation volontaire sans la maquiller', async () => {
    // Un changement de page annule ses requetes : les presenter comme des
    // « erreurs reseau » ferait clignoter un toast a chaque navigation.
    repondre = () => Promise.reject(new axios.CanceledError('annule'));
    await expect(getSlice(uniques())).rejects.toSatisfy(axios.isCancel);
  });

  it('traduit l erreur dans la langue courante', async () => {
    await i18n.changeLanguage('fr');
    echec({ response: { status: 500, data: {} } });
    const err = await getSlice(uniques()).catch((e) => e);
    expect(err.message).toBe(i18n.t('error.server'));
    await i18n.changeLanguage('en');
    echec({ response: { status: 500, data: {} } });
    const en = await getSlice(uniques()).catch((e) => e);
    expect(en.message).not.toBe(err.message);
  });
});

describe('cache client', () => {
  it('sert la seconde requete identique sans repasser par le reseau', async () => {
    const p = uniques({ variable: 'TT', time: 24 });
    await getSlice(p);
    await getSlice({ ...p });
    expect(appels).toHaveLength(1);
  });

  it('ignore l ORDRE des cles : {a,b} et {b,a} sont la meme requete', async () => {
    const d = `ordre${graine++}`;
    await getSlice({ dataset: d, variable: 'TT', time: 24 });
    await getSlice({ time: 24, variable: 'TT', dataset: d });
    expect(appels).toHaveLength(1);
  });

  it('distingue deux requetes qui different d un seul parametre', async () => {
    const d = `diff${graine++}`;
    await getSlice({ dataset: d, altitude: 49 });
    await getSlice({ dataset: d, altitude: 50 });
    expect(appels).toHaveLength(2);
  });

  it('ne partage pas une entree entre deux endpoints aux memes parametres', async () => {
    const p = uniques({ variable: 'TT' });
    await getSlice(p);
    await getProfile(p);
    expect(appels).toHaveLength(2);
  });

  it('une annulation AVANT l envoi ne laisse rien en cache', async () => {
    const ctrl = new AbortController();
    const p = uniques({ variable: 'TT' });
    ctrl.abort();
    await expect(getSlice(p, ctrl.signal)).rejects.toSatisfy(axios.isCancel);
    // La requete n a meme pas ete dispatchee : Axios refuse en amont.
    expect(appels).toHaveLength(0);
    await getSlice(p);
    expect(appels).toHaveLength(1);
  });

  it('n enregistre PAS une reponse arrivee juste avant l annulation', async () => {
    // La COURSE que le garde `!signal?.aborted` couvre : la reponse revient,
    // puis l utilisateur change de page avant que le `.then` ne s execute. La
    // mettre en cache la servirait ensuite comme si elle etait toujours valide.
    // Un vrai AbortController ne permet pas de viser cet intervalle (Axios
    // rejette des le dispatch), d ou le signal simule.
    const signal = { aborted: false, addEventListener() {}, removeEventListener() {} };
    const p = uniques({ variable: 'TT' });
    repondre = (config) => { signal.aborted = true; return Promise.resolve(reponseOk(config)); };
    await getSlice(p, signal);
    repondre = (config) => Promise.resolve(reponseOk(config));
    await getSlice(p);
    expect(appels).toHaveLength(2);
  });

  it('expire au bout de 5 minutes', async () => {
    vi.useFakeTimers();
    try {
      const p = uniques({ variable: 'TT' });
      await getSlice(p);
      vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1);
      await getSlice(p);
      expect(appels).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('les exports ne passent pas par le cache (fichier toujours frais)', async () => {
    const p = uniques({ variable: 'TT' });
    await exportSliceCSV(p);
    await exportSliceCSV(p);
    expect(appels).toHaveLength(2);
  });

  it('le catalogue n est pas mis en cache cote client (le serveur s en charge)', async () => {
    await getCatalog();
    await getCatalog();
    expect(appels).toHaveLength(2);
  });
});

describe('contrat des endpoints', () => {
  it('interroge le bon chemin, avec ou sans cache', async () => {
    const cas = [
      [getCatalog, '/catalog'],
      [getIndividualCatalog, '/catalog/individual'],
      [getSlice, '/data/slice'],
      [getTimeSeries, '/data/timeseries'],
      [getAnimation, '/data/animation'],
      [getProfile, '/data/profile'],
      [getWind, '/data/wind'],
      [getCrossSection, '/data/crosssection'],
      [getAltitudes, '/data/altitudes'],
      [getHovmoller, '/data/hovmoller'],
      [getZonalMean, '/data/zonalmean'],
      [getTides, '/data/tides'],
      [getWindRose, '/data/windrose'],
      [getDifference, '/data/difference'],
      [getTemporalProfile, '/data/temporal-profile'],
      [getTransect, '/data/transect'],
    ];
    for (const [fn, chemin] of cas) {
      appels = [];
      await fn(uniques());
      expect(appels[0].url, chemin).toBe(chemin);
    }
  });

  it('demande un blob sur CHAQUE export, sinon Axios rend du texte decode', async () => {
    // Un NetCDF lu en texte est corrompu a l ouverture : c est le reglage qui
    // fait la difference entre un fichier valide et un fichier illisible.
    const exports = [
      [exportSliceCSV, '/export/csv/slice'],
      [exportSliceNetCDF, '/export/netcdf/slice'],
      [exportTimeSeriesCSV, '/export/csv/timeseries'],
      [exportProfileCSV, '/export/csv/profile'],
      [exportCrossSectionCSV, '/export/csv/crosssection'],
      [exportHovmollerCSV, '/export/csv/hovmoller'],
      [exportZonalMeanCSV, '/export/csv/zonalmean'],
      [exportWindRoseCSV, '/export/csv/windrose'],
      [exportDifferenceCSV, '/export/csv/difference'],
      [exportTemporalProfileCSV, '/export/csv/temporal-profile'],
    ];
    for (const [fn, chemin] of exports) {
      appels = [];
      await fn(uniques());
      expect(appels[0].url, chemin).toBe(chemin);
      expect(appels[0].responseType, chemin).toBe('blob');
    }
  });

  it('transmet le signal d annulation aux endpoints de donnees', async () => {
    const ctrl = new AbortController();
    await getSlice(uniques(), ctrl.signal);
    expect(appels[0].signal).toBe(ctrl.signal);
  });

  it('passe les parametres tels quels, sans les reserialiser', async () => {
    await getWind(uniques({ time: 24, altitude: 49 }));
    expect(appels[0].params).toMatchObject({ time: 24, altitude: 49 });
  });
});
