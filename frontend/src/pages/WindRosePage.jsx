import { useCallback, useMemo } from 'react';
import {
  Container, Paper, Typography, Button, CircularProgress,
  Alert, Box, Chip, LinearProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { getWindRose, exportWindRoseCSV } from '../services/api';
import DatasetSelector from '../components/DatasetSelector';
import AltitudeSelector from '../components/AltitudeSelector';
import LatLonSelector from '../components/LatLonSelector';
import WindRoseViewer from '../components/WindRoseViewer';
import ExportMenu from '../components/ExportMenu';
import PermalienButton from '../components/PermalienButton';
import ChartSkeleton from '../components/ChartSkeleton';
import FullscreenButton from '../components/FullscreenButton';
import PageLoader from '../components/PageLoader';
import { useTranslation } from 'react-i18next';
import { useMars } from '../context/MarsContext';
import { triggerApiDownload } from '../utils/exportUtils';
import { useVisualizationPage } from '../hooks/useVisualizationPage';
import { INDIVIDUAL_PREFIX } from '../constants';
import ChartOrTable from '../components/ChartOrTable';

function WindRosePage() {
  const {
    datasets,
    selectedDataset, setSelectedDataset,
    selectedAltitude, setSelectedAltitude,
    selectedLatitude, setSelectedLatitude,
    selectedLongitude, setSelectedLongitude,
    datasetLabel,
  } = useMars();
  const { t } = useTranslation();

  const isIndividual = selectedDataset?.startsWith(INDIVIDUAL_PREFIX);

  const {
    data: windRoseData, loading, error, isDirty, markDirty,
    viewerContainerRef, exportPlotRef, linkCopied,
    handleLaunch, handleCopyLink, catalogLoading,
  } = useVisualizationPage({
    route: '/windrose',
    restoreUrl: (sp) => {
      const ds = sp.get('ds');
      if (!ds) return false;
      setSelectedDataset(ds);
      const alt = sp.get('alt'); if (alt != null) setSelectedAltitude(parseInt(alt, 10));
      const lat = sp.get('lat'); if (lat != null) setSelectedLatitude(parseFloat(lat));
      const lon = sp.get('lon'); if (lon != null) setSelectedLongitude(parseFloat(lon));
      return true;
    },
    fetchData: useCallback(() =>
      getWindRose({
        dataset: selectedDataset, latitude: selectedLatitude,
        longitude: selectedLongitude, altitude: selectedAltitude,
      }),
    [selectedDataset, selectedLatitude, selectedLongitude, selectedAltitude]),
    buildPermalink: useCallback(() => {
      const p = new URLSearchParams();
      if (selectedDataset) p.set('ds', selectedDataset);
      p.set('alt', String(selectedAltitude));
      p.set('lat', String(selectedLatitude));
      p.set('lon', String(selectedLongitude));
      return `${window.location.origin}/windrose?${p.toString()}`;
    }, [selectedDataset, selectedAltitude, selectedLatitude, selectedLongitude]),
    buildHistoryEntry: useCallback(() => ({
      page: '/windrose', dataset: selectedDataset, variable: 'UU/VV',
      params: { altitude: selectedAltitude, lat: selectedLatitude, lon: selectedLongitude },
      label: `Wind Rose (${selectedLatitude}\u00b0, ${selectedLongitude}\u00b0)`,
    }), [selectedDataset, selectedAltitude, selectedLatitude, selectedLongitude]),
    canLaunch: useCallback(() => !!selectedDataset && !isIndividual, [selectedDataset, isIndividual]),
  });

  const handleExportCSV = () => {
    triggerApiDownload(
      exportWindRoseCSV({
        dataset: selectedDataset, latitude: selectedLatitude,
        longitude: selectedLongitude, altitude: selectedAltitude,
      }),
      'mars_windrose.csv',
    );
  };

  const tableData = useMemo(() =>
    windRoseData ? {
      columns: [
        { label: 'Timestep', key: 't' },
        { label: 'UU (m/s)', key: 'uu' },
        { label: 'VV (m/s)', key: 'vv' },
      ],
      rows: windRoseData.uu.map((u, i) => ({ t: i, uu: u, vv: windRoseData.vv[i] })),
    } : null,
  [windRoseData]);

  if (catalogLoading) return <PageLoader />;

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      <Typography variant="h5" gutterBottom>{t('page.windrose.title')}</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <DatasetSelector datasets={datasets} value={selectedDataset}
              onChange={v => { setSelectedDataset(v); markDirty(); }} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <AltitudeSelector value={selectedAltitude}
              onChange={v => { setSelectedAltitude(v); markDirty(); }}
              variableCode="UU" />
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
        </Grid>

        {isIndividual && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {t('page.windrose.meanOnly')}
          </Alert>
        )}

        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={handleLaunch}
            disabled={!selectedDataset || loading || isIndividual}>
            {loading ? <CircularProgress size={20} color="inherit" /> : t('page.windrose.button')}
          </Button>
          {isDirty && (
            <Chip label={t('page.windrose.dirty')} color="warning" size="small" />
          )}
        </Box>

      </Paper>

      {loading && <LinearProgress color="primary" sx={{ mb: 2, borderRadius: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && !windRoseData && <ChartSkeleton variant="polar" />}

      <ChartOrTable tableData={tableData}>
        {(showTable, TableButton) => (
          <>
            {windRoseData && (
              <Box sx={{ mb: 1, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <PermalienButton onClick={handleCopyLink} copied={linkCopied} />
                <ExportMenu plotRef={exportPlotRef} filename="mars_windrose" onCSV={handleExportCSV} />
                <TableButton />
                <FullscreenButton containerRef={viewerContainerRef} />
              </Box>
            )}
            {!showTable && (
              <Box ref={viewerContainerRef} sx={{ position: 'relative' }}>
                <WindRoseViewer
                  windRoseData={windRoseData}
                  datasetLabel={datasetLabel}
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

export default WindRosePage;
