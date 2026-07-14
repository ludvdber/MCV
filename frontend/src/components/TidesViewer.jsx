/**
 * Viewer des marees thermiques atmospheriques.
 *
 * Affiche la decomposition harmonique du cycle diurne calculee par
 * /api/data/tides : deux cartes cote a cote, l'AMPLITUDE du mode choisi
 * (diurne 24 h ou semi-diurne 12 h) et sa PHASE exprimee en heure locale du
 * maximum. La phase est une grandeur CYCLIQUE : elle utilise une palette
 * repliee (Vik miroir, facon vikO de Crameri) ou 0 h et 24 h partagent la
 * meme couleur, sans discontinuite visuelle artificielle.
 *
 * @param {Object} tidesData — TidesResponse
 */
import { useRef, useEffect, useState } from 'react';
import Plotly, { renderPlot } from '../plotlyBundle';
import { Paper, Typography, Box, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { VARIABLES_MAP } from './VariableSelector';
import { VIK } from '../utils/colorscales';
import StatsBar from './StatsBar';
import { usePlotlyTheme } from '../hooks/usePlotlyTheme';

/** Palette cyclique : Vik replie sur lui-meme (debut = fin, sans couture). */
const CYCLIC = [
  ...VIK.map(([p, c]) => [p / 2, c]),
  ...[...VIK].reverse().map(([p, c]) => [Math.min(1, 1 - p / 2), c]),
];

function TidesViewer({ tidesData, variableCode, datasetLabel, externalPlotRef = null, noExportMenu = false, compact = false }) {
  const { t, i18n } = useTranslation();
  const { fontColor, paperBg, plotBg, titleSize } = usePlotlyTheme();
  const internalAmpRef = useRef(null);
  const ampRef = externalPlotRef ?? internalAmpRef;
  const phaseRef = useRef(null);
  const [mode, setMode] = useState('diurnal');
  void noExportMenu; // l'export est gere par la barre d'outils de l'Explorer

  // Purge uniquement au demontage (pattern renderPlot/Plotly.react du projet).
  useEffect(() => {
    const a = ampRef.current, p = phaseRef.current;
    return () => { if (a) Plotly.purge(a); if (p) Plotly.purge(p); };
  }, [ampRef]);

  useEffect(() => {
    const ampEl = ampRef.current, phaseEl = phaseRef.current;
    if (!ampEl || !phaseEl || !tidesData) return;

    const { latitudes, longitudes, altitudeValue } = tidesData;
    const isDiurnal = mode === 'diurnal';
    const amp = isDiurnal ? tidesData.amplitudeDiurnal : tidesData.amplitudeSemidiurnal;
    const phase = isDiurnal ? tidesData.phaseDiurnal : tidesData.phaseSemidiurnal;
    const period = isDiurnal ? 24 : 12;

    const varInfo = VARIABLES_MAP.get(variableCode);
    const unit = varInfo?.unit || '';
    const varLabel = varInfo ? t(`variable.${variableCode}`) : variableCode;
    const modeLabel = isDiurnal ? t('viz.tides.mode1') : t('viz.tides.mode2');
    const altText = altitudeValue != null ? `~${Number(altitudeValue).toFixed(1)} km` : '';

    const axes = {
      xaxis: { title: compact ? undefined : { text: t('viz.longitude') }, range: [Math.min(...longitudes), Math.max(...longitudes)], autorange: false, showgrid: false, zeroline: false, color: fontColor },
      yaxis: { title: compact ? undefined : { text: t('viz.latitude') }, range: [Math.min(...latitudes), Math.max(...latitudes)], autorange: false, showgrid: false, zeroline: false, color: fontColor },
      font: { color: fontColor },
      margin: compact ? { t: 26, r: 8, b: 24, l: 38 } : { t: 50, r: 110, b: 50, l: 60 },
      paper_bgcolor: paperBg,
      plot_bgcolor: plotBg,
    };
    const config = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] };

    renderPlot(ampEl, [{
      type: 'heatmap',
      x: longitudes, y: latitudes, z: amp,
      colorscale: 'Viridis',
      zsmooth: 'best',
      showscale: !compact,
      colorbar: {
        title: { text: `${t('viz.tides.amplitude')} (${unit})`, side: 'right', font: { color: fontColor } },
        thickness: 15, len: 0.9, outlinewidth: 0, tickfont: { size: 11, color: fontColor },
      },
      hovertemplate: `${t('viz.hover_lon')}: %{x}°<br>${t('viz.hover_lat')}: %{y}°<br>A: %{z:.3g} ${unit}<extra></extra>`,
    }], {
      ...axes,
      // En compact, un titre court reste indispensable pour distinguer les
      // deux cartes (amplitude vs phase) une fois les colorbars masquees.
      title: compact
        ? { text: t('viz.tides.amplitude'), font: { size: 11, color: fontColor } }
        : { text: `${t('viz.tides.amplitude')} · ${modeLabel} — ${varLabel} — ${altText}`, font: { size: titleSize, color: fontColor } },
    }, config);

    renderPlot(phaseEl, [{
      type: 'heatmap',
      x: longitudes, y: latitudes, z: phase,
      colorscale: CYCLIC,
      zmin: 0, zmax: period,
      zsmooth: 'best',
      showscale: !compact,
      colorbar: {
        title: { text: t('viz.tides.phase'), side: 'right', font: { color: fontColor } },
        thickness: 15, len: 0.9, outlinewidth: 0, tickfont: { size: 11, color: fontColor },
        tickvals: isDiurnal ? [0, 6, 12, 18, 24] : [0, 3, 6, 9, 12],
        ticksuffix: ' h',
      },
      hovertemplate: `${t('viz.hover_lon')}: %{x}°<br>${t('viz.hover_lat')}: %{y}°<br>${t('viz.tides.phase')}: %{z:.1f} h<extra></extra>`,
    }], {
      ...axes,
      title: compact
        ? { text: t('viz.tides.phase'), font: { size: 11, color: fontColor } }
        : { text: `${t('viz.tides.phase')} · ${modeLabel} — ${datasetLabel || ''}`, font: { size: titleSize, color: fontColor } },
    }, config);
  }, [tidesData, mode, variableCode, datasetLabel, compact, i18n.language, fontColor, paperBg, plotBg, titleSize, t, ampRef]);

  if (!tidesData) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">{t('viz.tides.empty')}</Typography>
      </Paper>
    );
  }

  const stats = mode === 'diurnal' ? tidesData.statsDiurnal : tidesData.statsSemidiurnal;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_, v) => { if (v) setMode(v); }}
          aria-label={t('viz.tides.modeLabel')}
        >
          <ToggleButton value="diurnal">{t('viz.tides.mode1')}</ToggleButton>
          <ToggleButton value="semidiurnal">{t('viz.tides.mode2')}</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: compact ? '1fr 1fr' : { xs: '1fr', lg: '1fr 1fr' } }}>
        <Paper elevation={compact ? 0 : 2} sx={{ borderRadius: 2, overflow: 'hidden', ...(compact ? { bgcolor: 'transparent', backgroundImage: 'none' } : {}) }}>
          <div ref={ampRef} role="img" aria-label={t('viz.tides.amplitude')} style={{ width: '100%', height: compact ? 260 : 420 }} />
        </Paper>
        <Paper elevation={compact ? 0 : 2} sx={{ borderRadius: 2, overflow: 'hidden', ...(compact ? { bgcolor: 'transparent', backgroundImage: 'none' } : {}) }}>
          <div ref={phaseRef} role="img" aria-label={t('viz.tides.phase')} style={{ width: '100%', height: compact ? 260 : 420 }} />
        </Paper>
      </Box>

      {!compact && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, px: 0.5 }}>
          {t('viz.tides.caption')}
        </Typography>
      )}

      {!compact && <StatsBar stats={stats} />}
    </Box>
  );
}

export default TidesViewer;
