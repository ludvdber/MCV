/**
 * Interpolation bilinéaire côté client des grilles lat/lon.
 *
 * La grille native GEM-Mars est en 4° (90 lon × 45 lat). Pour un rendu plus
 * fin, on peut sur-échantillonner à 2° ou 1° AVANT affichage. Les valeurs
 * créées sont de pures interpolations bilinéaires entre les 4 nœuds natifs
 * voisins : elles restent dans [min, max] des données réelles, mais ne sont
 * PAS des sorties du modèle. Chaque point créé est donc marqué (grille `text`
 * injectée dans le tooltip Plotly) et une légende sous le graphe rappelle la
 * résolution native.
 *
 * Les exports CSV/NetCDF ne passent jamais par ici : ils restent natifs.
 */

/** Pas d'affichage proposés (0 = natif, sinon pas cible en degrés). */
export const INTERP_STEPS = [0, 2, 1];

/** Pas natif d'un axe (en degrés), supposé régulier. */
export function nativeStep(axis) {
  if (!axis || axis.length < 2) return null;
  return Math.abs(axis[1] - axis[0]);
}

/** Sur-échantillonne un axe régulier d'un facteur entier (conserve les extrémités). */
function upsampleAxis(axis, factor) {
  const out = [];
  for (let i = 0; i < axis.length - 1; i++) {
    const a = axis[i], b = axis[i + 1];
    for (let k = 0; k < factor; k++) out.push(a + (k * (b - a)) / factor);
  }
  out.push(axis[axis.length - 1]);
  return out;
}

/**
 * Sur-échantillonne bilinéairement une grille { data, latitudes, longitudes }
 * vers un pas cible en degrés.
 *
 * @param {number[][]} data       - grille native [lat][lon] (peut contenir null)
 * @param {number[]}   latitudes  - axe latitude natif
 * @param {number[]}   longitudes - axe longitude natif
 * @param {number}     targetStepDeg - pas cible en degrés (0 = natif, inchangé)
 * @param {string}     interpLabel   - texte accolé au tooltip des points créés
 * @returns {{ data, latitudes, longitudes, text, isInterpolated }}
 *   text vaut null si rien n'a été interpolé, sinon une grille de même taille
 *   que data ('' sur les nœuds natifs, interpLabel sur les points créés).
 */
export function upsampleLatLonGrid(data, latitudes, longitudes, targetStepDeg, interpLabel = '') {
  const passthrough = { data, latitudes, longitudes, text: null, isInterpolated: false };
  if (!targetStepDeg || !Array.isArray(data) || data.length < 2) return passthrough;

  const latStep = nativeStep(latitudes);
  const lonStep = nativeStep(longitudes);
  if (!latStep || !lonStep) return passthrough;

  // Facteur entier par axe ; 1 = déjà à la résolution cible (ou plus fin).
  const fLat = Math.max(1, Math.round(latStep / targetStepDeg));
  const fLon = Math.max(1, Math.round(lonStep / targetStepDeg));
  if (fLat === 1 && fLon === 1) return passthrough;

  const nLat = latitudes.length;
  const nLon = longitudes.length;
  const outLats = upsampleAxis(latitudes, fLat);
  const outLons = upsampleAxis(longitudes, fLon);
  const outNLat = outLats.length;
  const outNLon = outLons.length;

  const outData = new Array(outNLat);
  const outText = new Array(outNLat);

  for (let r = 0; r < outNLat; r++) {
    // Cellule native de base + fraction verticale (dernière ligne : fr = 1).
    let i = Math.floor(r / fLat);
    let fr = (r % fLat) / fLat;
    if (i >= nLat - 1) { i = nLat - 2; fr = 1; }

    const rowOut = new Array(outNLon);
    const rowText = new Array(outNLon);
    const row0 = data[i];
    const row1 = data[i + 1];

    for (let c = 0; c < outNLon; c++) {
      let j = Math.floor(c / fLon);
      let fc = (c % fLon) / fLon;
      if (j >= nLon - 1) { j = nLon - 2; fc = 1; }

      const isNativeNode = (r % fLat === 0 || r === outNLat - 1) && (c % fLon === 0 || c === outNLon - 1);
      if (isNativeNode) {
        const ni = Math.min(nLat - 1, Math.round(r / fLat));
        const nj = Math.min(nLon - 1, Math.round(c / fLon));
        rowOut[c] = data[ni]?.[nj] ?? null;
        rowText[c] = '';
        continue;
      }

      const z00 = row0?.[j], z01 = row0?.[j + 1];
      const z10 = row1?.[j], z11 = row1?.[j + 1];
      // On ne fabrique rien au-dessus d'un trou : un coin manquant → null.
      if (z00 == null || z01 == null || z10 == null || z11 == null) {
        rowOut[c] = null;
        rowText[c] = '';
        continue;
      }
      const top = z00 + (z01 - z00) * fc;
      const bot = z10 + (z11 - z10) * fc;
      rowOut[c] = top + (bot - top) * fr;
      rowText[c] = interpLabel;
    }
    outData[r] = rowOut;
    outText[r] = rowText;
  }

  return { data: outData, latitudes: outLats, longitudes: outLons, text: outText, isInterpolated: true };
}
