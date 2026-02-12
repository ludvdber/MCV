import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCatalog } from '../services/api';
import { Box, Container, Typography, CircularProgress, Alert, Button } from '@mui/material';
import DatasetSelector from '../components/DatasetSelector';

/**
 * Page d'accueil de l'application.
 *
 * Au montage, charge le catalogue des datasets NetCDF depuis le backend
 * (GET /api/catalog). Affiche un DatasetSelector pour parcourir les fichiers
 * disponibles et des boutons de navigation vers les pages de visualisation
 * (/slice pour la heatmap 2D, /timeseries pour le cycle diurne,
 * /animation pour l'animation temporelle).
 *
 * Etats geres :
 * - catalog : liste des datasets retournee par le backend
 * - selectedDataset : ID du dataset choisi (non encore transmis aux autres pages)
 * - loading / error : gestion de l'appel API initial
 */
function Home() {
  const [catalog, setCatalog] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getCatalog()
      .then(res => setCatalog(res.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Chargement...</Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert severity="error" sx={{ mt: 4 }}>
          Erreur de connexion au serveur backend : {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h3" gutterBottom>
        Mars Climate Viewer
      </Typography>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        Visualisation des donnees atmospheriques martiennes
      </Typography>

      <Box sx={{ mt: 4, maxWidth: 500 }}>
        <DatasetSelector
          datasets={catalog}
          value={selectedDataset}
          onChange={setSelectedDataset}
        />
      </Box>

      <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
        <Button variant="contained" component={Link} to="/slice">
          Slice 2D
        </Button>
        <Button variant="contained" component={Link} to="/timeseries">
          Serie temporelle
        </Button>
        <Button variant="contained" component={Link} to="/animation">
          Animation
        </Button>
      </Box>
    </Container>
  );
}

export default Home;
