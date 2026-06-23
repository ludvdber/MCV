import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Container, Paper, Typography, Button, CircularProgress,
  Alert, Box, Chip, LinearProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { Place as PlaceIcon, Map as MapIcon, Functions as LogIcon, Air as WindIcon } from '@mui/icons-material';
import { getSlice, getWind, exportSliceCSV, exportSliceNetCDF } from '../services/api';
import DatasetSelector from '../components/DatasetSelector';
import VariableSelector from '../components/VariableSelector';
import TimeSelector from '../components/TimeSelector';
import AltitudeSelector from '../components/AltitudeSelector';
import SliceViewer from '../components/SliceViewer';
import ExportMenu from '../components/ExportMenu';
import VisuToggle from '../components/VisuToggle';
import PermalienButton from '../components/PermalienButton';
import ColorscaleSelector from '../components/ColorscaleSelector';
import LocationsLegend from '../components/LocationsLegend';
import ChartOrTable from '../components/ChartOrTable';
import ChartSkeleton from '../components/ChartSkeleton';
import FullscreenButton from '../components/FullscreenButton';
import PageLoader from '../components/PageLoader';
import { useTranslation } from 'react-i18next';
import { useMars } from '../context/MarsContext';
import { triggerApiDownload } from '../utils/exportUtils';
import { useResolvedColorscale } from '../hooks/useResolvedColorscale';
import { useVisualizationPage } from '../hooks/useVisualizationPage';
import { gridToTable } from '../utils/dataToTable';

