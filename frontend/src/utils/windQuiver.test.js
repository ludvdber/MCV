import { describe, it, expect } from 'vitest';
import { plotAreaSize, quiverScales, buildQuiverSegments } from './windQuiver';

/**
 * Le defaut corrige : les fleches etaient construites en degres, alors que
 * l'angle percu est celui des pixels. Sur la zone de trace reelle de /slice
 * (960x306 px pour 360x180 deg), un vent a 45 deg s'affichait a 32,8 deg.
 *
 * Le test central reconvertit les segments produits en pixels et verifie que
 * l'angle y est bien celui du vent, quelle que soit la forme du cadre.
 */

/** Geometrie mesuree sur la vraie page /slice en 1440x900. */
const BUREAU = { size: { w: 960, h: 306 }, x: [-180, 180], y: [-90, 90] };
/** Et en 390x844 (telephone), ou l'anamorphose est la plus violente. */
const MOBILE = { size: { w: 191, h: 348 }, x: [-180, 180], y: [-90, 90] };

/** Grille reguliere de 12 deg, comme la renvoie /api/data/wind. */
function grille(vecteurs) {
  const lats = [], lons = [], u = [], v = [];
  for (const [lat, lon, uu, vv] of vecteurs) { lats.push(lat); lons.push(lon); u.push(uu); v.push(vv); }
  return { lats, lons, u, v };
}

/** Decoupe la sortie en fleches : [depart, pointe] du corps, en degres. */
function corpsDesFleches({ x, y }) {
  const out = [];
  // Chaque fleche produit 3 segments (corps + 2 barbes) de 3 entrees chacun.
  for (let i = 0; i < x.length; i += 9) {
    out.push({ x0: x[i], y0: y[i], x1: x[i + 1], y1: y[i + 1] });
  }
  return out;
}

describe('plotAreaSize', () => {
  it('retranche les marges du conteneur', () => {
    const el = { clientWidth: 1150, clientHeight: 450 };
    expect(plotAreaSize(el, { l: 70, r: 120, t: 80, b: 64 })).toEqual({ w: 960, h: 306 });
  });

  it('rend null quand la zone est degeneree ou les entrees absentes', () => {
    expect(plotAreaSize({ clientWidth: 100, clientHeight: 100 }, { l: 70, r: 120, t: 0, b: 0 })).toBeNull();
    expect(plotAreaSize(null, { l: 0, r: 0, t: 0, b: 0 })).toBeNull();
    expect(plotAreaSize({ clientWidth: 500, clientHeight: 500 }, null)).toBeNull();
  });
});

describe('quiverScales', () => {
  it('donne les degres par pixel de chaque axe', () => {
    const s = quiverScales(BUREAU.size, BUREAU.x, BUREAU.y);
    expect(s.sx).toBeCloseTo(360 / 960, 6);
    expect(s.sy).toBeCloseTo(180 / 306, 6);
  });

  it('rend null sur une geometrie inexploitable', () => {
    expect(quiverScales(null, BUREAU.x, BUREAU.y)).toBeNull();
    expect(quiverScales({ w: 0, h: 306 }, BUREAU.x, BUREAU.y)).toBeNull();
    expect(quiverScales(BUREAU.size, [10, 10], BUREAU.y)).toBeNull();
    expect(quiverScales(BUREAU.size, undefined, BUREAU.y)).toBeNull();
  });
});

describe('buildQuiverSegments — angle affiche', () => {
  // Un vent plein nord-est : u = v, donc 45 deg exactement.
  const vent45 = grille([
    [0, 0, 30, 30], [0, 12, 30, 30], [12, 0, 30, 30], [12, 12, 30, 30],
  ]);

  it.each([
    ['ecran de bureau (960x306)', BUREAU],
    ['telephone (191x348)', MOBILE],
  ])('un vent a 45 deg est dessine a 45 deg — %s', (_nom, geo) => {
    const scales = quiverScales(geo.size, geo.x, geo.y);
    const fleches = corpsDesFleches(buildQuiverSegments(vent45, scales));
    expect(fleches.length).toBe(4);

    for (const f of fleches) {
      // Retour en pixels : c'est la que se juge l'angle vu par l'oeil.
      const pxDx = (f.x1 - f.x0) / scales.sx;
      const pxDy = (f.y1 - f.y0) / scales.sy;
      expect((Math.atan2(pxDy, pxDx) * 180) / Math.PI).toBeCloseTo(45, 6);
    }
  });

  it('respecte l\'angle du vent quel que soit sa direction', () => {
    const scales = quiverScales(BUREAU.size, BUREAU.x, BUREAU.y);
    const vents = [[40, 0], [0, 40], [-40, 0], [0, -40], [30, -10], [-15, 25]];
    const data = grille(vents.map(([uu, vv], i) => [0, i * 12, uu, vv]));
    const fleches = corpsDesFleches(buildQuiverSegments(data, scales));

    fleches.forEach((f, i) => {
      const [uu, vv] = vents[i];
      const pxDx = (f.x1 - f.x0) / scales.sx;
      const pxDy = (f.y1 - f.y0) / scales.sy;
      expect(Math.atan2(pxDy, pxDx)).toBeCloseTo(Math.atan2(vv, uu), 6);
    });
  });

  it('le defaut d\'origine est bien reproduit si on ignore l\'anamorphose', () => {
    // Temoin : construire la fleche directement en degres, comme l'ancien code,
    // deforme l'angle dans un sens ou dans l'autre selon la forme du cadre. Un
    // vent a 45 deg tombait a 32,5 deg sur un ecran large, et grimpait a
    // 74,7 deg sur le cadre etroit et haut du telephone.
    for (const [geo, attendu] of [[BUREAU, 32.52], [MOBILE, 74.65]]) {
      const s = quiverScales(geo.size, geo.x, geo.y);
      const angleNaif = (Math.atan2(1 / s.sy, 1 / s.sx) * 180) / Math.PI;
      expect(angleNaif).toBeCloseTo(attendu, 1);
      expect(Math.abs(angleNaif - 45)).toBeGreaterThan(10);
    }
  });
});

