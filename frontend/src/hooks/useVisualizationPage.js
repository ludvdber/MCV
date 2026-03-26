import { useState, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMars } from '../context/MarsContext';
import { useToast } from '../context/ToastContext';
import { usePlotRef } from './usePlotRef';
import { useCopyToClipboard } from './useCopyToClipboard';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useRecentHistory } from './useRecentHistory';

/**
 * Hook partagé pour toutes les pages de visualisation.
 *
 * Encapsule le boilerplate commun :
 * - data / loading / error / isDirty state
 * - Restauration d'URL (permalien)
 * - Auto-launch après restauration
 * - Raccourcis clavier (Enter, f)
 * - Copie de permalien
 * - Refs pour export Plotly + fullscreen
 *
 * @param {Object} config
 * @param {string} config.route - Route de la page (ex: '/slice')
 * @param {function} config.restoreUrl - (searchParams, setters) => boolean — restaure les params depuis l'URL
 * @param {function} config.fetchData - () => Promise<data> — appelle l'API, retourne les données
 * @param {function} config.buildPermalink - () => string — construit l'URL du permalien
 * @param {function} config.buildHistoryEntry - (data) => { page, dataset, variable, params, label }
 * @param {function} [config.canLaunch] - () => boolean — condition pour activer le bouton
 */
export function useVisualizationPage({
  route,
  restoreUrl,
  fetchData,
  buildPermalink,
  buildHistoryEntry,
  canLaunch,
}) {
  const { catalogLoading, dataset } = useMars();
  const { t } = useTranslation();
  const showToast = useToast();
  const { addEntry } = useRecentHistory();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

  const [viewerContainerRef, exportPlotRef] = usePlotRef();
  const [linkCopied, copyToClipboard] = useCopyToClipboard();
  const [searchParams] = useSearchParams();
  const hasRestoredUrl = useRef(false);
  const pendingAutoLaunch = useRef(false);

  // --- URL restoration (runs once when catalog loads) ---
  if (!catalogLoading && !hasRestoredUrl.current) {
    hasRestoredUrl.current = true;
    const restored = restoreUrl(searchParams);
    if (restored) {
      pendingAutoLaunch.current = true;
    }
  }

  // --- Launch handler ---
  const handleLaunch = useCallback(() => {
    if (canLaunch && !canLaunch()) return;
    setLoading(true);
    setError(null);
    setIsDirty(false);

    fetchData()
      .then(res => {
        const responseData = res.data;
        setData(responseData);
        const entry = buildHistoryEntry(responseData);
        if (entry) {
          // Build permalink path (without origin) for history navigation
          try {
            const fullUrl = buildPermalink();
            const url = new URL(fullUrl);
            entry.permalink = url.pathname + url.search;
          } catch { /* fallback: entry.page is used */ }
          addEntry(entry);
        }
      })
      .catch(err => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [fetchData, buildHistoryEntry, canLaunch, addEntry]);

  // --- Auto-launch after URL restoration ---
  if (pendingAutoLaunch.current && dataset && !loading) {
    pendingAutoLaunch.current = false;
    setTimeout(handleLaunch, 0);
  }

  // --- Permalink copy ---
  const handleCopyLink = useCallback(() => {
    const url = buildPermalink();
    copyToClipboard(url);
    showToast(t('toast.linkCopied'));
  }, [buildPermalink, copyToClipboard, showToast]);

  // --- Keyboard shortcuts ---
  const shortcuts = useMemo(() => ({
    Enter: () => { if (!loading && (!canLaunch || canLaunch())) handleLaunch(); },
    f: () => {
      if (viewerContainerRef.current) {
        if (!document.fullscreenElement) viewerContainerRef.current.requestFullscreen?.();
        else document.exitFullscreen?.();
      }
    },
  }), [loading, canLaunch, handleLaunch, viewerContainerRef]);
  useKeyboardShortcuts(shortcuts);

  // --- Mark dirty ---
  const markDirty = useCallback(() => { if (data) setIsDirty(true); }, [data]);

  return {
    data, setData,
    loading, error,
    isDirty, markDirty,
    viewerContainerRef, exportPlotRef,
    linkCopied,
    handleLaunch,
    handleCopyLink,
    catalogLoading,
  };
}
