import { useRef, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Paper, Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { VARIABLES_MAP } from './VariableSelector';
import ExportMenu from './ExportMenu';
import StatsBar from './StatsBar';

/**
 * Affiche un profil vertical Plotly (valeur en X, altitude en Y).
 * Y = altitude en km (surface en bas, sommet en haut).
 *
 * @param {Object|null} profileData - reponse de GET /api/data/profile
 *   { dataset, variable, timeIndex, latitude, longitude, altitudes[], values[], stats }
 * @param {string|null} variableCode - code variable pour le titre de l'axe X
 */
function ProfileViewer({ profileData, variableCode, datasetLabel, onExportCSV = null, noExportMenu = false, externalPlotRef = null }) {
  const { t, i18n } = useTranslation();
  const internalPlotRef = useRef(null);
  const plotRef = externalPlotRef ?? internalPlotRef;

  useEffect(() => {
    const el = plotRef.current;
    if (!el || !profileData) return;

    const { latitude, longitude, altitudes, values } = profileData;
    const varInfo = VARIABLES_MAP.get(variableCode);
    const variableLabel = varInfo ? t(`variable.${variableCode}`) : variableCode;
    const unit = varInfo?.unit || '';

    const fontColor = 'rgba(255,255,255,0.85)';

    Plotly.newPlot(el, [{
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
        title: t('viz.altitude'),
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

    return () => Plotly.purge(el);
  }, [profileData, variableCode, datasetLabel, i18n.language]);

  if (!profileData) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          {t('viz.profile.empty')}
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
      <StatsBar stats={stats} />
    </Box>
  );
}

export default ProfileViewer;
