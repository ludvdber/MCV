/**
 * Zone centrale de la console Explorer (design « Flux »).
 *
 * Rangée d'onglets fine (repli du panneau de paramètres, sessions, onglets,
 * disposition, export ; les toggles contextuels vivent dans l'inspecteur
 * droit, au-dessus de la sonde liée) + zone de vues :
 *   - disposition 1 : viewer complet + panneau de détails + drill-down
 *   - disposition 2/4 : cellules compactes avec en-tête (titre + badge d'état
 *     + fermeture) et mini-colorbar, contenu EXPLICITE (gridIds du reducer)
 *   - rideau A/B entre deux slices comparables (CurtainCompare)
 *
 * Props :
 *   onRemoveResult (id) => void — ferme un onglet
 *   onExportCSV / onExportNetCDF / onDrillDown — actions du résultat actif
 */
import { useRef, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Paper, Typography, Tabs, Tab, IconButton, Chip, Tooltip, Button,
  ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import {
  GridOn as GridOnIcon,
  Close as CloseIcon,
  CompareArrows as AnomalyIcon,
  Add as AddIcon,
  HelpOutlined as HelpIcon,
  CropSquare as SingleViewIcon,
  GridView as GridViewIcon,
} from '@mui/icons-material';
import { LOCATION_COLORS, LOCATION_TYPE_KEYS } from '../../data/marsLocations';
import { LATLON_HEATMAP_TYPES, COLORSCALE_TYPES, INTERP_TYPES, LAYOUTS, MAX_TABS, MEAN_ONLY_TYPES, PROBE_TYPES } from './exploreConstants.jsx';
import { useExploreState, useExploreDispatch, A } from './ExploreContext.jsx';
import { useResultColorscale } from './useResultColorscale.js';
import { largeDataStore } from './largeDataStore.js';
import { INDIVIDUAL_PREFIX } from '../../constants';
import InterpolationToggle from '../../components/InterpolationToggle';
import DetailPanel from '../../components/DetailPanel';
import ExportMenu from '../../components/ExportMenu';
import DrillDownMenu from '../../components/DrillDownMenu';
import { DiffMenuButton } from './ExploreToolbarButtons';
import ExploreResultViewer from './ExploreResultViewer.jsx';
import CellErrorBoundary from './CellErrorBoundary.jsx';
import CurtainCompare from './CurtainCompare.jsx';
import ProbeLayer from './ProbeLayer.jsx';
import RoiLayer from './RoiLayer.jsx';
import TransectLayer from './TransectLayer.jsx';
import SessionChips from './SessionChips.jsx';
import { useSyncZoom } from './useSyncZoom.js';
import MiniColorbar from './MiniColorbar.jsx';
import { computeRegionStats, resultLabel, datasetContext } from './exploreUtils.js';
import { triggerDownload } from '../../utils/exportUtils';
import { exportGridMontage, FIGURE_CREDIT } from '../../utils/plotExport';
import { exportAnimationWebM, webmSupported, downloadBlob } from '../../utils/videoExport';
import { formatTime } from '../../utils/formatTime';
import { useToast } from '../../context/ToastContext';

/** Types compatibles avec les statistiques de region (grille dans result.data). */
const ROI_TYPES = ['slice', 'difference'];

/** Mention de credit des figures : meme texte que les exports ordinaires,
 *  importe depuis plotExport pour qu'il n'en existe qu'une version. */
const PUB_CREDIT = FIGURE_CREDIT;

/** Titres d'axes par type de vue, pour le mode publication : une vue compacte
 *  n'a pas de titres d'axes, une figure d'article ne peut pas s'en passer. */
function axisTitlesFor(result, t) {
  switch (result.type) {
    case 'slice': case 'animation': case 'difference': case 'tides':
      return { x: t('viz.longitude'), y: t('viz.latitude') };
    case 'crosssection':
      return {
        x: result.params?.crossSectionType === 'meridional' ? t('viz.latitude') : t('viz.longitude'),
        y: t('viz.altitude'),
      };
    case 'zonalmean':
      return { x: t('viz.latitude'), y: t('viz.altitude') };
    case 'transect':
      return { x: t('viz.distance'), y: t('viz.altitude') };
    case 'hovmoller':
      return {
        x: result.params?.hovmollerType === 'longitude' ? t('viz.longitude') : t('viz.latitude'),
        y: t('viz.localTime'),
      };
    case 'temporalprofile':
      return { x: t('viz.localTime'), y: t('viz.altitude') };
    default:
      return {};
  }
}

/* Le contexte dataset compact ("MY35 · Ls 90-120°") vit dans exploreUtils
   (datasetContext) : partagé avec la sonde liée du panneau latéral. */

/**
 * Cellule de la grille multi-vues : en-tete (titre + badge + fermeture),
 * corps (viewer compact + couches sonde/region), mini-colorbar.
 */
function GridCell({
  result, isActive, onActivate, onClose,
  probeEnabled, roiEnabled = false, onRoiSelect, onRoiClear,
  transectEnabled = false, onTransectSelect, syncEnabled = false,
  showAnomaly, colorscaleSetting, onDrillDown = null, children,
}) {
  const { t } = useTranslation();
  const hostRef = useRef(null);
  const resolved = useResultColorscale(result, { showAnomaly, colorscale: colorscaleSetting });
  useSyncZoom(hostRef, syncEnabled, result.id);

  /* Ref « paresseuse » vers le div Plotly de la cellule : le menu de
     drill-down la lit au moment de s'attacher (dans un effet), jamais au
     rendu — le clic en un point fonctionne donc AUSSI en grille. */
  const plotGdRef = useMemo(() => ({
    get current() { return hostRef.current?.querySelector('.js-plotly-plot') ?? null; },
  }), []);

  const isDerived = !!result.derived;
  const isIndividual = result.params?.dataset?.startsWith(INDIVIDUAL_PREFIX);
  const badgeClass = isDerived ? 'der' : isIndividual ? 'ind' : 'live';
  const badgeText = isDerived
    ? t('explore.badge.derived')
    : isIndividual ? 'IND' : t('explore.badge.live');
  const badgeHint = isDerived
    ? t('explore.badge.derivedHint')
    : isIndividual ? t('explore.badge.indHint') : t('explore.badge.liveHint');
  // Libellé recalculé ici (réactif à la langue), pas le `result.label` figé.
  const label = resultLabel(result, t);

  const stats = result.data?.stats;
  const showMiniBar = COLORSCALE_TYPES.includes(result.type)
    && !!stats && !(showAnomaly && result.type === 'slice');

  return (
    <Box
      onClick={onActivate}
      className={isActive ? 'mcv-cell explore-cell explore-cell-active' : 'mcv-cell explore-cell'}
    >
      <Box className="mcv-cell-head">
        <Tooltip title={`${label} · ${result.datasetLabel}`} arrow enterDelay={500}>
          <span className="t">{label}</span>
        </Tooltip>
        <span className="ds">{datasetContext(result)}</span>
        <Tooltip title={badgeHint} arrow enterDelay={300}>
          <span className={`mcv-badge ${badgeClass}`}>{badgeText}</span>
        </Tooltip>
        <Box
          component="span"
          role="button"
          tabIndex={0}
          className="mcv-cell-x"
          aria-label={t('explore.close_tab')}
          onClick={(e) => { e.stopPropagation(); onClose(result.id); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation(); e.preventDefault(); onClose(result.id);
            }
          }}
        >
          <CloseIcon sx={{ fontSize: 14 }} />
        </Box>
      </Box>
      <Box ref={hostRef} className="mcv-cell-body">
        {children}
        {probeEnabled && (
          <ProbeLayer resultId={result.id} result={result} hostRef={hostRef} />
        )}
        <RoiLayer hostRef={hostRef} enabled={roiEnabled} onSelect={onRoiSelect} onClear={onRoiClear} />
        <TransectLayer hostRef={hostRef} enabled={transectEnabled} onSelect={onTransectSelect} />
        {onDrillDown && (
          <DrillDownMenu
            plotRef={plotGdRef}
            onDrillDown={onDrillDown}
            hiddenTypes={isIndividual ? MEAN_ONLY_TYPES : []}
          />
        )}
      </Box>
      {showMiniBar && (
        <MiniColorbar
          colorscaleName={resolved.name}
          reverse={resolved.reverse}
          stats={stats}
          variableCode={result.params?.variable}
        />
      )}
    </Box>
  );
}

