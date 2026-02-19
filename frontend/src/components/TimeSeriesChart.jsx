import { useRef, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Paper, Typography, Box } from '@mui/material';
import { VARIABLES } from './VariableSelector';
import ExportMenu from './ExportMenu';
import StatsBar from './StatsBar';

/** Axe X : heures locales martiennes (0.5h a 24h, 48 valeurs) */
const HOURS = Array.from({ length: 48 }, (_, i) => (i + 1) * 0.5);

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
  const internalPlotRef = useRef(null);
  const plotRef = externalPlotRef ?? internalPlotRef;

  useEffect(() => {
    if (!plotRef.current || !timeSeriesData) return;

    const { latitude, longitude, altitudeIndex, altitudeValue, values } = timeSeriesData;
    const varInfo = VARIABLES.find(v => v.code === variableCode);
    const variableLabel = varInfo?.label || variableCode;
    const unit = varInfo?.unit || '';
    const altitudeText = altitudeValue != null
      ? `~${Number(altitudeValue).toFixed(1)} km`
      : `Niveau ${altitudeIndex}`;

    const fontColor = 'rgba(255,255,255,0.85)';

    Plotly.newPlot(plotRef.current, [{
      x: HOURS,
      y: values,
      mode: 'lines+markers',
      line: { color: '#e05a2b', width: 2.5 },
      marker: { color: '#ff7043', size: 5 },
      hovertemplate: '%{x}h : %{y:.6g}<extra></extra>'
    }], {
      title: { text: `${datasetLabel || ''} — ${variableLabel} — Lat ${latitude}°, Lon ${longitude}° — ${altitudeText}`, font: { size: 16, color: fontColor } },
      font: { color: fontColor },
      xaxis: {
        title: 'Heure locale martienne (h)',
        range: [0, 24.5],
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
      margin: { t: 80, r: 30, b: 50, l: 70 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)'
    }, {
      responsive: true,
      displaylogo: false
    });

    return () => { if (plotRef.current) Plotly.purge(plotRef.current); };
  }, [timeSeriesData, variableCode]);

  if (!timeSeriesData) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          Selectionnez un dataset, une variable, un point lat/lon
          et un niveau d'altitude, puis cliquez sur Analyser.
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
