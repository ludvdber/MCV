import { useState, useCallback, useMemo } from 'react';
import {
  Container, Paper, Typography, Button, CircularProgress,
  Alert, Box, Chip, LinearProgress, Tooltip,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { getDifference, exportDifferenceCSV } from '../services/api';
import DatasetSelector from '../components/DatasetSelector';
import VariableSelector from '../components/VariableSelector';
import TimeSelector from '../components/TimeSelector';
import AltitudeSelector from '../components/AltitudeSelector';
import DifferenceViewer from '../components/DifferenceViewer';
import ColorscaleSelector from '../components/ColorscaleSelector';
import InterpolationToggle from '../components/InterpolationToggle';
import VisuToggle from '../components/VisuToggle';
import ExportMenu from '../components/ExportMenu';
import PermalienButton from '../components/PermalienButton';
import ChartSkeleton from '../components/ChartSkeleton';
import FullscreenButton from '../components/FullscreenButton';
import PageLoader from '../components/PageLoader';
import LocationsLegend from '../components/LocationsLegend';
import { Functions as LogIcon, Place as PlaceIcon, Map as MapIcon, BlurOn as SmoothIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useMars } from '../context/MarsContext';
import { triggerApiDownload } from '../utils/exportUtils';
import { timeParam, altitudeParam } from '../utils/urlParams';
import { useResolvedColorscale } from '../hooks/useResolvedColorscale';
import { useVisualizationPage } from '../hooks/useVisualizationPage';
import ChartOrTable from '../components/ChartOrTable';
import ViewExplainer from '../components/ViewExplainer';
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
  /* Source unique de verite du « pourquoi c'est grise » : le bouton, l'infobulle,
     le message visible ET la condition de lancement en derivent tous. Auparavant
     la condition du bouton etait recopiee a cote de canLaunch, et seul le cas
     A == B etait explique — les trois autres laissaient l'utilisateur devant un
     bouton mort sans indication. */
  const disabledReason =
    selectedDataset && datasetB && selectedDataset === datasetB ? t('page.difference.sameDataset')
    : (!selectedDataset || !datasetB || !selectedVariable) ? t('page.difference.needSelection')
    : '';

  const [colorscale, setColorscale] = useState('auto');
  const [logScale, setLogScale] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const [showSurface, setShowSurface] = useState(false);
  // Defauts : lissage actif sur la grille native (interpolation en option).
  const [smooth, setSmooth] = useState(true);
  const [interpStep, setInterpStep] = useState(0);

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
      const time = timeParam(sp); if (time != null) setSelectedTime(time);
      const alt = altitudeParam(sp); if (alt != null) setSelectedAltitude(alt);
      return true;
    },
    fetchData: useCallback((signal) =>
      getDifference({
        datasetA: selectedDataset, datasetB: datasetB,
        variable: selectedVariable, time: selectedTime, altitude: selectedAltitude,
      }, signal),
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
    canLaunch: useCallback(() => !disabledReason, [disabledReason]),
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
    diffData?.data?.length ? gridToTable(diffData.data, diffData.latitudes, diffData.longitudes, '\u0394 ' + selectedVariable) : null,
  [diffData, selectedVariable]);

  if (catalogLoading) return <PageLoader />;

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      <Typography variant="h5" component="h1" gutterBottom>{t('page.difference.title')}</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          {/* Le role (A = reference, B = compare) est porte par le LIBELLE du
              champ, pas par une legende au-dessus : sans cela les deux
              selecteurs s'annoncent tous deux « Dataset » au lecteur d'ecran. */}
          <Grid size={{ xs: 12, md: 6 }}>
            <DatasetSelector datasets={datasets} value={selectedDataset}
              label={t('page.difference.datasetA')}
              onChange={v => { setSelectedDataset(v); markDirty(); }} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <DatasetSelector datasets={datasets} value={datasetB}
              label={t('page.difference.datasetB')}
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
          {/* Le bouton grise DOIT dire pourquoi : infobulle a la souris, texte
              visible pour le tactile, aria-describedby pour le lecteur d'ecran. */}
          <Tooltip title={disabledReason} placement="top" arrow>
            <span>
              <Button variant="contained" onClick={handleLaunch}
                aria-describedby={disabledReason ? 'difference-disabled-reason' : undefined}
                disabled={!!disabledReason || loading}>
                {loading ? <CircularProgress size={20} color="inherit" /> : t('page.difference.button')}
              </Button>
            </span>
          </Tooltip>
          {disabledReason && !loading && (
            <Alert id="difference-disabled-reason" severity="info" sx={{ py: 0, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
              {disabledReason}
            </Alert>
          )}
          {diffData && (
            <>
              <VisuToggle value={showLocations} onChange={setShowLocations} icon={<PlaceIcon />}>{t('common.toggleLocations')}</VisuToggle>
              <VisuToggle value={showSurface} onChange={setShowSurface} icon={<MapIcon />}>{t('common.toggleSurface')}</VisuToggle>
              <VisuToggle value={logScale} onChange={setLogScale} icon={<LogIcon />} title={t('common.toggleLog')}>{'Log\u2081\u2080'}</VisuToggle>
              <VisuToggle value={smooth} onChange={setSmooth} icon={<SmoothIcon />} title={t('common.toggleSmooth')}>{t('common.toggleSmooth')}</VisuToggle>
              <InterpolationToggle value={interpStep} onChange={setInterpStep} />
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
                  smooth={smooth}
                  interpStep={interpStep}
                  noExportMenu
                />
              </Box>
            )}
          </>
        )}
      </ChartOrTable>
      <ViewExplainer id="difference" />
    </Container>
  );
}

export default DifferencePage;
