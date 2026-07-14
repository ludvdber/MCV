import { Slider, Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
// formatTime vit dans utils/formatTime.js : ce fichier ne doit exporter
// qu'un composant (react-refresh/only-export-components).
import { formatTime } from '../utils/formatTime';

/** Reperes affiches sur le slider : ancres AUX BORNES reelles (0 et 47) plus
 *  quelques jalons intermediaires reguliers. Aux bornes on ne montre PAS toute
 *  la valeur au centre du repere (elle deborderait de la piste et percuterait le
 *  slider voisin en disposition 2 colonnes) : elles sont realignees dans la piste. */
const marks = [0, 12, 24, 36, 47].map(t => ({ value: t, label: formatTime(t) }));
const marksCompact = [0, 24, 47].map(t => ({ value: t, label: formatTime(t) }));

/**
 * Slider de selection du pas de temps (0-47).
 * La valeur exacte est affichee en continu a cote du titre (lecture directe) :
 * les reperes ne servent que de jalons, le curseur porte la valeur precise.
 *
 * @param {number} value - index du timestep (0-47)
 * @param {function} onChange - callback appelee avec le nouvel index
 * @param {boolean} [disabled=false]
 */
function TimeSelector({ value, onChange, disabled = false }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const shownMarks = isNarrow ? marksCompact : marks;

  return (
    <Box>
      <Typography gutterBottom>
        {t('selector.time.label')}
        <Box component="span" sx={{ color: 'var(--mars-orange)', fontWeight: 700, ml: 0.75 }}>
          {formatTime(value)}
        </Box>
      </Typography>
      <Slider
        min={0}
        max={47}
        step={1}
        value={value}
        onChange={(_, v) => onChange(v)}
        disabled={disabled}
        valueLabelDisplay="auto"
        valueLabelFormat={formatTime}
        marks={shownMarks}
        sx={{
          // Reperes de bord realignes DANS la piste : le premier a gauche, le
          // dernier a droite. Sans ca, "23.5h" (borne haute) deborde et percute
          // le slider d'altitude voisin (retour utilisateur).
          '& .MuiSlider-markLabel[data-index="0"]': { transform: 'translateX(0%)' },
          [`& .MuiSlider-markLabel[data-index="${shownMarks.length - 1}"]`]: { transform: 'translateX(-100%)' },
        }}
      />
    </Box>
  );
}

export default TimeSelector;
