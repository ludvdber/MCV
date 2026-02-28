import { memo } from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { LOCATION_COLORS, LOCATION_TYPE_KEYS } from '../data/marsLocations';

/**
 * Legende des types de points d'interet martiens.
 * Remplace le bloc identique dans SlicePage et AnimationPage.
 *
 * @param {boolean} visible - n'affiche rien si false (lie a showLocations)
 */
function LocationsLegend({ visible }) {
  const { t } = useTranslation();

  if (!visible) return null;
  return (
    <Box sx={{ mt: 1.5, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
      <Typography variant="caption" color="text.secondary">{t('common.legend')}</Typography>
      {Object.entries(LOCATION_TYPE_KEYS).map(([type, key]) => (
        <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: LOCATION_COLORS[type] }} />
          <Typography variant="caption">{t(key)}</Typography>
        </Box>
      ))}
    </Box>
  );
}

export default memo(LocationsLegend);
