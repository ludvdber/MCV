/**
 * Garde-fou de cellule : une vue qui plante ne doit JAMAIS demonter toute
 * l'application (ErrorBoundary racine plein ecran). L'erreur reste confinee
 * a sa cellule, les autres vues continuent de vivre, et un bouton permet de
 * retenter le rendu.
 *
 * Composant classe : getDerivedStateFromError n'existe pas en hooks.
 * `t` est passe en prop par l'appelant (qui a deja useTranslation).
 */
import { Component } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { WarningAmber as WarnIcon } from '@mui/icons-material';

export default class CellErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    const { t, children } = this.props;
    if (this.state.hasError) {
      return (
        <Box sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 1.5, minHeight: 220, p: 2, textAlign: 'center',
        }}>
          <WarnIcon color="warning" />
          <Typography variant="body2" color="text.secondary">
            {t('explore.cellError')}
          </Typography>
          <Button size="small" variant="outlined" onClick={() => this.setState({ hasError: false })}>
            {t('explore.cellRetry')}
          </Button>
        </Box>
      );
    }
    return children;
  }
}
