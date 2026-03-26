import { useRef, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Paper, Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import ExportMenu from './ExportMenu';
import StatsBar from './StatsBar';
import { usePlotlyTheme } from '../hooks/usePlotlyTheme';

/**
 * Diagramme en rose des vents (Plotly barpolar).
 *
 * @param {Object|null} windRoseData - { uu: number[], vv: number[], actualLat, actualLon }
 * @param {string} datasetLabel
 */

const DIRECTIONS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const SPEED_BINS = [
  { min: 0, max: 5, label: '0\u20135 m/s', color: '#60a5fa' },
  { min: 5, max: 15, label: '5\u201315 m/s', color: '#34d399' },
  { min: 15, max: 30, label: '15\u201330 m/s', color: '#fbbf24' },
  { min: 30, max: 60, label: '30\u201360 m/s', color: '#f97316' },
  { min: 60, max: Infinity, label: '60+ m/s', color: '#ef4444' },
];

function computeWindRose(uu, vv) {
  const bins = DIRECTIONS.map(() => SPEED_BINS.map(() => 0));
  const n = Math.min(uu.length, vv.length);

  for (let i = 0; i < n; i++) {
    const u = uu[i];
    const v = vv[i];
    const speed = Math.sqrt(u * u + v * v);
    // Meteorological convention: direction wind comes FROM
    let dir = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
    const sector = Math.round(dir / 22.5) % 16;
    const speedIdx = SPEED_BINS.findIndex(b => speed >= b.min && speed < b.max);
    if (speedIdx >= 0) bins[sector][speedIdx]++;
  }

  // Convert counts to percentages
  return bins.map(sectorBins => sectorBins.map(count => (count / n) * 100));
}

function WindRoseViewer({ windRoseData, datasetLabel, noExportMenu = false, externalPlotRef = null, onCSV = null }) {
  const { t, i18n } = useTranslation();
  const { fontColor, gridColor, paperBg, plotBg, titleSize, margin: responsiveMargin } = usePlotlyTheme();
  const internalPlotRef = useRef(null);
  const plotRef = externalPlotRef ?? internalPlotRef;

  useEffect(() => {
    const el = plotRef.current;
    if (!el || !windRoseData) return;

    const { uu, vv, actualLat, actualLon } = windRoseData;
    const roseData = computeWindRose(uu, vv);

    const traces = SPEED_BINS.map((bin, sIdx) => ({
      type: 'barpolar',
      r: DIRECTIONS.map((_, dIdx) => roseData[dIdx][sIdx]),
      theta: DIRECTIONS,
      name: bin.label,
      marker: { color: bin.color, line: { color: 'rgba(0,0,0,0.4)', width: 1 } },
      hovertemplate: '%{theta}: %{r:.1f}%<extra>' + bin.label + '</extra>',
    }));

    Plotly.newPlot(el, traces, {
      title: {
        text: `${datasetLabel || ''} — ${t('page.windrose.title')} — (${actualLat}°, ${actualLon}°)`,
        font: { size: titleSize, color: fontColor },
      },
      font: { color: fontColor },
      polar: {
        bgcolor: plotBg,
        radialaxis: {
          ticksuffix: '%',
          color: fontColor,
          gridcolor: gridColor,
          linecolor: gridColor,
        },
        angularaxis: {
          direction: 'clockwise',
          color: fontColor,
          gridcolor: gridColor,
          linecolor: gridColor,
        },
      },
      barmode: 'stack',
      legend: {
        font: { color: fontColor, size: 13 },
        bgcolor: paperBg,
        bordercolor: gridColor,
        borderwidth: 1,
      },
      margin: responsiveMargin,
      paper_bgcolor: paperBg,
      plot_bgcolor: plotBg,
    }, {
      responsive: true,
      displaylogo: false,
    });

    return () => Plotly.purge(el);
  }, [windRoseData, datasetLabel, i18n.language, fontColor, gridColor, paperBg, plotBg, titleSize, responsiveMargin]);

  if (!windRoseData) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          {t('viz.windrose.empty')}
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {!noExportMenu && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
          <ExportMenu plotRef={plotRef} filename="mars_windrose" onCSV={onCSV} />
        </Box>
      )}
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <div ref={plotRef} role="img" aria-label={t('viz.aria.windrose')} style={{ width: '100%', minHeight: 500 }} />
      </Paper>
      {windRoseData.stats && <StatsBar stats={windRoseData.stats} />}
    </Box>
  );
}

export default WindRoseViewer;
