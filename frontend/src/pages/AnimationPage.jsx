import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Container, Paper, Typography, Button, CircularProgress,
  Alert, Box, Chip
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { Place as PlaceIcon, Map as MapIcon, Functions as LogIcon } from '@mui/icons-material';
import { getAnimation } from '../services/api';
import DatasetSelector from '../components/DatasetSelector';
import VariableSelector from '../components/VariableSelector';
import AltitudeSelector from '../components/AltitudeSelector';
import AnimationPlayer from '../components/AnimationPlayer';
import ExportMenu from '../components/ExportMenu';
import VisuToggle from '../components/VisuToggle';
import PermalienButton from '../components/PermalienButton';
import ColorscaleSelector from '../components/ColorscaleSelector';
import LocationsLegend from '../components/LocationsLegend';
import PageLoader from '../components/PageLoader';
import { useMars } from '../context/MarsContext';
import { downloadAnimationCSV } from '../utils/exportUtils';
import { usePlotRef } from '../hooks/usePlotRef';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { useResolvedColorscale } from '../hooks/useResolvedColorscale';
import { isSurfaceVariable } from '../utils/variableUtils';

/**
 * Page d'animation (UC4).
 * Supporte les permaliens : ?ds=&var=&alt=&cs=
 */

function AnimationPage() {
  const {
    datasets, catalogLoading,
    selectedDataset, setSelectedDataset,
    selectedVariable, handleVariableChange,
    selectedAltitude, setSelectedAltitude,
    dataset, datasetLabel,
  } = useMars();

  const [animationData, setAnimationData] = useState(null);
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
      const alt = searchParams.get('alt');
      if (alt != null) setSelectedAltitude(parseInt(alt, 10));
      const cs = searchParams.get('cs');
      if (cs) setColorscale(cs);
      pendingAutoLaunch.current = true;
    }
  }

  // Utilise la variable de la donnée affichée (pas du formulaire) pour éviter
  // que la palette change avant d'avoir cliqué sur "Charger".
  const resolvedColorscale = useResolvedColorscale(colorscale, animationData?.variable, selectedVariable);

  const handleCharger = () => {
    if (!selectedDataset || !selectedVariable) return;
    setLoading(true);
    setError(null);
    setIsDirty(false);
    const altitudeToSend = isSurfaceVariable(selectedVariable) ? 0 : selectedAltitude;
    getAnimation({ dataset: selectedDataset, variable: selectedVariable, altitude: altitudeToSend })
      .then(res => setAnimationData(res.data))
      .catch(err => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  };

  if (pendingAutoLaunch.current && dataset && !loading) {
    pendingAutoLaunch.current = false;
    setTimeout(handleCharger, 0);
  }

  const handleCopyLink = () => {
    const p = new URLSearchParams();
    if (selectedDataset) p.set('ds', selectedDataset);
    if (selectedVariable) p.set('var', selectedVariable);
    p.set('alt', String(selectedAltitude));
    if (colorscale !== 'auto') p.set('cs', colorscale);
    copyToClipboard(`${window.location.origin}/animation?${p.toString()}`);
  };

  /** Export CSV client-side : stats par frame (min/max/mean sur lat×lon) */
  const handleExportCSV = () => {
    if (!animationData) return;
    downloadAnimationCSV(animationData.frames, selectedVariable, selectedAltitude);
  };

  const markDirty = () => { if (animationData) setIsDirty(true); };

  if (catalogLoading) return <PageLoader />;

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      <Typography variant="h5" gutterBottom>Animation — Cycle diurne martien</Typography>

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
          <Grid size={{ xs: 12, md: 8 }}>
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
          <Button variant="contained" onClick={handleCharger}
            disabled={!selectedDataset || !selectedVariable || loading}>
            {loading ? <CircularProgress size={20} color="inherit" /> : "Charger l'animation"}
          </Button>
          {animationData && (
            <>
              <VisuToggle value={showLocations} onChange={setShowLocations} icon={<PlaceIcon />}>Points d'interet</VisuToggle>
              <VisuToggle value={showSurface} onChange={setShowSurface} icon={<MapIcon />}>Surface</VisuToggle>
              <VisuToggle value={logScale} onChange={setLogScale} icon={<LogIcon />} title="Echelle logarithmique (log10)">{'Log\u2081\u2080'}</VisuToggle>
            </>
          )}
          {isDirty && (
            <Chip label="Parametres modifies — rechargez l'animation" color="warning" size="small" />
          )}
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Charge 48 pas de temps consecutifs. Le chargement peut prendre plusieurs secondes selon votre connexion.
        </Typography>

        <LocationsLegend visible={showLocations && !!animationData} />

        {animationData && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <PermalienButton onClick={handleCopyLink} copied={linkCopied} />
            <ExportMenu
              plotRef={exportPlotRef}
              filename={`mars_animation_${selectedVariable || 'plot'}`}
              onCSV={handleExportCSV}
            />
          </Box>
        )}
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box ref={viewerContainerRef}>
        <AnimationPlayer
          animationData={animationData}
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

export default AnimationPage;
