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
import { Box, CircularProgress } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMars } from '../context/MarsContext';
import { useToast } from '../context/ToastContext';
import { VARIABLES_MAP } from '../components/VariableSelector';
import { triggerApiDownload, downloadAnimationCSV } from '../utils/exportUtils';
import {
  getSlice, getTimeSeries, getAnimation, getProfile, getCrossSection, getWind,
  getHovmoller, getZonalMean, getWindRose, getDifference, getTemporalProfile,
  exportSliceCSV, exportSliceNetCDF, exportTimeSeriesCSV, exportProfileCSV, exportCrossSectionCSV,
  exportHovmollerCSV, exportZonalMeanCSV, exportWindRoseCSV, exportDifferenceCSV, exportTemporalProfileCSV,
} from '../services/api';
import { ExploreProvider, useExploreState, useExploreDispatch, A } from './explore/ExploreContext.jsx';
import { largeDataStore } from './explore/largeDataStore.js';
import { VIZ_TYPES, MAX_TABS, ALTITUDE_REQUIRED_TYPES } from './explore/exploreConstants.jsx';
import { INDIVIDUAL_PREFIX } from '../constants';
import ExploreParamsPanel from './explore/ExploreParamsPanel.jsx';
import ExploreResultsPanel from './explore/ExploreResultsPanel.jsx';
import { formatTime } from '../components/TimeSelector';

/* ─── Helpers purs ────────────────────────────────────────────────────────── */

