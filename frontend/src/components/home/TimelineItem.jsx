import { Paper, Box, Typography, Chip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { EmojiEvents as DiscoveryIcon } from '@mui/icons-material';
import { useReveal } from '../../hooks/useReveal';

const AGENCY_COLOR = { NASA: '#e05a2b', ESA: '#38bdf8' };

/* ═══ TimelineItem — version verticale alternée ═══ */
export default function TimelineItem({ item, index }) {
  const props = useReveal(index * 0.08);
  const agencyColor = AGENCY_COLOR[item.agency] || '#38bdf8';
  const isRight = index % 2 === 0; /* desktop : carte à droite de la ligne */

  return (
    <Box {...props} sx={{ display: 'flex', mb: { xs: 0, md: 1 }, alignItems: 'flex-start', position: 'relative' }}>

      {/* ─ DESKTOP : alternance gauche / droite ─ */}
      <Box sx={{ display: { xs: 'none', md: 'flex' }, width: '100%', alignItems: 'flex-start', gap: 0 }}>
        {/* Colonne gauche (vide si isRight, carte si !isRight) */}
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end', pr: 3, pt: 0.5 }}>
          {!isRight && (
            <Paper sx={{ p: 2.5, maxWidth: 360, border: `1px solid ${alpha(agencyColor, 0.22)}`, boxShadow: `0 4px 24px ${alpha(agencyColor, 0.06)}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: agencyColor, fontSize: '1.3rem', lineHeight: 1 }}>{item.year}</Typography>
                <Chip label={item.agency} size="small" sx={{ height: 20, fontSize: '0.7rem', fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, backgroundColor: alpha(agencyColor, 0.15), color: agencyColor }} />
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 0.8 }}>{item.name}</Typography>
              <Typography color="text.secondary" sx={{ fontSize: '0.88rem', lineHeight: 1.65, mb: 1.2 }}>{item.desc}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, p: '6px 10px', borderRadius: 2, backgroundColor: alpha(agencyColor, 0.08), border: `1px solid ${alpha(agencyColor, 0.2)}` }}>
                <DiscoveryIcon sx={{ fontSize: 14, color: agencyColor, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.75rem', color: agencyColor, fontWeight: 600, fontFamily: "'Rajdhani',sans-serif" }}>{item.discovery}</Typography>
              </Box>
            </Paper>
          )}
        </Box>

        {/* Dot central — la ligne est gérée par le conteneur parent */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 32, pt: 1.2, pb: 1 }}>
          <Box sx={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, backgroundColor: agencyColor, boxShadow: `0 0 14px ${agencyColor}, 0 0 28px ${alpha(agencyColor, 0.4)}`, border: `2px solid rgba(8,18,40,0.8)`, zIndex: 1, position: 'relative' }} />
        </Box>

        {/* Colonne droite (carte si isRight, vide sinon) */}
        <Box sx={{ flex: 1, pl: 3, pt: 0.5 }}>
          {isRight && (
            <Paper sx={{ p: 2.5, maxWidth: 360, border: `1px solid ${alpha(agencyColor, 0.22)}`, boxShadow: `0 4px 24px ${alpha(agencyColor, 0.06)}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: agencyColor, fontSize: '1.3rem', lineHeight: 1 }}>{item.year}</Typography>
                <Chip label={item.agency} size="small" sx={{ height: 20, fontSize: '0.7rem', fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, backgroundColor: alpha(agencyColor, 0.15), color: agencyColor }} />
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 0.8 }}>{item.name}</Typography>
              <Typography color="text.secondary" sx={{ fontSize: '0.88rem', lineHeight: 1.65, mb: 1.2 }}>{item.desc}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, p: '6px 10px', borderRadius: 2, backgroundColor: alpha(agencyColor, 0.08), border: `1px solid ${alpha(agencyColor, 0.2)}` }}>
                <DiscoveryIcon sx={{ fontSize: 14, color: agencyColor, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.75rem', color: agencyColor, fontWeight: 600, fontFamily: "'Rajdhani',sans-serif" }}>{item.discovery}</Typography>
              </Box>
            </Paper>
          )}
        </Box>
      </Box>

      {/* ─ MOBILE : colonne unique ─ */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, width: '100%', gap: 1.5, alignItems: 'flex-start' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 1.5, flexShrink: 0 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: agencyColor, boxShadow: `0 0 10px ${agencyColor}` }} />
          <Box sx={{ width: 2, flex: 1, minHeight: 50, backgroundColor: alpha(agencyColor, 0.2), mt: 0.5 }} />
        </Box>
        <Paper sx={{ flex: 1, p: 2, mb: 2, border: `1px solid ${alpha(agencyColor, 0.22)}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
            <Typography sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: agencyColor, fontSize: '1.1rem' }}>{item.year}</Typography>
            <Chip label={item.agency} size="small" sx={{ height: 20, fontSize: '0.7rem', fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, backgroundColor: alpha(agencyColor, 0.15), color: agencyColor }} />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 0.6 }}>{item.name}</Typography>
          <Typography color="text.secondary" sx={{ fontSize: '0.86rem', lineHeight: 1.6, mb: 1 }}>{item.desc}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, p: '5px 8px', borderRadius: 2, backgroundColor: alpha(agencyColor, 0.08), border: `1px solid ${alpha(agencyColor, 0.2)}` }}>
            <DiscoveryIcon sx={{ fontSize: 13, color: agencyColor, flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.72rem', color: agencyColor, fontWeight: 600, fontFamily: "'Rajdhani',sans-serif" }}>{item.discovery}</Typography>
          </Box>
        </Paper>
      </Box>

    </Box>
  );
}
