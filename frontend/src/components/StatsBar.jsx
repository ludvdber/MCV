import { memo } from 'react';
import { Paper, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

/**
 * Barre de statistiques descriptives (min / max / moyenne / ecart-type).
 * Remplace le bloc <Paper> identique dans les 5 composants viewer.
 *
 * @param {{ min, max, mean, stddev }|null} stats - objet stats issu de la reponse API
 */
function StatsBar({ stats }) {
  const { t } = useTranslation();

  if (!stats) return null;
  return (
    <Paper sx={{ p: 1.5, mt: 1, display: 'flex', justifyContent: 'center', gap: 3, flexWrap: 'wrap' }}>
      <Typography variant="body2">{t('common.min')} : {stats.min?.toPrecision(4) ?? '-'}</Typography>
      <Typography variant="body2">{t('common.max')} : {stats.max?.toPrecision(4) ?? '-'}</Typography>
      <Typography variant="body2">{t('common.mean')} : {stats.mean?.toPrecision(4) ?? '-'}</Typography>
      <Typography variant="body2">{t('common.stddev')} : {stats.stddev?.toPrecision(4) ?? '-'}</Typography>
    </Paper>
  );
}

export default memo(StatsBar);
