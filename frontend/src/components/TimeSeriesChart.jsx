import { useRef, useEffect } from 'react';
import Plotly, { renderPlot } from '../plotlyBundle';
import { Paper, Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { VARIABLES_MAP } from './VariableSelector';
import { altitudeLabel } from '../utils/variableUtils';
import ExportMenu from './ExportMenu';
import StatsBar from './StatsBar';
import { usePlotlyTheme } from '../hooks/usePlotlyTheme';
import { SERIES_COLORS } from '../utils/seriesColors';
import { MAX_TIMESTEPS } from '../constants';

const COLORS = SERIES_COLORS;

/** Axe X : heure locale solaire martienne en hh:mm (00:00 a 23:30, 48 valeurs).
 *  Convention des fichiers : pas k = k*0,5 h (coordonnee `time`, k=0 = minuit). */
const HOURS = Array.from({ length: MAX_TIMESTEPS }, (_, i) => {
  const h = Math.floor(i * 0.5);
  const m = (i * 0.5 % 1) * 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

/**
 * Unified time series chart — renders 1 to N series on a single Plotly chart.
 *
 * @param {Array|Object|null} series - single TimeSeriesResponse or array of them (1-4)
 * @param {string|null} variableCode - code variable pour le titre de l'axe Y
 * @param {string} datasetLabel - dataset display label
 */
function TimeSeriesChart({ series, timeSeriesData, variableCode, datasetLabel, onExportCSV = null, noExportMenu = false, compact = false, externalPlotRef = null }) {
  const { t, i18n } = useTranslation();
  const { fontColor, gridColor, paperBg, plotBg, titleSize, margin: responsiveMargin, accentColor, subtleTextColor } = usePlotlyTheme();
  const internalPlotRef = useRef(null);
  const plotRef = externalPlotRef ?? internalPlotRef;

  // Purge Plotly uniquement au demontage : les mises a jour passent par
  // Plotly.react (pas de destruction/recreation du graphe a chaque prop).
  useEffect(() => {
    const el = plotRef.current;
    return () => { if (el) Plotly.purge(el); };
  }, [plotRef]);

  // Normalize to array — supports both new `series` prop and legacy `timeSeriesData` prop
  const input = series ?? timeSeriesData;
  const seriesArray = Array.isArray(input) ? input : (input ? [input] : null);

  useEffect(() => {
    const el = plotRef.current;
    if (!el || !seriesArray || seriesArray.length === 0) return;

    const varInfo = VARIABLES_MAP.get(variableCode);
    const variableLabel = varInfo ? t(`variable.${variableCode}`) : variableCode;
    const unit = varInfo?.unit || '';

    const single = seriesArray.length === 1;
    const first = seriesArray[0];
    const altitudeText = altitudeLabel(
      variableCode, first.altitudeValue, first.altitudeIndex, t);

    // Le point AFFICHE est celui d'ou vient la mesure, pas celui demande. La
    // grille fait 4 degres : une demande a 38 S est servie par le noeud a 40 S,
    // et l'etiquette annoncait le point demande. `actualLat` peut manquer sur
    // une reponse mise en cache avant que l'API ne la porte, d'ou le repli.
    const pointLu = (s) => `(${s.actualLat ?? s.latitude}°, ${s.actualLon ?? s.longitude}°)`;

    const traces = seriesArray.map((s, i) => ({
      x: HOURS,
      y: s.values,
      mode: 'lines+markers',
      line: { color: single ? accentColor : COLORS[i % COLORS.length], width: 2.5 },
      marker: { color: single ? accentColor : COLORS[i % COLORS.length], size: 4 },
      name: pointLu(s),
      showlegend: !single,
      hovertemplate: '%{x} : %{y:.6g} ' + unit +
        '<extra>' + (single ? '' : pointLu(s)) + '</extra>',
    }));

    // 48 étiquettes hh:mm en axe 'category' se chevauchent (Plotly les pivote et
    // les tronque) : n'afficher qu'un tick toutes les 3h (6h en compact), à plat.
    const tickEvery = compact ? 12 : 6;
    const tickVals = HOURS.filter((_, i) => (i + 1) % tickEvery === 0);

    const titleText = single
      ? `${datasetLabel || ''} — ${variableLabel} — Lat ${first.actualLat ?? first.latitude}°, Lon ${first.actualLon ?? first.longitude}° — ${altitudeText}`
      : `${datasetLabel || ''} — ${variableLabel} — ${altitudeText}`;

    renderPlot(el, traces, {
      title: compact ? undefined : { text: titleText, font: { size: titleSize, color: fontColor } },
      font: { color: fontColor },
      xaxis: {
        title: compact ? undefined : { text: t('viz.localTime') },
        type: 'category',
        tickmode: 'array',
        tickvals: tickVals,
        tickangle: 0,
        color: fontColor,
        gridcolor: gridColor,
        zeroline: false,
      },
      yaxis: {
        title: compact ? undefined : { text: `${variableLabel} (${unit})` },
        color: fontColor,
        gridcolor: gridColor,
        zeroline: false,
      },
      legend: (single || compact) ? undefined : {
        font: { color: fontColor, size: 12 },
        bgcolor: paperBg,
      },
      annotations: compact ? [] : [{
        text: t('viz.martian_sol_note'),
        xref: 'paper', yref: 'paper',
        x: 1, y: -0.28,
        showarrow: false,
        font: { size: 11, color: subtleTextColor },
        xanchor: 'right',
      }],
      margin: compact ? { l: 42, r: 8, t: 8, b: 26 } : { ...responsiveMargin, b: 80 },
      paper_bgcolor: paperBg,
      plot_bgcolor: plotBg,
    }, {
      responsive: true,
      displaylogo: false,
    });
  }, [seriesArray, variableCode, datasetLabel, compact, i18n.language, fontColor, gridColor, paperBg, plotBg, titleSize, responsiveMargin, accentColor, subtleTextColor]);

  if (!seriesArray || seriesArray.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          {t('viz.timeseries.empty')}
        </Typography>
      </Paper>
    );
  }

  const stats = seriesArray[0]?.stats;

  return (
    <Box>
      {!noExportMenu && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
          <ExportMenu plotRef={plotRef} filename={`mars_timeseries_${variableCode || 'plot'}`} onCSV={onExportCSV} />
        </Box>
      )}
      <Paper elevation={compact ? 0 : 2} sx={{ borderRadius: 2, overflow: 'hidden', ...(compact ? { bgcolor: 'transparent', backgroundImage: 'none' } : {}) }}>
        <div ref={plotRef} role="img" aria-label={t('viz.aria.timeseries')} style={{ width: '100%', height: compact ? 300 : 450 }} />
      </Paper>
      {!compact && stats && <StatsBar stats={stats} />}
    </Box>
  );
}

export default TimeSeriesChart;
