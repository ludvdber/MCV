import { VARIABLES_MAP } from '../components/VariableSelector';

/**
 * Retourne true si la variable n'a pas de dimension altitude (variable de surface).
 * @param {string|null} variableCode - code de la variable (ex: 'TT', 'PS')
 */
export function isSurfaceVariable(variableCode) {
  return VARIABLES_MAP.get(variableCode)?.altitudeType === null;
}

/**
 * Etiquette d'altitude d'une figure.
 *
 * Trois cas, dans cet ordre :
 *   - variable de SURFACE  -> « Surface ». Elle n'a pas de dimension altitude
 *     dans les fichiers, et le backend ignore l'indice recu
 *     (`extractSlice2DWithCoords` lit {time, lat, lon}). Ecrire « Niveau 49 »
 *     y affirmait un niveau qui n'existe pas — un permalien portant un ancien
 *     `alt=49` suffisait a le produire.
 *   - altitude reelle connue -> « ~25,3 km », la seule forme lisible.
 *   - sinon                  -> l'indice de niveau du modele, faute de mieux.
 *
 * Regle unique, lue par les trois afficheurs qui titrent une altitude.
 *
 * @param {string|null} variableCode
 * @param {number|null} altitudeValue  altitude reelle en km (reponse API)
 * @param {number|null} altitudeIndex  indice de niveau du modele
 * @param {Function}    t              fonction i18n
 */
export function altitudeLabel(variableCode, altitudeValue, altitudeIndex, t) {
  if (isSurfaceVariable(variableCode)) return t('selector.altitude.surface');
  if (altitudeValue != null) return `~${Number(altitudeValue).toFixed(1)} km`;
  if (altitudeIndex != null) return `${t('selector.altitude.level')} ${altitudeIndex}`;
  return '';
}
