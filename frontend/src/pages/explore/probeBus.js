/**
 * Bus de la sonde liee : un mini pub/sub hors React.
 *
 * Le survol d'une carte publie { lat, lon, sourceId } ; chaque ProbeLayer
 * abonne dessine le reticule correspondant sur SA carte. Passer par un bus
 * (plutot que par le state React) evite un re-render de toute la console
 * a chaque mouvement de souris : seuls les canvas se redessinent.
 */

const subscribers = new Set();

/** Derniere position publiee (ou null). Permet aux nouveaux abonnes de se caler. */
export let currentProbe = null;

/** @param {{lat: number, lon: number, sourceId: string} | null} probe */
export function publishProbe(probe) {
  currentProbe = probe;
  for (const fn of subscribers) fn(probe);
}

/** @param {(probe: object|null) => void} fn @returns {() => void} desabonnement */
export function subscribeProbe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
