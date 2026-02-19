import { Button } from '@mui/material';

/**
 * Bouton toggle réutilisable : outlined quand inactif, contained + warning quand actif.
 * Remplace le pattern répété dans SlicePage, AnimationPage, CrossSectionPage.
 *
 * @param {boolean}   value     - état actif/inactif
 * @param {function}  onChange  - setter appelé avec !value au clic
 * @param {ReactNode} icon      - prop startIcon (ex: <PlaceIcon />)
 * @param {ReactNode} children  - label affiché dans le bouton
 * @param {string}    [title]   - tooltip natif HTML
 */
function VisuToggle({ value, onChange, icon, children, title }) {
  return (
    <Button
      variant={value ? 'contained' : 'outlined'}
      size="small"
      onClick={() => onChange(!value)}
      startIcon={icon}
      color={value ? 'warning' : 'inherit'}
      title={title}
    >
      {children}
    </Button>
  );
}

export default VisuToggle;
