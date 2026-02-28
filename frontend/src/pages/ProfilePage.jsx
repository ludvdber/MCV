import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Container, Paper, Typography, Button, CircularProgress, Alert, Box, Chip } from '@mui/material';
import Grid from '@mui/material/Grid';
import { getProfile, exportProfileCSV } from '../services/api';
import PermalienButton from '../components/PermalienButton';
import DatasetSelector from '../components/DatasetSelector';
import VariableSelector from '../components/VariableSelector';
import TimeSelector from '../components/TimeSelector';
import LatLonSelector from '../components/LatLonSelector';
import ProfileViewer from '../components/ProfileViewer';
import ExportMenu from '../components/ExportMenu';
import PageLoader from '../components/PageLoader';
import { useTranslation } from 'react-i18next';
import { useMars } from '../context/MarsContext';
import { usePlotRef } from '../hooks/usePlotRef';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { isSurfaceVariable as checkIsSurface } from '../utils/variableUtils';

/**
 * Page profil vertical (UC) — affiche la valeur d'une variable sur tous les niveaux
 * d'altitude en un point geographique et un pas de temps donne.
 * Supporte les permaliens : ?ds=&var=&t=&lat=&lon=
 */
function ProfilePage() {
  const {
    datasets, catalogLoading,
    selectedDataset, setSelectedDataset,
    selectedVariable, handleVariableChange,
    selectedTime, setSelectedTime,
    selectedLatitude, setSelectedLatitude,
    selectedLongitude, setSelectedLongitude,
    dataset, datasetLabel,
  } = useMars();
  const { t } = useTranslation();

  const [profileData, setProfileData] = useState(null);
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
      const t = searchParams.get('t');
      if (t != null) setSelectedTime(parseInt(t, 10));
      const lat = searchParams.get('lat');
      if (lat != null) setSelectedLatitude(parseFloat(lat));
      const lon = searchParams.get('lon');
      if (lon != null) setSelectedLongitude(parseFloat(lon));
      pendingAutoLaunch.current = true;
    }
  }

  const isSurfaceVariable = checkIsSurface(selectedVariable);

  const handleAnalyser = () => {
    if (!selectedDataset || !selectedVariable) return;
    setLoading(true);
    setError(null);
    setIsDirty(false);
    getProfile({
      dataset: selectedDataset,
      variable: selectedVariable,
      time: selectedTime,
      latitude: selectedLatitude,
      longitude: selectedLongitude,
    })
      .then(res => setProfileData(res.data))
      .catch(err => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  };

  if (pendingAutoLaunch.current && dataset && !loading) {
    pendingAutoLaunch.current = false;
    setTimeout(handleAnalyser, 0);
  }

  const handleExportCSV = () => {
    exportProfileCSV({
      dataset: selectedDataset,
      variable: selectedVariable,
      time: selectedTime,
      latitude: selectedLatitude,
      longitude: selectedLongitude,
    }).then(res => {
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `profile_${selectedVariable}_lat${selectedLatitude}_lon${selectedLongitude}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }).catch(() => {});
  };

  const handleCopyLink = () => {
    const p = new URLSearchParams();
    if (selectedDataset) p.set('ds', selectedDataset);
    if (selectedVariable) p.set('var', selectedVariable);
    p.set('t', String(selectedTime));
    p.set('lat', String(selectedLatitude));
    p.set('lon', String(selectedLongitude));
    copyToClipboard(`${window.location.origin}/profile?${p.toString()}`);
  };

  const markDirty = () => { if (profileData) setIsDirty(true); };

  if (catalogLoading) return <PageLoader />;

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      <Typography variant="h5" gutterBottom>{t('page.profile.title')}</Typography>

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
          <Grid size={{ xs: 12 }}>
            <LatLonSelector
              latitude={selectedLatitude}
              longitude={selectedLongitude}
              onLatChange={v => { setSelectedLatitude(v); markDirty(); }}
              onLonChange={v => { setSelectedLongitude(v); markDirty(); }}
            />
          </Grid>
        </Grid>

        {isSurfaceVariable && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {t('page.profile.surfaceAlert')}
          </Alert>
        )}

        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={handleAnalyser}
            disabled={!selectedDataset || !selectedVariable || loading || isSurfaceVariable}>
            {loading ? <CircularProgress size={20} color="inherit" /> : t('page.profile.button')}
          </Button>
          {isDirty && (
            <Chip label={t('page.profile.dirty')} color="warning" size="small" />
          )}
        </Box>

        {profileData && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <PermalienButton onClick={handleCopyLink} copied={linkCopied} />
            <ExportMenu
              plotRef={exportPlotRef}
              filename={`mars_profile_${selectedVariable || 'plot'}`}
              onCSV={handleExportCSV}
            />
          </Box>
        )}
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box ref={viewerContainerRef}>
        <ProfileViewer
          profileData={profileData}
          variableCode={selectedVariable}
          datasetLabel={datasetLabel}
          noExportMenu
        />
      </Box>
    </Container>
  );
}

export default ProfilePage;
