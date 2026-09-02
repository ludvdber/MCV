import { useMemo } from 'react';
import { COLORSCALE_OPTIONS, autoColorscaleFor } from '../utils/colorscales';

/**
 * Resout la palette de couleurs effective a partir du choix utilisateur.
 * En mode 'auto', delegue le choix a autoColorscaleFor (source unique).
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
      return { name: autoColorscaleFor(displayedVar ?? selectedVar), reverse: false };
    }
    const opt = COLORSCALE_OPTIONS.find(o => o.value === colorscale);
    return { name: opt?.scale || colorscale, reverse: opt?.reverse || false };
  }, [colorscale, displayedVar, selectedVar]);
}
