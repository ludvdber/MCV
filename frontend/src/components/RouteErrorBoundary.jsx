/**
 * Filet de securite au niveau de la ZONE DE CONTENU.
 *
 * L'ErrorBoundary racine (App.jsx) enveloppe aussi la navigation : une page qui
 * plantait emportait la barre laterale avec elle, ne laissant qu'un « retour a
 * l'accueil ». Ici l'erreur reste confinee au <main> : la navigation survit,
 * l'utilisateur passe a une autre vue, et changer de route remonte le composant
 * (key={pathname} chez l'appelant) donc reinitialise l'etat d'erreur.
 *
 * Meme principe que CellErrorBoundary dans l'Explorer, applique aux routes.
 *
 * Composant classe : getDerivedStateFromError n'existe pas en hooks.
 * `t` est passe en prop par l'appelant (qui a deja useTranslation).
 */
import { Component } from 'react';
import { Box, Typography, Button } from '@mui/material';

export default class RouteErrorBoundary extends Component {
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
          justifyContent: 'center', gap: 2, minHeight: '60vh', p: 3, textAlign: 'center',
        }}>
          <Typography variant="h6" component="h1">{t('error.pageTitle')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460 }}>
            {t('error.pageBody')}
          </Typography>
          <Button variant="outlined" onClick={() => this.setState({ hasError: false })}>
            {t('error.retry')}
          </Button>
        </Box>
      );
    }
    return children;
  }
}
