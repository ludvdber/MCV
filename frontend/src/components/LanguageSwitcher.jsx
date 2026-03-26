import { useTranslation } from 'react-i18next';
import { Select, MenuItem, Box } from '@mui/material';
import { Language as LanguageIcon } from '@mui/icons-material';

/**
 * Selecteur de langue (EN / FR / NL / ES / DE).
 * Utilise i18next pour changer la langue et la persister dans localStorage.
 * Place dans le pied de la sidebar, juste au-dessus du numero de version.
 */

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'nl', label: 'NL' },
  { code: 'es', label: 'ES' },
  { code: 'de', label: 'DE' },
];

function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <LanguageIcon sx={{ fontSize: 18, color: 'var(--text-secondary)' }} />
      <Select
        size="small"
        value={i18n.language.split('-')[0]}
        onChange={e => i18n.changeLanguage(e.target.value)}
        variant="standard"
        disableUnderline
        aria-label="Language"
        sx={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
      >
        {LANGUAGES.map(l => (
          <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>
        ))}
      </Select>
    </Box>
  );
}

export default LanguageSwitcher;
