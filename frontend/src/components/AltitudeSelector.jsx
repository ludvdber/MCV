import { Slider, Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { VARIABLES_MAP } from './VariableSelector';

/** Reperes affiches sur le slider d'altitude (niveau 0 = sommet ~142 km, niveau max = surface) */
/** Cles statiques pour les marks — les labels traduits sont injectes dans le composant */
const MARK_VALUES = [0, 20, 40, 60, 80, 100];

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
  const { t } = useTranslation();
  const variable = VARIABLES_MAP.get(variableCode);
  const altitudeType = variable?.altitudeType || null;
  const isSurface = altitudeType === null;
  const max = altitudeType === 'altitudeM' ? 101 : 102;

  const marks = MARK_VALUES.map(v => ({
    value: v,
    label: v === 0 ? t('selector.altitude.top') : v === 100 ? t('selector.altitude.surface') : String(v),
  }));

  return (
    <Box>
      <Typography gutterBottom>{t('selector.altitude.label')}</Typography>
      <Slider
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(_, v) => onChange(v)}
        disabled={disabled || isSurface}
        valueLabelDisplay="auto"
        valueLabelFormat={(v) => `${t('selector.altitude.level')} ${v}`}
        marks={marks}
        sx={{
          '& .MuiSlider-markLabel[data-index="0"]': { transform: 'translateX(0%)' },
          '& .MuiSlider-markLabel[data-index="5"]': { transform: 'translateX(-100%)' },
        }}
      />
      {isSurface && variableCode && (
        <Typography variant="caption" color="text.secondary">
          {t('selector.altitude.surfaceCaption')}
        </Typography>
      )}
    </Box>
  );
}

export default AltitudeSelector;
