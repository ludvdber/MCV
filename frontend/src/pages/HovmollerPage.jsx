import { useState, useCallback, useMemo } from 'react';
import {
  Container, Paper, Typography, Button, CircularProgress,
  Alert, Box, FormControl, InputLabel, Select, MenuItem, Chip, LinearProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { Functions as LogIcon } from '@mui/icons-material';
import { getHovmoller, exportHovmollerCSV } from '../services/api';
import DatasetSelector from '../components/DatasetSelector';
import VariableSelector from '../components/VariableSelector';
import AltitudeSelector from '../components/AltitudeSelector';
import HovmollerViewer from '../components/HovmollerViewer';
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
import ChartOrTable from '../components/ChartOrTable';
import ViewExplainer from '../components/ViewExplainer';
import { grid2DToTable } from '../utils/dataToTable';

function HovmollerPage() {
  const {
    datasets,
    selectedDataset, setSelectedDataset,
    selectedVariable, handleVariableChange,
    selectedAltitude, setSelectedAltitude,
    dataset, datasetLabel,
  } = useMars();
  const { t } = useTranslation();

  const [hovType, setHovType] = useState('latitude');
  const [colorscale, setColorscale] = useState('auto');
  const [logScale, setLogScale] = useState(false);

  const {
    data: hovData, loading, error, isDirty, markDirty,
    viewerContainerRef, exportPlotRef, linkCopied,
    handleLaunch, handleCopyLink, catalogLoading,
  } = useVisualizationPage({
    route: '/hovmoller',
    restoreUrl: (sp) => {
      const ds = sp.get('ds');
      if (!ds) return false;
      setSelectedDataset(ds);
      const v = sp.get('var'); if (v) handleVariableChange(v);
      const alt = intParam(sp, 'alt'); if (alt != null) setSelectedAltitude(alt);
      const type = sp.get('type'); if (type) setHovType(type);
      const cs = sp.get('cs'); if (cs) setColorscale(cs);
      return true;
    },
    fetchData: useCallback(() =>
      getHovmoller({ dataset: selectedDataset, variable: selectedVariable, altitude: selectedAltitude, type: hovType }),
    [selectedDataset, selectedVariable, selectedAltitude, hovType]),
    buildPermalink: useCallback(() => {
      const p = new URLSearchParams();
      if (selectedDataset) p.set('ds', selectedDataset);
      if (selectedVariable) p.set('var', selectedVariable);
      p.set('alt', String(selectedAltitude));
      p.set('type', hovType);
      if (colorscale !== 'auto') p.set('cs', colorscale);
      return `${window.location.origin}/hovmoller?${p.toString()}`;
    }, [selectedDataset, selectedVariable, selectedAltitude, hovType, colorscale]),
    buildHistoryEntry: useCallback(() => ({
      page: '/hovmoller', dataset: selectedDataset, variable: selectedVariable,
      params: { altitude: selectedAltitude, type: hovType },
      label: `Hovmöller ${selectedVariable} ${hovType}`,
    }), [selectedDataset, selectedVariable, selectedAltitude, hovType]),
    canLaunch: useCallback(() => !!selectedDataset && !!selectedVariable, [selectedDataset, selectedVariable]),
  });

  const resolvedColorscale = useResolvedColorscale(colorscale, hovData?.variable, selectedVariable);

  const handleExportCSV = () => {
    triggerApiDownload(
      exportHovmollerCSV({ dataset: selectedDataset, variable: selectedVariable, altitude: selectedAltitude, type: hovType }),
      `mars_hovmoller_${selectedVariable || 'plot'}.csv`,
    );
  };

  const tableData = useMemo(() =>
    hovData ? grid2DToTable(hovData.data, hovData.times, hovData.spatialCoords, 'Time (h)', 'Latitude/Longitude', selectedVariable) : null,
  [hovData, selectedVariable]);

  if (catalogLoading) return <PageLoader />;

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      <Typography variant="h5" gutterBottom>{t('page.hovmoller.title')}</Typography>

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
          <Grid size={{ xs: 12, md: 4 }}>
            <AltitudeSelector value={selectedAltitude}
              onChange={v => { setSelectedAltitude(v); markDirty(); }}
              variableCode={selectedVariable} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth size="small">
              <InputLabel>{t('page.hovmoller.axisType')}</InputLabel>
              <Select value={hovType} label={t('page.hovmoller.axisType')}
                onChange={e => { setHovType(e.target.value); markDirty(); }}>
                <MenuItem value="latitude">{t('page.hovmoller.latitude')}</MenuItem>
                <MenuItem value="longitude">{t('page.hovmoller.longitude')}</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <ColorscaleSelector value={colorscale}
              onChange={setColorscale} />
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={handleLaunch}
            disabled={!selectedDataset || !selectedVariable || loading}>
            {loading ? <CircularProgress size={20} color="inherit" /> : t('page.hovmoller.button')}
          </Button>
          {hovData && (
            <VisuToggle value={logScale} onChange={setLogScale} icon={<LogIcon />} title={t('common.toggleLog')}>{'Log\u2081\u2080'}</VisuToggle>
          )}
          {isDirty && (
            <Chip label={t('page.hovmoller.dirty')} color="warning" size="small" />
          )}
        </Box>

      </Paper>

      {loading && <LinearProgress color="primary" sx={{ mb: 2, borderRadius: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && !hovData && <ChartSkeleton variant="heatmap" />}

      <ChartOrTable tableData={tableData}>
        {(showTable, TableButton) => (
          <>
            {hovData && (
              <Box sx={{ mb: 1, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <PermalienButton onClick={handleCopyLink} copied={linkCopied} />
                <ExportMenu
                  plotRef={exportPlotRef}
                  filename={`mars_hovmoller_${selectedVariable || 'plot'}`}
                  onCSV={handleExportCSV}
                />
                <TableButton />
                <FullscreenButton containerRef={viewerContainerRef} />
              </Box>
            )}
            {!showTable && (
              <Box ref={viewerContainerRef} sx={{ position: 'relative' }}>
                <HovmollerViewer
                  hovmollerData={hovData}
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
      <ViewExplainer id="hovmoller" />
    </Container>
  );
}

export default HovmollerPage;
