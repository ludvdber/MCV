/**
 * Bus de la sonde liee : un mini pub/sub hors React.
 *
 * Le survol d'une vue publie un point DIMENSIONNEL { lat?, lon?, time?, alt?,
 * sourceId } — les deux axes survoles plus les coordonnees fixes de la vue
 * source (voir probeSamplers.js). Chaque ProbeLayer abonne dessine le reticule
 * sur les dimensions qu'il partage avec le point. Passer par un bus (plutot
 * que par le state React) evite un re-render de toute la console a chaque
 * mouvement de souris : seuls les canvas se redessinent.
 */

const subscribers = new Set();

/** Derniere position publiee (ou null). Permet aux nouveaux abonnes de se caler. */
export let currentProbe = null;

/** @param {{lat?: number, lon?: number, time?: number, alt?: number, sourceId: string} | null} probe */
export function publishProbe(probe) {
  currentProbe = probe;
  for (const fn of subscribers) fn(probe);
}

/** @param {(probe: object|null) => void} fn @returns {() => void} desabonnement */
export function subscribeProbe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/* ── Frame courante des animations ──────────────────────────────────────────
 * Les frames vivent hors du state React (largeDataStore) et l'index affiche
 * n'existait que dans l'etat local d'AnimationPlayer : la sonde ne pouvait pas
 * savoir QUELLE frame est a l'ecran. Le lecteur publie ici son index ; a
 * chaque changement on republie la derniere position pour que reticules et
 * panneau lateral suivent la lecture en cours. */
const animationFrames = new Map();

export function setAnimationFrame(resultId, frameIdx) {
  if (animationFrames.get(resultId) === frameIdx) return;
  animationFrames.set(resultId, frameIdx);
  if (currentProbe) publishProbe(currentProbe);
}

/** Index de la frame affichee (0 par defaut : la frame initiale du lecteur). */
export function getAnimationFrame(resultId) {
  return animationFrames.get(resultId) ?? 0;
}

export function clearAnimationFrame(resultId) {
  animationFrames.delete(resultId);
}
