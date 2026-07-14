/**
 * Couche de particules de vent animees au-dessus d'une heatmap Plotly.
 *
 * Le principe de Windy / earth.nullschool applique a GEM-Mars : des centaines
 * de particules sont advectees le long du champ UU/VV (deja servi par
 * /api/data/wind) et leurs trainees dessinent jets, cellules et tourbillons.
 * AUCUNE donnee inventee : les particules sont un rendu du champ mesure,
 * echantillonne par interpolation bilineaire.
 *
 * Implementation : un <canvas> en position absolue au-dessus du div Plotly
 * (pointer-events: none, le survol traverse). La conversion (lon, lat) → pixel
 * relit a chaque frame la taille et les ranges des axes dans el._fullLayout,
 * si bien que zoom et pan Plotly sont suivis automatiquement.
 *
 * prefers-reduced-motion : trace des lignes de courant statiques a la place
 * de l'animation.
 *
 * @param {React.RefObject} plotRef  — ref du div Plotly (externalPlotRef du viewer)
 * @param {Object|null}     windData — WindResponse { lats[], lons[], u[], v[] } (points aplatis)
 * @param {boolean}         enabled
 */
import { useEffect, useRef } from 'react';
import { useThemeMode } from '../context/ThemeContext';

const N_PARTICLES = 700;
/** deg / (m/s) / frame — vitesse visuelle de l'advection */
const ADVECT_K = 0.011;
const MAX_AGE = 110;

/** Reconstruit une grille reguliere { lats[], lons[], u[][], v[][] } depuis les points aplatis. */
function gridify(windData) {
  const { lats, lons, u, v } = windData;
  const uLats = [...new Set(lats)].sort((a, b) => a - b);
  const uLons = [...new Set(lons)].sort((a, b) => a - b);
  const li = new Map(uLats.map((x, i) => [x, i]));
  const lj = new Map(uLons.map((x, j) => [x, j]));
  const gu = Array.from({ length: uLats.length }, () => new Float32Array(uLons.length).fill(NaN));
  const gv = Array.from({ length: uLats.length }, () => new Float32Array(uLons.length).fill(NaN));
  for (let k = 0; k < lats.length; k++) {
    const i = li.get(lats[k]), j = lj.get(lons[k]);
    if (i != null && j != null) { gu[i][j] = u[k]; gv[i][j] = v[k]; }
  }
  return { lats: uLats, lons: uLons, u: gu, v: gv };
}

/** Interpolation bilineaire du vent en (lon, lat). Retourne null hors grille / trou. */
function sampleWind(grid, lon, lat) {
  const { lats, lons, u, v } = grid;
  if (lat < lats[0] || lat > lats[lats.length - 1]) return null;
  if (lon < lons[0] || lon > lons[lons.length - 1]) return null;
  let i = 0; while (i < lats.length - 2 && lats[i + 1] < lat) i++;
  let j = 0; while (j < lons.length - 2 && lons[j + 1] < lon) j++;
  const fy = (lat - lats[i]) / ((lats[i + 1] - lats[i]) || 1);
  const fx = (lon - lons[j]) / ((lons[j + 1] - lons[j]) || 1);
  const u00 = u[i][j], u01 = u[i][j + 1], u10 = u[i + 1][j], u11 = u[i + 1][j + 1];
  const v00 = v[i][j], v01 = v[i][j + 1], v10 = v[i + 1][j], v11 = v[i + 1][j + 1];
  if ([u00, u01, u10, u11, v00, v01, v10, v11].some(x => Number.isNaN(x))) return null;
  return [
    (u00 * (1 - fx) + u01 * fx) * (1 - fy) + (u10 * (1 - fx) + u11 * fx) * fy,
    (v00 * (1 - fx) + v01 * fx) * (1 - fy) + (v10 * (1 - fx) + v11 * fx) * fy,
  ];
}

