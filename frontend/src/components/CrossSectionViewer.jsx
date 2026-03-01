import { useRef, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Paper, Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { VARIABLES_MAP } from './VariableSelector';
import { RDBU_VARIABLES } from '../utils/colorscales';
import ExportMenu from './ExportMenu';
import StatsBar from './StatsBar';

/**
 * Affiche un heatmap Plotly d'une coupe verticale (meridionale ou zonale).
 * X = latitude ou longitude, Y = altitude en km (surface en bas).
 *
 * @param {Object|null} crossSectionData - reponse de GET /api/data/crosssection
 *   { dataset, variable, timeIndex, type, fixedCoordinate, altitudes[], horizontalCoords[], data[][], stats }
 * @param {string|null} variableCode - code variable pour la colorbar
 * @param {boolean}     logScale     - afficher l'echelle en log10 (pour variables a faibles valeurs)
 */
function CrossSectionViewer({ crossSectionData, variableCode, datasetLabel, colorscaleName, reverseColorscale, customZMin, customZMax, onExportCSV = null, noExportMenu = false, externalPlotRef = null, logScale = false }) {
  const { t, i18n } = useTranslation();
  const internalPlotRef = useRef(null);
  const plotRef = externalPlotRef ?? internalPlotRef;

  useEffect(() => {
    const el = plotRef.current;
    if (!el || !crossSectionData) return;

    const { type, fixedCoordinate, altitudes, horizontalCoords, data } = crossSectionData;
    const varInfo = VARIABLES_MAP.get(variableCode);
    const variableLabel = varInfo ? t(`variable.${variableCode}`) : variableCode;
    const unit = varInfo?.unit || '';

    const useRdBu = RDBU_VARIABLES.includes(variableCode);
    const finalColorscale = colorscaleName || (useRdBu ? 'RdBu' : 'Viridis');
    const finalReverse = reverseColorscale != null ? reverseColorscale : useRdBu;

    const isMeridional = type === 'meridional';
    const xLabel = isMeridional ? t('viz.latitude') : t('viz.longitude');
    const fixedLabel = isMeridional
      ? `Lon ${fixedCoordinate}°`
      : `Lat ${fixedCoordinate}°`;

    const fontColor = 'rgba(255,255,255,0.85)';

    // ── Log scale transform ───────────────────────────────────────────────
    let displayData = data;
    let logColorbarExtra = {};
    let logZMin = null, logZMax = null;
    let hoverTemplate = `${isMeridional ? t('viz.hover_lat') : t('viz.hover_lon')}: %{x}°<br>${t('viz.hover_alt')}: %{y:.1f} km<br>${t('viz.hover_value')}: %{z:.6g} ${unit}<extra></extra>`;

    if (logScale) {
      displayData = data.map(row => row.map(v => (v != null && v > 0) ? Math.log10(v) : null));
      const rawStats = crossSectionData.stats;
      if (rawStats?.min > 0 && rawStats?.max > 0) {
        logZMin = Math.floor(Math.log10(rawStats.min));
        logZMax = Math.ceil(Math.log10(rawStats.max));
        if (logZMin === logZMax) { logZMin -= 1; logZMax += 1; }
        const tickvals = [], ticktext = [];
        for (let e = logZMin; e <= logZMax; e++) { tickvals.push(e); ticktext.push(`10^${e}`); }
        logColorbarExtra = { tickvals, ticktext };
      }
      hoverTemplate = `${isMeridional ? t('viz.hover_lat') : t('viz.hover_lon')}: %{x}°<br>${t('viz.hover_alt')}: %{y:.1f} km<br>log\u2081\u2080: %{z:.3f}<br>${t('viz.hover_value')}: %{customdata:.6g} ${unit}<extra></extra>`;
    }

    Plotly.newPlot(el, [{
      type: 'heatmap',
      x: horizontalCoords,
      y: altitudes,
      z: displayData,
      colorscale: finalColorscale,
      reversescale: finalReverse,
      ...(logScale
        ? (logZMin != null ? { zmin: logZMin, zmax: logZMax } : {})
        : { ...(customZMin != null ? { zmin: customZMin } : {}), ...(customZMax != null ? { zmax: customZMax } : {}) }),
      ...(logScale ? { customdata: data } : {}),
      zsmooth: 'best',
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
        text: `${datasetLabel || ''} — ${variableLabel} — ${fixedLabel}`,
        font: { size: 16, color: fontColor }
      },
      font: { color: fontColor },
      xaxis: {
        title: xLabel,
        color: fontColor,
        showgrid: false,
        zeroline: false
      },
      yaxis: {
        title: t('viz.altitude'),
        color: fontColor,
        showgrid: false,
        zeroline: false,
        autorange: true
      },
      margin: { t: 80, r: 120, b: 50, l: 70 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)'
    }, {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d']
    });

    return () => Plotly.purge(el);
  }, [crossSectionData, variableCode, datasetLabel, colorscaleName, reverseColorscale, customZMin, customZMax, logScale, i18n.language]);

  if (!crossSectionData) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          {t('viz.crosssection.empty')}
        </Typography>
      </Paper>
    );
  }

  const { stats } = crossSectionData;
  const exportFilename = `mars_crosssection_${variableCode || 'plot'}`;

  return (
    <Box>
      {!noExportMenu && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
          <ExportMenu plotRef={plotRef} filename={exportFilename} onCSV={onExportCSV} />
        </Box>
      )}
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <div ref={plotRef} style={{ width: '100%' }} />
      </Paper>
      <StatsBar stats={stats} />
    </Box>
  );
}

export default CrossSectionViewer;
