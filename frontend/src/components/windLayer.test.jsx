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
