import { useRef, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Paper, Typography, Box } from '@mui/material';
import { VARIABLES } from './VariableSelector';
import ExportMenu from './ExportMenu';

/**
 * Affiche un profil vertical Plotly (valeur en X, altitude en Y).
 * Y = altitude en km (surface en bas, sommet en haut).
 *
 * @param {Object|null} profileData - reponse de GET /api/data/profile
 *   { dataset, variable, timeIndex, latitude, longitude, altitudes[], values[], stats }
 * @param {string|null} variableCode - code variable pour le titre de l'axe X
 */
function ProfileViewer({ profileData, variableCode, datasetLabel, onExportCSV = null, noExportMenu = false, externalPlotRef = null }) {
  const internalPlotRef = useRef(null);
  const plotRef = externalPlotRef ?? internalPlotRef;

  useEffect(() => {
    if (!plotRef.current || !profileData) return;

    const { latitude, longitude, altitudes, values } = profileData;
    const varInfo = VARIABLES.find(v => v.code === variableCode);
    const variableLabel = varInfo?.label || variableCode;
    const unit = varInfo?.unit || '';

    const fontColor = 'rgba(255,255,255,0.85)';

    Plotly.newPlot(plotRef.current, [{
      x: values,
      y: altitudes,
      mode: 'lines+markers',
      line: { color: '#38bdf8', width: 2.5 },
      marker: { color: '#38bdf8', size: 4 },
      hovertemplate: '%{x:.6g} ' + unit + '<br>Alt: %{y:.1f} km<extra></extra>'
    }], {
      title: {
        text: `${datasetLabel || ''} — ${variableLabel} — Lat ${latitude}°, Lon ${longitude}°`,
        font: { size: 16, color: fontColor }
      },
      font: { color: fontColor },
      xaxis: {
        title: `${variableLabel} (${unit})`,
        color: fontColor,
        gridcolor: 'rgba(56, 189, 248, 0.08)',
        zeroline: false
      },
      yaxis: {
        title: 'Altitude (km)',
        color: fontColor,
        gridcolor: 'rgba(56, 189, 248, 0.08)',
        zeroline: false,
        autorange: true
      },
      margin: { t: 80, r: 30, b: 50, l: 70 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)'
    }, {
      responsive: true,
      displaylogo: false
    });

    return () => { if (plotRef.current) Plotly.purge(plotRef.current); };
  }, [profileData, variableCode]);

  if (!profileData) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          Selectionnez un dataset, une variable, un point lat/lon
          et un pas de temps, puis cliquez sur Lancer.
        </Typography>
      </Paper>
    );
  }

  const { stats } = profileData;
  const exportFilename = `mars_profile_${variableCode || 'plot'}`;

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
      {stats && (
        <Paper sx={{ p: 1.5, mt: 1, display: 'flex', justifyContent: 'center', gap: 3 }}>
          <Typography variant="body2">Min : {stats.min?.toPrecision(4) ?? '-'}</Typography>
          <Typography variant="body2">Max : {stats.max?.toPrecision(4) ?? '-'}</Typography>
          <Typography variant="body2">Moyenne : {stats.mean?.toPrecision(4) ?? '-'}</Typography>
          <Typography variant="body2">Ecart-type : {stats.stddev?.toPrecision(4) ?? '-'}</Typography>
        </Paper>
      )}
    </Box>
  );
}

export default ProfileViewer;
