/**
 * Service HTTP centralise pour communiquer avec le backend Spring Boot.
 *
 * Utilise Axios avec un baseURL relatif '/api'. En developpement, les
 * requetes sont proxifiees vers http://localhost:8080 par Vite (voir
 * vite.config.js). En production, le frontend et le backend sont servis
 * depuis la meme origine, donc '/api' fonctionne directement.
 *
 * Timeout fixe a 30 secondes pour les requetes lourdes (ex: animation
 * avec plusieurs frames NetCDF).
 */
import axios from 'axios';
import i18n from '../i18n';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

/** Synchronise la langue frontend avec le backend via Accept-Language */
api.interceptors.request.use(config => {
  config.headers['Accept-Language'] = i18n.language.split('-')[0];
  return config;
});

/** Normalise les erreurs reseau en messages comprehensibles */
api.interceptors.response.use(
  res => res,
  err => {
    if (!err.response) {
      // Erreur reseau (serveur injoignable, timeout, CORS)
      if (err.code === 'ECONNABORTED') {
        err.message = i18n.t('error.timeout', { ns: 'translation', defaultValue: 'Request timed out — the server may be overloaded. Try again.' });
      } else {
        err.message = i18n.t('error.network', { ns: 'translation', defaultValue: 'Cannot reach the server. Check your connection and try again.' });
      }
    } else {
      const status = err.response.status;
      if (status === 429) {
        err.message = i18n.t('error.rateLimit', { ns: 'translation', defaultValue: 'Too many requests — please wait a moment and try again.' });
      } else if (status >= 500) {
        err.message = i18n.t('error.server', { ns: 'translation', defaultValue: 'Server error — please try again later.' });
      }
      // 4xx: keep the backend's i18n error message (err.response.data.message)
    }
    return Promise.reject(err);
  },
);

// ==================== CACHE ====================

/** Cache en memoire pour les endpoints de donnees (TTL 5 min, max 50 entrees). */
const _cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const CACHE_MAX = 50;

/** Purge les entrees expirees et ejecte les plus anciennes si > CACHE_MAX. */
function purgeCache() {
  const now = Date.now();
  for (const [k, v] of _cache) {
    if (now - v.ts > CACHE_TTL) _cache.delete(k);
  }
  // If still over limit, remove oldest entries
  if (_cache.size > CACHE_MAX) {
    const sorted = [..._cache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    const toRemove = sorted.slice(0, _cache.size - CACHE_MAX);
    for (const [k] of toRemove) _cache.delete(k);
  }
}

// Purge periodique toutes les 60 secondes
const _purgeInterval = setInterval(purgeCache, 60_000);
// Prevent interval leak during Vite HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => clearInterval(_purgeInterval));
}

/**
 * Cle de cache deterministe : trie les parametres par cle alphabetique pour
 * eviter des cache misses sur des requetes identiques dont les cles
 * seraient dans un ordre different ({a:1,b:2} ≡ {b:2,a:1}).
 */
function canonicalKey(endpoint, params) {
  const sorted = Object.fromEntries(
    Object.keys(params).sort().map(k => [k, params[k]])
  );
  return `${endpoint}:${JSON.stringify(sorted)}`;
}

/**
 * GET avec mise en cache cote client.
 * @param {string}       endpoint - chemin relatif (ex: '/data/slice')
 * @param {Object}       params   - parametres de requete
 * @param {AbortSignal}  [signal] - signal d'annulation optionnel (AbortController.signal)
 */
function cachedGet(endpoint, params, signal) {
  const key = canonicalKey(endpoint, params);
  const entry = _cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) {
    return Promise.resolve(entry.res);
  }
  return api.get(endpoint, { params, signal }).then(res => {
    if (!signal?.aborted) _cache.set(key, { ts: Date.now(), res });
    return res;
  });
}

// ==================== ENDPOINTS ====================

/** GET /api/catalog — liste des datasets NetCDF MEAN disponibles */
export const getCatalog = () => api.get('/catalog');

/** GET /api/catalog/individual — catalogue des annees martiennes (fichiers individuels) */
export const getIndividualCatalog = () => api.get('/catalog/individual');

/**
 * GET /api/data/slice — coupe 2D latitude/longitude
 * @param {Object} params - { dataset, variable, time, altitude }
 * @returns {Promise} SliceResponse (data[][], latitudes, longitudes, stats)
 */
export const getSlice = (params) => cachedGet('/data/slice', params);

/**
 * GET /api/data/timeseries — serie temporelle en un point geographique
 * @param {Object} params - { dataset, variable, latitude, longitude, altitude }
 * @returns {Promise} TimeSeriesResponse (values[], stats)
 */
export const getTimeSeries = (params) => cachedGet('/data/timeseries', params);

/**
 * GET /api/data/animation — ensemble de frames pour animation temporelle
 * @param {Object} params - { dataset, variable, altitude }
 * @returns {Promise} AnimationResponse (frames[], latitudes, longitudes, stats)
 */
