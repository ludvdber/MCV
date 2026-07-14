/**
 * Helpers purs partages entre ExplorePage et le ROI.
 */
import { VARIABLES_MAP } from '../../components/VariableSelector';
import { formatTime } from '../../utils/formatTime';

/**
 * Statistiques d'un échantillon pondéré. Les cellules d'une grille lat/lon
 * régulière en degrés ne couvrent pas la même surface (les mailles polaires
 * sont plus petites) : le poids cos(latitude) corrige ce biais. On renvoie à la
 * fois les moments ARITHMÉTIQUES (mean, stddev) et PONDÉRÉS (weightedMean,
 * weightedStddev, weightedMedian) pour que chaque appelant choisisse — la
 * statistique de région privilégie l'arithmétique, les couches dérivées le
 * pondéré. Cœur partagé de computeRegionStats et de gridStats (ExplorePage).
 *
 * @param {number[]} vals  valeurs (déjà filtrées : ni null ni NaN)
 * @param {number[]} wts   poids parallèles (même longueur)
 * @returns {Object|null}  null si l'échantillon est vide
 */
export function weightedStats(vals, wts) {
  const n = vals.length;
  if (n === 0) return null;
  let min = Infinity, max = -Infinity, sum = 0, wSum = 0, wvSum = 0;
  for (let k = 0; k < n; k++) {
    const v = vals[k], w = wts[k];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v; wSum += w; wvSum += w * v;
  }
  const mean = sum / n;
  const weightedMean = wSum > 0 ? wvSum / wSum : mean;
  let varSum = 0, wVarSum = 0;
  for (let k = 0; k < n; k++) {
    varSum += (vals[k] - mean) ** 2;
    wVarSum += wts[k] * (vals[k] - weightedMean) ** 2;
  }
  const stddev = Math.sqrt(varSum / n);
  const weightedStddev = wSum > 0 ? Math.sqrt(wVarSum / wSum) : stddev;
  // Médiane pondérée : seuil à Σw/2 sur les valeurs triées.
  const order = vals.map((_, k) => k).sort((a, b) => vals[a] - vals[b]);
  const half = wSum / 2;
  let run = 0, weightedMedian = vals[order[0]];
  for (const k of order) { run += wts[k]; if (run >= half) { weightedMedian = vals[k]; break; } }
  return { n, min, max, mean, stddev, weightedMean, weightedStddev, weightedMedian };
}

/**
 * Statistiques d'une region rectangulaire d'une grille lat/lon (moyenne
 * arithmetique + moyenne ponderee cos(lat)). Voir {@link weightedStats}.
 *
 * @param {{data: number[][], latitudes: number[], longitudes: number[]}} gridData
 * @param {{latMin, latMax, lonMin, lonMax}} bounds
 * @returns {Object|null} stats ou null si aucune cellule dans la region
 */
export function computeRegionStats(gridData, bounds) {
  const { data, latitudes, longitudes } = gridData ?? {};
  if (!Array.isArray(data) || !Array.isArray(latitudes) || !Array.isArray(longitudes)) return null;

  const vals = [], wts = [];
  for (let i = 0; i < latitudes.length; i++) {
    const lat = latitudes[i];
    if (lat < bounds.latMin || lat > bounds.latMax) continue;
    const w = Math.max(0, Math.cos(lat * Math.PI / 180));
    for (let j = 0; j < longitudes.length; j++) {
      const lon = longitudes[j];
      if (lon < bounds.lonMin || lon > bounds.lonMax) continue;
      const v = data[i]?.[j];
      if (v == null || Number.isNaN(v)) continue;
      vals.push(v); wts.push(w);
    }
  }
  const s = weightedStats(vals, wts);
  if (!s) return null;

  return {
    n: s.n, min: s.min, max: s.max, mean: s.mean, stddev: s.stddev,
    weightedMean: s.weightedMean,
    // Valeurs brutes de la region : l'histogramme du panneau lateral montre la
    // FORME de la distribution (bimodale, ecrasee, a queue longue) que les
    // moments seuls ne revelent pas.
    values: vals,
    ...bounds,
  };
}

/**
 * Génère un label court pour l'onglet d'un résultat.
 * @param {number|null} altKm altitude réelle en km (response.altitudeValue) :
 *   affichée à la place de l'index brut « altN » quand elle est connue.
 */