export default function ExploreResultsPanel({ onRemoveResult, onExportCSV, onExportNetCDF, onDrillDown, onTransectSelect, onRequestParams, onReplayTour }) {
  const { t } = useTranslation();
  const showToast = useToast();
  const state    = useExploreState();
  const dispatch = useExploreDispatch();

  const {
    resultsById, resultOrder, activeResult,
    showLocations, showAnomaly, showWind, showWindParticles, showLog,
    interpStep,
    windData, layout, gridIds, curtainOn, curtainBId, roiMode, transectMode, syncZoom,
  } = state;

  /* Ref d'export : pointe le div Plotly du resultat actif (PNG/SVG, drill-down).
   * Alimentee par callback depuis ExploreResultViewer — la ref elle-meme
   * appartient au panneau et ne descend jamais en prop mutable. */
  const sharedPlotRef = useRef(null);
  const setActivePlotNode = useCallback((node) => { sharedPlotRef.current = node; }, []);
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

  const activeResultObj = useMemo(
    () => resultsById[activeResult] ?? null,
    [resultsById, activeResult],
  );

  // R5 : pour le type animation les donnees (frames) sont dans largeDataStore.
  const activeData = activeResultObj?.type === 'animation'
    ? (largeDataStore.get(activeResultObj.id) ?? activeResultObj.data)
    : activeResultObj?.data ?? null;

  const isLatLonHeatmap = LATLON_HEATMAP_TYPES.includes(activeResultObj?.type);
  const isColorscaleType = COLORSCALE_TYPES.includes(activeResultObj?.type);

  /** Slices comparables a l'onglet actif (meme variable). Sert au quick-diff
   *  ET au rideau (le bouton du rideau vit dans ExploreTools). */
  const otherSlices = useMemo(() => {
    if (activeResultObj?.type !== 'slice') return [];
    return resultOrder
      .filter(id => resultsById[id]?.type === 'slice' && id !== activeResult
        && resultsById[id]?.params?.variable === activeResultObj.params.variable)
      .map(id => resultsById[id]);
  }, [resultOrder, resultsById, activeResult, activeResultObj]);

  /** Volet B du rideau : l'id memorise s'il est toujours valide, sinon la
   *  premiere slice comparable. */
  const curtainB = useMemo(() => {
    if (!curtainOn) return null;
    const memo = resultsById[curtainBId];
    if (memo && memo.type === 'slice'
      && memo.params?.variable === activeResultObj?.params?.variable
      && curtainBId !== activeResult) return memo;
    return otherSlices[0] ?? null;
  }, [curtainOn, curtainBId, resultsById, activeResultObj, activeResult, otherSlices]);

  const curtainActive = curtainOn && activeResultObj?.type === 'slice' && !!curtainB;

  /** Vues affichees : contenu EXPLICITE du reducer (gridIds), jamais recalcule
   *  au rendu — voir normalizeGrid dans ExploreContext. */
  const visibleIds = layout === 1
    ? (activeResult ? [activeResult] : [])
    : gridIds;

  /* Plotly fige la largeur de chaque graphe en pixels et ne se recale que sur
   * l'evenement resize de la fenetre (config responsive: true). Chaque
   * changement de composition de la zone de vues doit donc etre suivi d'un
   * resize APRES le commit DOM — sinon les plots gardent leur ancienne largeur
   * et font deborder la page. */
  const visibleKey = visibleIds.join('|');
  useEffect(() => {
    const raf = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    return () => cancelAnimationFrame(raf);
  }, [visibleKey, layout, curtainOn]);

  /* ── Statistiques de region (etat du reducer, affichees dans le panneau lateral) ── */
  const singleHostRef = useRef(null);
  const roiCapable = ROI_TYPES.includes(activeResultObj?.type);
  /* Transect : slices serveur uniquement (les derives — amplitude, |V| —
     n'existent pas cote serveur, la coupe le long du trajet serait fausse). */
  const transectCapable = activeResultObj?.type === 'slice' && !activeResultObj?.derived;

  /* ── Mode publication : contexte de figure du resultat actif ──────────── */
  const publicationCtx = useMemo(() => {
    if (!activeResultObj) return null;
    const ax = axisTitlesFor(activeResultObj, t);
    const ctx = datasetContext(activeResultObj);
    const label = activeResultObj.datasetLabel || '';
    return {
      title: activeResultObj.label,
      subtitle: !label || label === ctx ? ctx : `${label} · ${ctx}`,
      credit: PUB_CREDIT,
      xTitle: ax.x,
      yTitle: ax.y,
    };
  }, [activeResultObj, t]);

  /** Export video WebM de l'animation active : rejoue les 48 pas hors ecran
   *  et encode via MediaRecorder (zero dependance, remplace gif.js). */
  const handleExportWebM = useCallback(async () => {
    const gd = sharedPlotRef.current;
    const anim = activeData;
    if (!gd || !anim?.frames?.length) return;
    showToast(t('export.webmStart'), 'info');
    try {
      const frames = showLog
        ? anim.frames.map(f => f.map(row => row.map(v => (v != null && v > 0) ? Math.log10(v) : null)))
        : anim.frames;
      const blob = await exportAnimationWebM(gd, frames, {
        // Coords NATIVES : les frames rejouees sont a la resolution native, alors
        // que le graphe visible peut etre interpole (interpStep). Sans forcer x/y,
        // le restyle du z natif sur des axes interpoles desaligne la video.
        x: anim.longitudes,
        y: anim.latitudes,
        title: `${activeResultObj.datasetLabel} — ${activeResultObj.label}`,
        timeLabel: (i) => formatTime(i),
      });
      downloadBlob(blob, `mars_animation_${activeResultObj.params.variable}.webm`);
      showToast(t('export.webmDone'), 'success');
    } catch {
      showToast(t('export.webmError'), 'error');
    }
  }, [activeData, activeResultObj, showLog, showToast, t]);

  /** Montage de la grille entiere en une figure de publication (PNG). */
  const handlePubGrid = useCallback(async () => {
    const cells = Array.from(document.querySelectorAll('.mcv-cell'))
      .map(cell => ({
        gd: cell.querySelector('.js-plotly-plot'),
        title: cell.querySelector('.mcv-cell-head .t')?.textContent ?? '',
        context: cell.querySelector('.mcv-cell-head .ds')?.textContent ?? '',
      }))
      .filter(c => c.gd && c.gd._fullLayout);
    if (cells.length === 0) return;
    try {
      const url = await exportGridMontage(cells, { title: t('export.pubGridHeader'), credit: PUB_CREDIT });
      triggerDownload(url, 'mcv_grid_publication.png');
      showToast(t('toast.pngExported'));
    } catch {
      showToast(t('export.pngError'), 'error');
    }
  }, [t, showToast]);

  const handleRoiSelect = useCallback((bounds) => {
    const grid = resultsById[activeResult]?.data;
    const stats = grid ? computeRegionStats(grid, bounds) : null;
    dispatch({ type: A.SET_ROI_ENTRY, value: stats ? { resultId: activeResult, stats } : null });
  }, [resultsById, activeResult, dispatch]);

  const handleRoiClear = useCallback(() => {
    dispatch({ type: A.SET_ROI_ENTRY, value: null });
  }, [dispatch]);

  /* ─── Switcher de disposition (vivait dans la barre superieure, fusionne
     ici : la barre dediee prenait trop de place verticale) ─────────────── */
  const layoutIcon = { 1: <SingleViewIcon sx={{ fontSize: 16 }} />, 4: <GridViewIcon sx={{ fontSize: 16 }} /> };
  const layoutSwitcher = (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={layout}
      onChange={(_, v) => { if (v) dispatch({ type: A.SET_LAYOUT, value: v }); }}
      aria-label={t('explore.layout.label')}
      className="mcv-lay"
      data-tour="layout"
      sx={{ ml: 1, flexShrink: 0 }}
    >
      {LAYOUTS.map(n => (
        <ToggleButton key={n} value={n} aria-label={t(`explore.layout.${n}`)}>
          {/* Icone parlante (panneau unique / grille 2x2) au lieu d'un chiffre nu :
              on comprend « 4 vues en grille » sans deviner. */}
          <Tooltip title={t(`explore.layout.${n}`)} arrow>
            <span style={{ display: 'inline-flex' }}>{layoutIcon[n] ?? n}</span>
          </Tooltip>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );

  /* Bouton « ? » : rejoue la visite guidee (desktop seulement). */
  const replayButton = onReplayTour && (
    <Tooltip title={t('explore.tour.replay')} arrow>
      <IconButton
        size="small"
        onClick={onReplayTour}
        aria-label={t('explore.tour.replay')}
        sx={{ flexShrink: 0, color: 'var(--text-secondary)', '&:hover': { color: 'var(--mars-orange)' } }}
      >
        <HelpIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );

  /* Bouton « + » : ouvre (epingle) le panneau de parametres pour composer une
     nouvelle vue — rend l'ajout de vue decouvrable sans trouver la languette. */
  const addViewButton = onRequestParams && resultOrder.length < MAX_TABS && (
    <Tooltip title={t('page.explore.newView')} arrow>
      <IconButton
        size="small"
        onClick={onRequestParams}
        aria-label={t('page.explore.newView')}
        sx={{ flexShrink: 0, color: 'var(--mars-orange)' }}
      >
        <AddIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );

  /* ─── Empty state (les sessions restent accessibles) ──────────────────── */
  if (resultOrder.length === 0) {
    return (
      <>
        <Paper className="mcv-tabrow" sx={{ px: 1, py: 0.5, mb: 1, display: 'flex', alignItems: 'center', minHeight: 40, flexWrap: 'wrap', rowGap: 0.5 }}>
          <SessionChips />
          <Box sx={{ flex: 1 }} />
          {replayButton}
          {layoutSwitcher}
        </Paper>
        <Paper className="mcv-empty-stage" sx={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          p: 4, textAlign: 'center',
        }}>
          {/* Accueil guide : titre + 3 etapes numerotees + action directe. Remplace
              la phrase grise unique qui n'indiquait pas ou etaient les parametres. */}
          <Box sx={{ maxWidth: 440 }}>
            <GridOnIcon sx={{ fontSize: 52, color: 'var(--mars-orange)', opacity: 0.55, mb: 1.5 }} />
            <Typography sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.15rem', mb: 1.5 }}>
              {t('page.explore.emptyTitle')}
            </Typography>
            <Box component="ol" sx={{
              textAlign: 'left', color: 'var(--text-secondary)', m: '0 auto 1.25rem',
              pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.75, maxWidth: 380,
            }}>
              <li><Typography variant="body2">{t('page.explore.emptyStep1')}</Typography></li>
              <li><Typography variant="body2">{t('page.explore.emptyStep2')}</Typography></li>
              <li><Typography variant="body2">{t('page.explore.emptyStep3')}</Typography></li>
            </Box>
            {/* Pas de CTA « Ouvrir les paramètres » ici : tant qu'aucune vue
                n'existe, ExplorePage force le panneau OUVERT (paramsExpanded =
                noResults) — le bouton épinglait un panneau déjà visible. */}
          </Box>
        </Paper>
      </>
    );
  }

  return (
    <>
      {/* ── Rangee d'onglets fine : sessions, onglets, disposition, export ── */}
      <Paper className="mcv-tabrow" sx={{ px: 1, mb: 1, display: 'flex', alignItems: 'center', minHeight: 40, flexWrap: 'wrap', rowGap: 0.5 }}>
        <SessionChips />
        <Tabs
          // `false` = aucun onglet selectionne : pendant le rejeu d'une session
          // les onglets existent avant que la vue active soit designee.
          value={activeResult ?? false}
          onChange={(_, v) => dispatch({ type: A.SET_ACTIVE_RESULT, value: v })}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            flex: '1 1 240px',
            minWidth: 0,
            minHeight: 36,
            '& .MuiTab-root': { minHeight: 36, textTransform: 'none', minWidth: 0, maxWidth: 180, px: 1.25, py: 0.25 },
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
                    {/* Indicateur : cette vue est actuellement affichee dans la grille */}
                    {layout > 1 && gridIds.includes(r.id) && (
                      <GridOnIcon
                        titleAccess={t('explore.layout.inGrid')}
                        sx={{ fontSize: 12, color: 'var(--cyan-accent, #38bdf8)', opacity: 0.85, flexShrink: 0 }}
                      />
                    )}
                    <Typography variant="body2" noWrap sx={{ maxWidth: 120, fontSize: '0.8rem' }}>{resultLabel(r, t)}</Typography>
                    {/* span role=button (pas un <button>) : un Tab MUI est deja un
                        <button>, et le HTML interdit les boutons imbriques. */}
                    <Box
                      component="span"
                      role="button"
                      tabIndex={0}
                      aria-label={t('explore.close_tab')}
                      onClick={e => { e.stopPropagation(); onRemoveResult(r.id); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation(); e.preventDefault(); onRemoveResult(r.id);
                        }
                      }}
                      sx={{
                        display: 'inline-flex', alignItems: 'center', p: 0.3,
                        borderRadius: '50%', cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(128, 128, 128, 0.25)' },
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 16 }} />
                    </Box>
                  </Box>
                </Tooltip>
              }
            />
          ); })}
        </Tabs>

        {/* Tab count */}
        <Chip
          label={`${resultOrder.length}/${MAX_TABS}`}
          size="small"
          sx={{
            ml: 0.5, height: 20, fontSize: '0.65rem', fontWeight: 600,
            bgcolor: 'var(--bg-surface-hover)', color: 'var(--text-secondary)', flexShrink: 0,
          }}
        />

        {addViewButton}

        {/* Ls exact (individual datasets) */}
        {activeData?.actualLs != null && (
          <Chip
            label={t('page.explore.actualLs', { ls: activeData.actualLs.toFixed(2) })}
            size="small"
            sx={{
              bgcolor: 'var(--cyan-highlight)', color: 'var(--cyan-accent)',
              border: '1px solid var(--cyan-accent)', fontFamily: 'var(--font-body)',
              flexShrink: 0, ml: 1,
            }}
          />
        )}

        {/* Resolution d'affichage (natif / 2 deg / 1 deg) — cartes lat/lon */}
        {INTERP_TYPES.includes(activeResultObj?.type) && (
          <Box sx={{ ml: 0.5, flexShrink: 0 }}>
            <InterpolationToggle
              value={interpStep}
              onChange={v => dispatch({ type: A.SET_INTERP_STEP, value: v })}
              compact
            />
          </Box>
        )}

        {/* Quick diff: compare active slice with a user-chosen slice tab. */}
        {activeResultObj?.type === 'slice' && otherSlices.length > 0 && (() => {
          const computeDiff = (otherId) => {
            if (resultOrder.length >= MAX_TABS) {
              showToast(t('page.explore.tabLimit', { max: MAX_TABS }), 'warning');
              return;
            }
            const a = activeResultObj.data;
            const b = resultsById[otherId].data;
            if (!a?.data || !b?.data) return;
            const nLat = Math.min(a.data.length, b.data.length);
            const diff = Array.from({ length: nLat }, (_, i) => {
              const nLon = Math.min(a.data[i]?.length || 0, b.data[i]?.length || 0);
              return Array.from({ length: nLon }, (_, j) => {
                // null − null vaut 0 en JS : sans garde, chaque cellule manquante
                // fabriquerait un Δ=0 (fausses regions « sans difference » + stats
                // corrompues). Une cellule trouee reste trouee (gap Plotly).
                const va = a.data[i][j], vb = b.data[i][j];
                return (va == null || vb == null || Number.isNaN(va) || Number.isNaN(vb))
                  ? null : va - vb;
              });
            });
            const flat = diff.flat().filter(v => v != null && !Number.isNaN(v));
            if (flat.length === 0) return;
            flat.sort((x, y) => x - y);
            const min = flat[0], max = flat[flat.length - 1];
            const mean = flat.reduce((s, v) => s + v, 0) / flat.length;
            const stddev = Math.sqrt(flat.reduce((s, v) => s + (v - mean) ** 2, 0) / flat.length);
            const mid = flat.length >> 1;
            const median = flat.length % 2 ? flat[mid] : (flat[mid - 1] + flat[mid]) / 2;
            const diffResult = {
              id: Date.now().toString(),
              type: 'difference',
              label: `Δ ${activeResultObj.label} − ${resultsById[otherId].label}`,
              params: activeResultObj.params,
              data: {
                data: diff, latitudes: a.latitudes, longitudes: a.longitudes,
                datasetA: activeResultObj.datasetLabel, datasetB: resultsById[otherId].datasetLabel,
                variable: activeResultObj.params.variable,
                stats: { min, max, mean, stddev, median },
              },
              datasetLabel: t('explore.clientDiff'),
            };
            dispatch({ type: A.ADD_RESULT, result: diffResult });
            dispatch({ type: A.SET_ACTIVE_RESULT, value: diffResult.id });
          };

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

        {replayButton}
        {layoutSwitcher}

        {/* Export menu (PNG, SVG, CSV) */}
        {activeResultObj && (
          <Box sx={{ ml: 1, flexShrink: 0 }}>
            <ExportMenu
              plotRef={sharedPlotRef}
              filename={`mars_${activeResultObj.type}_${activeResultObj.params.variable}`}
              onCSV={onExportCSV}
              onNetCDF={activeResultObj.type === 'slice' && !activeResultObj.derived ? onExportNetCDF : null}
              publication={publicationCtx}
              onPubGrid={layout > 1 && gridIds.length > 1 ? handlePubGrid : null}
              onWebM={activeResultObj.type === 'animation' && webmSupported() ? handleExportWebM : null}
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

      {showAnomaly && activeResultObj?.type === 'slice' && !curtainActive && (
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

      {/* ── Zone de vues ─────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {curtainActive ? (
          <CellErrorBoundary t={t} key={`curtain-${activeResultObj.id}-${curtainB.id}`}>
            <CurtainCompare
              resultA={activeResultObj}
              resultB={curtainB}
              sharedPlotRef={sharedPlotRef}
            />
          </CellErrorBoundary>
        ) : layout === 1 ? (
          <>
            {activeResultObj && (
              <Box ref={singleHostRef} sx={{ position: 'relative' }}>
                <CellErrorBoundary t={t} key={activeResultObj.id}>
                  <ExploreResultViewer
                    result={activeResultObj}
                    isActive
                    onActivePlotNode={setActivePlotNode}
                    windData={activeResultObj.type === 'slice' && (showWind || showWindParticles) ? windData : null}
                  />
                </CellErrorBoundary>
                {/* La sonde liee publie AUSSI depuis la vue simple : sans cette
                    couche, le panneau lateral restait muet hors grille. */}
                {PROBE_TYPES.includes(activeResultObj.type) && (
                  <ProbeLayer
                    resultId={activeResultObj.id}
                    result={activeResultObj}
                    hostRef={singleHostRef}
                  />
                )}
                <RoiLayer
                  hostRef={singleHostRef}
                  enabled={roiMode && roiCapable}
                  onSelect={handleRoiSelect}
                  onClear={handleRoiClear}
                />
                <TransectLayer
                  hostRef={singleHostRef}
                  enabled={transectMode && transectCapable}
                  onSelect={onTransectSelect}
                />
              </Box>
            )}

            {isLatLonHeatmap && activeResultObj && (
              <DetailPanel
                resultData={activeData}
                resultType={activeResultObj.type}
                variableCode={activeResultObj.params.variable}
              />
            )}

            {/* Drill-down: click on lat/lon heatmap → launch related viz
                (vues temporelles masquées pour les datasets INDIVIDUAL) */}
            {isLatLonHeatmap && onDrillDown && (
              <DrillDownMenu
                plotRef={sharedPlotRef}
                onDrillDown={onDrillDown}
                hiddenTypes={activeResultObj?.params?.dataset?.startsWith(INDIVIDUAL_PREFIX) ? MEAN_ONLY_TYPES : []}
              />
            )}
          </>
        ) : (
          <Box className="mcv-viewgrid" sx={{
            display: 'grid', gap: 1.25,
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            alignItems: 'start',
          }}>
            {visibleIds.map(id => {
              const r = resultsById[id];
              if (!r) return null;
              const isCellActive = id === activeResult;
              return (
                <GridCell
                  key={id}
                  result={r}
                  isActive={isCellActive}
                  onActivate={() => { if (!isCellActive) dispatch({ type: A.SET_ACTIVE_RESULT, value: id }); }}
                  onClose={onRemoveResult}
                  probeEnabled={PROBE_TYPES.includes(r.type)}
                  roiEnabled={roiMode && isCellActive && ROI_TYPES.includes(r.type)}
                  onRoiSelect={handleRoiSelect}
                  onRoiClear={handleRoiClear}
                  transectEnabled={transectMode && isCellActive && r.type === 'slice' && !r.derived}
                  onTransectSelect={onTransectSelect}
                  syncEnabled={syncZoom && ['slice', 'animation', 'difference'].includes(r.type)}
                  showAnomaly={showAnomaly}
                  colorscaleSetting={r.colorscale ?? 'auto'}
                  onDrillDown={onDrillDown && LATLON_HEATMAP_TYPES.includes(r.type)
                    ? (payload) => onDrillDown(payload, r.id)
                    : null}
                >
                  <CellErrorBoundary t={t}>
                    <ExploreResultViewer
                      result={r}
                      isActive={isCellActive}
                      compact
                      onActivePlotNode={setActivePlotNode}
                      windData={isCellActive && r.type === 'slice' && (showWind || showWindParticles) ? windData : null}
                    />
                  </CellErrorBoundary>
                </GridCell>
              );
            })}
          </Box>
        )}
      </Box>
    </>
  );
}
