import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { COLORSCALE_OPTIONS } from '../utils/colorscales';

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
      <Select value={value} label={t('selector.colorscale.label')} onChange={e => onChange(e.target.value)}>
        {COLORSCALE_OPTIONS.map(opt => (
          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default ColorscaleSelector;
