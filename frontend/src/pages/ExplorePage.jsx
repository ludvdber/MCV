/**
 * Page d'exploration unifiée — orchestrateur.
 *
 * Architecture :
 *   ExploreProvider  → fournit l'état local (useReducer) via context
 *   ExplorePageContent → business logic (handlers) + effets
 *     ├─ ExploreParamsPanel  → panneau gauche, consomme context
 *     └─ ExploreResultsPanel → zone droite,  consomme context
 *
 * L'état partagé dataset/variable/time vient de MarsContext (useGlobal),
 * l'état propre à l'exploration (onglets, toggles, palette…) vient d'ExploreContext.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, Typography, useTheme, useMediaQuery } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import { Tune as TuneIcon, PushPin as PushPinIcon } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMars } from '../context/MarsContext';
import { useToast } from '../context/ToastContext';
import { VARIABLES_MAP } from '../components/VariableSelector';
import { triggerApiDownload, downloadAnimationCSV, downloadTextFile } from '../utils/exportUtils';
import {
  getSlice, getTimeSeries, getProfile, getCrossSection,
  getTemporalProfile, getTransect,
  exportSliceCSV, exportSliceNetCDF, exportTimeSeriesCSV, exportProfileCSV, exportCrossSectionCSV,
  exportHovmollerCSV, exportZonalMeanCSV, exportWindRoseCSV, exportDifferenceCSV, exportTemporalProfileCSV,
} from '../services/api';
import { ExploreProvider, useExploreState, useExploreDispatch, A } from './explore/ExploreContext.jsx';
import { largeDataStore } from './explore/largeDataStore.js';
import { fetchVizData } from './explore/fetchVizData.js';
import { useSessionPersistence } from './explore/useSessionPersistence.js';
import { useWindFields } from './explore/useWindFields.js';
import { SCENARIOS, useScenarioRunner, useResolvedScenarios } from './explore/scenarios.jsx';
import { VIZ_TYPES, MAX_TABS, ALTITUDE_REQUIRED_TYPES, MEAN_ONLY_TYPES } from './explore/exploreConstants.jsx';
import { INDIVIDUAL_PREFIX } from '../constants';
import ExploreParamsPanel from './explore/ExploreParamsPanel.jsx';
import ExploreResultsPanel from './explore/ExploreResultsPanel.jsx';
import ExploreSidePanel from './explore/ExploreSidePanel.jsx';
import GuidedTour from '../components/GuidedTour';
import { genLabel, weightedStats, nextResultId } from './explore/exploreUtils.js';
import { formatTime } from '../utils/formatTime';

/* Etapes de la visite guidee de la console. Les cibles portent un attribut
   data-tour="..." pose sur les composants. La visite est SCENARISEE : sur une
   console vide, l'etape « demo » charge une vraie vue (scenario slice du
   catalogue) pour que les etapes suivantes — outils contextuels, sessions —
   aient quelque chose a montrer (les outils n'existent au DOM qu'avec une vue
   active). Les etapes sont FIGEES a l'ouverture (buildTourSteps) : la liste ne
   doit pas bouger pendant la visite quand la vue demo arrive. */
const TOUR_STEP_PARAMS   = { selector: '[data-tour="params-rail"]', titleKey: 'explore.tour.params.title', bodyKey: 'explore.tour.params.body', panel: true };
const TOUR_STEP_VIZ      = { selector: '[data-tour="viz-type"]',    titleKey: 'explore.tour.viz.title',    bodyKey: 'explore.tour.viz.body',    panel: true };
const TOUR_STEP_LAUNCH   = { selector: '[data-tour="launch"]',      titleKey: 'explore.tour.launch.title', bodyKey: 'explore.tour.launch.body', panel: true };
const TOUR_STEP_DEMO     = { selector: '[data-tour="stage"]',       titleKey: 'explore.tour.demo.title',   bodyKey: 'explore.tour.demo.body',   demo: true };
const TOUR_STEP_LAYOUT   = { selector: '[data-tour="layout"]',      titleKey: 'explore.tour.layout.title', bodyKey: 'explore.tour.layout.body' };
const TOUR_STEP_TOOLS    = { selector: '[data-tour="tools"]',       titleKey: 'explore.tour.tools.title',  bodyKey: 'explore.tour.tools.body' };
const TOUR_STEP_SESSIONS = { selector: '[data-tour="sessions"]',    titleKey: 'explore.tour.sessions.title', bodyKey: 'explore.tour.sessions.body' };
const TOUR_STEP_PANEL    = { selector: '[data-tour="side-panel"]',  titleKey: 'explore.tour.panel.title',  bodyKey: 'explore.tour.panel.body' };
const TOUR_STEP_EXAMPLES = { selector: '[data-tour="examples"]', titleKey: 'explore.tour.examples.title', bodyKey: 'explore.tour.examples.body' };
const TOUR_DONE_KEY = 'mcv-explore-tour-done';
const GRID_REVEALED_KEY = 'mcv-grid-revealed';

/* ─── Contenu principal (à l'intérieur du Provider) ──────────────────────── */

