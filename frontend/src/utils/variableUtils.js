import { VARIABLES_MAP } from '../components/VariableSelector';

/**
 * Retourne true si la variable n'a pas de dimension altitude (variable de surface).
 * @param {string|null} variableCode - code de la variable (ex: 'TT', 'PS')
 */
export function isSurfaceVariable(variableCode) {
  return VARIABLES_MAP.get(variableCode)?.altitudeType === null;
}
