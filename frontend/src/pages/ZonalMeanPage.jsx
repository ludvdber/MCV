import { useState, useCallback, useMemo } from 'react';
import {
  Container, Paper, Typography, Button, CircularProgress,
  Alert, Box, Chip, LinearProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { Functions as LogIcon } from '@mui/icons-material';
import { getZonalMean, exportZonalMeanCSV } from '../services/api';
import DatasetSelector from '../components/DatasetSelector';
import VariableSelector from '../components/VariableSelector';
import TimeSelector from '../components/TimeSelector';
import ZonalMeanViewer from '../components/ZonalMeanViewer';
import ExportMenu from '../components/ExportMenu';
import VisuToggle from '../components/VisuToggle';
import PermalienButton from '../components/PermalienButton';
import ColorscaleSelector from '../components/ColorscaleSelector';
import ChartSkeleton from '../components/ChartSkeleton';
import FullscreenButton from '../components/FullscreenButton';
import PageLoader from '../components/PageLoader';
import { useTranslation } from 'react-i18next';
import { useMars } from '../context/MarsContext';
import { triggerApiDownload } from '../utils/exportUtils';
import { intParam } from '../utils/urlParams';
import { useResolvedColorscale } from '../hooks/useResolvedColorscale';
import { useVisualizationPage } from '../hooks/useVisualizationPage';
import { isSurfaceVariable as checkIsSurface } from '../utils/variableUtils';
import ChartOrTable from '../components/ChartOrTable';
import ViewExplainer from '../components/ViewExplainer';
import { grid2DToTable } from '../utils/dataToTable';

function ZonalMeanPage() {
  const {
    datasets,
    selectedDataset, setSelectedDataset,
    selectedVariable, handleVariableChange,
    selectedTime, setSelectedTime,
    dataset, datasetLabel,
  } = useMars();
  const { t } = useTranslation();

  const [colorscale, setColorscale] = useState('auto');
  const [logScale, setLogScale] = useState(false);

  const isSurfaceVariable = checkIsSurface(selectedVariable);

  const {
    data: zmData, loading, error, isDirty, markDirty,
    viewerContainerRef, exportPlotRef, linkCopied,
    handleLaunch, handleCopyLink, catalogLoading,
  } = useVisualizationPage({
    route: '/zonalmean',
    restoreUrl: (sp) => {
      const ds = sp.get('ds');
      if (!ds) return false;
      setSelectedDataset(ds);
      const v = sp.get('var'); if (v) handleVariableChange(v);
      const ti = intParam(sp, 't'); if (ti != null) setSelectedTime(ti);
      const cs = sp.get('cs'); if (cs) setColorscale(cs);
      return true;
    },
    fetchData: useCallback(() =>
      getZonalMean({ dataset: selectedDataset, variable: selectedVariable, time: selectedTime }),
    [selectedDataset, selectedVariable, selectedTime]),
    buildPermalink: useCallback(() => {
      const p = new URLSearchParams();
      if (selectedDataset) p.set('ds', selectedDataset);
      if (selectedVariable) p.set('var', selectedVariable);
      p.set('t', String(selectedTime));
      if (colorscale !== 'auto') p.set('cs', colorscale);
      return `${window.location.origin}/zonalmean?${p.toString()}`;
    }, [selectedDataset, selectedVariable, selectedTime, colorscale]),
    buildHistoryEntry: useCallback(() => ({
      page: '/zonalmean', dataset: selectedDataset, variable: selectedVariable,
      params: { time: selectedTime },
      label: `${t('nav.zonalmean')} ${selectedVariable}`,
    }), [selectedDataset, selectedVariable, selectedTime, t]),
    canLaunch: useCallback(() => !!selectedDataset && !!selectedVariable && !isSurfaceVariable, [selectedDataset, selectedVariable, isSurfaceVariable]),
  });

  const resolvedColorscale = useResolvedColorscale(colorscale, zmData?.variable, selectedVariable);

  const handleExportCSV = () => {
    triggerApiDownload(
      exportZonalMeanCSV({ dataset: selectedDataset, variable: selectedVariable, time: selectedTime }),
      `mars_zonalmean_${selectedVariable || 'plot'}.csv`,
    );
  };

  const tableData = useMemo(() =>
    zmData ? grid2DToTable(zmData.data, zmData.altitudes, zmData.latitudes, 'Altitude (km)', 'Latitude (\u00b0)', selectedVariable) : null,
  [zmData, selectedVariable]);

  if (catalogLoading) return <PageLoader />;

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      <Typography variant="h5" gutterBottom>{t('page.zonalmean.title')}</Typography>

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
          <Grid size={{ xs: 12, md: 6 }}>
            <TimeSelector value={selectedTime}
              onChange={v => { setSelectedTime(v); markDirty(); }} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ColorscaleSelector value={colorscale}
              onChange={setColorscale} />
          </Grid>
        </Grid>

        {isSurfaceVariable && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {t('page.zonalmean.surfaceAlert')}
          </Alert>
        )}

        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={handleLaunch}
            disabled={!selectedDataset || !selectedVariable || loading || isSurfaceVariable}>
            {loading ? <CircularProgress size={20} color="inherit" /> : t('page.zonalmean.button')}
          </Button>
          {zmData && (
            <VisuToggle value={logScale} onChange={setLogScale} icon={<LogIcon />} title={t('common.toggleLog')}>{'Log\u2081\u2080'}</VisuToggle>
          )}
          {isDirty && (
            <Chip label={t('page.zonalmean.dirty')} color="warning" size="small" />
          )}
        </Box>

      </Paper>

      {loading && <LinearProgress color="primary" sx={{ mb: 2, borderRadius: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && !zmData && <ChartSkeleton variant="heatmap" />}

      <ChartOrTable tableData={tableData}>
        {(showTable, TableButton) => (
          <>
            {zmData && (
              <Box sx={{ mb: 1, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <PermalienButton onClick={handleCopyLink} copied={linkCopied} />
                <ExportMenu
                  plotRef={exportPlotRef}
                  filename={`mars_zonalmean_${selectedVariable || 'plot'}`}
                  onCSV={handleExportCSV}
                />
                <TableButton />
                <FullscreenButton containerRef={viewerContainerRef} />
              </Box>
            )}
            {!showTable && (
              <Box ref={viewerContainerRef} sx={{ position: 'relative' }}>
                <ZonalMeanViewer
                  zonalMeanData={zmData}
                  variableCode={selectedVariable}
                  datasetLabel={datasetLabel}
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
      <ViewExplainer id="zonalmean" />
    </Container>
  );
}

export default ZonalMeanPage;
