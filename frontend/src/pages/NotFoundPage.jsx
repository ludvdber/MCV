import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Home as HomeIcon, RocketLaunch as RocketIcon } from '@mui/icons-material';

/**
 * Page 404 — theme spatial martien.
 * Affichee pour toute route inconnue via la route wildcard * dans App.jsx.
 */
function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        px: 3,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Halo de fond */}
      <Box
        sx={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(224,90,43,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* 404 grand titre */}
      <Typography
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: { xs: '6rem', sm: '10rem', md: '14rem' },
          fontWeight: 700,
          lineHeight: 1,
          background: 'linear-gradient(135deg, #e05a2b 30%, #ff7043 60%, #38bdf8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textShadow: 'none',
          mb: 1,
          letterSpacing: '-0.04em',
          userSelect: 'none',
        }}
      >
        404
      </Typography>

      {/* Icone fusee */}
      <RocketIcon
        sx={{
          fontSize: 48,
          color: 'var(--mars-orange)',
          mb: 2,
          filter: 'drop-shadow(0 0 12px rgba(224,90,43,0.6))',
          animation: 'logoPulse 2s ease-in-out infinite',
        }}
      />

      {/* Sous-titre */}
      <Typography
        variant="h5"
        sx={{
          fontFamily: 'var(--font-display)',
          color: 'var(--cyan-accent)',
          textShadow: '0 0 16px rgba(56,189,248,0.4)',
          mb: 1,
          letterSpacing: '0.1em',
        }}
      >
        PAGE INTROUVABLE
      </Typography>

      <Typography
        color="text.secondary"
        sx={{ maxWidth: 480, mb: 4, fontSize: '1.05rem', lineHeight: 1.7 }}
      >
        La page que vous recherchez s'est perdue dans l'espace martien.
        Elle a peut-etre ete deplacee, supprimee, ou n'a jamais existe dans cette galaxie.
      </Typography>

      {/* Coordonnees fictives */}
      <Box
        sx={{
          display: 'flex',
          gap: 3,
          mb: 4,
          p: 1.5,
          borderRadius: 2,
          background: 'rgba(13,27,64,0.5)',
          border: '1px solid rgba(56,189,248,0.12)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {[
          { label: 'ERREUR', value: '404' },
          { label: 'LAT', value: '??.??°' },
          { label: 'LON', value: '??.??°' },
          { label: 'ALT', value: '∞ km' },
        ].map(({ label, value }) => (
          <Box key={label} sx={{ textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.65rem', letterSpacing: '0.1em' }}>
              {label}
            </Typography>
            <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--cyan-accent)', fontVariantNumeric: 'tabular-nums' }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>

      <Button
        variant="contained"
        size="large"
        startIcon={<HomeIcon />}
        onClick={() => navigate('/')}
        sx={{ px: 4 }}
      >
        Retour a l'accueil
      </Button>
    </Box>
  );
}

export default NotFoundPage;
