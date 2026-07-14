/**
 * Export video WebM d'une animation diurne — API MediaRecorder du navigateur,
 * zero dependance externe (remplace la piste gif.js abandonnee, bibliotheque
 * morte identifiee a l'audit).
 *
 * Pipeline en deux temps :
 *   1. rendu : clone hors ecran en theme clair (buildLightClone), une image
 *      PNG par pas de temps (restyle du z + horodatage, puis toImage) ;
 *   2. encodage : les images sont dessinees sur un canvas capture par
 *      MediaRecorder (captureStream + requestFrame), cadencees a `fps`.
 *
 * Le graphique VISIBLE n'est jamais touche.
 */
import Plotly from '../plotlyBundle';
import { buildLightClone } from './plotExport';

/** L'encodage WebM est-il disponible dans ce navigateur ? */
export function webmSupported() {
  return typeof MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement.prototype.captureStream === 'function'
    && !!pickMimeType();
}

function pickMimeType() {
  for (const m of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return null;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * @param {HTMLElement} gd      div Plotly de l'animation (frame courante affichee)
 * @param {number[][][]} frames matrices z PRETES A L'AFFICHAGE (log deja applique si actif)
 * @param {Object} opts
 *   fps        — cadence de la video (defaut 8 → 48 pas = 6 s)
 *   width/height — resolution de sortie
 *   title      — titre a imposer au clone (vues compactes sans titre)
 *   timeLabel  — (i) => string : horodatage incruste en bas a droite
 *   x/y        — coords NATIVES a imposer a la trace heatmap : les `frames` sont
 *                a la resolution native, le graphe visible peut etre interpole
 *   onProgress — (0..1) avancement
 * @returns {Promise<Blob>} la video WebM
 */
export async function exportAnimationWebM(gd, frames, {
  fps = 8, width = 1280, height = 720, title = null, timeLabel = null,
  x = null, y = null, onProgress = null,
} = {}) {
  const mimeType = pickMimeType();
  if (!mimeType) throw new Error('WebM not supported');

  /* ── 1. Rendu des images ─────────────────────────────────────────────── */
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;left:-9999px;top:0;width:${width}px;height:${height}px;visibility:hidden;`;
  document.body.appendChild(el);

  const images = [];
  try {
    const clone = buildLightClone(gd);
    clone.data = clone.data.map((t, i) => {
      const nt = { ...t };
      if ('showscale' in nt && nt.showscale === false) nt.showscale = true;
      if (i === 0) {
        // Trace heatmap : coords natives fournies (les frames rejouees sont
        // natives) + purge du hover (staticPlot → inutile, et sa taille
        // interpolee ne collerait plus au z natif restyle → frames desalignees).
        if (x) nt.x = x;
        if (y) nt.y = y;
        nt.customdata = undefined;
        nt.text = undefined;
        nt.hovertext = undefined;
      }
      return nt;
    });
    const layout = { ...clone.layout, width, height };
    if (title && !layout.title?.text) {
      layout.title = { text: title, font: { color: '#222222', size: 18 } };
      layout.margin = { ...(layout.margin ?? {}), t: 60 };
    }
    layout.annotations = [...(layout.annotations ?? []), {
      text: '', xref: 'paper', yref: 'paper', x: 0.99, y: 0.02,
      xanchor: 'right', yanchor: 'bottom', showarrow: false,
      font: { size: 20, color: '#222222' },
      bgcolor: 'rgba(255,255,255,0.8)', borderpad: 5,
    }];
    const annIdx = layout.annotations.length - 1;

    await Plotly.newPlot(el, clone.data, layout, { staticPlot: true, responsive: false });

    for (let i = 0; i < frames.length; i++) {
      await Plotly.restyle(el, { z: [frames[i]] }, [0]);
      if (timeLabel) {
        await Plotly.relayout(el, { [`annotations[${annIdx}].text`]: timeLabel(i) });
      }
      const url = await Plotly.toImage(el, { format: 'png', width, height });
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      images.push(img);
      onProgress?.((i + 1) / frames.length * 0.8);
    }
  } finally {
    Plotly.purge(el);
    document.body.removeChild(el);
  }

  /* ── 2. Encodage WebM ────────────────────────────────────────────────── */
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  // requestFrame vit sur la piste (Chrome/standard) ou sur le flux (Firefox,
  // historique) : router vers celui qui l'implemente, sinon captureStream(0) ne
  // capture jamais et la WebM sort vide/noire pendant que l'UI annonce un succes.
  const requestFrame = () => {
    if (typeof track.requestFrame === 'function') track.requestFrame();
    else if (typeof stream.requestFrame === 'function') stream.requestFrame();
  };
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });

  recorder.start();
  const frameMs = 1000 / fps;
  for (let i = 0; i < images.length; i++) {
    ctx.drawImage(images[i], 0, 0, width, height);
    requestFrame();
    await sleep(frameMs);
    onProgress?.(0.8 + (i + 1) / images.length * 0.2);
  }
  // Derniere image tenue un instant pour que l'encodeur la scelle.
  requestFrame();
  await sleep(frameMs);
  recorder.stop();
  await stopped;
  track.stop();

  return new Blob(chunks, { type: 'video/webm' });
}

/** Telecharge un blob video sous le nom donne. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
