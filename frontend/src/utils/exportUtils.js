/**
 * Utilitaires partagés de téléchargement et d'export CSV.
 * Utilisés par ExplorePage, AnimationPage et tout composant nécessitant
 * de déclencher un téléchargement navigateur.
 */

/**
 * Crée et clique un lien <a> temporaire pour déclencher un téléchargement.
 * Révoque automatiquement l'Object URL après usage.
 *
 * @param {string} url      - URL (blob: ou data:) du fichier à télécharger
 * @param {string} filename - Nom du fichier téléchargé
 */
export function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Déclenche le téléchargement d'une réponse Blob renvoyée par l'API.
 *
 * @param {Promise} promise  - Promesse Axios avec responseType: 'blob'
 * @param {string}  filename - Nom du fichier téléchargé
 * @returns {Promise}
 */
export function triggerApiDownload(promise, filename) {
  return promise
    .then(res => {
      triggerDownload(URL.createObjectURL(res.data), filename);
    })
    .catch(() => {
      // Error is handled by the caller or Axios interceptor
    });
}

/**
 * Construit un CSV de statistiques par frame (min/max/moyenne)
 * pour une animation diurne et déclenche son téléchargement.
 *
 * @param {number[][][]} frames    - Tableau 3D [frame][lat][lon]
 * @param {string}       variable  - Code de la variable (ex: 'TT')
 * @param {number}       altitude  - Index d'altitude sélectionné
 */
/**
 * Generates a PDF report with the chart image, parameters, and statistics.
 * jspdf is lazy-loaded (~90 KB) only when the user clicks "Generate Report".
 *
 * @param {HTMLElement} plotDiv  - The Plotly chart DOM element
 * @param {Object}      meta    - { title, dataset, variable, params: {}, stats: {} }
 * @param {string}      filename - Output filename (without .pdf)
 */
export async function exportPDF(plotDiv, meta, filename = 'mars_report') {
  const [{ jsPDF }, imgData] = await Promise.all([
    import('jspdf'),
    window.Plotly
      ? window.Plotly.toImage(plotDiv, { format: 'png', width: 1200, height: 700 })
      : Promise.resolve(null),
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(18);
  doc.setTextColor(224, 90, 43); // Mars orange
  doc.text('Mars Climate Viewer — Report', 15, 18);

  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text(meta.title || '', 15, 27);
  doc.text(`Dataset: ${meta.dataset || ''}`, 15, 34);
  doc.text(`Variable: ${meta.variable || ''}`, 15, 40);

  // Parameters
  if (meta.params) {
    const paramStr = Object.entries(meta.params)
      .map(([k, v]) => `${k}: ${v}`)
      .join('   |   ');
    doc.text(paramStr, 15, 47);
  }

  // Chart image
  if (imgData) {
    doc.addImage(imgData, 'PNG', 15, 53, w - 30, (w - 30) * 700 / 1200);
  }

  // Statistics
  if (meta.stats) {
    const statsY = imgData ? 53 + (w - 30) * 700 / 1200 + 8 : 55;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const statsStr = Object.entries(meta.stats)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(4) : v}`)
      .join('   |   ');
    doc.text(statsStr, 15, statsY);

    // Footer
    doc.text(`Generated ${new Date().toISOString().slice(0, 19)} — Mars Climate Viewer`, 15, statsY + 7);
  }

  doc.save(`${filename}.pdf`);
}

export function downloadAnimationCSV(frames, variable, altitude) {
  const nFrames = frames.length;
  const stepH = 24 / nFrames;
  const header = `timestep,heure_martienne_h,${variable}_min,${variable}_max,${variable}_mean`;
  const rows = frames.map((frame, i) => {
    // Iteration directe pour eviter frame.flat() qui cree un tableau intermediaire
    // et Math.min/max(...flat) qui peut provoquer un stack overflow sur les grands grids.
    let min = Infinity, max = -Infinity, sum = 0, count = 0;
    for (const row of frame) {
      for (const v of row) {
        if (v < min) min = v;
        if (v > max) max = v;
        sum += v;
        count++;
      }
    }
    return [
      i,
      ((i + 1) * stepH).toFixed(2),
      min.toFixed(4),
      max.toFixed(4),
      (sum / count).toFixed(4),
    ].join(',');
  });
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(URL.createObjectURL(blob), `animation_${variable}_alt${altitude}.csv`);
}

/**
 * Export a Plotly animation as an animated GIF.
 * Captures each frame as PNG, assembles into GIF using gif.js (lazy-loaded).
 *
 * @param {HTMLElement} plotDiv - The Plotly chart DOM element
 * @param {number} frameCount - Number of frames to capture
 * @param {Function} renderFrame - async (frameIndex) => void — function that displays frame i
 * @param {string} filename - Output filename
 * @param {Function} onProgress - (percent: number) => void — progress callback
 */
export async function exportAnimationGIF(plotDiv, frameCount, renderFrame, filename = 'mars_animation', onProgress = () => {}) {
  const GIF = (await import('gif.js')).default;

  const gif = new GIF({
    workers: 2,
    quality: 10,
    width: plotDiv.offsetWidth,
    height: plotDiv.offsetHeight,
    workerScript: new URL('/gif.worker.js', import.meta.url).href,
  });

  for (let i = 0; i < frameCount; i++) {
    await renderFrame(i);
    // Small delay for Plotly to finish rendering
    await new Promise(r => setTimeout(r, 50));
    const dataUrl = await window.Plotly.toImage(plotDiv, {
      format: 'png',
      width: plotDiv.offsetWidth,
      height: plotDiv.offsetHeight,
    });
    const img = new Image();
    img.src = dataUrl;
    await new Promise(r => { img.onload = r; });
    gif.addFrame(img, { delay: 150 });
    onProgress(Math.round(((i + 1) / frameCount) * 100));
  }

  return new Promise((resolve) => {
    gif.on('finished', (blob) => {
      triggerDownload(URL.createObjectURL(blob), `${filename}.gif`);
      resolve();
    });
    gif.render();
  });
}
