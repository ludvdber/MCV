import { useState, useCallback, useMemo } from 'react';
import {
  Container, Paper, Typography, Button, CircularProgress,
  Alert, Box, Chip, LinearProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { getTemporalProfile, exportTemporalProfileCSV } from '../services/api';
import DatasetSelector from '../components/DatasetSelector';
import VariableSelector from '../components/VariableSelector';
import LatLonSelector from '../components/LatLonSelector';
import ColorscaleSelector from '../components/ColorscaleSelector';
import TemporalProfileViewer from '../components/TemporalProfileViewer';
import ExportMenu from '../components/ExportMenu';
import PermalienButton from '../components/PermalienButton';
import ChartSkeleton from '../components/ChartSkeleton';
import FullscreenButton from '../components/FullscreenButton';
import PageLoader from '../components/PageLoader';
import { useTranslation } from 'react-i18next';
import { useMars } from '../context/MarsContext';
import { triggerApiDownload } from '../utils/exportUtils';
import { useResolvedColorscale } from '../hooks/useResolvedColorscale';
import { useVisualizationPage } from '../hooks/useVisualizationPage';
import ChartOrTable from '../components/ChartOrTable';
import { grid2DToTable } from '../utils/dataToTable';

function TemporalProfilePage() {
  const {
    datasets,
    selectedDataset, setSelectedDataset,
    selectedVariable, handleVariableChange,
    selectedLatitude, setSelectedLatitude,
    selectedLongitude, setSelectedLongitude,
    dataset, datasetLabel,
  } = useMars();
  const { t } = useTranslation();

  const [colorscale, setColorscale] = useState('auto');

  const {
    data: profileData, loading, error, isDirty, markDirty,
    viewerContainerRef, exportPlotRef, linkCopied,
    handleLaunch, handleCopyLink, catalogLoading,
  } = useVisualizationPage({
    route: '/temporal-profile',
    restoreUrl: (sp) => {
      const ds = sp.get('ds');
      if (!ds) return false;
      setSelectedDataset(ds);
      const v = sp.get('var'); if (v) handleVariableChange(v);
      const lat = sp.get('lat'); if (lat != null) setSelectedLatitude(parseFloat(lat));
      const lon = sp.get('lon'); if (lon != null) setSelectedLongitude(parseFloat(lon));
      const cs = sp.get('cs'); if (cs) setColorscale(cs);
      return true;
    },
    fetchData: useCallback(() =>
      getTemporalProfile({
        dataset: selectedDataset, variable: selectedVariable,
        latitude: selectedLatitude, longitude: selectedLongitude,
      }),
    [selectedDataset, selectedVariable, selectedLatitude, selectedLongitude]),
    buildPermalink: useCallback(() => {
      const p = new URLSearchParams();
      if (selectedDataset) p.set('ds', selectedDataset);
      if (selectedVariable) p.set('var', selectedVariable);
      p.set('lat', String(selectedLatitude));
      p.set('lon', String(selectedLongitude));
      if (colorscale !== 'auto') p.set('cs', colorscale);
      return `${window.location.origin}/temporal-profile?${p.toString()}`;
    }, [selectedDataset, selectedVariable, selectedLatitude, selectedLongitude, colorscale]),
    buildHistoryEntry: useCallback(() => ({
      page: '/temporal-profile', dataset: selectedDataset, variable: selectedVariable,
      params: { lat: selectedLatitude, lon: selectedLongitude },
      label: `${selectedVariable} ${selectedLatitude}\u00b0/${selectedLongitude}\u00b0`,
    }), [selectedDataset, selectedVariable, selectedLatitude, selectedLongitude]),
    canLaunch: useCallback(() => !!selectedDataset && !!selectedVariable, [selectedDataset, selectedVariable]),
  });

  const resolvedColorscale = useResolvedColorscale(colorscale, profileData?.variable, selectedVariable);

  const handleExportCSV = () => {
    triggerApiDownload(
      exportTemporalProfileCSV({
        dataset: selectedDataset, variable: selectedVariable,
        latitude: selectedLatitude, longitude: selectedLongitude,
      }),
      `temporal_profile_${selectedVariable}_${selectedLatitude}_${selectedLongitude}.csv`,
    );
  };

  const tableData = useMemo(() =>
    profileData ? grid2DToTable(profileData.data, profileData.altitudes, Array.from({length: profileData.data[0]?.length || 0}, (_, i) => (i * 24 / (profileData.data[0]?.length || 48)).toFixed(1)), 'Altitude (km)', 'Time (h)', selectedVariable) : null,
  [profileData, selectedVariable]);

  if (catalogLoading) return <PageLoader />;

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      <Typography variant="h5" gutterBottom>{t('page.temporalprofile.title')}</Typography>

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
              layout="row"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <ColorscaleSelector value={colorscale} onChange={setColorscale} />
          </Grid>
        </Grid>

        <Alert severity="info" sx={{ mt: 2, py: 0, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
          {t('page.temporalprofile.surfaceAlert')}
        </Alert>

        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={handleLaunch}
            disabled={!selectedDataset || !selectedVariable || loading}>
            {loading ? <CircularProgress size={20} color="inherit" /> : t('page.temporalprofile.button')}
          </Button>
          {isDirty && (
            <Chip label={t('page.temporalprofile.dirty')} color="warning" size="small" />
          )}
        </Box>

      </Paper>

      {loading && <LinearProgress color="primary" sx={{ mb: 2, borderRadius: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && !profileData && <ChartSkeleton variant="heatmap" />}

      <ChartOrTable tableData={tableData}>
        {(showTable, TableButton) => (
          <>
            {profileData && (
              <Box sx={{ mb: 1, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <PermalienButton onClick={handleCopyLink} copied={linkCopied} />
                <ExportMenu plotRef={exportPlotRef}
                  filename={`mars_temporal_profile_${selectedVariable || 'plot'}`}
                  onCSV={handleExportCSV} />
                <TableButton />
                <FullscreenButton containerRef={viewerContainerRef} />
              </Box>
            )}
            {!showTable && (
              <Box ref={viewerContainerRef} sx={{ position: 'relative' }}>
                <TemporalProfileViewer
                  profileData={profileData}
                  variableCode={selectedVariable}
                  datasetLabel={datasetLabel}
                  colorscaleName={resolvedColorscale.name}
                  reverseColorscale={resolvedColorscale.reverse}
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

export default TemporalProfilePage;
