import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMars } from '../context/MarsContext';
import { useToast } from '../context/ToastContext';
import { usePlotRef } from './usePlotRef';
import { useCopyToClipboard } from './useCopyToClipboard';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useRecentHistory } from './useRecentHistory';
import { scrollViewerIntoView } from '../utils/scrollToViewer';

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
 * @param {function} config.restoreUrl - (searchParams, setters) => boolean — restaure les params depuis l'URL
 * @param {function} config.fetchData - () => Promise<data> — appelle l'API, retourne les données
 * @param {function} config.buildPermalink - () => string — construit l'URL du permalien
 * @param {function} config.buildHistoryEntry - (data) => { page, dataset, variable, params, label }
 * @param {function} [config.canLaunch] - () => boolean — condition pour activer le bouton
 */
export function useVisualizationPage({
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
  // Contrôleur de la requête en vol : annulée au démontage de la page (évite de
  // laisser tourner un chargement lourd, ex. animation 48 frames, après départ).
  const launchAbortRef = useRef(null);
  // Keep a live ref to restoreUrl (recreated each render by the page) so the
  // restoration effect can depend only on searchParams, not on the function.
  // Assignation dans un effet (pas au rendu — react-hooks/refs) : cet effet
  // sans deps est déclaré AVANT l'effet de restauration, il tourne donc en
  // premier après chaque commit.
  const restoreUrlRef = useRef(restoreUrl);
  useEffect(() => { restoreUrlRef.current = restoreUrl; });
  const lastSearchRef = useRef(undefined);
  // Incrémenté après une restauration pour déclencher l'effet d'auto-launch,
  // même si tous les setters de restoreUrl sont des no-op (params identiques
  // à la sélection courante du contexte, ex. clic sur l'entrée d'historique
  // de la vue déjà affichée).
  const [restoreTick, setRestoreTick] = useState(0);

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
      // Tick volontaire : reveille l'effet d'auto-launch meme quand les setters
      // de restauration sont des no-op (params identiques au contexte courant).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRestoreTick(n => n + 1);
    }
  }, [catalogLoading, searchParams]);

  // --- Launch handler ---
  const handleLaunch = useCallback(() => {
    if (canLaunch && !canLaunch()) return;
    setLoading(true);
    setError(null);
    setIsDirty(false);

    const controller = new AbortController();
    launchAbortRef.current = controller;

    fetchData(controller.signal)
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
      .catch(err => {
        if (err?.code === 'ERR_CANCELED') return; // annulation volontaire : on ignore
        setError(err.response?.data?.message || err.message);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }, [fetchData, buildHistoryEntry, buildPermalink, canLaunch, addEntry]);

  // Annule la requête encore en vol lorsque la page est démontée.
  useEffect(() => () => launchAbortRef.current?.abort(), []);

  // Mobile : amène le viewer à l'écran quand un résultat arrive (sinon le
  // graphique se rend sous la ligne de flottaison et rien ne semble se passer).
  useEffect(() => {
    if (data) scrollViewerIntoView(viewerContainerRef.current);
  }, [data, viewerContainerRef]);

  // --- Auto-launch after URL restoration ---
  // Ne lance qu'au rendu où restoreTick est PROPAGÉ (handledTickRef) : le tick
  // et les valeurs restaurées sont commités dans le même lot React, donc à ce
  // rendu-là les sélections lues par handleLaunch sont bien celles du permalien.
  // Sans ce verrou, l'effet pouvait se déclencher dans la MÊME phase d'effets
  // que la restauration (ses deps dataset/selectedDataset venant de changer,
  // ex. dataset par défaut posé au chargement du catalogue) et lancer avec les
  // valeurs d'AVANT restauration. handleLaunch est recréé à chaque rendu par la
  // page : la version exécutée lit les sélections du rendu courant.
  const handledTickRef = useRef(0);
  useEffect(() => {
    if (restoreTick === handledTickRef.current) return;
    if (!pendingAutoLaunch.current || loading || catalogLoading) return;
    if (!dataset && !selectedDataset) return;
    handledTickRef.current = restoreTick;
    pendingAutoLaunch.current = false;
    if (dataset) setTimeout(handleLaunch, 0);
    else setTimeout(() => setError(t('error.datasetNotFound', { id: selectedDataset })), 0);
  }, [restoreTick, loading, catalogLoading, dataset, selectedDataset, handleLaunch, t]);

  // --- Permalink copy ---
  const handleCopyLink = useCallback(() => {
    const url = buildPermalink();
    copyToClipboard(url);
    showToast(t('toast.linkCopied'));
  }, [buildPermalink, copyToClipboard, showToast, t]);

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
