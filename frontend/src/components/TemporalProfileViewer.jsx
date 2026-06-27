import { useRef, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Paper, Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { VARIABLES_MAP } from './VariableSelector';
import ExportMenu from './ExportMenu';
import StatsBar from './StatsBar';
import { usePlotlyTheme } from '../hooks/usePlotlyTheme';

/**
 * Heatmap Plotly d'un profil temporel (altitude x temps) en un point lat/lon.
 *
 * @param {Object|null} profileData - reponse de GET /api/data/temporal-profile
 * @param {string|null} variableCode
 * @param {string|null} datasetLabel
 */
function TemporalProfileViewer({ profileData, variableCode, datasetLabel,
  colorscaleName = 'Viridis', reverseColorscale = false,
  customZMin = null, customZMax = null,
  noExportMenu = false, externalPlotRef = null, onCSV = null }) {
  const { t, i18n } = useTranslation();
  const { fontColor, paperBg, plotBg, titleSize, margin: responsiveMargin } = usePlotlyTheme();
  const internalPlotRef = useRef(null);
  const plotRef = externalPlotRef ?? internalPlotRef;

  useEffect(() => {
    const el = plotRef.current;
    if (!el || !profileData) return;

    const { altitudes, times, data, latitude, longitude } = profileData;
    const varInfo = VARIABLES_MAP.get(variableCode);
    const variableLabel = varInfo ? t(`variable.${variableCode}`) : variableCode;
    const unit = varInfo?.unit || '';

    Plotly.newPlot(el, [{
      type: 'heatmap',
      x: times,
      y: altitudes,
      z: data,
      colorscale: colorscaleName,
      reversescale: reverseColorscale,
      ...(customZMin != null ? { zmin: customZMin } : {}),
      ...(customZMax != null ? { zmax: customZMax } : {}),
      zsmooth: 'best',
      connectgaps: true,
      colorbar: {
        title: {
          text: `${variableLabel} (${unit})`,
          side: 'right',
          font: { color: fontColor },
        },
        thickness: 15,
        len: 0.9,
        outlinewidth: 0,
        tickfont: { size: 11, color: fontColor },
      },
      hovertemplate: `${t('viz.hover_time')}: %{x:.1f}h<br>${t('viz.hover_alt')}: %{y:.1f} km<br>${t('viz.hover_value')}: %{z:.6g} ${unit}<extra></extra>`,
    }], {
      title: {
        text: `${datasetLabel || ''} — ${variableLabel} — Lat ${latitude?.toFixed(1)}° Lon ${longitude?.toFixed(1)}°`,
        font: { size: titleSize, color: fontColor },
      },
      font: { color: fontColor },
      xaxis: {
        title: { text: t('viz.localTime') },
        color: fontColor,
        showgrid: false,
        zeroline: false,
        dtick: 2,
      },
      yaxis: {
        title: { text: t('viz.altitude') },
        color: fontColor,
        showgrid: false,
        zeroline: false,
        autorange: true,
      },
      margin: { ...responsiveMargin, r: 120 },
      paper_bgcolor: paperBg,
      plot_bgcolor: plotBg,
    }, {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    });

    return () => Plotly.purge(el);
  }, [profileData, variableCode, datasetLabel, colorscaleName, reverseColorscale, customZMin, customZMax, i18n.language, fontColor, paperBg, plotBg, titleSize, responsiveMargin]);

  if (!profileData) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          {t('viz.temporalprofile.empty')}
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {!noExportMenu && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
          <ExportMenu plotRef={plotRef} filename={`mars_temporal_profile_${variableCode || 'plot'}`} onCSV={onCSV} />
        </Box>
      )}
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <div ref={plotRef} role="img" aria-label={t('viz.aria.temporalprofile')} style={{ width: '100%' }} />
      </Paper>
      <StatsBar stats={profileData.stats} />
    </Box>
  );
}

export default TemporalProfileViewer;
