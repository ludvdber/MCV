/**
 * Lecture sûre des paramètres numériques d'un permalien.
 *
 * Les query strings sont éditables à la main : un `?t=abc` produirait un NaN qui
 * se propagerait dans les sliders puis dans les requêtes. Ces helpers renvoient
 * null quand la valeur est absente ou pas un nombre fini, de sorte que la page
 * garde sa valeur par défaut au lieu d'afficher un état incohérent.
 */

/** Entier depuis les query params, ou null si absent / invalide. */
export function intParam(searchParams, key) {
  const raw = searchParams.get(key);
  if (raw == null) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

/** Flottant depuis les query params, ou null si absent / invalide. */
export function floatParam(searchParams, key) {
  const raw = searchParams.get(key);
  if (raw == null) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}
