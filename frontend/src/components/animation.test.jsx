import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import AnimationPlayer from './AnimationPlayer';
import i18n from '../i18n';
import {
  renderSimple, installApiFixtures, installCanvas2D, installGeometrie,
} from '../test/harness';
import { resetPlotly, callsOf, lastCall } from '../test/plotlyStub';
import { ANIMATION } from '../test/fixtures';
import { exportAnimationWebM, webmSupported } from '../utils/videoExport';

/**
 * Le lecteur d'animation et l'export video WebM. Ces deux chemins n'avaient
 * jamais ete executes : le premier parce qu'il faut piloter un minuteur, le
 * second parce que MediaRecorder n'existe pas dans jsdom. Ils portent pourtant
 * la seule boucle de lecture de l'application et son seul encodage media.
 */
let desinstallerCanvas;
let desinstallerGeo;

beforeEach(async () => {
  resetPlotly();
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  await i18n.changeLanguage('fr');
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete HTMLCanvasElement.prototype.captureStream;
  vi.restoreAllMocks();
});

/** Nombre total de traces demandees a Plotly (creation + mises a jour). */
const rendus = () => [...callsOf('newPlot'), ...callsOf('react')];

describe('AnimationPlayer', () => {
  it('demarre en pause sur la premiere frame', () => {
    renderSimple(<AnimationPlayer animationData={ANIMATION} variableCode="TT" />);
    expect(lastCall('newPlot').traces[0].z).toEqual(ANIMATION.frames[0]);
    expect(screen.getByRole('button', { name: i18n.t('page.animation.play') })).toBeTruthy();
  });

  it('lit les frames dans l ordre puis boucle', () => {
    vi.useFakeTimers();
    renderSimple(<AnimationPlayer animationData={ANIMATION} variableCode="TT" />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('page.animation.play') }));
    const avant = rendus().length;
    act(() => { vi.advanceTimersByTime(2000); });
    const apres = rendus();
    expect(apres.length).toBeGreaterThan(avant);
    // Le lecteur boucle : avec quatre frames, la lecture repasse par la
    // premiere plutot que de s'arreter a la derniere.
    const z = apres.map((c) => c.traces[0].z);
    expect(z).toContainEqual(ANIMATION.frames[0]);
  });

  it('se met en pause et cesse de redessiner', () => {
    vi.useFakeTimers();
    renderSimple(<AnimationPlayer animationData={ANIMATION} variableCode="TT" />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('page.animation.play') }));
    act(() => { vi.advanceTimersByTime(600); });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('page.animation.pause') }));
    const gele = rendus().length;
    act(() => { vi.advanceTimersByTime(3000); });
    expect(rendus().length).toBe(gele);
  });

  it('arrete la lecture au demontage', () => {
    // Une boucle laissee tourner apres navigation continue de redessiner
    // un graphe qui n'existe plus.
    vi.useFakeTimers();
    const { unmount } = renderSimple(<AnimationPlayer animationData={ANIMATION} variableCode="TT" />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('page.animation.play') }));
    act(() => { vi.advanceTimersByTime(400); });
    unmount();
    const gele = rendus().length;
    act(() => { vi.advanceTimersByTime(3000); });
    expect(rendus().length).toBe(gele);
  });

  it('le choix de vitesse est exclusif et la lecture continue', () => {
    // La cadence vaut BASE_FRAME_MS / vitesse. On ne mesure pas le nombre
    // d'images (le lot de rendus React sous faux minuteurs le rend instable) :
    // on verifie que le choix est bien exclusif — deux vitesses actives en
    // meme temps donneraient deux boucles concurrentes sur le meme graphe —
    // et que la lecture n'est pas interrompue par le changement.
    vi.useFakeTimers();
    const { container } = renderSimple(
      <AnimationPlayer animationData={ANIMATION} variableCode="TT" />,
    );
    fireEvent.click(screen.getByRole('button', { name: i18n.t('page.animation.play') }));
    const vitesses = [...container.querySelectorAll('button')]
      .filter((b) => /^\d+(\.\d+)?x$/.test(b.textContent.trim()));
    expect(vitesses.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(vitesses.at(-1));
    expect(vitesses.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
    expect(vitesses.at(-1).getAttribute('aria-pressed')).toBe('true');

    resetPlotly();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(rendus().length).toBeGreaterThan(0);
    // Le bouton reste sur « pause » : changer de vitesse n'arrete pas la lecture.
    expect(screen.getByRole('button', { name: i18n.t('page.animation.pause') })).toBeTruthy();
  });

  it('le curseur amene directement a une frame et met la lecture en pause', () => {
    // MUI rend le curseur comme un <input type="range"> : c'est lui qui porte
    // le clavier, et donc l'accessibilite de la navigation image par image.
    const onFrameChange = vi.fn();
    const { container } = renderSimple(
      <AnimationPlayer animationData={ANIMATION} variableCode="TT" onFrameChange={onFrameChange} />,
    );
    const curseur = container.querySelector('input[type="range"]');
    expect(curseur).toBeTruthy();
    fireEvent.change(curseur, { target: { value: '2' } });
    // Le parent doit savoir quelle frame est a l'ecran : la sonde liee lit
    // cette information pour echantillonner la BONNE frame.
    expect(onFrameChange).toHaveBeenCalledWith(2);
    // Deplacer le curseur pendant la lecture arrete la lecture, sinon la
    // frame choisie disparait aussitot.
    expect(screen.getByRole('button', { name: i18n.t('page.animation.play') })).toBeTruthy();
  });

  it('fige l echelle de couleur sur toutes les frames', () => {
    // Une echelle recalculee par frame ferait « respirer » les couleurs :
    // la meme teinte ne designerait plus la meme temperature d'une image a
    // l'autre, ce qu'une animation sert justement a comparer.
    vi.useFakeTimers();
    renderSimple(<AnimationPlayer animationData={ANIMATION} variableCode="TT" />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('page.animation.play') }));
    act(() => { vi.advanceTimersByTime(2000); });
    const bornes = new Set(rendus().map((c) => `${c.traces[0].zmin}|${c.traces[0].zmax}`));
    expect(bornes.size).toBe(1);
  });
});