function ExplorePageContent() {
  const { t } = useTranslation();
  const showToast = useToast();
  const state    = useExploreState();
  const dispatch = useExploreDispatch();

  const {
    catalogLoading,
    selectedDataset, setSelectedDataset,
    selectedVariable, handleVariableChange,
    selectedTime, setSelectedTime,
    selectedAltitude, setSelectedAltitude,
    selectedLatitude, setSelectedLatitude,
    selectedLongitude, setSelectedLongitude,
    dataset, datasetLabel,
    setSelectedIndividualMY,
    setSelectedIndividualLs,
  } = useMars();

  const [searchParams] = useSearchParams();
  const hasRestoredUrl = useRef(false);

  /* Sessions persistantes : restauration (permalien de session / localStorage)
   * + sauvegarde debouncee des recettes. getSessionParam alimente le bouton
   * « Copier le permalien » avec TOUTES les vues ouvertes. */
  const { getSessionParam } = useSessionPersistence();

  /* Scénarios (chips du hero de l'accueil : /explore?scenario=N). */
  const runScenario = useScenarioRunner();

  const { vizType, crossSectionType, hovmollerType, colorscale, zMinInput, zMaxInput,
    resultsById, resultOrder, loading, pendingAutoLaunch, datasetB } = state;

  const isIndividual = selectedDataset?.startsWith(INDIVIDUAL_PREFIX);

  // Optimisation R3 : depend de resultsById[activeResult] (reference stable
  // quand d'autres onglets sont ajoutes/supprimes) et non du tableau entier.
  const activeResultObj = useMemo(
    () => resultsById[state.activeResult] ?? null,
    [resultsById[state.activeResult], state.activeResult], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const isSurfaceVariable = useMemo(() => {
    const v = VARIABLES_MAP.get(selectedVariable);
    return v?.altitudeType === null;
  }, [selectedVariable]);

  /* ── Nettoyage du largeDataStore au demontage ──────────────────────────── */
  useEffect(() => {
    return () => { largeDataStore.clear(); };
  }, []);

  /* ── Restauration de l'URL (permalien) ─────────────────────────────────── */
  useEffect(() => {
    if (catalogLoading || hasRestoredUrl.current) return;
    hasRestoredUrl.current = true;

    // Chip de scenario depuis l'accueil : meme chemin que le panneau SCENARIOS.
    const scen = searchParams.get('scenario');
    if (scen) {
      const s = SCENARIOS.find(x => x.key === scen);
      if (s) runScenario(s.plan);
      return;
    }

    const ds = searchParams.get('ds');
    if (!ds) return;

    setSelectedDataset(ds);
    if (ds.startsWith(INDIVIDUAL_PREFIX)) {
      const m = ds.match(/IND_MY(\d+)_LS([\d.]+)/);
      if (m) {
        setSelectedIndividualMY(Number(m[1]));
        setSelectedIndividualLs(parseFloat(m[2]));
      }
    }
    const v = searchParams.get('var');
    if (v) handleVariableChange(v);
    const viz = searchParams.get('viz');
    if (viz && VIZ_TYPES.some(vt => vt.value === viz)) dispatch({ type: A.SET_VIZ_TYPE, value: viz });
    const t = searchParams.get('t');
    if (t != null) {
      const parsed = parseInt(t, 10);
      if (!isNaN(parsed)) setSelectedTime(Math.max(0, Math.min(47, parsed)));
    }
    const alt = searchParams.get('alt');
    if (alt != null) {
      const parsed = parseInt(alt, 10);
      if (!isNaN(parsed)) setSelectedAltitude(Math.max(0, Math.min(102, parsed)));
    }
    const lat = searchParams.get('lat');
    if (lat != null) {
      const parsed = parseFloat(lat);
      if (!isNaN(parsed)) setSelectedLatitude(Math.max(-90, Math.min(90, parsed)));
    }
    const lon = searchParams.get('lon');
    if (lon != null) {
      const parsed = parseFloat(lon);
      if (!isNaN(parsed)) setSelectedLongitude(Math.max(-180, Math.min(180, parsed)));
    }
    const cs = searchParams.get('cs');
    if (cs) dispatch({ type: A.SET_COLORSCALE, value: cs });
    const zmin = searchParams.get('zmin');
    if (zmin) dispatch({ type: A.SET_Z_MIN, value: zmin });
    const zmax = searchParams.get('zmax');
    if (zmax) dispatch({ type: A.SET_Z_MAX, value: zmax });
    const cstype = searchParams.get('cstype');
    if (cstype) dispatch({ type: A.SET_CROSS_SECTION, value: cstype });
    const hovtype = searchParams.get('hovtype');
    if (hovtype) dispatch({ type: A.SET_HOVMOLLER_TYPE, value: hovtype });

    dispatch({ type: A.SET_PENDING_AUTO, value: true });
  }, [catalogLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Handlers ──────────────────────────────────────────────────────────── */

  /* Revele la grille la PREMIERE fois qu'on atteint 2 vues (une seule fois ;
     ensuite on respecte le choix de disposition de l'utilisateur). */
  const gridRevealed = useRef(localStorage.getItem(GRID_REVEALED_KEY) === '1');

  /* Coeur du lancement, partage par « Nouvelle vue » (replaceId null → empile)
     et « Mettre a jour la vue active » (replaceId → remplace la vue en place). */
  const runViz = useCallback(async (replaceId) => {
    if (!selectedDataset || !selectedVariable) return;

    // Le plafond ne concerne QUE l'ajout : une mise a jour ne cree pas de vue.
    if (replaceId == null && resultOrder.length >= MAX_TABS) {
      // Toast EN PLUS de l'erreur d'etat : cette derniere n'est rendue que dans
      // le panneau de parametres, replie par defaut sur /explore. Sans le toast,
      // un lancement refuse restait totalement silencieux a l'ecran — pire, le
      // chemin des exemples affichait un succes vert juste avant.
      dispatch({ type: A.SET_ERROR, value: t('page.explore.tabLimit', { max: MAX_TABS }) });
      showToast(t('page.explore.tabLimit', { max: MAX_TABS }), 'warning');
      return;
    }
    if (isIndividual && MEAN_ONLY_TYPES.includes(vizType)) {
      dispatch({ type: A.SET_ERROR, value: t('page.explore.individualError') });
      return;
    }
    if (ALTITUDE_REQUIRED_TYPES.includes(vizType) && isSurfaceVariable) {
      dispatch({ type: A.SET_ERROR, value: t('page.explore.surfaceError') });
      return;
    }

    dispatch({ type: A.SET_LOADING, value: true });
    dispatch({ type: A.CLEAR_ERROR });

    const variable       = VARIABLES_MAP.get(selectedVariable);
    const altitudeToSend = variable?.altitudeType === null ? 0 : selectedAltitude;
    const timeToSend     = isIndividual ? 0 : selectedTime;

    const params = {
      dataset: selectedDataset, variable: selectedVariable,
      time: timeToSend, altitude: altitudeToSend,
      lat: selectedLatitude, lon: selectedLongitude,
      crossSectionType, hovmollerType: hovmollerType || 'latitude',
      datasetB: datasetB || undefined,
    };

    try {
      // Garde metier de la difference AVANT le fetch partage.
      if (vizType === 'difference' && (!datasetB || selectedDataset === datasetB)) {
        dispatch({ type: A.SET_LOADING, value: false });
        dispatch({ type: A.SET_ERROR, value: t('page.difference.sameDataset') });
        return;
      }
      // Mapping type → endpoint centralise (partage avec le rejeu de session).
      const data = await fetchVizData(vizType, params);

      const effectiveDatasetLabel = isIndividual
        ? (() => {
            const myNum = selectedDataset?.match(/IND_MY(\d+)/)?.[1];
            const lsNum = data?.actualLs != null
              ? data.actualLs.toFixed(2)
              : selectedDataset?.match(/LS([\d.]+)/)?.[1];
            return myNum ? `MY${myNum} — Ls ${lsNum}°` : selectedDataset;
          })()
        : datasetLabel;

      const id = replaceId ?? nextResultId();

      // R5 : les frames d'animation (~3M valeurs) sont stockees hors du state React.
      // Sur un remplacement on tient le store a jour pour le MEME id (nouvelle
      // animation, ou purge si la vue n'est plus une animation).
      if (vizType === 'animation') largeDataStore.set(id, data);
      else if (replaceId != null) largeDataStore.delete(id);

      const result = {
        id,
        type: vizType,
        label: genLabel(vizType, params, t, data?.altitudeValue),
        params,
        data: vizType === 'animation' ? null : data,
        datasetLabel: effectiveDatasetLabel,
      };

      if (replaceId != null) {
        dispatch({ type: A.REPLACE_RESULT, id: replaceId, result });
      } else {
        if (!gridRevealed.current && state.layout === 1 && resultOrder.length === 1) {
          gridRevealed.current = true;
          localStorage.setItem(GRID_REVEALED_KEY, '1');
          dispatch({ type: A.SET_LAYOUT, value: 4 });
          showToast(t('explore.layout.revealed'), 'info');
        }
        dispatch({ type: A.ADD_RESULT, result });
        dispatch({ type: A.SET_ACTIVE_RESULT, value: result.id });
      }
    } catch (err) {
      const detail = err.response?.data?.message || err.message;
      dispatch({ type: A.SET_ERROR, value: `[${vizType}] ${detail}` });
    } finally {
      dispatch({ type: A.SET_LOADING, value: false });
    }
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    selectedDataset, selectedVariable, selectedTime, selectedAltitude,
    selectedLatitude, selectedLongitude, vizType, crossSectionType, hovmollerType,
    resultOrder.length, isIndividual, isSurfaceVariable, datasetLabel, datasetB,
    state.layout, showToast, dispatch,
  ]);

  const handleLancer = useCallback(() => runViz(null), [runViz]);
  const handleUpdateActive = useCallback(() => {
    if (state.activeResult) runViz(state.activeResult);
  }, [runViz, state.activeResult]);

  /* Ref pour éviter les closures périmées dans l'effet d'auto-launch */
  const handleLancerRef = useRef(handleLancer);
  useEffect(() => { handleLancerRef.current = handleLancer; });

  /** Auto-lance après restauration de l'URL. */
  useEffect(() => {
    if (!pendingAutoLaunch || loading || catalogLoading) return;
    const isInd = selectedDataset?.startsWith(INDIVIDUAL_PREFIX);
    // Dataset non individuel introuvable dans le catalogue : on signale au lieu
    // de rester muet (l'identifiant vient d'une URL éditable à la main).
    if (!isInd && !dataset) {
      if (selectedDataset) {
        dispatch({ type: A.SET_PENDING_AUTO, value: false });
        dispatch({ type: A.SET_ERROR, value: t('error.datasetNotFound', { id: selectedDataset }) });
      }
      return;
    }
    dispatch({ type: A.SET_PENDING_AUTO, value: false });
    handleLancerRef.current();
  }, [pendingAutoLaunch, dataset, selectedDataset, loading, catalogLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Champs de vent des vues AFFICHEES : un par (dataset, pas de temps,
     altitude), telecharges et mis en cache par useWindFields. La regle « qui
     voit le vent » y vit une seule fois et sert aussi au rendu du panneau, si
     bien qu'une cellule ne peut pas etre dessinee sans que son champ ait ete
     demande. Remplace le champ unique de la vue active, qui laissait les autres
     cartes de la grille sans vent et sans explication. */
  useWindFields(state, dispatch);

  /** Relief : pression de surface P0 du dataset de la slice active, convertie
   *  en altitude barometrique cote client (z = −H·ln(P0/610), H ≈ 10,8 km).
   *  Le GZ de GEM-Mars est nul a la surface (hauteur au-dessus du sol local),
   *  P0 est donc le proxy topographique correct dans ces fichiers. */
  useEffect(() => {
    if (!state.showTopo || !activeResultObj || activeResultObj.type !== 'slice') {
      dispatch({ type: A.SET_TOPO_DATA, value: null });
      return;
    }
    const { dataset: ds, time } = activeResultObj.params;
    const controller = new AbortController();
    getSlice(
      { dataset: ds, variable: 'P0', time: ds?.startsWith(INDIVIDUAL_PREFIX) ? 0 : time, altitude: 0 },
      controller.signal,
    )
      .then(res => dispatch({ type: A.SET_TOPO_DATA, value: res.data }))
      .catch(() => {
        if (!controller.signal.aborted) dispatch({ type: A.SET_TOPO_DATA, value: null });
      });
    return () => controller.abort();
  }, [state.showTopo, activeResultObj]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRemoveResult = useCallback((id) => {
    largeDataStore.delete(id);   // libère les frames d'animation si présentes
    dispatch({ type: A.REMOVE_RESULT, id });
  }, [dispatch]);

  /** Transect grand-cercle : ligne A → B tracée sur la slice active →
   *  coupe verticale le long de la géodésique via GET /api/data/transect. */
  const handleTransectSelect = useCallback(async ({ lat1, lon1, lat2, lon2 }) => {
    const activeObj = resultsById[state.activeResult];
    if (!activeObj || activeObj.type !== 'slice' || activeObj.derived) return;
    if (resultOrder.length >= MAX_TABS) {
      showToast(t('page.explore.tabLimit', { max: MAX_TABS }), 'warning');
      return;
    }
    const { dataset: ds, variable, time } = activeObj.params;
    dispatch({ type: A.SET_LOADING, value: true });
    try {
      const data = (await getTransect({
        dataset: ds, variable, time,
        lat1: +lat1.toFixed(2), lon1: +lon1.toFixed(2),
        lat2: +lat2.toFixed(2), lon2: +lon2.toFixed(2),
      })).data;
      const params = { ...activeObj.params, lat1: data.lat1, lon1: data.lon1, lat2: data.lat2, lon2: data.lon2 };
      const result = {
        id: nextResultId(),
        type: 'transect',
        label: genLabel('transect', params, t),
        params,
        data,
        datasetLabel: activeObj.datasetLabel,
      };
      dispatch({ type: A.ADD_RESULT, result });
      dispatch({ type: A.SET_ACTIVE_RESULT, value: result.id });
      showToast(t('explore.transect.launched'), 'success');
    } catch (err) {
      const detail = err.response?.data?.message || err.message;
      dispatch({ type: A.SET_ERROR, value: detail });
      showToast(detail, 'error');
    } finally {
      dispatch({ type: A.SET_LOADING, value: false });
    }
  }, [resultsById, state.activeResult, resultOrder.length, dispatch, showToast, t]);

  /* ── Couches dérivées côté client ─────────────────────────────────────── */

  /** Statistiques {min,max,mean,stddev,median} d'une grille lat/lon, PONDÉRÉES
   *  par la surface (cos φ) comme côté serveur : sans pondération, les mailles
   *  polaires (petites) surpondèrent la moyenne. min/max restent non pondérés.
   *  Repli non pondéré si `latitudes` absent/incohérent. Ignore null/NaN. */
  const gridStats = (grid, latitudes = null) => {
    const canWeight = Array.isArray(latitudes) && latitudes.length === grid.length;
    const vals = [], wts = [];
    for (let i = 0; i < grid.length; i++) {
      const w = canWeight ? Math.max(0, Math.cos(latitudes[i] * Math.PI / 180)) : 1;
      for (const v of grid[i]) {
        if (v != null && !Number.isNaN(v)) { vals.push(v); wts.push(w); }
      }
    }
    const s = weightedStats(vals, wts);
    if (!s) return null;
    // Couches dérivées : on privilégie les moments PONDÉRÉS cos(lat).
    return { min: s.min, max: s.max, mean: s.weightedMean, stddev: s.weightedStddev, median: s.weightedMedian };
  };

  /**
   * Amplitude diurne : max − min par cellule sur les 48 pas d'heure locale
   * d'une animation deja chargee. Zero appel reseau : la donnee derivee
   * n'existe dans aucun fichier NetCDF, elle est calculee dans le navigateur.
   */
  const handleDeriveAmplitude = useCallback(() => {
    const activeObj = resultsById[state.activeResult];
    if (!activeObj || activeObj.type !== 'animation') return;
    if (resultOrder.length >= MAX_TABS) {
      showToast(t('page.explore.tabLimit', { max: MAX_TABS }), 'warning');
      return;
    }
    const anim = largeDataStore.get(activeObj.id) ?? activeObj.data;
    if (!anim?.frames?.length) return;

    const { frames, latitudes, longitudes } = anim;
    const nLat = latitudes.length, nLon = longitudes.length;
    const amp = Array.from({ length: nLat }, () => new Array(nLon).fill(null));
    for (let i = 0; i < nLat; i++) {
      for (let j = 0; j < nLon; j++) {
        let mn = Infinity, mx = -Infinity, count = 0;
        for (const frame of frames) {
          const v = frame[i]?.[j];
          if (v == null || Number.isNaN(v)) continue;
          count++;
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
        if (count >= 2) amp[i][j] = mx - mn;
      }
    }
    const stats = gridStats(amp, latitudes);
    if (!stats) return;

    const varLabel = VARIABLES_MAP.has(activeObj.params.variable)
      ? t(`variable.${activeObj.params.variable}`) : activeObj.params.variable;
    const altText = anim.altitudeValue != null ? `~${Number(anim.altitudeValue).toFixed(1)} km` : `alt${activeObj.params.altitude}`;

    const result = {
      id: nextResultId(),
      type: 'slice',
      derived: 'amplitude',
      label: `Δ24h ${varLabel} alt${activeObj.params.altitude}`,
      params: { ...activeObj.params },
      data: {
        data: amp, latitudes, longitudes, stats,
        altitudeIndex: anim.altitudeIndex ?? activeObj.params.altitude,
        altitudeValue: anim.altitudeValue ?? null,
        timeIndex: null,
      },
      datasetLabel: activeObj.datasetLabel,
      titleText: `${activeObj.datasetLabel} — ${t('explore.derived.amplitudeTitle', { variable: varLabel })} — ${altText}`,
    };
    dispatch({ type: A.ADD_RESULT, result });
    dispatch({ type: A.SET_ACTIVE_RESULT, value: result.id });
    showToast(t('explore.derived.amplitudeToast'), 'success');
  }, [resultsById, state.activeResult, resultOrder.length, dispatch, showToast, t]);

  /**
   * Vitesse du vent |V| = sqrt(UU² + VV²) : la composante manquante est
   * recuperee via l'API (meme dataset / pas / altitude), le module est
   * calcule dans le navigateur sous la pseudo-variable WSP.
   */
  const handleDeriveWindSpeed = useCallback(async () => {
    const activeObj = resultsById[state.activeResult];
    if (!activeObj || activeObj.type !== 'slice') return;
    const varCode = activeObj.params.variable;
    if (!['UU', 'VV'].includes(varCode)) return;
    if (resultOrder.length >= MAX_TABS) {
      showToast(t('page.explore.tabLimit', { max: MAX_TABS }), 'warning');
      return;
    }

    dispatch({ type: A.SET_LOADING, value: true });
    try {
      const other = varCode === 'UU' ? 'VV' : 'UU';
      const { dataset: ds, time, altitude } = activeObj.params;
      const otherData = (await getSlice({ dataset: ds, variable: other, time, altitude })).data;

      const a = activeObj.data.data, b = otherData.data;
      const nLat = Math.min(a.length, b.length);
      const wsp = Array.from({ length: nLat }, (_, i) => {
        const nLon = Math.min(a[i]?.length || 0, b[i]?.length || 0);
        return Array.from({ length: nLon }, (_, j) => {
          const u = a[i][j], v = b[i][j];
          return (u == null || v == null || Number.isNaN(u) || Number.isNaN(v))
            ? null : Math.hypot(u, v);
        });
      });
      const stats = gridStats(wsp, activeObj.data.latitudes);
      if (!stats) return;

      const result = {
        id: nextResultId(),
        type: 'slice',
        derived: 'wsp',
        label: `|V| ${formatTime(time)} alt${altitude}`,
        params: { ...activeObj.params, variable: 'WSP' },
        data: {
          ...activeObj.data,
          data: wsp, stats,
        },
        datasetLabel: activeObj.datasetLabel,
      };
      dispatch({ type: A.ADD_RESULT, result });
      dispatch({ type: A.SET_ACTIVE_RESULT, value: result.id });
      showToast(t('explore.derived.wspToast'), 'success');
    } catch (err) {
      dispatch({ type: A.SET_ERROR, value: err.response?.data?.message || err.message });
    } finally {
      dispatch({ type: A.SET_LOADING, value: false });
    }
  }, [resultsById, state.activeResult, resultOrder.length, dispatch, showToast, t]);

  const handleExportCSV = useCallback(() => {
    if (!activeResultObj) return;

    // Resultats derives cote client (amplitude diurne, |V|) : la donnee
    // n'existe pas cote serveur, le CSV est genere dans le navigateur.
    if (activeResultObj.derived) {
      const { data, latitudes, longitudes } = activeResultObj.data;
      const rows = ['latitude,longitude,value'];
      for (let i = 0; i < latitudes.length; i++) {
        for (let j = 0; j < longitudes.length; j++) {
          const v = data[i]?.[j];
          if (v != null && !Number.isNaN(v)) rows.push(`${latitudes[i]},${longitudes[j]},${v}`);
        }
      }
      downloadTextFile(rows.join('\n'), `derived_${activeResultObj.derived}_${activeResultObj.params.variable}.csv`);
      return;
    }

    const { type, params } = activeResultObj;
    const variable       = VARIABLES_MAP.get(params.variable);
    const altitudeToSend = variable?.altitudeType === null ? 0 : params.altitude;

    switch (type) {
      case 'slice':
        triggerApiDownload(
          exportSliceCSV({ dataset: params.dataset, variable: params.variable, time: params.time, altitude: altitudeToSend }),
          `slice_${params.variable}_t${params.time}_a${params.altitude}.csv`,
        );
        break;
      case 'timeseries':
        triggerApiDownload(
          exportTimeSeriesCSV({ dataset: params.dataset, variable: params.variable, latitude: params.lat, longitude: params.lon, altitude: altitudeToSend }),
          `timeseries_${params.variable}_lat${params.lat}_lon${params.lon}.csv`,
        );
        break;
      case 'profile':
        triggerApiDownload(
          exportProfileCSV({ dataset: params.dataset, variable: params.variable, time: params.time, latitude: params.lat, longitude: params.lon }),
          `profile_${params.variable}_lat${params.lat}_lon${params.lon}.csv`,
        );
        break;
      case 'crosssection':
        triggerApiDownload(
          exportCrossSectionCSV({ dataset: params.dataset, variable: params.variable, time: params.time, type: params.crossSectionType, fixedCoordinate: params.crossSectionType === 'meridional' ? params.lon : params.lat }),
          `crosssection_${params.variable}_${params.crossSectionType}.csv`,
        );
        break;
      case 'animation': {
        const animData = largeDataStore.get(activeResultObj.id) ?? activeResultObj.data;
        downloadAnimationCSV(animData.frames, params.variable, params.altitude);
        break;
      }
      case 'hovmoller':
        triggerApiDownload(
          exportHovmollerCSV({ dataset: params.dataset, variable: params.variable, altitude: altitudeToSend, type: params.hovmollerType || 'latitude' }),
          `hovmoller_${params.variable}_alt${params.altitude}.csv`,
        );
        break;
      case 'zonalmean':
        triggerApiDownload(
          exportZonalMeanCSV({ dataset: params.dataset, variable: params.variable, time: params.time }),
          `zonalmean_${params.variable}_t${params.time}.csv`,
        );
        break;
      case 'windrose':
        triggerApiDownload(
          exportWindRoseCSV({ dataset: params.dataset, latitude: params.lat, longitude: params.lon, altitude: altitudeToSend }),
          `windrose_lat${params.lat}_lon${params.lon}.csv`,
        );
        break;
      case 'difference':
        triggerApiDownload(
          exportDifferenceCSV({ datasetA: params.dataset, datasetB: params.datasetB, variable: params.variable, time: params.time, altitude: altitudeToSend }),
          `difference_${params.variable}_t${params.time}.csv`,
        );
        break;
      case 'temporalprofile':
        triggerApiDownload(
          exportTemporalProfileCSV({ dataset: params.dataset, variable: params.variable, latitude: params.lat, longitude: params.lon }),
          `temporalprofile_${params.variable}_lat${params.lat}_lon${params.lon}.csv`,
        );
        break;
      case 'transect': {
        // Vue calculee a la demande, sans endpoint d'export dedie : CSV client.
        const d = activeResultObj.data;
        const rows = ['distance_km,latitude,longitude,altitude_km,value'];
        for (let a = 0; a < d.altitudes.length; a++) {
          for (let p = 0; p < d.distances.length; p++) {
            const v = d.data[a]?.[p];
            if (v != null && !Number.isNaN(v)) {
              rows.push(`${d.distances[p].toFixed(1)},${d.lats[p].toFixed(3)},${d.lons[p].toFixed(3)},${d.altitudes[a]},${v}`);
            }
          }
        }
        downloadTextFile(rows.join('\n'), `transect_${params.variable}_t${params.time}.csv`);
        break;
      }
      case 'tides': {
        // Produit derive du serveur mais sans endpoint d'export : CSV client.
        const d = activeResultObj.data;
        const rows = ['latitude,longitude,mean,amplitude_diurnal,phase_diurnal_h,amplitude_semidiurnal,phase_semidiurnal_h'];
        for (let i = 0; i < d.latitudes.length; i++) {
          for (let j = 0; j < d.longitudes.length; j++) {
            rows.push(`${d.latitudes[i]},${d.longitudes[j]},${d.mean[i][j]},${d.amplitudeDiurnal[i][j]},${d.phaseDiurnal[i][j]},${d.amplitudeSemidiurnal[i][j]},${d.phaseSemidiurnal[i][j]}`);
          }
        }
        downloadTextFile(rows.join('\n'), `tides_${params.variable}_alt${params.altitude}.csv`);
        break;
      }
    }
  }, [activeResultObj]);

  const handleExportNetCDF = useCallback(() => {
    if (!activeResultObj || activeResultObj.type !== 'slice' || activeResultObj.derived) return;
    const { params } = activeResultObj;
    const variable = VARIABLES_MAP.get(params.variable);
    const altitudeToSend = variable?.altitudeType === null ? 0 : params.altitude;
    triggerApiDownload(
      exportSliceNetCDF({ dataset: params.dataset, variable: params.variable, time: params.time, altitude: altitudeToSend }),
      `slice_${params.variable}_t${params.time}_a${params.altitude}.nc`,
    );
  }, [activeResultObj]);

  const handleCopyLink = useCallback(() => {
    /* Des vues sont ouvertes : le permalien encode la SESSION ENTIERE
     * (toutes les vues + disposition), pas seulement les selections du
     * panneau — un lien partage restitue exactement l'ecran courant. */
    const sessionParam = getSessionParam();
    let url;
    if (sessionParam) {
      url = `${window.location.origin}/explore?session=${sessionParam}`;
    } else {
      const p = new URLSearchParams();
      if (selectedDataset) p.set('ds', selectedDataset);
      if (selectedVariable) p.set('var', selectedVariable);
      p.set('viz', vizType);
      p.set('t', String(selectedTime));
      p.set('alt', String(selectedAltitude));
      p.set('lat', String(selectedLatitude));
      p.set('lon', String(selectedLongitude));
      if (colorscale !== 'auto') p.set('cs', colorscale);
      if (zMinInput) p.set('zmin', zMinInput);
      if (zMaxInput) p.set('zmax', zMaxInput);
      if (vizType === 'crosssection') p.set('cstype', crossSectionType);
      if (vizType === 'hovmoller') p.set('hovtype', hovmollerType || 'latitude');
      url = `${window.location.origin}/explore?${p.toString()}`;
    }

    navigator.clipboard.writeText(url)
      .then(() => {
        dispatch({ type: A.SET_LINK_COPIED, value: true });
        setTimeout(() => dispatch({ type: A.SET_LINK_COPIED, value: false }), 2000);
      })
      .catch(() => {});
  }, [getSessionParam, selectedDataset, selectedVariable, vizType, selectedTime, selectedAltitude, selectedLatitude, selectedLongitude, colorscale, zMinInput, zMaxInput, crossSectionType, hovmollerType, dispatch]);

  /* ── Drill-down: click on heatmap → launch related viz using ACTIVE result's params ── */

  const handleDrillDown = useCallback(async ({ type, lat, lon }, sourceId = null) => {
    // Params de la vue SOURCE du clic : la cellule de grille cliquee si le
    // menu vient d'une cellule, sinon la vue active (vue simple).
    const activeObj = resultsById[sourceId ?? state.activeResult];
    if (!activeObj) return;

    if (resultOrder.length >= MAX_TABS) {
      showToast(t('page.explore.tabLimit', { max: MAX_TABS }), 'warning');
      return;
    }

    const { dataset, variable, time, altitude } = activeObj.params;
    if (!dataset || !variable) return;

    dispatch({ type: A.SET_LOADING, value: true });
    dispatch({ type: A.CLEAR_ERROR });

    try {
      let data;
      const params = { dataset, variable, time, altitude, lat, lon, crossSectionType: 'meridional' };

      switch (type) {
        case 'timeseries':
          data = (await getTimeSeries({ dataset, variable, latitude: lat, longitude: lon, altitude })).data;
          break;
        case 'profile':
          data = (await getProfile({ dataset, variable, time, latitude: lat, longitude: lon })).data;
          break;
        case 'crosssection':
          data = (await getCrossSection({ dataset, variable, time, type: 'meridional', fixedCoordinate: lon })).data;
          break;
        case 'temporalprofile':
          data = (await getTemporalProfile({ dataset, variable, latitude: lat, longitude: lon })).data;
          break;
        default: return;
      }

      const id = nextResultId();
      // Libelles i18n (reutilise les cles du selecteur de visualisation)
      const vizLabel = t(`explore.viz.${type}`);
      const result = {
        id,
        type,
        label: `${vizLabel} (${lat}°, ${lon}°)`,
        params,
        data,
        datasetLabel: activeObj.datasetLabel,
      };
      dispatch({ type: A.ADD_RESULT, result });
      dispatch({ type: A.SET_ACTIVE_RESULT, value: id });
      showToast(`${vizLabel} (${lat}°, ${lon}°)`, 'success');
    } catch (err) {
      dispatch({ type: A.SET_ERROR, value: err.response?.data?.message || err.message });
      showToast(err.response?.data?.message || err.message, 'error');
    } finally {
      dispatch({ type: A.SET_LOADING, value: false });
    }
  }, [resultsById, state.activeResult, resultOrder.length, dispatch, showToast, t]);

  /* ── État UI local — déclaré AVANT tout return conditionnel (rules-of-hooks).
     Sinon, sur un refresh direct de /explore, catalogLoading passe true→false
     et le nombre de hooks change entre deux rendus → crash React. ── */
  /* Panneau de paramètres en TIROIR (mise en page « A ») : réduit par défaut à
     une languette « Paramètres » ; survol/clic → il glisse en overlay au-dessus
     de la grille (sans la rétrécir), et se referme quand la souris le quitte.
     Sur mobile il reste empilé en pleine largeur. */
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  // Souris : survol = ouvre (aperçu). Clic sur la languette = ÉPINGLE le tiroir
  // ouvert (persistant) — c'est le geste que les utilisateurs tentaient sans
  // effet auparavant. Clavier : Entrée/Espace épinglent aussi.
  const [paramsOpen, setParamsOpen] = useState(false);
  const [paramsPinned, setParamsPinned] = useState(() => {
    try { return localStorage.getItem('mcv-params-pinned') === '1'; } catch { return false; }
  });
  const paramsCloseTimer = useRef(null);
  const openParams = useCallback(() => {
    clearTimeout(paramsCloseTimer.current);
    setParamsOpen(true);
  }, []);
  const scheduleCloseParams = useCallback(() => {
    clearTimeout(paramsCloseTimer.current);
    paramsCloseTimer.current = setTimeout(() => setParamsOpen(false), 240);
  }, []);
  const persistPinned = (v) => { try { localStorage.setItem('mcv-params-pinned', v ? '1' : '0'); } catch { /* quota/prive */ } };
  const togglePinned = useCallback(() => setParamsPinned(p => { persistPinned(!p); return !p; }), []);
  const pinParamsOpen = useCallback(() => { setParamsPinned(true); persistPinned(true); }, []);
  useEffect(() => () => clearTimeout(paramsCloseTimer.current), []);

  /* Visite guidee : ouverte automatiquement a la premiere venue (drapeau
     localStorage), rejouable via le bouton « ? ». Pendant une etape « panel »
     le tiroir de parametres est force ouvert pour montrer ses cibles internes. */
  const [tourOpen, setTourOpen] = useState(false);
  const [tourRunId, setTourRunId] = useState(0);   // change de `key` -> etape remise a 0 par remontage
  const [tourForcePanel, setTourForcePanel] = useState(false);
  const [tourSteps, setTourSteps] = useState([]);
  const demoRanRef = useRef(false);
  const resolvedScenarios = useResolvedScenarios();

  /* Scenario de demonstration : une slice de preference (chargement rapide,
     palette d'outils complete pour l'etape « tools »). Sans slice jouable, la
     visite reste en lecture seule comme avant. */
  const demoScenario = useMemo(
    () => resolvedScenarios.find(s => s.plan.viz === 'slice') ?? null,
    [resolvedScenarios],
  );

  /** Etapes de CE parcours, figees a l'ouverture. Demo seulement si la console
   *  est vide ; outils seulement si une vue existera (demo ou vues ouvertes). */
  const buildTourSteps = useCallback(() => {
    const withDemo = resultOrder.length === 0 && !!demoScenario;
    const withTools = withDemo || resultOrder.length > 0;
    return [
      TOUR_STEP_PARAMS, TOUR_STEP_VIZ, TOUR_STEP_LAUNCH,
      ...(withDemo ? [TOUR_STEP_DEMO] : []),
      TOUR_STEP_LAYOUT,
      ...(withTools ? [TOUR_STEP_TOOLS] : []),
      TOUR_STEP_SESSIONS,
      TOUR_STEP_PANEL,
      ...(resolvedScenarios.length > 0 ? [TOUR_STEP_EXAMPLES] : []),
    ];
  }, [resultOrder.length, demoScenario, resolvedScenarios.length]);

  const startTour = useCallback(() => {
    demoRanRef.current = false;
    setTourSteps(buildTourSteps());
    setTourRunId(n => n + 1);
    setTourOpen(true);
  }, [buildTourSteps]);

  const closeTour = useCallback(() => {
    setTourOpen(false);
    setTourForcePanel(false);
    try { localStorage.setItem(TOUR_DONE_KEY, '1'); } catch { /* quota/prive */ }
  }, []);
  const replayTour = startTour;
  const handleTourStep = useCallback((_, step) => {
    setTourForcePanel(!!step?.panel);
    // Etape scenarisee : charge la vue de demonstration (une seule fois par
    // parcours — revenir en arriere puis avancer ne relance pas le fetch).
    if (step?.demo && !demoRanRef.current && demoScenario) {
      demoRanRef.current = true;
      runScenario(demoScenario.plan);
    }
  }, [demoScenario, runScenario]);
  useEffect(() => {
    if (catalogLoading || !isDesktop || tourOpen) return undefined;   // la visite cible la disposition desktop
    try { if (localStorage.getItem(TOUR_DONE_KEY) === '1') return undefined; } catch { return undefined; }
    const id = setTimeout(startTour, 650);  // laisse la page se poser
    return () => clearTimeout(id);
  }, [catalogLoading, isDesktop, tourOpen, startTour]);

  /* Tant qu'aucune vue n'est ouverte, le tiroir reste déplié (et le survol ne
     peut pas le refermer) : sinon l'utilisateur arrive sur une grille vide dont
     le formulaire ET le bouton « Nouvelle vue » sont cachés derrière la languette.
     Dès la première vue, il se replie et repasse en overlay au survol/épingle. */
  const noResults = resultOrder.length === 0;
  const paramsExpanded = paramsOpen || paramsPinned || noResults || tourForcePanel;

  /* Épinglé (ou console vide) : le panneau est DOCKÉ dans le flux flex — la
     grille se rétrécit au lieu d'être recouverte (l'overlay masquait le titre
     de la vue et les axes des mini-graphes à 1440). L'overlay ne sert plus
     qu'à l'aperçu au survol et aux étapes « panel » de la visite. Plotly ne se
     recale que sur l'événement resize : on le déclenche après chaque bascule. */
  const paramsDocked = isDesktop && (paramsPinned || noResults);
  useEffect(() => {
    const raf = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    return () => cancelAnimationFrame(raf);
  }, [paramsDocked]);

  /* ── Rendu ─────────────────────────────────────────────────────────────── */

  if (catalogLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="explore-console mcv-shell" sx={{
      display: 'flex',
      flexDirection: 'column',
      height: { xs: 'auto', md: '100vh' },
      minHeight: { xs: '100vh', md: 'auto' },
      gap: 1.25,
      p: 1.25,
      boxSizing: 'border-box',
    }}>
      {/* La console n'affiche volontairement aucun bandeau de titre : l'espace
          revient aux vues. Le titre existe quand meme dans le document, sinon
          la page n'a pas de h1 et un lecteur d'ecran qui liste les titres n'y
          trouve que les en-tetes du panneau lateral. */}
      <Typography variant="h1" sx={visuallyHidden}>{t('page.explore.title')}</Typography>
      <Box className="mcv-body" sx={{
        flex: 1, minHeight: 0,
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 1.25,
        position: 'relative',
      }}>
        {isDesktop && (
          <>
            {/* Languette « Paramètres » : toujours présente, ouvre le tiroir. */}
            <Box
              className="mcv-params-rail"
              data-tour="params-rail"
              role="button"
              tabIndex={0}
              aria-label={t('explore.panel.params')}
              aria-expanded={paramsExpanded}
              aria-pressed={paramsPinned}
              onClick={togglePinned}
              onMouseEnter={openParams}
              onMouseLeave={scheduleCloseParams}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePinned(); } }}
              sx={{
                flexShrink: 0, width: 44, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                py: 1.4, borderRadius: 2,
                border: '1px solid var(--glass-border)', background: 'var(--bg-surface)',
                borderColor: paramsPinned ? 'rgba(224,90,43,0.55)' : 'var(--glass-border)',
                color: paramsExpanded ? 'var(--mars-orange)' : 'var(--text-secondary)',
                transition: 'color .2s ease, border-color .2s ease',
                '&:hover': { color: 'var(--mars-orange)', borderColor: 'rgba(224,90,43,0.4)' },
              }}
            >
              {paramsPinned ? <PushPinIcon fontSize="small" /> : <TuneIcon fontSize="small" />}
              <Typography sx={{
                writingMode: 'vertical-rl', transform: 'rotate(180deg)',
                fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em',
                textTransform: 'uppercase', whiteSpace: 'nowrap',
              }}>
                {t('explore.panel.params')}
              </Typography>
            </Box>

            {/* Tiroir de paramètres : DOCKÉ dans le flux quand il est épinglé
                (ou console vide) — la grille se rétrécit, rien n'est recouvert.
                Sinon, overlay d'aperçu au survol : glisse au-dessus de la
                grille et se referme au survol sortant. */}
            <Box
              onMouseEnter={paramsDocked ? undefined : openParams}
              onMouseLeave={paramsDocked ? undefined : scheduleCloseParams}
              sx={paramsDocked ? {
                position: 'relative', width: 300, flexShrink: 0,
                borderRadius: 2, overflow: 'hidden',
                background: 'rgba(9, 14, 26, 0.94)',
                border: '1px solid var(--glass-border)',
              } : {
                position: 'absolute', left: 52, top: 0, bottom: 0, width: 300, zIndex: 30,
                borderRadius: 2, overflow: 'hidden',
                background: 'rgba(9, 14, 26, 0.94)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: '1px solid var(--glass-border)',
                boxShadow: paramsExpanded ? '18px 0 46px -20px rgba(0,0,0,0.75)' : 'none',
                opacity: paramsExpanded ? 1 : 0,
                visibility: paramsExpanded ? 'visible' : 'hidden',
                transform: paramsExpanded ? 'translateX(0)' : 'translateX(-16px)',
                pointerEvents: paramsExpanded ? 'auto' : 'none',
                transition: 'opacity .22s ease, transform .26s cubic-bezier(.4,0,.2,1), visibility .22s',
              }}
            >
              <ExploreParamsPanel onLancer={handleLancer} onUpdateActive={handleUpdateActive} onCopyLink={handleCopyLink} />
            </Box>
          </>
        )}

        {!isDesktop && (
          <Box sx={{ width: '100%', flexShrink: 0, overflow: 'auto' }}>
            <ExploreParamsPanel onLancer={handleLancer} onUpdateActive={handleUpdateActive} onCopyLink={handleCopyLink} />
          </Box>
        )}

        <Box data-tour="stage" sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <ExploreResultsPanel
            onRemoveResult={handleRemoveResult}
            onExportCSV={handleExportCSV}
            onExportNetCDF={handleExportNetCDF}
            onDrillDown={handleDrillDown}
            onTransectSelect={handleTransectSelect}
            onRequestParams={isDesktop ? pinParamsOpen : undefined}
            onReplayTour={isDesktop ? replayTour : undefined}
          />
        </Box>

        {/* Panneau lateral : outils, sonde liee, region, scenarios */}
        <ExploreSidePanel
          onDeriveAmplitude={handleDeriveAmplitude}
          onDeriveWindSpeed={handleDeriveWindSpeed}
        />
      </Box>

      {/* Visite guidee de la console (premiere venue + rejeu via « ? »). La `key`
          change a chaque ouverture pour repartir a la premiere etape. */}
      <GuidedTour key={tourRunId} open={tourOpen} steps={tourSteps} onClose={closeTour} onStepChange={handleTourStep} />
    </Box>
  );
}

/* ─── Export : Provider wrapper ───────────────────────────────────────────── */

export default function ExplorePage() {
  return (
    <ExploreProvider>
      <ExplorePageContent />
    </ExploreProvider>
  );
}
