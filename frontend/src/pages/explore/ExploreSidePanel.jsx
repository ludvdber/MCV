/**
 * Panneau lateral droit de la console Explorer (design « Flux »).
 *
 * Quatre sections :
 *   OUTILS — toggles contextuels de l'onglet actif (ExploreTools, ex-rail).
 *   SONDE LIEE — lectures en direct du probeBus : la position survolee sur
 *     n'importe quelle carte et la valeur de CHAQUE vue affichee a ce point,
 *     plus le lieu martien connu le plus proche.
 *   REGION — statistiques du rectangle trace sur la carte active : n, min,
 *     max, moyenne, moyenne ponderee cos(lat), ecart-type.
 *   SCENARIOS — presets scientifiques ancres sur le catalogue, executes par
 *     le meme runner deterministe que la barre ⌘K.
 */
import { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Tooltip, IconButton } from '@mui/material';
import { HelpOutlined as HelpIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import MethodologyDialog from '../../components/MethodologyDialog';
import { VARIABLES_MAP } from '../../components/VariableSelector';
import { MARS_LOCATIONS } from '../../data/marsLocations';
import { subscribeProbe, currentProbe } from './probeBus.js';
import { nearestValue } from './exploreUtils.js';
import { useExploreState } from './ExploreContext.jsx';
import { LATLON_HEATMAP_TYPES } from './exploreConstants.jsx';
import { useResolvedScenarios, useScenarioRunner } from './scenarios.jsx';
import CommandBar from './CommandBar.jsx';
import RegionHistogram from './RegionHistogram.jsx';
import ExploreTools from './ExploreTools.jsx';

const PROBE_TYPES = [...LATLON_HEATMAP_TYPES, 'difference'];

const fmtVal = (v) => (Math.abs(v) >= 100 ? v.toFixed(1) : v.toPrecision(4));
const fmtDeg = (v) => (Math.round(v * 10) / 10).toFixed(1);

/** Lieu martien connu le plus proche (distance en degres, cos-lat sur la longitude). */
function nearestLocation(lat, lon) {
  let best = null, bd = Infinity;
  for (const loc of MARS_LOCATIONS) {
    let dLon = Math.abs(loc.lon - lon);
    if (dLon > 180) dLon = 360 - dLon;
    const d = (loc.lat - lat) ** 2 + (dLon * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bd) { bd = d; best = loc; }
  }
  return best;
}

export default function ExploreSidePanel({ onDeriveAmplitude, onDeriveWindSpeed }) {
  const { t } = useTranslation();
  const state = useExploreState();
  const runScenario = useScenarioRunner();
  // Exemples reellement jouables avec le catalogue charge (l'IASB peut deployer
  // un sous-ensemble : un exemple sans fichier correspondant est masque).
  const scenarios = useResolvedScenarios();
  const { resultsById, gridIds, activeResult, layout, roiMode, roiEntry } = state;
  const [methodsOpen, setMethodsOpen] = useState(false);

  /* ── Sonde liee : position publiee par les cartes ─────────────────────── */
  const [probe, setProbe] = useState(() => currentProbe ?? null);
  useEffect(() => {
    let raf = 0;
    const unsubscribe = subscribeProbe((p) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setProbe(p ?? null));
    });
    return () => { cancelAnimationFrame(raf); unsubscribe(); };
  }, []);

  /** Vues lisibles par la sonde parmi celles affichees. */
  const probeRows = useMemo(() => {
    const ids = layout === 1 ? (activeResult ? [activeResult] : []) : gridIds;
    return ids
      .map(id => resultsById[id])
      .filter(r => r && PROBE_TYPES.includes(r.type) && r.type !== 'animation' && r.data)
      .map(r => {
        const varCode = r.params?.variable ?? '';
        const altKm = r.data?.altitudeValue;
        return {
          id: r.id,
          label: `${r.type === 'difference' ? 'Δ ' : ''}${varCode}${altKm != null ? ` · ${Number(altKm).toFixed(0)} km` : ''}`,
          unit: VARIABLES_MAP.get(varCode)?.unit || '',
          value: probe ? nearestValue(r.data, probe.lat, probe.lon) : null,
        };
      });
  }, [layout, activeResult, gridIds, resultsById, probe]);

  const poi = probe ? nearestLocation(probe.lat, probe.lon) : null;

  /* ── Region : stats du rectangle sur la carte active ──────────────────── */
  const roiStats = roiEntry?.resultId === activeResult ? roiEntry.stats : null;
  const roiUnit = VARIABLES_MAP.get(resultsById[activeResult]?.params?.variable)?.unit || '';

  return (
    <Box className="mcv-inspector" component="aside" data-tour="side-panel" aria-label={t('explore.panel.probe')}>
      {/* ── Méthodes & conventions scientifiques (référence pour citer/reproduire) ── */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
        <Tooltip title={t('method.title')} placement="left" arrow>
          <IconButton
            size="small"
            onClick={() => setMethodsOpen(true)}
            aria-label={t('method.title')}
            sx={{ color: 'var(--text-secondary)', '&:hover': { color: 'var(--mars-orange)' } }}
          >
            <HelpIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <MethodologyDialog open={methodsOpen} onClose={() => setMethodsOpen(false)} />

      {/* ── Outils contextuels de l'onglet actif ── */}
      <ExploreTools onDeriveAmplitude={onDeriveAmplitude} onDeriveWindSpeed={onDeriveWindSpeed} />

      {/* ── Sonde liee ── */}
      <Typography className="mcv-ins-h" component="h3">{t('explore.panel.probe')}</Typography>
      <Box className="mcv-coord">
        {probe ? (
          <>
            {fmtDeg(Math.abs(probe.lat))}°{t(probe.lat >= 0 ? 'viz.compass.n' : 'viz.compass.s')} · {fmtDeg(Math.abs(probe.lon))}°{t(probe.lon >= 0 ? 'viz.compass.e' : 'viz.compass.w')}
          </>
        ) : '—'}
        <small> {probe ? t('explore.panel.probeTag') : t('explore.panel.probeHint')}</small>
      </Box>
      <Box className="mcv-vals">
        {probeRows.length > 0 ? probeRows.map(row => (
          <Box key={row.id} className="mcv-val">
            <span className="k">{row.label}</span>
            <span className="v">
              {row.value != null ? fmtVal(row.value) : '—'}
              {row.value != null && row.unit && <em> {row.unit}</em>}
            </span>
          </Box>
        )) : (
          <Typography className="mcv-empty">{t('explore.panel.probeNone')}</Typography>
        )}
      </Box>
      {poi && probe && (
        <Box className="mcv-poi">{t('explore.panel.nearestPoi')} : {poi.name}</Box>
      )}

      {/* ── Region ── */}
      <Typography className="mcv-ins-h" component="h3">{t('explore.panel.region')}</Typography>
      {!roiMode ? (
        <Typography className="mcv-empty">{t('explore.panel.regionEnable')}</Typography>
      ) : roiStats ? (
        <>
          <Box className="mcv-val" sx={{ mb: 0.5 }}>
            <span className="k">{t('explore.roi.zone')}</span>
            <span className="v">{roiStats.latMin.toFixed(0)}°..{roiStats.latMax.toFixed(0)}° / {roiStats.lonMin.toFixed(0)}°..{roiStats.lonMax.toFixed(0)}°</span>
          </Box>
          <Box className="mcv-roi-grid">
            <Box className="mcv-val"><span className="k">n</span><span className="v">{roiStats.n}</span></Box>
            <Box className="mcv-val"><span className="k">σ</span><span className="v">{fmtVal(roiStats.stddev)}</span></Box>
            <Box className="mcv-val"><span className="k">{t('common.min')}</span><span className="v">{fmtVal(roiStats.min)}</span></Box>
            <Box className="mcv-val"><span className="k">{t('common.max')}</span><span className="v">{fmtVal(roiStats.max)}</span></Box>
            <Box className="mcv-val"><span className="k">{t('common.mean')}</span><span className="v">{fmtVal(roiStats.mean)}</span></Box>
            <Box className="mcv-val hot"><span className="k">{t('explore.roi.weightedMean')}</span><span className="v">{fmtVal(roiStats.weightedMean)}</span></Box>
          </Box>
          <RegionHistogram values={roiStats.values} />
          {roiUnit && <Typography className="mcv-empty" sx={{ mt: 0.5 }}>{roiUnit}</Typography>}
        </>
      ) : (
        <Typography className="mcv-empty">{t('explore.roi.hint')}</Typography>
      )}

      {/* ── Exemples ── */}
      <Typography className="mcv-ins-h" component="h3">{t('explore.panel.scenarios')}</Typography>
      <Typography className="mcv-empty" sx={{ mb: 0.5 }}>{t('explore.panel.scenariosHint')}</Typography>
      {scenarios.length === 0 ? (
        <Typography className="mcv-empty">{t('explore.panel.examplesEmpty')}</Typography>
      ) : (
        <Box className="mcv-presets" data-tour="examples">
          {scenarios.map(s => (
            <Tooltip key={s.key} title={t(`explore.scenario.${s.key}.desc`)} arrow placement="left" enterDelay={350}>
              <Box
                component="button"
                className="mcv-preset"
                onClick={() => runScenario(s.plan)}
              >
                <span className="ic">{s.icon}</span>
                {t(`explore.scenario.${s.key}`)}
              </Box>
            </Tooltip>
          ))}
        </Box>
      )}

      {/* ── Demander a MCV (⌘K) : declencheur en bas de colonne ── */}
      <Box className="mcv-cmdk-slot">
        <CommandBar inline />
      </Box>
    </Box>
  );
}
