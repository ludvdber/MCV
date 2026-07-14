/**
 * Couche de selection de region (ROI) sur une carte lat/lon.
 *
 * Quand le mode region est actif, un canvas interactif recouvre le plot :
 * on y trace un rectangle a la souris, converti en bornes (lat, lon) via
 * la geometrie Plotly (el._fullLayout), puis remonte par onSelect(bounds).
 * Le rectangle reste affiche jusqu'au prochain trace ou double-clic.
 *
 * Choix volontaire d'un canvas maison plutot que le dragmode 'select' de
 * Plotly : le box select natif n'est pas fiable sur les traces heatmap, et
 * cette couche partage la meme mecanique que la sonde liee et les particules.
 *
 * @param {React.RefObject} hostRef — conteneur (position: relative) qui contient le div Plotly
 * @param {boolean} enabled
 * @param {(bounds: {latMin,latMax,lonMin,lonMax}) => void} onSelect
 * @param {() => void} onClear — double-clic : efface la region
 */
import { useEffect, useRef } from 'react';

const MIN_DRAG_PX = 8;

export default function RoiLayer({ hostRef, enabled, onSelect, onClear }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const host = hostRef?.current;
    const canvas = canvasRef.current;
    if (!enabled || !host || !canvas) return undefined;

    const ctx = canvas.getContext('2d');
    let plotEl = null;
    let disposed = false;
    let attachTimer = null;
    let dragStart = null;   // { x, y } px canvas
    let rectPx = null;      // { x0, y0, x1, y1 } px canvas

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
      if (!g || !rectPx) return;
      const { size } = g;
      ctx.save();
      ctx.beginPath();
      ctx.rect(size.l, size.t, size.w, size.h);
      ctx.clip();
      const x = Math.min(rectPx.x0, rectPx.x1), y = Math.min(rectPx.y0, rectPx.y1);
      const w = Math.abs(rectPx.x1 - rectPx.x0), h = Math.abs(rectPx.y1 - rectPx.y0);
      ctx.fillStyle = 'rgba(217, 160, 102, 0.10)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(217, 160, 102, 0.95)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, w, h);
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
      rectPx = { x0: dragStart.x, y0: dragStart.y, x1: p.x, y1: p.y };
      draw();
    };
    const onPointerUp = (e) => {
      if (!dragStart) return;
      const p = toCanvasXY(e);
      const moved = Math.abs(p.x - dragStart.x) > MIN_DRAG_PX && Math.abs(p.y - dragStart.y) > MIN_DRAG_PX;
      if (moved) {
        const a = pxToLatLon(dragStart.x, dragStart.y);
        const b = pxToLatLon(p.x, p.y);
        if (a && b) {
          onSelect?.({
            latMin: Math.min(a.lat, b.lat), latMax: Math.max(a.lat, b.lat),
            lonMin: Math.min(a.lon, b.lon), lonMax: Math.max(a.lon, b.lon),
          });
        }
      } else {
        rectPx = null;
        draw();
      }
      dragStart = null;
    };
    const onDblClick = () => {
      rectPx = null;
      draw();
      onClear?.();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('dblclick', onDblClick);

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
      canvas.removeEventListener('dblclick', onDblClick);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [enabled, hostRef, onSelect, onClear]);

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
