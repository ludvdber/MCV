import { useRef, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Paper, Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { VARIABLES_MAP } from './VariableSelector';
import ExportMenu from './ExportMenu';
import StatsBar from './StatsBar';

/** Axe X : heures locales martiennes en format hh:mm (00:30 a 24:00, 48 valeurs) */
const HOURS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor((i + 1) * 0.5);
  const m = ((i + 1) * 0.5 % 1) * 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

/**
 * Affiche un line chart Plotly de la serie temporelle diurne (48 pas de temps).
 * Utilise Plotly.js directement via useRef (meme pattern que SliceViewer,
 * pas de wrapper react-plotly.js car incompatible avec Plotly v3).
 *
 * Le graphique est recree a chaque changement de timeSeriesData ou variableCode
 * via useEffect + Plotly.newPlot(). Le cleanup appelle Plotly.purge() pour
 * liberer la memoire.
 *
 * @param {Object|null} timeSeriesData - reponse de GET /api/data/timeseries
 *   { dataset, variable, latitude, longitude, altitudeIndex, values: number[], stats }
 * @param {string|null} variableCode - code variable pour le titre de l'axe Y
 */
function TimeSeriesChart({ timeSeriesData, variableCode, datasetLabel, onExportCSV = null, noExportMenu = false, externalPlotRef = null }) {
  const { t, i18n } = useTranslation();
  const internalPlotRef = useRef(null);
  const plotRef = externalPlotRef ?? internalPlotRef;

  useEffect(() => {
    const el = plotRef.current;
    if (!el || !timeSeriesData) return;

    const { latitude, longitude, altitudeIndex, altitudeValue, values } = timeSeriesData;
    const varInfo = VARIABLES_MAP.get(variableCode);
    const variableLabel = varInfo ? t(`variable.${variableCode}`) : variableCode;
    const unit = varInfo?.unit || '';
    const altitudeText = altitudeValue != null
      ? `~${Number(altitudeValue).toFixed(1)} km`
      : `${t('selector.altitude.level')} ${altitudeIndex}`;

    const fontColor = 'rgba(255,255,255,0.85)';

    Plotly.newPlot(el, [{
      x: HOURS,
      y: values,
      mode: 'lines+markers',
      line: { color: '#e05a2b', width: 2.5 },
      marker: { color: '#ff7043', size: 5 },
      hovertemplate: '%{x} : %{y:.6g}<extra></extra>'
    }], {
      title: { text: `${datasetLabel || ''} — ${variableLabel} — Lat ${latitude}°, Lon ${longitude}° — ${altitudeText}`, font: { size: 16, color: fontColor } },
      font: { color: fontColor },
      xaxis: {
        title: t('viz.localTime'),
        type: 'category',
        color: fontColor,
        gridcolor: 'rgba(56, 189, 248, 0.08)',
        zeroline: false
      },
      yaxis: {
        title: `${variableLabel} (${unit})`,
        color: fontColor,
        gridcolor: 'rgba(56, 189, 248, 0.08)',
        zeroline: false
      },
      annotations: [{
        text: t('viz.martian_sol_note'),
        xref: 'paper', yref: 'paper',
        x: 1, y: -0.28,
        showarrow: false,
        font: { size: 11, color: 'rgba(255,255,255,0.7)' },
        xanchor: 'right'
      }],
      margin: { t: 80, r: 30, b: 80, l: 70 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)'
    }, {
      responsive: true,
      displaylogo: false
    });

    return () => Plotly.purge(el);
  }, [timeSeriesData, variableCode, datasetLabel, i18n.language]);

  if (!timeSeriesData) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          {t('viz.timeseries.empty')}
        </Typography>
      </Paper>
    );
  }

  const { stats } = timeSeriesData;
  const exportFilename = `mars_timeseries_${variableCode || 'plot'}`;

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

export default TimeSeriesChart;
