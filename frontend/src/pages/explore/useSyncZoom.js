/**
 * Zoom synchronise entre cartes lat/lon de la grille.
 *
 * Quand l'outil est actif, un zoom/recadrage sur une carte publie sa fenetre
 * (xaxis/yaxis range) sur le bus ; les autres cartes abonnees appliquent la
 * meme fenetre via Plotly.relayout. Le verrou du bus empeche la boucle
 * infinie (le relayout applique redeclenche plotly_relayout).
 *
 * S'accroche au div Plotly du conteneur comme RoiLayer (retry tant que le
 * plot n'est pas rendu), et se detache proprement au demontage.
 *
 * @param {React.RefObject} hostRef  — conteneur du div Plotly
 * @param {boolean}         enabled
 * @param {string}          resultId — identite de la carte sur le bus
 */
import { useEffect } from 'react';
import Plotly from '../../plotlyBundle';
import { publishRange, subscribeRange } from './syncZoomBus.js';

export function useSyncZoom(hostRef, enabled, resultId) {
  useEffect(() => {
    const host = hostRef?.current;
    if (!enabled || !host) return undefined;

    let plotEl = null;
    let disposed = false;
    let attachTimer = null;
    let unsubscribe = null;
    // Verrou PROPRE a cette carte : vrai pendant qu'elle applique un recadrage
    // recu du bus, pour ignorer le plotly_relayout que cette application declenche.
    // Un verrou partage global etait remis a false par la premiere carte a finir,
    // laissant les recadrages encore en vol des AUTRES cartes republier → boucle.
    let applyingSelf = false;

    /* Plotly emet deux formes selon l'origine du recadrage :
       zoom utilisateur → 'xaxis.range[0]' / 'xaxis.range[1]' ;
       relayout programmatique → 'xaxis.range': [a, b]. On accepte les deux. */
    const rangeOf = (e, axis) => {
      if (Array.isArray(e[`${axis}.range`])) return [...e[`${axis}.range`]];
      const r0 = e[`${axis}.range[0]`];
      if (r0 != null) return [r0, e[`${axis}.range[1]`]];
      return null;
    };

    const onRelayout = (e) => {
      if (applyingSelf || !e) return;
      if (e['xaxis.autorange'] || e['yaxis.autorange']) {
        publishRange({ xr: null, yr: null, autorange: true, sourceId: resultId });
        return;
      }
      const xr = rangeOf(e, 'xaxis');
      const yr = rangeOf(e, 'yaxis');
      if (!xr && !yr) return;
      const fl = plotEl?._fullLayout;
      publishRange({
        xr: xr ?? [...(fl?.xaxis?.range ?? [])],
        yr: yr ?? [...(fl?.yaxis?.range ?? [])],
        autorange: false,
        sourceId: resultId,
      });
    };

    const onBusRange = async ({ xr, yr, autorange, sourceId }) => {
      if (sourceId === resultId || !plotEl || !plotEl._fullLayout) return;
      applyingSelf = true;
      try {
        await Plotly.relayout(plotEl, autorange
          ? { 'xaxis.autorange': true, 'yaxis.autorange': true }
          : { 'xaxis.range': [...xr], 'yaxis.range': [...yr] });
      } catch { /* plot demonte pendant l'application : sans consequence */ }
      applyingSelf = false;
    };

    function attach() {
      if (disposed) return;
      const el = host.querySelector('.js-plotly-plot');
      if (!el || !el._fullLayout || typeof el.on !== 'function') {
        attachTimer = setTimeout(attach, 350);
        return;
      }
      plotEl = el;
      plotEl.on('plotly_relayout', onRelayout);
      unsubscribe = subscribeRange(onBusRange);
    }
    attach();

    return () => {
      disposed = true;
      clearTimeout(attachTimer);
      unsubscribe?.();
      plotEl?.removeAllListeners?.('plotly_relayout');
    };
  }, [hostRef, enabled, resultId]);
}
