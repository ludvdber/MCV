import { useState, useEffect, useMemo } from 'react';
import { Slider, Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { VARIABLES_MAP } from './VariableSelector';
import { useMars } from '../context/MarsContext';
import { getAltitudes } from '../services/api';

/** Reperes affiches sur le slider d'altitude — version complete et compacte */
const MARK_VALUES = [0, 20, 40, 60, 80, 100];
const MARK_VALUES_COMPACT = [0, 40, 80, 100];

/**
 * Slider de selection du niveau d'altitude.
 * Affiche les altitudes en km (chargees depuis le backend) au lieu d'indices bruts.
 * S'adapte automatiquement a la variable selectionnee :
 * - altitudeT (ex: TT) : 103 niveaux (0-102)
 * - altitudeM (ex: UU) : 102 niveaux (0-101)
 * - surface (ex: P0) : slider desactive, message informatif
 */
function AltitudeSelector({ value, onChange, variableCode, disabled = false }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const { selectedDataset } = useMars();
  const variable = VARIABLES_MAP.get(variableCode);
  const altitudeType = variable?.altitudeType || null;
  const isSurface = altitudeType === null;
  const max = altitudeType === 'altitudeM' ? 101 : 102;

  const [altKm, setAltKm] = useState(null);

  useEffect(() => {
    if (!selectedDataset || !variableCode || isSurface) {
      setAltKm(null);
      return;
    }
    getAltitudes({ dataset: selectedDataset, variable: variableCode })
      .then(res => {
        if (!res.data.surface && res.data.altitudes?.length > 0) {
          setAltKm(res.data.altitudes);
        } else {
          setAltKm(null);
        }
      })
      .catch(() => setAltKm(null));
  }, [selectedDataset, variableCode, isSurface]);

  const formatKm = (idx) => {
    if (altKm && idx < altKm.length) {
      return `${altKm[idx].toFixed(1)} km`;
    }
    return `${t('selector.altitude.level')} ${idx}`;
  };

  const markVals = isNarrow ? MARK_VALUES_COMPACT : MARK_VALUES;
  const marks = useMemo(() => markVals.map(v => ({
    value: v,
    label: v === 0
      ? (altKm ? `${altKm[0].toFixed(0)} km` : t('selector.altitude.top'))
      : v === 100
        ? (altKm && altKm.length > 100 ? `${altKm[100].toFixed(1)} km` : t('selector.altitude.surface'))
        : (altKm && v < altKm.length ? `${altKm[v].toFixed(0)} km` : String(v)),
  })), [markVals, altKm, t]);

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
        valueLabelFormat={formatKm}
        marks={marks}
        sx={{
          '& .MuiSlider-markLabel[data-index="0"]': { transform: 'translateX(0%)' },
          [`& .MuiSlider-markLabel[data-index="${markVals.length - 1}"]`]: { transform: 'translateX(-100%)' },
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