export function genLabel(type, params, t, altKm = null) {
  const varLabel = VARIABLES_MAP.has(params.variable) ? t(`variable.${params.variable}`) : params.variable;
  const altText = altKm != null ? `${Number(altKm).toFixed(0)} km` : `alt${params.altitude}`;
  switch (type) {
    case 'slice':
      return `${varLabel} ${formatTime(params.time)} · ${altText}`;
    case 'timeseries':
      return `${varLabel} (${params.lat}°, ${params.lon}°)`;
    case 'animation':
      return `${varLabel} · ${altText}`;
    case 'profile':
      return `${t('explore.tab_profile_short')} ${varLabel} (${params.lat}°, ${params.lon}°)`;
    case 'crosssection': {
      const dir   = params.crossSectionType === 'meridional' ? t('explore.tab_meridional_short') : t('explore.tab_zonal_short');
      const fixed = params.crossSectionType === 'meridional'
        ? `lon${params.lon}°` : `lat${params.lat}°`;
      return `${dir} ${varLabel} ${fixed}`;
    }
    case 'hovmoller':
      return `${t('explore.tab_hovmoller_short')} ${varLabel} · ${altText}`;
    case 'zonalmean':
      return `${t('explore.tab_zonalmean_short')} ${varLabel} ${formatTime(params.time)}`;
    case 'windrose':
      return `${t('explore.tab_windrose_short')} (${params.lat}°, ${params.lon}°)`;
    case 'difference':
      return `Δ ${varLabel}`;
    case 'temporalprofile':
      return `T-Prof ${varLabel} (${params.lat}°, ${params.lon}°)`;
    case 'tides':
      return `${t('explore.tab_tides_short')} ${varLabel} · ${altText}`;
    case 'transect':
      return `${t('explore.tab_transect_short')} ${varLabel} ${formatTime(params.time)}`;
    default: return varLabel;
  }
}

/**
 * Libellé d'AFFICHAGE d'un résultat, recalculé à chaque rendu → réactif au
 * changement de langue. Le `label` figé dans le résultat était généré avec le
 * `t` de la création (genLabel au lancement, `explore.viz.*` au drill-down) :
 * basculer FR→NL laissait les titres des vues en français. On recalcule ici à
 * partir du type + params + la langue courante.
 *
 * @param {Object} r  résultat { type, params, data, derived?, label? }
 * @param {Function} t  fonction i18n (langue courante)
 */
export function resultLabel(r, t) {
  if (!r) return '';
  if (r.derived === 'amplitude') {
    const v = VARIABLES_MAP.has(r.params.variable) ? t(`variable.${r.params.variable}`) : r.params.variable;
    return `Δ24h ${v} alt${r.params.altitude}`;
  }
  if (r.derived === 'wsp') return `|V| ${formatTime(r.params.time)} alt${r.params.altitude}`;
  // Diff rapide client (Δ A − B) : libellé composé de deux sous-libellés, pas
  // recomposable ici — on garde le libellé figé (surtout des codes).
  if (r.type === 'difference' && !r.params?.datasetB) {
    return r.label ?? genLabel(r.type, r.params, t, r.data?.altitudeValue);
  }
  return genLabel(r.type, r.params, t, r.data?.altitudeValue);
}

/**
 * Valeur la plus proche de (lat, lon) dans une grille { data, latitudes, longitudes }.
 * Partagee entre la sonde liee (reticule des cellules) et le panneau lateral.
 */
export function nearestValue(gridData, lat, lon) {
  const { data, latitudes, longitudes } = gridData ?? {};
  if (!Array.isArray(data) || !Array.isArray(latitudes) || !Array.isArray(longitudes)) return null;
  let bi = 0, bd = Infinity;
  for (let i = 0; i < latitudes.length; i++) {
    const d = Math.abs(latitudes[i] - lat);
    if (d < bd) { bd = d; bi = i; }
  }
  let bj = 0; bd = Infinity;
  for (let j = 0; j < longitudes.length; j++) {
    const d = Math.abs(longitudes[j] - lon);
    if (d < bd) { bd = d; bj = j; }
  }
  const v = data[bi]?.[bj];
  return (v == null || Number.isNaN(v)) ? null : v;
}
