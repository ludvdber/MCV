import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
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
  const { catalogLoading, dataset, selectedDataset } = useMars();
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
  const pendingAutoLaunch = useRef(false);
  // Keep a live ref to restoreUrl (recreated each render by the page) so the
  // restoration effect can depend only on searchParams, not on the function.
  const restoreUrlRef = useRef(restoreUrl);
  restoreUrlRef.current = restoreUrl;
  const lastSearchRef = useRef(undefined);
  // Incrémenté après une restauration pour FORCER un rendu, même si tous les
  // setters de restoreUrl sont des no-op (params identiques à la sélection
  // courante du contexte). Sans ça, l'auto-launch en bas — évalué au rendu —
  // n'aurait jamais l'occasion de tourner quand on clique une entrée
  // d'historique correspondant exactement à la vue déjà affichée.
  const [, forceRestoreRender] = useState(0);

  // --- URL restoration ---
  // Runs on mount AND whenever the query string changes — including when the
  // user clicks a history entry for the page they are already on (same route,
  // new params). Guarded by lastSearchRef so it only fires on real changes.
  useEffect(() => {
    if (catalogLoading) return;
    const search = searchParams.toString();
    if (search === lastSearchRef.current) return;
    lastSearchRef.current = search;
    if (restoreUrlRef.current(searchParams)) {
      pendingAutoLaunch.current = true;
      forceRestoreRender(n => n + 1);
    }
  }, [catalogLoading, searchParams]);

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
  // Évalué pendant le rendu (et NON dans un effet) à dessein : il faut le rendu
  // où les valeurs de l'URL sont déjà appliquées au contexte. Un useEffect se
  // déclencherait dès le commit du montage, avant que setState n'ait propagé le
  // dataset/point restaurés, et lancerait avec les valeurs de la page précédente
  // (bug observé en revenant sur une vue depuis l'historique).
  const shouldAutoLaunch = pendingAutoLaunch.current && !loading && !catalogLoading;
  if (shouldAutoLaunch && (dataset || selectedDataset)) {
    pendingAutoLaunch.current = false;
    if (dataset) setTimeout(handleLaunch, 0);
    else setTimeout(() => setError(t('error.datasetNotFound', { id: selectedDataset })), 0);
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
