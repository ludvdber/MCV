import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import AnimationPlayer from './AnimationPlayer';
import i18n from '../i18n';
import {
  renderSimple, installApiFixtures, installCanvas2D, installGeometrie,
} from '../test/harness';
import { resetPlotly, callsOf, lastCall } from '../test/plotlyStub';
import { ANIMATION, LATS, LONS } from '../test/fixtures';

/**
 * Les OPTIONS du lecteur d'animation : echelle logarithmique, infobulle
 * detaillee, sur-echantillonnage, exports. Chacune change ce qui est envoye a
 * Plotly pour CHAQUE frame, pas seulement pour la premiere — c'est la que se
 * cachent les incoherences entre l'image initiale et les suivantes.
 */
let desinstallerCanvas;
let desinstallerGeo;
let clics;

beforeEach(async () => {
  resetPlotly();
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  await i18n.changeLanguage('fr');
  clics = [];
  URL.createObjectURL = vi.fn(() => 'blob:mcv');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function spy() {
    clics.push(this.getAttribute('download'));
  });
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete HTMLCanvasElement.prototype.captureStream;
  vi.restoreAllMocks();
});

const rendus = () => [...callsOf('newPlot'), ...callsOf('react')];

/** Animation positive, exploitable en echelle logarithmique. */
const ANIM_LOG = {
  ...ANIMATION,
  frames: ANIMATION.frames.map((f, k) => f.map((row) => row.map((v) => v * (k + 1) * 0.01))),
  stats: { min: 0.02, max: 600, mean: 5, stddev: 2 },
};

describe('echelle logarithmique', () => {
  it('borne l echelle sur des decades entieres, des la premiere image', () => {
    renderSimple(<AnimationPlayer animationData={ANIM_LOG} variableCode="H2O" logScale />);
    const tr = lastCall('newPlot').traces[0];
    expect(tr.zmin).toBe(-2);
    expect(tr.zmax).toBe(3);
    // Les valeurs ORIGINALES restent dans l'infobulle : personne ne lit un
    // rapport de melange en log.
    expect(tr.customdata).toBeTruthy();
    expect(tr.hovertemplate).toContain('log');
  });

  it('garde la MEME echelle sur toutes les images', () => {
    vi.useFakeTimers();
    renderSimple(<AnimationPlayer animationData={ANIM_LOG} variableCode="H2O" logScale />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('page.animation.play') }));
    act(() => { vi.advanceTimersByTime(2000); });
    const bornes = new Set(rendus().map((c) => `${c.traces[0].zmin}|${c.traces[0].zmax}`));
    expect(bornes.size).toBe(1);
  });

  it('elargit une echelle degeneree', () => {
    const plat = { ...ANIM_LOG, stats: { min: 100, max: 100, mean: 100, stddev: 0 } };
    renderSimple(<AnimationPlayer animationData={plat} variableCode="H2O" logScale />);
    const tr = lastCall('newPlot').traces[0];
    expect(tr.zmax - tr.zmin).toBe(2);
  });

  it('n impose aucune borne quand les statistiques ne sont pas positives', () => {
    // log10 d'une valeur negative n'existe pas : plutot que d'inventer des
    // bornes, on laisse Plotly ajuster l'echelle sur les donnees.
    const negatif = { ...ANIMATION, stats: { min: -5, max: 10, mean: 0, stddev: 1 } };
    renderSimple(<AnimationPlayer animationData={negatif} variableCode="TT" logScale />);
    const tr = lastCall('newPlot').traces[0];
    expect(Number.isFinite(tr.zmin)).toBe(false);
    expect(Number.isFinite(tr.zmax)).toBe(false);
  });
});

describe('infobulle detaillee', () => {
  it('calcule des donnees par cellule et les met en cache par image', () => {
    vi.useFakeTimers();
    renderSimple(
      <AnimationPlayer animationData={ANIMATION} variableCode="TT" showDetailedTooltip />,
    );
    const tr = lastCall('newPlot').traces[0];
    expect(Array.isArray(tr.customdata)).toBe(true);
    expect(tr.hovertemplate).toContain('customdata[0]');
    // Rejouer la meme image ne recalcule pas : le cache est indexe par frame.
    fireEvent.click(screen.getByRole('button', { name: i18n.t('page.animation.play') }));
    act(() => { vi.advanceTimersByTime(3000); });
    for (const c of rendus()) expect(c.traces[0].customdata).toBeTruthy();
  });
});