function SlicePage() {
  const {
    datasets, selectedDataset, setSelectedDataset,
    selectedVariable, handleVariableChange,
    selectedTime, setSelectedTime,
    selectedAltitude, setSelectedAltitude,
    dataset, datasetLabel,
  } = useMars();
  const { t } = useTranslation();

  const [showLocations, setShowLocations] = useState(false);
  const [showSurface, setShowSurface] = useState(false);
  const [showWind, setShowWind] = useState(false);
  const [windData, setWindData] = useState(null);
  const [logScale, setLogScale] = useState(false);
  const [colorscale, setColorscale] = useState('auto');

  const {
    data: sliceData, loading, error, isDirty, markDirty,
    viewerContainerRef, exportPlotRef, linkCopied,
    handleLaunch, handleCopyLink, catalogLoading,
  } = useVisualizationPage({
    route: '/slice',
    restoreUrl: (sp) => {
      const ds = sp.get('ds');
      if (!ds) return false;
      setSelectedDataset(ds);
      const v = sp.get('var'); if (v) handleVariableChange(v);
      const ti = sp.get('t'); if (ti != null) setSelectedTime(parseInt(ti, 10));
      const alt = sp.get('alt'); if (alt != null) setSelectedAltitude(parseInt(alt, 10));
      const cs = sp.get('cs'); if (cs) setColorscale(cs);
      return true;
    },
    fetchData: useCallback(() =>
      getSlice({ dataset: selectedDataset, variable: selectedVariable, time: selectedTime, altitude: selectedAltitude }),
    [selectedDataset, selectedVariable, selectedTime, selectedAltitude]),
    buildPermalink: useCallback(() => {
      const p = new URLSearchParams();
      if (selectedDataset) p.set('ds', selectedDataset);
      if (selectedVariable) p.set('var', selectedVariable);
      p.set('t', String(selectedTime));
      p.set('alt', String(selectedAltitude));
      if (colorscale !== 'auto') p.set('cs', colorscale);
      return `${window.location.origin}/slice?${p.toString()}`;
    }, [selectedDataset, selectedVariable, selectedTime, selectedAltitude, colorscale]),
    buildHistoryEntry: useCallback(() => ({
      page: '/slice', dataset: selectedDataset, variable: selectedVariable,
      params: { time: selectedTime, altitude: selectedAltitude },
      label: `${selectedVariable} t${selectedTime} alt${selectedAltitude}`,
    }), [selectedDataset, selectedVariable, selectedTime, selectedAltitude]),
    canLaunch: useCallback(() => !!selectedDataset && !!selectedVariable, [selectedDataset, selectedVariable]),
  });

  const resolvedColorscale = useResolvedColorscale(colorscale, sliceData?.variable, selectedVariable);

  // Fetch wind data when toggle is ON and slice is loaded
  const isWindVariable = ['UU', 'VV'].includes(selectedVariable);
  useEffect(() => {
    if (!showWind || !sliceData || isWindVariable) { setWindData(null); return; }
    const controller = new AbortController();
    getWind({ dataset: selectedDataset, time: selectedTime, altitudeIndex: selectedAltitude }, controller.signal)
      .then(res => setWindData(res.data))
      .catch(() => { if (!controller.signal.aborted) setWindData(null); });
    return () => controller.abort();
  }, [showWind, sliceData, selectedDataset, selectedTime, selectedAltitude, isWindVariable]);

  const handleExportCSV = () => {
    triggerApiDownload(
      exportSliceCSV({ dataset: selectedDataset, variable: selectedVariable, time: selectedTime, altitude: selectedAltitude }),
      `slice_${selectedVariable}_t${selectedTime}_a${selectedAltitude}.csv`,
    );
  };

  const handleExportNetCDF = () => {
    triggerApiDownload(
      exportSliceNetCDF({ dataset: selectedDataset, variable: selectedVariable, time: selectedTime, altitude: selectedAltitude }),
      `slice_${selectedVariable}_t${selectedTime}_a${selectedAltitude}.nc`,
    );
  };

  const tableData = useMemo(() =>
    sliceData ? gridToTable(sliceData.data, sliceData.latitudes, sliceData.longitudes, selectedVariable) : null,
  [sliceData, selectedVariable]);

  if (catalogLoading) return <PageLoader />;

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      <Typography variant="h5" gutterBottom>{t('page.slice.title')}</Typography>

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
            <AltitudeSelector value={selectedAltitude}
              onChange={v => { setSelectedAltitude(v); markDirty(); }}
              variableCode={selectedVariable} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <ColorscaleSelector value={colorscale} onChange={setColorscale} />
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={handleLaunch}
            disabled={!selectedDataset || !selectedVariable || loading}>
            {loading ? <CircularProgress size={20} color="inherit" /> : t('page.slice.button')}
          </Button>
          {sliceData && (
            <>
              <VisuToggle value={showLocations} onChange={setShowLocations} icon={<PlaceIcon />}>{t('common.toggleLocations')}</VisuToggle>
              <VisuToggle value={showSurface} onChange={setShowSurface} icon={<MapIcon />}>{t('common.toggleSurface')}</VisuToggle>
              {!isWindVariable && (
                <VisuToggle value={showWind} onChange={setShowWind} icon={<WindIcon />}>{t('explore.toggle.wind')}</VisuToggle>
              )}
              <VisuToggle value={logScale} onChange={setLogScale} icon={<LogIcon />} title={t('common.toggleLog')}>{'Log\u2081\u2080'}</VisuToggle>
            </>
          )}
          {isDirty && <Chip label={t('page.slice.dirty')} color="warning" size="small" />}
        </Box>

        <LocationsLegend visible={showLocations && !!sliceData} />

      </Paper>

      {loading && <LinearProgress color="primary" sx={{ mb: 2, borderRadius: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && !sliceData && <ChartSkeleton variant="heatmap" />}

      <ChartOrTable tableData={tableData}>
        {(showTable, TableButton) => (
          <>
            {sliceData && (
              <Box sx={{ mb: 1, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <PermalienButton onClick={handleCopyLink} copied={linkCopied} />
                <ExportMenu plotRef={exportPlotRef} filename={`mars_slice_${selectedVariable || 'plot'}`} onCSV={handleExportCSV} onNetCDF={handleExportNetCDF} />
                <TableButton />
                <FullscreenButton containerRef={viewerContainerRef} />
              </Box>
            )}
            {!showTable && (
              <Box ref={viewerContainerRef} sx={{ position: 'relative' }}>
                <SliceViewer
                  sliceData={sliceData} variableCode={selectedVariable} datasetLabel={datasetLabel}
                  showLocations={showLocations} showSurface={showSurface}
                  windData={showWind ? windData : null}
                  colorscaleName={resolvedColorscale.name} reverseColorscale={resolvedColorscale.reverse}
                  logScale={logScale} noExportMenu
                />
              </Box>
            )}
          </>
        )}
      </ChartOrTable>
    </Container>
  );
}

export default SlicePage;
