/**
 * Zone droite de la page Exploration.
 *
 * Affiche la barre d'onglets, les toggles d'affichage et le viewer actif.
 * Consomme ExploreContext directement — aucun prop-drilling depuis ExplorePage.
 *
 * Props :
 *   onRemoveResult (id: string) => void — ferme un onglet
 *   onExportCSV    ()           => void — déclenche l'export CSV du résultat actif
 */
import { useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Paper, Typography, Tabs, Tab, IconButton, Chip,
} from '@mui/material';
import {
  GridOn as GridOnIcon,
  Close as CloseIcon,
  Place as PlaceIcon,
  Map as MapIcon,
  Science as ScienceIcon,
  CompareArrows as AnomalyIcon,
  Air as WindIcon,
  Functions as LogIcon,
} from '@mui/icons-material';
import { LOCATION_COLORS, LOCATION_TYPE_KEYS } from '../../data/marsLocations';
import { COLORSCALE_OPTIONS, RDBU_VARIABLES } from '../../utils/colorscales';
import { computeAnomalyZ } from '../../utils/heatmapAnalysis';
import { LATLON_HEATMAP_TYPES, COLORSCALE_TYPES } from './exploreConstants.jsx';
import { useExploreState, useExploreDispatch, A } from './ExploreContext.jsx';
import { largeDataStore } from './largeDataStore.js';
import SliceViewer from '../../components/SliceViewer';
import TimeSeriesChart from '../../components/TimeSeriesChart';
import AnimationPlayer from '../../components/AnimationPlayer';
import ProfileViewer from '../../components/ProfileViewer';
import CrossSectionViewer from '../../components/CrossSectionViewer';
import DetailPanel from '../../components/DetailPanel';
import ExportMenu from '../../components/ExportMenu';

