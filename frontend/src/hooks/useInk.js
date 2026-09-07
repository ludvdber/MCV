/**
 * Encre lisible derivee d'une couleur d'accent, pour le theme courant.
 *
 * Les blocs de l'accueil (cartes de vue, frise des missions, statistiques,
 * encart belge) portent chacun une couleur d'accent qui sert de teinte ET
 * d'encre. Ces couleurs ont ete choisies sur le fond sombre : posees en texte
 * sur le fond blanc du theme clair, elles tombent tres bas — 1,90 mesure pour
 * le cyan #38bdf8, 3,49 pour l'orange #e05a2b. Le cas le plus defavorable est
 * l'etiquette posee sur une teinte de sa propre couleur, d'ou `tintAlpha`.
 *
 * `useThemeMode` et non `theme.palette.mode` : le theme est construit avec
 * `cssVariables` et deux color schemes, si bien que `palette.mode` reste fige
 * sur le schema par defaut et ne suit pas la bascule.
 */
import { useThemeMode } from '../context/ThemeContext';
import { readableOn, compositeOver } from '../utils/contrast';

/** Fond effectif des cartes de l'accueil, par theme. */
export const HOME_SURFACE = { light: '#ffffff', dark: '#0a1230' };

/**
 * @param {string} color      couleur d'accent du bloc
 * @param {number} tintAlpha  opacite de la teinte sur laquelle l'encre peut se poser
 */
export function useInk(color, tintAlpha = 0.15) {
  const { mode } = useThemeMode();
  const surface = HOME_SURFACE[mode] ?? HOME_SURFACE.dark;
  // Cible 4,8 et non 4,5 : `readableOn` s'arrete au premier pas qui passe, et
  // les puces atterrissaient a 4,51 mesure. La marge absorbe l'anticrenelage et
  // les arrondis, sans changer la teinte de facon perceptible.
  return readableOn(color, compositeOver(color, tintAlpha, surface), 4.8);
}
