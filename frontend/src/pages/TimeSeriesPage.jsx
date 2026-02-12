import { useState, useEffect } from 'react';
import { Container, Paper, Typography, Button, CircularProgress, Alert, Box } from '@mui/material';
import Grid from '@mui/material/Grid';
import { getCatalog, getTimeSeries, exportTimeSeriesCSV } from '../services/api';
import { VARIABLES } from '../components/VariableSelector';
import DatasetSelector from '../components/DatasetSelector';
import VariableSelector from '../components/VariableSelector';
import AltitudeSelector from '../components/AltitudeSelector';
import LatLonSelector from '../components/LatLonSelector';
import TimeSeriesChart from '../components/TimeSeriesChart';

/**
 * Page de serie temporelle (UC3 — Cycle diurne martien).
 *
 * Orchestre les selecteurs (dataset, variable, lat/lon, altitude) et le
 * composant TimeSeriesChart pour afficher un line chart des 48 pas de temps.
 *
 * Flux :
 * 1. Au montage, charge le catalogue via GET /api/catalog
 * 2. L'utilisateur choisit un dataset, une variable, un point lat/lon et un niveau
 * 3. Clic sur "Analyser" → GET /api/data/timeseries?dataset=&variable=&latitude=&longitude=&altitude=
 * 4. La reponse (TimeSeriesResponse) est passee a TimeSeriesChart pour le rendu Plotly
 * 5. "Exporter CSV" → GET /api/export/csv/timeseries, telechargement via blob URL
 *
 * handleVariableChange assure le clamping de l'altitude (meme logique que SlicePage).
 * Pour les variables de surface (altitudeType null), altitude=0 est envoye au backend.
 *
 * Valeurs par defaut : variable TT, latitude 0°, longitude 0°, altitude 49.
 */
function TimeSeriesPage() {
  const [datasets, setDatasets] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [selectedVariable, setSelectedVariable] = useState('TT');
  const [selectedLatitude, setSelectedLatitude] = useState(0);
  const [selectedLongitude, setSelectedLongitude] = useState(0);
  const [selectedAltitude, setSelectedAltitude] = useState(49);
  const [timeSeriesData, setTimeSeriesData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getCatalog()
      .then(res => setDatasets(res.data))
      .catch(err => setError(err.message))
      .finally(() => setLoadingCatalog(false));
  }, []);

  const dataset = datasets.find(d => d.id === selectedDataset) || null;
  const datasetLabel = dataset ? `MY${dataset.marsYear} — Ls ${dataset.lsStart}° a ${dataset.lsEnd}°` : '';

  /** Clamping altitude quand la variable change (meme logique que SlicePage) */
  const handleVariableChange = (code) => {
    setSelectedVariable(code);
    const v = VARIABLES.find(v => v.code === code);
    if (!v?.altitudeType) setSelectedAltitude(0);
    else if (v.altitudeType === 'altitudeM' && selectedAltitude > 101) setSelectedAltitude(101);
  };

  /** Appel GET /api/data/timeseries puis mise a jour du graphique */
  const handleAnalyser = () => {
    if (!selectedDataset || !selectedVariable) return;
    setLoading(true);
    setError(null);
    const variable = VARIABLES.find(v => v.code === selectedVariable);
    const altitudeToSend = variable?.altitudeType === null ? 0 : selectedAltitude;
    getTimeSeries({
      dataset: selectedDataset,
      variable: selectedVariable,
      latitude: selectedLatitude,
      longitude: selectedLongitude,
      altitude: altitudeToSend
    })
      .then(res => setTimeSeriesData(res.data))
      .catch(err => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  };

  /** Export CSV via blob URL + telechargement automatique */
  const handleExportCSV = () => {
    const variable = VARIABLES.find(v => v.code === selectedVariable);
    const altitudeToSend = variable?.altitudeType === null ? 0 : selectedAltitude;
    exportTimeSeriesCSV({
      dataset: selectedDataset,
      variable: selectedVariable,
      latitude: selectedLatitude,
      longitude: selectedLongitude,
      altitude: altitudeToSend
    }).then(res => {
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timeseries_${selectedVariable}_lat${selectedLatitude}_lon${selectedLongitude}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  if (loadingCatalog) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 3 }}>
      <Typography variant="h5" gutterBottom>
        Serie temporelle — Cycle diurne martien
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <DatasetSelector datasets={datasets} value={selectedDataset} onChange={setSelectedDataset} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <VariableSelector
              value={selectedVariable}
              onChange={handleVariableChange}
              availableVariables={dataset?.variables}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <LatLonSelector
              latitude={selectedLatitude}
              longitude={selectedLongitude}
              onLatChange={setSelectedLatitude}
              onLonChange={setSelectedLongitude}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <AltitudeSelector
              value={selectedAltitude}
              onChange={setSelectedAltitude}
              variableCode={selectedVariable}
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            onClick={handleAnalyser}
            disabled={!selectedDataset || !selectedVariable || loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Analyser'}
          </Button>
          <Button
            variant="outlined"
            onClick={handleExportCSV}
            disabled={!timeSeriesData || loading}
          >
            Exporter CSV
          </Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TimeSeriesChart timeSeriesData={timeSeriesData} variableCode={selectedVariable} datasetLabel={datasetLabel} />
    </Container>
  );
}

export default TimeSeriesPage;
