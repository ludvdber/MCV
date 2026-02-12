import { useState, useEffect } from 'react';
import { Container, Paper, Typography, Button, CircularProgress, Alert, Box } from '@mui/material';
import Grid from '@mui/material/Grid';
import { getCatalog, getSlice, exportSliceCSV } from '../services/api';
import { VARIABLES } from '../components/VariableSelector';
import DatasetSelector from '../components/DatasetSelector';
import VariableSelector from '../components/VariableSelector';
import TimeSelector from '../components/TimeSelector';
import AltitudeSelector from '../components/AltitudeSelector';
import SliceViewer from '../components/SliceViewer';

/**
 * Page de visualisation 2D (UC2 — Slice atmospherique).
 *
 * Orchestre les 4 selecteurs (dataset, variable, temps, altitude) et le
 * composant SliceViewer pour afficher une heatmap latitude/longitude.
 *
 * Flux :
 * 1. Au montage, charge le catalogue via GET /api/catalog
 * 2. L'utilisateur choisit un dataset, une variable, un timestep et un niveau
 * 3. Clic sur "Visualiser" → GET /api/data/slice?dataset=&variable=&time=&altitude=
 * 4. La reponse (SliceResponse) est passee a SliceViewer pour le rendu Plotly
 * 5. "Exporter CSV" → GET /api/export/csv/slice, telechargement via blob URL
 *
 * handleVariableChange assure le clamping de l'altitude :
 * - Variable de surface (altitudeType null) → altitude forcee a 0
 * - Variable dynamique (altitudeM, 102 niveaux) → altitude plafonnee a 101
 * - Variable thermodynamique (altitudeT, 103 niveaux) → pas de changement
 *
 * Valeurs par defaut : variable TT (Temperature), timestep 23 (midi martien),
 * altitude 49 (~50 km).
 */
function SlicePage() {
  const [datasets, setDatasets] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [selectedVariable, setSelectedVariable] = useState('TT');
  const [selectedTime, setSelectedTime] = useState(23);
  const [selectedAltitude, setSelectedAltitude] = useState(49);
  const [sliceData, setSliceData] = useState(null);
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

  const handleVariableChange = (code) => {
    setSelectedVariable(code);
    const v = VARIABLES.find(v => v.code === code);
    if (!v?.altitudeType) setSelectedAltitude(0);
    else if (v.altitudeType === 'altitudeM' && selectedAltitude > 101) setSelectedAltitude(101);
  };

  const handleVisualiser = () => {
    if (!selectedDataset || !selectedVariable) return;
    setLoading(true);
    setError(null);
    getSlice({
      dataset: selectedDataset,
      variable: selectedVariable,
      time: selectedTime,
      altitude: selectedAltitude
    })
      .then(res => setSliceData(res.data))
      .catch(err => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  };

  const handleExportCSV = () => {
    exportSliceCSV({
      dataset: selectedDataset,
      variable: selectedVariable,
      time: selectedTime,
      altitude: selectedAltitude
    }).then(res => {
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `slice_${selectedVariable}_t${selectedTime}_a${selectedAltitude}.csv`;
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
        Visualisation 2D — Slice atmospherique
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
          <Grid size={{ xs: 12, md: 6 }}>
            <TimeSelector value={selectedTime} onChange={setSelectedTime} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
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
            onClick={handleVisualiser}
            disabled={!selectedDataset || !selectedVariable || loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Visualiser'}
          </Button>
          <Button
            variant="outlined"
            onClick={handleExportCSV}
            disabled={!sliceData || loading}
          >
            Exporter CSV
          </Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <SliceViewer sliceData={sliceData} variableCode={selectedVariable} datasetLabel={datasetLabel} />
    </Container>
  );
}

export default SlicePage;
