import { useMemo } from 'react';
import { COLORSCALE_OPTIONS, RDBU_VARIABLES } from '../utils/colorscales';

/**
 * Resout la palette de couleurs effective a partir du choix utilisateur.
 * En mode 'auto', utilise RdBu pour les variables de temperature, Viridis sinon.
 * Remplace le useMemo identique dans SlicePage, AnimationPage et CrossSectionPage.
 *
 * Pour Plasma et Inferno (non enregistres nativement dans Plotly v3),
 * retourne le tableau de stops au lieu du nom string.
 *
 * @param {string} colorscale       - valeur du selecteur ('auto' ou nom Plotly)
 * @param {string|null} displayedVar - variable actuellement affichee (depuis les donnees recues)
 * @param {string|null} selectedVar  - variable selectionnee dans le formulaire
 * @returns {{ name: string|Array, reverse: boolean }}
 */
export function useResolvedColorscale(colorscale, displayedVar, selectedVar) {
  return useMemo(() => {
    if (colorscale === 'auto') {
      const isTemp = RDBU_VARIABLES.includes(displayedVar ?? selectedVar);
      return { name: isTemp ? 'RdBu' : 'Viridis', reverse: isTemp };
    }
    const opt = COLORSCALE_OPTIONS.find(o => o.value === colorscale);
    return { name: opt?.scale || colorscale, reverse: opt?.reverse || false };
  }, [colorscale, displayedVar, selectedVar]);
}
