/**
 * Textures planetaires procedurales (canvas 2D) pour le systeme solaire 3D.
 *
 * Pourquoi procedural et non des JPG NASA ? La CSP stricte du backend interdit
 * tout asset distant, et embarquer des textures 8K alourdirait le bundle. Un
 * canvas genere localement reste leger, deterministe (rendu identique entre
 * deux montages) et 100 % hors-ligne. Si un jour on veut du photo-realisme, il
 * suffira de deposer des .jpg dans public/textures/ et de charger via useTexture.
 *
 * Tout est defensif : sous jsdom (tests) getContext('2d') peut renvoyer null —
 * on retourne alors null et le materiau retombe sur sa couleur unie.
 */
import * as THREE from 'three';

/* PRNG deterministe (mulberry32) : la generation doit etre pure/reproductible. */
function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Eclaircit (amt > 0) ou assombrit (amt < 0) une couleur hex. amt ∈ [-1, 1]. */
function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c) => {
    const v = amt >= 0 ? c + (255 - c) * amt : c * (1 + amt);
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function newCanvas(w, h) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

function finalize(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Texture generique d'une planete.
 * @param {object} o
 * @param {string} o.base   couleur de base hex
 * @param {string} o.type   'gas' | 'ice' | 'rocky'
 * @param {number} o.seed   graine deterministe
 */
export function makePlanetTexture({ base, type, seed = 1 }) {
  const made = newCanvas(512, 256);
  if (!made) return null;
  const { canvas, ctx } = made;
  const rand = mulberry32(seed);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 256);

  if (type === 'gas' || type === 'ice') {
    // Bandes horizontales (jets zonaux) : c'est la signature visuelle immediate
    // des geantes. Contraste plus doux pour les geantes de glace.
    const spread = type === 'ice' ? 0.14 : 0.3;
    let y = 0;
    while (y < 256) {
      const bh = 5 + rand() * 20;
      ctx.fillStyle = shade(base, (rand() - 0.5) * spread);
      ctx.fillRect(0, y, 512, bh + 1);
      y += bh;
    }
    // Turbulence : stries fines qui cassent la regularite des bandes
    for (let i = 0; i < 260; i++) {
      ctx.globalAlpha = 0.2 + rand() * 0.2;
      ctx.fillStyle = shade(base, (rand() - 0.5) * spread * 0.8);
      ctx.fillRect(rand() * 512, rand() * 256, 20 + rand() * 90, 1 + rand() * 2);
    }
    ctx.globalAlpha = 1;
  } else {
    // Rocheux : mottling doux (crateres, mers, contrastes d'albedo)
    for (let i = 0; i < 520; i++) {
      ctx.globalAlpha = 0.08 + rand() * 0.16;
      ctx.fillStyle = shade(base, (rand() - 0.5) * 0.5);
      const r = 3 + rand() * 24;
      ctx.beginPath();
      ctx.arc(rand() * 512, rand() * 256, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return finalize(canvas);
}

/** Terre : oceans, continents verts/bruns et calottes polaires blanches. */
export function makeEarthTexture(seed = 7) {
  const made = newCanvas(512, 256);
  if (!made) return null;
  const { canvas, ctx } = made;
  const rand = mulberry32(seed);

  ctx.fillStyle = '#123f7a';
  ctx.fillRect(0, 0, 512, 256);
  // Continents
  const land = ['#2f7d3b', '#3d6b2e', '#7a6a3c', '#4e8a44'];
  for (let i = 0; i < 34; i++) {
    ctx.globalAlpha = 0.55 + rand() * 0.35;
    ctx.fillStyle = land[(rand() * land.length) | 0];
    const cx = rand() * 512;
    const cy = 40 + rand() * 176; // eviter les poles
    const rx = 14 + rand() * 48;
    const ry = 10 + rand() * 30;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // Calottes polaires
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#eef4ff';
  ctx.fillRect(0, 0, 512, 16);
  ctx.fillRect(0, 240, 512, 16);
  ctx.globalAlpha = 1;

  return finalize(canvas);
}

/** Soleil : granulation chaude et taches sombres, base emissive. */
export function makeSunTexture(seed = 11) {
  const made = newCanvas(512, 256);
  if (!made) return null;
  const { canvas, ctx } = made;
  const rand = mulberry32(seed);

  ctx.fillStyle = '#ff9500';
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 900; i++) {
    ctx.globalAlpha = 0.1 + rand() * 0.25;
    const bright = rand() > 0.35;
    ctx.fillStyle = bright ? '#ffd27a' : '#e05a00';
    const r = 2 + rand() * 9;
    ctx.beginPath();
    ctx.arc(rand() * 512, rand() * 256, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Quelques taches solaires
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#7a2e00';
  for (let i = 0; i < 6; i++) {
    const r = 6 + rand() * 14;
    ctx.beginPath();
    ctx.arc(rand() * 512, rand() * 256, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  return finalize(canvas);
}
