import { useState, useEffect } from 'react';
import { Container, Paper, Typography, Button, CircularProgress, Alert, Box } from '@mui/material';
import Grid from '@mui/material/Grid';
import { getCatalog, getAnimation } from '../services/api';
import { VARIABLES } from '../components/VariableSelector';
import DatasetSelector from '../components/DatasetSelector';
import VariableSelector from '../components/VariableSelector';
import AltitudeSelector from '../components/AltitudeSelector';
import AnimationPlayer from '../components/AnimationPlayer';

/**
 * Page d'animation du cycle diurne (UC4 — Animation temporelle).
 *
 * Orchestre les selecteurs (dataset, variable, altitude) et le composant
 * AnimationPlayer pour afficher 48 frames de heatmap animees.
 *
 * Flux :
 * 1. Au montage, charge le catalogue via GET /api/catalog
 * 2. L'utilisateur choisit un dataset, une variable et un niveau d'altitude
 * 3. Clic sur "Charger l'animation" → GET /api/data/animation?dataset=&variable=&altitude=
 * 4. La reponse (~1.8 MB, 48 frames) est passee a AnimationPlayer
 *
 * Pas de TimeSelector (les 48 timesteps sont charges d'un coup).
 * Pas d'export CSV (non prevu cote backend pour l'animation).
 *
 * handleVariableChange assure le clamping de l'altitude (meme logique que SlicePage).
 * Pour les variables de surface (altitudeType null), altitude=0 est envoye au backend.
 *
 * Valeurs par defaut : variable TT (Temperature), altitude 49 (~50 km).
 */
function AnimationPage() {
  const [datasets, setDatasets] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [selectedVariable, setSelectedVariable] = useState('TT');
  const [selectedAltitude, setSelectedAltitude] = useState(49);
  const [animationData, setAnimationData] = useState(null);
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

  /** Appel GET /api/data/animation puis mise a jour du player */
  const handleCharger = () => {
    if (!selectedDataset || !selectedVariable) return;
    setLoading(true);
    setError(null);
    const variable = VARIABLES.find(v => v.code === selectedVariable);
    const altitudeToSend = variable?.altitudeType === null ? 0 : selectedAltitude;
    getAnimation({
      dataset: selectedDataset,
      variable: selectedVariable,
      altitude: altitudeToSend
    })
      .then(res => setAnimationData(res.data))
      .catch(err => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
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
        Animation — Cycle diurne martien
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
            <AltitudeSelector
              value={selectedAltitude}
              onChange={setSelectedAltitude}
              variableCode={selectedVariable}
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="contained"
            onClick={handleCharger}
            disabled={!selectedDataset || !selectedVariable || loading}
          >
            {loading ? <CircularProgress size={20} /> : "Charger l'animation"}
          </Button>
          <Typography variant="caption" color="text.secondary">
            Le chargement peut prendre quelques secondes (~1.8 MB)
          </Typography>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <AnimationPlayer animationData={animationData} variableCode={selectedVariable} datasetLabel={datasetLabel} />
    </Container>
  );
}

export default AnimationPage;
