import { memo } from 'react';
import { Button } from '@mui/material';
import { Link as LinkIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

/**
 * Bouton "Permalien" avec retour visuel de copie.
 * Remplace le pattern identique dans les 5 pages de visualisation.
 *
 * @param {function} onClick - handler de copie (construit l'URL et appelle clipboard)
 * @param {boolean}  copied  - true pendant ~2s après une copie réussie
 */
function PermalienButton({ onClick, copied }) {
  const { t } = useTranslation();

  return (
    <Button
      variant="outlined"
      size="small"
      color={copied ? 'success' : 'secondary'}
      onClick={onClick}
      startIcon={<LinkIcon />}
    >
      {copied ? t('common.linkCopied') : t('common.permalink')}
    </Button>
  );
}

export default memo(PermalienButton);
