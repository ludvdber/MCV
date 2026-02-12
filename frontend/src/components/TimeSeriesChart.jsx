import { useRef, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Paper, Typography, Box } from '@mui/material';
import { VARIABLES } from './VariableSelector';

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
function TimeSeriesChart({ timeSeriesData, variableCode, datasetLabel }) {
  const plotRef = useRef(null);

  useEffect(() => {
    if (!plotRef.current || !timeSeriesData) return;

    const { latitude, longitude, altitudeIndex, altitudeValue, values } = timeSeriesData;
    const varInfo = VARIABLES.find(v => v.code === variableCode);
    const variableLabel = varInfo?.label || variableCode;
    const unit = varInfo?.unit || '';
    const altitudeText = altitudeValue != null
      ? `~${Number(altitudeValue).toFixed(1)} km`
      : `Niveau ${altitudeIndex}`;

    Plotly.newPlot(plotRef.current, [{
      x: HOURS,
      y: values,
      mode: 'lines+markers',
      line: { color: '#d84315' },
      hovertemplate: '%{x}h : %{y:.2f}<extra></extra>'
    }], {
      title: { text: `${datasetLabel || ''} — ${variableLabel} — Lat ${latitude}°, Lon ${longitude}° — ${altitudeText}`, font: { size: 16 } },
      xaxis: { title: 'Heure locale martienne (h)', range: [0, 24.5] },
      yaxis: { title: `${variableLabel} (${unit})` },
      margin: { t: 80, r: 30, b: 50, l: 70 },
      paper_bgcolor: 'transparent'
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

  return (
    <Box>
      <div ref={plotRef} style={{ width: '100%' }} />
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

export default TimeSeriesChart;
