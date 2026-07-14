import { useState, useEffect, useMemo } from 'react';
import { Slider, Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { VARIABLES_MAP } from './VariableSelector';
import { useMars } from '../context/MarsContext';
import { getAltitudes } from '../services/api';

/**
 * Slider de selection du niveau d'altitude.
 * Affiche les altitudes en km (chargees depuis le backend) au lieu d'indices bruts.
 * S'adapte automatiquement a la variable selectionnee :
 * - altitudeT (ex: TT) : 103 niveaux (0-102)
 * - altitudeM (ex: UU) : 102 niveaux (0-101)
 * - surface (ex: P0) : slider desactive, message informatif
 *
 * La valeur exacte en km est affichee en continu a cote du titre (lecture
 * directe). Les reperes sont poses a des positions d'INDEX regulieres (donc
 * regulieres A L'ECRAN) : l'axe des altitudes etant fortement non lineaire
 * (144 km -> 0 km se resserre pres du sol), poser les reperes sur des km ronds
 * les entasserait ("8 km" collant "0 km"). Ici l'espacement ecran est garanti
 * uniforme et le curseur porte la valeur precise.
 */
/** @param {boolean} dense — conteneur etroit (panneau de la console, ~300 px) :
 *  trois reperes au lieu de cinq. */
function AltitudeSelector({ value, onChange, variableCode, disabled = false, dense = false }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const { selectedDataset } = useMars();
  const variable = VARIABLES_MAP.get(variableCode);
  const altitudeType = variable?.altitudeType || null;
  const isSurface = altitudeType === null;
  const max = altitudeType === 'altitudeM' ? 101 : 102;

  /* Altitudes stockees AVEC leur cle (dataset|variable) : altKm est derive en
     comparant la cle courante — pas de reset synchrone dans l'effet, et pas
     d'affichage perime pendant le chargement d'une autre selection. */
  const [altData, setAltData] = useState(null);
  const altKey = `${selectedDataset}|${variableCode}`;

  useEffect(() => {
    if (!selectedDataset || !variableCode || isSurface) return undefined;
    let cancelled = false;
    getAltitudes({ dataset: selectedDataset, variable: variableCode })
      .then(res => {
        if (cancelled) return;
        const ok = !res.data.surface && res.data.altitudes?.length > 0;
        setAltData({ key: altKey, altitudes: ok ? res.data.altitudes : null });
      })
      .catch(() => { if (!cancelled) setAltData({ key: altKey, altitudes: null }); });
    return () => { cancelled = true; };
  }, [selectedDataset, variableCode, isSurface, altKey]);

  const altKm = !isSurface && altData?.key === altKey ? altData.altitudes : null;

  /** Valeur precise pour le tooltip du curseur et la lecture directe du titre. */
  const formatKm = (idx) => {
    if (altKm && idx < altKm.length) return `${altKm[idx].toFixed(1)} km`;
    return `${t('selector.altitude.level')} ${idx}`;
  };

  /* Reperes a des positions d'index regulieres (espacement ecran uniforme). */
  const markIdx = useMemo(() => {
    const q = (dense || isNarrow)
      ? [0, Math.round(max / 2), max]
      : [0, Math.round(max / 4), Math.round(max / 2), Math.round((3 * max) / 4), max];
    return [...new Set(q)].sort((a, b) => a - b);
  }, [dense, isNarrow, max]);

  const marks = useMemo(() => markIdx.map(v => ({
    value: v,
    label: altKm && v < altKm.length
      ? `${Math.round(altKm[v])} km`
      : v === 0
        ? t('selector.altitude.top')
        : v === max
          ? t('selector.altitude.surface')
          : String(v),
  })), [markIdx, altKm, max, t]);

  return (
    <Box>
      <Typography gutterBottom>
        {t('selector.altitude.label')}
        {!isSurface && (
          <Box component="span" sx={{ color: 'var(--mars-orange)', fontWeight: 700, ml: 0.75 }}>
            {formatKm(value)}
          </Box>
        )}
      </Typography>
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
          // Reperes de bord realignes DANS la piste (haut a gauche, sol a droite) :
          // sinon "144 km" et "0 km" debordent et se chevauchent avec les voisins.
          '& .MuiSlider-markLabel[data-index="0"]': { transform: 'translateX(0%)' },
          [`& .MuiSlider-markLabel[data-index="${marks.length - 1}"]`]: { transform: 'translateX(-100%)' },
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
