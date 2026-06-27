import { useRef, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Paper, Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { VARIABLES_MAP } from './VariableSelector';
import ExportMenu from './ExportMenu';
import StatsBar from './StatsBar';
import { usePlotlyTheme } from '../hooks/usePlotlyTheme';
import { MAX_TIMESTEPS } from '../constants';

const COLORS = ['#38bdf8', '#e05a2b', '#a855f7', '#4ade80'];

/** Axe X : heures locales martiennes en format hh:mm (00:30 a 24:00, 48 valeurs) */
const HOURS = Array.from({ length: MAX_TIMESTEPS }, (_, i) => {
  const h = Math.floor((i + 1) * 0.5);
  const m = ((i + 1) * 0.5 % 1) * 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

/**
 * Unified time series chart — renders 1 to N series on a single Plotly chart.
 *
 * @param {Array|Object|null} series - single TimeSeriesResponse or array of them (1-4)
 * @param {string|null} variableCode - code variable pour le titre de l'axe Y
 * @param {string} datasetLabel - dataset display label
 */
function TimeSeriesChart({ series, timeSeriesData, variableCode, datasetLabel, onExportCSV = null, noExportMenu = false, externalPlotRef = null }) {
  const { t, i18n } = useTranslation();
  const { fontColor, gridColor, paperBg, plotBg, titleSize, margin: responsiveMargin, accentColor, subtleTextColor } = usePlotlyTheme();
  const internalPlotRef = useRef(null);
  const plotRef = externalPlotRef ?? internalPlotRef;

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
    const altitudeText = first.altitudeValue != null
      ? `~${Number(first.altitudeValue).toFixed(1)} km`
      : `${t('selector.altitude.level')} ${first.altitudeIndex}`;

    const traces = seriesArray.map((s, i) => ({
      x: HOURS,
      y: s.values,
      mode: 'lines+markers',
      line: { color: single ? accentColor : COLORS[i % COLORS.length], width: 2.5 },
      marker: { color: single ? accentColor : COLORS[i % COLORS.length], size: 4 },
      name: `(${s.latitude}°, ${s.longitude}°)`,
      showlegend: !single,
      hovertemplate: '%{x} : %{y:.6g} ' + unit +
        '<extra>' + (single ? '' : `(${s.latitude}°, ${s.longitude}°)`) + '</extra>',
    }));

    const titleText = single
      ? `${datasetLabel || ''} — ${variableLabel} — Lat ${first.latitude}°, Lon ${first.longitude}° — ${altitudeText}`
      : `${datasetLabel || ''} — ${variableLabel} — ${altitudeText}`;

    Plotly.newPlot(el, traces, {
      title: { text: titleText, font: { size: titleSize, color: fontColor } },
      font: { color: fontColor },
      xaxis: {
        title: { text: t('viz.localTime') },
        type: 'category',
        color: fontColor,
        gridcolor: gridColor,
        zeroline: false,
      },
      yaxis: {
        title: { text: `${variableLabel} (${unit})` },
        color: fontColor,
        gridcolor: gridColor,
        zeroline: false,
      },
      legend: single ? undefined : {
        font: { color: fontColor, size: 12 },
        bgcolor: paperBg,
      },
      annotations: [{
        text: t('viz.martian_sol_note'),
        xref: 'paper', yref: 'paper',
        x: 1, y: -0.28,
        showarrow: false,
        font: { size: 11, color: subtleTextColor },
        xanchor: 'right',
      }],
      margin: { ...responsiveMargin, b: 80 },
      paper_bgcolor: paperBg,
      plot_bgcolor: plotBg,
    }, {
      responsive: true,
      displaylogo: false,
    });

    return () => Plotly.purge(el);
  }, [seriesArray, variableCode, datasetLabel, i18n.language, fontColor, gridColor, paperBg, plotBg, titleSize, responsiveMargin, accentColor, subtleTextColor]);

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
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <div ref={plotRef} role="img" aria-label={t('viz.aria.timeseries')} style={{ width: '100%' }} />
      </Paper>
      {stats && <StatsBar stats={stats} />}
    </Box>
  );
}

export default TimeSeriesChart;
