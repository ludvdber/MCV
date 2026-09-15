/**
 * Couche de particules de vent animees au-dessus d'une heatmap Plotly.
 *
 * Le principe de Windy / earth.nullschool applique a GEM-Mars : des centaines
 * de particules sont advectees le long du champ UU/VV (deja servi par
 * /api/data/wind) et leurs trainees dessinent jets, cellules et tourbillons.
 * AUCUNE donnee inventee : les particules sont un rendu du champ mesure,
 * echantillonne par interpolation bilineaire.
 *
 * Chaque trainee est coloree ET epaissie selon la vitesse locale (windStats.js).
 * La rampe est sequentielle a teinte unique, pour ne pas entrer en concurrence
 * avec la palette de la heatmap situee dessous, et l'echelle est lineaire entre
 * le minimum et le maximum du champ affiche — bornes que la legende de
 * SliceViewer annonce, sans quoi la couleur ne voudrait rien dire.
 *
 * Implementation : un <canvas> en position absolue au-dessus du div Plotly
 * (pointer-events: none, le survol traverse). La conversion (lon, lat) → pixel
 * relit a chaque frame la taille et les ranges des axes dans el._fullLayout,
 * si bien que zoom et pan Plotly sont suivis automatiquement.
 *
 * prefers-reduced-motion : trace des lignes de courant statiques a la place
 * de l'animation.
 *
 * Cout : la boucle est plafonnee a 60 images par seconde (IPS_MAX) et
 * suspendue des que la carte sort de l'ecran. Tout ce qui evolue est rapporte
 * au temps ecoule et non au nombre d'images (ADVECTION), donc l'animation a la
 * meme vitesse sur tous les ecrans.
 *
 * @param {React.RefObject} plotRef  — ref du div Plotly (externalPlotRef du viewer)
 * @param {Object|null}     windData — WindResponse { lats[], lons[], u[], v[] } (points aplatis)
 * @param {boolean}         enabled
 * @param {boolean}         compact  — cellule de grille : moins de particules
 */
import { useEffect, useRef } from 'react';
import { useThemeMode } from '../context/ThemeContext';
import { windSpeedStats, windRamp, windBand, WIND_BANDS, WIND_WIDTHS } from '../utils/windStats';

const N_PARTICLES = 700;
/**
 * Cellule de grille : la carte fait le quart de la surface, et jusqu'a quatre
 * canvas animent leur vent en meme temps. Moins de particules y gardent la
 * meme DENSITE apparente pour un cout total voisin de deux vues pleines.
 */
const COMPACT_PARTICLES = 380;
/** Variante prefers-reduced-motion : lignes de courant figees. */
const STATIC_LINES = 320;
const STATIC_STEPS = 8;
/** Capacite d'un tampon de bande : le pire des deux rendus, si tout y tombe. */
const MAX_SEGMENTS = Math.max(N_PARTICLES, STATIC_LINES * STATIC_STEPS);

/**
 * Plafond d'images par seconde.
 *
 * `requestAnimationFrame` suit le taux de rafraichissement de l'ECRAN, sans
 * aucune borne. Mesure sur la console Explorer en ligne, quatre vues en
 * grille : 181 images par seconde, huit canvas animes, 1,39 million de pixels
 * repeints par image — trois fois le travail d'un ecran 60 Hz pour un resultat
 * visuellement identique, les images supplementaires n'etant meme pas
 * affichees. Au-dela de 60 l'oeil ne gagne rien sur des trainees qui
 * s'estompent ; le GPU, lui, paie tout.
 */
const IPS_MAX = 60;
const INTERVALLE_MS = 1000 / IPS_MAX;
/**
 * Un ecran 60 Hz livre ses images a 16,67 ms avec quelques dixiemes de gigue.
 * Un seuil pose exactement a 16,67 ms en refuserait une sur deux et
 * l'animation tomberait a 30 images par seconde sur le materiel le plus
 * repandu — l'inverse du but poursuivi.
 */
const SEUIL_MS = INTERVALLE_MS * 0.9;
/**
 * Ecart maximal pris en compte entre deux images. Au retour d'un onglet reste
 * en arriere-plan, le navigateur livre une image apres plusieurs secondes :
 * sans ce plafond les particules feraient un bond de plusieurs tours de
 * planete d'un coup.
 */
const ECOULE_MAX_MS = 100;

/**
 * deg / (m/s) / SECONDE — vitesse visuelle de l'advection.
 *
 * Etait exprimee PAR IMAGE (0,011), ce qui n'est pas qu'une question de cout :
 * le vent defilait trois fois plus vite sur un ecran 181 Hz que sur un 60 Hz.
 * La vitesse d'une animation ne doit pas dependre du materiel de celui qui
 * regarde, sans quoi deux personnes ne voient pas le meme phenomene. Valeur
 * inchangee a 60 images par seconde : 0,011 x 60.
 */
