import { useRef, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Paper, Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { VARIABLES_MAP } from './VariableSelector';
import ExportMenu from './ExportMenu';
import StatsBar from './StatsBar';
import { usePlotlyTheme } from '../hooks/usePlotlyTheme';

const COLORS = ['#38bdf8', '#e05a2b', '#a855f7', '#4ade80'];

/**
 * Unified vertical profile viewer — renders 1 to N profiles on a single Plotly chart.
 *
 * @param {Array|null} profiles       - array of ProfileResponse objects (1-4)
 * @param {string|null} variableCode  - variable code for X axis title
 * @param {string} datasetLabel       - dataset display label
 */
function ProfileViewer({ profiles, variableCode, datasetLabel, onExportCSV = null, noExportMenu = false, externalPlotRef = null }) {
  const { t, i18n } = useTranslation();
  const { fontColor, gridColor, paperBg, plotBg, titleSize, margin: responsiveMargin } = usePlotlyTheme();
  const internalPlotRef = useRef(null);
  const plotRef = externalPlotRef ?? internalPlotRef;

  useEffect(() => {
    const el = plotRef.current;
    if (!el || !profiles || profiles.length === 0) return;

    const varInfo = VARIABLES_MAP.get(variableCode);
    const variableLabel = varInfo ? t(`variable.${variableCode}`) : variableCode;
    const unit = varInfo?.unit || '';

    const single = profiles.length === 1;
    const traces = profiles.map((p, i) => ({
      x: p.values,
      y: p.altitudes,
      mode: 'lines+markers',
      line: { color: COLORS[i % COLORS.length], width: 2.5 },
      marker: { color: COLORS[i % COLORS.length], size: 4 },
      name: `(${p.latitude}°, ${p.longitude}°)`,
      showlegend: !single,
      hovertemplate: '%{x:.6g} ' + unit + '<br>Alt: %{y:.1f} km<extra>' +
        (single ? '' : `(${p.latitude}°, ${p.longitude}°)`) + '</extra>',
    }));

    const titleText = single
      ? `${datasetLabel || ''} — ${variableLabel} — Lat ${profiles[0].latitude}°, Lon ${profiles[0].longitude}°`
      : `${datasetLabel || ''} — ${variableLabel} — ${t('page.profile.title')}`;

    Plotly.newPlot(el, traces, {
      title: { text: titleText, font: { size: titleSize, color: fontColor } },
      font: { color: fontColor },
      xaxis: {
        title: `${variableLabel} (${unit})`,
        color: fontColor,
        gridcolor: gridColor,
        zeroline: false,
      },
      yaxis: {
        title: t('viz.altitude'),
        color: fontColor,
        gridcolor: gridColor,
        zeroline: false,
        autorange: true,
      },
      legend: single ? undefined : {
        font: { color: fontColor, size: 12 },
        bgcolor: paperBg,
      },
      margin: responsiveMargin,
      paper_bgcolor: paperBg,
      plot_bgcolor: plotBg,
    }, {
      responsive: true,
      displaylogo: false,
    });

    return () => Plotly.purge(el);
  }, [profiles, variableCode, datasetLabel, i18n.language, fontColor, gridColor, paperBg, plotBg, titleSize, responsiveMargin]);

  if (!profiles || profiles.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          {t('viz.profile.empty')}
        </Typography>
      </Paper>
    );
  }

  const exportFilename = `mars_profile_${variableCode || 'plot'}`;
  const stats = profiles[0]?.stats;

  return (
    <Box>
      {!noExportMenu && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
          <ExportMenu plotRef={plotRef} filename={exportFilename} onCSV={onExportCSV} />
        </Box>
      )}
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <div ref={plotRef} role="img" aria-label={t('viz.aria.profile')} style={{ width: '100%' }} />
      </Paper>
      {stats && <StatsBar stats={stats} />}
    </Box>
  );
}

export default ProfileViewer;
