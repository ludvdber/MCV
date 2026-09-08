import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildLightClone, applyPublication, exportPlotImage, exportGridMontage, FIGURE_CREDIT,
} from './plotExport';
import { webmSupported, exportAnimationWebM, downloadBlob } from './videoExport';
import { makePlanetTexture, makeEarthTexture, makeSunTexture } from './planetTextures';
import { installCanvas2D, dessins } from '../test/harness';
import { resetPlotly, callsOf, lastCall } from '../test/plotlyStub';

/**
 * Toute la chaine d'export d'images et de video. Le point commun de ces trois
 * modules : ils fabriquent un rendu HORS ECRAN et ne doivent JAMAIS toucher au
 * graphique visible — une figure exportee ne vaut rien si l'export abime la
 * vue depuis laquelle on l'a demandee.
 */
let desinstallerCanvas;
const ImageOrigine = globalThis.Image;

/** jsdom ne charge aucune image : on declenche `onload` au prochain tick. */
function installImage() {
  globalThis.Image = class {
    constructor() {
      this.width = 0; this.height = 0;
      setTimeout(() => this.onload?.(), 0);
    }
    set src(v) { this._src = v; }
    get src() { return this._src; }
  };
}

beforeEach(() => {
  resetPlotly();
  desinstallerCanvas = installCanvas2D();
  installImage();
});

