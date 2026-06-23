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
import { useState, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Paper, Typography, Tabs, Tab, IconButton, Chip, Tooltip,
} from '@mui/material';
import {
  GridOn as GridOnIcon,
  Close as CloseIcon,
  Place as PlaceIcon,
  Map as MapIcon,
  Tune as TuneIcon,
  Science as ScienceIcon,
  CompareArrows as AnomalyIcon,
  Air as WindIcon,
  Functions as LogIcon,
  BarChart as BarChartIcon,
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
import HovmollerViewer from '../../components/HovmollerViewer';
import ZonalMeanViewer from '../../components/ZonalMeanViewer';
import WindRoseViewer from '../../components/WindRoseViewer';
import DifferenceViewer from '../../components/DifferenceViewer';
import TemporalProfileViewer from '../../components/TemporalProfileViewer';
import DetailPanel from '../../components/DetailPanel';
import ExportMenu from '../../components/ExportMenu';
import DrillDownMenu from '../../components/DrillDownMenu';
import { DiffMenuButton } from './ExploreToolbarButtons';

export default function ExploreResultsPanel({ onRemoveResult, onExportCSV, onExportNetCDF, panelVisible = true, onTogglePanel, onDrillDown }) {
  const { t } = useTranslation();
  const state    = useExploreState();
  const dispatch = useExploreDispatch();
  const [showDetails, setShowDetails] = useState(true);

  const {
    resultsById, resultOrder, activeResult,
    showLocations, showSurface, showDetailedTooltip, showAnomaly, showWind, showLog,
    windData, colorscale, zMinInput, zMaxInput,
  } = state;

  /* Ref partagee avec le viewer actif via la prop externalPlotRef.
   * Evite le querySelector('.js-plotly-plot') fragile sur la classe interne de Plotly. */
  const sharedPlotRef = useRef(null);
  const dragIdRef = useRef(null);

  const handleDragStart = useCallback((id) => { dragIdRef.current = id; }, []);
  const handleDrop = useCallback((targetId) => {
    const fromId = dragIdRef.current;
    if (!fromId || fromId === targetId) return;
    const order = [...resultOrder];
    const fromIdx = order.indexOf(fromId);
    const toIdx = order.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, fromId);
    dispatch({ type: A.REORDER_RESULTS, value: order });
    dragIdRef.current = null;
  }, [resultOrder, dispatch]);

  /* ─── Derived values ──────────────────────────────────────────────────── */

  // Optimisation R3 : dépend de resultsById[activeResult] (référence stable quand
  // d'autres onglets sont ajoutés/supprimés) plutôt que de resultsById entier.
  const activeResultObj = useMemo(
    () => resultsById[activeResult] ?? null,
    [resultsById, activeResult],
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
      <Paper sx={{ px: 1, mb: 1, display: 'flex', alignItems: 'center', minHeight: 48 }}>
        {/* Toggle params panel */}
        {onTogglePanel && (
          <Tooltip title={panelVisible ? t('nav.collapseMenu') : t('nav.expandMenu')} arrow>
            <IconButton
              size="small"
              onClick={onTogglePanel}
              sx={{ color: 'var(--text-secondary)', mr: 0.5, flexShrink: 0 }}
            >
              <TuneIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        )}

        <Tabs
          value={activeResult}
          onChange={(_, v) => dispatch({ type: A.SET_ACTIVE_RESULT, value: v })}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            flex: 1,
            minWidth: 0,
            '& .MuiTab-root': { minHeight: 44, textTransform: 'none', minWidth: 0, maxWidth: 180, px: 1.5 },
            '& .Mui-selected': { color: 'var(--mars-orange) !important' },
            '& .MuiTabs-indicator': { backgroundColor: 'var(--mars-orange)' },
          }}
        >
          {resultOrder.map(id => { const r = resultsById[id]; const p = r.params; return (
            <Tab
              key={r.id}
              value={r.id}
              draggable
              onDragStart={() => handleDragStart(r.id)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(r.id)}
              label={
                <Tooltip
                  title={`${r.datasetLabel || p.dataset} · ${p.variable} · t=${p.time} · alt=${p.altitude}${p.lat != null ? ` · ${p.lat}°,${p.lon}°` : ''}`}
                  placement="bottom"
                  arrow
                  enterDelay={400}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 120, fontSize: '0.8rem' }}>{r.label}</Typography>
                    <IconButton
                      size="small"
                      aria-label={t('explore.close_tab')}
                      onClick={e => { e.stopPropagation(); onRemoveResult(r.id); }}
                      sx={{ p: 0.3 }}
                    >
                      <CloseIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Tooltip>
              }
            />
          ); })}
        </Tabs>

        {/* Tab count */}
        <Chip
          label={`${resultOrder.length}/5`}
          size="small"
          sx={{
            ml: 0.5,
            height: 20,
            fontSize: '0.65rem',
            fontWeight: 600,
            bgcolor: 'var(--bg-surface-hover)',
            color: 'var(--text-secondary)',
            flexShrink: 0,
          }}
        />

        {/* Ls exact (individual datasets) */}
        {activeData?.actualLs != null && (
          <Chip
            label={t('page.explore.actualLs', { ls: activeData.actualLs.toFixed(2) })}
            size="small"
            sx={{
              bgcolor: 'var(--cyan-highlight)',
              color: 'var(--cyan-accent)',
              border: '1px solid var(--cyan-accent)',
              fontFamily: 'var(--font-body)',
              flexShrink: 0,
              ml: 1,
            }}
          />
        )}

        {/* Toggles pour heatmaps lat/lon */}
        {isLatLonHeatmap && (
          <Box sx={{ display: 'flex', gap: 0.5, ml: 1, flexShrink: 0 }}>
            <Tooltip title={t('explore.toggle.poi')} arrow>
              <IconButton
                size="small"
                onClick={() => dispatch({ type: A.TOGGLE_LOCATIONS })}
                color={showLocations ? 'warning' : 'default'}
                aria-pressed={showLocations}
                aria-label={t('explore.toggle.poi')}
              >
                <PlaceIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('explore.toggle.surface')} arrow>
              <IconButton
                size="small"
                onClick={() => dispatch({ type: A.TOGGLE_SURFACE })}
                color={showSurface ? 'warning' : 'default'}
                aria-pressed={showSurface}
                aria-label={t('explore.toggle.surface')}
              >
                <MapIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('explore.toggle.tooltip')} arrow>
              <IconButton
                size="small"
                onClick={() => dispatch({ type: A.TOGGLE_TOOLTIP })}
                color={showDetailedTooltip ? 'warning' : 'default'}
                aria-pressed={showDetailedTooltip}
                aria-label={t('explore.toggle.tooltip')}
              >
                <ScienceIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {activeResultObj?.type === 'slice' && (
              <Tooltip title={t('explore.toggle.anomaly')} arrow>
                <IconButton
                  size="small"
                  onClick={() => dispatch({ type: A.TOGGLE_ANOMALY })}
                  color={showAnomaly ? 'warning' : 'default'}
                  aria-pressed={showAnomaly}
                  aria-label={t('explore.toggle.anomaly')}
                >
                  <AnomalyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {activeResultObj?.type === 'slice'
              && !['UU', 'VV'].includes(activeResultObj?.params?.variable)
              && (
              <Tooltip title={t('explore.toggle.wind')} arrow>
                <IconButton
                  size="small"
                  onClick={() => dispatch({ type: A.TOGGLE_WIND })}
                  color={showWind ? 'info' : 'default'}
                  aria-pressed={showWind}
                  aria-label={t('explore.toggle.wind')}
                >
                  <WindIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}

        {/* Toggle echelle logarithmique — pour les types heatmap (slice, animation, crosssection) */}
        {isColorscaleType && (
          <Tooltip title={t('explore.toggle.log')} arrow>
            <IconButton
              size="small"
              onClick={() => dispatch({ type: A.TOGGLE_LOG })}
              color={showLog ? 'warning' : 'default'}
              aria-pressed={showLog}
              aria-label={t('explore.toggle.log')}
              sx={{ ml: isLatLonHeatmap ? 0 : 1, flexShrink: 0 }}
            >
              <LogIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* Quick diff: compare active slice with a user-chosen slice tab */}
        {activeResultObj?.type === 'slice' && (() => {
          const otherSlices = resultOrder
            .filter(id => resultsById[id]?.type === 'slice' && id !== activeResult)
            .map(id => resultsById[id]);
          if (otherSlices.length === 0) return null;

          const computeDiff = (otherId) => {
            const a = activeResultObj.data;
            const b = resultsById[otherId].data;
            if (!a?.data || !b?.data) return;
            const nLat = Math.min(a.data.length, b.data.length);
            const diff = Array.from({ length: nLat }, (_, i) => {
              const nLon = Math.min(a.data[i]?.length || 0, b.data[i]?.length || 0);
              return Array.from({ length: nLon }, (_, j) => a.data[i][j] - b.data[i][j]);
            });
            const flat = diff.flat().filter(v => v != null);
            const min = Math.min(...flat), max = Math.max(...flat);
            const mean = flat.reduce((s, v) => s + v, 0) / flat.length;
            const diffResult = {
              id: Date.now().toString(),
              type: 'difference',
              label: `Δ ${activeResultObj.label} − ${resultsById[otherId].label}`,
              params: activeResultObj.params,
              data: {
                data: diff, latitudes: a.latitudes, longitudes: a.longitudes,
                datasetA: activeResultObj.datasetLabel, datasetB: resultsById[otherId].datasetLabel,
                variable: activeResultObj.params.variable,
                stats: { min, max, mean, stddev: 0, median: (min + max) / 2 },
              },
              datasetLabel: 'Client diff',
            };
            dispatch({ type: A.ADD_RESULT, result: diffResult });
            dispatch({ type: A.SET_ACTIVE_RESULT, value: diffResult.id });
          };

          // 1 other slice → direct button, 2+ → dropdown menu
          if (otherSlices.length === 1) {
            return (
              <Tooltip title={`${t('explore.quickDiff')}: ${otherSlices[0].label}`} arrow>
                <IconButton size="small" onClick={() => computeDiff(otherSlices[0].id)}
                  sx={{ flexShrink: 0, color: 'var(--text-secondary)' }}>
                  <AnomalyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            );
          }
          return (
            <DiffMenuButton slices={otherSlices} onSelect={computeDiff} t={t} />
          );
        })()}

        {/* Export menu (PNG, SVG, CSV) — positionné dans la barre d'onglets */}
        {activeResultObj && (
          <Box sx={{ ml: 1, flexShrink: 0 }}>
            <ExportMenu
              plotRef={sharedPlotRef}
              filename={`mars_${activeResultObj.type}_${activeResultObj.params.variable}`}
              onCSV={onExportCSV}
              onNetCDF={activeResultObj.type === 'slice' ? onExportNetCDF : null}
            />
          </Box>
        )}

        {/* Details toggle + split view */}
        <Box sx={{ display: 'flex', gap: 0.3, ml: 1, flexShrink: 0, borderLeft: '1px solid var(--glass-border)', pl: 1 }}>
          {/* Toggle stats/details panels */}
          {isLatLonHeatmap && (
            <Tooltip title={showDetails ? t('explore.hideDetails') : t('explore.showDetails')} arrow>
              <IconButton size="small" onClick={() => setShowDetails(v => !v)}
                sx={{ color: showDetails ? 'var(--mars-orange)' : 'var(--text-secondary)' }}>
                <BarChartIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
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

      {/* ── Viewer(s) ────────────────────────────────────────────────── */}
      <Box sx={{
        flex: 1, overflow: 'auto',
      }}>
        {activeResult && resultsById[activeResult] && (() => {
          const r = resultsById[activeResult];
          const rData = r.type === 'animation' ? (largeDataStore.get(activeResult) ?? r.data) : r.data;
          return (
            <Box>
              {r.type === 'slice' && <SliceViewer sliceData={effectiveSliceData} variableCode={r.params.variable} datasetLabel={r.datasetLabel} showLocations={showLocations} showSurface={showSurface && !showAnomaly} colorscaleName={resolvedColorscale.name} reverseColorscale={resolvedColorscale.reverse} customZMin={showAnomaly ? -(anomalyZRange || 1) : customZMin} customZMax={showAnomaly ? (anomalyZRange || 1) : customZMax} showDetailedTooltip={showDetailedTooltip} windData={showWind ? windData : null} logScale={showLog} externalPlotRef={sharedPlotRef} noExportMenu />}
              {r.type === 'timeseries' && <TimeSeriesChart timeSeriesData={rData} variableCode={r.params.variable} datasetLabel={r.datasetLabel} externalPlotRef={sharedPlotRef} noExportMenu />}
              {r.type === 'animation' && <AnimationPlayer animationData={rData} variableCode={r.params.variable} datasetLabel={r.datasetLabel} showLocations={showLocations} showSurface={showSurface} colorscaleName={resolvedColorscale.name} reverseColorscale={resolvedColorscale.reverse} customZMin={customZMin} customZMax={customZMax} logScale={showLog} externalPlotRef={sharedPlotRef} noExportMenu />}
              {r.type === 'profile' && <ProfileViewer profiles={Array.isArray(rData) ? rData : [rData]} variableCode={r.params.variable} datasetLabel={r.datasetLabel} externalPlotRef={sharedPlotRef} noExportMenu />}
              {r.type === 'crosssection' && <CrossSectionViewer crossSectionData={rData} variableCode={r.params.variable} datasetLabel={r.datasetLabel} colorscaleName={resolvedColorscale.name} reverseColorscale={resolvedColorscale.reverse} customZMin={customZMin} customZMax={customZMax} logScale={showLog} externalPlotRef={sharedPlotRef} noExportMenu />}
              {r.type === 'hovmoller' && <HovmollerViewer hovmollerData={rData} variableCode={r.params.variable} datasetLabel={r.datasetLabel} colorscaleName={resolvedColorscale.name} reverseColorscale={resolvedColorscale.reverse} customZMin={customZMin} customZMax={customZMax} logScale={showLog} externalPlotRef={sharedPlotRef} noExportMenu />}
              {r.type === 'zonalmean' && <ZonalMeanViewer zonalMeanData={rData} variableCode={r.params.variable} datasetLabel={r.datasetLabel} colorscaleName={resolvedColorscale.name} reverseColorscale={resolvedColorscale.reverse} customZMin={customZMin} customZMax={customZMax} logScale={showLog} externalPlotRef={sharedPlotRef} noExportMenu />}
              {r.type === 'windrose' && <WindRoseViewer windRoseData={rData} datasetLabel={r.datasetLabel} externalPlotRef={sharedPlotRef} noExportMenu />}
              {r.type === 'difference' && <DifferenceViewer differenceData={rData} variableCode={r.params.variable} externalPlotRef={sharedPlotRef} noExportMenu />}
              {r.type === 'temporalprofile' && <TemporalProfileViewer profileData={rData} variableCode={r.params.variable} datasetLabel={r.datasetLabel} colorscaleName={resolvedColorscale.name} reverseColorscale={resolvedColorscale.reverse} customZMin={customZMin} customZMax={customZMax} logScale={showLog} externalPlotRef={sharedPlotRef} noExportMenu />}
            </Box>
          );
        })()}

        {isLatLonHeatmap && activeResultObj && showDetails && (
          <DetailPanel
            resultData={activeData}
            resultType={activeResultObj.type}
            variableCode={activeResultObj.params.variable}
          />
        )}

        {/* Drill-down: click on lat/lon heatmap → launch related viz */}
        {isLatLonHeatmap && onDrillDown && (
          <DrillDownMenu plotRef={sharedPlotRef} onDrillDown={onDrillDown} />
        )}
      </Box>
    </>
  );
}
