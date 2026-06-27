import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Plotly from 'plotly.js-dist-min';
import { IconButton, Tooltip, Box } from '@mui/material';
import { Fullscreen as FullscreenIcon, FullscreenExit as ExitIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

/**
 * Bouton plein écran pour un graphe Plotly. Ajoute un bouton de sortie flottant
 * dans l'élément plein écran, la barre d'outils n'étant plus visible à ce moment.
 */
function FullscreenButton({ containerRef }) {
  const { t } = useTranslation();
  const [fsElement, setFsElement] = useState(null);
  const plotHeightsRef = useRef([]);
  const isFullscreen = Boolean(fsElement);

  const enter = useCallback(() => {
    const node = containerRef?.current;
    if (!node) return;
    // Hauteur des graphes avant le plein écran, pour la restaurer en sortie.
    plotHeightsRef.current = [...node.querySelectorAll('.js-plotly-plot')]
      .map(gd => gd.offsetHeight);
    node.requestFullscreen?.().catch(() => {});
  }, [containerRef]);

  const exit = useCallback(() => {
    document.exitFullscreen?.().catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) exit();
    else enter();
  }, [enter, exit]);

  useEffect(() => {
    const handler = () => {
      const fsEl = document.fullscreenElement || null;
      setFsElement(fsEl);
      if (fsEl) return;

      // À la sortie, Plotly conserve la grande taille du plein écran : on remet
      // chaque graphe à sa hauteur d'origine.
      const node = containerRef?.current;
      if (!node) return;
      const plots = [...node.querySelectorAll('.js-plotly-plot')];
      plots.forEach((gd, i) => {
        const h = plotHeightsRef.current[i];
        if (!h) return;
        gd.style.height = `${h}px`;
        Plotly.Plots.resize(gd)
          .then(() => { gd.style.height = ''; })
          .catch(() => {});
      });
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [containerRef]);

  return (
    <>
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

      {/* Bouton de sortie flottant — rendu DANS l'element plein ecran (top layer) */}
      {fsElement && createPortal(
        <Box
          sx={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 2147483647,
          }}
        >
          <Tooltip title={`${t('common.exitFullscreen')} (Échap)`} arrow placement="left">
            <IconButton
              onClick={exit}
              aria-label={t('common.exitFullscreen')}
              sx={{
                color: '#fff',
                backgroundColor: 'rgba(15, 23, 42, 0.78)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                backdropFilter: 'blur(6px)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
                '&:hover': {
                  backgroundColor: 'var(--mars-orange)',
                  borderColor: 'var(--mars-orange)',
                },
              }}
            >
              <ExitIcon />
            </IconButton>
          </Tooltip>
        </Box>,
        fsElement,
      )}
    </>
  );
}

export default FullscreenButton;
