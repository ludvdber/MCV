import { useState, useCallback, useMemo } from 'react';
import {
  Container, Paper, Typography, Button, CircularProgress,
  Alert, Box, FormControl, InputLabel, Select, MenuItem, TextField, Chip, LinearProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { Functions as LogIcon } from '@mui/icons-material';
import { getCrossSection, exportCrossSectionCSV } from '../services/api';
import DatasetSelector from '../components/DatasetSelector';
import VariableSelector from '../components/VariableSelector';
import TimeSelector from '../components/TimeSelector';
import CrossSectionViewer from '../components/CrossSectionViewer';
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
import { intParam, floatParam } from '../utils/urlParams';
import { useResolvedColorscale } from '../hooks/useResolvedColorscale';
import { useVisualizationPage } from '../hooks/useVisualizationPage';
import { isSurfaceVariable as checkIsSurface } from '../utils/variableUtils';
import ChartOrTable from '../components/ChartOrTable';
import ViewExplainer from '../components/ViewExplainer';
import { grid2DToTable } from '../utils/dataToTable';

/**
 * Page coupe verticale (meridionale / zonale).
 * Supporte les permaliens : ?ds=&var=&t=&type=&fixed=&cs=
 */

function CrossSectionPage() {
  const {
    datasets,
    selectedDataset, setSelectedDataset,
    selectedVariable, handleVariableChange,
    selectedTime, setSelectedTime,
    selectedLatitude, setSelectedLatitude,
    selectedLongitude, setSelectedLongitude,
    dataset, datasetLabel,
  } = useMars();
  const { t } = useTranslation();

  const [csType, setCsType] = useState('meridional');
  const [colorscale, setColorscale] = useState('auto');
  const [logScale, setLogScale] = useState(false);

  const isSurfaceVariable = checkIsSurface(selectedVariable);
  const fixedCoordinate = csType === 'meridional' ? selectedLongitude : selectedLatitude;

  const {
    data: csData, loading, error, isDirty, markDirty,
    viewerContainerRef, exportPlotRef, linkCopied,
    handleLaunch, handleCopyLink, catalogLoading,
  } = useVisualizationPage({
    route: '/crosssection',
    restoreUrl: (sp) => {
      const ds = sp.get('ds');
      if (!ds) return false;
      setSelectedDataset(ds);
      const v = sp.get('var'); if (v) handleVariableChange(v);
      const ti = intParam(sp, 't'); if (ti != null) setSelectedTime(ti);
      const type = sp.get('type'); if (type) setCsType(type);
      const fixed = floatParam(sp, 'fixed');
      if (fixed != null) {
        if ((type || 'meridional') === 'meridional') setSelectedLongitude(fixed);
        else setSelectedLatitude(fixed);
      }
      const cs = sp.get('cs'); if (cs) setColorscale(cs);
      return true;
    },
    fetchData: useCallback(() =>
      getCrossSection({ dataset: selectedDataset, variable: selectedVariable, time: selectedTime, type: csType, fixedCoordinate }),
    [selectedDataset, selectedVariable, selectedTime, csType, fixedCoordinate]),
    buildPermalink: useCallback(() => {
      const p = new URLSearchParams();
      if (selectedDataset) p.set('ds', selectedDataset);
      if (selectedVariable) p.set('var', selectedVariable);
      p.set('t', String(selectedTime));
      p.set('type', csType);
      p.set('fixed', String(fixedCoordinate));
      if (colorscale !== 'auto') p.set('cs', colorscale);
      return `${window.location.origin}/crosssection?${p.toString()}`;
    }, [selectedDataset, selectedVariable, selectedTime, csType, fixedCoordinate, colorscale]),
    buildHistoryEntry: useCallback(() => ({
      page: '/crosssection', dataset: selectedDataset, variable: selectedVariable,
      params: { time: selectedTime, type: csType, fixedCoordinate },
      label: `${selectedVariable} ${csType} ${fixedCoordinate}°`,
    }), [selectedDataset, selectedVariable, selectedTime, csType, fixedCoordinate]),
    canLaunch: useCallback(() => !!selectedDataset && !!selectedVariable && !isSurfaceVariable, [selectedDataset, selectedVariable, isSurfaceVariable]),
  });

  // Utilise la variable de la donnée affichée (pas du formulaire) pour éviter
  // que la palette change avant d'avoir cliqué sur "Analyser".
  const resolvedColorscale = useResolvedColorscale(colorscale, csData?.variable, selectedVariable);

  const handleExportCSV = () => {
    triggerApiDownload(
      exportCrossSectionCSV({ dataset: selectedDataset, variable: selectedVariable, time: selectedTime, type: csType, fixedCoordinate }),
      `crosssection_${selectedVariable}_${csType}.csv`,
    );
  };

  const tableData = useMemo(() =>
    csData ? grid2DToTable(csData.data, csData.altitudes, csData.horizontalCoords, 'Altitude (km)', csType === 'meridional' ? 'Latitude (\u00b0)' : 'Longitude (\u00b0)', selectedVariable) : null,
  [csData, csType, selectedVariable]);

  if (catalogLoading) return <PageLoader />;

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      <Typography variant="h5" gutterBottom>{t('page.crosssection.title')}</Typography>

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
          <Grid size={{ xs: 12, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>{t('page.crosssection.cutType')}</InputLabel>
              <Select value={csType} label={t('page.crosssection.cutType')}
                onChange={e => { setCsType(e.target.value); markDirty(); }}>
                <MenuItem value="meridional">{t('page.crosssection.meridional')}</MenuItem>
                <MenuItem value="zonal">{t('page.crosssection.zonal')}</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField size="small"
              label={csType === 'meridional' ? t('page.crosssection.fixedLon') : t('page.crosssection.fixedLat')}
              type="number"
              value={csType === 'meridional' ? selectedLongitude : selectedLatitude}
              onChange={e => {
                const val = parseFloat(e.target.value) || 0;
                if (csType === 'meridional') setSelectedLongitude(val);
                else setSelectedLatitude(val);
                markDirty();
              }}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <ColorscaleSelector value={colorscale}
              onChange={setColorscale} />
          </Grid>
        </Grid>

        {isSurfaceVariable && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {t('page.crosssection.surfaceAlert')}
          </Alert>
        )}

        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={handleLaunch}
            disabled={!selectedDataset || !selectedVariable || loading || isSurfaceVariable}>
            {loading ? <CircularProgress size={20} color="inherit" /> : t('page.crosssection.button')}
          </Button>
          {csData && (
            <VisuToggle value={logScale} onChange={setLogScale} icon={<LogIcon />} title={t('common.toggleLog')}>{'Log\u2081\u2080'}</VisuToggle>
          )}
          {isDirty && (
            <Chip label={t('page.crosssection.dirty')} color="warning" size="small" />
          )}
        </Box>

      </Paper>

      {loading && <LinearProgress color="primary" sx={{ mb: 2, borderRadius: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && !csData && <ChartSkeleton variant="heatmap" />}

      <ChartOrTable tableData={tableData}>
        {(showTable, TableButton) => (
          <>
            {csData && (
              <Box sx={{ mb: 1, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <PermalienButton onClick={handleCopyLink} copied={linkCopied} />
                <ExportMenu
                  plotRef={exportPlotRef}
                  filename={`mars_crosssection_${selectedVariable || 'plot'}`}
                  onCSV={handleExportCSV}
                />
                <TableButton />
                <FullscreenButton containerRef={viewerContainerRef} />
              </Box>
            )}
            {!showTable && (
              <Box ref={viewerContainerRef} sx={{ position: 'relative' }}>
                <CrossSectionViewer
                  crossSectionData={csData}
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
      <ViewExplainer id="crosssection" />
    </Container>
  );
}

export default CrossSectionPage;
