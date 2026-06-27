import { Paper, Box, Typography } from '@mui/material';
import {
  Layers as SliceIcon,
  PlayCircleOutline as AnimationIcon,
  ShowChart as TimeSeriesIcon,
  AlignVerticalBottom as ProfileIcon,
  Landscape as CrossSectionIcon,
  ViewTimeline as HovmollerIcon,
  Equalizer as ZonalMeanIcon,
  DonutLarge as WindRoseIcon,
  CompareArrows as DifferenceIcon,
  GridOn as TemporalProfileIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

/**
 * Encart explicatif affiché en bas d'une vue (hors Explorer).
 * Décrit en langage simple ce que montre la visualisation et pourquoi elle est
 * utile. Le texte vient de la clé i18n `view.<id>.about` ; masqué si absente.
 *
 * L'icône reprend EXACTEMENT celle de la vue dans le menu latéral (pas de
 * nouvelle icône introduite).
 */
const VIEW_ICONS = {
  slice: SliceIcon,
  animation: AnimationIcon,
  timeseries: TimeSeriesIcon,
  profile: ProfileIcon,
  crosssection: CrossSectionIcon,
  hovmoller: HovmollerIcon,
  zonalmean: ZonalMeanIcon,
  windrose: WindRoseIcon,
  difference: DifferenceIcon,
  temporalprofile: TemporalProfileIcon,
};

export default function ViewExplainer({ id }) {
  const { t } = useTranslation();
  const key = `view.${id}.about`;
  const text = t(key);
  if (!text || text === key) return null;
  const Icon = VIEW_ICONS[id];

  return (
    <Paper
      elevation={0}
      sx={{
        mt: 3,
        p: { xs: 2, sm: 2.5 },
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-start',
        border: '1px solid var(--glass-border)',
        background: 'var(--bg-surface)',
        borderRadius: 2,
      }}
    >
      {Icon && <Icon sx={{ color: 'var(--mars-orange)', fontSize: 22, mt: 0.3, flexShrink: 0 }} />}
      <Box>
        <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5, color: 'var(--text-primary)' }}>
          {t('view.aboutTitle')}
        </Typography>
        <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          {text}
        </Typography>
      </Box>
    </Paper>
  );
}