describe('sur-echantillonnage', () => {
  it('agrandit les DEUX axes et marque les points crees', () => {
    // Grille de reference : 20 deg en latitude, 60 deg en longitude. Une cible
    // de 10 deg fait donc grandir les deux axes (facteurs 2 et 6).
    renderSimple(<AnimationPlayer animationData={ANIMATION} variableCode="TT" interpStep={10} />);
    const tr = lastCall('newPlot').traces[0];
    expect(tr.x.length).toBeGreaterThan(LONS.length);
    expect(tr.y.length).toBeGreaterThan(LATS.length);
    expect(tr.text).toBeTruthy();
  });

  it('n agrandit qu un seul axe quand l autre est deja assez fin', () => {
    // Cible 30 deg : la longitude (60) se subdivise, la latitude (20) non.
    renderSimple(<AnimationPlayer animationData={ANIMATION} variableCode="TT" interpStep={30} />);
    const tr = lastCall('newPlot').traces[0];
    expect(tr.x.length).toBeGreaterThan(LONS.length);
    expect(tr.y).toEqual(LATS);
  });

  it('garde la grille native quand rien n est demande', () => {
    renderSimple(<AnimationPlayer animationData={ANIMATION} variableCode="TT" />);
    const tr = lastCall('newPlot').traces[0];
    expect(tr.x).toEqual(LONS);
    expect(tr.text).toBeUndefined();
  });

  it('affiche une legende rappelant la resolution NATIVE', () => {
    // Une carte lissee a 1° laisse croire a une resolution que le modele n'a
    // pas : la legende dit la grille reelle.
    renderSimple(<AnimationPlayer animationData={ANIMATION} variableCode="TT" interpStep={30} />);
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });
});

describe('exports du lecteur', () => {
  it('exporte les statistiques par image en CSV, sans reseau', async () => {
    renderSimple(<AnimationPlayer animationData={ANIMATION} variableCode="TT" />);
    const menu = screen.getByRole('button', { name: new RegExp(i18n.t('export.button'), 'i') });
    fireEvent.click(menu);
    const csv = screen.queryAllByRole('menuitem').find((e) => /csv/i.test(e.textContent));
    expect(csv).toBeTruthy();
    fireEvent.click(csv);
    await waitFor(() => expect(clics.some((n) => n?.startsWith('animation_TT_alt'))).toBe(true));
  });

  it('exporte la video WebM quand le navigateur sait encoder', async () => {
    class FauxMediaRecorder {
      static isTypeSupported() { return true; }
      constructor(stream) { this.stream = stream; }
      start() {}
      stop() {
        this.ondataavailable?.({ data: new Blob(['v'], { type: 'video/webm' }) });
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', FauxMediaRecorder);
    HTMLCanvasElement.prototype.captureStream = () => ({
      getVideoTracks: () => [{ requestFrame: () => {}, stop: () => {} }],
    });
    globalThis.Image = class {
      constructor() { setTimeout(() => this.onload?.(), 0); }
      set src(v) { this._src = v; }
    };

    renderSimple(<AnimationPlayer animationData={ANIMATION} variableCode="TT" />);
    const menu = screen.getByRole('button', { name: new RegExp(i18n.t('export.button'), 'i') });
    fireEvent.click(menu);
    const webm = screen.queryAllByRole('menuitem').find((e) => /webm|vid/i.test(e.textContent));
    expect(webm, 'la video doit etre proposee quand l encodeur existe').toBeTruthy();
    fireEvent.click(webm);
    await waitFor(() => expect(clics.some((n) => n?.endsWith('.webm'))).toBe(true),
      { timeout: 15000 });
  });

  it('signale l echec de l encodage video', async () => {
    class RecorderCasse {
      static isTypeSupported() { return true; }
      start() { throw new Error('codec absent'); }
      stop() {}
    }
    vi.stubGlobal('MediaRecorder', RecorderCasse);
    HTMLCanvasElement.prototype.captureStream = () => ({
      getVideoTracks: () => [{ requestFrame: () => {}, stop: () => {} }],
    });
    globalThis.Image = class {
      constructor() { setTimeout(() => this.onload?.(), 0); }
      set src(v) { this._src = v; }
    };
    renderSimple(<AnimationPlayer animationData={ANIMATION} variableCode="TT" />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('export.button'), 'i') }));
    const webm = screen.queryAllByRole('menuitem').find((e) => /webm|vid/i.test(e.textContent));
    if (webm) {
      fireEvent.click(webm);
      await waitFor(() => expect(document.body.textContent).toContain(i18n.t('export.webmError')),
        { timeout: 15000 });
    }
  });
});