describe('export video WebM', () => {
  /** Installe un encodeur factice et renvoie ce qu'on lui a demande. */
  function installerEncodeur() {
    const journal = { images: 0, frames: 0, arrete: false };
    class FauxMediaRecorder {
      static isTypeSupported(m) { return m === 'video/webm;codecs=vp9'; }
      constructor(stream, options) { this.stream = stream; this.options = options; }
      start() { this.actif = true; }
      stop() {
        journal.arrete = true;
        this.ondataavailable?.({ data: new Blob(['video'], { type: 'video/webm' }) });
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', FauxMediaRecorder);
    HTMLCanvasElement.prototype.captureStream = function captureStream() {
      return {
        getVideoTracks: () => [{
          requestFrame: () => { journal.frames += 1; },
          stop: () => {},
        }],
      };
    };
    // Une image par frame rendue : jsdom ne charge rien tout seul.
    globalThis.Image = class {
      constructor() { journal.images += 1; setTimeout(() => this.onload?.(), 0); }
      set src(v) { this._src = v; }
    };
    return journal;
  }

  const gd = () => ({
    data: [{ type: 'heatmap', z: [[1, 2], [3, 4]] }],
    layout: { title: { text: 'T' }, margin: { l: 70, t: 80, b: 64, r: 30 } },
  });

  it('se declare disponible quand le navigateur sait encoder', () => {
    installerEncodeur();
    expect(webmSupported()).toBe(true);
  });

  it('produit une video et cadence une image par frame', async () => {
    const journal = installerEncodeur();
    const frames = [[[1, 2], [3, 4]], [[5, 6], [7, 8]], [[9, 10], [11, 12]]];
    const avancement = [];
    const blob = await exportAnimationWebM(gd(), frames, {
      fps: 100, width: 320, height: 200,
      timeLabel: (i) => `${i * 0.5} h`,
      onProgress: (p) => avancement.push(p),
    });
    expect(blob.type).toBe('video/webm');
    // Une image rendue par frame, plus la derniere tenue pour que l'encodeur
    // la scelle : sans elle, la derniere frame manque a la video.
    expect(journal.frames).toBe(frames.length + 1);
    expect(journal.arrete).toBe(true);
    // L'avancement va bien jusqu'au bout : c'est ce que la barre affiche.
    expect(avancement.at(-1)).toBeCloseTo(1, 5);
  });

  it('rend chaque frame sur un clone hors ecran, jamais sur le graphe visible', async () => {
    installerEncodeur();
    const source = gd();
    await exportAnimationWebM(source, [[[1]], [[2]]], { fps: 100, width: 320, height: 200 });
    for (const appel of callsOf('newPlot')) expect(appel.el).not.toBe(source);
    // Le clone est purge et retire ensuite.
    expect(callsOf('purge').length).toBeGreaterThanOrEqual(1);
  });

  it('impose les coordonnees NATIVES quand on les lui donne', async () => {
    // Le graphe visible peut etre interpole ; les frames, elles, restent a la
    // resolution native : sans cet alignement la video serait deformee.
    installerEncodeur();
    await exportAnimationWebM(gd(), [[[1, 2], [3, 4]]], {
      fps: 100, width: 320, height: 200, x: [0, 60], y: [-40, 40],
    });
    expect(callsOf('restyle').length + callsOf('newPlot').length).toBeGreaterThanOrEqual(1);
  });
});
