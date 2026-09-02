/**
 * Champ de fleches (quiver) du vent, pour une trace scatter Plotly.
 *
 * Le piege : les fleches sont dessinees en coordonnees de DONNEES (degres),
 * alors que l'angle percu par l'oeil est celui des PIXELS. La zone de trace
 * de la carte fait par exemple 960x306 px pour 360x180 degres, donc un degre
 * de latitude occupe 1,55 fois plus de pixels qu'un degre de longitude. Une
 * fleche construite directement a partir de (u, v) en degres ecrase alors sa
 * composante nord-sud : un vent a 45 deg s'affiche a 33 deg, et jusqu'a 75 deg
 * sur un cadre etroit de telephone.
 *
 * On construit donc la fleche en PIXELS (ou son angle est celui du vent) puis
 * on reconvertit chaque composante en degres avec l'echelle de son propre axe.
 * L'angle affiche devient independant de la forme du cadre, du zoom et de la
 * taille de l'ecran. C'est le comportement de `arrowref: 'paper'` de Plotly 4,
 * et celui qu'applique deja WindParticlesLayer pour les particules animees.
 */

/** Demi-angle des barbes de la tete de fleche. */
const HEAD_ANGLE = Math.PI / 6;
/** Longueur de la tete, en fraction de la longueur de la fleche. */
const HEAD_RATIO = 0.35;
/**
 * Longueur de la fleche la plus rapide, en fraction du plus petit pas de
 * grille a l'ecran. En dessous de 1 les fleches voisines ne se touchent
 * jamais ; 0,8 retrouve la longueur qu'avaient les fleches sur un ecran de
 * bureau avant ce correctif.
 */
const MAX_LENGTH_RATIO = 0.8;
/** Vent en dessous duquel on ne dessine rien (m/s) : evite une foret de points. */
const MIN_SPEED = 0.5;

/** Plus petit ecart non nul entre valeurs successives, ou null si indeterminable. */
function gridStep(values) {
  const uniq = [...new Set(values)].sort((a, b) => a - b);
  if (uniq.length < 2) return null;
  let step = Infinity;
  for (let i = 1; i < uniq.length; i++) {
    const d = uniq[i] - uniq[i - 1];
    if (d > 0 && d < step) step = d;
  }
  return Number.isFinite(step) ? step : null;
}

/**
 * Zone de trace en pixels : le conteneur moins les marges du layout.
 *
 * Verifie identique a `_fullLayout._size` de Plotly a tous les points de
 * rupture (1440, 1280, 1024 et 390 px), y compris en mode compact ou les
 * marges different. Le calculer soi-meme evite de dependre de l'etat interne
 * de Plotly au tout premier rendu, ou celui-ci n'existe pas encore.
 *
 * @param {HTMLElement|null} el      div Plotly
 * @param {{l?: number, r?: number, t?: number, b?: number}|null} margin
 * @returns {{w: number, h: number}|null}
 */
export function plotAreaSize(el, margin) {
  if (!el || !margin) return null;
  const w = el.clientWidth - (margin.l || 0) - (margin.r || 0);
  const h = el.clientHeight - (margin.t || 0) - (margin.b || 0);
  return (w > 0 && h > 0) ? { w, h } : null;
}

/**
 * Echelles degres/pixel de la zone de trace.
 *
 * @param {{w: number, h: number}} size   dimensions de la zone de trace en pixels
 * @param {number[]} xRange  [lonMin, lonMax] actuellement affiches
 * @param {number[]} yRange  [latMin, latMax] actuellement affiches
 * @returns {{sx: number, sy: number}|null} degres par pixel sur chaque axe
 */
export function quiverScales(size, xRange, yRange) {
  if (!size || !(size.w > 0) || !(size.h > 0)) return null;
  if (!Array.isArray(xRange) || !Array.isArray(yRange)) return null;
  const spanX = Math.abs(xRange[1] - xRange[0]);
  const spanY = Math.abs(yRange[1] - yRange[0]);
  if (!(spanX > 0) || !(spanY > 0)) return null;
  return { sx: spanX / size.w, sy: spanY / size.h };
}

/**
 * Construit les segments (corps + tete) des fleches, separes par des `null`
 * comme l'attend une trace scatter en mode 'lines'.
 *
 * @param {{lats: number[], lons: number[], u: number[], v: number[]}} windData
 * @param {{sx: number, sy: number}} scales  degres par pixel, cf. quiverScales
 * @returns {{x: Array<number|null>, y: Array<number|null>}}
 */
export function buildQuiverSegments(windData, scales) {
  const empty = { x: [], y: [] };
  if (!windData || !scales) return empty;
  const { lats, lons, u, v } = windData;
  if (!Array.isArray(lats) || !Array.isArray(lons) || !Array.isArray(u) || !Array.isArray(v)) return empty;
  const n = Math.min(lats.length, lons.length, u.length, v.length);
  if (n === 0) return empty;

  const { sx, sy } = scales;
  if (!(sx > 0) || !(sy > 0)) return empty;

  let maxSpeed = 0;
  for (let i = 0; i < n; i++) {
    const s = Math.hypot(u[i], v[i]);
    if (s > maxSpeed) maxSpeed = s;
  }
  if (!(maxSpeed > 0)) return empty;

  // Pas de la grille en pixels : la fleche la plus rapide s'y rapporte, donc
  // la densite visuelle reste la meme quelle que soit la taille du cadre.
  const stepLon = gridStep(lons);
  const stepLat = gridStep(lats);
  const stepsPx = [
    stepLon != null ? stepLon / sx : null,
    stepLat != null ? stepLat / sy : null,
  ].filter(s => s != null && s > 0);
  if (stepsPx.length === 0) return empty;
  const maxLengthPx = MAX_LENGTH_RATIO * Math.min(...stepsPx);

  // Facteur commun : vitesse (m/s) -> longueur de fleche (pixels).
  const k = maxLengthPx / maxSpeed;

  const x = [], y = [];
  for (let i = 0; i < n; i++) {
    const speed = Math.hypot(u[i], v[i]);
    if (!(speed >= MIN_SPEED)) continue;

    // Composantes de la fleche en pixels : l'angle y est celui du vent.
    const pxDx = k * u[i];
    const pxDy = k * v[i];
    // Puis en degres, chaque axe avec sa propre echelle.
    const tx = lons[i] + pxDx * sx;
    const ty = lats[i] + pxDy * sy;

    x.push(lons[i], tx, null);
    y.push(lats[i], ty, null);

    // Tete : deux barbes, calculees elles aussi en pixels avant conversion.
    const angle = Math.atan2(pxDy, pxDx);
    const headPx = Math.hypot(pxDx, pxDy) * HEAD_RATIO;
    for (const side of [-HEAD_ANGLE, HEAD_ANGLE]) {
      const bx = -headPx * Math.cos(angle + side);
      const by = -headPx * Math.sin(angle + side);
      x.push(tx, tx + bx * sx, null);
      y.push(ty, ty + by * sy, null);
    }
  }
  return { x, y };
}