const ADVECTION = 0.66;
/** Duree de vie d'une particule, en SECONDES (etait 15 a 125 images). */
const AGE_MIN_S = 0.25;
const AGE_ETENDUE_S = 110 / 60;
/** Opacite conservee par les trainees a chaque image de 1/60 s. Elevee a la
 *  puissance du temps ecoule pour que la longueur des trainees ne depende pas
 *  davantage du taux de rafraichissement. */
const FONDU_PAR_IMAGE = 0.93;
/** Pas geometrique des lignes de courant figees (prefers-reduced-motion) :
 *  une longueur a l'ecran, pas une vitesse — donc pas de temps ici. */
const PAS_LIGNE = 0.033;

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

export default function WindParticlesLayer({ plotRef, windData, enabled = false, compact = false }) {
  const canvasRef = useRef(null);
  const { mode } = useThemeMode();

  useEffect(() => {
    const canvas = canvasRef.current;
    const plotEl = plotRef?.current;
    if (!enabled || !canvas || !plotEl || !windData?.lats?.length) return undefined;

    const grid = gridify(windData);
    /* Bornes de l'echelle de couleur : celles du champ effectivement affiche,
       recalculees a chaque changement de slice pour que la rampe couvre
       toujours la dynamique reelle plutot qu'une plage figee. */
    const stats = windSpeedStats(windData);
    if (!stats) return undefined;
    const ctx = canvas.getContext('2d');
    // `getContext('2d')` rend null quand le navigateur refuse un contexte de
    // plus (limite par onglet, contexte perdu non restaure). Sans cette
    // garde, le nettoyage de cet effet levait au demontage — pendant la
    // destruction de l'arbre React, donc hors de portee d'un ErrorBoundary.
    if (!ctx) return undefined;
    const ramp = windRamp(mode);
    /* Les segments sont accumules par bande de vitesse puis traces en une passe
       par bande : WIND_BANDS appels a stroke() par frame au lieu d'un par
       particule, ce qui garde le cout de rendu identique a la version
       monochrome malgre la coloration. */
    const segs = Array.from({ length: WIND_BANDS }, () => new Float32Array(MAX_SEGMENTS * 4));
    const segN = new Int32Array(WIND_BANDS);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Particules : [lon, lat, prevLon, prevLat, age] × N */
    const nParticules = compact ? COMPACT_PARTICLES : N_PARTICLES;
    const P = new Float32Array(nParticules * 5);
    const lonMin = grid.lons[0], lonMax = grid.lons[grid.lons.length - 1];
    const latMin = grid.lats[0], latMax = grid.lats[grid.lats.length - 1];
    function respawn(k) {
      P[k] = lonMin + Math.random() * (lonMax - lonMin);
      P[k + 1] = latMin + Math.random() * (latMax - latMin);
      P[k + 2] = P[k]; P[k + 3] = P[k + 1];
      P[k + 4] = AGE_MIN_S + Math.random() * AGE_ETENDUE_S;
    }
    for (let i = 0; i < nParticules; i++) respawn(i * 5);

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
    /* Horodatage du dernier rendu. C'est celui que requestAnimationFrame passe
       a son rappel, et non `performance.now()` : lui seul suit l'horloge que
       les tests avancent a la main. `null` = premiere image a venir. */
    let tDernierRendu = null;

    /** Trace les segments accumules, une passe de stroke() par bande de vitesse. */
    function strokeBands() {
      for (let b = 0; b < WIND_BANDS; b++) {
        const n = segN[b];
        if (n === 0) continue;
        const buf = segs[b];
        ctx.strokeStyle = ramp[b];
        ctx.lineWidth = WIND_WIDTHS[b];
        ctx.beginPath();
        for (let i = 0; i < n; i += 4) {
          ctx.moveTo(buf[i], buf[i + 1]);
          ctx.lineTo(buf[i + 2], buf[i + 3]);
        }
        ctx.stroke();
      }
    }

    function frame(horodatage) {
      if (stopped) return;
      /* Reprogrammee D'ABORD : aucune des sorties anticipees ci-dessous
         (image de trop, graphe pas encore trace) ne doit arreter la boucle. */
      raf = requestAnimationFrame(frame);
      const maintenant = typeof horodatage === 'number' ? horodatage : performance.now();
      if (tDernierRendu === null) tDernierRendu = maintenant - INTERVALLE_MS;
      const ecoule = maintenant - tDernierRendu;
      if (ecoule < SEUIL_MS) return;
      const g = plotGeometry();
      /* Le graphe n'est pas encore trace : on ne consomme pas le budget de
         temps, sans quoi la premiere image reellement dessinee avancerait les
         particules de tout le retard accumule. */
      if (!g) return;
      tDernierRendu = maintenant;
      /* Tout ce qui evolue est desormais rapporte a ce dt, en secondes : la
         vitesse des particules, leur duree de vie et la longueur des trainees
         ne dependent plus du taux de rafraichissement de l'ecran. */
      const dt = Math.min(ecoule, ECOULE_MAX_MS) / 1000;
      const { size, xr, yr } = g;
      const toX = (lon) => size.l + ((lon - xr[0]) / ((xr[1] - xr[0]) || 1)) * size.w;
      const toY = (lat) => size.t + ((yr[1] - lat) / ((yr[1] - yr[0]) || 1)) * size.h;

      /* Fondu des trainees puis nouveaux segments, le tout borne a la zone de trace. */
      ctx.save();
      ctx.beginPath();
      ctx.rect(size.l, size.t, size.w, size.h);
      ctx.clip();
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = `rgba(0, 0, 0, ${FONDU_PAR_IMAGE ** (dt * IPS_MAX)})`;
      ctx.fillRect(size.l, size.t, size.w, size.h);
      ctx.globalCompositeOperation = 'source-over';
      segN.fill(0);
      for (let k = 0; k < nParticules * 5; k += 5) {
        const w = sampleWind(grid, P[k], P[k + 1]);
        P[k + 2] = P[k]; P[k + 3] = P[k + 1];
        if (!w) { respawn(k); continue; }
        P[k] += w[0] * ADVECTION * dt;
        P[k + 1] += w[1] * ADVECTION * dt;
        P[k + 4] -= dt;
        if (P[k + 4] <= 0 || P[k] < lonMin || P[k] > lonMax || P[k + 1] < latMin || P[k + 1] > latMax) {
          respawn(k); continue;
        }
        /* La couleur suit la vitesse au point ou la particule vient de passer,
           pas la longueur du segment a l'ecran : celle-ci depend du zoom. */
        const b = windBand(Math.hypot(w[0], w[1]), stats.min, stats.max);
        const buf = segs[b];
        const n = segN[b];
        buf[n] = toX(P[k + 2]); buf[n + 1] = toY(P[k + 3]);
        buf[n + 2] = toX(P[k]); buf[n + 3] = toY(P[k + 1]);
        segN[b] = n + 4;
      }
      strokeBands();
      ctx.restore();
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
      segN.fill(0);
      for (let n = 0; n < STATIC_LINES; n++) {
        let lon = lonMin + Math.random() * (lonMax - lonMin);
        let lat = latMin + Math.random() * (latMax - latMin);
        for (let s = 0; s < STATIC_STEPS; s++) {
          const w = sampleWind(grid, lon, lat);
          if (!w) break;
          const lonNext = lon + w[0] * PAS_LIGNE;
          const latNext = lat + w[1] * PAS_LIGNE;
          /* Meme codage de la vitesse que l'animation : sans mouvement, la
             couleur et l'epaisseur restent la seule lecture de l'intensite. */
          const b = windBand(Math.hypot(w[0], w[1]), stats.min, stats.max);
          const buf = segs[b];
          const i = segN[b];
          buf[i] = toX(lon); buf[i + 1] = toY(lat);
          buf[i + 2] = toX(lonNext); buf[i + 3] = toY(latNext);
          segN[b] = i + 4;
          lon = lonNext; lat = latNext;
        }
      }
      strokeBands();
      ctx.restore();
    }

    function animer() {
      if (stopped || raf) return;
      /* Repartir sans horodatage de reference : sinon la premiere image
         apres une pause rattraperait tout le temps ecoule d'un bond. */
      tDernierRendu = null;
      raf = requestAnimationFrame(frame);
    }
    function suspendre() {
      cancelAnimationFrame(raf);
      raf = 0;
    }

    let io = null;
    if (reducedMotion) {
      drawStaticStreamlines();
    } else {
      /* On anime PAR DEFAUT, et l'observateur ne fait que suspendre : une
         carte doit tourner meme la ou IntersectionObserver n'existe pas.
         Hors de l'ecran, une carte continuait sinon d'animer son vent a
         pleine vitesse — le navigateur ne freine que les ONGLETS caches, pas
         ce qui a defile hors du champ. Dans la console Explorer, descendre
         jusqu'au panneau du bas laissait huit canvas tourner pour personne.
         C'est le div Plotly qui est observe, pas le canvas : lui a une
         taille avant meme que le graphe soit trace. */
      animer();
      io = new IntersectionObserver(
        (entrees) => (entrees.some((e) => e.isIntersecting) ? animer() : suspendre()),
        // Marge : l'animation repart juste AVANT l'entree dans le champ, la
        // carte n'apparait donc jamais figee.
        { rootMargin: '150px' },
      );
      io.observe(plotEl);
    }

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clearTimeout(staticTimer);
      ro.disconnect();
      io?.disconnect();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [enabled, windData, plotRef, mode, compact]);

  if (!enabled) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}
    />
  );
}
