import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Plotly, { renderPlot } from '../plotlyBundle';
import { Paper, Box, Slider, IconButton, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { PlayArrow, Pause } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { formatTime } from '../utils/formatTime';
import { VARIABLES_MAP } from './VariableSelector';
import { altitudeLabel } from '../utils/variableUtils';
import { buildLocationTrace } from '../data/marsLocations';
import { computeHeatmapCustomData } from '../utils/heatmapAnalysis';
import { autoColorscaleFor } from '../utils/colorscales';
import { upsampleLatLonGrid, nativeStep } from '../utils/gridInterpolation';
import { downloadAnimationCSV } from '../utils/exportUtils';
import { exportAnimationWebM, webmSupported, downloadBlob } from '../utils/videoExport';
import ExportMenu from './ExportMenu';
import StatsBar from './StatsBar';
import { usePlotlyTheme } from '../hooks/usePlotlyTheme';
import { useToast } from '../context/ToastContext';

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
 * - Plotly.react() partout : creation a la reception des donnees ET changements
 *   de frame (reutilise le graphique existant, pas de destruction/recreation)
 * - Plotly.purge() au demontage uniquement, pour liberer la memoire
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
function AnimationPlayer({ animationData, variableCode, datasetLabel, showLocations = false, showSurface = false, colorscaleName, reverseColorscale, customZMin, customZMax, showDetailedTooltip = false, noExportMenu = false, compact = false, externalPlotRef = null, logScale = false, smooth = true, interpStep = 0, onFrameChange = null }) {
  const { t, i18n } = useTranslation();
  const showToast = useToast();
  const { fontColor, paperBg, plotBg, titleSize, margin: responsiveMargin } = usePlotlyTheme();
  const internalPlotRef = useRef(null);
  const plotRef = externalPlotRef ?? internalPlotRef;

  // Purge Plotly uniquement au demontage : les mises a jour passent par
  // Plotly.react (pas de destruction/recreation du graphe a chaque prop).
  useEffect(() => {
    const el = plotRef.current;
    return () => { if (el) Plotly.purge(el); };
  }, [plotRef]);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);
  const frameCountRef = useRef(48);
  const customDataCacheRef = useRef(new Map());
  const interpCacheRef = useRef(new Map());
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  /* Publie l'index de frame affiche (la sonde liee de l'Explorer echantillonne
     la frame VISIBLE, pas la frame 0). */
  useEffect(() => { onFrameChange?.(currentFrame); }, [currentFrame, onFrameChange]);

  /** Grille d'une frame (sur-echantillonnee si interpStep, avec cache par index). */
  const gridForFrame = useCallback((frames, latitudes, longitudes, idx) => {
    if (!interpStep) return { data: frames[idx], latitudes, longitudes, text: null };
    if (!interpCacheRef.current.has(idx)) {
      interpCacheRef.current.set(idx,
        upsampleLatLonGrid(frames[idx], latitudes, longitudes, interpStep, t('viz.interpolated')));
    }
    return interpCacheRef.current.get(idx);
  }, [interpStep, t]);

  /** Unite physique de la variable (ex: 'K', 'Pa', 'm/s') */
  const unit = VARIABLES_MAP.get(variableCode)?.unit || '';

  /** Label lisible de la variable (ex: 'Temperature' au lieu de 'TT') */
  const variableLabel = VARIABLES_MAP.get(variableCode) ? t(`variable.${variableCode}`) : variableCode;

  /** Formate l'altitude : valeur réelle en km si disponible, sinon index */
  const altitudeText = altitudeLabel(
    variableCode, animationData?.altitudeValue, animationData?.altitudeIndex, t);

  /** Titre Plotly statique (sans l'heure qui change) */
  const plotTitle = {
    text: `${datasetLabel || ''} — ${variableLabel} — ${altitudeText}`,
    font: { size: titleSize }
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
    // Garde defensive : si la reponse arrive partielle (course montage/donnees),
    // on n'entre pas dans le rendu Plotly (frames[0] planterait -> ErrorBoundary).
    if (!Array.isArray(animationData.frames) || animationData.frames.length === 0) return;

    setCurrentFrame(0);
    setIsPlaying(false);
    stopAnimation();

    // Mettre a jour le nombre de frames pour la boucle d'animation
    frameCountRef.current = animationData.frameCount ?? animationData.frames?.length ?? 48;
    // Vider les caches (les frames ou la resolution d'affichage ont change)
    customDataCacheRef.current.clear();
    interpCacheRef.current.clear();

    const grid0 = gridForFrame(animationData.frames, animationData.latitudes, animationData.longitudes, 0);
    const { latitudes, longitudes } = grid0;
    const frame0 = grid0.data;
    const interpSuffix = grid0.text ? ' %{text}' : '';

    const lonMin = Math.min(...longitudes);
    const lonMax = Math.max(...longitudes);
    const latMin = Math.min(...latitudes);
    const latMax = Math.max(...latitudes);

    const finalColorscale = colorscaleName || autoColorscaleFor(variableCode);
    const finalReverse = reverseColorscale ?? false; // RdBu Plotly est deja bleu(bas)->rouge(haut)
    const dataIs0to360 = longitudes.some(l => l > 180);

    // ── Log scale transform (frame 0) ────────────────────────────────────
    let initFrame = frame0;
    let logColorbarExtra = {};
    let logZMin = null, logZMax = null;
    let initCustomdata;
    let hoverTemplate;

    if (logScale) {
      initFrame = frame0.map(row => row.map(v => (v != null && v > 0) ? Math.log10(v) : null));
      const logTicks = computeLogTicks(animationData.stats);
      logColorbarExtra = logTicks.colorbar;
      logZMin = logTicks.zMin;
      logZMax = logTicks.zMax;
      initCustomdata = frame0;
      hoverTemplate = `${t('viz.hover_lon')}: %{x}\u00b0<br>${t('viz.hover_lat')}: %{y}\u00b0<br>${t('viz.hover_value')}: %{customdata:.6g} ${unit}${interpSuffix}<br>log\u2081\u2080 = %{z:.3f}<extra></extra>`;
    } else if (showDetailedTooltip) {
      if (!customDataCacheRef.current.has(0))
        customDataCacheRef.current.set(0, computeHeatmapCustomData(frame0, latitudes, longitudes));
      initCustomdata = customDataCacheRef.current.get(0);
      hoverTemplate = `${t('viz.hover_lon')}: %{x}\u00b0  ${t('viz.hover_lat')}: %{y}\u00b0<br><b>%{z:.6g} ${unit}${interpSuffix}</b><br>\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500<br>` +
        `${t('viz.hover_zonal_anom')}: %{customdata[0]:+.6g}<br>` +
        `\u2202/\u2202lat: %{customdata[1]:.2e} /\u00b0<br>` +
        `\u2202/\u2202lon: %{customdata[2]:.2e} /\u00b0<br>` +
        `${t('viz.hover_percentile')}: %{customdata[3]:.0f}%<br>` +
        `${t('viz.hover_poi')}: %{customdata[4]} (%{customdata[5]} km)<extra></extra>`;
    } else {
      hoverTemplate = `${t('viz.hover_lon')}: %{x}\u00b0<br>${t('viz.hover_lat')}: %{y}\u00b0<br>${t('viz.hover_value')}: %{z:.6g} ${unit}${interpSuffix}<extra></extra>`;
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
        : { zmin: customZMin ?? animationData.stats?.min ?? undefined, zmax: customZMax ?? animationData.stats?.max ?? undefined }),
      ...(grid0.text ? { text: grid0.text } : {}),
      ...(initCustomdata ? { customdata: initCustomdata } : {}),
      zsmooth: smooth ? 'best' : false,
      connectgaps: true,
      opacity: showSurface ? 0.55 : 1,
      showscale: !compact,
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
      title: compact ? undefined : { ...plotTitle, font: { ...plotTitle.font, color: fontColor } },
      font: { color: fontColor },
      xaxis: {
        title: compact ? undefined : { text: t('viz.longitude') },
        range: [lonMin, lonMax],
        showgrid: false,
        zeroline: false,
        autorange: false,
        color: fontColor
      },
      yaxis: {
        title: compact ? undefined : { text: t('viz.latitude') },
        range: [latMin, latMax],
        showgrid: false,
        zeroline: false,
        autorange: false,
        color: fontColor
      },
      margin: compact ? { l: 42, r: 8, t: 8, b: 26 } : { ...responsiveMargin, r: 120 },
      paper_bgcolor: paperBg,
      plot_bgcolor: plotBg
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

    renderPlot(el, initTraces, layout, {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d']
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationData, variableCode, unit, stopAnimation, logScale, smooth, interpStep, gridForFrame, compact, i18n.language, fontColor, paperBg, plotBg, titleSize, responsiveMargin]);

  /** Mise a jour du graphique quand la frame change (Plotly.react = update performant) */
  useEffect(() => {
    if (!plotRef.current || !animationData) return;

    const gridCur = gridForFrame(animationData.frames, animationData.latitudes, animationData.longitudes, currentFrame);
    const { latitudes, longitudes } = gridCur;
    const frameCur = gridCur.data;
    const interpSuffix = gridCur.text ? ' %{text}' : '';

    const lonMin = Math.min(...longitudes);
    const lonMax = Math.max(...longitudes);
    const latMin = Math.min(...latitudes);
    const latMax = Math.max(...latitudes);

    const finalColorscale = colorscaleName || autoColorscaleFor(variableCode);
    const finalReverse = reverseColorscale ?? false; // RdBu Plotly est deja bleu(bas)->rouge(haut)
    const dataIs0to360 = longitudes.some(l => l > 180);

    // ── Log scale transform (frame courante) ──────────────────────────────
    let frameData = frameCur;
    let logColorbarExtra = {};
    let logZMin = null, logZMax = null;
    let frameCustomdata;
    let hoverTemplate;

    if (logScale) {
      frameData = frameCur.map(row => row.map(v => (v != null && v > 0) ? Math.log10(v) : null));
      const logTicks = computeLogTicks(animationData.stats);
      logColorbarExtra = logTicks.colorbar;
      logZMin = logTicks.zMin;
      logZMax = logTicks.zMax;
      frameCustomdata = frameCur;
      hoverTemplate = `${t('viz.hover_lon')}: %{x}\u00b0<br>${t('viz.hover_lat')}: %{y}\u00b0<br>${t('viz.hover_value')}: %{customdata:.6g} ${unit}${interpSuffix}<br>log\u2081\u2080 = %{z:.3f}<extra></extra>`;
    } else if (showDetailedTooltip) {
      // Calcul du tooltip enrichi mis en cache par index de frame
      if (!customDataCacheRef.current.has(currentFrame))
        customDataCacheRef.current.set(currentFrame, computeHeatmapCustomData(frameCur, latitudes, longitudes));
      frameCustomdata = customDataCacheRef.current.get(currentFrame);
      hoverTemplate = `${t('viz.hover_lon')}: %{x}\u00b0  ${t('viz.hover_lat')}: %{y}\u00b0<br><b>%{z:.6g} ${unit}${interpSuffix}</b><br>\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500<br>` +
        `${t('viz.hover_zonal_anom')}: %{customdata[0]:+.6g}<br>` +
        `\u2202/\u2202lat: %{customdata[1]:.2e} /\u00b0<br>` +
        `\u2202/\u2202lon: %{customdata[2]:.2e} /\u00b0<br>` +
        `${t('viz.hover_percentile')}: %{customdata[3]:.0f}%<br>` +
        `${t('viz.hover_poi')}: %{customdata[4]} (%{customdata[5]} km)<extra></extra>`;
    } else {
      hoverTemplate = `${t('viz.hover_lon')}: %{x}\u00b0<br>${t('viz.hover_lat')}: %{y}\u00b0<br>${t('viz.hover_value')}: %{z:.6g} ${unit}${interpSuffix}<extra></extra>`;
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
        : { zmin: customZMin ?? animationData.stats?.min ?? undefined, zmax: customZMax ?? animationData.stats?.max ?? undefined }),
      ...(gridCur.text ? { text: gridCur.text } : {}),
      ...(frameCustomdata ? { customdata: frameCustomdata } : {}),
      zsmooth: smooth ? 'best' : false,
      connectgaps: true,
      opacity: showSurface ? 0.55 : 1,
      showscale: !compact,
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
      title: compact ? undefined : { ...plotTitle, font: { ...plotTitle.font, color: fontColor } },
      font: { color: fontColor },
      xaxis: {
        title: compact ? undefined : { text: t('viz.longitude') },
        range: [lonMin, lonMax],
        showgrid: false,
        zeroline: false,
        autorange: false,
        color: fontColor
      },
      yaxis: {
        title: compact ? undefined : { text: t('viz.latitude') },
        range: [latMin, latMax],
        showgrid: false,
        zeroline: false,
        autorange: false,
        color: fontColor
      },
      margin: compact ? { l: 42, r: 8, t: 8, b: 26 } : { ...responsiveMargin, r: 120 },
      paper_bgcolor: paperBg,
      plot_bgcolor: plotBg
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
  }, [currentFrame, animationData, variableCode, unit, datasetLabel, showLocations, showSurface, colorscaleName, reverseColorscale, customZMin, customZMax, showDetailedTooltip, logScale, smooth, interpStep, gridForFrame, compact, i18n.language, fontColor, paperBg, plotBg, titleSize, responsiveMargin]);

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

  // `frames` absent ou vide = rien a lire : on retombe sur l'etat vide plutot
  // que de deriver maxFrame d'un tableau inexistant.
  if (!animationData?.frames?.length) {
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

  /** Export video WebM : rejoue les pas hors ecran + MediaRecorder. */
  const handleExportWebM = async () => {
    const gd = plotRef.current;
    if (!gd || !frames?.length) return;
    showToast(t('export.webmStart'), 'info');
    try {
      const displayFrames = logScale
        ? frames.map(f => f.map(row => row.map(v => (v != null && v > 0) ? Math.log10(v) : null)))
        : frames;
      const blob = await exportAnimationWebM(gd, displayFrames, {
        // Coords natives : les frames sont natives, le graphe peut etre interpole.
        x: animationData.longitudes,
        y: animationData.latitudes,
        timeLabel: (i) => formatTime(i),
      });
      downloadBlob(blob, `mars_animation_${variableCode || 'plot'}.webm`);
      showToast(t('export.webmDone'), 'success');
    } catch {
      showToast(t('export.webmError'), 'error');
    }
  };

  const exportFilename = `mars_animation_${variableCode || 'plot'}`;

  return (
    <Box>
      {!noExportMenu && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
          <ExportMenu
            plotRef={plotRef}
            filename={exportFilename}
            onCSV={handleExportCSV}
            onWebM={webmSupported() ? handleExportWebM : null}
          />
        </Box>
      )}
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <div ref={plotRef} role="img" aria-label={t('viz.aria.animation')} style={{ width: '100%', height: compact ? 300 : 450 }} />
      </Paper>

      {/* Controles : Play/Pause + Vitesse + Slider scrub */}
      <Paper sx={{ p: 1.5, mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            color="primary"
            onClick={() => setIsPlaying(p => !p)}
            aria-label={isPlaying ? t('page.animation.pause') : t('page.animation.play')}
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
              <ToggleButton key={s} value={s} sx={{ px: 1.5, py: 0.6, fontSize: '0.8rem' }}>
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
            // En cellule compacte, les 7 reperes horaires se chevauchent :
            // le champ horaire a gauche suffit.
            marks={compact ? false : scrubMarks}
            sx={sliderSx}
          />
        </Box>
      </Paper>

      {(() => {
        const stepNative = nativeStep(animationData.latitudes);
        const interpApplied = !!(interpStep && stepNative && Math.round(stepNative / interpStep) > 1);
        return interpApplied && (
          <Box sx={{ mt: 0.5, px: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {t('viz.gridCaption', {
                step: Number(stepNative.toFixed(1)),
                nlat: animationData.latitudes.length,
                nlon: animationData.longitudes.length,
                target: interpStep,
              })}
            </Typography>
          </Box>
        );
      })()}

      {!compact && <StatsBar stats={stats} />}
    </Box>
  );
}

export default AnimationPlayer;
