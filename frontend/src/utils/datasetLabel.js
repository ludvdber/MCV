/**
 * Libellé lisible d'un identifiant de dataset, pour l'historique et tout endroit
 * qui ne dispose que de l'id (pas de l'objet catalogue, ex. un permalien ancien
 * dont le dataset n'est plus au catalogue).
 *
 * L'id d'un dataset MEAN est le nom de fichier sans extension, tel qu'il sort de
 * la pipeline : « hl-b274_032094p_ls000_0000_MY35_sol668to739_71days_mean_crossdir »,
 * soit 65 caractères illisibles. On en extrait MY et le Ls de départ pour
 * afficher « MY35 — Ls 0° à 30° » (format i18n partagé avec le sélecteur).
 * Un dataset INDIVIDUAL (IND_MY34_LS5.00) donne « MY34 · Ls 5.00° ».
 * Repli : l'id brut si rien n'est reconnu (jamais de perte d'information).
 */

const IND_RE = /^IND_MY(\d+)_LS([\d.]+)/i;

/* Les deux motifs MEAN sont lus SEPAREMENT, et c'est tout l'objet de la
 * correction. L'ancien motif unique exigeait « MY » AVANT « Ls » :
 *
 *   /MY[_ ]?(\d+).*?Ls[_ ]?(\d+)[_\-.](\d+)/i
 *
 * Or la pipeline GEM-Mars ecrit l'inverse, et le vrai identifiant est
 * « hl-b274_032094p_ls000_0000_MY35_sol668to739_71days_mean_crossdir » :
 * le Ls precede l'annee martienne. Le motif ne mordait donc sur AUCUN jeu
 * reel, et formatDatasetId se repliait silencieusement sur l'id brut, c'est
 * a dire sur les 65 caracteres du nom de fichier, dans l'historique.
 * Il n'etait teste que sur des identifiants inventes (« mean_MY35_Ls60_90 »)
 * qui, eux, respectaient l'ordre suppose. */
const MEAN_MY_RE = /MY[_ ]?(\d+)/i;
const MEAN_LS_RE = /Ls[_ ]?(\d+)[_\-.](\d+)/i;

/* La borne haute n'est PAS lue dans le nom de fichier : elle est calculee,
 * exactement comme le fait CatalogService cote serveur (buildMetadata). Le
 * second groupe du motif Ls vaut « 0000 » dans les vrais noms, ce qui aurait
 * affiche « Ls 0 a 0 ». Les jeux MEAN couvrent une periode fixe de 30 degres,
 * la derniere allant jusqu'a 360. */
const LS_PERIOD = 30;
const LS_MAX = 360;

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
  const my = id.match(MEAN_MY_RE);
  const ls = id.match(MEAN_LS_RE);
  if (my && ls) {
    const lsStart = Number(ls[1]);
    return t('selector.dataset.format', {
      my: Number(my[1]),
      lsStart,
      lsEnd: lsStart === LS_MAX - LS_PERIOD ? LS_MAX : lsStart + LS_PERIOD,
    });
  }
  return id;
}

/* Le nom de fichier d'un export doit dire DE QUEL JEU il vient.
 *
 * Mesuré avant correction : deux tranches de TT au meme pas de temps et a la
 * meme altitude, l'une du printemps nord (Ls 0-30), l'autre de l'ete sud
 * (Ls 270-300), se telechargeaient toutes deux sous « slice_TT_t0_a0.nc ».
 * Le serveur envoyait pourtant un Content-Disposition complet : c'est le
 * frontend qui impose son propre nom (triggerApiDownload), donc l'en-tete
 * n'atteint jamais le disque et le corriger cote serveur ne suffisait pas.
 *
 * On ne met pas l'id complet, qui fait 65 caracteres
 * (« hl-b274_032094p_ls000_0000_MY35_sol668to739_71days_mean_crossdir ») :
 * l'annee martienne et le Ls de depart suffisent a distinguer deux jeux, et
 * tiennent dans un nom de fichier lisible.
 */
const MY_RE = /MY(\d+)/i;
const LS_RE = /ls[_ ]?(\d{3})/i;

/**
 * Jeton court et sûr pour un nom de fichier : « MY35_Ls000 », « MY34_Ls5p00 ».
 * Repli sur l'id assaini plutôt que sur rien : mieux vaut un nom long qu'un nom
 * ambigu.
 *
 * @param {string} id identifiant du dataset (MEAN ou INDIVIDUAL)
 * @returns {string} jeton composé uniquement de [A-Za-z0-9._-]
 */
export function datasetFileToken(id) {
  if (!id) return 'dataset';
  const ind = id.match(IND_RE);
  if (ind) return `MY${ind[1]}_Ls${ind[2].replace('.', 'p')}`;
  const my = id.match(MY_RE);
  const ls = id.match(LS_RE);
  if (my && ls) return `MY${my[1]}_Ls${ls[1]}`;
  return id.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 40);
}
