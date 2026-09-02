/**
 * Resout la palette de couleurs d'UN resultat de l'Explorer.
 *
 * - mode anomalie (slice) : divergente RdBu centree sur zero
 * - auto : delegue a autoColorscaleFor (sequentielle pour les temperatures)
 * - choix explicite : option du selecteur de palettes
 *
 * RdBu de Plotly va nativement du bleu (bas) au rouge (haut) : pas d'inversion.
 */
import { useMemo } from 'react';
import { COLORSCALE_OPTIONS, DIVERGING_VARIABLES, autoColorscaleFor } from '../../utils/colorscales';

export function useResultColorscale(result, { showAnomaly, colorscale }) {
  return useMemo(() => {
    if (showAnomaly && result?.type === 'slice') {
      return { name: 'RdBu', reverse: false, diverging: true };
    }
    const varCode = result?.params?.variable;
    if (colorscale === 'auto') {
      // Champ signé (UU/VV/WW) : divergente centrée sur 0 (flag pour la plage symétrique).
      if (DIVERGING_VARIABLES.includes(varCode)) return { name: 'RdBu', reverse: false, diverging: true };
      return { name: autoColorscaleFor(varCode), reverse: false };
    }
    const opt = COLORSCALE_OPTIONS.find(o => o.value === colorscale);
    return { name: opt?.scale || colorscale, reverse: opt?.reverse ?? false };
  }, [colorscale, result, showAnomaly]);
}
