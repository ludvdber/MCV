import { useState, useCallback, useMemo } from 'react';
import {
  Container, Paper, Typography, Button, CircularProgress,
  Alert, Box, Chip, LinearProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { getDifference, exportDifferenceCSV } from '../services/api';
import DatasetSelector from '../components/DatasetSelector';
import VariableSelector from '../components/VariableSelector';
import TimeSelector from '../components/TimeSelector';
import AltitudeSelector from '../components/AltitudeSelector';
import DifferenceViewer from '../components/DifferenceViewer';
import ColorscaleSelector from '../components/ColorscaleSelector';
import VisuToggle from '../components/VisuToggle';
import ExportMenu from '../components/ExportMenu';
import PermalienButton from '../components/PermalienButton';
import ChartSkeleton from '../components/ChartSkeleton';
import FullscreenButton from '../components/FullscreenButton';
import PageLoader from '../components/PageLoader';
import LocationsLegend from '../components/LocationsLegend';
import { Functions as LogIcon, Place as PlaceIcon, Map as MapIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useMars } from '../context/MarsContext';
import { triggerApiDownload } from '../utils/exportUtils';
import { useResolvedColorscale } from '../hooks/useResolvedColorscale';
import { useVisualizationPage } from '../hooks/useVisualizationPage';
import ChartOrTable from '../components/ChartOrTable';
import { gridToTable } from '../utils/dataToTable';

function DifferencePage() {
  const {
    datasets,
    selectedDataset, setSelectedDataset,
    selectedVariable, handleVariableChange,
    selectedTime, setSelectedTime,
    selectedAltitude, setSelectedAltitude,
    dataset, datasetLabel,
  } = useMars();
  const { t } = useTranslation();

  const [datasetB, setDatasetB] = useState('');

  // Compute readable label for dataset B
  const datasetBObj = datasets.find(d => d.id === datasetB);
  const datasetBLabel = datasetBObj
    ? t('selector.dataset.format', { my: datasetBObj.marsYear, lsStart: datasetBObj.lsStart, lsEnd: datasetBObj.lsEnd })
    : datasetB;
  const [colorscale, setColorscale] = useState('auto');
  const [logScale, setLogScale] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const [showSurface, setShowSurface] = useState(false);

  const {
    data: diffData, loading, error, isDirty, markDirty,
    viewerContainerRef, exportPlotRef, linkCopied,
    handleLaunch, handleCopyLink, catalogLoading,
  } = useVisualizationPage({
    route: '/difference',
    restoreUrl: (sp) => {
      const dsA = sp.get('dsA');
      if (!dsA) return false;
      setSelectedDataset(dsA);
      const dsB = sp.get('dsB'); if (dsB) setDatasetB(dsB);
      const v = sp.get('var'); if (v) handleVariableChange(v);
      const time = sp.get('t'); if (time != null) setSelectedTime(parseInt(time, 10));
      const alt = sp.get('alt'); if (alt != null) setSelectedAltitude(parseInt(alt, 10));
      return true;
    },
    fetchData: useCallback(() =>
      getDifference({
        datasetA: selectedDataset, datasetB: datasetB,
        variable: selectedVariable, time: selectedTime, altitude: selectedAltitude,
      }),
    [selectedDataset, datasetB, selectedVariable, selectedTime, selectedAltitude]),
    buildPermalink: useCallback(() => {
      const p = new URLSearchParams();
      if (selectedDataset) p.set('dsA', selectedDataset);
      if (datasetB) p.set('dsB', datasetB);
      if (selectedVariable) p.set('var', selectedVariable);
      p.set('t', String(selectedTime));
      p.set('alt', String(selectedAltitude));
      return `${window.location.origin}/difference?${p.toString()}`;
    }, [selectedDataset, datasetB, selectedVariable, selectedTime, selectedAltitude]),
    buildHistoryEntry: useCallback(() => ({
      page: '/difference', dataset: selectedDataset, variable: selectedVariable,
      params: { datasetB, time: selectedTime, altitude: selectedAltitude },
      label: `\u0394 ${selectedVariable} A\u2212B`,
    }), [selectedDataset, datasetB, selectedVariable, selectedTime, selectedAltitude]),
    canLaunch: useCallback(() => !!selectedDataset && !!datasetB && !!selectedVariable && selectedDataset !== datasetB,
      [selectedDataset, datasetB, selectedVariable]),
  });

  const resolvedColorscale = useResolvedColorscale(colorscale, diffData?.variable, selectedVariable);

  const handleExportCSV = () => {
    triggerApiDownload(
      exportDifferenceCSV({
        datasetA: selectedDataset, datasetB: datasetB,
        variable: selectedVariable, time: selectedTime, altitude: selectedAltitude,
      }),
      `mars_diff_${selectedVariable || 'plot'}.csv`,
    );
  };

  const tableData = useMemo(() =>
    diffData ? gridToTable(diffData.data, diffData.latitudes, diffData.longitudes, '\u0394 ' + selectedVariable) : null,
  [diffData, selectedVariable]);

  if (catalogLoading) return <PageLoader />;

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      <Typography variant="h5" gutterBottom>{t('page.difference.title')}</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              {t('page.difference.datasetA')}
            </Typography>
            <DatasetSelector datasets={datasets} value={selectedDataset}
              onChange={v => { setSelectedDataset(v); markDirty(); }} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              {t('page.difference.datasetB')}
            </Typography>
            <DatasetSelector datasets={datasets} value={datasetB}
              onChange={v => { setDatasetB(v); markDirty(); }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <VariableSelector value={selectedVariable}
              onChange={v => { handleVariableChange(v); markDirty(); }}
              availableVariables={dataset?.variables} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TimeSelector value={selectedTime}
              onChange={v => { setSelectedTime(v); markDirty(); }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <AltitudeSelector value={selectedAltitude}
              onChange={v => { setSelectedAltitude(v); markDirty(); }}
              variableCode={selectedVariable} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <ColorscaleSelector value={colorscale} onChange={setColorscale} />
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={handleLaunch}
            disabled={!selectedDataset || !datasetB || !selectedVariable || loading || selectedDataset === datasetB}>
            {loading ? <CircularProgress size={20} color="inherit" /> : t('page.difference.button')}
          </Button>
          {selectedDataset && datasetB && selectedDataset === datasetB && (
            <Alert severity="info" sx={{ py: 0, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
              {t('page.difference.sameDataset')}
            </Alert>
          )}
          {diffData && (
            <>
              <VisuToggle value={showLocations} onChange={setShowLocations} icon={<PlaceIcon />}>{t('common.toggleLocations')}</VisuToggle>
              <VisuToggle value={showSurface} onChange={setShowSurface} icon={<MapIcon />}>{t('common.toggleSurface')}</VisuToggle>
              <VisuToggle value={logScale} onChange={setLogScale} icon={<LogIcon />} title={t('common.toggleLog')}>{'Log\u2081\u2080'}</VisuToggle>
            </>
          )}
          {isDirty && (
            <Chip label={t('page.difference.dirty')} color="warning" size="small" />
          )}
        </Box>

        <LocationsLegend visible={showLocations && !!diffData} />

      </Paper>

      {loading && <LinearProgress color="primary" sx={{ mb: 2, borderRadius: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && !diffData && <ChartSkeleton variant="heatmap" />}

      <ChartOrTable tableData={tableData}>
        {(showTable, TableButton) => (
          <>
            {diffData && (
              <Box sx={{ mb: 1, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <PermalienButton onClick={handleCopyLink} copied={linkCopied} />
                <ExportMenu
                  plotRef={exportPlotRef}
                  filename={`mars_diff_${selectedVariable || 'plot'}`}
                  onCSV={handleExportCSV}
                />
                <TableButton />
                <FullscreenButton containerRef={viewerContainerRef} />
              </Box>
            )}
            {!showTable && (
              <Box ref={viewerContainerRef} sx={{ position: 'relative' }}>
                <DifferenceViewer
                  differenceData={diffData}
                  variableCode={selectedVariable}
                  datasetLabelA={datasetLabel}
                  datasetLabelB={datasetBLabel}
                  colorscaleName={resolvedColorscale.name}
                  reverseColorscale={resolvedColorscale.reverse}
                  logScale={logScale}
                  showLocations={showLocations}
                  showSurface={showSurface}
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

export default DifferencePage;
