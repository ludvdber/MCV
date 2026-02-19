import { useRef, useEffect, useState } from 'react';
import { Paper, Box, Typography, Chip } from '@mui/material';
import { useCountUp } from '../../hooks/useCountUp';

/* ═══ StatCard avec countUp + barre Terre ═══ */
export default function StatCard({ stat, delay = 0 }) {
  const { ref, value } = useCountUp(stat.numeric, stat.decimals, delay);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.unobserve(el); }
    }, { threshold: 0.4 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* barre comparative : ratio fixé dans les données */
  const marsRatio  = stat.ratio != null ? Math.min(stat.ratio, 1) : null;
  const earthRatio = stat.ratio != null ? 1 : null;

  return (
    <Box
      ref={(el) => { containerRef.current = el; ref.current = el; }}
      sx={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`,
        height: '100%',
        width: '100%',
      }}
    >
      <Paper sx={{
        p: { xs: 2.5, md: 3 },
        height: '100%',
        minHeight: { md: 210 },
        display: 'flex', flexDirection: 'column',
        border: '1px solid rgba(224, 90, 43, 0.15)',
        boxShadow: 'inset 0 0 30px rgba(224, 90, 43, 0.04)',
        transition: 'transform 0.22s, box-shadow 0.22s',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 10px 36px rgba(224,90,43,0.18)' },
      }}>
        <Typography sx={{
          fontFamily: 'var(--font-display)',
          fontSize: { xs: '2rem', md: '2.5rem' },
          fontWeight: 700,
          color: 'var(--mars-orange)',
          textShadow: '0 0 24px rgba(224, 90, 43, 0.5)',
          lineHeight: 1,
          textAlign: 'center',
        }}>
          {stat.prefix || ''}{value}{stat.suffix}
        </Typography>
        <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', mt: 0.8, textAlign: 'center' }}>{stat.label}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', mb: 1.5 }}>{stat.sub}</Typography>

        {/* Barres comparatives Mars vs Terre */}
        {marsRatio != null && (
          <Box sx={{ mt: 'auto', pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <Box sx={{ mb: 0.8 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                <Typography sx={{ fontSize: '0.68rem', color: 'var(--mars-orange)', fontWeight: 600 }}>Mars</Typography>
              </Box>
              <Box sx={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <Box sx={{
                  height: '100%', borderRadius: 3,
                  width: visible ? `${Math.max(marsRatio * 100, 3)}%` : '0%',
                  background: 'linear-gradient(90deg, #e05a2b, #ff7043)',
                  transition: `width 1.2s ease ${delay + 0.5}s`,
                  boxShadow: '0 0 8px rgba(224,90,43,0.6)',
                }} />
              </Box>
            </Box>
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                <Typography sx={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 600 }}>Terre</Typography>
                <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>{stat.earthLabel}</Typography>
              </Box>
              <Box sx={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <Box sx={{
                  height: '100%', borderRadius: 3,
                  width: visible ? '100%' : '0%',
                  background: 'linear-gradient(90deg, #1565c0, #38bdf8)',
                  transition: `width 1.0s ease ${delay + 0.3}s`,
                  boxShadow: '0 0 8px rgba(56,189,248,0.4)',
                }} />
              </Box>
            </Box>
          </Box>
        )}
        {/* Température : pas de barre (échelles incompatibles) — juste un label Terre */}
        {marsRatio == null && stat.earthLabel && (
          <Box sx={{ mt: 'auto', pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'center' }}>
            <Chip label={stat.earthLabel} size="small" sx={{ height: 20, fontSize: '0.68rem', backgroundColor: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)' }} />
          </Box>
        )}
      </Paper>
    </Box>
  );
}
