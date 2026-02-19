import { useMemo } from 'react';
import { COLORSCALE_OPTIONS, RDBU_VARIABLES } from '../utils/colorscales';

/**
 * Resout la palette de couleurs effective a partir du choix utilisateur.
 * En mode 'auto', utilise RdBu pour les variables de temperature, Viridis sinon.
 * Remplace le useMemo identique dans SlicePage, AnimationPage et CrossSectionPage.
 *
 * @param {string} colorscale       - valeur du selecteur ('auto' ou nom Plotly)
 * @param {string|null} displayedVar - variable actuellement affichee (depuis les donnees recues)
 * @param {string|null} selectedVar  - variable selectionnee dans le formulaire
 * @returns {{ name: string, reverse: boolean }}
 */
export function useResolvedColorscale(colorscale, displayedVar, selectedVar) {
  return useMemo(() => {
    if (colorscale === 'auto') {
      const isTemp = RDBU_VARIABLES.includes(displayedVar ?? selectedVar);
      return { name: isTemp ? 'RdBu' : 'Viridis', reverse: isTemp };
    }
    const opt = COLORSCALE_OPTIONS.find(o => o.value === colorscale);
    return { name: colorscale, reverse: opt?.reverse || false };
  }, [colorscale, displayedVar, selectedVar]);
}
