import { Paper, Typography } from '@mui/material';

/**
 * Barre de statistiques descriptives (min / max / moyenne / ecart-type).
 * Remplace le bloc <Paper> identique dans les 5 composants viewer.
 *
 * @param {{ min, max, mean, stddev }|null} stats - objet stats issu de la reponse API
 */
function StatsBar({ stats }) {
  if (!stats) return null;
  return (
    <Paper sx={{ p: 1.5, mt: 1, display: 'flex', justifyContent: 'center', gap: 3, flexWrap: 'wrap' }}>
      <Typography variant="body2">Min : {stats.min?.toPrecision(4) ?? '-'}</Typography>
      <Typography variant="body2">Max : {stats.max?.toPrecision(4) ?? '-'}</Typography>
      <Typography variant="body2">Moyenne : {stats.mean?.toPrecision(4) ?? '-'}</Typography>
      <Typography variant="body2">Ecart-type : {stats.stddev?.toPrecision(4) ?? '-'}</Typography>
    </Paper>
  );
}

export default StatsBar;
