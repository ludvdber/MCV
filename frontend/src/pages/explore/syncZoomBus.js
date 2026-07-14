/**
 * Bus du zoom synchronise : meme mini pub/sub hors React que la sonde liee.
 *
 * Quand l'outil est actif, zoomer/recadrer une carte publie sa fenetre
 * { xr, yr, sourceId } ; chaque carte lat/lon abonnee applique la meme
 * fenetre via Plotly.relayout. L'anti-boucle (ignorer le relayout declenche
 * par cette application) est un verrou PROPRE a chaque carte, cote useSyncZoom :
 * un verrou partage etait remis a false par la premiere carte a finir, laissant
 * les recadrages encore en vol des autres cartes republier → boucle d'echo.
 */

const subscribers = new Set();

/** @param {{xr: number[]|null, yr: number[]|null, autorange: boolean, sourceId: string}} range */
export function publishRange(range) {
  for (const fn of subscribers) fn(range);
}

/** @param {(range: object) => void} fn @returns {() => void} desabonnement */
export function subscribeRange(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
