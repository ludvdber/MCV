/**
 * Statistiques de vitesse du champ de vent, et rampe de couleur associee.
 *
 * Le champ UU/VV servi par /api/data/wind donne deux composantes par point ;
 * la vitesse en est la norme. Ces statistiques servent a deux endroits :
 *   - la legende chiffree sous la carte (minimum, maximum, moyenne) ;
 *   - la coloration des particules animees, ou chaque trainee prend la teinte
 *     de la bande de vitesse dans laquelle elle se trouve.
 *
 * La rampe est SEQUENTIELLE et a teinte unique, par theme. Deux raisons :
 *   - une vitesse est une grandeur absolue positive, sans point neutre, donc
 *     pas de palette divergente (meme regle que autoColorscaleFor dans
 *     colorscales.js) ;
 *   - les particules se dessinent PAR-DESSUS une heatmap qui a deja sa propre
 *     palette. Une rampe arc-en-ciel entrerait en concurrence avec elle ;
 *     faire varier la seule clarte laisse les deux lectures possibles.
 *
 * L'echelle est LINEAIRE entre le minimum et le maximum du champ affiche, et
 * la legende annonce ces deux bornes. Aucun ecretage ni percentile : sur Mars
 * la distribution est tres asymetrique (la majorite de la carte est lente, les
 * jets sont rares), et c'est precisement ce contraste qu'on veut voir.
 */

/**
 * Delai d'anti-rebond avant d'aller chercher le champ de vent, en ms.
 *
 * Le champ depend de l'altitude : sans ce delai, un balayage du curseur emet
 * une requete par cran (26 mesurees sur un seul glissement). L'AbortController
 * annule bien les precedentes cote client, mais elles atteignent le serveur et
 * comptent dans la limite de debit par IP.
 */
export const WIND_FETCH_DEBOUNCE_MS = 250;

/** Nombre de bandes de vitesse : compromis entre finesse et cout de rendu. */
export const WIND_BANDS = 7;

/**
 * Theme sombre : trainees claires, alpha et clarte croissants avec la vitesse.
 * L'alpha est cuit dans la couleur, le rendu dessine une passe par bande.
 */
export const WIND_RAMP_DARK = [
  'rgba(96, 130, 165, 0.38)',
  'rgba(112, 152, 188, 0.46)',
  'rgba(133, 175, 208, 0.54)',
  'rgba(160, 200, 228, 0.63)',
  'rgba(191, 224, 245, 0.73)',
  'rgba(223, 241, 255, 0.83)',
  'rgba(255, 255, 255, 0.93)',
];

/** Theme clair : meme progression, inversee — le vent rapide est le plus sombre. */
export const WIND_RAMP_LIGHT = [
  'rgba(150, 172, 192, 0.40)',
  'rgba(124, 150, 176, 0.48)',
  'rgba(97, 128, 158, 0.57)',
  'rgba(70, 105, 140, 0.66)',
  'rgba(45, 82, 118, 0.76)',
  'rgba(24, 60, 95, 0.86)',
  'rgba(6, 36, 68, 0.95)',
];

/** Epaisseur de trait par bande : la vitesse se lit aussi sans percevoir la couleur. */
export const WIND_WIDTHS = [0.7, 0.85, 1, 1.15, 1.35, 1.6, 1.9];

/** @param {'light'|'dark'} mode */
export function windRamp(mode) {
  return mode === 'light' ? WIND_RAMP_LIGHT : WIND_RAMP_DARK;
}

/**
 * Minimum, maximum et moyenne de la vitesse du vent.
 *
 * Les points sans donnee (trous de grille, NaN) sont ignores plutot que
 * comptes comme des vitesses nulles, sans quoi la moyenne serait tiree vers
 * le bas par des mailles qui n'existent pas.
 *
 * @param {{u: number[], v: number[]}|null} windData champ servi par /api/data/wind
 * @returns {{min: number, max: number, mean: number, count: number}|null}
 *          null si le champ est absent, mal forme ou entierement vide
 */
export function windSpeedStats(windData) {
  const u = windData?.u;
  const v = windData?.v;
  if (!Array.isArray(u) && !ArrayBuffer.isView(u)) return null;
  if (!Array.isArray(v) && !ArrayBuffer.isView(v)) return null;
  if (u.length === 0 || u.length !== v.length) return null;

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < u.length; i++) {
    const a = u[i];
    const b = v[i];
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const speed = Math.hypot(a, b);
    if (speed < min) min = speed;
    if (speed > max) max = speed;
    sum += speed;
    count++;
  }
  if (count === 0) return null;
  return { min, max, mean: sum / count, count };
}

/**
 * Bande de vitesse d'une particule, entre 0 et WIND_BANDS - 1.
 *
 * Un champ de vitesse constante (span nul) tombe dans la bande la plus haute :
 * l'unique vitesse presente EST le maximum, l'afficher en trait le plus faible
 * serait trompeur.
 *
 * @param {number} speed
 * @param {number} min borne basse de l'echelle
 * @param {number} max borne haute de l'echelle
 */
export function windBand(speed, min, max) {
  if (!Number.isFinite(speed)) return 0;
  const span = max - min;
  if (!(span > 0)) return WIND_BANDS - 1;
  const i = Math.floor(((speed - min) / span) * WIND_BANDS);
  if (i < 0) return 0;
  return i >= WIND_BANDS ? WIND_BANDS - 1 : i;
}
