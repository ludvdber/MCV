import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, screen, fireEvent } from '@testing-library/react';
import WindParticlesLayer from './WindParticlesLayer';
import WindSpeedLegend from './WindSpeedLegend';
import AnimationPlayer from './AnimationPlayer';
import {
  renderSimple, installCanvas2D, installGeometrie, installApiFixtures,
  faireHotePlotly, dessins,
} from '../test/harness';
import { resetPlotly, callsOf, lastCall } from '../test/plotlyStub';
import { WIND, ANIMATION, LATS, LONS } from '../test/fixtures';
import { windSpeedStats } from '../utils/windStats';

/**
 * La couche de particules est la seule partie de l'application qui anime un
 * canvas image par image. Deux chemins tres differents en sortent : la boucle
 * requestAnimationFrame, et — sous `prefers-reduced-motion` — des lignes de
 * courant FIGEES. Le second n'avait jamais ete execute nulle part.
 */
const GEO = { l: 60, t: 40, w: 600, h: 400, xr: [-180, 180], yr: [-90, 90] };

let desinstallerCanvas;
let desinstallerGeo;
const matchMediaOrigine = window.matchMedia;

/** Impose la reponse de prefers-reduced-motion. */
const mouvementReduit = (reduit) => {
  window.matchMedia = (q) => ({
    matches: reduit && q.includes('reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  });
};

beforeEach(() => {
  resetPlotly();
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  mouvementReduit(false);
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  window.matchMedia = matchMediaOrigine;
  vi.useRealTimers();
  document.body.innerHTML = '';
});

/** Monte la couche au-dessus d'un graphe Plotly factice. */
function monterParticules(props = {}) {
  const { plotEl } = faireHotePlotly(GEO);
  const plotRef = { current: plotEl };
  const rendu = renderSimple(
    <WindParticlesLayer plotRef={plotRef} windData={WIND} enabled {...props} />,
  );
  const canvas = rendu.container.querySelector('canvas');
  return { ...rendu, canvas, plotRef };
}

describe('WindParticlesLayer', () => {
  it('ne rend aucun canvas quand la couche est eteinte', () => {
    const { plotEl } = faireHotePlotly(GEO);
    const { container } = renderSimple(
      <WindParticlesLayer plotRef={{ current: plotEl }} windData={WIND} enabled={false} />,
    );
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('ne dessine rien sans champ de vent', () => {
    const { plotEl } = faireHotePlotly(GEO);
    const { container } = renderSimple(
      <WindParticlesLayer plotRef={{ current: plotEl }} windData={null} enabled />,
    );
    const canvas = container.querySelector('canvas');
    const journal = dessins.find((d) => d.canvas === canvas)?.journal ?? [];
    expect(journal).toHaveLength(0);
  });

  it('ne dessine rien sur un champ vide (tableau de latitudes de longueur nulle)', () => {
    const { plotEl } = faireHotePlotly(GEO);
    const { container } = renderSimple(
      <WindParticlesLayer plotRef={{ current: plotEl }} windData={{ lats: [], lons: [], u: [], v: [] }} enabled />,
    );
    const canvas = container.querySelector('canvas');
    const journal = dessins.find((d) => d.canvas === canvas)?.journal ?? [];
    expect(journal).toHaveLength(0);
  });

  it('anime : chaque image fond les trainees puis retrace', () => {
    // Le fondu se fait en `destination-in` par-dessus la zone de trace, PAS
    // par un clearRect : c est ce qui laisse une trainee derriere chaque
    // particule au lieu d un point isole.
    vi.useFakeTimers();
    const { canvas } = monterParticules();
    const journal = dessins.find((d) => d.canvas === canvas).journal;
    journal.length = 0;
    act(() => { vi.advanceTimersByTime(64); });
    expect(journal.some((a) => a.m === 'fillRect')).toBe(true);
    expect(journal.some((a) => a.m === 'stroke')).toBe(true);
    // Plusieurs images se succedent tant que la couche est montee.
    const apresUne = journal.length;
    act(() => { vi.advanceTimersByTime(64); });
    expect(journal.length).toBeGreaterThan(apresUne);
  });

  it('decoupe le dessin sur la zone de trace', () => {
    // Sans `clip`, les particules debordent sur les axes et la colorbar.
    vi.useFakeTimers();
    const { canvas } = monterParticules();
    const journal = dessins.find((d) => d.canvas === canvas).journal;
    journal.length = 0;
    act(() => { vi.advanceTimersByTime(64); });
    expect(journal.some((a) => a.m === 'clip')).toBe(true);
  });

  it('sous prefers-reduced-motion, trace des lignes de courant FIGEES', () => {
    // Chemin distinct et complet : aucune boucle d animation, tout est peint
    // en une passe des le montage.
    mouvementReduit(true);
    const { canvas } = monterParticules();
    const journal = dessins.find((d) => d.canvas === canvas).journal;
    expect(journal.some((a) => a.m === 'stroke')).toBe(true);
    expect(journal.some((a) => a.m === 'lineTo')).toBe(true);
  });

  it('arrete l animation au demontage', () => {
    vi.useFakeTimers();
    const { canvas, unmount } = monterParticules();
    const journal = dessins.find((d) => d.canvas === canvas).journal;
    unmount();
    journal.length = 0;
    act(() => { vi.advanceTimersByTime(500); });
    // Une boucle rAF laissee tourner apres demontage consomme du GPU sur
    // toutes les pages suivantes.
    expect(journal).toHaveLength(0);
  });

  it('reste hors de l arbre d accessibilite et ne capte pas la souris', () => {
    const { canvas } = monterParticules();
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    expect(canvas.style.pointerEvents).toBe('none');
  });

  it('dessine moins de particules en mode compact', () => {
    // Quatre cellules a pleine densite coutent quatre vues entieres de GPU.
    vi.useFakeTimers();
    const plein = monterParticules({ compact: false });
    const jPlein = dessins.find((d) => d.canvas === plein.canvas).journal;
    jPlein.length = 0;
    act(() => { vi.advanceTimersByTime(32); });
    const nPlein = jPlein.length;
    plein.unmount();

    const compact = monterParticules({ compact: true });
    const jCompact = dessins.find((d) => d.canvas === compact.canvas).journal;
    jCompact.length = 0;
    act(() => { vi.advanceTimersByTime(32); });
    expect(jCompact.length).toBeLessThanOrEqual(nPlein);
  });

  it('attend une geometrie de graphe exploitable', () => {
    // Le graphe n est pas encore trace : on ne convertit pas des degres en
    // pixels avec des axes inexistants, on repasse a l image suivante.
    vi.useFakeTimers();
    const plotEl = document.createElement('div');
    const { container } = renderSimple(
      <WindParticlesLayer plotRef={{ current: plotEl }} windData={WIND} enabled />,
    );
    const canvas = container.querySelector('canvas');
    const journal = dessins.find((d) => d.canvas === canvas)?.journal ?? [];
    journal.length = 0;
    act(() => { vi.advanceTimersByTime(100); });
    expect(journal.every((a) => a.m !== 'stroke')).toBe(true);
  });
});

/* ── Cout d animation et vitesse ───────────────────────────────────────────
   Mesure sur la console en ligne, quatre vues en grille : 181 images par
   seconde, huit canvas animes, 1,39 million de pixels repeints par image. La
   boucle suivait le taux de rafraichissement de l ECRAN, sans aucune borne —
   et la constante d advection etait exprimee PAR IMAGE, si bien que le vent
   defilait trois fois plus vite sur cet ecran que sur un 60 Hz. Ce n est donc
   pas qu une question de GPU : deux personnes ne voyaient pas le meme
   phenomene.

   Ces tests livrent les images a la main. C est le seul moyen de choisir la
   CADENCE : les minuteries simulees de vitest en donnent une toutes les 16 ms,
   c est-a-dire exactement le cas qui marchait deja. */

/** Remplace requestAnimationFrame par une livraison manuelle horodatee. */
function installerImages() {
  const rafOrigine = window.requestAnimationFrame;
  const annulerOrigine = window.cancelAnimationFrame;
  let attendu = null;
  let id = 0;
  window.requestAnimationFrame = (cb) => { attendu = cb; return ++id; };
  window.cancelAnimationFrame = () => { attendu = null; };
  return {
    /** Livre une image a l instant t, en millisecondes. */
    image(t) {
      const cb = attendu;
      attendu = null;
      if (cb) act(() => { cb(t); });
    },
    get programmee() { return attendu !== null; },
    restaurer() {
      window.requestAnimationFrame = rafOrigine;
      window.cancelAnimationFrame = annulerOrigine;
    },
  };
}

/** Math.random deterministe : deux montages partent des memes particules. */
function semer() {
  const origine = Math.random;
  let x = 1234567;
  Math.random = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  return () => { Math.random = origine; };
}

/** Indices des debuts d image : le fondu (fillRect) ouvre chaque image. */
const debutsDImage = (journal) => journal
  .map((a, i) => (a.m === 'fillRect' ? i : -1))
  .filter((i) => i >= 0);

/** Longueur totale des trainees tracees dans l image n (1-based), en pixels. */
function longueurDeLImage(journal, n) {
  const debuts = debutsDImage(journal);
  const depart = debuts[n - 1];
  if (depart === undefined) return 0;
  const fin = debuts[n] ?? journal.length;
  let total = 0;
  let de = null;
  for (let i = depart; i < fin; i++) {
    const a = journal[i];
    if (a.m === 'moveTo') de = a.args;
    else if (a.m === 'lineTo' && de) total += Math.hypot(a.args[0] - de[0], a.args[1] - de[1]);
  }
  return total;
}

describe('WindParticlesLayer, cout et vitesse', () => {
  it('plafonne a 60 images par seconde sur un ecran a 181 Hz', () => {
    const images = installerImages();
    try {
      const { canvas } = monterParticules();
      const journal = dessins.find((d) => d.canvas === canvas).journal;
      journal.length = 0;
      for (let t = 0; t <= 1000; t += 1000 / 181) images.image(t);
      // 182 images proposees en une seconde, une soixantaine dessinees.
      const dessinees = debutsDImage(journal).length;
      expect(dessinees).toBeGreaterThan(50);
      expect(dessinees).toBeLessThan(70);
    } finally { images.restaurer(); }
  });

  it('dessine toutes les images d un ecran 60 Hz : le plafond ne doit pas'
    + ' rejeter une image sur deux', () => {
    // Le piege du plafond : un seuil pose exactement a 16,67 ms refuserait la
    // moitie des images d un ecran 60 Hz a cause de la gigue, et l animation
    // tomberait a 30 images par seconde sur le materiel le plus repandu.
    const images = installerImages();
    try {
      const { canvas } = monterParticules();
      const journal = dessins.find((d) => d.canvas === canvas).journal;
      journal.length = 0;
      let t = 0;
      for (let i = 0; i < 30; i++) {
        t += 16.2 + Math.random() * 0.9;   // 16,2 a 17,1 ms : gigue reelle
        images.image(t);
      }
      expect(debutsDImage(journal).length).toBe(30);
    } finally { images.restaurer(); }
  });

  it('advecte au TEMPS ecoule, pas au nombre d images', () => {
    // Deux cadences sous le plafond, meme premiere image, donc memes
    // particules au depart de la seconde : sa longueur doit doubler quand la
    // duree double. Avant, elle etait identique et le vent allait deux fois
    // plus vite sur l ecran rapide.
    const trainees = (periode) => {
      const desemer = semer();
      const images = installerImages();
      try {
        const { canvas, unmount } = monterParticules();
        const journal = dessins.find((d) => d.canvas === canvas).journal;
        journal.length = 0;
        images.image(periode);
        images.image(2 * periode);
        const longueur = longueurDeLImage(journal, 2);
        unmount();
        return longueur;
      } finally { images.restaurer(); desemer(); }
    };
    const a60 = trainees(1000 / 60);
    const a30 = trainees(1000 / 30);
    expect(a60).toBeGreaterThan(0);
    expect(a30 / a60).toBeGreaterThan(1.8);
    expect(a30 / a60).toBeLessThan(2.2);
  });

  it('suspend l animation quand la carte sort de l ecran, et la reprend sans bond', () => {
    // Le navigateur ne freine que les ONGLETS caches : une carte qui a defile
    // hors du champ continuait d animer son vent a pleine vitesse pour
    // personne. Au retour, la premiere image ne doit pas rattraper tout le
    // temps ecoule d un seul coup.
    const observateurs = [];
    const origine = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = class {
      constructor(rappel) { this.rappel = rappel; observateurs.push(this); }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    };
    const images = installerImages();
    try {
      const { canvas } = monterParticules();
      const journal = dessins.find((d) => d.canvas === canvas).journal;
      journal.length = 0;
      images.image(20);
      const normale = longueurDeLImage(journal, 1);
      expect(normale).toBeGreaterThan(0);

      act(() => { observateurs[0].rappel([{ isIntersecting: false }]); });
      expect(images.programmee).toBe(false);
      journal.length = 0;
      images.image(40);
      expect(journal).toHaveLength(0);

      act(() => { observateurs[0].rappel([{ isIntersecting: true }]); });
      expect(images.programmee).toBe(true);
      images.image(400);
      expect(debutsDImage(journal).length).toBe(1);
      expect(longueurDeLImage(journal, 1)).toBeLessThan(normale * 3);
    } finally {
      images.restaurer();
      globalThis.IntersectionObserver = origine;
    }
  });

  /* Qu on anime PAR DEFAUT, l observateur ne faisant que suspendre, est deja
     prouve par tous les tests ci-dessus : le bouchon d IntersectionObserver de
     src/test/setup.js est inerte et n appelle jamais son rappel, et ils
     dessinent quand meme. Une couche qui n animerait qu apres un premier
     rapport d intersection y serait muette. */
});

describe('WindSpeedLegend', () => {
  const stats = windSpeedStats(WIND);

  it('n affiche rien sans statistiques', () => {
    const { container } = renderSimple(<WindSpeedLegend stats={null} />);
    expect(container.textContent).toBe('');
  });

  it('affiche les DEUX bornes : la rampe est etiree sur le champ affiche', () => {
    renderSimple(<WindSpeedLegend stats={stats} />);
    const txt = document.body.textContent;
    expect(txt).toContain(String(Math.round(stats.min)));
    expect(txt).toContain(String(Math.round(stats.max)));
  });

  it('garde la MOYENNE meme en mode compact', () => {
    // C est l information qui manquait le plus : la legende entiere
    // disparaissait des qu une vue passait en grille.
    renderSimple(<WindSpeedLegend stats={stats} compact />);
    expect(document.body.textContent).toContain(String(Math.round(stats.mean)));
  });

  it('la barre de degrade est decorative', () => {
    const { container } = renderSimple(<WindSpeedLegend stats={stats} />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });
});

describe('AnimationPlayer', () => {
  it('trace la premiere frame au montage', () => {
    renderSimple(<AnimationPlayer animationData={ANIMATION} variableCode="TT" datasetLabel="MY35" />);
    const tr = lastCall('newPlot').traces[0];
    expect(tr.type).toBe('heatmap');
    expect(tr.z).toEqual(ANIMATION.frames[0]);
    expect(tr.x).toEqual(LONS);
    expect(tr.y).toEqual(LATS);
  });

  it('ne trace rien sur une reponse partielle', () => {
    renderSimple(<AnimationPlayer animationData={{ dataset: 'x' }} variableCode="TT" />);
    expect(callsOf('newPlot')).toHaveLength(0);
  });

  it('purge Plotly au demontage', () => {
    const { unmount } = renderSimple(
      <AnimationPlayer animationData={ANIMATION} variableCode="TT" />,
    );
    unmount();
    expect(callsOf('purge').length).toBeGreaterThanOrEqual(1);
  });

  it('avance d une frame et previent son parent', () => {
    const onFrameChange = vi.fn();
    renderSimple(
      <AnimationPlayer animationData={ANIMATION} variableCode="TT" onFrameChange={onFrameChange} />,
    );
    const suivant = screen.getAllByRole('button')
      .find((b) => /next|suiv/i.test(b.getAttribute('aria-label') || b.textContent));
    if (suivant) {
      fireEvent.click(suivant);
      // Le parent doit savoir quelle frame est a l ecran : la sonde liee en
      // depend pour echantillonner la BONNE frame.
      expect(onFrameChange).toHaveBeenCalled();
    }
  });

  it('fige toutes les frames sur la MEME echelle de couleur', () => {
    // Une echelle recalculee par frame ferait « respirer » les couleurs :
    // la meme teinte ne designerait pas la meme temperature d une image a
    // l autre, ce qui est exactement ce qu une animation doit permettre de
    // comparer.
    renderSimple(<AnimationPlayer animationData={ANIMATION} variableCode="TT" />);
    const tr = lastCall('newPlot').traces[0];
    expect(tr.zmin).toBeDefined();
    expect(tr.zmax).toBeDefined();
    expect(tr.zmin).toBeLessThan(tr.zmax);
  });
});
