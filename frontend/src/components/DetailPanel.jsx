import { useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Plotly from 'plotly.js-dist-min';
import { Paper, Box } from '@mui/material';
import { VARIABLES_MAP } from './VariableSelector';
import { usePlotlyTheme } from '../hooks/usePlotlyTheme';

/**
 * Panneau de details pour les resultats heatmap (slice / animation).
 *
 * Affiche cote a cote :
 * - Un histogramme de la distribution des valeurs
 * - Un profil de moyenne zonale (moyenne par latitude, tous longitudes confondus)
 *
 * Pour les animations, les statistiques sont calculees sur l'ensemble des frames
 * (vue globale du cycle diurne).
 *
 * @param {Object} resultData - donnees du resultat (SliceResponse ou AnimationResponse)
 * @param {'slice'|'animation'} resultType - type de resultat
 * @param {string} variableCode - code variable (ex: 'TT')
 */
function DetailPanel({ resultData, resultType, variableCode }) {
  const { t, i18n } = useTranslation();
  const { fontColor, paperBg, plotBg } = usePlotlyTheme();
  const histRef = useRef(null);
  const zonalRef = useRef(null);

  const varInfo = VARIABLES_MAP.get(variableCode);
  const unit = varInfo?.unit || '';
  const variableLabel = varInfo ? t(`variable.${variableCode}`) : variableCode;

  const { flatValues, zonalMean, latitudes } = useMemo(() => {
    if (!resultData) return { flatValues: [], zonalMean: [], latitudes: [] };

    let zArrays, lats;
    if (resultType === 'slice') {
      if (!Array.isArray(resultData.data) || !Array.isArray(resultData.latitudes))
        return { flatValues: [], zonalMean: [], latitudes: [] };
      zArrays = [resultData.data];
      lats = resultData.latitudes;
    } else if (resultType === 'animation') {
      if (!Array.isArray(resultData.frames) || !Array.isArray(resultData.latitudes))
        return { flatValues: [], zonalMean: [], latitudes: [] };
      zArrays = resultData.frames;
      lats = resultData.latitudes;
    } else {
      return { flatValues: [], zonalMean: [], latitudes: [] };
    }

    // Aplatir toutes les valeurs (filtrer NaN/null)
    const flat = [];
    for (const z of zArrays) {
      for (const row of z) {
        for (const val of row) {
          if (val != null && !isNaN(val)) flat.push(val);
        }
      }
    }

    // Moyenne zonale : moyenne sur les longitudes (et les frames pour animation)
    const nLat = lats.length;
    const sums = new Float64Array(nLat);
    const counts = new Int32Array(nLat);

    for (const z of zArrays) {
      for (let i = 0; i < nLat; i++) {
        const row = z[i];
        if (!row) continue;
        for (let j = 0; j < row.length; j++) {
          const v = row[j];
          if (v != null && !isNaN(v)) {
            sums[i] += v;
            counts[i]++;
          }
        }
      }
    }

    const zm = [];
    for (let i = 0; i < nLat; i++) {
      zm.push(counts[i] > 0 ? sums[i] / counts[i] : null);
    }

    return { flatValues: flat, zonalMean: zm, latitudes: lats };
  }, [resultData, resultType]);

  // Histogramme de distribution
  useEffect(() => {
    const el = histRef.current;
    if (!el || flatValues.length === 0) return;

    Plotly.newPlot(el, [{
      type: 'histogram',
      x: flatValues,
      nbinsx: 50,
      marker: {
        color: 'rgba(224, 90, 43, 0.7)',
        line: { color: 'rgba(224, 90, 43, 1)', width: 0.5 },
      },
    }], {
      title: { text: `${t('viz.detail.distribution')} — ${variableLabel} (${unit})`, font: { size: 13, color: fontColor } },
      xaxis: { title: { text: `${variableLabel} (${unit})` }, color: fontColor },
      yaxis: { title: { text: t('viz.detail.frequency') }, color: fontColor },
      font: { color: fontColor },
      margin: { t: 40, r: 20, b: 50, l: 60 },
      paper_bgcolor: paperBg,
      plot_bgcolor: plotBg,
      bargap: 0.02,
      height: 230,
    }, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] });

    return () => Plotly.purge(el);
  }, [flatValues, variableLabel, unit, i18n.language, fontColor, paperBg, plotBg]);

  // Profil de moyenne zonale
  useEffect(() => {
    const el = zonalRef.current;
    if (!el || zonalMean.length === 0) return;

    Plotly.newPlot(el, [{
      type: 'scatter',
      mode: 'lines',
      x: zonalMean,
      y: latitudes,
      line: { color: '#38bdf8', width: 2 },
    }], {
      title: { text: t('viz.detail.zonalMean'), font: { size: 13, color: fontColor } },
      xaxis: { title: { text: `${variableLabel} (${unit})` }, color: fontColor },
      yaxis: { title: { text: t('viz.latitude') }, color: fontColor },
      font: { color: fontColor },
      margin: { t: 40, r: 20, b: 50, l: 60 },
      paper_bgcolor: paperBg,
      plot_bgcolor: plotBg,
      height: 230,
    }, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] });

    return () => Plotly.purge(el);
  }, [zonalMean, latitudes, variableLabel, unit, i18n.language, fontColor, paperBg, plotBg]);

  if (!resultData || (resultType !== 'slice' && resultType !== 'animation')) {
    return null;
  }

  return (
    <Paper sx={{ mt: 1, p: 1.5 }}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 300 }}>
          <div ref={histRef} style={{ width: '100%' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 300 }}>
          <div ref={zonalRef} style={{ width: '100%' }} />
        </Box>
      </Box>
    </Paper>
  );
}

export default DetailPanel;
