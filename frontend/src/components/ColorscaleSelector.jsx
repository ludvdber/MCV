import { FormControl, InputLabel, Select, MenuItem, Box, Typography, Tooltip, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { COLORSCALE_OPTIONS, swatchGradient } from '../utils/colorscales';

/**
 * Ligne d'option de palette : échantillon du dégradé + nom + badge CVD
 * (perceptuellement uniforme / adaptée au daltonisme).
 * Exportée pour être réutilisée par le panneau de l'Explorer.
 */
export function ColorscaleOptionRow({ opt }) {
  const { t } = useTranslation();
  const gradient = swatchGradient(opt);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', minWidth: 0 }}>
      {gradient && (
        <Box sx={{
          width: 44, height: 12, borderRadius: '3px', flexShrink: 0,
          background: gradient, border: '1px solid rgba(128,128,128,0.35)',
        }} />
      )}
      <Typography variant="body2" noWrap sx={{ flex: 1 }}>{opt.label}</Typography>
      {opt.cvd && (
        <Tooltip title={t('selector.colorscale.cvdTooltip')} arrow>
          <Chip label="CVD" size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700 }} />
        </Tooltip>
      )}
    </Box>
  );
}

/**
 * Selecteur de palette de couleurs Plotly.
 * Remplace le bloc FormControl/Select identique dans SlicePage, AnimationPage et CrossSectionPage.
 *
 * @param {string}   value    - palette selectionnee ('auto' ou nom Plotly)
 * @param {function} onChange - callback(newValue: string)
 */
function ColorscaleSelector({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <FormControl fullWidth size="small">
      <InputLabel>{t('selector.colorscale.label')}</InputLabel>
      <Select
        value={value}
        label={t('selector.colorscale.label')}
        onChange={e => onChange(e.target.value)}
        renderValue={v => {
          const opt = COLORSCALE_OPTIONS.find(o => o.value === v);
          return opt ? <ColorscaleOptionRow opt={opt} /> : v;
        }}
      >
        {COLORSCALE_OPTIONS.map(opt => (
          <MenuItem key={opt.value} value={opt.value}>
            <ColorscaleOptionRow opt={opt} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default ColorscaleSelector;
