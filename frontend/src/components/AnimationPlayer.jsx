import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Paper, Box, Slider, IconButton, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { PlayArrow, Pause } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { formatTime } from './TimeSelector';
import { VARIABLES_MAP } from './VariableSelector';
import { buildLocationTrace } from '../data/marsLocations';
import { computeHeatmapCustomData } from '../utils/heatmapAnalysis';
import { RDBU_VARIABLES } from '../utils/colorscales';
import { downloadAnimationCSV } from '../utils/exportUtils';
import ExportMenu from './ExportMenu';
import StatsBar from './StatsBar';

/** Duree de base d'une frame en ms (vitesse 1x = ~3.3 fps) */
const BASE_FRAME_MS = 300;

/** Presets de vitesse disponibles */
const SPEED_OPTIONS = [0.5, 1, 2, 4];

/** Reperes du slider scrub (toutes les ~4 heures martiennes) */
const scrubMarks = [0, 7, 15, 23, 31, 39, 47].map(t => ({
  value: t,
  label: formatTime(t)
}));

/**
 * Lecteur d'animation du cycle diurne martien (48 frames de heatmap lat/lon).
 *
 * Utilise Plotly.js directement via useRef (meme approche que SliceViewer).
 * - Plotly.newPlot() a la reception des donnees (animationData change)
 * - Plotly.react() pour les changements de frame (plus performant que newPlot
 *   car reutilise le graphique existant)
 * - Plotly.purge() au demontage pour liberer la memoire
 *
 * L'animation utilise requestAnimationFrame avec accumulation de temps
 * (au lieu de setInterval) pour un rendu plus fluide et une pause automatique
 * quand l'onglet est inactif (economie de ressources).
 *
 * Le slider utilise une transition CSS sur le pouce pour un deplacement
 * visuellement fluide entre les frames (glissement sur 300ms au lieu de saut).
 *
 * @param {Object|null} animationData - reponse de GET /api/data/animation
 *   { dataset, variable, altitudeIndex, frameCount, frames: number[][][],
 *     latitudes: number[], longitudes: number[], stats }
 * @param {string|null} variableCode - code variable pour le titre de la colorbar
 * @param {boolean}     logScale     - afficher l'echelle en log10 (pour variables a faibles valeurs)
 */