describe('buildQuiverSegments — longueur et densite', () => {
  const scales = quiverScales(BUREAU.size, BUREAU.x, BUREAU.y);

  it('la fleche la plus rapide reste sous le pas de grille a l\'ecran', () => {
    const data = grille([
      [0, 0, 100, 0], [0, 12, 50, 0], [12, 0, 10, 0], [12, 12, 5, 0],
    ]);
    const fleches = corpsDesFleches(buildQuiverSegments(data, scales));
    // Pas de 12 deg : 32 px en longitude, 20,4 px en latitude -> le plus petit fait foi.
    const pasMinPx = Math.min(12 / scales.sx, 12 / scales.sy);
    const longueurs = fleches.map(f =>
      Math.hypot((f.x1 - f.x0) / scales.sx, (f.y1 - f.y0) / scales.sy));

    expect(Math.max(...longueurs)).toBeLessThanOrEqual(pasMinPx);
    expect(Math.max(...longueurs)).toBeCloseTo(0.8 * pasMinPx, 6);
  });

  it('la longueur reste proportionnelle a la vitesse', () => {
    const data = grille([[0, 0, 100, 0], [0, 12, 50, 0]]);
    const [rapide, lente] = corpsDesFleches(buildQuiverSegments(data, scales));
    expect((lente.x1 - lente.x0) / (rapide.x1 - rapide.x0)).toBeCloseTo(0.5, 6);
  });

  it('ignore les vents quasi nuls plutot que de semer des points', () => {
    const data = grille([[0, 0, 50, 0], [0, 12, 0.1, 0.1], [12, 0, 0, 0]]);
    expect(corpsDesFleches(buildQuiverSegments(data, scales))).toHaveLength(1);
  });

  // Deux points au minimum : le pas de grille se deduit d'un ecart.
  const deuxFleches = grille([[0, 0, 50, 20], [0, 12, 50, 20]]);

  it('chaque fleche porte un corps et deux barbes, separes par des null', () => {
    const seg = buildQuiverSegments(deuxFleches, scales);
    expect(seg.x).toHaveLength(18);
    expect(seg.y).toHaveLength(18);
    expect([seg.x[2], seg.x[5], seg.x[8]]).toEqual([null, null, null]);
    expect([seg.y[2], seg.y[5], seg.y[8]]).toEqual([null, null, null]);
  });

  it('les barbes partent de la pointe de la fleche', () => {
    const seg = buildQuiverSegments(deuxFleches, scales);
    const pointeX = seg.x[1], pointeY = seg.y[1];
    expect(seg.x[3]).toBe(pointeX);
    expect(seg.x[6]).toBe(pointeX);
    expect(seg.y[3]).toBe(pointeY);
    expect(seg.y[6]).toBe(pointeY);
  });
});

describe('buildQuiverSegments — entrees degradees', () => {
  const scales = quiverScales(BUREAU.size, BUREAU.x, BUREAU.y);

  it.each([
    ['donnees absentes', null],
    ['tableaux vides', { lats: [], lons: [], u: [], v: [] }],
    ['champs manquants', { lats: [0], lons: [0] }],
    ['tableaux remplaces par des objets', { lats: {}, lons: {}, u: {}, v: {} }],
    ['vent nul partout', { lats: [0, 12], lons: [0, 12], u: [0, 0], v: [0, 0] }],
    ['un seul point (pas de grille deductible)', { lats: [0], lons: [0], u: [50], v: [0] }],
  ])('rend des tableaux vides sans lever : %s', (_nom, data) => {
    expect(buildQuiverSegments(data, scales)).toEqual({ x: [], y: [] });
  });

  it('rend des tableaux vides si la geometrie est inconnue', () => {
    const data = { lats: [0, 12], lons: [0, 12], u: [50, 50], v: [0, 0] };
    expect(buildQuiverSegments(data, null)).toEqual({ x: [], y: [] });
    expect(buildQuiverSegments(data, { sx: 0, sy: 1 })).toEqual({ x: [], y: [] });
  });

  it('tolere des tableaux de longueurs differentes', () => {
    const data = { lats: [0, 12, 24], lons: [0, 12], u: [50, 50, 50], v: [0, 0, 0] };
    expect(corpsDesFleches(buildQuiverSegments(data, scales))).toHaveLength(2);
  });
});
