/**
 * Palettes de couleurs Plotly disponibles dans toute l'application.
 * Source unique — importée par ExplorePage, SlicePage, AnimationPage.
 *
 * Conventions :
 *  - reverse: true  → palette inversée (données divergentes, températures)
 *  - reverse: false → palette directe
 */
export const COLORSCALE_OPTIONS = [
  { value: 'auto',    label: 'Auto' },
  { value: 'Viridis', label: 'Viridis',          reverse: false },
  { value: 'Plasma',  label: 'Plasma',           reverse: false },
  { value: 'Inferno', label: 'Inferno',          reverse: false },
  { value: 'Cividis', label: 'Cividis',          reverse: false },
  { value: 'RdBu',    label: 'RdBu (divergent)', reverse: true  },
  { value: 'YlOrRd',  label: 'YlOrRd',           reverse: false },
  { value: 'Hot',     label: 'Hot',              reverse: false },
];

/** Variables qui utilisent RdBu par défaut (divergentes — températures). */
export const RDBU_VARIABLES = ['TT', 'MTSF'];
