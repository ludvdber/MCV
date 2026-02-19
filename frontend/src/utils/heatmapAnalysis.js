/**
 * Calculs scientifiques pour les tooltips enrichis des heatmaps.
 *
 * Pour chaque cellule (lat, lon) d'une grille 2D, calcule :
 * - Anomalie zonale (ecart a la moyenne de la meme latitude)
 * - Gradient latitudinal et longitudinal (differences centrales)
 * - Rang percentile dans la distribution globale
 * - POI martien le plus proche (nom + distance en km)
 */

import { MARS_LOCATIONS } from '../data/marsLocations';

const MARS_RADIUS_KM = 3389.5;

/** Distance haversine sur Mars entre deux points (degres) */
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return MARS_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calcule les donnees enrichies pour chaque cellule d'un heatmap.
 *
 * @param {number[][]} z - donnees 2D [nLat][nLon]
 * @param {number[]} latitudes
 * @param {number[]} longitudes
 * @returns {Array[][]} customdata 2D — chaque cellule = [anomalie, gradLat, gradLon, percentile, poiName, poiDistKm]
 */
export function computeHeatmapCustomData(z, latitudes, longitudes) {
  const nLat = latitudes.length;
  const nLon = longitudes.length;

  // Passe unique : collecte des valeurs valides + accumulation des moyennes zonales.
  // Evite de parcourir la grille deux fois separement.
  const sorted = [];
  const zonalSums = new Float64Array(nLat);
  const zonalCounts = new Int32Array(nLat);
  for (let i = 0; i < nLat; i++) {
    for (let j = 0; j < nLon; j++) {
      const v = z[i]?.[j];
      if (v != null && !isNaN(v)) {
        sorted.push(v);
        zonalSums[i] += v;
        zonalCounts[i]++;
      }
    }
  }
  sorted.sort((a, b) => a - b);
  const total = sorted.length;

  const zonalMeans = new Float64Array(nLat);
  for (let i = 0; i < nLat; i++) {
    zonalMeans[i] = zonalCounts[i] > 0 ? zonalSums[i] / zonalCounts[i] : 0;
  }

  // Recherche binaire pour le percentile
  function percentileRank(value) {
    let lo = 0, hi = total;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < value) lo = mid + 1;
      else hi = mid;
    }
    return total > 0 ? (lo / total) * 100 : 50;
  }

  const dataIs0to360 = longitudes.some(l => l > 180);

  const customData = [];
  for (let i = 0; i < nLat; i++) {
    const row = [];
    for (let j = 0; j < nLon; j++) {
      const val = z[i]?.[j];
      if (val == null || isNaN(val)) {
        row.push([0, 0, 0, 0, '-', 0]);
        continue;
      }

      // Anomalie zonale
      const anomaly = val - zonalMeans[i];

      // Gradient latitudinal (differences centrales, forward/backward aux bords)
      let gradLat = 0;
      if (nLat > 1) {
        if (i === 0) gradLat = ((z[1]?.[j] ?? val) - val) / (latitudes[1] - latitudes[0]);
        else if (i === nLat - 1) gradLat = (val - (z[nLat - 2]?.[j] ?? val)) / (latitudes[nLat - 1] - latitudes[nLat - 2]);
        else gradLat = ((z[i + 1]?.[j] ?? val) - (z[i - 1]?.[j] ?? val)) / (latitudes[i + 1] - latitudes[i - 1]);
      }

      // Gradient longitudinal
      let gradLon = 0;
      if (nLon > 1) {
        if (j === 0) gradLon = ((z[i]?.[1] ?? val) - val) / (longitudes[1] - longitudes[0]);
        else if (j === nLon - 1) gradLon = (val - (z[i]?.[nLon - 2] ?? val)) / (longitudes[nLon - 1] - longitudes[nLon - 2]);
        else gradLon = ((z[i]?.[j + 1] ?? val) - (z[i]?.[j - 1] ?? val)) / (longitudes[j + 1] - longitudes[j - 1]);
      }

      // Percentile
      const pct = percentileRank(val);

      // POI le plus proche
      const cellLat = latitudes[i];
      const cellLon = longitudes[j];
      let nearestName = '-';
      let nearestDist = Infinity;
      for (const loc of MARS_LOCATIONS) {
        const poiLon = dataIs0to360 && loc.lon < 0 ? loc.lon + 360 : loc.lon;
        const d = haversineKm(cellLat, cellLon, loc.lat, poiLon);
        if (d < nearestDist) {
          nearestDist = d;
          nearestName = loc.name;
        }
      }

      row.push([anomaly, gradLat, gradLon, pct, nearestName, Math.round(nearestDist)]);
    }
    customData.push(row);
  }

  return customData;
}

/**
 * Calcule l'anomalie zonale d'une grille 2D (ecart a la moyenne de chaque latitude).
 * Utilise pour le mode anomalie relative des heatmaps lat/lon.
 *
 * @param {number[][]} z - donnees 2D [nLat][nLon]
 * @param {number[]} latitudes - tableau des latitudes
 * @returns {{ anomalyZ: number[][], maxAbsAnomaly: number }}
 */
export function computeAnomalyZ(z, latitudes) {
  const nLat = latitudes.length;
  const nLon = z[0]?.length || 0;

  const zonalMeans = new Float64Array(nLat);
  for (let i = 0; i < nLat; i++) {
    let sum = 0, count = 0;
    for (let j = 0; j < nLon; j++) {
      const v = z[i]?.[j];
      if (v != null && !isNaN(v)) { sum += v; count++; }
    }
    zonalMeans[i] = count > 0 ? sum / count : 0;
  }

  let maxAbs = 0;
  const anomalyZ = [];
  for (let i = 0; i < nLat; i++) {
    const row = [];
    for (let j = 0; j < nLon; j++) {
      const v = z[i]?.[j];
      if (v == null || isNaN(v)) {
        row.push(NaN);
      } else {
        const a = v - zonalMeans[i];
        row.push(a);
        const abs = Math.abs(a);
        if (abs > maxAbs) maxAbs = abs;
      }
    }
    anomalyZ.push(row);
  }

  return { anomalyZ, maxAbsAnomaly: maxAbs };
}