export default function WindParticlesLayer({ plotRef, windData, enabled = false }) {
  const canvasRef = useRef(null);
  const { mode } = useThemeMode();

  useEffect(() => {
    const canvas = canvasRef.current;
    const plotEl = plotRef?.current;
    if (!enabled || !canvas || !plotEl || !windData?.lats?.length) return undefined;

    const grid = gridify(windData);
    const ctx = canvas.getContext('2d');
    const strokeColor = mode === 'light' ? 'rgba(30, 41, 59, 0.55)' : 'rgba(220, 240, 255, 0.55)';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Particules : [lon, lat, prevLon, prevLat, age] × N */
    const P = new Float32Array(N_PARTICLES * 5);
    const lonMin = grid.lons[0], lonMax = grid.lons[grid.lons.length - 1];
    const latMin = grid.lats[0], latMax = grid.lats[grid.lats.length - 1];
    function respawn(k) {
      P[k] = lonMin + Math.random() * (lonMax - lonMin);
      P[k + 1] = latMin + Math.random() * (latMax - latMin);
      P[k + 2] = P[k]; P[k + 3] = P[k + 1];
      P[k + 4] = 15 + Math.random() * MAX_AGE;
    }
    for (let i = 0; i < N_PARTICLES; i++) respawn(i * 5);

    /** Geometrie courante du plot : zone de trace + ranges des axes. */
    function plotGeometry() {
      const fl = plotEl._fullLayout;
      if (!fl || !fl._size || !fl.xaxis || !fl.yaxis) return null;
      return { size: fl._size, xr: fl.xaxis.range, yr: fl.yaxis.range };
    }

    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = plotEl.clientWidth, h = plotEl.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
    const ro = new ResizeObserver(resize);
    ro.observe(plotEl);
    resize();

    let raf = 0;
    let stopped = false;
    let staticTimer = null;

    function frame() {
      if (stopped) return;
      const g = plotGeometry();
      if (!g) { raf = requestAnimationFrame(frame); return; }
      const { size, xr, yr } = g;
      const toX = (lon) => size.l + ((lon - xr[0]) / ((xr[1] - xr[0]) || 1)) * size.w;
      const toY = (lat) => size.t + ((yr[1] - lat) / ((yr[1] - yr[0]) || 1)) * size.h;

      /* Fondu des trainees puis nouveaux segments, le tout borne a la zone de trace. */
      ctx.save();
      ctx.beginPath();
      ctx.rect(size.l, size.t, size.w, size.h);
      ctx.clip();
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.93)';
      ctx.fillRect(size.l, size.t, size.w, size.h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let k = 0; k < N_PARTICLES * 5; k += 5) {
        const w = sampleWind(grid, P[k], P[k + 1]);
        P[k + 2] = P[k]; P[k + 3] = P[k + 1];
        if (!w) { respawn(k); continue; }
        P[k] += w[0] * ADVECT_K;
        P[k + 1] += w[1] * ADVECT_K;
        P[k + 4] -= 1;
        if (P[k + 4] <= 0 || P[k] < lonMin || P[k] > lonMax || P[k + 1] < latMin || P[k + 1] > latMax) {
          respawn(k); continue;
        }
        ctx.moveTo(toX(P[k + 2]), toY(P[k + 3]));
        ctx.lineTo(toX(P[k]), toY(P[k + 1]));
      }
      ctx.stroke();
      ctx.restore();
      raf = requestAnimationFrame(frame);
    }

    /** Variante statique (prefers-reduced-motion) : lignes de courant figees. */
    function drawStaticStreamlines() {
      if (stopped) return;
      const g = plotGeometry();
      if (!g) { staticTimer = setTimeout(drawStaticStreamlines, 300); return; }
      const { size, xr, yr } = g;
      const toX = (lon) => size.l + ((lon - xr[0]) / ((xr[1] - xr[0]) || 1)) * size.w;
      const toY = (lat) => size.t + ((yr[1] - lat) / ((yr[1] - yr[0]) || 1)) * size.h;
      ctx.save();
      ctx.beginPath();
      ctx.rect(size.l, size.t, size.w, size.h);
      ctx.clip();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let n = 0; n < 320; n++) {
        let lon = lonMin + Math.random() * (lonMax - lonMin);
        let lat = latMin + Math.random() * (latMax - latMin);
        ctx.moveTo(toX(lon), toY(lat));
        for (let s = 0; s < 8; s++) {
          const w = sampleWind(grid, lon, lat);
          if (!w) break;
          lon += w[0] * ADVECT_K * 3;
          lat += w[1] * ADVECT_K * 3;
          ctx.lineTo(toX(lon), toY(lat));
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    if (reducedMotion) drawStaticStreamlines();
    else raf = requestAnimationFrame(frame);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clearTimeout(staticTimer);
      ro.disconnect();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [enabled, windData, plotRef, mode]);

  if (!enabled) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}
    />
  );
}