function AnimationPlayer({ animationData, variableCode, datasetLabel, showLocations = false, showSurface = false, colorscaleName, reverseColorscale, customZMin, customZMax, showDetailedTooltip = false, noExportMenu = false, externalPlotRef = null, logScale = false }) {
  const { t, i18n } = useTranslation();
  const internalPlotRef = useRef(null);
  const plotRef = externalPlotRef ?? internalPlotRef;
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);
  const frameCountRef = useRef(48);
  const customDataCacheRef = useRef(new Map());
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  /** Couleur de texte pour les graphiques Plotly en dark mode */
  const fontColor = 'rgba(255,255,255,0.85)';

  /** Unite physique de la variable (ex: 'K', 'Pa', 'm/s') */
  const unit = VARIABLES_MAP.get(variableCode)?.unit || '';

  /** Label lisible de la variable (ex: 'Temperature' au lieu de 'TT') */
  const variableLabel = VARIABLES_MAP.get(variableCode) ? t(`variable.${variableCode}`) : variableCode;

  /** Formate l'altitude : valeur réelle en km si disponible, sinon index */
  const altitudeText = animationData?.altitudeValue != null
    ? `~${Number(animationData.altitudeValue).toFixed(1)} km`
    : animationData?.altitudeIndex != null ? `${t('selector.altitude.level')} ${animationData.altitudeIndex}` : '';

  /** Titre Plotly statique (sans l'heure qui change) */
  const plotTitle = {
    text: `${datasetLabel || ''} — ${variableLabel} — ${altitudeText}`,
    font: { size: 16 }
  };

  /** Arrete l'animation en cours */
  const stopAnimation = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTimeRef.current = null;
  }, []);

  /**
   * Calcule les ticks de la colorbar pour l'echelle log10.
   * Utilise les stats globales de l'animation pour une colorbar coherente
   * entre toutes les frames.
   */
  const computeLogTicks = useCallback((stats) => {
    if (!stats || stats.min <= 0 || stats.max <= 0) return { colorbar: {}, zMin: null, zMax: null };
    let zMin = Math.floor(Math.log10(stats.min));
    let zMax = Math.ceil(Math.log10(stats.max));
    if (zMin === zMax) { zMin -= 1; zMax += 1; }
    const tickvals = [], ticktext = [];
    for (let e = zMin; e <= zMax; e++) { tickvals.push(e); ticktext.push(`10^${e}`); }
    return { colorbar: { tickvals, ticktext }, zMin, zMax };
  }, []);

  /** Creation initiale du graphique quand animationData change */
  useEffect(() => {
    const el = plotRef.current;
    if (!el || !animationData) return;

    setCurrentFrame(0);
    setIsPlaying(false);
    stopAnimation();

    // Mettre a jour le nombre de frames pour la boucle d'animation
    frameCountRef.current = animationData.frameCount ?? animationData.frames?.length ?? 48;
    // Vider le cache customData (les frames ont change)
    customDataCacheRef.current.clear();

    const { frames, latitudes, longitudes } = animationData;

    const lonMin = Math.min(...longitudes);
    const lonMax = Math.max(...longitudes);
    const latMin = Math.min(...latitudes);
    const latMax = Math.max(...latitudes);

    const useRdBu = RDBU_VARIABLES.includes(variableCode);
    const finalColorscale = colorscaleName || (useRdBu ? 'RdBu' : 'Viridis');
    const finalReverse = reverseColorscale != null ? reverseColorscale : useRdBu;
    const dataIs0to360 = longitudes.some(l => l > 180);

    // ── Log scale transform (frame 0) ────────────────────────────────────
    let initFrame = frames[0];
    let logColorbarExtra = {};
    let logZMin = null, logZMax = null;
    let initCustomdata;
    let hoverTemplate;

    if (logScale) {
      initFrame = frames[0].map(row => row.map(v => (v != null && v > 0) ? Math.log10(v) : null));
      const logTicks = computeLogTicks(animationData.stats);
      logColorbarExtra = logTicks.colorbar;
      logZMin = logTicks.zMin;
      logZMax = logTicks.zMax;
      initCustomdata = frames[0];
      hoverTemplate = 'Lon: %{x}\u00b0<br>Lat: %{y}\u00b0<br>Valeur: %{customdata:.6g} ' + unit + '<br>log\u2081\u2080 = %{z:.3f}<extra></extra>';
    } else if (showDetailedTooltip) {
      if (!customDataCacheRef.current.has(0))
        customDataCacheRef.current.set(0, computeHeatmapCustomData(frames[0], latitudes, longitudes));
      initCustomdata = customDataCacheRef.current.get(0);
      hoverTemplate = 'Lon: %{x}\u00b0  Lat: %{y}\u00b0<br><b>%{z:.6g} ' + unit + '</b><br>\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500<br>' +
        'Anom. zonale: %{customdata[0]:+.6g}<br>' +
        '\u2202/\u2202lat: %{customdata[1]:.2e} /\u00b0<br>' +
        '\u2202/\u2202lon: %{customdata[2]:.2e} /\u00b0<br>' +
        'Percentile: %{customdata[3]:.0f}%<br>' +
        'POI: %{customdata[4]} (%{customdata[5]} km)<extra></extra>';
    } else {
      hoverTemplate = 'Lon: %{x}\u00b0<br>Lat: %{y}\u00b0<br>Valeur: %{z:.6g} ' + unit + '<extra></extra>';
    }

    const initTraces = [{
      type: 'heatmap',
      x: longitudes,
      y: latitudes,
      z: initFrame,
      colorscale: finalColorscale,
      reversescale: finalReverse,
      ...(logScale
        ? (logZMin != null ? { zmin: logZMin, zmax: logZMax } : {})
        : { ...(customZMin != null ? { zmin: customZMin } : {}), ...(customZMax != null ? { zmax: customZMax } : {}) }),
      ...(initCustomdata ? { customdata: initCustomdata } : {}),
      zsmooth: 'best',
      connectgaps: true,
      opacity: showSurface ? 0.55 : 1,
      colorbar: {
        title: {
          text: logScale ? `log\u2081\u2080(${variableLabel})` : `${variableLabel} (${unit})`,
          side: 'right',
          font: { color: fontColor },
        },
        thickness: 15,
        len: 0.9,
        outlinewidth: 0,
        tickfont: { size: 11, color: fontColor },
        ...logColorbarExtra,
      },
      hovertemplate: hoverTemplate,
    }];

    if (showLocations) initTraces.push(buildLocationTrace(longitudes));

    const layout = {
      title: { ...plotTitle, font: { ...plotTitle.font, color: fontColor } },
      font: { color: fontColor },
      xaxis: {
        title: t('viz.longitude'),
        range: [lonMin, lonMax],
        showgrid: false,
        zeroline: false,
        autorange: false,
        color: fontColor
      },
      yaxis: {
        title: t('viz.latitude'),
        range: [latMin, latMax],
        showgrid: false,
        zeroline: false,
        autorange: false,
        color: fontColor
      },
      margin: { t: 80, r: 120, b: 50, l: 70 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)'
    };

    if (showSurface) {
      layout.images = [{
        source: '/mars-surface.jpg',
        xref: 'x',
        yref: 'y',
        x: dataIs0to360 ? 0 : -180,
        y: 90,
        sizex: 360,
        sizey: 180,
        sizing: 'stretch',
        opacity: 0.9,
        layer: 'below'
      }];
    }

    Plotly.newPlot(el, initTraces, layout, {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d']
    });

    return () => Plotly.purge(el);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationData, variableCode, unit, stopAnimation, logScale, i18n.language]);

  /** Mise a jour du graphique quand la frame change (Plotly.react = update performant) */
  useEffect(() => {
    if (!plotRef.current || !animationData) return;

    const { frames, latitudes, longitudes } = animationData;

    const lonMin = Math.min(...longitudes);
    const lonMax = Math.max(...longitudes);
    const latMin = Math.min(...latitudes);
    const latMax = Math.max(...latitudes);

    const useRdBu = RDBU_VARIABLES.includes(variableCode);
    const finalColorscale = colorscaleName || (useRdBu ? 'RdBu' : 'Viridis');
    const finalReverse = reverseColorscale != null ? reverseColorscale : useRdBu;
    const dataIs0to360 = longitudes.some(l => l > 180);

    // ── Log scale transform (frame courante) ──────────────────────────────
    let frameData = frames[currentFrame];
    let logColorbarExtra = {};
    let logZMin = null, logZMax = null;
    let frameCustomdata;
    let hoverTemplate;

    if (logScale) {
      frameData = frames[currentFrame].map(row => row.map(v => (v != null && v > 0) ? Math.log10(v) : null));
      const logTicks = computeLogTicks(animationData.stats);
      logColorbarExtra = logTicks.colorbar;
      logZMin = logTicks.zMin;
      logZMax = logTicks.zMax;
      frameCustomdata = frames[currentFrame];
      hoverTemplate = 'Lon: %{x}\u00b0<br>Lat: %{y}\u00b0<br>Valeur: %{customdata:.6g} ' + unit + '<br>log\u2081\u2080 = %{z:.3f}<extra></extra>';
    } else if (showDetailedTooltip) {
      // Calcul du tooltip enrichi mis en cache par index de frame
      if (!customDataCacheRef.current.has(currentFrame))
        customDataCacheRef.current.set(currentFrame, computeHeatmapCustomData(frames[currentFrame], latitudes, longitudes));
      frameCustomdata = customDataCacheRef.current.get(currentFrame);
      hoverTemplate = 'Lon: %{x}\u00b0  Lat: %{y}\u00b0<br><b>%{z:.6g} ' + unit + '</b><br>\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500<br>' +
        'Anom. zonale: %{customdata[0]:+.6g}<br>' +
        '\u2202/\u2202lat: %{customdata[1]:.2e} /\u00b0<br>' +
        '\u2202/\u2202lon: %{customdata[2]:.2e} /\u00b0<br>' +
        'Percentile: %{customdata[3]:.0f}%<br>' +
        'POI: %{customdata[4]} (%{customdata[5]} km)<extra></extra>';
    } else {
      hoverTemplate = 'Lon: %{x}\u00b0<br>Lat: %{y}\u00b0<br>Valeur: %{z:.6g} ' + unit + '<extra></extra>';
    }

    const frameTraces = [{
      type: 'heatmap',
      x: longitudes,
      y: latitudes,
      z: frameData,
      colorscale: finalColorscale,
      reversescale: finalReverse,
      ...(logScale
        ? (logZMin != null ? { zmin: logZMin, zmax: logZMax } : {})
        : { ...(customZMin != null ? { zmin: customZMin } : {}), ...(customZMax != null ? { zmax: customZMax } : {}) }),
      ...(frameCustomdata ? { customdata: frameCustomdata } : {}),
      zsmooth: 'best',
      connectgaps: true,
      opacity: showSurface ? 0.55 : 1,
      colorbar: {
        title: {
          text: logScale ? `log\u2081\u2080(${variableLabel})` : `${variableLabel} (${unit})`,
          side: 'right',
          font: { color: fontColor },
        },
        thickness: 15,
        len: 0.9,
        outlinewidth: 0,
        tickfont: { size: 11, color: fontColor },
        ...logColorbarExtra,
      },
      hovertemplate: hoverTemplate,
    }];

    if (showLocations) frameTraces.push(buildLocationTrace(longitudes));

    const layout = {
      title: { ...plotTitle, font: { ...plotTitle.font, color: fontColor } },
      font: { color: fontColor },
      xaxis: {
        title: t('viz.longitude'),
        range: [lonMin, lonMax],
        showgrid: false,
        zeroline: false,
        autorange: false,
        color: fontColor
      },
      yaxis: {
        title: t('viz.latitude'),
        range: [latMin, latMax],
        showgrid: false,
        zeroline: false,
        autorange: false,
        color: fontColor
      },
      margin: { t: 80, r: 120, b: 50, l: 70 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)'
    };

    if (showSurface) {
      layout.images = [{
        source: '/mars-surface.jpg',
        xref: 'x',
        yref: 'y',
        x: dataIs0to360 ? 0 : -180,
        y: 90,
        sizex: 360,
        sizey: 180,
        sizing: 'stretch',
        opacity: 0.9,
        layer: 'below'
      }];
    }

    Plotly.react(plotRef.current, frameTraces, layout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFrame, animationData, variableCode, unit, datasetLabel, showLocations, showSurface, colorscaleName, reverseColorscale, customZMin, customZMax, showDetailedTooltip, logScale, i18n.language]);

  /** Duree effective d'une frame selon la vitesse choisie */
  const frameDuration = BASE_FRAME_MS / speed;

  /** Boucle requestAnimationFrame avec accumulation de temps */
  useEffect(() => {
    if (!isPlaying) {
      stopAnimation();
      return;
    }

    const effectiveDuration = BASE_FRAME_MS / speed;

    const animate = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const elapsed = timestamp - lastTimeRef.current;
      if (elapsed >= effectiveDuration) {
        setCurrentFrame(f => (f + 1) % frameCountRef.current);
        lastTimeRef.current = timestamp;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return stopAnimation;
  }, [isPlaying, speed, stopAnimation]);

  /** Styles du slider memoises pour eviter la recompilation CSS MUI a chaque render */
  const sliderSx = useMemo(() => ({
    mx: 2, flexGrow: 1,
    '& .MuiSlider-thumb': {
      transition: isPlaying ? `left ${Math.round(frameDuration)}ms linear` : 'none'
    }
  }), [isPlaying, frameDuration]);

  if (!animationData) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          {t('viz.animation.empty')}
        </Typography>
      </Paper>
    );
  }

  const { stats, frames, altitudeIndex } = animationData;
  const maxFrame = frames.length - 1;

  /** Export CSV client-side via l'utilitaire partage (stats par frame) */
  const handleExportCSV = () => downloadAnimationCSV(frames, variableCode, altitudeIndex);

  const exportFilename = `mars_animation_${variableCode || 'plot'}`;

  return (
    <Box>
      {!noExportMenu && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
          <ExportMenu plotRef={plotRef} filename={exportFilename} onCSV={handleExportCSV} />
        </Box>
      )}
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <div ref={plotRef} style={{ width: '100%' }} />
      </Paper>

      {/* Controles : Play/Pause + Vitesse + Slider scrub */}
      <Paper sx={{ p: 1.5, mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            color="primary"
            onClick={() => setIsPlaying(p => !p)}
            aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
          >
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>

          <ToggleButtonGroup
            value={speed}
            exclusive
            onChange={(_, v) => { if (v !== null) setSpeed(v); }}
            size="small"
          >
            {SPEED_OPTIONS.map(s => (
              <ToggleButton key={s} value={s} sx={{ px: 1.2, py: 0.3, fontSize: '0.75rem' }}>
                {s}x
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Typography
            variant="body2"
            sx={{ minWidth: 45, textAlign: 'center', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
          >
            {formatTime(currentFrame)}
          </Typography>

          <Slider
            min={0}
            max={maxFrame}
            step={1}
            value={currentFrame}
            onChange={(_, v) => { setIsPlaying(false); setCurrentFrame(v); }}
            marks={scrubMarks}
            sx={sliderSx}
          />
        </Box>
      </Paper>

      <StatsBar stats={stats} />
    </Box>
  );
}

export default AnimationPlayer;
