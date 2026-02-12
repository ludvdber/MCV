import { useState, useEffect, useRef, useCallback } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Paper, Box, Slider, IconButton, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { PlayArrow, Pause } from '@mui/icons-material';
import { formatTime } from './TimeSelector';
import { VARIABLES } from './VariableSelector';

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
 */
function AnimationPlayer({ animationData, variableCode, datasetLabel }) {
  const plotRef = useRef(null);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  /** Unite physique de la variable (ex: 'K', 'Pa', 'm/s') */
  const unit = VARIABLES.find(v => v.code === variableCode)?.unit || '';

  /** Label lisible de la variable (ex: 'Temperature' au lieu de 'TT') */
  const variableLabel = VARIABLES.find(v => v.code === variableCode)?.label || variableCode;

  /** Formate l'altitude : valeur réelle en km si disponible, sinon index */
  const altitudeText = animationData?.altitudeValue != null
    ? `~${Number(animationData.altitudeValue).toFixed(1)} km`
    : animationData?.altitudeIndex != null ? `Niveau ${animationData.altitudeIndex}` : '';

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

  /** Creation initiale du graphique quand animationData change */
  useEffect(() => {
    if (!plotRef.current || !animationData) return;

    setCurrentFrame(0);
    setIsPlaying(false);
    stopAnimation();

    const { frames, latitudes, longitudes } = animationData;

    const lonMin = Math.min(...longitudes);
    const lonMax = Math.max(...longitudes);
    const latMin = Math.min(...latitudes);
    const latMax = Math.max(...latitudes);

    Plotly.newPlot(plotRef.current, [{
      type: 'heatmap',
      x: longitudes,
      y: latitudes,
      z: frames[0],
      colorscale: 'RdBu',
      reversescale: true,
      zsmooth: 'best',
      connectgaps: true,
      colorbar: {
        title: { text: `${variableLabel} (${unit})`, side: 'right' },
        thickness: 15,
        len: 0.9,
        outlinewidth: 0,
        tickfont: { size: 11 }
      },
      hovertemplate: 'Lon: %{x}°<br>Lat: %{y}°<br>Valeur: %{z:.2f} ' + unit + '<extra></extra>'
    }], {
      title: plotTitle,
      xaxis: {
        title: 'Longitude (°)',
        range: [lonMin, lonMax],
        showgrid: false,
        zeroline: false,
        autorange: false
      },
      yaxis: {
        title: 'Latitude (°)',
        range: [latMin, latMax],
        showgrid: false,
        zeroline: false,
        autorange: false
      },
      margin: { t: 80, r: 120, b: 50, l: 70 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)'
    }, {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d']
    });

    return () => { if (plotRef.current) Plotly.purge(plotRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationData, variableCode, unit, stopAnimation]);

  /** Mise a jour du graphique quand la frame change (Plotly.react = update performant) */
  useEffect(() => {
    if (!plotRef.current || !animationData) return;

    const { frames, latitudes, longitudes } = animationData;

    const lonMin = Math.min(...longitudes);
    const lonMax = Math.max(...longitudes);
    const latMin = Math.min(...latitudes);
    const latMax = Math.max(...latitudes);

    Plotly.react(plotRef.current, [{
      type: 'heatmap',
      x: longitudes,
      y: latitudes,
      z: frames[currentFrame],
      colorscale: 'RdBu',
      reversescale: true,
      zsmooth: 'best',
      connectgaps: true,
      colorbar: {
        title: { text: `${variableLabel} (${unit})`, side: 'right' },
        thickness: 15,
        len: 0.9,
        outlinewidth: 0,
        tickfont: { size: 11 }
      },
      hovertemplate: 'Lon: %{x}°<br>Lat: %{y}°<br>Valeur: %{z:.2f} ' + unit + '<extra></extra>'
    }], {
      title: plotTitle,
      xaxis: {
        title: 'Longitude (°)',
        range: [lonMin, lonMax],
        showgrid: false,
        zeroline: false,
        autorange: false
      },
      yaxis: {
        title: 'Latitude (°)',
        range: [latMin, latMax],
        showgrid: false,
        zeroline: false,
        autorange: false
      },
      margin: { t: 80, r: 120, b: 50, l: 70 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)'
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFrame, animationData, variableCode, unit]);

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
        setCurrentFrame(f => (f + 1) % 48);
        lastTimeRef.current = timestamp;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return stopAnimation;
  }, [isPlaying, speed, stopAnimation]);

  if (!animationData) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          Selectionnez un dataset, une variable et un niveau d'altitude,
          puis cliquez sur Charger l'animation.
        </Typography>
      </Paper>
    );
  }

  const { stats } = animationData;

  return (
    <Box>
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <div ref={plotRef} style={{ width: '100%' }} />
      </Paper>

      {/* Controles : Play/Pause + Vitesse + Slider scrub */}
      <Paper sx={{ p: 1.5, mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            color="primary"
            onClick={() => setIsPlaying(p => !p)}
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
            max={47}
            step={1}
            value={currentFrame}
            onChange={(_, v) => { setIsPlaying(false); setCurrentFrame(v); }}
            marks={scrubMarks}
            sx={{
              mx: 2, flexGrow: 1,
              '& .MuiSlider-thumb': {
                transition: isPlaying ? `left ${Math.round(frameDuration)}ms linear` : 'none'
              }
            }}
          />
        </Box>
      </Paper>

      {/* Stats globales (sur l'ensemble des frames) */}
      {stats && (
        <Paper sx={{ p: 1.5, mt: 1, display: 'flex', justifyContent: 'center', gap: 3 }}>
          <Typography variant="body2">Min : {stats.min?.toFixed(2) ?? '-'}</Typography>
          <Typography variant="body2">Max : {stats.max?.toFixed(2) ?? '-'}</Typography>
          <Typography variant="body2">Moyenne : {stats.mean?.toFixed(2) ?? '-'}</Typography>
          <Typography variant="body2">Ecart-type : {stats.stddev?.toFixed(2) ?? '-'}</Typography>
        </Paper>
      )}
    </Box>
  );
}

export default AnimationPlayer;
