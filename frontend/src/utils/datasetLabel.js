/**
 * Libellé lisible d'un identifiant de dataset, pour l'historique et tout endroit
 * qui ne dispose que de l'id (pas de l'objet catalogue, ex. un permalien ancien
 * dont le dataset n'est plus au catalogue).
 *
 * L'id d'un dataset MEAN est le nom de fichier sans extension, tel qu'il sort de
 * la pipeline (« mean_MY35_Ls60_90 ») : illisible. On en extrait MY et la plage
 * Ls pour afficher « MY35 — Ls 60° à 90° » (format i18n partagé avec le
 * sélecteur). Un dataset INDIVIDUAL (IND_MY34_LS5.00) donne « MY34 · Ls 5.00° ».
 * Repli : l'id brut si rien n'est reconnu (jamais de perte d'information).
 */

const IND_RE  = /^IND_MY(\d+)_LS([\d.]+)/i;
const MEAN_RE = /MY[_ ]?(\d+).*?Ls[_ ]?(\d+)[_\-.](\d+)/i;

/**
 * @param {string} id  identifiant du dataset (MEAN ou INDIVIDUAL)
 * @param {Function} t  fonction i18n (react-i18next)
 * @returns {string}   libellé lisible, ou l'id brut si non reconnu
 */
export function formatDatasetId(id, t) {
  if (!id) return '';
  const ind = id.match(IND_RE);
  if (ind) {
    const ls = parseFloat(ind[2]);
    return `MY${ind[1]} · Ls ${Number.isFinite(ls) ? ls.toFixed(2) : ind[2]}°`;
  }
  const m = id.match(MEAN_RE);
  if (m) {
    return t('selector.dataset.format', {
      my: Number(m[1]), lsStart: Number(m[2]), lsEnd: Number(m[3]),
    });
  }
  return id;
}
