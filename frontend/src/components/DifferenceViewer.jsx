import { useRef, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import { Paper, Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { VARIABLES_MAP } from './VariableSelector';
import ExportMenu from './ExportMenu';
import StatsBar from './StatsBar';
import { usePlotlyTheme } from '../hooks/usePlotlyTheme';
import { buildLocationTrace } from '../data/marsLocations';

/**
 * Heatmap de difference entre deux datasets (A - B).
 * Palette divergente RdBu centree sur 0.
 *
 * @param {Object|null} differenceData - { data[][], latitudes[], longitudes[],
 *   datasetA, datasetB, variable, stats }
 */
function DifferenceViewer({ differenceData, variableCode, datasetLabelA, datasetLabelB, noExportMenu = false, externalPlotRef = null, onCSV = null, colorscaleName = 'RdBu', reverseColorscale = true, customZMin = null, customZMax = null, logScale = false, showLocations = false, showSurface = false }) {
  const { t, i18n } = useTranslation();
  const { fontColor, gridColor, paperBg, plotBg, titleSize, margin: responsiveMargin } = usePlotlyTheme();
  const internalPlotRef = useRef(null);
  const plotRef = externalPlotRef ?? internalPlotRef;

  useEffect(() => {
    const el = plotRef.current;
    if (!el || !differenceData) return;

    const { data, latitudes, longitudes, datasetA, datasetB, stats } = differenceData;
    const varInfo = VARIABLES_MAP.get(variableCode);
    const variableLabel = varInfo ? t(`variable.${variableCode}`) : variableCode;
    const unit = varInfo?.unit || '';

    // Format dataset IDs into readable labels
    const formatId = (id) => {
      if (!id) return '?';
      // mean format: mean_MY35_Ls0_30
      const meanMatch = id.match(/mean_MY(\d+)_Ls(\d+)_(\d+)/i);
      if (meanMatch) return `MY${meanMatch[1]} Ls${meanMatch[2]}\u2013${meanMatch[3]}\u00b0`;
      // individual format: IND_MY34_LS5.50
      const indMatch = id.match(/IND_MY(\d+)_LS([\d.]+)/i);
      if (indMatch) return `MY${indMatch[1]} Ls${indMatch[2]}\u00b0`;
      // full filename format: hl-b274_..._ls030_..._MY35_...
      const fnMatch = id.match(/MY(\d+)/);
      const lsMatch = id.match(/_ls(\d+)/i);
      if (fnMatch) return `MY${fnMatch[1]}${lsMatch ? ` Ls${parseInt(lsMatch[1])}\u00b0` : ''}`;
      // Fallback: truncate
      if (id.length > 25) return id.substring(0, 22) + '\u2026';
      return id;
    };
    const labelA = datasetLabelA || formatId(datasetA);
    const labelB = datasetLabelB || formatId(datasetB);

    // Symmetric z-range centered on 0
    const maxAbs = Math.max(Math.abs(stats?.min || 0), Math.abs(stats?.max || 0));

    // Log scale transform (applied to absolute values, preserves sign)
    let displayData = data;
    let zMin = customZMin ?? -maxAbs;
    let zMax = customZMax ?? maxAbs;
    if (logScale) {
      displayData = data.map(row => row.map(v => {
        if (v == null) return null;
        const sign = v >= 0 ? 1 : -1;
        return sign * Math.log10(Math.max(Math.abs(v), 1e-10));
      }));
      const logMax = Math.log10(Math.max(maxAbs, 1e-10));
      zMin = -logMax;
      zMax = logMax;
    }

    const traces = [{
      type: 'heatmap',
      z: displayData,
      x: longitudes,
      y: latitudes,
      zsmooth: 'best',
      colorscale: colorscaleName,
      reversescale: reverseColorscale,
      zmin: zMin,
      zmax: zMax,
      opacity: showSurface ? 0.55 : 1,
      colorbar: {
        title: { text: `${logScale ? 'log₁₀ ' : ''}Δ ${variableLabel} (${unit})`, font: { color: fontColor } },
        tickfont: { color: fontColor },
      },
      hovertemplate: `${t('viz.hover_lat')}: %{y:.1f}°<br>${t('viz.hover_lon')}: %{x:.1f}°<br>Δ: %{z:.4g} ${unit}<extra></extra>`,
    }];

    if (showLocations) traces.push(buildLocationTrace(longitudes));

    const layout = {
      title: {
        text: `Δ ${variableLabel} — ${labelA} − ${labelB}`,
        font: { size: titleSize, color: fontColor },
      },
      font: { color: fontColor },
      xaxis: {
        title: t('viz.longitude'),
        color: fontColor,
        gridcolor: gridColor,
      },
      yaxis: {
        title: t('viz.latitude'),
        color: fontColor,
        gridcolor: gridColor,
      },
      margin: responsiveMargin,
      paper_bgcolor: paperBg,
      plot_bgcolor: plotBg,
    };

    if (showSurface) {
      const dataIs0to360 = longitudes?.length > 0 && longitudes[0] >= 0;
      layout.images = [{
        source: '/mars-surface.jpg',
        xref: 'x', yref: 'y',
        x: dataIs0to360 ? 0 : -180, y: 90,
        sizex: 360, sizey: 180,
        sizing: 'stretch', opacity: 0.9, layer: 'below',
      }];
    }

    Plotly.newPlot(el, traces, layout, {
      responsive: true,
      displaylogo: false,
    });

    return () => Plotly.purge(el);
  }, [differenceData, variableCode, i18n.language, fontColor, gridColor, paperBg, plotBg, titleSize, responsiveMargin, colorscaleName, reverseColorscale, customZMin, customZMax, logScale, showLocations, showSurface]);

  if (!differenceData) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          {t('viz.difference.empty')}
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {!noExportMenu && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
          <ExportMenu plotRef={plotRef} filename={`mars_diff_${variableCode || 'plot'}`} onCSV={onCSV} />
        </Box>
      )}
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <div ref={plotRef} role="img" aria-label={t('viz.aria.difference')} style={{ width: '100%' }} />
      </Paper>
      <StatsBar stats={differenceData.stats} />
    </Box>
  );
}

export default DifferenceViewer;
