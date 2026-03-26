import { useState, useCallback, useEffect } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { Fullscreen as FullscreenIcon, FullscreenExit as ExitIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

/**
 * Bouton plein ecran pour un conteneur (graphe Plotly).
 * Utilise l'API Fullscreen native du navigateur.
 *
 * @param {React.RefObject} containerRef - ref sur le div a mettre en plein ecran
 */
function FullscreenButton({ containerRef }) {
  const { t } = useTranslation();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggle = useCallback(() => {
    if (!containerRef?.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [containerRef]);

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  return (
    <Tooltip title={isFullscreen ? t('common.exitFullscreen') : t('common.fullscreen')} arrow>
      <IconButton
        onClick={toggle}
        size="small"
        sx={{
          color: 'var(--text-secondary)',
          '&:hover': { color: 'var(--text-primary)', backgroundColor: 'rgba(56, 189, 248, 0.08)' },
        }}
        aria-label={isFullscreen ? t('common.exitFullscreen') : t('common.fullscreen')}
      >
        {isFullscreen ? <ExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}

export default FullscreenButton;
