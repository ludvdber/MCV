import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Container, Paper, Typography, Button, CircularProgress, Alert, Box, Chip } from '@mui/material';
import Grid from '@mui/material/Grid';
import { getTimeSeries, exportTimeSeriesCSV } from '../services/api';
import PermalienButton from '../components/PermalienButton';
import DatasetSelector from '../components/DatasetSelector';
import VariableSelector from '../components/VariableSelector';
import AltitudeSelector from '../components/AltitudeSelector';
import LatLonSelector from '../components/LatLonSelector';
import TimeSeriesChart from '../components/TimeSeriesChart';
import ExportMenu from '../components/ExportMenu';
import PageLoader from '../components/PageLoader';
import { useTranslation } from 'react-i18next';
import { useMars } from '../context/MarsContext';
import { usePlotRef } from '../hooks/usePlotRef';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { isSurfaceVariable } from '../utils/variableUtils';

/**
 * Page serie temporelle (UC3).
 * Supporte les permaliens : ?ds=&var=&lat=&lon=&alt=
 */
function TimeSeriesPage() {
  const {
    datasets, catalogLoading,
    selectedDataset, setSelectedDataset,
    selectedVariable, handleVariableChange,
    selectedAltitude, setSelectedAltitude,
    selectedLatitude, setSelectedLatitude,
    selectedLongitude, setSelectedLongitude,
    dataset, datasetLabel,
  } = useMars();
  const { t } = useTranslation();

  const [timeSeriesData, setTimeSeriesData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

  const [viewerContainerRef, exportPlotRef] = usePlotRef();
  const [linkCopied, copyToClipboard] = useCopyToClipboard();
  const [searchParams] = useSearchParams();
  const hasRestoredUrl = useRef(false);
  const pendingAutoLaunch = useRef(false);

  if (!catalogLoading && !hasRestoredUrl.current) {
    hasRestoredUrl.current = true;
    const ds = searchParams.get('ds');
    if (ds) {
      setSelectedDataset(ds);
      const v = searchParams.get('var');
      if (v) handleVariableChange(v);
      const lat = searchParams.get('lat');
      if (lat != null) setSelectedLatitude(parseFloat(lat));
      const lon = searchParams.get('lon');
      if (lon != null) setSelectedLongitude(parseFloat(lon));
      const alt = searchParams.get('alt');
      if (alt != null) setSelectedAltitude(parseInt(alt, 10));
      pendingAutoLaunch.current = true;
    }
  }

  const handleAnalyser = () => {
    if (!selectedDataset || !selectedVariable) return;
    setLoading(true);
    setError(null);
    setIsDirty(false);
    const altitudeToSend = isSurfaceVariable(selectedVariable) ? 0 : selectedAltitude;
    getTimeSeries({
      dataset: selectedDataset,
      variable: selectedVariable,
      latitude: selectedLatitude,
      longitude: selectedLongitude,
      altitude: altitudeToSend,
    })
      .then(res => setTimeSeriesData(res.data))
      .catch(err => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  };

  if (pendingAutoLaunch.current && dataset && !loading) {
    pendingAutoLaunch.current = false;
    setTimeout(handleAnalyser, 0);
  }

  const handleExportCSV = () => {
    const altitudeToSend = isSurfaceVariable(selectedVariable) ? 0 : selectedAltitude;
    exportTimeSeriesCSV({
      dataset: selectedDataset,
      variable: selectedVariable,
      latitude: selectedLatitude,
      longitude: selectedLongitude,
      altitude: altitudeToSend,
    }).then(res => {
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timeseries_${selectedVariable}_lat${selectedLatitude}_lon${selectedLongitude}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }).catch(() => {});
  };

  const handleCopyLink = () => {
    const p = new URLSearchParams();
    if (selectedDataset) p.set('ds', selectedDataset);
    if (selectedVariable) p.set('var', selectedVariable);
    p.set('lat', String(selectedLatitude));
    p.set('lon', String(selectedLongitude));
    p.set('alt', String(selectedAltitude));
    copyToClipboard(`${window.location.origin}/timeseries?${p.toString()}`);
  };

  const markDirty = () => { if (timeSeriesData) setIsDirty(true); };

  if (catalogLoading) return <PageLoader />;

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      <Typography variant="h5" gutterBottom>{t('page.timeseries.title')}</Typography>

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
          <Grid size={{ xs: 12 }}>
            <LatLonSelector
              latitude={selectedLatitude}
              longitude={selectedLongitude}
              onLatChange={v => { setSelectedLatitude(v); markDirty(); }}
              onLonChange={v => { setSelectedLongitude(v); markDirty(); }}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <AltitudeSelector value={selectedAltitude}
              onChange={v => { setSelectedAltitude(v); markDirty(); }}
              variableCode={selectedVariable} />
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="contained" onClick={handleAnalyser}
            disabled={!selectedDataset || !selectedVariable || loading}>
            {loading ? <CircularProgress size={20} color="inherit" /> : t('page.timeseries.button')}
          </Button>
          {isDirty && (
            <Chip label={t('page.timeseries.dirty')} color="warning" size="small" />
          )}
        </Box>

        {timeSeriesData && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <PermalienButton onClick={handleCopyLink} copied={linkCopied} />
            <ExportMenu
              plotRef={exportPlotRef}
              filename={`mars_timeseries_${selectedVariable || 'plot'}`}
              onCSV={handleExportCSV}
            />
          </Box>
        )}
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box ref={viewerContainerRef}>
        <TimeSeriesChart
          timeSeriesData={timeSeriesData}
          variableCode={selectedVariable}
          datasetLabel={datasetLabel}
          noExportMenu
        />
      </Box>
    </Container>
  );
}

export default TimeSeriesPage;
