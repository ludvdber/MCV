import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Container, Paper, Typography, Button, CircularProgress,
  Alert, Box, Chip
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { Place as PlaceIcon, Map as MapIcon, Functions as LogIcon } from '@mui/icons-material';
import { getSlice, exportSliceCSV } from '../services/api';
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
import PageLoader from '../components/PageLoader';
import { useMars } from '../context/MarsContext';
import { triggerApiDownload } from '../utils/exportUtils';
import { usePlotRef } from '../hooks/usePlotRef';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { useResolvedColorscale } from '../hooks/useResolvedColorscale';

/**
 * Page de visualisation 2D (UC2).
 * Supporte les permaliens : ?ds=&var=&t=&alt=&cs=
 */

function SlicePage() {
  const {
    datasets, catalogLoading,
    selectedDataset, setSelectedDataset,
    selectedVariable, handleVariableChange,
    selectedTime, setSelectedTime,
    selectedAltitude, setSelectedAltitude,
    dataset, datasetLabel,
  } = useMars();

  const [sliceData, setSliceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showLocations, setShowLocations] = useState(false);
  const [showSurface, setShowSurface] = useState(false);
  const [logScale, setLogScale] = useState(false);
  const [colorscale, setColorscale] = useState('auto');
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
      const t = searchParams.get('t');
      if (t != null) setSelectedTime(parseInt(t, 10));
      const alt = searchParams.get('alt');
      if (alt != null) setSelectedAltitude(parseInt(alt, 10));
      const cs = searchParams.get('cs');
      if (cs) setColorscale(cs);
      pendingAutoLaunch.current = true;
    }
  }

  // Utilise la variable de la donnée affichée (pas du formulaire) pour éviter
  // que la palette change avant d'avoir cliqué sur "Analyser".
  const resolvedColorscale = useResolvedColorscale(colorscale, sliceData?.variable, selectedVariable);

  const handleVisualiser = () => {
    if (!selectedDataset || !selectedVariable) return;
    setLoading(true);
    setError(null);
    setIsDirty(false);
    getSlice({ dataset: selectedDataset, variable: selectedVariable, time: selectedTime, altitude: selectedAltitude })
      .then(res => setSliceData(res.data))
      .catch(err => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  };

  if (pendingAutoLaunch.current && dataset && !loading) {
    pendingAutoLaunch.current = false;
    setTimeout(handleVisualiser, 0);
  }

  const handleExportCSV = () => {
    triggerApiDownload(
      exportSliceCSV({ dataset: selectedDataset, variable: selectedVariable, time: selectedTime, altitude: selectedAltitude }),
      `slice_${selectedVariable}_t${selectedTime}_a${selectedAltitude}.csv`,
    );
  };

  const handleCopyLink = () => {
    const p = new URLSearchParams();
    if (selectedDataset) p.set('ds', selectedDataset);
    if (selectedVariable) p.set('var', selectedVariable);
    p.set('t', String(selectedTime));
    p.set('alt', String(selectedAltitude));
    if (colorscale !== 'auto') p.set('cs', colorscale);
    copyToClipboard(`${window.location.origin}/slice?${p.toString()}`);
  };

  const markDirty = () => { if (sliceData) setIsDirty(true); };

  if (catalogLoading) return <PageLoader />;

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      <Typography variant="h5" gutterBottom>Visualisation 2D — Slice atmospherique</Typography>

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
            <ColorscaleSelector value={colorscale}
              onChange={v => { setColorscale(v); markDirty(); }} />
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={handleVisualiser}
            disabled={!selectedDataset || !selectedVariable || loading}>
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Visualiser'}
          </Button>
          {sliceData && (
            <>
              <VisuToggle value={showLocations} onChange={setShowLocations} icon={<PlaceIcon />}>Points d'interet</VisuToggle>
              <VisuToggle value={showSurface} onChange={setShowSurface} icon={<MapIcon />}>Surface</VisuToggle>
              <VisuToggle value={logScale} onChange={setLogScale} icon={<LogIcon />} title="Echelle logarithmique (log10)">{'Log\u2081\u2080'}</VisuToggle>
            </>
          )}
          {isDirty && (
            <Chip label="Parametres modifies — cliquez sur Visualiser" color="warning" size="small" />
          )}
        </Box>

        <LocationsLegend visible={showLocations && !!sliceData} />

        {sliceData && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <PermalienButton onClick={handleCopyLink} copied={linkCopied} />
            <ExportMenu
              plotRef={exportPlotRef}
              filename={`mars_slice_${selectedVariable || 'plot'}`}
              onCSV={handleExportCSV}
            />
          </Box>
        )}
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box ref={viewerContainerRef}>
        <SliceViewer
          sliceData={sliceData}
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
    </Container>
  );
}

export default SlicePage;
