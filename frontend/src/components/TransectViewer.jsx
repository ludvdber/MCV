import { useRef, useEffect } from 'react';
import Plotly, { renderPlot } from '../plotlyBundle';
import { Paper, Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { VARIABLES_MAP } from './VariableSelector';
import { RDBU_VARIABLES } from '../utils/colorscales';
import ExportMenu from './ExportMenu';
import StatsBar from './StatsBar';
import { usePlotlyTheme } from '../hooks/usePlotlyTheme';

/** Formate une coordonnee "12.3°N 45.0°W" pour le titre du transect.
 *  Les points cardinaux sont localises (N/S/E/O en FR, N/S/E/W en EN…). */
const fmtCoord = (lat, lon, t) =>
  `${Math.abs(lat).toFixed(1)}°${t(lat >= 0 ? 'viz.compass.n' : 'viz.compass.s')} ${Math.abs(lon).toFixed(1)}°${t(lon >= 0 ? 'viz.compass.e' : 'viz.compass.w')}`;

/**
 * Affiche un heatmap Plotly d'un transect grand-cercle.
 * X = distance cumulee le long de la geodesique (km), Y = altitude en km.
 *
 * @param {Object|null} transectData - reponse de GET /api/data/transect
 *   { dataset, variable, timeIndex, lat1, lon1, lat2, lon2,
 *     altitudes[], distances[], lats[], lons[], data[][], stats }
 * @param {string|null} variableCode - code variable pour la colorbar
 * @param {boolean}     logScale     - afficher l'echelle en log10
 */
function TransectViewer({ transectData, variableCode, datasetLabel, colorscaleName, reverseColorscale, customZMin, customZMax, onExportCSV = null, noExportMenu = false, compact = false, externalPlotRef = null, logScale = false, smooth = true }) {
  const { t, i18n } = useTranslation();
  const { fontColor, paperBg, plotBg, titleSize, margin: responsiveMargin } = usePlotlyTheme();
  const internalPlotRef = useRef(null);
  const plotRef = externalPlotRef ?? internalPlotRef;

  // Purge Plotly uniquement au demontage : les mises a jour passent par
  // Plotly.react (pas de destruction/recreation du graphe a chaque prop).
  useEffect(() => {
    const el = plotRef.current;
    return () => { if (el) Plotly.purge(el); };
  }, [plotRef]);

  useEffect(() => {
    const el = plotRef.current;
    if (!el || !transectData) return;

    const { altitudes, distances, lats, lons, data, lat1, lon1, lat2, lon2 } = transectData;
    const varInfo = VARIABLES_MAP.get(variableCode);
    const variableLabel = varInfo ? t(`variable.${variableCode}`) : variableCode;
    const unit = varInfo?.unit || '';

    const useRdBu = RDBU_VARIABLES.includes(variableCode);
    const finalColorscale = colorscaleName || (useRdBu ? 'RdBu' : 'Viridis');
    const finalReverse = reverseColorscale ?? false;

    // (lat, lon) du point de trajet en customdata pour le survol : la position
    // reelle sur la planete n'est pas lisible depuis l'axe des distances seul.
    const pathCustomdata = altitudes.map(() => distances.map((_, p) => [lats[p], lons[p]]));

    // ── Log scale transform ───────────────────────────────────────────────
    let displayData = data;
    let logColorbarExtra = {};
    let logZMin = null, logZMax = null;
    let hoverTemplate = `${t('viz.hover_distance')}: %{x:.0f} km (%{customdata[0]:.1f}°, %{customdata[1]:.1f}°)<br>${t('viz.hover_alt')}: %{y:.1f} km<br>${t('viz.hover_value')}: %{z:.6g} ${unit}<extra></extra>`;

    if (logScale) {
      displayData = data.map(row => row.map(v => (v != null && v > 0) ? Math.log10(v) : null));
      const rawStats = transectData.stats;
      if (rawStats?.min > 0 && rawStats?.max > 0) {
        logZMin = Math.floor(Math.log10(rawStats.min));
        logZMax = Math.ceil(Math.log10(rawStats.max));
        if (logZMin === logZMax) { logZMin -= 1; logZMax += 1; }
        const tickvals = [], ticktext = [];
        for (let e = logZMin; e <= logZMax; e++) { tickvals.push(e); ticktext.push(`10^${e}`); }
        logColorbarExtra = { tickvals, ticktext };
      }
      hoverTemplate = `${t('viz.hover_distance')}: %{x:.0f} km (%{customdata[0]:.1f}°, %{customdata[1]:.1f}°)<br>${t('viz.hover_alt')}: %{y:.1f} km<br>log₁₀: %{z:.3f}<extra></extra>`;
    }

    renderPlot(el, [{
      type: 'heatmap',
      x: distances,
      y: altitudes,
      z: displayData,
      colorscale: finalColorscale,
      reversescale: finalReverse,
      ...(logScale
        ? (logZMin != null ? { zmin: logZMin, zmax: logZMax } : {})
        : { ...(customZMin != null ? { zmin: customZMin } : {}), ...(customZMax != null ? { zmax: customZMax } : {}) }),
      customdata: pathCustomdata,
      zsmooth: smooth ? 'best' : false,
      connectgaps: true,
      showscale: !compact,
      colorbar: {
        title: {
          text: logScale ? `log₁₀(${variableLabel})` : `${variableLabel} (${unit})`,
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
    }], {
      title: compact ? undefined : {
        text: `${datasetLabel || ''} — ${variableLabel} — ${fmtCoord(lat1, lon1, t)} → ${fmtCoord(lat2, lon2, t)}`,
        font: { size: titleSize, color: fontColor }
      },
      font: { color: fontColor },
      xaxis: {
        title: compact ? undefined : { text: t('viz.distance') },
        color: fontColor,
        showgrid: false,
        zeroline: false
      },
      yaxis: {
        title: compact ? undefined : { text: t('viz.altitude') },
        color: fontColor,
        showgrid: false,
        zeroline: false,
        autorange: true
      },
      margin: compact ? { l: 42, r: 8, t: 8, b: 26 } : { ...responsiveMargin, r: 120 },
      paper_bgcolor: paperBg,
      plot_bgcolor: plotBg
    }, {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d']
    });
  }, [transectData, variableCode, datasetLabel, colorscaleName, reverseColorscale, customZMin, customZMax, logScale, smooth, compact, i18n.language, fontColor, paperBg, plotBg, titleSize, responsiveMargin]);

  if (!transectData) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          {t('viz.transect.empty')}
        </Typography>
      </Paper>
    );
  }

  const { stats } = transectData;
  const exportFilename = `mars_transect_${variableCode || 'plot'}`;

  return (
    <Box>
      {!noExportMenu && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
          <ExportMenu plotRef={plotRef} filename={exportFilename} onCSV={onExportCSV} />
        </Box>
      )}
      <Paper elevation={compact ? 0 : 2} sx={{ borderRadius: 2, overflow: 'hidden', ...(compact ? { bgcolor: 'transparent', backgroundImage: 'none' } : {}) }}>
        <div ref={plotRef} role="img" aria-label={t('viz.aria.transect')} style={{ width: '100%', height: compact ? 300 : 450 }} />
      </Paper>
      {!compact && <StatsBar stats={stats} />}
    </Box>
  );
}

export default TransectViewer;
