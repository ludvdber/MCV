/**
 * Sonde liée dimensionnelle : correspondance entre vues hétérogènes.
 *
 * Chaque vue lisible par la sonde (PROBE_TYPES) expose ses deux axes en
 * DIMENSIONS physiques partagées : lat, lon, time (heures locales martiennes),
 * alt (km). Survoler une vue publie un point { lat?, lon?, time?, alt? }
 * complété par les coordonnées FIXES de la vue source — une slice à 14:00 et
 * ~25 km publie aussi son heure et son altitude. Chaque autre vue échantillonne
 * alors sa propre grille sur les dimensions qu'elle partage avec le point, au
 * plus proche voisin (même sémantique que le survol Plotly natif) ; il ne se
 * prononce pas si une dimension requise manque (ex : un survol de hovmöller
 * n'a pas de longitude à offrir à une slice — réticule partiel, pas de valeur).
 *
 * Conventions d'unités (celles des réponses API) :
 *   time — heures locales (axes hovmöller / profil temporel) ; params.time est
 *          un INDEX 0–47 → × 0,5 h.
 *   alt  — km (altitudeValue / altitudes des réponses).
 */
import { largeDataStore } from './largeDataStore.js';
import { getAnimationFrame } from './probeBus.js';

/** Dimensions portées par les axes (x, y) d'une vue, ou null si la vue n'est
 *  pas lisible par la sonde. */
export function probeAxes(result) {
  switch (result?.type) {
    case 'slice': case 'animation': case 'difference':
      return { x: 'lon', y: 'lat' };
    case 'hovmoller':
      return { x: (result.params?.hovmollerType ?? result.data?.type) === 'longitude' ? 'lon' : 'lat', y: 'time' };
    case 'crosssection':
      return { x: (result.params?.crossSectionType ?? result.data?.type) === 'zonal' ? 'lon' : 'lat', y: 'alt' };
    case 'zonalmean':
      return { x: 'lat', y: 'alt' };
    case 'temporalprofile':
      return { x: 'time', y: 'alt' };
    default:
      return null;
  }
}

/** Données de la vue (les frames d'animation vivent hors state React). */
function dataFor(result) {
  return result?.type === 'animation'
    ? (largeDataStore.get(result.id) ?? result.data)
    : result?.data;
}

/** Coordonnées FIXES de la vue : les dimensions absentes de ses axes mais qui
 *  qualifient son contenu (l'heure d'une slice, la longitude d'une coupe
 *  méridienne…). Fusionnées au point publié par le survol. */
export function fixedProbeDims(result) {
  const out = {};
  if (!result) return out;
  const d = dataFor(result) ?? {};
  const p = result.params ?? {};
  switch (result.type) {
    case 'slice': case 'difference':
      if (p.time != null) out.time = p.time * 0.5;
      if (d.altitudeValue != null) out.alt = d.altitudeValue;
      break;
    case 'animation':
      out.time = getAnimationFrame(result.id) * 0.5;
      if (d.altitudeValue != null) out.alt = d.altitudeValue;
      break;
    case 'hovmoller':
      if (d.altitudeValue != null) out.alt = d.altitudeValue;
      break;
    case 'crosssection': {
      if (p.time != null) out.time = p.time * 0.5;
      const fixed = d.fixedCoordinate;
      if (fixed != null) out[(p.crossSectionType ?? d.type) === 'zonal' ? 'lat' : 'lon'] = fixed;
      break;
    }
    case 'zonalmean':
      // La longitude est moyennée : la vue n'a que le temps à offrir en plus.
      if (p.time != null) out.time = p.time * 0.5;
      break;
    case 'temporalprofile':
      if (d.latitude != null) out.lat = d.latitude;
      if (d.longitude != null) out.lon = d.longitude;
      break;
  }
  return out;
}

const val = (v) => (v == null || Number.isNaN(v)) ? null : v;

