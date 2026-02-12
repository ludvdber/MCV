import { Slider, Box, Typography } from '@mui/material';
import { VARIABLES } from './VariableSelector';

/** Reperes affiches sur le slider d'altitude */
const marks = [
  { value: 0, label: 'Surface' },
  { value: 20, label: '20' },
  { value: 40, label: '40' },
  { value: 60, label: '60' },
  { value: 80, label: '80' },
  { value: 100, label: '100' },
];

/**
 * Slider de selection du niveau d'altitude.
 * S'adapte automatiquement a la variable selectionnee :
 * - altitudeT (ex: TT) : 103 niveaux (0-102)
 * - altitudeM (ex: UU) : 102 niveaux (0-101)
 * - surface (ex: P0) : slider desactive, message informatif
 *
 * Le clamping (ajustement du max quand on change de variable) est gere
 * par le composant parent, pas ici — un composant controle ne doit pas
 * appeler onChange pendant son rendu.
 *
 * @param {number} value - index du niveau d'altitude
 * @param {function} onChange - callback appelee avec le nouvel index
 * @param {string|null} variableCode - code de la variable pour determiner le type d'altitude
 * @param {boolean} [disabled=false]
 */
function AltitudeSelector({ value, onChange, variableCode, disabled = false }) {
  const variable = VARIABLES.find(v => v.code === variableCode);
  const altitudeType = variable?.altitudeType || null;
  const isSurface = altitudeType === null;
  const max = altitudeType === 'altitudeM' ? 101 : 102;

  return (
    <Box>
      <Typography gutterBottom>Niveau d'altitude</Typography>
      <Slider
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(_, v) => onChange(v)}
        disabled={disabled || isSurface}
        valueLabelDisplay="auto"
        valueLabelFormat={(v) => `Niveau ${v}`}
        marks={marks}
      />
      {isSurface && variableCode && (
        <Typography variant="caption" color="text.secondary">
          Variable de surface — pas de niveau d'altitude
        </Typography>
      )}
    </Box>
  );
}

export default AltitudeSelector;
