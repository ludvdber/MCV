import { useRef, useEffect } from 'react';
import Plotly, { renderPlot } from '../plotlyBundle';
import { Paper, Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { formatTime } from '../utils/formatTime';
import { VARIABLES_MAP } from './VariableSelector';
import { buildLocationTrace } from '../data/marsLocations';
import { computeHeatmapCustomData } from '../utils/heatmapAnalysis';
import { autoColorscaleFor } from '../utils/colorscales';
import { upsampleLatLonGrid, nativeStep } from '../utils/gridInterpolation';
import { compactLayout } from '../utils/compactPlot';
import { plotAreaSize, quiverScales, buildQuiverSegments } from '../utils/windQuiver';
import { windSpeedStats } from '../utils/windStats';
import ExportMenu from './ExportMenu';
import StatsBar from './StatsBar';
import WindParticlesLayer from './WindParticlesLayer';
import WindSpeedLegend from './WindSpeedLegend';
import { usePlotlyTheme } from '../hooks/usePlotlyTheme';

/**
 * Affiche une heatmap 2D latitude/longitude d'une variable atmospherique.
 * Utilise Plotly.js directement via useRef (pas de wrapper react-plotly.js
 * car incompatible avec Plotly v3).
 *
 * Le graphique est mis a jour a chaque changement de sliceData ou variableCode
 * via useEffect + Plotly.react() (reutilise le graphe existant, pas de flash).
 * Plotly.purge() n'est appele qu'au demontage pour liberer la memoire.
 *
 * @param {Object|null} sliceData - reponse de GET /api/data/slice (SliceResponse)
 *   { data: number[][], latitudes: number[], longitudes: number[],
 *     timeIndex, altitudeIndex, variable, stats }
 * @param {string|null} variableCode - code variable pour le titre de la colorbar
 * @param {boolean}     logScale     - afficher l'echelle en log10 (pour variables a faibles valeurs)
 * @param {boolean}     smooth       - lissage visuel Plotly (zsmooth 'best')
 * @param {number}      interpStep   - pas d'affichage en degres (0 = grille native,
 *                                     2/1 = sur-echantillonnage bilineaire client)
 */

function SliceViewer({ sliceData, variableCode, datasetLabel, showLocations = false, showSurface = false, colorscaleName, reverseColorscale, customZMin, customZMax, showDetailedTooltip = false, windData = null, windParticles = false, topoData = null, titleText = null, onExportCSV = null, noExportMenu = false, externalPlotRef = null, logScale = false, smooth = true, interpStep = 0, compact = false }) {
  const { t, i18n } = useTranslation();
  const { fontColor, paperBg, plotBg, titleSize, margin: responsiveMargin } = usePlotlyTheme();
  const internalPlotRef = useRef(null);
  const plotRef = externalPlotRef ?? internalPlotRef;

  // Purge Plotly uniquement au demontage : les mises a jour passent par
  // Plotly.react (pas de destruction/recreation du graphe a chaque prop).
  useEffect(() => {
    const el = plotRef.current;
    return () => { if (el) Plotly.purge(el); };
  }, [plotRef]);

  useEffect(() => {
    const el = plotRef.current;
    if (!el || !sliceData) return;
    // Garde defensive : si la reponse arrive partielle (course montage/donnees),
    // on n'entre pas dans le rendu Plotly (data.map / z:data planteraient -> ErrorBoundary).
    if (!Array.isArray(sliceData.data) || !Array.isArray(sliceData.latitudes) || !Array.isArray(sliceData.longitudes)) return;

    const { timeIndex, altitudeIndex, altitudeValue } = sliceData;
    const varInfo = VARIABLES_MAP.get(variableCode);
    const unit = varInfo?.unit || '';
    const variableLabel = varInfo ? t(`variable.${variableCode}`) : variableCode;
    const altitudeText = altitudeValue != null
      ? `~${Number(altitudeValue).toFixed(1)} km`
      : `${t('selector.altitude.level')} ${altitudeIndex}`;

    // Sur-echantillonnage optionnel (les points crees sont marques via `text`).
    const grid = upsampleLatLonGrid(
      sliceData.data, sliceData.latitudes, sliceData.longitudes,
      interpStep, t('viz.interpolated'),
    );
    const { data, latitudes, longitudes } = grid;
    const interpSuffix = grid.text ? ' %{text}' : '';

    const lonMin = Math.min(...longitudes);
    const lonMax = Math.max(...longitudes);
    const latMin = Math.min(...latitudes);
    const latMax = Math.max(...latitudes);

    const finalColorscale = colorscaleName || autoColorscaleFor(variableCode);
    const finalReverse = reverseColorscale ?? false; // RdBu Plotly est deja bleu(bas)->rouge(haut)

    // ── Log scale transform ───────────────────────────────────────────────
    let displayData = data;
    let logColorbarExtra = {};
    let logZMin = null, logZMax = null;
    let logApplied = false;

    if (logScale) {
      const hasPositive = data.some(row => row.some(v => v != null && v > 0));
      if (hasPositive) {
        logApplied = true;
        displayData = data.map(row => row.map(v => (v != null && v > 0) ? Math.log10(v) : null));
        const rawStats = sliceData.stats;
        if (rawStats?.min > 0 && rawStats?.max > 0) {
          logZMin = Math.floor(Math.log10(rawStats.min));
          logZMax = Math.ceil(Math.log10(rawStats.max));
          if (logZMin === logZMax) { logZMin -= 1; logZMax += 1; }
          const tickvals = [], ticktext = [];
          for (let e = logZMin; e <= logZMax; e++) { tickvals.push(e); ticktext.push(`10^${e}`); }
          logColorbarExtra = { tickvals, ticktext };
        }
      }
    }

    // ── Customdata + hover template ───────────────────────────────────────
    const traceCustomdata = logApplied
      ? data   // valeurs originales pour hover
      : (showDetailedTooltip ? computeHeatmapCustomData(data, latitudes, longitudes) : undefined);

    const hoverTemplate = logApplied
      ? `${t('viz.hover_lon')}: %{x}\u00b0<br>${t('viz.hover_lat')}: %{y}\u00b0<br>${t('viz.hover_value')}: %{customdata:.6g} ${unit}${interpSuffix}<br>log\u2081\u2080 = %{z:.3f}<extra></extra>`
      : showDetailedTooltip
        ? `${t('viz.hover_lon')}: %{x}\u00b0  ${t('viz.hover_lat')}: %{y}\u00b0<br><b>%{z:.6g} ${unit}${interpSuffix}</b><br>\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500<br>` +
          `${t('viz.hover_zonal_anom')}: %{customdata[0]:+.6g}<br>` +
          `\u2202/\u2202lat: %{customdata[1]:.2e} /\u00b0<br>` +
          `\u2202/\u2202lon: %{customdata[2]:.2e} /\u00b0<br>` +
          `${t('viz.hover_percentile')}: %{customdata[3]:.0f}%<br>` +
          `${t('viz.hover_poi')}: %{customdata[4]} (%{customdata[5]} km)<extra></extra>`
        : `${t('viz.hover_lon')}: %{x}\u00b0<br>${t('viz.hover_lat')}: %{y}\u00b0<br>${t('viz.hover_value')}: %{z:.6g} ${unit}${interpSuffix}<extra></extra>`;

    const traces = [{
      type: 'heatmap',
      x: longitudes,
      y: latitudes,
      z: displayData,
      colorscale: finalColorscale,
      reversescale: finalReverse,
      ...(logApplied
        ? (logZMin != null ? { zmin: logZMin, zmax: logZMax } : {})
        : { ...(customZMin != null ? { zmin: customZMin } : {}), ...(customZMax != null ? { zmax: customZMax } : {}) }),
      zsmooth: smooth ? 'best' : false,
      connectgaps: true,
      opacity: showSurface ? 0.55 : 1,
      ...(grid.text ? { text: grid.text } : {}),
      ...(traceCustomdata ? { customdata: traceCustomdata } : {}),
      showscale: !compact,
      colorbar: {
        title: {
          text: logApplied ? `log\u2081\u2080(${variableLabel})` : `${variableLabel} (${unit})`,
          side: 'right',
          font: { color: fontColor },
        },
        thickness: 15,
        len: 0.9,
        outlinewidth: 0,
        tickfont: { size: 11, color: fontColor },
        ...logColorbarExtra,
      },
      hovertemplate: hoverTemplate,
    }];

    if (showLocations) traces.push(buildLocationTrace(longitudes));

    // ---- Relief : altitude barometrique depuis la pression de surface ----
    // z = −H·ln(P0/P_ref) avec H ≈ 10,8 km et P_ref = 610 Pa (datum martien).
    // Proxy topographique au premier ordre : Olympus ≈ +20 km, Hellas ≈ −7 km.
    // Ancre la lecture geographique sans aucune donnee externe.
    if (topoData?.data) {
      const SCALE_HEIGHT_KM = 10.8;
      const P_REF = 610; // Pa
      traces.push({
        type: 'contour',
        x: topoData.longitudes,
        y: topoData.latitudes,
        z: topoData.data.map(row => row.map(v => (v != null && v > 0
          ? -SCALE_HEIGHT_KM * Math.log(v / P_REF)
          : null))),
        contours: { coloring: 'none', showlabels: false },
        line: { color: 'rgba(160, 160, 160, 0.55)', width: 1 },
        ncontours: 10,
        showscale: false,
        hoverinfo: 'skip',
        showlegend: false,
      });
    }

    // ---- Vecteurs de vent (quiver) ----
    // Les fleches s'effacent quand les particules animees sont actives
    // (WindParticlesLayer rend le meme champ, en plus lisible).
    // Les segments sont remplis plus bas, une fois le layout fige : leur trace
    // depend de la geometrie de la zone de trace, cf. utils/windQuiver.js.
    let windTraceIndex = -1;
    if (windData && !windParticles && windData.lats && windData.lats.length > 0) {
      windTraceIndex = traces.length;
      traces.push({
        type: 'scatter',
        x: [],
        y: [],
        mode: 'lines',
        line: { color: fontColor, width: 1.2 },
        // 'skip' (et non 'none') pour laisser le survol atteindre la heatmap dessous.
        hoverinfo: 'skip',
        showlegend: false,
        // Le champ brut voyage avec la trace : l'export d'image reconstruit les
        // fleches pour la geometrie de la figure exportee (cf. plotExport.js).
        meta: { quiver: windData },
      });
    }

    const dataIs0to360 = longitudes.some(l => l > 180);
    const fullLayout = {
      title: { text: titleText ?? `${datasetLabel || ''} — ${variableLabel} — ${formatTime(timeIndex)} — ${altitudeText}`, font: { size: titleSize, color: fontColor } },
      font: { color: fontColor },
      xaxis: {
        title: { text: t('viz.longitude') },
        range: [lonMin, lonMax],
        showgrid: false,
        zeroline: false,
        autorange: false,
        color: fontColor
      },
      yaxis: {
        title: { text: t('viz.latitude') },
        range: [latMin, latMax],
        showgrid: false,
        zeroline: false,
        autorange: false,
        color: fontColor
      },
      margin: { ...responsiveMargin, r: 120 },
      paper_bgcolor: paperBg,
      plot_bgcolor: plotBg
    };
    const layout = compact ? compactLayout(fullLayout) : fullLayout;

    if (showSurface) {
      layout.images = [{
        source: '/mars-surface.jpg',
        xref: 'x',
        yref: 'y',
        x: dataIs0to360 ? 0 : -180,
        y: 90,
        sizex: 360,
        sizey: 180,
        sizing: 'stretch',
        opacity: 0.9,
        layer: 'below'
      }];
    }

    /**
     * Geometrie courante de la zone de trace.
     *
     * `_fullLayout._size` fait foi des que Plotly a calcule sa mise en page :
     * il tient compte de l'automargin, c'est-a-dire de la place que Plotly
     * reprend de lui-meme quand la colorbar ou les etiquettes d'axes ne
     * tiennent pas dans les marges demandees. La soustraction des marges ne
     * sert donc qu'au tout premier rendu, avant que ce calcul existe.
     * Meme source que WindParticlesLayer, qui suit deja les memes axes.
     */
    const currentGeometry = () => {
      const fl = el._fullLayout;
      return {
        size: fl?._size ?? plotAreaSize(el, layout.margin),
        xRange: fl?.xaxis?.range ?? layout.xaxis.range,
        yRange: fl?.yaxis?.range ?? layout.yaxis.range,
      };
    };

    /** Empreinte de cette geometrie, pour ne retracer que si elle a change. */
    const geometryKey = () => {
      const { size, xRange, yRange } = currentGeometry();
      return size ? `${size.w}x${size.h}|${xRange}|${yRange}` : '';
    };

    /** Recalcule les fleches pour la geometrie courante. */
    const buildWind = () => {
      const { size, xRange, yRange } = currentGeometry();
      return buildQuiverSegments(windData, quiverScales(size, xRange, yRange));
    };

    if (windTraceIndex >= 0) {
      const segments = buildWind();
      traces[windTraceIndex].x = segments.x;
      traces[windTraceIndex].y = segments.y;
    }

    const rendered = renderPlot(el, traces, layout, {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d']
    });

    if (windTraceIndex < 0) return undefined;

    // Zoom, pan et redimensionnement changent l'echelle degres/pixel : sans
    // ce rafraichissement les fleches reprendraient un angle faux des que la
    // forme du cadre change. Seule la trace des fleches est retracee.
    let disposed = false;
    let running = false;
    let timer = 0;
    /** Signature de la geometrie ayant servi au dernier trace des fleches. */
    let lastGeometry = geometryKey();

    const refreshWind = () => {
      if (disposed || running || !el._fullLayout) return;
      const key = geometryKey();
      if (!key || key === lastGeometry) return;   // rien n'a bouge
      running = true;
      lastGeometry = key;
      const segments = buildWind();
      Promise.resolve(Plotly.restyle(el, { x: [segments.x], y: [segments.y] }, [windTraceIndex]))
        .catch(() => {})
        .finally(() => {
          running = false;
          // La geometrie a pu changer pendant le retrace : on relance jusqu'a
          // convergence plutot que de perdre l'evenement.
          if (!disposed && geometryKey() !== lastGeometry) scheduleRefresh();
        });
    };

    /**
     * Rafraichissement differe. Un changement de largeur de fenetre traverse
     * plusieurs etats intermediaires (repliement de la barre laterale, calcul
     * de mise en page) : sans ce delai, les fleches se figeaient sur une
     * largeur transitoire et gardaient un angle faux une fois la page stabilisee.
     */
    const scheduleRefresh = () => {
      if (disposed) return;
      clearTimeout(timer);
      timer = setTimeout(refreshWind, 150);
    };

    const ro = new ResizeObserver(scheduleRefresh);
    ro.observe(el);

    // `.on` n'existe qu'une fois le graphe cree : au tout premier rendu il faut
    // attendre la promesse. Garde identique aux autres couches (DrillDownMenu,
    // ProbeLayer) : entre un purge et la re-initialisation, `el` existe sans `.on`.
    Promise.resolve(rendered).then(() => {
      if (disposed) return;
      if (typeof el.on === 'function') el.on('plotly_relayout', scheduleRefresh);
      // Le rendu lui-meme a pu deplacer la zone de trace (automargin) sans
      // qu'aucun evenement ne le signale : on verifie une fois de plus.
      scheduleRefresh();
    }).catch(() => {});

    return () => {
      disposed = true;
      clearTimeout(timer);
      ro.disconnect();
      // removeListener et non removeAllListeners : d'autres couches (synchro
      // du zoom de l'Explorateur) ecoutent le meme evenement sur ce div.
      if (typeof el.removeListener === 'function') el.removeListener('plotly_relayout', scheduleRefresh);
    };
  }, [sliceData, variableCode, datasetLabel, showLocations, showSurface, colorscaleName, reverseColorscale, customZMin, customZMax, showDetailedTooltip, windData, windParticles, topoData, titleText, logScale, smooth, interpStep, compact, i18n.language, fontColor, paperBg, plotBg, titleSize, responsiveMargin, plotRef]);

  if (!sliceData) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          {t('viz.slice.empty')}
        </Typography>
      </Paper>
    );
  }

  const { stats } = sliceData;
  const exportFilename = `mars_slice_${variableCode || 'plot'}`;

  // Legende d'integrite scientifique : resolution native vs affichage interpole,
  // et echelle des vecteurs de vent (normalises sur la vitesse max de la slice).
  const stepNative = nativeStep(sliceData.latitudes);
  const interpApplied = !!(interpStep && stepNative && Math.round(stepNative / interpStep) > 1);
  const windStats = windSpeedStats(windData);

  return (
    <Box>
      {!noExportMenu && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
          <ExportMenu plotRef={plotRef} filename={exportFilename} onCSV={onExportCSV} />
        </Box>
      )}
      <Paper elevation={compact ? 0 : 2} sx={{ borderRadius: 2, overflow: 'hidden', position: 'relative', ...(compact ? { bgcolor: 'transparent', backgroundImage: 'none' } : {}) }}>
        <div ref={plotRef} role="img" aria-label={t('viz.aria.slice')} style={{ width: '100%', height: compact ? 300 : 450 }} />
        <WindParticlesLayer plotRef={plotRef} windData={windData} enabled={windParticles && !!windData} compact={compact} />
      </Paper>
      {((!compact && (interpApplied || topoData?.data)) || windStats) && (
        <Box sx={{ mt: 0.5, px: 0.5, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          {!compact && interpApplied && (
            <Typography variant="caption" color="text.secondary">
              {t('viz.gridCaption', {
                step: Number(stepNative.toFixed(1)),
                nlat: sliceData.latitudes.length,
                nlon: sliceData.longitudes.length,
                target: interpStep,
              })}
            </Typography>
          )}
          {/* Les legendes de vent restent affichees en mode compact : elles sont
              la seule lecture chiffree du champ, et elles disparaissaient
              entierement des que la vue passait dans la grille d'Explorer. */}
          {windStats && !windParticles && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {t('viz.windScale', { speed: windStats.max.toFixed(0) })}
            </Typography>
          )}
          {windStats && windParticles && (
            <WindSpeedLegend stats={windStats} compact={compact} />
          )}
          {!compact && topoData?.data && (
            <Typography variant="caption" color="text.secondary">
              {t('viz.topoCaption')}
            </Typography>
          )}
        </Box>
      )}
      {!compact && <StatsBar stats={stats} />}
    </Box>
  );
}

export default SliceViewer;
