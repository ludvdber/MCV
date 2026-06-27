import { memo } from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

/**
 * Barre de statistiques descriptives — toujours visible, compacte et colorée.
 *
 * Chaque statistique est une "cellule" (libellé + valeur) séparée par un fin
 * trait vertical, avec un accent couleur : min = cyan, max = orange Mars,
 * moyenne mise en avant. Pas de repli (le gain d'espace était négligeable).
 *
 * @param {{ min, max, mean, stddev, median? }|null} stats
 */
function StatsBar({ stats }) {
  const { t, i18n } = useTranslation();

  if (!stats) return null;

  // Notation scientifique (mantisse ×10^exposant) pour les valeurs extremes,
  // sinon groupement local classique. Evite les "42 290 000 000 ..." illisibles
  // alors que le graphe affiche deja la meme valeur sous forme compacte.
  const fmt = (v) => {
    if (v == null) return '-';
    if (v === 0) return '0';
    const abs = Math.abs(v);
    if (abs >= 1e6 || abs < 1e-3) {
      const [mant, e] = v.toExponential(2).split('e');
      const exp = parseInt(e, 10);
      const mantStr = Number(mant).toLocaleString(i18n.language, { maximumFractionDigits: 2 });
      return <>{mantStr}×10<sup>{exp}</sup></>;
    }
    return v.toLocaleString(i18n.language, { maximumSignificantDigits: 4 });
  };

  const items = [
    { label: t('common.min'),    value: fmt(stats.min),    color: 'var(--cyan-accent)' },
    { label: t('common.max'),    value: fmt(stats.max),    color: 'var(--mars-orange)' },
    { label: t('common.mean'),   value: fmt(stats.mean),   color: 'var(--text-primary)' },
    { label: t('common.stddev'), value: fmt(stats.stddev), color: 'var(--text-secondary)' },
  ];
  if (stats.median != null) {
    items.push({ label: t('common.median'), value: fmt(stats.median), color: 'var(--text-secondary)' });
  }

  return (
    <Paper
      className="stats-bar"
      sx={{
        mt: 1,
        px: { xs: 1, sm: 2 },
        py: { xs: 0.75, sm: 1 },
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'stretch',
        flexWrap: 'wrap',
      }}
    >
      {items.map((it, i) => (
        <Box
          key={it.label}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            px: { xs: 1.25, sm: 2.5 },
            py: 0.25,
            minWidth: 60,
            borderLeft: i === 0 ? 'none' : '1px solid var(--glass-border)',
          }}
        >
          <Typography
            sx={{
              fontSize: '0.6rem',
              fontWeight: 600,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            {it.label}
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: '0.82rem', sm: '0.95rem' },
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: it.color,
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
            }}
          >
            {it.value}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
}

export default memo(StatsBar);
