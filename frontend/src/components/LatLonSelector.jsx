import { Slider, Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

/** Reperes affiches sur le slider de latitude */
const latMarks = [
  { value: -88, label: '-88°' },
  { value: -44, label: '-44°' },
  { value: 0,   label: '0°'   },
  { value: 44,  label: '44°'  },
  { value: 88,  label: '88°'  },
];

/** Reperes affiches sur le slider de longitude */
const lonMarks = [
  { value: -176, label: '-176°' },
  { value: -88,  label: '-88°'  },
  { value: 0,    label: '0°'    },
  { value: 88,   label: '88°'   },
  { value: 180,  label: '180°'  },
];

/**
 * Deux sliders pour selectionner un point latitude/longitude sur la grille Mars.
 *
 * La grille GEM-Mars est de 45 latitudes × 90 longitudes :
 * - Latitudes  : -88° a 88° par pas de 4°
 * - Longitudes : -176° a 180° par pas de 4°
 *
 * Utilise pour le cas d'usage UC3 (serie temporelle en un point geographique).
 *
 * @param {number} latitude - latitude en degres (-88 a 88)
 * @param {number} longitude - longitude en degres (-176 a 180)
 * @param {function} onLatChange - callback appelee avec la nouvelle latitude
 * @param {function} onLonChange - callback appelee avec la nouvelle longitude
 * @param {boolean} [disabled=false]
 */
function LatLonSelector({ latitude, longitude, onLatChange, onLonChange, disabled = false }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography gutterBottom>{t('selector.latlon.latitude')}</Typography>
        <Slider
          min={-88}
          max={88}
          step={4}
          value={latitude}
          onChange={(_, v) => onLatChange(v)}
          disabled={disabled}
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => `${v}°`}
          marks={latMarks}
        />
      </Box>
      <Box>
        <Typography gutterBottom>{t('selector.latlon.longitude')}</Typography>
        <Slider
          min={-176}
          max={180}
          step={4}
          value={longitude}
          onChange={(_, v) => onLonChange(v)}
          disabled={disabled}
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => `${v}°`}
          marks={lonMarks}
        />
      </Box>
    </Box>
  );
}

export default LatLonSelector;
