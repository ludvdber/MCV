import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Container, Paper, Typography, Button, CircularProgress,
  Alert, Box, FormControl, InputLabel, Select, MenuItem, TextField, Chip
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
import PageLoader from '../components/PageLoader';
import { useMars } from '../context/MarsContext';
import { triggerApiDownload } from '../utils/exportUtils';
import { usePlotRef } from '../hooks/usePlotRef';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { useResolvedColorscale } from '../hooks/useResolvedColorscale';
import { isSurfaceVariable as checkIsSurface } from '../utils/variableUtils';

/**
 * Page coupe verticale (meridionale / zonale).
 * Supporte les permaliens : ?ds=&var=&t=&type=&fixed=&cs=
 */

function CrossSectionPage() {
  const {
    datasets, catalogLoading,
    selectedDataset, setSelectedDataset,
    selectedVariable, handleVariableChange,
    selectedTime, setSelectedTime,
    selectedLatitude, setSelectedLatitude,
    selectedLongitude, setSelectedLongitude,
    dataset, datasetLabel,
  } = useMars();

  const [csData, setCsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [csType, setCsType] = useState('meridional');
  const [colorscale, setColorscale] = useState('auto');
  const [logScale, setLogScale] = useState(false);
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
      const type = searchParams.get('type');
      if (type) setCsType(type);
      const fixed = searchParams.get('fixed');
      if (fixed != null) {
        const val = parseFloat(fixed);
        if ((type || 'meridional') === 'meridional') setSelectedLongitude(val);
        else setSelectedLatitude(val);
      }
      const cs = searchParams.get('cs');
      if (cs) setColorscale(cs);
      pendingAutoLaunch.current = true;
    }
  }

  const isSurfaceVariable = checkIsSurface(selectedVariable);

  // Utilise la variable de la donnée affichée (pas du formulaire) pour éviter
  // que la palette change avant d'avoir cliqué sur "Analyser".
  const resolvedColorscale = useResolvedColorscale(colorscale, csData?.variable, selectedVariable);

  const fixedCoordinate = csType === 'meridional' ? selectedLongitude : selectedLatitude;

  const handleVisualiser = () => {
    if (!selectedDataset || !selectedVariable) return;
    setLoading(true);
    setError(null);
    setIsDirty(false);
    getCrossSection({ dataset: selectedDataset, variable: selectedVariable, time: selectedTime, type: csType, fixedCoordinate })
      .then(res => setCsData(res.data))
      .catch(err => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  };

  if (pendingAutoLaunch.current && dataset && !loading) {
    pendingAutoLaunch.current = false;
    setTimeout(handleVisualiser, 0);
  }

  const handleExportCSV = () => {
    triggerApiDownload(
      exportCrossSectionCSV({ dataset: selectedDataset, variable: selectedVariable, time: selectedTime, type: csType, fixedCoordinate }),
      `crosssection_${selectedVariable}_${csType}.csv`,
    );
  };

  const handleCopyLink = () => {
    const p = new URLSearchParams();
    if (selectedDataset) p.set('ds', selectedDataset);
    if (selectedVariable) p.set('var', selectedVariable);
    p.set('t', String(selectedTime));
    p.set('type', csType);
    p.set('fixed', String(fixedCoordinate));
    if (colorscale !== 'auto') p.set('cs', colorscale);
    copyToClipboard(`${window.location.origin}/crosssection?${p.toString()}`);
  };

  const markDirty = () => { if (csData) setIsDirty(true); };

  if (catalogLoading) return <PageLoader />;

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      <Typography variant="h5" gutterBottom>Coupe verticale</Typography>

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
              <InputLabel>Type de coupe</InputLabel>
              <Select value={csType} label="Type de coupe"
                onChange={e => { setCsType(e.target.value); markDirty(); }}>
                <MenuItem value="meridional">Meridionale (lon fixee)</MenuItem>
                <MenuItem value="zonal">Zonale (lat fixee)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField size="small"
              label={csType === 'meridional' ? 'Longitude fixee (°)' : 'Latitude fixee (°)'}
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
              onChange={v => { setColorscale(v); markDirty(); }} />
          </Grid>
        </Grid>

        {isSurfaceVariable && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Variable de surface — pas de dimension altitude. Choisissez une variable atmospherique.
          </Alert>
        )}

        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={handleVisualiser}
            disabled={!selectedDataset || !selectedVariable || loading || isSurfaceVariable}>
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Visualiser'}
          </Button>
          {csData && (
            <VisuToggle value={logScale} onChange={setLogScale} icon={<LogIcon />} title="Echelle logarithmique (log10)">{'Log\u2081\u2080'}</VisuToggle>
          )}
          {isDirty && (
            <Chip label="Parametres modifies — cliquez sur Visualiser" color="warning" size="small" />
          )}
        </Box>

        {csData && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <PermalienButton onClick={handleCopyLink} copied={linkCopied} />
            <ExportMenu
              plotRef={exportPlotRef}
              filename={`mars_crosssection_${selectedVariable || 'plot'}`}
              onCSV={handleExportCSV}
            />
          </Box>
        )}
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box ref={viewerContainerRef}>
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
    </Container>
  );
}

export default CrossSectionPage;
