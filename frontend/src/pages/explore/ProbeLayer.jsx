/**
 * Sonde liee : reticule synchronise entre les vues de la console.
 *
 * Survoler une vue publie un point DIMENSIONNEL (lat/lon/heure/altitude, voir
 * probeSamplers.js) sur le probeBus ; chaque ProbeLayer des AUTRES vues dessine
 * le reticule sur les dimensions qu'il partage avec le point : croix + valeur
 * locale quand ses deux axes sont resolus, ligne simple quand un seul l'est
 * (ex : un survol de hovmoller ne donne qu'une latitude a une slice). Un seul
 * geste interroge ainsi cartes, coupes, moyennes zonales et profils temporels.
 *
 * Implementation : un canvas en position absolue au-dessus du div Plotly de
 * la cellule (pointer-events: none). La conversion dimension → pixel relit
 * el._fullLayout (taille + ranges), donc zoom et pan sont suivis.
 *
 * @param {string} resultId       — id du resultat de la cellule
 * @param {Object} result         — le resultat (type, data, params)
 * @param {React.RefObject} hostRef — ref du conteneur de la cellule (position: relative)
 */
import { useEffect, useRef } from 'react';
import { VARIABLES_MAP } from '../../components/VariableSelector';
import { subscribeProbe, publishProbe, currentProbe } from './probeBus.js';
import { probeAxes, fixedProbeDims, sampleProbe } from './probeSamplers.js';

export default function ProbeLayer({ resultId, result, hostRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const host = hostRef?.current;
    const canvas = canvasRef.current;
    const axes = probeAxes(result);
    if (!host || !canvas || !axes) return undefined;

    const ctx = canvas.getContext('2d');
    let plotEl = null;
    let disposed = false;
    let attachTimer = null;

    const unit = VARIABLES_MAP.get(result?.params?.variable)?.unit || '';
    const varCode = result?.params?.variable || '';

    function syncCanvasSize() {
      if (!plotEl) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = plotEl.clientWidth, h = plotEl.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      // Aligne le canvas sur le div Plotly a l'interieur de la cellule
      canvas.style.top = `${plotEl.offsetTop}px`;
      canvas.style.left = `${plotEl.offsetLeft}px`;
    }

    function clear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    /** Valeur du point sur la dimension d'un axe, repliee dans la plage de CET
     *  axe pour les longitudes (conventions 0-360 vs -180/180), ou null si la
     *  dimension manque ou tombe hors du champ. */
    function axisValue(probe, dim, range) {
      let v = probe[dim];
      if (v == null) return null;
      const min = Math.min(range[0], range[1]);
      const max = Math.max(range[0], range[1]);
      if (dim === 'lon') {
        if (v < min && v + 360 >= min && v + 360 <= max) v += 360;
        else if (v > max && v - 360 <= max && v - 360 >= min) v -= 360;
      }
      return (v < min || v > max) ? null : v;
    }

    function draw(probe) {
      if (!plotEl) return;
      clear();
      if (!probe || probe.sourceId === resultId) return; // Plotly gere le survol local
      const fl = plotEl._fullLayout;
      if (!fl || !fl._size || !fl.xaxis || !fl.yaxis) return;
      const { _size: size, xaxis, yaxis } = fl;
      const [x0, x1] = xaxis.range, [y0, y1] = yaxis.range;

      const xv = axisValue(probe, axes.x, xaxis.range);
      const yv = axisValue(probe, axes.y, yaxis.range);
      if (xv == null && yv == null) return;

      const px = xv != null ? size.l + ((xv - x0) / ((x1 - x0) || 1)) * size.w : null;
      const py = yv != null ? size.t + ((y1 - yv) / ((y1 - y0) || 1)) * size.h : null;

      syncCanvasSize();
      ctx.save();
      ctx.beginPath();
      ctx.rect(size.l, size.t, size.w, size.h);
      ctx.clip();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      if (px != null) { ctx.moveTo(px, size.t); ctx.lineTo(px, size.t + size.h); }
      if (py != null) { ctx.moveTo(size.l, py); ctx.lineTo(size.l + size.w, py); }
      ctx.stroke();
      ctx.setLineDash([]);

      // Croix complete : cercle + valeur locale de cette vue au point sonde.
      if (px == null || py == null) { ctx.restore(); return; }
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      const v = sampleProbe(result, probe);
      if (v != null) {
        const label = `${varCode} ${Math.abs(v) >= 100 ? v.toFixed(1) : v.toPrecision(4)} ${unit}`;
        ctx.font = '600 12px Rajdhani, sans-serif';
        const tw = ctx.measureText(label).width;
        const lx = Math.min(px + 10, size.l + size.w - tw - 12);
        const ly = Math.max(py - 12, size.t + 16);
        ctx.fillStyle = 'rgba(6, 10, 20, 0.85)';
        ctx.fillRect(lx - 5, ly - 12, tw + 10, 18);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(lx - 5, ly - 12, tw + 10, 18);
        ctx.fillStyle = '#d9ecff';
        ctx.fillText(label, lx, ly + 2);
      }
      ctx.restore();
    }

    const onHover = (ev) => {
      const pt = ev?.points?.[0];
      if (pt == null || typeof pt.x !== 'number' || typeof pt.y !== 'number') return;
      // Coordonnees fixes calculees AU survol : la frame courante d'une
      // animation change pendant la lecture.
      publishProbe({
        ...fixedProbeDims(result),
        [axes.x]: pt.x,
        [axes.y]: pt.y,
        sourceId: resultId,
      });
    };
    const onUnhover = () => publishProbe(null);

    /** Le div Plotly apparait apres le premier rendu du viewer : on re-essaie. */
    function attach() {
      if (disposed) return;
      const el = host.querySelector('.js-plotly-plot');
      if (!el || typeof el.on !== 'function' || !el._fullLayout) {
        attachTimer = setTimeout(attach, 350);
        return;
      }
      plotEl = el;
      syncCanvasSize();
      el.on('plotly_hover', onHover);
      el.on('plotly_unhover', onUnhover);
      draw(currentProbe);
    }
    attach();

    const unsubscribe = subscribeProbe(draw);

    return () => {
      disposed = true;
      clearTimeout(attachTimer);
      unsubscribe();
      if (plotEl?.removeAllListeners) {
        plotEl.removeListener?.('plotly_hover', onHover);
        plotEl.removeListener?.('plotly_unhover', onUnhover);
      }
      clear();
    };
  }, [resultId, result, hostRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 3 }}
    />
  );
}
