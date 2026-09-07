/**
 * Outils contextuels de la console Explorer, affiches dans le panneau
 * inspecteur droit, au-dessus de la sonde liee (ex-rail vertical gauche,
 * supprime : une colonne entiere pour quelques icones gaspillait la place).
 *
 * Regroupe les toggles d'affichage lies a l'onglet ACTIF : couches (POI,
 * fond, sonde detaillee, anomalie, vents, relief), echelles (log, lissage),
 * region, transect, zoom synchronise, rideau A/B et couches derivees.
 * Les aria-labels sont inchanges (stabilite des tests E2E).
 */
import { useMemo } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import {
  Place as PlaceIcon,
  Map as MapIcon,
  Science as ScienceIcon,
  CompareArrows as AnomalyIcon,
  Air as WindIcon,
  Waves as WindParticlesIcon,
  Terrain as TopoIcon,
  Functions as LogIcon,
  BlurOn as SmoothIcon,
  HighlightAlt as RoiIcon,
  Route as TransectIcon,
  SyncAlt as SyncZoomIcon,
  Compare as CurtainIcon,
  UnfoldMore as AmplitudeIcon,
  Speed as WindSpeedIcon,
  SelectAll as WindAllViewsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useExploreState, useExploreDispatch, A } from './ExploreContext.jsx';
import { LATLON_HEATMAP_TYPES, COLORSCALE_TYPES, SMOOTH_TYPES, ROI_TYPES } from './exploreConstants.jsx';

/* disableInteractive : sans lui l'infobulle reste ouverte tant que le pointeur
   la survole et recouvre les boutons voisins du rail, qui sont petits et
   serres — les clics partaient alors dans le vide. */
function ToolButton({ title, on = false, color = 'warning', onClick, children }) {
  return (
    <Tooltip title={title} arrow placement="top" disableInteractive>
      <IconButton
        size="small"
        onClick={onClick}
        color={on ? color : 'default'}
        aria-pressed={on}
        aria-label={title}
        className="mcv-tool-btn"
      >
        {children}
      </IconButton>
    </Tooltip>
  );
}

