import { Container, Box, CircularProgress } from '@mui/material';

/**
 * Indicateur de chargement centre, affiché pendant le chargement du catalogue.
 * Remplace le bloc if (catalogLoading) return (...) identique dans toutes les pages.
 */
function PageLoader() {
  return (
    <Container>
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    </Container>
  );
}

export default PageLoader;