afterEach(() => {
  desinstallerCanvas();
  globalThis.Image = ImageOrigine;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Faux div Plotly : ce que `gd.data` / `gd.layout` exposent apres un trace. */
const grapheSombre = () => ({
  data: [{
    type: 'heatmap', z: [[1, 2], [3, 4]],
    colorbar: { title: { text: 'TT (K)', font: { color: '#fff' } }, tickfont: { color: '#fff' } },
  }],
  layout: {
    title: { text: 'Un titre', font: { color: '#ffffff' } },
    font: { color: '#ffffff' },
    legend: { font: { color: '#ffffff' } },
    xaxis: { title: { text: 'Longitude', font: { color: '#fff' } }, tickfont: { color: '#fff' } },
    yaxis: { title: 'Latitude' },
    annotations: [{ text: 'note', font: { color: '#fff' } }],
    paper_bgcolor: 'rgba(0,0,0,0)',
    margin: { l: 70, r: 30, t: 80, b: 64 },
  },
  _fullLayout: { _size: { l: 70, t: 80, w: 800, h: 500 }, xaxis: { range: [-180, 180] }, yaxis: { range: [-90, 90] } },
});

describe('buildLightClone', () => {
  it('ramene tous les fonds et toutes les encres au theme clair', () => {
    const { layout } = buildLightClone(grapheSombre());
    expect(layout.paper_bgcolor).toBe('white');
    expect(layout.font.color).toBe('#222222');
    expect(layout.title.font.color).toBe('#222222');
    expect(layout.legend.font.color).toBe('#222222');
    expect(layout.xaxis.color).toBe('#222222');
    expect(layout.xaxis.title.font.color).toBe('#222222');
    expect(layout.annotations[0].font.color).toBe('#222222');
  });

  it('accepte un titre sous forme de simple chaine', () => {
    const gd = grapheSombre();
    gd.layout.title = 'Titre brut';
    const { layout } = buildLightClone(gd);
    expect(layout.title).toEqual({ text: 'Titre brut', font: { color: '#222222' } });
  });

  it('laisse un titre d axe en chaine tel quel', () => {
    const { layout } = buildLightClone(grapheSombre());
    expect(layout.yaxis.title).toBe('Latitude');
  });

  it('recolore les colorbars', () => {
    const { data } = buildLightClone(grapheSombre());
    expect(data[0].colorbar.title.font.color).toBe('#222222');
    expect(data[0].colorbar.tickfont.color).toBe('#222222');
  });

  it('accepte une colorbar dont le titre est une chaine', () => {
    const gd = grapheSombre();
    gd.data[0].colorbar = { title: 'TT (K)' };
    const { data } = buildLightClone(gd);
    expect(data[0].colorbar.title).toEqual({ text: 'TT (K)', font: { color: '#222222' } });
  });

  it('CLONE chaque trace, meme sans colorbar', () => {
    // Plotly.newPlot ecrit uid/_input sur les objets qu on lui passe : rendre
    // la trace par reference laisserait l export muter le graphe VISIBLE.
    const gd = grapheSombre();
    gd.data.push({ type: 'scatter', x: [1], y: [2] });
    const { data } = buildLightClone(gd);
    expect(data[1]).not.toBe(gd.data[1]);
    expect(data[0]).not.toBe(gd.data[0]);
  });

  it('ne modifie pas la mise en page d origine', () => {
    const gd = grapheSombre();
    buildLightClone(gd);
    expect(gd.layout.paper_bgcolor).toBe('rgba(0,0,0,0)');
    expect(gd.layout.font.color).toBe('#ffffff');
  });

  it('tient sur un graphe vide', () => {
    expect(() => buildLightClone({})).not.toThrow();
    expect(buildLightClone({}).data).toEqual([]);
  });
});

describe('applyPublication', () => {
  const pub = {
    title: 'Temperature', subtitle: 'MY35 Ls 0-30', credit: 'Credit IASB',
    xTitle: 'Longitude', yTitle: 'Latitude',
  };

  it('compose titre et sous-titre sur deux lignes', () => {
    const clone = buildLightClone(grapheSombre());
    applyPublication(clone, pub);
    expect(clone.layout.title.text).toBe('Temperature<br><sub>MY35 Ls 0-30</sub>');
  });

  it('se passe de sous-titre', () => {
    const clone = buildLightClone(grapheSombre());
    applyPublication(clone, { ...pub, subtitle: null });
    expect(clone.layout.title.text).toBe('Temperature');
  });

  it('REAFFICHE la colorbar qu une vue compacte avait masquee', () => {
    const gd = grapheSombre();
    gd.data[0].showscale = false;
    const clone = buildLightClone(gd);
    applyPublication(clone, pub);
    expect(clone.data[0].showscale).toBe(true);
  });

  it('n ecrase pas un titre d axe deja present', () => {
    const clone = buildLightClone(grapheSombre());
    applyPublication(clone, pub);
    expect(clone.layout.xaxis.title.text).toBe('Longitude');
    // L axe Y n avait qu une chaine : elle compte comme un titre existant.
    expect(clone.layout.yaxis.title).toBe('Latitude');
  });

  it('pose un titre d axe manquant', () => {
    const gd = grapheSombre();
    delete gd.layout.xaxis.title;
    const clone = buildLightClone(gd);
    applyPublication(clone, pub);
    expect(clone.layout.xaxis.title.text).toBe('Longitude');
  });

  it('ajoute le credit demande sous la figure', () => {
    const clone = buildLightClone(grapheSombre());
    applyPublication(clone, pub);
    expect(clone.layout.annotations.some((a) => a.text === 'Credit IASB')).toBe(true);
    expect(clone.layout.margin.b).toBeGreaterThanOrEqual(110);
  });
});

describe('exportPlotImage', () => {
  it('rend hors ecran, produit une image, puis nettoie', async () => {
    const gd = grapheSombre();
    const avant = document.body.childElementCount;
    const url = await exportPlotImage(gd, 'png', { width: 800, height: 600 });
    expect(url.startsWith('data:image/png')).toBe(true);
    // Le div hors ecran est retire et le graphe purge : sinon chaque export
    // laisse un graphe Plotly complet en memoire.
    expect(document.body.childElementCount).toBe(avant);
    expect(callsOf('purge').length).toBeGreaterThanOrEqual(1);
  });

  it('NE TOUCHE PAS au graphe visible', () => {
    const gd = grapheSombre();
    const cible = callsOf('newPlot').map((c) => c.el);
    expect(cible).not.toContain(gd);
  });

  it('porte le credit sur un export ordinaire', async () => {
    await exportPlotImage(grapheSombre(), 'png', {});
    const annotations = lastCall('newPlot').layout.annotations;
    expect(annotations.some((a) => a.text === FIGURE_CREDIT)).toBe(true);
  });

  it('ne double PAS le credit en mode publication', async () => {
    // Le mode publication porte sa propre mention, plus complete.
    await exportPlotImage(grapheSombre(), 'png', {
      publication: { title: 'T', credit: 'Credit IASB' },
    });
    const annotations = lastCall('newPlot').layout.annotations;
    expect(annotations.filter((a) => a.text === FIGURE_CREDIT)).toHaveLength(0);
    expect(annotations.some((a) => a.text === 'Credit IASB')).toBe(true);
  });

  it('decale le credit en PIXELS, pas en fraction de la zone de trace', () => {
    // Une fraction depend de la hauteur : sur une figure basse, le texte
    // sortait de la marge et etait rogne.
    return exportPlotImage(grapheSombre(), 'png', {}).then(() => {
      const credit = lastCall('newPlot').layout.annotations.find((a) => a.text === FIGURE_CREDIT);
      expect(credit.yshift).toBe(-34);
      expect(credit.yref).toBe('paper');
    });
  });

  it('reserve assez de marge basse pour le credit', async () => {
    const gd = grapheSombre();
    gd.layout.margin = { b: 10 };
    await exportPlotImage(gd, 'png', {});
    expect(lastCall('newPlot').layout.margin.b).toBeGreaterThanOrEqual(56);
  });

  it('rend le clone en graphe STATIQUE', async () => {
    // Un clone interactif installerait des ecouteurs pour rien.
    await exportPlotImage(grapheSombre(), 'png', {});
    expect(lastCall('newPlot').config).toMatchObject({ staticPlot: true, responsive: false });
  });

  it('recalcule les fleches de vent a la geometrie de l IMAGE', async () => {
    // Une figure 1920x1080 n a pas la forme de l ecran : sans ce recalcul,
    // les fleches porteraient l angle du cadre affiche.
    const gd = grapheSombre();
    gd.data.push({
      type: 'scatter', mode: 'lines', x: [0], y: [0],
      meta: { quiver: { lats: [0, 10], lons: [0, 10], u: [5, 5], v: [1, 1] } },
    });
    await exportPlotImage(gd, 'png', { width: 1920, height: 1080 });
    expect(callsOf('restyle').length).toBeGreaterThanOrEqual(1);
  });

  it('nettoie meme si Plotly echoue', async () => {
    const avant = document.body.childElementCount;
    const gd = grapheSombre();
    // On force un echec au trace : le `finally` doit quand meme retirer le div.
    gd.data = null;
    Object.defineProperty(gd, 'data', { get() { throw new Error('boom'); } });
    await expect(exportPlotImage(gd, 'png', {})).rejects.toThrow();
    expect(document.body.childElementCount).toBe(avant);
  });
});

describe('exportGridMontage', () => {
  const cellule = (titre) => ({ gd: grapheSombre(), title: titre, context: 'MY35 · Ls 0-30' });

  it('compose une image unique a partir de plusieurs cellules', async () => {
    const url = await exportGridMontage(
      [cellule('a'), cellule('b'), cellule('c')],
      { title: 'Montage', credit: 'IASB' },
    );
    expect(url.startsWith('data:image/png')).toBe(true);
    // Une image par cellule + les etiquettes + le titre + le credit.
    const journal = dessins[dessins.length - 1].journal;
    expect(journal.filter((a) => a.m === 'drawImage')).toHaveLength(3);
  });

  it('etiquette chaque cellule d une lettre, comme une figure d article', async () => {
    await exportGridMontage([cellule('Coupe'), cellule('Profil')], { title: 'M', credit: 'c' });
    const journal = dessins[dessins.length - 1].journal;
    const textes = journal.filter((a) => a.m === 'fillText').map((a) => a.args[0]);
    expect(textes.some((t) => t.startsWith('a) Coupe'))).toBe(true);
    expect(textes.some((t) => t.startsWith('b) Profil'))).toBe(true);
  });

  it('passe sur une seule colonne quand il n y a qu une cellule', async () => {
    await exportGridMontage([cellule('seule')], { title: 'M', credit: 'c' });
    const canvas = dessins[dessins.length - 1].canvas;
    expect(canvas.width).toBeLessThan(1200);
  });
});

describe('videoExport', () => {
  it('se declare indisponible quand MediaRecorder manque', () => {
    // C est le cas de Safari sur iOS : le bouton doit disparaitre plutot que
    // de produire une video vide.
    expect(webmSupported()).toBe(false);
  });

  it('se declare disponible quand le navigateur a tout ce qu il faut', () => {
    vi.stubGlobal('MediaRecorder', class { static isTypeSupported() { return true; } });
    HTMLCanvasElement.prototype.captureStream = function captureStream() { return {}; };
    expect(webmSupported()).toBe(true);
    delete HTMLCanvasElement.prototype.captureStream;
    vi.unstubAllGlobals();
  });

  it('refuse d exporter sans encodeur plutot que de rendre un fichier vide', async () => {
    await expect(exportAnimationWebM(grapheSombre(), [[[1]]])).rejects.toThrow('WebM not supported');
  });

  it('telecharge un blob sous le nom demande et revoque son URL', () => {
    vi.useFakeTimers();
    const clics = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function spy() {
      clics.push({ href: this.getAttribute('href'), download: this.getAttribute('download') });
    });
    URL.createObjectURL = vi.fn(() => 'blob:video');
    URL.revokeObjectURL = vi.fn();
    downloadBlob(new Blob(['x']), 'anim.webm');
    expect(clics).toEqual([{ href: 'blob:video', download: 'anim.webm' }]);
    // La revocation est DIFFEREE : revoquer tout de suite annulerait le
    // telechargement en cours sur certains navigateurs.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:video');
  });
});

describe('planetTextures', () => {
  it('produit une texture pour chaque type de planete', () => {
    for (const type of ['rocky', 'gas', 'ice', 'mars', 'inconnu']) {
      const tex = makePlanetTexture({ base: '#c1440e', type, seed: 3 });
      expect(tex, type).toBeTruthy();
    }
  });

  it('est DETERMINISTE : la meme graine peint la meme chose', () => {
    // Les textures sont generees, pas chargees : sans determinisme, chaque
    // rechargement de l accueil donnerait une planete differente.
    dessins.length = 0;
    makePlanetTexture({ base: '#c1440e', type: 'rocky', seed: 42 });
    const premier = dessins[dessins.length - 1].journal.map((a) => JSON.stringify(a));
    dessins.length = 0;
    makePlanetTexture({ base: '#c1440e', type: 'rocky', seed: 42 });
    const second = dessins[dessins.length - 1].journal.map((a) => JSON.stringify(a));
    expect(second).toEqual(premier);
  });

  it('deux graines differentes donnent deux textures differentes', () => {
    dessins.length = 0;
    makePlanetTexture({ base: '#c1440e', type: 'rocky', seed: 1 });
    const a = dessins[dessins.length - 1].journal.map((x) => JSON.stringify(x));
    dessins.length = 0;
    makePlanetTexture({ base: '#c1440e', type: 'rocky', seed: 2 });
    const b = dessins[dessins.length - 1].journal.map((x) => JSON.stringify(x));
    expect(b).not.toEqual(a);
  });

  it('peint la Terre et le Soleil', () => {
    expect(makeEarthTexture(7)).toBeTruthy();
    expect(makeSunTexture(11)).toBeTruthy();
  });
});
