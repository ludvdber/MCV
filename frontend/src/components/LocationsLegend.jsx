import { Box, Typography } from '@mui/material';
import { LOCATION_COLORS, LOCATION_TYPE_LABELS } from '../data/marsLocations';

/**
 * Legende des types de points d'interet martiens.
 * Remplace le bloc identique dans SlicePage et AnimationPage.
 *
 * @param {boolean} visible - n'affiche rien si false (lie a showLocations)
 */
function LocationsLegend({ visible }) {
  if (!visible) return null;
  return (
    <Box sx={{ mt: 1.5, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
      <Typography variant="caption" color="text.secondary">Legende :</Typography>
      {Object.entries(LOCATION_TYPE_LABELS).map(([type, label]) => (
        <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: LOCATION_COLORS[type] }} />
          <Typography variant="caption">{label}</Typography>
        </Box>
      ))}
    </Box>
  );
}

export default LocationsLegend;
