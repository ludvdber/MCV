import { Paper, Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Memory as ModelIcon,
  SatelliteAlt as SatelliteIcon,
  Groups as GroupsIcon,
  Science as ScienceIcon,
  RocketLaunch as RocketIcon,
  Explore as ExploreIcon,
} from '@mui/icons-material';
import { useReveal } from '../../hooks/useReveal';

const BELGIUM_ICONS = {
  model: ModelIcon,
  nomad: SatelliteIcon,
  collab: GroupsIcon,
  vki: ScienceIcon,
  spacebel: RocketIcon,
  rosalind: ExploreIcon,
};

/* ═══ BelgiumCard ═══ */
export default function BelgiumCard({ item, delay = 0 }) {
  const Icon = BELGIUM_ICONS[item.icon] || ModelIcon;
  const props = useReveal(delay);
  return (
    <Box {...props} sx={{ height: '100%' }}>
      <Paper sx={{
        p: 3, height: '100%', display: 'flex', flexDirection: 'column',
        border: `1px solid ${alpha(item.color, 0.22)}`,
        borderLeft: `3px solid ${item.color}`,
        transition: 'transform 0.22s, box-shadow 0.22s',
        '&:hover': { transform: 'translateY(-5px)', boxShadow: `0 12px 40px ${alpha(item.color, 0.18)}` },
      }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 1.5 }}>
          <Box sx={{ width: 42, height: 42, borderRadius: '12px', backgroundColor: alpha(item.color, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon sx={{ color: item.color, fontSize: 22 }} />
          </Box>
          <Box>
            <Typography sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.05rem', mb: 0.3 }}>{item.title}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: item.color, fontFamily: "'Rajdhani',sans-serif", fontWeight: 600 }}>{item.detail}</Typography>
          </Box>
        </Box>
        <Typography color="text.secondary" sx={{ fontSize: '0.9rem', lineHeight: 1.7 }}>{item.body}</Typography>
      </Paper>
    </Box>
  );
}
