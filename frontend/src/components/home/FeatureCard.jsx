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
} from '@mui/icons-material';
import { useReveal } from '../../hooks/useReveal';

const FEAT_ICONS = {
  slice: SliceIcon,
  animation: AnimationIcon,
  timeseries: TimeSeriesIcon,
  profile: ProfileIcon,
  crosssection: CrossSectionIcon,
  explore: ExploreAllIcon,
};

/* ═══ FeatureCard ═══ */
export default function FeatureCard({ feature, delay = 0 }) {
  const Icon = FEAT_ICONS[feature.id] || SliceIcon;
  const props = useReveal(delay);
  return (
    <Box {...props} sx={{ height: '100%' }}>
      <Paper
        component={Link}
        to={feature.route}
        sx={{
          p: 3,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          textDecoration: 'none',
          borderTop: `2px solid ${feature.color}`,
          transition: 'transform 0.25s ease, box-shadow 0.25s ease',
          '&:hover': {
            transform: 'translateY(-7px)',
            boxShadow: `0 16px 48px ${alpha(feature.color, 0.22)}`,
          },
        }}
      >
        <Box sx={{
          width: 46, height: 46, borderRadius: '12px',
          backgroundColor: alpha(feature.color, 0.12),
          display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2,
        }}>
          <Icon sx={{ color: feature.color, fontSize: 24 }} />
        </Box>
        <Chip label={feature.tag} size="small" variant="outlined"
          sx={{ mb: 1.5, alignSelf: 'flex-start', borderColor: alpha(feature.color, 0.5), color: feature.color, fontSize: '0.78rem', fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, height: 22 }} />
        <Typography variant="h6"
          sx={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', mb: 1, color: feature.color }}>
          {feature.title}
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: '0.9rem', lineHeight: 1.7, flex: 1 }}>
          {feature.body}
        </Typography>
        <Box sx={{ mt: 2.5, display: 'flex', alignItems: 'center', gap: 0.5, color: feature.color, fontSize: '0.85rem', fontWeight: 600 }}>
          Explorer <ArrowIcon sx={{ fontSize: 16 }} />
        </Box>
      </Paper>
    </Box>
  );
}
