/**
 * Couche de trace de transect (A → B) sur une carte lat/lon.
 *
 * Quand l'outil transect est actif, un canvas interactif recouvre le plot :
 * on y trace une ligne a la souris (glisser de A vers B), convertie en deux
 * points (lat, lon) via la geometrie Plotly (el._fullLayout), puis remontee
 * par onSelect({ lat1, lon1, lat2, lon2 }).
 *
 * Meme mecanique canvas que RoiLayer / la sonde liee : le box select natif
 * de Plotly n'est pas fiable sur les traces heatmap. La ligne dessinee est
 * la corde ecran ; le trajet effectivement calcule cote serveur suit le
 * grand cercle entre les deux extremites.
 *
 * @param {React.RefObject} hostRef — conteneur (position: relative) qui contient le div Plotly
 * @param {boolean} enabled
 * @param {(pts: {lat1,lon1,lat2,lon2}) => void} onSelect
 */
import { useEffect, useRef } from 'react';

const MIN_DRAG_PX = 12;
const LINE_COLOR = 'rgba(56, 189, 248, 0.95)';
const FILL_COLOR = 'rgba(56, 189, 248, 0.85)';

export default function TransectLayer({ hostRef, enabled, onSelect }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const host = hostRef?.current;
    const canvas = canvasRef.current;
    if (!enabled || !host || !canvas) return undefined;

    const ctx = canvas.getContext('2d');
    // `getContext('2d')` rend null quand le navigateur refuse un contexte de
    // plus (limite par onglet, contexte perdu non restaure). Sans cette
    // garde, le nettoyage de cet effet levait au demontage — pendant la
    // destruction de l'arbre React, donc hors de portee d'un ErrorBoundary.
    if (!ctx) return undefined;
    let plotEl = null;
    let disposed = false;
    let attachTimer = null;
    let dragStart = null;   // { x, y } px canvas
    let linePx = null;      // { x0, y0, x1, y1 } px canvas

    function geom() {
      const fl = plotEl?._fullLayout;
      if (!fl || !fl._size || !fl.xaxis || !fl.yaxis) return null;
      return { size: fl._size, xr: fl.xaxis.range, yr: fl.yaxis.range };
    }

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
      canvas.style.top = `${plotEl.offsetTop}px`;
      canvas.style.left = `${plotEl.offsetLeft}px`;
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const g = geom();
      if (!g || !linePx) return;
      const { size } = g;
      ctx.save();
      ctx.beginPath();
      ctx.rect(size.l, size.t, size.w, size.h);
      ctx.clip();
      ctx.strokeStyle = LINE_COLOR;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(linePx.x0, linePx.y0);
      ctx.lineTo(linePx.x1, linePx.y1);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = FILL_COLOR;
      for (const [x, y, label] of [[linePx.x0, linePx.y0, 'A'], [linePx.x1, linePx.y1, 'B']]) {
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '600 11px sans-serif';
        ctx.fillText(label, x + 7, y - 7);
      }
      ctx.restore();
    }

    function toCanvasXY(e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function pxToLatLon(x, y) {
      const g = geom();
      if (!g) return null;
      const { size, xr, yr } = g;
      return {
        lon: xr[0] + ((x - size.l) / (size.w || 1)) * (xr[1] - xr[0]),
        lat: yr[1] - ((y - size.t) / (size.h || 1)) * (yr[1] - yr[0]),
      };
    }

    const onPointerDown = (e) => {
      syncCanvasSize();
      dragStart = toCanvasXY(e);
      canvas.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
      if (!dragStart) return;
      const p = toCanvasXY(e);
      linePx = { x0: dragStart.x, y0: dragStart.y, x1: p.x, y1: p.y };
      draw();
    };
    const onPointerUp = (e) => {
      if (!dragStart) return;
      const p = toCanvasXY(e);
      const moved = Math.hypot(p.x - dragStart.x, p.y - dragStart.y) > MIN_DRAG_PX;
      if (moved) {
        const a = pxToLatLon(dragStart.x, dragStart.y);
        const b = pxToLatLon(p.x, p.y);
        if (a && b) {
          const clampLat = (v) => Math.max(-90, Math.min(90, v));
          const wrapLon = (v) => {
            let lon = ((v + 180) % 360 + 360) % 360 - 180;
            return lon;
          };
          onSelect?.({
            lat1: clampLat(a.lat), lon1: wrapLon(a.lon),
            lat2: clampLat(b.lat), lon2: wrapLon(b.lon),
          });
        }
      } else {
        linePx = null;
        draw();
      }
      dragStart = null;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);

    function attach() {
      if (disposed) return;
      const el = host.querySelector('.js-plotly-plot');
      if (!el || !el._fullLayout) {
        attachTimer = setTimeout(attach, 350);
        return;
      }
      plotEl = el;
      syncCanvasSize();
    }
    attach();

    return () => {
      disposed = true;
      clearTimeout(attachTimer);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [enabled, hostRef, onSelect]);

  if (!enabled) return null;
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', top: 0, left: 0, zIndex: 4,
        cursor: 'crosshair', touchAction: 'none',
      }}
    />
  );
}
