import { Slider, Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

/**
 * Convertit un index de timestep (0-47) en heure locale martienne.
 * Un fichier MEAN contient 48 pas de temps couvrant un cycle diurne :
 * timestep 0 = 0.5h, timestep 23 = 12h (midi), timestep 47 = 24h.
 * Formule : heure = (timestep + 1) * 0.5
 */
export const formatTime = (timestep) => `${(timestep + 1) * 0.5}h`;

/** Reperes affiches sur le slider toutes les 4 heures martiennes */
const marks = [7, 15, 23, 31, 39, 47].map(t => ({ value: t, label: formatTime(t) }));

/**
 * Slider de selection du pas de temps (0-47).
 * Le tooltip affiche l'heure martienne correspondante.
 *
 * @param {number} value - index du timestep (0-47)
 * @param {function} onChange - callback appelee avec le nouvel index
 * @param {boolean} [disabled=false]
 */
function TimeSelector({ value, onChange, disabled = false }) {
  const { t } = useTranslation();
  return (
    <Box>
      <Typography gutterBottom>{t('selector.time.label')}</Typography>
      <Slider
        min={0}
        max={47}
        step={1}
        value={value}
        onChange={(_, v) => onChange(v)}
        disabled={disabled}
        valueLabelDisplay="auto"
        valueLabelFormat={formatTime}
        marks={marks}
      />
    </Box>
  );
}

export default TimeSelector;
