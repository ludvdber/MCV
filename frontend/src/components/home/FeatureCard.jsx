import { Link } from 'react-router-dom';
import { Paper, Box, Typography, Chip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  GridOn as SliceIcon,
  PlayCircleOutline as AnimationIcon,
  ShowChart as TimeSeriesIcon,
  AlignVerticalBottom as ProfileIcon,
  CropFree as CrossSectionIcon,
  OpenInFull as ExploreAllIcon,
  ArrowForward as ArrowIcon,
  ViewTimeline as HovmollerIcon,
  Equalizer as ZonalMeanIcon,
  DonutLarge as WindRoseIcon,
  CompareArrows as DifferenceIcon,
  Air as WindMapIcon,
  CalendarViewMonth as TemporalProfileIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useReveal } from '../../hooks/useReveal';

const FEAT_ICONS = {
  slice: SliceIcon,
  animation: AnimationIcon,
  timeseries: TimeSeriesIcon,
  profile: ProfileIcon,
  crosssection: CrossSectionIcon,
  hovmoller: HovmollerIcon,
  zonalmean: ZonalMeanIcon,
  windrose: WindRoseIcon,
  windmap: WindMapIcon,
  temporalprofile: TemporalProfileIcon,
  difference: DifferenceIcon,
  explore: ExploreAllIcon,
};

/**
 * Feature card — supports 'hero' (large, horizontal) and default (compact) variants.
 * Hero cards span full width with a gradient background.
 */
export default function FeatureCard({ feature, delay = 0, hero = false }) {
  const Icon = FEAT_ICONS[feature.id] || SliceIcon;
  const props = useReveal(delay);
  const { t } = useTranslation();

  if (hero) {
    return (
      <Box {...props} sx={{ height: '100%' }}>
        <Paper
          component={Link}
          to={feature.route}
          sx={{
            p: { xs: 2.5, md: 3.5 },
            height: '100%',
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { sm: 'center' },
            gap: 2.5,
            textDecoration: 'none',
            border: `1px solid ${alpha(feature.color, 0.25)}`,
            background: `linear-gradient(135deg, ${alpha(feature.color, 0.08)} 0%, transparent 60%)`,
            transition: 'transform 0.25s ease, box-shadow 0.25s ease',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: `0 12px 40px ${alpha(feature.color, 0.2)}`,
            },
          }}
        >
          <Box sx={{
            width: 52, height: 52, borderRadius: '14px',
            backgroundColor: alpha(feature.color, 0.15),
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon sx={{ color: feature.color, fontSize: 26 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: feature.color }}>
                {feature.title}
              </Typography>
              <Chip label={feature.tag} size="small"
                sx={{ height: 22, fontSize: '0.75rem', fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, backgroundColor: alpha(feature.color, 0.12), color: feature.color, border: `1px solid ${alpha(feature.color, 0.3)}` }} />
            </Box>
            <Typography color="text.secondary" sx={{ fontSize: '0.88rem', lineHeight: 1.65 }}>
              {feature.body}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: feature.color, fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
            {t('home.goTo')} <ArrowIcon sx={{ fontSize: 16 }} />
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box {...props} sx={{ height: '100%' }}>
      <Paper
        component={Link}
        to={feature.route}
        sx={{
          p: 2.5,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          textDecoration: 'none',
          border: `1px solid ${alpha(feature.color, 0.12)}`,
          transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
          '&:hover': {
            transform: 'translateY(-5px)',
            borderColor: alpha(feature.color, 0.35),
            boxShadow: `0 12px 36px ${alpha(feature.color, 0.18)}`,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: '10px',
            backgroundColor: alpha(feature.color, 0.1),
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon sx={{ color: feature.color, fontSize: 20 }} />
          </Box>
          <Chip label={feature.tag} size="small" variant="outlined"
            sx={{ borderColor: alpha(feature.color, 0.4), color: feature.color, fontSize: '0.72rem', fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, height: 20 }} />
        </Box>
        <Typography
          sx={{ fontFamily: 'var(--font-display)', fontSize: '0.98rem', fontWeight: 600, mb: 0.8, color: feature.color }}>
          {feature.title}
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: '0.84rem', lineHeight: 1.65, flex: 1 }}>
          {feature.body}
        </Typography>
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 0.5, color: feature.color, fontSize: '0.82rem', fontWeight: 600 }}>
          {t('home.goTo')} <ArrowIcon sx={{ fontSize: 14 }} />
        </Box>
      </Paper>
    </Box>
  );
}
