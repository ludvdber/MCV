/**
 * Palettes de couleurs Plotly disponibles dans toute l'application.
 * Source unique — importée par ExplorePage, SlicePage, AnimationPage.
 *
 * Conventions :
 *  - reverse: true  → palette inversée (données divergentes, températures)
 *  - reverse: false → palette directe
 *
 * Plotly v3 : les palettes Plasma et Inferno ne sont pas enregistrées comme
 * noms de colorscale natifs (contrairement à Viridis). On les fournit donc
 * sous forme de tableaux [[index, "rgb(...)"], ...] extraits de Plotly.
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

export const COLORSCALE_OPTIONS = [
  { value: 'auto',    label: 'Auto' },
  { value: 'Viridis', label: 'Viridis',          reverse: false },
  { value: 'Plasma',  label: 'Plasma',           reverse: false, scale: PLASMA },
  { value: 'Inferno', label: 'Inferno',          reverse: false, scale: INFERNO },
  { value: 'Cividis', label: 'Cividis',          reverse: false },
  { value: 'RdBu',    label: 'RdBu (divergent)', reverse: true  },
  { value: 'YlOrRd',  label: 'YlOrRd',           reverse: false },
  { value: 'Hot',     label: 'Hot',              reverse: false },
];

/** Variables qui utilisent RdBu par défaut (divergentes — températures). */
export const RDBU_VARIABLES = ['TT', 'MTSF'];
