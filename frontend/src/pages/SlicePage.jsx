import { useState, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Container, Paper, Typography, Button, CircularProgress,
  Alert, Box, FormControl, InputLabel, Select, MenuItem, Chip
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { Place as PlaceIcon, Map as MapIcon, Link as LinkIcon, Functions as LogIcon } from '@mui/icons-material';
import { getSlice, exportSliceCSV } from '../services/api';
import { LOCATION_COLORS, LOCATION_TYPE_LABELS } from '../data/marsLocations';
import DatasetSelector from '../components/DatasetSelector';
import VariableSelector from '../components/VariableSelector';
import TimeSelector from '../components/TimeSelector';
import AltitudeSelector from '../components/AltitudeSelector';
import SliceViewer from '../components/SliceViewer';
import ExportMenu from '../components/ExportMenu';
import { useMars } from '../context/MarsContext';
import { COLORSCALE_OPTIONS, RDBU_VARIABLES } from '../utils/colorscales';
import { triggerApiDownload } from '../utils/exportUtils';

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
  const [linkCopied, setLinkCopied] = useState(false);
  const [colorscale, setColorscale] = useState('auto');
  const [isDirty, setIsDirty] = useState(false);

  const viewerContainerRef = useRef(null);
  const [searchParams] = useSearchParams();
  const hasRestoredUrl = useRef(false);
  const pendingAutoLaunch = useRef(false);

  const exportPlotRef = useMemo(() => ({
    get current() {
      return viewerContainerRef.current?.querySelector('.js-plotly-plot') || null;
    }
  }), []);

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
  const resolvedColorscale = useMemo(() => {
    if (colorscale === 'auto') {
      const isTemp = RDBU_VARIABLES.includes(sliceData?.variable ?? selectedVariable);
      return { name: isTemp ? 'RdBu' : 'Viridis', reverse: isTemp };
    }
    const opt = COLORSCALE_OPTIONS.find(o => o.value === colorscale);
    return { name: colorscale, reverse: opt?.reverse || false };
  }, [colorscale, sliceData?.variable, selectedVariable]);

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
    navigator.clipboard.writeText(`${window.location.origin}/slice?${p.toString()}`).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const markDirty = () => { if (sliceData) setIsDirty(true); };

  if (catalogLoading) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

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
            <FormControl fullWidth size="small">
              <InputLabel>Palette de couleurs</InputLabel>
              <Select value={colorscale} label="Palette de couleurs"
                onChange={e => { setColorscale(e.target.value); markDirty(); }}>
                {COLORSCALE_OPTIONS.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={handleVisualiser}
            disabled={!selectedDataset || !selectedVariable || loading}>
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Visualiser'}
          </Button>
          {sliceData && (
            <>
              <Button variant={showLocations ? 'contained' : 'outlined'} size="small"
                onClick={() => setShowLocations(s => !s)} startIcon={<PlaceIcon />}
                color={showLocations ? 'warning' : 'inherit'}>
                Points d'interet
              </Button>
              <Button variant={showSurface ? 'contained' : 'outlined'} size="small"
                onClick={() => setShowSurface(s => !s)} startIcon={<MapIcon />}
                color={showSurface ? 'warning' : 'inherit'}>
                Surface
              </Button>
              <Button variant={logScale ? 'contained' : 'outlined'} size="small"
                onClick={() => setLogScale(s => !s)} startIcon={<LogIcon />}
                color={logScale ? 'warning' : 'inherit'}
                title="Echelle logarithmique (log10)">
                Log\u2081\u2080
              </Button>
            </>
          )}
          {isDirty && (
            <Chip label="Parametres modifies — cliquez sur Visualiser" color="warning" size="small" />
          )}
        </Box>

        {showLocations && sliceData && (
          <Box sx={{ mt: 1.5, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">Legende :</Typography>
            {Object.entries(LOCATION_TYPE_LABELS).map(([type, label]) => (
              <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: LOCATION_COLORS[type] }} />
                <Typography variant="caption">{label}</Typography>
              </Box>
            ))}
          </Box>
        )}

        {sliceData && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button variant="outlined" size="small" color={linkCopied ? 'success' : 'secondary'}
              onClick={handleCopyLink} startIcon={<LinkIcon />}>
              {linkCopied ? 'Lien copie !' : 'Permalien'}
            </Button>
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
