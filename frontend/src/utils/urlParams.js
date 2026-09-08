/**
 * Lecture sûre des paramètres numériques d'un permalien.
 *
 * Les query strings sont éditables à la main : un `?t=abc` produirait un NaN qui
 * se propagerait dans les sliders puis dans les requêtes. Ces helpers renvoient
 * null quand la valeur est absente ou pas un nombre fini, de sorte que la page
 * garde sa valeur par défaut au lieu d'afficher un état incohérent.
 */

/**
 * Entier depuis les query params, ou null si absent / invalide / hors bornes.
 *
 * Les bornes comptent autant que la finitude. `?alt=-1` produisait un entier
 * parfaitement fini que rien n'arretait, et qui servait ensuite d'INDICE :
 * `AltitudeSelector` teste `idx < altKm.length`, ce qui est vrai pour -1, puis
 * lit `altKm[-1]` — undefined — et appelle `.toFixed()` dessus. L'exception
 * etait levee pendant le rendu, donc l'ErrorBoundary remplacait la page
 * entiere. Un permalien qu'on retouche a la main suffisait.
 *
 * Une valeur hors bornes rejoint donc le meme sac que « absent » et
 * « illisible » : la page garde son defaut, ce qui est deja le contrat annonce
 * en tete de fichier.
 */
export function intParam(searchParams, key, bornes = null) {
  const raw = searchParams.get(key);
  if (raw == null) return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return null;
  if (bornes && (n < bornes.min || n > bornes.max)) return null;
  return n;
}

/**
 * Bornes du modele GEM-Mars, identiques a celles que `ValidationService`
 * applique cote serveur : 48 pas de temps (cycle diurne) et 103 niveaux
 * verticaux. Les repeter ici n'est pas une duplication de regle metier mais
 * une garde de saisie — le serveur reste seul juge, le client refuse seulement
 * de se mettre dans un etat incoherent avant de l'interroger.
 */
export const BORNES_TEMPS = { min: 0, max: 47 };
export const BORNES_ALTITUDE = { min: 0, max: 102 };

/** Pas de temps depuis un permalien, borne au cycle diurne. */
export function timeParam(searchParams, key = 't') {
  return intParam(searchParams, key, BORNES_TEMPS);
}

/** Niveau d'altitude depuis un permalien, borne aux niveaux du modele. */
export function altitudeParam(searchParams, key = 'alt') {
  return intParam(searchParams, key, BORNES_ALTITUDE);
}

/** Flottant depuis les query params, ou null si absent / invalide. */
export function floatParam(searchParams, key) {
  const raw = searchParams.get(key);
  if (raw == null) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}