function nearestIdx(arr, target) {
  if (!Array.isArray(arr) || arr.length === 0 || target == null) return -1;
  let bi = 0, bd = Infinity;
  for (let i = 0; i < arr.length; i++) {
    const d = Math.abs(arr[i] - target);
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
}

/** Plus proche longitude, insensible à la convention (0–360 vs ±180). */
function nearestLonIdx(arr, lon) {
  if (!Array.isArray(arr) || arr.length === 0 || lon == null) return -1;
  let bi = 0, bd = Infinity;
  for (let i = 0; i < arr.length; i++) {
    let d = Math.abs(arr[i] - lon) % 360;
    if (d > 180) d = 360 - d;
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
}

/**
 * Valeur de la vue au point sondé, ou null si le point ne porte pas les
 * dimensions dont la vue a besoin. Une animation est lue sur sa frame
 * AFFICHÉE (probeBus.getAnimationFrame), pas sur la frame 0.
 */
export function sampleProbe(result, probe) {
  if (!result || !probe) return null;
  const d = dataFor(result);
  if (!d) return null;
  switch (result.type) {
    case 'slice': case 'difference': {
      if (probe.lat == null || probe.lon == null) return null;
      return val(d.data?.[nearestIdx(d.latitudes, probe.lat)]?.[nearestLonIdx(d.longitudes, probe.lon)]);
    }
    case 'animation': {
      if (probe.lat == null || probe.lon == null || !d.frames?.length) return null;
      const frame = d.frames[Math.min(getAnimationFrame(result.id), d.frames.length - 1)];
      return val(frame?.[nearestIdx(d.latitudes, probe.lat)]?.[nearestLonIdx(d.longitudes, probe.lon)]);
    }
    case 'hovmoller': {
      const coordDim = probeAxes(result).x;
      if (probe[coordDim] == null || probe.time == null) return null;
      const ci = coordDim === 'lon'
        ? nearestLonIdx(d.spatialCoords, probe.lon)
        : nearestIdx(d.spatialCoords, probe.lat);
      return val(d.data?.[nearestIdx(d.times, probe.time)]?.[ci]);
    }
    case 'crosssection': {
      const coordDim = probeAxes(result).x;
      if (probe[coordDim] == null || probe.alt == null) return null;
      const ci = coordDim === 'lon'
        ? nearestLonIdx(d.horizontalCoords, probe.lon)
        : nearestIdx(d.horizontalCoords, probe.lat);
      return val(d.data?.[nearestIdx(d.altitudes, probe.alt)]?.[ci]);
    }
    case 'zonalmean': {
      if (probe.lat == null || probe.alt == null) return null;
      return val(d.data?.[nearestIdx(d.altitudes, probe.alt)]?.[nearestIdx(d.latitudes, probe.lat)]);
    }
    case 'temporalprofile': {
      if (probe.time == null || probe.alt == null) return null;
      return val(d.data?.[nearestIdx(d.altitudes, probe.alt)]?.[nearestIdx(d.times, probe.time)]);
    }
    default:
      return null;
  }
}

/** Altitude (km) affichable dans l'étiquette d'une ligne de sonde — lue dans
 *  le largeDataStore pour les animations (result.data y est null). */
export function probeAltKm(result) {
  return dataFor(result)?.altitudeValue ?? null;
}

/**
 * Point 4D EFFECTIVEMENT échantillonné par une vue : ses coordonnées fixes,
 * recouvertes par le point sondé sur les dimensions que ses axes portent.
 * Quatre vues à des heures différentes montrent ainsi chacune SON heure dans
 * le panneau latéral, pas celle de la vue survolée. Sans sonde active, le
 * point se réduit aux coordonnées fixes de la vue (toujours informatif).
 */
export function effectiveProbePoint(result, probe) {
  const axes = probeAxes(result);
  if (!axes) return null;
  const pt = { ...fixedProbeDims(result) };
  if (probe) {
    for (const dim of [axes.x, axes.y]) {
      if (probe[dim] != null) pt[dim] = probe[dim];
    }
  }
  return pt;
}
