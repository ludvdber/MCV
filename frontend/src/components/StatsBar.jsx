import { memo, useState } from 'react';
import { Paper, Typography, Box, IconButton, Collapse, useMediaQuery, useTheme } from '@mui/material';
import { ExpandMore as ExpandIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

/**
 * Barre de statistiques descriptives — collapsible.
 * Expanded by default on desktop (sm+), collapsed on mobile.
 *
 * @param {{ min, max, mean, stddev, median? }|null} stats
 */
function StatsBar({ stats }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('sm'));
  const [expanded, setExpanded] = useState(isDesktop);

  if (!stats) return null;

  const fmt = (v) => v != null
    ? v.toLocaleString(i18n.language, { maximumSignificantDigits: 4 })
    : '-';

  const items = [
    { label: t('common.min'), value: fmt(stats.min) },
    { label: t('common.max'), value: fmt(stats.max) },
    { label: t('common.mean'), value: fmt(stats.mean) },
    { label: t('common.stddev'), value: fmt(stats.stddev) },
  ];

  if (stats.median != null) {
    items.push({ label: t('common.median'), value: fmt(stats.median) });
  }

  return (
    <Paper sx={{ mt: 1, overflow: 'hidden' }}>
      <Box
        onClick={() => setExpanded(v => !v)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          p: { xs: 0.5, sm: expanded ? 0 : 0.5 },
          '&:hover': { bgcolor: 'var(--bg-surface-hover)' },
        }}
      >
        {!expanded && (
          <Typography variant="caption" sx={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
            {t('common.min')}: {fmt(stats.min)} · {t('common.max')}: {fmt(stats.max)}
          </Typography>
        )}
        <IconButton size="small" sx={{ ml: 'auto', p: 0.3, color: 'var(--text-secondary)' }}>
          <ExpandIcon sx={{ fontSize: 16, transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: { xs: 1.5, sm: 3 },
          flexWrap: 'wrap',
          p: { xs: 1, sm: 1.5 },
          pt: 0,
        }}>
          {items.map(({ label, value }) => (
            <Typography key={label} variant="body2" sx={{ fontSize: { xs: '0.72rem', sm: '0.875rem' }, whiteSpace: 'nowrap' }}>
              {label} : {value}
            </Typography>
          ))}
        </Box>
      </Collapse>
    </Paper>
  );
}

export default memo(StatsBar);
