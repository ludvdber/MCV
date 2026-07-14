/**
 * Fetch d'une visualisation a partir de ses parametres de resultat.
 *
 * Source de verite UNIQUE du mapping type → endpoint : utilisee par le
 * lancement manuel (handleLancer), le rejeu des sessions persistees et le
 * permalien de session. Les parametres sont ceux stockes dans result.params
 * (dataset, variable, time, altitude, lat, lon, crossSectionType,
 * hovmollerType, datasetB, lat1..lon2).
 *
 * @returns {Promise<Object>} la reponse data de l'API
 * @throws l'erreur axios d'origine (message i18n backend dans response.data)
 */
import {
  getSlice, getTimeSeries, getAnimation, getProfile, getCrossSection,
  getHovmoller, getZonalMean, getWindRose, getDifference, getTemporalProfile,
  getTides, getTransect,
} from '../../services/api';

export async function fetchVizData(type, params) {
  const { dataset, variable, time, altitude } = params;
  switch (type) {
    case 'slice':
      return (await getSlice({ dataset, variable, time, altitude })).data;
    case 'timeseries':
      return (await getTimeSeries({ dataset, variable, latitude: params.lat, longitude: params.lon, altitude })).data;
    case 'animation':
      return (await getAnimation({ dataset, variable, altitude })).data;
    case 'profile':
      return (await getProfile({ dataset, variable, time, latitude: params.lat, longitude: params.lon })).data;
    case 'crosssection':
      return (await getCrossSection({
        dataset, variable, time,
        type: params.crossSectionType,
        fixedCoordinate: params.crossSectionType === 'meridional' ? params.lon : params.lat,
      })).data;
    case 'hovmoller':
      return (await getHovmoller({ dataset, variable, altitude, type: params.hovmollerType || 'latitude' })).data;
    case 'zonalmean':
      return (await getZonalMean({ dataset, variable, time })).data;
    case 'windrose':
      return (await getWindRose({ dataset, latitude: params.lat, longitude: params.lon, altitude })).data;
    case 'temporalprofile':
      return (await getTemporalProfile({ dataset, variable, latitude: params.lat, longitude: params.lon })).data;
    case 'difference':
      return (await getDifference({ datasetA: dataset, datasetB: params.datasetB, variable, time, altitude })).data;
    case 'tides':
      return (await getTides({ dataset, variable, altitude })).data;
    case 'transect':
      return (await getTransect({
        dataset, variable, time,
        lat1: params.lat1, lon1: params.lon1, lat2: params.lat2, lon2: params.lon2,
      })).data;
    default:
      throw new Error(`Unknown viz type: ${type}`);
  }
}