export default function ExploreResultsPanel({ onRemoveResult, onExportCSV }) {
  const { t } = useTranslation();
  const state    = useExploreState();
  const dispatch = useExploreDispatch();

  const {
    resultsById, resultOrder, activeResult,
    showLocations, showSurface, showDetailedTooltip, showAnomaly, showWind, showLog,
    windData, colorscale, zMinInput, zMaxInput,
  } = state;

  /* Ref partagee avec le viewer actif via la prop externalPlotRef.
   * Evite le querySelector('.js-plotly-plot') fragile sur la classe interne de Plotly. */
  const sharedPlotRef = useRef(null);

  /* ─── Derived values ──────────────────────────────────────────────────── */

  // Optimisation R3 : dépend de resultsById[activeResult] (référence stable quand
  // d'autres onglets sont ajoutés/supprimés) plutôt que de resultsById entier.
  const activeResultObj = useMemo(
    () => resultsById[activeResult] ?? null,
    [resultsById[activeResult], activeResult], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // R5 : pour le type animation les données (frames) sont dans largeDataStore,
  // pas dans activeResultObj.data (qui vaut null pour éviter la réconciliation React).
  const activeData = activeResultObj?.type === 'animation'
    ? (largeDataStore.get(activeResultObj.id) ?? activeResultObj.data)
    : activeResultObj?.data ?? null;

  const isLatLonHeatmap = LATLON_HEATMAP_TYPES.includes(activeResultObj?.type);
  const isColorscaleType = COLORSCALE_TYPES.includes(activeResultObj?.type);

  /** Palette résolue depuis le choix utilisateur ou l'auto-détection */
  const resolvedColorscale = useMemo(() => {
    if (showAnomaly && activeResultObj?.type === 'slice') {
      return { name: 'RdBu', reverse: true };
    }
    const varCode = activeResultObj?.params?.variable;
    if (colorscale === 'auto') {
      const isTemp = RDBU_VARIABLES.includes(varCode);
      return { name: isTemp ? 'RdBu' : 'Viridis', reverse: isTemp };
    }
    const opt = COLORSCALE_OPTIONS.find(o => o.value === colorscale);
    return { name: opt?.scale || colorscale, reverse: opt?.reverse ?? false };
  }, [colorscale, activeResultObj, showAnomaly]);

  /** Données slice (potentiellement transformées pour le mode anomalie) */
  const effectiveSliceData = useMemo(() => {
    if (!activeResultObj || activeResultObj.type !== 'slice') return null;
    if (!showAnomaly) return activeData;
    const { data, latitudes } = activeData;
    const { anomalyZ, maxAbsAnomaly } = computeAnomalyZ(data, latitudes);
    return { ...activeData, data: anomalyZ, _anomalyRange: maxAbsAnomaly };
  }, [activeResultObj, activeData, showAnomaly]);

  const anomalyZRange = effectiveSliceData?._anomalyRange ?? null;
  const customZMin = zMinInput !== '' ? parseFloat(zMinInput) : null;
  const customZMax = zMaxInput !== '' ? parseFloat(zMaxInput) : null;

  /* ─── Empty state ─────────────────────────────────────────────────────── */
  if (resultOrder.length === 0) {
    return (
      <Paper sx={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        p: 4, textAlign: 'center',
      }}>
        <Box>
          <GridOnIcon sx={{ fontSize: 56, color: 'var(--text-secondary)', opacity: 0.3, mb: 2 }} />
          <Typography color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
            {t('page.explore.emptyState')}
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <>
      {/* ── Barre d'onglets + toggles ─────────────────────────────────── */}
      <Paper sx={{ px: 1, mb: 1, display: 'flex', alignItems: 'center' }}>
        <Tabs
          value={activeResult}
          onChange={(_, v) => dispatch({ type: A.SET_ACTIVE_RESULT, value: v })}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            flex: 1,
            '& .MuiTab-root': { minHeight: 48, textTransform: 'none' },
            '& .Mui-selected': { color: 'var(--mars-orange) !important' },
            '& .MuiTabs-indicator': { backgroundColor: 'var(--mars-orange)' },
          }}
        >
          {resultOrder.map(id => { const r = resultsById[id]; return (
            <Tab
              key={r.id}
              value={r.id}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>{r.label}</Typography>
                  <IconButton
                    size="small"
                    onClick={e => { e.stopPropagation(); onRemoveResult(r.id); }}
                    sx={{ ml: 0.5, p: 0.3 }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              }
            />
          ); })}
        </Tabs>

        {/* Toggles pour heatmaps lat/lon */}
        {isLatLonHeatmap && (
          <Box sx={{ display: 'flex', gap: 0.5, ml: 1, flexShrink: 0 }}>
            <IconButton
              size="small"
              onClick={() => dispatch({ type: A.TOGGLE_LOCATIONS })}
              color={showLocations ? 'warning' : 'default'}
              title={t('explore.toggle.poi')}
            >
              <PlaceIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => dispatch({ type: A.TOGGLE_SURFACE })}
              color={showSurface ? 'warning' : 'default'}
              title={t('explore.toggle.surface')}
            >
              <MapIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => dispatch({ type: A.TOGGLE_TOOLTIP })}
              color={showDetailedTooltip ? 'warning' : 'default'}
              title={t('explore.toggle.tooltip')}
            >
              <ScienceIcon fontSize="small" />
            </IconButton>
            {activeResultObj?.type === 'slice' && (
              <IconButton
                size="small"
                onClick={() => dispatch({ type: A.TOGGLE_ANOMALY })}
                color={showAnomaly ? 'warning' : 'default'}
                title={t('explore.toggle.anomaly')}
              >
                <AnomalyIcon fontSize="small" />
              </IconButton>
            )}
            {activeResultObj?.type === 'slice'
              && !['UU', 'VV'].includes(activeResultObj?.params?.variable)
              && (
              <IconButton
                size="small"
                onClick={() => dispatch({ type: A.TOGGLE_WIND })}
                color={showWind ? 'info' : 'default'}
                title={t('explore.toggle.wind')}
              >
                <WindIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        )}

        {/* Toggle echelle logarithmique — pour les types heatmap (slice, animation, crosssection) */}
        {isColorscaleType && (
          <IconButton
            size="small"
            onClick={() => dispatch({ type: A.TOGGLE_LOG })}
            color={showLog ? 'warning' : 'default'}
            title={t('explore.toggle.log')}
            sx={{ ml: isLatLonHeatmap ? 0 : 1, flexShrink: 0 }}
          >
            <LogIcon fontSize="small" />
          </IconButton>
        )}

        {/* Export menu (PNG, SVG, CSV) — positionné dans la barre d'onglets */}
        {activeResultObj && (
          <Box sx={{ ml: 1, flexShrink: 0 }}>
            <ExportMenu
              plotRef={sharedPlotRef}
              filename={`mars_${activeResultObj.type}_${activeResultObj.params.variable}`}
              onCSV={onExportCSV}
            />
          </Box>
        )}
      </Paper>

      {/* ── Métadonnées de contexte ────────────────────────────────────── */}
      {showLocations && isLatLonHeatmap && (
        <Box sx={{ mb: 1, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', px: 1 }}>
          <Typography variant="caption" color="text.secondary">{t('common.legend')}</Typography>
          {Object.entries(LOCATION_TYPE_KEYS).map(([type, key]) => (
            <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: LOCATION_COLORS[type] }} />
              <Typography variant="caption">{t(key)}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {showAnomaly && activeResultObj?.type === 'slice' && (
        <Box sx={{ mb: 1, px: 1 }}>
          <Typography variant="caption" sx={{ color: 'var(--cyan-accent)', fontStyle: 'italic' }}>
            {t('page.explore.anomalyCaption')}
          </Typography>
        </Box>
      )}

      {showLog && isColorscaleType && (
        <Box sx={{ mb: 1, px: 1 }}>
          <Typography variant="caption" sx={{ color: 'var(--cyan-accent)', fontStyle: 'italic' }}>
            {t('page.explore.logCaption')}
          </Typography>
        </Box>
      )}

      {activeData?.actualLs != null && (
        <Box sx={{ mb: 1, px: 1 }}>
          <Chip
            label={t('page.explore.actualLs', { ls: activeData.actualLs.toFixed(2) })}
            size="small"
            sx={{
              bgcolor: 'rgba(0,188,212,0.15)',
              color: 'var(--cyan-accent)',
              border: '1px solid var(--cyan-accent)',
              fontFamily: 'var(--font-body)',
            }}
          />
        </Box>
      )}

      {/* ── Viewer actif ──────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {activeResultObj?.type === 'slice' && (
          <SliceViewer
            sliceData={effectiveSliceData}
            variableCode={activeResultObj.params.variable}
            datasetLabel={activeResultObj.datasetLabel}
            showLocations={showLocations}
            showSurface={showSurface && !showAnomaly}
            colorscaleName={resolvedColorscale.name}
            reverseColorscale={resolvedColorscale.reverse}
            customZMin={showAnomaly ? -(anomalyZRange || 1) : customZMin}
            customZMax={showAnomaly ? (anomalyZRange || 1) : customZMax}
            showDetailedTooltip={showDetailedTooltip}
            windData={showWind ? windData : null}
            logScale={showLog}
            onExportCSV={onExportCSV}
            externalPlotRef={sharedPlotRef}
            noExportMenu
          />
        )}
        {activeResultObj?.type === 'timeseries' && (
          <TimeSeriesChart
            timeSeriesData={activeResultObj.data}
            variableCode={activeResultObj.params.variable}
            datasetLabel={activeResultObj.datasetLabel}
            onExportCSV={onExportCSV}
            externalPlotRef={sharedPlotRef}
            noExportMenu
          />
        )}
        {activeResultObj?.type === 'animation' && (
          <AnimationPlayer
            animationData={activeData}
            variableCode={activeResultObj.params.variable}
            datasetLabel={activeResultObj.datasetLabel}
            showLocations={showLocations}
            showSurface={showSurface}
            colorscaleName={resolvedColorscale.name}
            reverseColorscale={resolvedColorscale.reverse}
            customZMin={customZMin}
            customZMax={customZMax}
            showDetailedTooltip={showDetailedTooltip}
            logScale={showLog}
            externalPlotRef={sharedPlotRef}
            noExportMenu
          />
        )}
        {activeResultObj?.type === 'profile' && (
          <ProfileViewer
            profileData={activeResultObj.data}
            variableCode={activeResultObj.params.variable}
            datasetLabel={activeResultObj.datasetLabel}
            onExportCSV={onExportCSV}
            externalPlotRef={sharedPlotRef}
            noExportMenu
          />
        )}
        {activeResultObj?.type === 'crosssection' && (
          <CrossSectionViewer
            crossSectionData={activeResultObj.data}
            variableCode={activeResultObj.params.variable}
            datasetLabel={activeResultObj.datasetLabel}
            colorscaleName={resolvedColorscale.name}
            reverseColorscale={resolvedColorscale.reverse}
            customZMin={customZMin}
            customZMax={customZMax}
            logScale={showLog}
            onExportCSV={onExportCSV}
            externalPlotRef={sharedPlotRef}
            noExportMenu
          />
        )}

        {isLatLonHeatmap && activeResultObj && (
          <DetailPanel
            resultData={activeData}
            resultType={activeResultObj.type}
            variableCode={activeResultObj.params.variable}
          />
        )}
      </Box>
    </>
  );
}
