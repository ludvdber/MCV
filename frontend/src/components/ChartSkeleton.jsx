import { Box, Skeleton } from '@mui/material';

/**
 * Skeleton loader qui imite la forme d'un graphe Plotly pendant le chargement.
 * Affiche un rectangle avec la colorbar a droite et des axes en bas/gauche.
 *
 * @param {string} variant - 'heatmap' | 'line' | 'bar' (forme du contenu)
 * @param {number} height  - hauteur du conteneur en px
 */
function ChartSkeleton({ variant = 'heatmap', height = 450 }) {
  return (
    <Box
      sx={{
        width: '100%',
        height,
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--glass-border)',
        display: 'flex',
        flexDirection: 'column',
        p: 2,
      }}
    >
      {/* Titre */}
      <Skeleton
        variant="text"
        width="45%"
        height={28}
        sx={{ bgcolor: 'var(--bg-surface-hover)', mx: 'auto', mb: 1 }}
      />

      {/* Zone graphe */}
      <Box sx={{ flex: 1, display: 'flex', gap: 1 }}>
        {/* Axe Y labels */}
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 40, py: 1 }}>
          {[0, 1, 2, 3, 4].map(i => (
            <Skeleton key={i} variant="text" width={30} height={14} sx={{ bgcolor: 'var(--bg-surface-hover)' }} />
          ))}
        </Box>

        {/* Zone de plot */}
        <Box sx={{ flex: 1, position: 'relative' }}>
          {variant === 'heatmap' && (
            <Skeleton
              variant="rectangular"
              width="100%"
              height="100%"
              sx={{ bgcolor: 'var(--bg-surface-hover)', borderRadius: 1 }}
              animation="wave"
            />
          )}
          {variant === 'line' && (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 0.5, p: 1 }}>
              {[65, 40, 72, 30, 55, 48, 60, 35, 50, 45].map((h, i) => (
                <Skeleton
                  key={i}
                  variant="rectangular"
                  width="100%"
                  height={4}
                  sx={{ bgcolor: 'var(--bg-surface-hover)', borderRadius: 1, transform: `translateY(${(i * 7) - h}%)` }}
                  animation="wave"
                />
              ))}
            </Box>
          )}
          {variant === 'bar' && (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end', gap: 0.5, p: 1 }}>
              {[60, 80, 45, 90, 55, 70, 35, 85, 50, 75, 40, 65].map((h, i) => (
                <Skeleton
                  key={i}
                  variant="rectangular"
                  width="100%"
                  height={`${h}%`}
                  sx={{ bgcolor: 'var(--bg-surface-hover)', borderRadius: '4px 4px 0 0' }}
                  animation="wave"
                />
              ))}
            </Box>
          )}
        </Box>

        {/* Colorbar (heatmap only) */}
        {variant === 'heatmap' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, width: 30 }}>
            <Skeleton
              variant="rectangular"
              width={14}
              height="85%"
              sx={{ bgcolor: 'var(--bg-surface-hover)', borderRadius: 1 }}
              animation="wave"
            />
            <Skeleton variant="text" width={28} height={12} sx={{ bgcolor: 'var(--bg-surface-hover)' }} />
          </Box>
        )}
      </Box>

      {/* Axe X labels */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, px: 5 }}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} variant="text" width={35} height={14} sx={{ bgcolor: 'var(--bg-surface-hover)' }} />
        ))}
      </Box>
    </Box>
  );
}

export default ChartSkeleton;
