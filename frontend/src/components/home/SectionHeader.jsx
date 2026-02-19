import { Box, Typography, Chip } from '@mui/material';
import { useReveal } from '../../hooks/useReveal';

/* ═══ SectionHeader ═══ */
export default function SectionHeader({ tag, title, subtitle, color = 'secondary', delay = 0 }) {
  const props = useReveal(delay);
  return (
    <Box {...props} sx={{ mb: { xs: 4, md: 6 }, textAlign: 'center' }}>
      <Chip label={tag} color={color} size="small"
        sx={{ mb: 2, fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.03em', fontSize: '0.82rem', fontWeight: 600 }} />
      <Typography variant="h4" sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: '1.6rem', md: '2.2rem' }, mb: subtitle ? 2 : 0 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography color="text.secondary" sx={{ maxWidth: 680, mx: 'auto', lineHeight: 1.75, fontSize: '1.05rem' }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}
