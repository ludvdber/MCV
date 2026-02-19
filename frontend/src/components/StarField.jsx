import { useMemo } from 'react';
import { Box } from '@mui/material';

/**
 * Champ d'etoiles anime en CSS pur (pas de canvas ni requestAnimationFrame).
 *
 * Genere 3 couches d'etoiles avec des tailles et vitesses de scintillement
 * differentes pour creer un effet de parallaxe statique.
 * Une etoile filante traverse le ciel periodiquement.
 *
 * Tout est fait via box-shadow et keyframes CSS → zero impact GPU,
 * pas de re-render React, pas de boucle d'animation JS.
 */

/** Genere N positions aleatoires pour box-shadow */
function generateStars(count, maxX = 2000, maxY = 2000) {
  const shadows = [];
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * maxX);
    const y = Math.floor(Math.random() * maxY);
    shadows.push(`${x}px ${y}px #fff`);
  }
  return shadows.join(', ');
}

function StarField() {
  const [small, medium, large] = useMemo(() => [
    generateStars(200),
    generateStars(80),
    generateStars(30),
  ], []);

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,

        /* Couche 1 — petites etoiles */
        '&::before': {
          content: '""',
          position: 'absolute',
          width: '1px',
          height: '1px',
          boxShadow: small,
          animation: 'twinkle 4s ease-in-out infinite alternate',
        },

        /* Couche 2 — etoiles moyennes */
        '&::after': {
          content: '""',
          position: 'absolute',
          width: '2px',
          height: '2px',
          borderRadius: '50%',
          boxShadow: medium,
          animation: 'twinkle 6s ease-in-out infinite alternate-reverse',
        },

        /* Keyframes injectes via un style global */
        '@keyframes twinkle': {
          '0%': { opacity: 0.4 },
          '100%': { opacity: 1 },
        },

        '@keyframes shootingStar': {
          '0%': {
            transform: 'translateX(0) translateY(0)',
            opacity: 1,
          },
          '70%': {
            opacity: 1,
          },
          '100%': {
            transform: 'translateX(-600px) translateY(300px)',
            opacity: 0,
          },
        },
      }}
    >
      {/* Couche 3 — grosses etoiles (element enfant car ::before/after sont pris) */}
      <Box
        sx={{
          position: 'absolute',
          width: '2.5px',
          height: '2.5px',
          borderRadius: '50%',
          boxShadow: large,
          animation: 'twinkle 8s ease-in-out infinite alternate',
        }}
      />

      {/* Etoile filante */}
      <Box
        sx={{
          position: 'absolute',
          top: '15%',
          right: '-5%',
          width: '100px',
          height: '1.5px',
          background: 'linear-gradient(to left, transparent, rgba(56, 189, 248, 0.8), transparent)',
          borderRadius: '50%',
          animation: 'shootingStar 8s ease-in-out infinite',
          animationDelay: '3s',
          opacity: 0,
        }}
      />
    </Box>
  );
}

export default StarField;
