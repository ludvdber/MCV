import { useRef, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Paper, Typography, Box } from '@mui/material';
import { formatTime } from './TimeSelector';
import { VARIABLES } from './VariableSelector';

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
 */
function SliceViewer({ sliceData, variableCode, datasetLabel }) {
  const plotRef = useRef(null);

  useEffect(() => {
    if (!plotRef.current || !sliceData) return;

    const { data, latitudes, longitudes, timeIndex, altitudeIndex, altitudeValue } = sliceData;
    const varInfo = VARIABLES.find(v => v.code === variableCode);
    const unit = varInfo?.unit || '';
    const variableLabel = varInfo?.label || variableCode;
    const altitudeText = altitudeValue != null
      ? `~${Number(altitudeValue).toFixed(1)} km`
      : `Niveau ${altitudeIndex}`;

    const lonMin = Math.min(...longitudes);
    const lonMax = Math.max(...longitudes);
    const latMin = Math.min(...latitudes);
    const latMax = Math.max(...latitudes);

    Plotly.newPlot(plotRef.current, [{
      type: 'heatmap',
      x: longitudes,
      y: latitudes,
      z: data,
      colorscale: 'RdBu',
      reversescale: true,
      zsmooth: 'best',
      connectgaps: true,
      colorbar: {
        title: { text: `${variableLabel} (${unit})`, side: 'right' },
        thickness: 15,
        len: 0.9,
        outlinewidth: 0,
        tickfont: { size: 11 }
      },
      hovertemplate: 'Lon: %{x}°<br>Lat: %{y}°<br>Valeur: %{z:.2f} ' + unit + '<extra></extra>'
    }], {
      title: { text: `${datasetLabel || ''} — ${variableLabel} — ${formatTime(timeIndex)} — ${altitudeText}`, font: { size: 16 } },
      xaxis: {
        title: 'Longitude (°)',
        range: [lonMin, lonMax],
        showgrid: false,
        zeroline: false,
        autorange: false
      },
      yaxis: {
        title: 'Latitude (°)',
        range: [latMin, latMax],
        showgrid: false,
        zeroline: false,
        autorange: false
      },
      margin: { t: 80, r: 120, b: 50, l: 70 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)'
    }, {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d']
    });

    return () => { if (plotRef.current) Plotly.purge(plotRef.current); };
  }, [sliceData, variableCode]);

  if (!sliceData) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          Selectionnez un dataset, une variable, un timestep et un niveau d'altitude,
          puis cliquez sur Visualiser.
        </Typography>
      </Paper>
    );
  }

  const { stats } = sliceData;

  return (
    <Box>
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <div ref={plotRef} style={{ width: '100%' }} />
      </Paper>
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

export default SliceViewer;
