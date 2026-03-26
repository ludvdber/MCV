import { useState, useCallback, useMemo } from 'react';
import {
  Container, Paper, Typography, Button, CircularProgress,
  Alert, Box, Chip, LinearProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { Place as PlaceIcon, Map as MapIcon, Functions as LogIcon } from '@mui/icons-material';
import { getAnimation } from '../services/api';
import DatasetSelector from '../components/DatasetSelector';
import VariableSelector from '../components/VariableSelector';
import AltitudeSelector from '../components/AltitudeSelector';
import AnimationPlayer from '../components/AnimationPlayer';
import ExportMenu from '../components/ExportMenu';
import VisuToggle from '../components/VisuToggle';
import PermalienButton from '../components/PermalienButton';
import ColorscaleSelector from '../components/ColorscaleSelector';
import LocationsLegend from '../components/LocationsLegend';
import ChartSkeleton from '../components/ChartSkeleton';
import FullscreenButton from '../components/FullscreenButton';
import PageLoader from '../components/PageLoader';
import { useTranslation } from 'react-i18next';
import { useMars } from '../context/MarsContext';
import { downloadAnimationCSV } from '../utils/exportUtils';
import { useResolvedColorscale } from '../hooks/useResolvedColorscale';
import { useVisualizationPage } from '../hooks/useVisualizationPage';
import { isSurfaceVariable } from '../utils/variableUtils';
import ChartOrTable from '../components/ChartOrTable';
import { animationToTable } from '../utils/dataToTable';

/**
 * Page d'animation (UC4).
 * Supporte les permaliens : ?ds=&var=&alt=&cs=
 */

function AnimationPage() {
  const {
    datasets,
    selectedDataset, setSelectedDataset,
    selectedVariable, handleVariableChange,
    selectedAltitude, setSelectedAltitude,
    dataset, datasetLabel,
  } = useMars();
  const { t } = useTranslation();

  const [showLocations, setShowLocations] = useState(false);
  const [showSurface, setShowSurface] = useState(false);
  const [logScale, setLogScale] = useState(false);
  const [colorscale, setColorscale] = useState('auto');

  const {
    data: animationData, loading, error, isDirty, markDirty,
    viewerContainerRef, exportPlotRef, linkCopied,
    handleLaunch, handleCopyLink, catalogLoading,
  } = useVisualizationPage({
    route: '/animation',
    restoreUrl: (sp) => {
      const ds = sp.get('ds');
      if (!ds) return false;
      setSelectedDataset(ds);
      const v = sp.get('var'); if (v) handleVariableChange(v);
      const alt = sp.get('alt'); if (alt != null) setSelectedAltitude(parseInt(alt, 10));
      const cs = sp.get('cs'); if (cs) setColorscale(cs);
      return true;
    },
    fetchData: useCallback(() => {
      const altitudeToSend = isSurfaceVariable(selectedVariable) ? 0 : selectedAltitude;
      return getAnimation({ dataset: selectedDataset, variable: selectedVariable, altitude: altitudeToSend });
    }, [selectedDataset, selectedVariable, selectedAltitude]),
    buildPermalink: useCallback(() => {
      const p = new URLSearchParams();
      if (selectedDataset) p.set('ds', selectedDataset);
      if (selectedVariable) p.set('var', selectedVariable);
      p.set('alt', String(selectedAltitude));
      if (colorscale !== 'auto') p.set('cs', colorscale);
      return `${window.location.origin}/animation?${p.toString()}`;
    }, [selectedDataset, selectedVariable, selectedAltitude, colorscale]),
    buildHistoryEntry: useCallback(() => {
      const altitudeToSend = isSurfaceVariable(selectedVariable) ? 0 : selectedAltitude;
      return {
        page: '/animation', dataset: selectedDataset, variable: selectedVariable,
        params: { altitude: altitudeToSend },
        label: `${selectedVariable} alt${altitudeToSend}`,
      };
    }, [selectedDataset, selectedVariable, selectedAltitude]),
    canLaunch: useCallback(() => !!selectedDataset && !!selectedVariable, [selectedDataset, selectedVariable]),
  });

  // Utilise la variable de la donnée affichée (pas du formulaire) pour éviter
  // que la palette change avant d'avoir cliqué sur "Charger".
  const resolvedColorscale = useResolvedColorscale(colorscale, animationData?.variable, selectedVariable);

  /** Export CSV client-side : stats par frame (min/max/mean sur lat×lon) */
  const handleExportCSV = () => {
    if (!animationData) return;
    downloadAnimationCSV(animationData.frames, selectedVariable, selectedAltitude);
  };

  const tableData = useMemo(() =>
    animationData?.frames?.length > 0 ? animationToTable(animationData.frames, animationData.latitudes, animationData.longitudes, selectedVariable) : null,
  [animationData, selectedVariable]);

  if (catalogLoading) return <PageLoader />;

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      <Typography variant="h5" gutterBottom>{t('page.animation.title')}</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <DatasetSelector datasets={datasets} value={selectedDataset}
              onChange={v => { setSelectedDataset(v); markDirty(); }} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <VariableSelector value={selectedVariable}
              onChange={v => { handleVariableChange(v); markDirty(); }}
              availableVariables={dataset?.variables} />
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <AltitudeSelector value={selectedAltitude}
              onChange={v => { setSelectedAltitude(v); markDirty(); }}
              variableCode={selectedVariable} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <ColorscaleSelector value={colorscale}
              onChange={setColorscale} />
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={handleLaunch}
            disabled={!selectedDataset || !selectedVariable || loading}>
            {loading ? <CircularProgress size={20} color="inherit" /> : t('page.animation.button')}
          </Button>
          {animationData && (
            <>
              <VisuToggle value={showLocations} onChange={setShowLocations} icon={<PlaceIcon />}>{t('common.toggleLocations')}</VisuToggle>
              <VisuToggle value={showSurface} onChange={setShowSurface} icon={<MapIcon />}>{t('common.toggleSurface')}</VisuToggle>
              <VisuToggle value={logScale} onChange={setLogScale} icon={<LogIcon />} title={t('common.toggleLog')}>{'Log\u2081\u2080'}</VisuToggle>
            </>
          )}
          {isDirty && (
            <Chip label={t('page.animation.dirty')} color="warning" size="small" />
          )}
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {t('page.animation.caption')}
        </Typography>

        <LocationsLegend visible={showLocations && !!animationData} />

      </Paper>

      {loading && <LinearProgress color="primary" sx={{ mb: 2, borderRadius: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && !animationData && <ChartSkeleton variant="heatmap" />}

      <ChartOrTable tableData={tableData}>
        {(showTable, TableButton) => (
          <>
            {animationData && (
              <Box sx={{ mb: 1, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <PermalienButton onClick={handleCopyLink} copied={linkCopied} />
                <ExportMenu
                  plotRef={exportPlotRef}
                  filename={`mars_animation_${selectedVariable || 'plot'}`}
                  onCSV={handleExportCSV}
                />
                <TableButton />
                <FullscreenButton containerRef={viewerContainerRef} />
              </Box>
            )}
            {!showTable && (
              <Box ref={viewerContainerRef} sx={{ position: 'relative' }}>
                <AnimationPlayer
                  animationData={animationData}
                  variableCode={selectedVariable}
                  datasetLabel={datasetLabel}
                  showLocations={showLocations}
                  showSurface={showSurface}
                  colorscaleName={resolvedColorscale.name}
                  reverseColorscale={resolvedColorscale.reverse}
                  logScale={logScale}
                  noExportMenu
                />
              </Box>
            )}
          </>
        )}
      </ChartOrTable>
    </Container>
  );
}

export default AnimationPage;
