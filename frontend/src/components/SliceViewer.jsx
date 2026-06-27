import { useRef, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Paper, Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { formatTime } from './TimeSelector';
import { VARIABLES_MAP } from './VariableSelector';
import { buildLocationTrace } from '../data/marsLocations';
import { computeHeatmapCustomData } from '../utils/heatmapAnalysis';
import { RDBU_VARIABLES } from '../utils/colorscales';
import ExportMenu from './ExportMenu';
import StatsBar from './StatsBar';
import { usePlotlyTheme } from '../hooks/usePlotlyTheme';

/**
 * Affiche une heatmap 2D latitude/longitude d'une variable atmospherique.
 * Utilise Plotly.js directement via useRef (pas de wrapper react-plotly.js
 * car incompatible avec Plotly v3).
 *
 * Le graphique est recree a chaque changement de sliceData ou variableCode
 * via useEffect + Plotly.newPlot(). Le cleanup appelle Plotly.purge() pour
 * liberer la memoire.
 *
 * @param {Object|null} sliceData - reponse de GET /api/data/slice (SliceResponse)
 *   { data: number[][], latitudes: number[], longitudes: number[],
 *     timeIndex, altitudeIndex, variable, stats }
 * @param {string|null} variableCode - code variable pour le titre de la colorbar
 * @param {boolean}     logScale     - afficher l'echelle en log10 (pour variables a faibles valeurs)
 */

function SliceViewer({ sliceData, variableCode, datasetLabel, showLocations = false, showSurface = false, colorscaleName, reverseColorscale, customZMin, customZMax, showDetailedTooltip = false, windData = null, onExportCSV = null, noExportMenu = false, externalPlotRef = null, logScale = false }) {
  const { t, i18n } = useTranslation();
  const { fontColor, paperBg, plotBg, titleSize, margin: responsiveMargin } = usePlotlyTheme();
  const internalPlotRef = useRef(null);
  const plotRef = externalPlotRef ?? internalPlotRef;

  useEffect(() => {
    const el = plotRef.current;
    if (!el || !sliceData) return;

    const { data, latitudes, longitudes, timeIndex, altitudeIndex, altitudeValue } = sliceData;
    const varInfo = VARIABLES_MAP.get(variableCode);
    const unit = varInfo?.unit || '';
    const variableLabel = varInfo ? t(`variable.${variableCode}`) : variableCode;
    const altitudeText = altitudeValue != null
      ? `~${Number(altitudeValue).toFixed(1)} km`
      : `${t('selector.altitude.level')} ${altitudeIndex}`;

    const lonMin = Math.min(...longitudes);
    const lonMax = Math.max(...longitudes);
    const latMin = Math.min(...latitudes);
    const latMax = Math.max(...latitudes);

    const useRdBu = RDBU_VARIABLES.includes(variableCode);
    const finalColorscale = colorscaleName || (useRdBu ? 'RdBu' : 'Viridis');
    const finalReverse = reverseColorscale != null ? reverseColorscale : useRdBu;

    // ── Log scale transform ───────────────────────────────────────────────
    let displayData = data;
    let logColorbarExtra = {};
    let logZMin = null, logZMax = null;
    let logApplied = false;

    if (logScale) {
      const hasPositive = data.some(row => row.some(v => v != null && v > 0));
      if (hasPositive) {
        logApplied = true;
        displayData = data.map(row => row.map(v => (v != null && v > 0) ? Math.log10(v) : null));
        const rawStats = sliceData.stats;
        if (rawStats?.min > 0 && rawStats?.max > 0) {
          logZMin = Math.floor(Math.log10(rawStats.min));
          logZMax = Math.ceil(Math.log10(rawStats.max));
          if (logZMin === logZMax) { logZMin -= 1; logZMax += 1; }
          const tickvals = [], ticktext = [];
          for (let e = logZMin; e <= logZMax; e++) { tickvals.push(e); ticktext.push(`10^${e}`); }
          logColorbarExtra = { tickvals, ticktext };
        }
      }
    }

    // ── Customdata + hover template ───────────────────────────────────────
    const traceCustomdata = logApplied
      ? data   // valeurs originales pour hover
      : (showDetailedTooltip ? computeHeatmapCustomData(data, latitudes, longitudes) : undefined);

    const hoverTemplate = logApplied
      ? `${t('viz.hover_lon')}: %{x}\u00b0<br>${t('viz.hover_lat')}: %{y}\u00b0<br>${t('viz.hover_value')}: %{customdata:.6g} ${unit}<br>log\u2081\u2080 = %{z:.3f}<extra></extra>`
      : showDetailedTooltip
        ? `${t('viz.hover_lon')}: %{x}\u00b0  ${t('viz.hover_lat')}: %{y}\u00b0<br><b>%{z:.6g} ${unit}</b><br>\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500<br>` +
          `${t('viz.hover_zonal_anom')}: %{customdata[0]:+.6g}<br>` +
          `\u2202/\u2202lat: %{customdata[1]:.2e} /\u00b0<br>` +
          `\u2202/\u2202lon: %{customdata[2]:.2e} /\u00b0<br>` +
          `${t('viz.hover_percentile')}: %{customdata[3]:.0f}%<br>` +
          `${t('viz.hover_poi')}: %{customdata[4]} (%{customdata[5]} km)<extra></extra>`
        : `${t('viz.hover_lon')}: %{x}\u00b0<br>${t('viz.hover_lat')}: %{y}\u00b0<br>${t('viz.hover_value')}: %{z:.6g} ${unit}<extra></extra>`;

    const traces = [{
      type: 'heatmap',
      x: longitudes,
      y: latitudes,
      z: displayData,
      colorscale: finalColorscale,
      reversescale: finalReverse,
      ...(logApplied
        ? (logZMin != null ? { zmin: logZMin, zmax: logZMax } : {})
        : { ...(customZMin != null ? { zmin: customZMin } : {}), ...(customZMax != null ? { zmax: customZMax } : {}) }),
      zsmooth: 'best',
      connectgaps: true,
      opacity: showSurface ? 0.55 : 1,
      ...(traceCustomdata ? { customdata: traceCustomdata } : {}),
      colorbar: {
        title: {
          text: logApplied ? `log\u2081\u2080(${variableLabel})` : `${variableLabel} (${unit})`,
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

    if (showLocations) traces.push(buildLocationTrace(longitudes));

    // ---- Vecteurs de vent (quiver) ----
    if (windData && windData.lats && windData.lats.length > 0) {
      const { lats: wLats, lons: wLons, u, v } = windData;
      let maxSpeed = 0;
      for (let i = 0; i < u.length; i++) {
        const spd = Math.hypot(u[i], v[i]);
        if (spd > maxSpeed) maxSpeed = spd;
      }
      if (maxSpeed === 0) maxSpeed = 1;
      const scale = 6.0; // longueur max en degrés (vecteur le plus rapide = 6°)

      const xLines = [], yLines = [];

      for (let i = 0; i < wLats.length; i++) {
        const spd = Math.hypot(u[i], v[i]);
        if (spd < 0.5) continue; // ignorer les vents quasi-nuls

        const dx = (u[i] / maxSpeed) * scale;
        const dy = (v[i] / maxSpeed) * scale;
        const tx = wLons[i] + dx;
        const ty = wLats[i] + dy;

        // Corps de la flèche
        xLines.push(wLons[i], tx, null);
        yLines.push(wLats[i], ty, null);

        // Tête de flèche (deux segments)
        const angle = Math.atan2(dy, dx);
        const hlen = Math.hypot(dx, dy) * 0.35;
        const ha = Math.PI / 6;
        xLines.push(tx, tx - hlen * Math.cos(angle - ha), null,
                    tx, tx - hlen * Math.cos(angle + ha), null);
        yLines.push(ty, ty - hlen * Math.sin(angle - ha), null,
                    ty, ty - hlen * Math.sin(angle + ha), null);
      }

      traces.push({
        type: 'scatter',
        x: xLines,
        y: yLines,
        mode: 'lines',
        line: { color: fontColor, width: 1.2 },
        // 'skip' (et non 'none') pour laisser le survol atteindre la heatmap dessous.
        hoverinfo: 'skip',
        showlegend: false,
      });
    }

    const dataIs0to360 = longitudes.some(l => l > 180);
    const layout = {
      title: { text: `${datasetLabel || ''} — ${variableLabel} — ${formatTime(timeIndex)} — ${altitudeText}`, font: { size: titleSize, color: fontColor } },
      font: { color: fontColor },
      xaxis: {
        title: { text: t('viz.longitude') },
        range: [lonMin, lonMax],
        showgrid: false,
        zeroline: false,
        autorange: false,
        color: fontColor
      },
      yaxis: {
        title: { text: t('viz.latitude') },
        range: [latMin, latMax],
        showgrid: false,
        zeroline: false,
        autorange: false,
        color: fontColor
      },
      margin: { ...responsiveMargin, r: 120 },
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

    Plotly.newPlot(el, traces, layout, {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d']
    });

    return () => Plotly.purge(el);
  }, [sliceData, variableCode, datasetLabel, showLocations, showSurface, colorscaleName, reverseColorscale, customZMin, customZMax, showDetailedTooltip, windData, logScale, i18n.language, fontColor, paperBg, plotBg, titleSize, responsiveMargin]);

  if (!sliceData) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          {t('viz.slice.empty')}
        </Typography>
      </Paper>
    );
  }

  const { stats } = sliceData;
  const exportFilename = `mars_slice_${variableCode || 'plot'}`;

  return (
    <Box>
      {!noExportMenu && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
          <ExportMenu plotRef={plotRef} filename={exportFilename} onCSV={onExportCSV} />
        </Box>
      )}
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <div ref={plotRef} role="img" aria-label={t('viz.aria.slice')} style={{ width: '100%' }} />
      </Paper>
      <StatsBar stats={stats} />
    </Box>
  );
}

export default SliceViewer;
