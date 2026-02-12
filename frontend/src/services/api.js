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

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// ==================== ENDPOINTS ====================

/** GET /api/health — verification que le backend est operationnel */
export const healthCheck = () => api.get('/health');

/** GET /api/catalog — liste des datasets NetCDF disponibles */
export const getCatalog = () => api.get('/catalog');

/**
 * GET /api/data/slice — coupe 2D latitude/longitude
 * @param {Object} params - { dataset, variable, time, altitude }
 * @returns {Promise} SliceResponse (data[][], latitudes, longitudes, stats)
 */
export const getSlice = (params) => api.get('/data/slice', { params });

/**
 * GET /api/data/timeseries — serie temporelle en un point geographique
 * @param {Object} params - { dataset, variable, latitude, longitude, altitude }
 * @returns {Promise} TimeSeriesResponse (values[], stats)
 */
export const getTimeSeries = (params) => api.get('/data/timeseries', { params });

/**
 * GET /api/data/animation — ensemble de frames pour animation temporelle
 * @param {Object} params - { dataset, variable, altitude }
 * @returns {Promise} AnimationResponse (frames[], latitudes, longitudes, stats)
 */
export const getAnimation = (params) => api.get('/data/animation', { params });

/**
 * GET /api/export/csv/slice — export CSV d'une coupe 2D
 * responseType 'blob' pour permettre le telechargement cote client
 */
export const exportSliceCSV = (params) =>
  api.get('/export/csv/slice', { params, responseType: 'blob' });

/**
 * GET /api/export/csv/timeseries — export CSV d'une serie temporelle
 * responseType 'blob' pour permettre le telechargement cote client
 */
export const exportTimeSeriesCSV = (params) =>
  api.get('/export/csv/timeseries', { params, responseType: 'blob' });

export default api;