export const getAnimation = (params) => cachedGet('/data/animation', params);

/**
 * GET /api/export/csv/slice — export CSV d'une coupe 2D
 * responseType 'blob' pour permettre le telechargement cote client
 */
export const exportSliceCSV = (params) =>
  api.get('/export/csv/slice', { params, responseType: 'blob' });

/** GET /api/export/netcdf/slice — export NetCDF d'une slice 2D */
export const exportSliceNetCDF = (params) =>
  api.get('/export/netcdf/slice', { params, responseType: 'blob' });

/**
 * GET /api/export/csv/timeseries — export CSV d'une serie temporelle
 * responseType 'blob' pour permettre le telechargement cote client
 */
export const exportTimeSeriesCSV = (params) =>
  api.get('/export/csv/timeseries', { params, responseType: 'blob' });

/**
 * GET /api/data/profile — profil vertical en un point
 * @param {Object} params - { dataset, variable, time, latitude, longitude }
 * @returns {Promise} ProfileResponse (altitudes[], values[], stats)
 */
export const getProfile = (params) => cachedGet('/data/profile', params);

/**
 * GET /api/data/wind — champ de vent UU/VV subsample pour superposition sur slice
 * @param {Object}       params   - { dataset, time, altitudeIndex }
 * @param {AbortSignal}  [signal] - signal d'annulation optionnel
 * @returns {Promise} { lats[], lons[], u[], v[] }
 */
export const getWind = (params, signal) => cachedGet('/data/wind', params, signal);

/**
 * GET /api/data/crosssection — coupe verticale meridionale ou zonale
 * @param {Object} params - { dataset, variable, time, type, fixedCoordinate }
 * @returns {Promise} CrossSectionResponse (data[][], altitudes[], horizontalCoords[], stats)
 */
export const getCrossSection = (params) => cachedGet('/data/crosssection', params);

/**
 * GET /api/data/altitudes — tableau des altitudes en km pour un dataset/variable
 * @param {Object} params - { dataset, variable }
 * @returns {Promise} { surface: boolean, altitudes: number[] }
 */
export const getAltitudes = (params) => cachedGet('/data/altitudes', params);

/**
 * GET /api/data/hovmoller — diagramme de Hovmoller (temps x lat ou lon)
 * @param {Object} params - { dataset, variable, altitude, type }
 * @returns {Promise} HovmollerResponse (data[][], times[], spatialCoords[], stats)
 */
export const getHovmoller = (params) => cachedGet('/data/hovmoller', params);

/**
 * GET /api/data/zonalmean — moyenne zonale (lat x altitude)
 * @param {Object} params - { dataset, variable, time }
 * @returns {Promise} ZonalMeanResponse (data[][], latitudes[], altitudes[], stats)
 */
export const getZonalMean = (params) => cachedGet('/data/zonalmean', params);

/**
 * GET /api/data/windrose — rose des vents (UU/VV sur 48 timesteps)
 * @param {Object} params - { dataset, latitude, longitude, altitude }
 * @returns {Promise} WindRoseResponse (uu[], vv[], actualLat, actualLon)
 */
export const getWindRose = (params) => cachedGet('/data/windrose', params);

/**
 * GET /api/data/difference — difference entre deux datasets (A - B)
 * @param {Object} params - { datasetA, datasetB, variable, time, altitude }
 * @returns {Promise} DifferenceResponse (data[][], stats)
 */
export const getDifference = (params) => cachedGet('/data/difference', params);

/** GET /api/export/csv/profile — export CSV d'un profil vertical */
export const exportProfileCSV = (params) =>
  api.get('/export/csv/profile', { params, responseType: 'blob' });

/** GET /api/export/csv/crosssection — export CSV d'une coupe verticale */
export const exportCrossSectionCSV = (params) =>
  api.get('/export/csv/crosssection', { params, responseType: 'blob' });

/** GET /api/export/csv/hovmoller */
export const exportHovmollerCSV = (params) =>
  api.get('/export/csv/hovmoller', { params, responseType: 'blob' });

/** GET /api/export/csv/zonalmean */
export const exportZonalMeanCSV = (params) =>
  api.get('/export/csv/zonalmean', { params, responseType: 'blob' });

/** GET /api/export/csv/windrose */
export const exportWindRoseCSV = (params) =>
  api.get('/export/csv/windrose', { params, responseType: 'blob' });

/** GET /api/export/csv/difference */
export const exportDifferenceCSV = (params) =>
  api.get('/export/csv/difference', { params, responseType: 'blob' });

/** GET /api/data/temporal-profile — profil altitude x temps en un point */
export const getTemporalProfile = (params) => cachedGet('/data/temporal-profile', params);

/** GET /api/export/csv/temporal-profile */
export const exportTemporalProfileCSV = (params) =>
  api.get('/export/csv/temporal-profile', { params, responseType: 'blob' });

export default api;
