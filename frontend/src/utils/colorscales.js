/**
 * Palettes de couleurs Plotly disponibles dans toute l'application.
 * Source unique — importée par ExplorePage, SlicePage, AnimationPage.
 *
 * Conventions :
 *  - reverse: true  → palette inversée (données divergentes, températures)
 *  - reverse: false → palette directe
 *  - cvd: true      → perceptuellement uniforme et adaptée au daltonisme
 *
 * Plotly v3 : les palettes Plasma et Inferno ne sont pas enregistrées comme
 * noms de colorscale natifs (contrairement à Viridis). On les fournit donc
 * sous forme de tableaux [[index, "rgb(...)"], ...] extraits de Plotly.
 *
 * Batlow, Vik et Roma sont les « Scientific colour maps » de Fabio Crameri
 * (perceptuellement uniformes, CVD-safe, standard de publication en
 * géosciences). Stops sous-échantillonnés depuis les données officielles
 * (Crameri, F. (2023), Scientific colour maps, Zenodo, doi:10.5281/zenodo.1243862).
 */

const PLASMA = [
  [0,"rgb(13,8,135)"],[0.13,"rgb(75,3,161)"],[0.25,"rgb(125,3,168)"],
  [0.38,"rgb(168,34,150)"],[0.5,"rgb(203,70,121)"],[0.63,"rgb(229,107,93)"],
  [0.75,"rgb(248,148,65)"],[0.88,"rgb(253,195,40)"],[1,"rgb(240,249,33)"],
];

const INFERNO = [
  [0,"rgb(0,0,4)"],[0.13,"rgb(31,12,72)"],[0.25,"rgb(85,15,109)"],
  [0.38,"rgb(136,34,106)"],[0.5,"rgb(186,54,85)"],[0.63,"rgb(227,89,51)"],
  [0.75,"rgb(249,140,10)"],[0.88,"rgb(249,201,50)"],[1,"rgb(252,255,164)"],
];

/** Crameri — séquentielle (magnitudes absolues : température, pression…). */
const BATLOW = [
  [0,"rgb(1,25,89)"],[0.098,"rgb(15,59,95)"],[0.196,"rgb(23,83,98)"],
  [0.294,"rgb(46,103,92)"],[0.392,"rgb(83,116,73)"],[0.49,"rgb(124,128,51)"],
  [0.588,"rgb(172,140,45)"],[0.686,"rgb(218,149,75)"],[0.784,"rgb(248,162,127)"],
  [0.882,"rgb(253,181,183)"],[0.98,"rgb(251,200,238)"],[1,"rgb(250,204,250)"],
];

/** Crameri — divergente à milieu neutre (anomalies, différences A−B).
 *  Exportée : TidesViewer la replie en palette cyclique (phase des marées). */
export const VIK = [
  [0,"rgb(0,17,96)"],[0.098,"rgb(2,56,121)"],[0.196,"rgb(15,97,148)"],
  [0.294,"rgb(80,147,181)"],[0.392,"rgb(160,197,215)"],[0.49,"rgb(232,230,229)"],
  [0.588,"rgb(227,189,167)"],[0.686,"rgb(207,142,104)"],[0.784,"rgb(187,97,46)"],
  [0.882,"rgb(143,42,5)"],[0.98,"rgb(97,5,7)"],[1,"rgb(89,0,7)"],
];

/** Crameri — divergente (inversée ici : bas = bleu, haut = rouge). */
const ROMA = [
  [0,"rgb(125,23,0)"],[0.098,"rgb(150,76,19)"],[0.196,"rgb(170,117,36)"],
  [0.294,"rgb(191,160,65)"],[0.392,"rgb(209,208,126)"],[0.49,"rgb(196,233,190)"],
  [0.588,"rgb(144,221,214)"],[0.686,"rgb(82,184,208)"],[0.784,"rgb(48,142,192)"],
  [0.882,"rgb(33,103,175)"],[0.98,"rgb(12,58,156)"],[1,"rgb(2,48,152)"],
];

/** Stops CSS des palettes nommées Plotly (affichage des swatches uniquement). */
const NAMED_STOPS = {
  Viridis: [[0,"rgb(68,1,84)"],[0.25,"rgb(59,82,139)"],[0.5,"rgb(33,145,140)"],[0.75,"rgb(94,201,98)"],[1,"rgb(253,231,37)"]],
  Cividis: [[0,"rgb(0,34,78)"],[0.25,"rgb(66,77,107)"],[0.5,"rgb(124,123,120)"],[0.75,"rgb(187,173,108)"],[1,"rgb(253,234,69)"]],
  // RdBu de Plotly (Moreland) : bleu (bas) -> gris -> rouge (haut)
  RdBu:    [[0,"rgb(5,10,172)"],[0.35,"rgb(106,137,247)"],[0.5,"rgb(190,190,190)"],[0.7,"rgb(230,145,90)"],[1,"rgb(178,10,28)"]],
  YlOrRd:  [[0,"rgb(255,255,204)"],[0.5,"rgb(253,141,60)"],[1,"rgb(128,0,38)"]],
  Hot:     [[0,"rgb(0,0,0)"],[0.33,"rgb(230,0,0)"],[0.66,"rgb(255,210,0)"],[1,"rgb(255,255,255)"]],
};

export const COLORSCALE_OPTIONS = [
  { value: 'auto',    label: 'Auto' },
  { value: 'Viridis', label: 'Viridis',          reverse: false, cvd: true },
  { value: 'Cividis', label: 'Cividis',          reverse: false, cvd: true },
  { value: 'Batlow',  label: 'Batlow',           reverse: false, scale: BATLOW, cvd: true },
  { value: 'Plasma',  label: 'Plasma',           reverse: false, scale: PLASMA, cvd: true },
  { value: 'Inferno', label: 'Inferno',          reverse: false, scale: INFERNO, cvd: true },
  // reverse:false — le RdBu Plotly est deja bleu(bas)->rouge(haut) ; l'ancienne
  // inversion affichait froid=rouge / chaud=bleu.
  { value: 'RdBu',    label: 'RdBu (divergent)', reverse: false },
  { value: 'Vik',     label: 'Vik (divergent)',  reverse: false, scale: VIK, cvd: true },
  { value: 'Roma',    label: 'Roma (divergent)', reverse: true,  scale: ROMA, cvd: true },
  { value: 'YlOrRd',  label: 'YlOrRd',           reverse: false },
  { value: 'Hot',     label: 'Hot',              reverse: false },
];

/**
 * Dégradé CSS d'une option de palette, dans le sens où elle sera réellement
 * affichée (l'inversion `reverse` est appliquée). null pour 'auto'.
 */
export function swatchGradient(opt) {
  const stops = opt.scale || NAMED_STOPS[opt.value];
  if (!stops) return null;
  const ordered = opt.reverse
    ? [...stops].reverse().map(([p, c]) => [1 - p, c])
    : stops;
  return `linear-gradient(90deg, ${ordered.map(([p, c]) => `${c} ${(p * 100).toFixed(0)}%`).join(', ')})`;
}

/** Variables qui utilisent RdBu par défaut (divergentes — températures). */
export const RDBU_VARIABLES = ['TT', 'MTSF'];

/** Champs SIGNÉS (le zéro sépare deux régimes : est/ouest, nord/sud, montée/
 *  descente). En mode auto ils reçoivent une palette divergente CENTRÉE SUR 0
 *  (plage symétrique ±max) : sinon la couleur neutre tombe au milieu des
 *  données et masque la ligne de changement de signe. */
export const DIVERGING_VARIABLES = ['UU', 'VV', 'WW'];