/** Génère un label court pour l'onglet d'un résultat. */
function genLabel(type, params, t) {
  const varLabel = VARIABLES_MAP.has(params.variable) ? t(`variable.${params.variable}`) : params.variable;
  switch (type) {
    case 'slice':
      return `${varLabel} ${formatTime(params.time)} alt${params.altitude}`;
    case 'timeseries':
      return `${varLabel} (${params.lat}°, ${params.lon}°)`;
    case 'animation':
      return `${varLabel} alt${params.altitude}`;
    case 'profile':
      return `${t('explore.tab_profile_short')} ${varLabel} (${params.lat}°, ${params.lon}°)`;
    case 'crosssection': {
      const dir   = params.crossSectionType === 'meridional' ? t('explore.tab_meridional_short') : t('explore.tab_zonal_short');
      const fixed = params.crossSectionType === 'meridional'
        ? `lon${params.lon}°` : `lat${params.lat}°`;
      return `${dir} ${varLabel} ${fixed}`;
    }
    case 'hovmoller':
      return `${t('explore.tab_hovmoller_short')} ${varLabel} alt${params.altitude}`;
    case 'zonalmean':
      return `${t('explore.tab_zonalmean_short')} ${varLabel} ${formatTime(params.time)}`;
    case 'windrose':
      return `${t('explore.tab_windrose_short')} (${params.lat}°, ${params.lon}°)`;
    case 'difference':
      return `Δ ${varLabel}`;
    case 'temporalprofile':
      return `T-Prof ${varLabel} (${params.lat}°, ${params.lon}°)`;
    default: return varLabel;
  }
}

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
    selectedIndividualMY, setSelectedIndividualMY,
    selectedIndividualLs, setSelectedIndividualLs,
  } = useMars();

  const [searchParams] = useSearchParams();
  const hasRestoredUrl = useRef(false);

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

  const handleLancer = useCallback(async () => {
    if (!selectedDataset || !selectedVariable) return;

    if (resultOrder.length >= MAX_TABS) {
      dispatch({ type: A.SET_ERROR, value: t('page.explore.tabLimit', { max: MAX_TABS }) });
      return;
    }
    if (isIndividual && ['timeseries', 'animation', 'hovmoller', 'windrose'].includes(vizType)) {
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
      let data;
      switch (vizType) {
        case 'slice':
          data = (await getSlice({ dataset: selectedDataset, variable: selectedVariable, time: timeToSend, altitude: altitudeToSend })).data;
          break;
        case 'timeseries':
          data = (await getTimeSeries({ dataset: selectedDataset, variable: selectedVariable, latitude: selectedLatitude, longitude: selectedLongitude, altitude: altitudeToSend })).data;
          break;
        case 'animation':
          data = (await getAnimation({ dataset: selectedDataset, variable: selectedVariable, altitude: altitudeToSend })).data;
          break;
        case 'profile':
          data = (await getProfile({ dataset: selectedDataset, variable: selectedVariable, time: timeToSend, latitude: selectedLatitude, longitude: selectedLongitude })).data;
          break;
        case 'crosssection':
          data = (await getCrossSection({ dataset: selectedDataset, variable: selectedVariable, time: timeToSend, type: crossSectionType, fixedCoordinate: crossSectionType === 'meridional' ? selectedLongitude : selectedLatitude })).data;
          break;
        case 'hovmoller':
          data = (await getHovmoller({ dataset: selectedDataset, variable: selectedVariable, altitude: altitudeToSend, type: state.hovmollerType || 'latitude' })).data;
          break;
        case 'zonalmean':
          data = (await getZonalMean({ dataset: selectedDataset, variable: selectedVariable, time: timeToSend })).data;
          break;
        case 'windrose':
          data = (await getWindRose({ dataset: selectedDataset, latitude: selectedLatitude, longitude: selectedLongitude, altitude: altitudeToSend })).data;
          break;
        case 'temporalprofile':
          data = (await getTemporalProfile({ dataset: selectedDataset, variable: selectedVariable, latitude: selectedLatitude, longitude: selectedLongitude })).data;
          break;
        case 'difference':
          if (!datasetB || selectedDataset === datasetB) {
            dispatch({ type: A.SET_LOADING, value: false });
            dispatch({ type: A.SET_ERROR, value: t('page.difference.sameDataset') });
            return;
          }
          data = (await getDifference({ datasetA: selectedDataset, datasetB, variable: selectedVariable, time: timeToSend, altitude: altitudeToSend })).data;
          break;
      }

      const effectiveDatasetLabel = isIndividual
        ? (() => {
            const myNum = selectedDataset?.match(/IND_MY(\d+)/)?.[1];
            const lsNum = data?.actualLs != null
              ? data.actualLs.toFixed(2)
              : selectedDataset?.match(/LS([\d.]+)/)?.[1];
            return myNum ? `MY${myNum} — Ls ${lsNum}°` : selectedDataset;
          })()
        : datasetLabel;

      const id = Date.now().toString();

      // R5 : les frames d'animation (~3M valeurs) sont stockees hors du state React
      // pour eviter que useReducer les reconcilie a chaque action dispatche.
      // Les autres types (slice, timeseries, profile, crosssection) restent dans state.
      if (vizType === 'animation') largeDataStore.set(id, data);

      const result = {
        id,
        type: vizType,
        label: genLabel(vizType, params, t),
        params,
        data: vizType === 'animation' ? null : data,
        datasetLabel: effectiveDatasetLabel,
      };

      dispatch({ type: A.ADD_RESULT, result });
      dispatch({ type: A.SET_ACTIVE_RESULT, value: result.id });
    } catch (err) {
      const detail = err.response?.data?.message || err.message;
      dispatch({ type: A.SET_ERROR, value: `[${vizType}] ${detail}` });
    } finally {
      dispatch({ type: A.SET_LOADING, value: false });
    }
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    selectedDataset, selectedVariable, selectedTime, selectedAltitude,
    selectedLatitude, selectedLongitude, vizType, crossSectionType, hovmollerType,
    resultOrder.length, isIndividual, isSurfaceVariable, datasetLabel, datasetB, dispatch,
  ]);

  /* Ref pour éviter les closures périmées dans l'effet d'auto-launch */
  const handleLancerRef = useRef(handleLancer);
  useEffect(() => { handleLancerRef.current = handleLancer; });

  /** Auto-lance après restauration de l'URL. */
  useEffect(() => {
    if (!pendingAutoLaunch || loading) return;
    const isInd = selectedDataset?.startsWith(INDIVIDUAL_PREFIX);
    if (!isInd && !dataset) return;
    dispatch({ type: A.SET_PENDING_AUTO, value: false });
    handleLancerRef.current();
  }, [pendingAutoLaunch, dataset, selectedDataset]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Fetch du champ de vent lors de l'activation du toggle sur une slice.
   *  AbortController pour annuler la requete precedente si le toggle ou l'onglet actif change
   *  avant la fin du chargement (evite les race conditions). */
  useEffect(() => {
    if (!state.showWind || !activeResultObj || activeResultObj.type !== 'slice') {
      dispatch({ type: A.SET_WIND_DATA, value: null });
      return;
    }
    const varCode = activeResultObj.params.variable;
    if (['UU', 'VV'].includes(varCode)) {
      dispatch({ type: A.SET_WIND_DATA, value: null });
      return;
    }
    const { dataset: ds, time, altitude } = activeResultObj.params;
    const controller = new AbortController();
    getWind(
      { dataset: ds, time: ds?.startsWith(INDIVIDUAL_PREFIX) ? 0 : time, altitudeIndex: altitude },
      controller.signal,
    )
      .then(res => dispatch({ type: A.SET_WIND_DATA, value: res.data }))
      .catch(err => {
        if (!controller.signal.aborted) dispatch({ type: A.SET_WIND_DATA, value: null });
      });
    return () => controller.abort();
  }, [state.showWind, state.activeResult]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Réinitialise le vent quand on quitte une slice. */
  useEffect(() => {
    if (!activeResultObj || activeResultObj.type !== 'slice') {
      dispatch({ type: A.SET_WIND_DATA, value: null });
    }
  }, [activeResultObj, dispatch]);

  const handleRemoveResult = useCallback((id) => {
    largeDataStore.delete(id);   // libère les frames d'animation si présentes
    dispatch({ type: A.REMOVE_RESULT, id });
  }, [dispatch]);

  const handleExportCSV = useCallback(() => {
    if (!activeResultObj) return;
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
    }
  }, [activeResultObj]);

  const handleExportNetCDF = useCallback(() => {
    if (!activeResultObj || activeResultObj.type !== 'slice') return;
    const { params } = activeResultObj;
    const variable = VARIABLES_MAP.get(params.variable);
    const altitudeToSend = variable?.altitudeType === null ? 0 : params.altitude;
    triggerApiDownload(
      exportSliceNetCDF({ dataset: params.dataset, variable: params.variable, time: params.time, altitude: altitudeToSend }),
      `slice_${params.variable}_t${params.time}_a${params.altitude}.nc`,
    );
  }, [activeResultObj]);

  const handleCopyLink = useCallback(() => {
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

    navigator.clipboard.writeText(`${window.location.origin}/explore?${p.toString()}`)
      .then(() => {
        dispatch({ type: A.SET_LINK_COPIED, value: true });
        setTimeout(() => dispatch({ type: A.SET_LINK_COPIED, value: false }), 2000);
      })
      .catch(() => {});
  }, [selectedDataset, selectedVariable, vizType, selectedTime, selectedAltitude, selectedLatitude, selectedLongitude, colorscale, zMinInput, zMaxInput, crossSectionType, hovmollerType, dispatch]);

  /* ── Drill-down: click on heatmap → launch related viz using ACTIVE result's params ── */

  const handleDrillDown = useCallback(async ({ type, lat, lon }) => {
    // Use the active result's params, NOT the left panel params
    const activeObj = resultsById[state.activeResult];
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

      const id = Date.now().toString();
      const vizLabels = { timeseries: 'Série', profile: 'Profil', crosssection: 'Coupe', temporalprofile: 'T-Profil' };
      const result = {
        id,
        type,
        label: `${vizLabels[type] || type} (${lat}°, ${lon}°)`,
        params,
        data,
        datasetLabel: activeObj.datasetLabel,
      };
      dispatch({ type: A.ADD_RESULT, result });
      dispatch({ type: A.SET_ACTIVE_RESULT, value: id });
      showToast(`${vizLabels[type] || type} (${lat}°, ${lon}°)`, 'success');
    } catch (err) {
      dispatch({ type: A.SET_ERROR, value: err.response?.data?.message || err.message });
      showToast(err.response?.data?.message || err.message, 'error');
    } finally {
      dispatch({ type: A.SET_LOADING, value: false });
    }
  }, [resultsById, state.activeResult, resultOrder.length, dispatch, showToast, t]);

  /* ── Rendu ─────────────────────────────────────────────────────────────── */

  if (catalogLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  const [panelVisible, setPanelVisible] = useState(true);

  const togglePanel = useCallback(() => {
    setPanelVisible(v => !v);
    // Trigger Plotly resize after CSS transition
    setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
  }, []);

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: { xs: 'column', sm: 'row' },
      height: { xs: 'auto', sm: '100vh' },
      minHeight: { xs: '100vh', sm: 'auto' },
      gap: panelVisible ? 1.5 : 0,
      p: 1.5,
      boxSizing: 'border-box',
    }}>
      {panelVisible && (
        <Box sx={{ width: { xs: '100%', sm: 300, md: 330 }, flexShrink: 0, overflow: 'auto' }}>
          <ExploreParamsPanel onLancer={handleLancer} onCopyLink={handleCopyLink} />
        </Box>
      )}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <ExploreResultsPanel
          onRemoveResult={handleRemoveResult}
          onExportCSV={handleExportCSV}
          onExportNetCDF={handleExportNetCDF}
          panelVisible={panelVisible}
          onTogglePanel={togglePanel}
          onDrillDown={handleDrillDown}
        />
      </Box>
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
