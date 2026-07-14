import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, MenuItem, Box, IconButton, Menu, Tooltip } from '@mui/material';
import { Language as LanguageIcon } from '@mui/icons-material';

/**
 * Selecteur de langue (EN / FR / NL / ES / DE).
 * Utilise i18next pour changer la langue et la persister dans localStorage.
 *
 * - variante par defaut : Select deroulant, dans le pied de la sidebar depliee.
 * - variante `iconOnly`  : bouton globe + menu, pour le rail replie (sinon la
 *   langue devient inaccessible quand la nav est reduite, notamment sur /explore).
 */

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'nl', label: 'NL' },
  { code: 'es', label: 'ES' },
  { code: 'de', label: 'DE' },
];

function LanguageSwitcher({ iconOnly = false }) {
  const { t, i18n } = useTranslation();
  const current = i18n.language.split('-')[0];
  const [anchorEl, setAnchorEl] = useState(null);

  if (iconOnly) {
    return (
      <>
        <Tooltip title={t('nav.language')} placement="right" arrow>
          <IconButton
            size="small"
            onClick={e => setAnchorEl(e.currentTarget)}
            aria-label={t('nav.language')}
            sx={{ color: 'var(--text-secondary)', p: 1, '&:hover': { color: 'var(--text-primary)' } }}
          >
            <LanguageIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          {LANGUAGES.map(l => (
            <MenuItem
              key={l.code}
              selected={l.code === current}
              onClick={() => { i18n.changeLanguage(l.code); setAnchorEl(null); }}
            >
              {l.label}
            </MenuItem>
          ))}
        </Menu>
      </>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <LanguageIcon sx={{ fontSize: 18, color: 'var(--text-secondary)' }} />
      <Select
        size="small"
        value={current}
        onChange={e => i18n.changeLanguage(e.target.value)}
        variant="standard"
        disableUnderline
        aria-label={t('nav.language')}
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
