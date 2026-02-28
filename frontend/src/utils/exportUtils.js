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
    .catch(() => {});
}

/**
 * Construit un CSV de statistiques par frame (min/max/moyenne)
 * pour une animation diurne et déclenche son téléchargement.
 *
 * @param {number[][][]} frames    - Tableau 3D [frame][lat][lon]
 * @param {string}       variable  - Code de la variable (ex: 'TT')
 * @param {number}       altitude  - Index d'altitude sélectionné
 */
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
