import { ToggleButtonGroup, ToggleButton, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';

/**
 * Sélecteur de résolution d'affichage des heatmaps lat/lon.
 * 0 = grille native du modèle (4°), 2/1 = sur-échantillonnage bilinéaire
 * côté client à 2° ou 1° (voir utils/gridInterpolation.js).
 *
 * @param {number}   value    - pas cible en degrés (0 = natif)
 * @param {function} onChange - callback(newValue: number)
 * @param {boolean}  [compact=false] - variante dense pour la barre d'outils Explorer
 */
function InterpolationToggle({ value, onChange, compact = false }) {
  const { t } = useTranslation();
  return (
    <Tooltip title={t('selector.interp.label')} arrow>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={value}
        onChange={(_, v) => { if (v !== null) onChange(v); }}
        aria-label={t('selector.interp.label')}
        sx={compact ? {
          '& .MuiToggleButton-root': { py: 0.1, px: 0.8, fontSize: '0.68rem', lineHeight: 1.6 },
        } : {
          '& .MuiToggleButton-root': { py: 0.4, px: 1.2, fontSize: '0.75rem' },
        }}
      >
        <ToggleButton value={0}>{t('selector.interp.native')}</ToggleButton>
        <ToggleButton value={2}>2°</ToggleButton>
        <ToggleButton value={1}>1°</ToggleButton>
      </ToggleButtonGroup>
    </Tooltip>
  );
}

export default InterpolationToggle;