export default function ExploreTools({ onDeriveAmplitude, onDeriveWindSpeed }) {
  const { t } = useTranslation();
  const state = useExploreState();
  const dispatch = useExploreDispatch();
  const {
    resultsById, resultOrder, activeResult,
    showLocations, showSurface, showDetailedTooltip, showAnomaly,
    showWind, showWindParticles, windAllViews, showTopo, showLog, smoothHeatmap,
    roiMode, transectMode, syncZoom, curtainOn, curtainBId, layout,
  } = state;

  const r = resultsById[activeResult] ?? null;
  const isLatLon = LATLON_HEATMAP_TYPES.includes(r?.type);
  const isSlice = r?.type === 'slice';
  const isWindComponent = ['UU', 'VV'].includes(r?.params?.variable);

  /** Slices comparables a l'onglet actif (meme variable) — pour le rideau. */
  const otherSlices = useMemo(() => {
    if (!isSlice) return [];
    return resultOrder
      .filter(id => resultsById[id]?.type === 'slice' && id !== activeResult
        && resultsById[id]?.params?.variable === r?.params?.variable)
      .map(id => resultsById[id]);
  }, [isSlice, resultOrder, resultsById, activeResult, r]);

  const curtainB = resultsById[curtainBId] ?? otherSlices[0] ?? null;
  const curtainActive = curtainOn && isSlice && otherSlices.length > 0;

  /* Rien a afficher pour les types sans toggle (timeseries, profil, rose) */
  const hasTools = !!r && (
    isLatLon || isSlice
    || COLORSCALE_TYPES.includes(r.type) || SMOOTH_TYPES.includes(r.type)
    || ROI_TYPES.includes(r.type)
    || (layout > 1 && ['slice', 'animation', 'difference'].includes(r.type))
    || (r.type === 'animation' && onDeriveAmplitude)
  );
  if (!hasTools) return null;

  return (
    <>
      <Typography className="mcv-ins-h" component="h2">{t('explore.panel.tools')}</Typography>
      <Box className="mcv-tools" role="toolbar" aria-label={t('explore.rail.label')} data-tour="tools">
        {isLatLon && (
          <>
            <ToolButton title={t('explore.toggle.poi')} on={showLocations} onClick={() => dispatch({ type: A.TOGGLE_LOCATIONS })}>
              <PlaceIcon fontSize="small" />
            </ToolButton>
            <ToolButton title={t('explore.toggle.surface')} on={showSurface} onClick={() => dispatch({ type: A.TOGGLE_SURFACE })}>
              <MapIcon fontSize="small" />
            </ToolButton>
            <ToolButton title={t('explore.toggle.tooltip')} on={showDetailedTooltip} onClick={() => dispatch({ type: A.TOGGLE_TOOLTIP })}>
              <ScienceIcon fontSize="small" />
            </ToolButton>
          </>
        )}
        {isSlice && (
          <ToolButton title={t('explore.toggle.anomaly')} on={showAnomaly} onClick={() => dispatch({ type: A.TOGGLE_ANOMALY })}>
            <AnomalyIcon fontSize="small" />
          </ToolButton>
        )}
        {isSlice && !isWindComponent && (
          <>
            <ToolButton title={t('explore.toggle.wind')} on={showWind} color="info" onClick={() => dispatch({ type: A.TOGGLE_WIND })}>
              <WindIcon fontSize="small" />
            </ToolButton>
            <ToolButton title={t('explore.toggle.windParticles')} on={showWindParticles} color="info" onClick={() => dispatch({ type: A.TOGGLE_WIND_PARTICLES })}>
              <WindParticlesIcon fontSize="small" />
            </ToolButton>
            {/* Portee du vent : toutes les vues de la grille, ou la seule vue
                active. N'a de sens qu'en grille, et seulement si une couche de
                vent est allumee — sinon le bouton ne changerait rien de
                visible. Le defaut suit la taille de l'ecran (voir
                makeInitialState dans ExploreContext) : partout sur grand ecran,
                vue active seule sur telephone, ou quatre canvas de particules
                animees coutent cher pour des cartes de la taille d'une
                vignette. */}
            {layout > 1 && (showWind || showWindParticles) && (
              <ToolButton
                title={t('explore.toggle.windAllViews')}
                on={windAllViews}
                color="info"
                onClick={() => dispatch({ type: A.TOGGLE_WIND_ALL_VIEWS })}
              >
                <WindAllViewsIcon fontSize="small" />
              </ToolButton>
            )}
          </>
        )}
        {isSlice && (
          <ToolButton title={t('explore.toggle.topo')} on={showTopo} onClick={() => dispatch({ type: A.TOGGLE_TOPO })}>
            <TopoIcon fontSize="small" />
          </ToolButton>
        )}
        {COLORSCALE_TYPES.includes(r?.type) && (
          <ToolButton title={t('explore.toggle.log')} on={showLog} onClick={() => dispatch({ type: A.TOGGLE_LOG })}>
            <LogIcon fontSize="small" />
          </ToolButton>
        )}
        {SMOOTH_TYPES.includes(r?.type) && (
          <ToolButton title={t('explore.toggle.smooth')} on={smoothHeatmap} onClick={() => dispatch({ type: A.TOGGLE_SMOOTH })}>
            <SmoothIcon fontSize="small" />
          </ToolButton>
        )}
        {ROI_TYPES.includes(r?.type) && (
          <ToolButton
            title={roiMode ? t('explore.roi.exit') : t('explore.roi.enable')}
            on={roiMode}
            onClick={() => dispatch({ type: A.TOGGLE_ROI })}
          >
            <RoiIcon fontSize="small" />
          </ToolButton>
        )}
        {isSlice && !r?.derived && (
          <ToolButton
            title={transectMode ? t('explore.transect.exit') : t('explore.transect.enable')}
            on={transectMode}
            color="info"
            onClick={() => dispatch({ type: A.TOGGLE_TRANSECT })}
          >
            <TransectIcon fontSize="small" />
          </ToolButton>
        )}
        {layout > 1 && ['slice', 'animation', 'difference'].includes(r?.type) && (
          <ToolButton
            title={t('explore.toggle.syncZoom')}
            on={syncZoom}
            color="info"
            onClick={() => dispatch({ type: A.TOGGLE_SYNC_ZOOM })}
          >
            <SyncZoomIcon fontSize="small" />
          </ToolButton>
        )}
        {isSlice && otherSlices.length > 0 && (
          <ToolButton
            title={curtainActive
              ? t('explore.curtain.exit')
              : `${t('explore.curtain.enable')} · B: ${(curtainB ?? otherSlices[0]).label}`}
            on={curtainActive}
            onClick={() => dispatch({ type: A.TOGGLE_CURTAIN, bId: otherSlices[0].id })}
          >
            <CurtainIcon fontSize="small" />
          </ToolButton>
        )}
        {r?.type === 'animation' && onDeriveAmplitude && (
          <ToolButton title={t('explore.derived.amplitude')} onClick={onDeriveAmplitude}>
            <AmplitudeIcon fontSize="small" />
          </ToolButton>
        )}
        {isSlice && !r?.derived && isWindComponent && onDeriveWindSpeed && (
          <ToolButton title={t('explore.derived.wsp')} onClick={onDeriveWindSpeed}>
            <WindSpeedIcon fontSize="small" />
          </ToolButton>
        )}
      </Box>
    </>
  );
}
