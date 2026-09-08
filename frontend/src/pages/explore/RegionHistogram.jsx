/**
 * Mini histogramme canvas de la distribution des valeurs d'une region.
 *
 * Complement visuel des statistiques du panneau lateral : n, sigma et
 * moyenne ne disent pas si la distribution est bimodale, ecrasee ou a
 * queue longue — la forme, si. Canvas nu (pas de Plotly) : le cout de
 * rendu est negligeable et le redessin suit chaque nouvelle selection.
 *
 * @param {number[]} values — valeurs brutes de la region (computeRegionStats)
 */
import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const BINS = 22;
const HEIGHT = 52;

export default function RegionHistogram({ values }) {
  const { t } = useTranslation();
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !values || values.length === 0) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 220;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(HEIGHT * dpr);
    const ctx = canvas.getContext('2d');
    // Meme raison que les autres couches : un contexte refuse ne doit pas
    // faire tomber le panneau lateral entier dans l'ErrorBoundary.
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, HEIGHT);

    let min = Infinity, max = -Infinity;
    for (const v of values) { if (v < min) min = v; if (v > max) max = v; }
    const span = max - min || 1;

    const counts = new Array(BINS).fill(0);
    for (const v of values) {
      const b = Math.min(BINS - 1, Math.floor(((v - min) / span) * BINS));
      counts[b]++;
    }
    const peak = Math.max(...counts) || 1;

    // Couleurs lisibles sur les deux themes : accent cyan + ligne de base
    // heritee de la couleur de texte courante (attenuee).
    const baseColor = getComputedStyle(canvas).color || 'rgb(152, 161, 179)';
    const gap = 1.5;
    const bw = (w - gap * (BINS - 1)) / BINS;

    for (let b = 0; b < BINS; b++) {
      const h = Math.max(counts[b] > 0 ? 2 : 0, (counts[b] / peak) * (HEIGHT - 4));
      ctx.fillStyle = 'rgba(56, 189, 248, 0.72)';
      ctx.beginPath();
      ctx.roundRect(b * (bw + gap), HEIGHT - 1 - h, bw, h, 1.5);
      ctx.fill();
    }
    ctx.fillStyle = baseColor;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, HEIGHT - 1, w, 1);
    ctx.globalAlpha = 1;
  }, [values]);

  if (!values || values.length === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={t('explore.roi.histogram')}
      style={{ width: '100%', height: HEIGHT, display: 'block', marginTop: 6, color: 'var(--mcv-muted)' }}
    />
  );
}
