/**
 * Resout la palette de couleurs d'UN resultat de l'Explorer.
 *
 * - mode anomalie (slice) : divergente RdBu centree sur zero
 * - auto : RdBu pour les temperatures, Viridis sinon
 * - choix explicite : option du selecteur de palettes
 *
 * RdBu de Plotly va nativement du bleu (bas) au rouge (haut) : pas d'inversion.
 */
import { useMemo } from 'react';
import { COLORSCALE_OPTIONS, RDBU_VARIABLES, DIVERGING_VARIABLES } from '../../utils/colorscales';

export function useResultColorscale(result, { showAnomaly, colorscale }) {
  return useMemo(() => {
    if (showAnomaly && result?.type === 'slice') {
      return { name: 'RdBu', reverse: false, diverging: true };
    }
    const varCode = result?.params?.variable;
    if (colorscale === 'auto') {
      if (RDBU_VARIABLES.includes(varCode)) return { name: 'RdBu', reverse: false };
      // Champ signé (UU/VV/WW) : divergente centrée sur 0 (flag pour la plage symétrique).
      if (DIVERGING_VARIABLES.includes(varCode)) return { name: 'RdBu', reverse: false, diverging: true };
      return { name: 'Viridis', reverse: false };
    }
    const opt = COLORSCALE_OPTIONS.find(o => o.value === colorscale);
    return { name: opt?.scale || colorscale, reverse: opt?.reverse ?? false };
  }, [colorscale, result, showAnomaly]);
}
