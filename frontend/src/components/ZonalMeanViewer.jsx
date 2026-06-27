import { useRef, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Paper, Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { VARIABLES_MAP } from './VariableSelector';
import { RDBU_VARIABLES } from '../utils/colorscales';
import ExportMenu from './ExportMenu';
import StatsBar from './StatsBar';
import { usePlotlyTheme } from '../hooks/usePlotlyTheme';

/**
 * Affiche un filled contour de moyenne zonale (lat × altitude).
 * X = latitude, Y = altitude en km.
 *
 * @param {Object|null} zonalMeanData - réponse de GET /api/data/zonalmean
 * @param {string|null} variableCode - code variable pour la colorbar
 * @param {string}      datasetLabel - label du dataset pour le titre
 * @param {boolean}     logScale     - afficher l'échelle en log10
 */
function ZonalMeanViewer({ zonalMeanData, variableCode, datasetLabel, colorscaleName, reverseColorscale, customZMin, customZMax, onExportCSV = null, noExportMenu = false, externalPlotRef = null, logScale = false }) {
  const { t, i18n } = useTranslation();
  const { fontColor, paperBg, plotBg, titleSize, margin: responsiveMargin } = usePlotlyTheme();
  const internalPlotRef = useRef(null);
  const plotRef = externalPlotRef ?? internalPlotRef;

  useEffect(() => {
    const el = plotRef.current;
    if (!el || !zonalMeanData) return;

    const { latitudes, altitudes, data } = zonalMeanData;
    const varInfo = VARIABLES_MAP.get(variableCode);
    const variableLabel = varInfo ? t(`variable.${variableCode}`) : variableCode;
    const unit = varInfo?.unit || '';

    const useRdBu = RDBU_VARIABLES.includes(variableCode);
    const finalColorscale = colorscaleName || (useRdBu ? 'RdBu' : 'Viridis');
    const finalReverse = reverseColorscale != null ? reverseColorscale : useRdBu;


    // ── Log scale transform ───────────────────────────────────────────────
    let displayData = data;
    let logColorbarExtra = {};
    let logZMin = null, logZMax = null;
    let hoverTemplate = `${t('viz.hover_lat')}: %{x}°<br>${t('viz.hover_alt')}: %{y:.1f} km<br>${t('viz.hover_value')}: %{z:.6g} ${unit}<extra></extra>`;

    if (logScale) {
      displayData = data.map(row => row.map(v => (v != null && v > 0) ? Math.log10(v) : null));
      const rawStats = zonalMeanData.stats;
      if (rawStats?.min > 0 && rawStats?.max > 0) {
        logZMin = Math.floor(Math.log10(rawStats.min));
        logZMax = Math.ceil(Math.log10(rawStats.max));
        if (logZMin === logZMax) { logZMin -= 1; logZMax += 1; }
        const tickvals = [], ticktext = [];
        for (let e = logZMin; e <= logZMax; e++) { tickvals.push(e); ticktext.push(`10^${e}`); }
        logColorbarExtra = { tickvals, ticktext };
      }
      hoverTemplate = `${t('viz.hover_lat')}: %{x}°<br>${t('viz.hover_alt')}: %{y:.1f} km<br>log\u2081\u2080: %{z:.3f}<br>${t('viz.hover_value')}: %{customdata:.6g} ${unit}<extra></extra>`;
    }

    Plotly.newPlot(el, [{
      type: 'contour',
      x: latitudes,
      y: altitudes,
      z: displayData,
      colorscale: finalColorscale,
      reversescale: finalReverse,
      ...(logScale
        ? (logZMin != null ? { zmin: logZMin, zmax: logZMax } : {})
        : { ...(customZMin != null ? { zmin: customZMin } : {}), ...(customZMax != null ? { zmax: customZMax } : {}) }),
      ...(logScale ? { customdata: data } : {}),
      contours: {
        coloring: 'heatmap',
        showlines: true,
        showlabels: true,
        labelfont: { size: 10, color: fontColor },
      },
      connectgaps: true,
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
    }], {
      title: {
        text: `${t('viz.zonalmean.title')} — ${datasetLabel || ''} — ${variableLabel}`,
        font: { size: titleSize, color: fontColor }
      },
      font: { color: fontColor },
      xaxis: {
        title: { text: t('viz.latitude') },
        color: fontColor,
        showgrid: false,
        zeroline: false
      },
      yaxis: {
        title: { text: t('viz.altitude') },
        color: fontColor,
        showgrid: false,
        zeroline: false,
        autorange: true
      },
      margin: { ...responsiveMargin, r: 120 },
      paper_bgcolor: paperBg,
      plot_bgcolor: plotBg
    }, {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d']
    });

    return () => Plotly.purge(el);
  }, [zonalMeanData, variableCode, datasetLabel, colorscaleName, reverseColorscale, customZMin, customZMax, logScale, i18n.language, fontColor, paperBg, plotBg, titleSize, responsiveMargin]);

  if (!zonalMeanData) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          {t('viz.zonalmean.empty')}
        </Typography>
      </Paper>
    );
  }

  const { stats } = zonalMeanData;
  const exportFilename = `mars_zonalmean_${variableCode || 'plot'}`;

  return (
    <Box>
      {!noExportMenu && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
          <ExportMenu plotRef={plotRef} filename={exportFilename} onCSV={onExportCSV} />
        </Box>
      )}
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <div ref={plotRef} role="img" aria-label={t('viz.aria.zonalmean')} style={{ width: '100%' }} />
      </Paper>
      <StatsBar stats={stats} />
    </Box>
  );
}

export default ZonalMeanViewer;
