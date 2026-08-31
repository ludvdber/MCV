/**
 * Rend le viewer d'UN resultat de l'Explorer (slice, animation, profil...).
 *
 * Extrait d'ExploreResultsPanel pour permettre la console multi-vues :
 * chaque cellule de la grille 1/2/4 rend un ExploreResultViewer independant.
 *
 * La palette resolue et la transformation anomalie sont calculees ICI, par
 * resultat (et non plus globalement sur l'onglet actif) : deux vues cote a
 * cote de variables differentes recoivent chacune leur palette auto correcte.
 *
 * Props :
 *   result           — objet resultat { id, type, params, data, datasetLabel }
 *   isActive         — ce resultat est l'onglet actif
 *   onActivePlotNode — callback (node|null) : publie le div Plotly du resultat
 *                      actif vers la ref d'export du panneau (PNG/SVG)
 *   windData         — champ de vent (fourni uniquement pour la slice active)
 */
import { useMemo, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { computeAnomalyZ } from '../../utils/heatmapAnalysis';
import { useResultColorscale } from './useResultColorscale.js';
import { useExploreState } from './ExploreContext.jsx';
import { useMars } from '../../context/MarsContext';
import { INDIVIDUAL_PREFIX } from '../../constants';
import { largeDataStore } from './largeDataStore.js';
import { setAnimationFrame, clearAnimationFrame } from './probeBus.js';
import SliceViewer from '../../components/SliceViewer';
import TimeSeriesChart from '../../components/TimeSeriesChart';
import AnimationPlayer from '../../components/AnimationPlayer';
import ProfileViewer from '../../components/ProfileViewer';
import CrossSectionViewer from '../../components/CrossSectionViewer';
import HovmollerViewer from '../../components/HovmollerViewer';
import ZonalMeanViewer from '../../components/ZonalMeanViewer';
import WindRoseViewer from '../../components/WindRoseViewer';
import DifferenceViewer from '../../components/DifferenceViewer';
import TemporalProfileViewer from '../../components/TemporalProfileViewer';
import TidesViewer from '../../components/TidesViewer';
import TransectViewer from '../../components/TransectViewer';

export default function ExploreResultViewer({ result, isActive = false, onActivePlotNode = null, windData = null, compact = false }) {
  const { t } = useTranslation();
  const { datasets } = useMars();
  const state = useExploreState();
  const {
    showLocations, showSurface, showDetailedTooltip, showAnomaly, showLog,
    showWindParticles, showTopo, topoData, smoothHeatmap, interpStep,
  } = state;

  const r = result;

  // R5 : pour le type animation les frames vivent dans largeDataStore.
  const rData = r.type === 'animation'
    ? (largeDataStore.get(r.id) ?? r.data)
    : r.data;

  /* Palette et plage de légende PROPRES à ce résultat : éditées via le panneau
   * quand ce résultat est actif (SET_RESULT_DISPLAY), elles ne touchent pas les
   * autres vues de la grille. Repli sur « auto » / plage automatique. */
  const rColorscale = r.colorscale ?? 'auto';
  const rZMinInput  = r.zMin ?? '';
  const rZMaxInput  = r.zMax ?? '';

  const resolvedColorscale = useResultColorscale(r, { showAnomaly, colorscale: rColorscale });

  /* Libellé du dataset recalculé à chaque rendu (et non figé à la langue du
   * fetch) : un changement de langue à chaud met à jour « Ls 0° à 30° » →
   * « Ls 0° tot 30° ». Le composant se re-rend sur changement de langue
   * (useTranslation), donc un simple calcul en ligne suffit — pas de useMemo à
   * garder synchronisé. INDIVIDUAL : le libellé stocké intègre le Ls réel du
   * fichier et ne dépend pas de la langue → conservé tel quel. */
  const dsId = r.params?.dataset;
  const dsMeta = dsId && !dsId.startsWith(INDIVIDUAL_PREFIX)
    ? datasets?.find(d => d.id === dsId)
    : null;
  const datasetLabel = dsMeta
    ? t('selector.dataset.format', { my: dsMeta.marsYear, lsStart: dsMeta.lsStart, lsEnd: dsMeta.lsEnd })
    : r.datasetLabel;

  /** Données slice (potentiellement transformées pour le mode anomalie) */
  const effectiveSliceData = useMemo(() => {
    if (r.type !== 'slice' || !rData) return null;
    if (!showAnomaly) return rData;
    const { data, latitudes } = rData;
    const { anomalyZ, maxAbsAnomaly } = computeAnomalyZ(data, latitudes);
    return { ...rData, data: anomalyZ, _anomalyRange: maxAbsAnomaly };
  }, [r, rData, showAnomaly]);

  const anomalyZRange = effectiveSliceData?._anomalyRange ?? null;
  const customZMin = rZMinInput !== '' ? parseFloat(rZMinInput) : null;
  const customZMax = rZMaxInput !== '' ? parseFloat(rZMaxInput) : null;

  /* Champ signé en mode auto (UU/VV/WW) : plage symétrique ±max autour de 0 afin
   * que la couleur neutre de la divergente tombe EXACTEMENT sur le zéro physique
   * (est/ouest, montée/descente). Ignoré si l'utilisateur a fixé une plage, ou
   * en mode anomalie (déjà symétrique). */
  const wantSymmetric = resolvedColorscale.diverging === true && !showAnomaly
    && customZMin === null && customZMax === null
    && rData?.stats?.min != null && rData?.stats?.max != null;
  const symM = wantSymmetric ? Math.max(Math.abs(rData.stats.min), Math.abs(rData.stats.max)) : null;
  const effZMin = symM != null ? -symM : customZMin;
  const effZMax = symM != null ? symM : customZMax;

  /* La ref passee au viewer doit garder une identite STABLE pendant toute la
   * vie de la cellule : chaque viewer purge son graphe quand sa ref change
   * (cleanup [plotRef]), et basculer la ref partagee <-> null au gre de
   * isActive detruisait le plot des cellules restees en grille. Chaque viewer
   * a donc sa propre ref, et le noeud du resultat actif est publie au panneau
   * via callback (la ref d'export appartient au panneau, pas a ce composant). */
  const localPlotRef = useRef(null);
  useEffect(() => {
    if (!isActive || !onActivePlotNode) return undefined;
    const node = localPlotRef.current;
    onActivePlotNode(node);
    return () => onActivePlotNode(null);
  }, [isActive, onActivePlotNode]);
  const plotRef = localPlotRef;

  /* Sonde liee : tient a jour la frame courante de CETTE animation dans le
     registre du probeBus (le lecteur ne connait pas l'id du resultat). */
  const handleFrameChange = useCallback((idx) => setAnimationFrame(r.id, idx), [r.id]);
  useEffect(() => {
    if (r.type !== 'animation') return undefined;
    return () => clearAnimationFrame(r.id);
  }, [r.id, r.type]);

  // Donnees absentes (ex. frames d'animation deja purgees du largeDataStore) :
  // ne rien rendre plutot que de laisser un viewer dereferencer null.
  if (!rData) return null;

  switch (r.type) {
    case 'slice':
      return <SliceViewer sliceData={effectiveSliceData} variableCode={r.params.variable} datasetLabel={datasetLabel} showLocations={showLocations} showSurface={showSurface && !showAnomaly} colorscaleName={resolvedColorscale.name} reverseColorscale={resolvedColorscale.reverse} customZMin={showAnomaly ? -(anomalyZRange || 1) : effZMin} customZMax={showAnomaly ? (anomalyZRange || 1) : effZMax} showDetailedTooltip={showDetailedTooltip} windData={windData} windParticles={showWindParticles} topoData={isActive && showTopo ? topoData : null} titleText={r.titleText ?? null} logScale={showLog} smooth={smoothHeatmap} interpStep={interpStep} externalPlotRef={plotRef} noExportMenu compact={compact} />;
    case 'timeseries':
      return <TimeSeriesChart timeSeriesData={rData} variableCode={r.params.variable} datasetLabel={datasetLabel} externalPlotRef={plotRef} noExportMenu compact={compact} />;
    case 'animation':
      return <AnimationPlayer animationData={rData} variableCode={r.params.variable} datasetLabel={datasetLabel} showLocations={showLocations} showSurface={showSurface} showDetailedTooltip={showDetailedTooltip} colorscaleName={resolvedColorscale.name} reverseColorscale={resolvedColorscale.reverse} customZMin={effZMin} customZMax={effZMax} logScale={showLog} smooth={smoothHeatmap} interpStep={interpStep} externalPlotRef={plotRef} noExportMenu compact={compact} onFrameChange={handleFrameChange} />;
    case 'profile':
      return <ProfileViewer profiles={Array.isArray(rData) ? rData : [rData]} variableCode={r.params.variable} datasetLabel={datasetLabel} externalPlotRef={plotRef} noExportMenu compact={compact} />;
    case 'crosssection':
      return <CrossSectionViewer crossSectionData={rData} variableCode={r.params.variable} datasetLabel={datasetLabel} colorscaleName={resolvedColorscale.name} reverseColorscale={resolvedColorscale.reverse} customZMin={effZMin} customZMax={effZMax} logScale={showLog} smooth={smoothHeatmap} externalPlotRef={plotRef} noExportMenu compact={compact} />;
    case 'hovmoller':
      return <HovmollerViewer hovmollerData={rData} variableCode={r.params.variable} datasetLabel={datasetLabel} colorscaleName={resolvedColorscale.name} reverseColorscale={resolvedColorscale.reverse} customZMin={effZMin} customZMax={effZMax} logScale={showLog} smooth={smoothHeatmap} externalPlotRef={plotRef} noExportMenu compact={compact} />;
    case 'zonalmean':
      return <ZonalMeanViewer zonalMeanData={rData} variableCode={r.params.variable} datasetLabel={datasetLabel} colorscaleName={resolvedColorscale.name} reverseColorscale={resolvedColorscale.reverse} customZMin={effZMin} customZMax={effZMax} logScale={showLog} externalPlotRef={plotRef} noExportMenu compact={compact} />;
    case 'windrose':
      return <WindRoseViewer windRoseData={rData} datasetLabel={datasetLabel} externalPlotRef={plotRef} noExportMenu compact={compact} />;
    case 'difference':
      return <DifferenceViewer differenceData={rData} variableCode={r.params.variable} smooth={smoothHeatmap} interpStep={interpStep} externalPlotRef={plotRef} noExportMenu compact={compact} />;
    case 'temporalprofile':
      return <TemporalProfileViewer profileData={rData} variableCode={r.params.variable} datasetLabel={datasetLabel} colorscaleName={resolvedColorscale.name} reverseColorscale={resolvedColorscale.reverse} customZMin={effZMin} customZMax={effZMax} logScale={showLog} smooth={smoothHeatmap} externalPlotRef={plotRef} noExportMenu compact={compact} />;
    case 'tides':
      return <TidesViewer tidesData={rData} variableCode={r.params.variable} datasetLabel={datasetLabel} externalPlotRef={plotRef} noExportMenu compact={compact} />;
    case 'transect':
      return <TransectViewer transectData={rData} variableCode={r.params.variable} datasetLabel={datasetLabel} colorscaleName={resolvedColorscale.name} reverseColorscale={resolvedColorscale.reverse} customZMin={effZMin} customZMax={effZMax} logScale={showLog} smooth={smoothHeatmap} externalPlotRef={plotRef} noExportMenu compact={compact} />;
    default:
      return null;
  }
}
