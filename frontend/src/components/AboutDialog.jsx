import {
  Dialog, DialogContent, DialogTitle, IconButton,
  Box, Typography, Stack,
} from '@mui/material';
import {
  Close as CloseIcon,
  GitHub as GitHubIcon,
  Public as PublicIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

const GITHUB_URL = 'https://github.com/ludvdber/MCV';
const IASB_URL = 'https://www.aeronomie.be';

function ExternalLink({ icon: Icon, label, href }) {
  return (
    <Box
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.2,
        p: 1.2,
        borderRadius: 2,
        textDecoration: 'none',
        color: 'var(--text-primary)',
        border: '1px solid var(--glass-border)',
        transition: 'border-color 0.2s ease, background 0.2s ease',
        '&:hover': { borderColor: 'var(--mars-orange)', background: 'var(--bg-surface-hover)' },
      }}
    >
      <Icon sx={{ color: 'var(--mars-orange)', fontSize: 20 }} />
      <Typography sx={{ flex: 1, fontSize: '0.85rem' }}>{label}</Typography>
      <OpenInNewIcon sx={{ fontSize: 15, color: 'var(--text-secondary)' }} />
    </Box>
  );
}

/** Fenêtre « À propos » : présente le projet, sa source de données et les liens utiles. */
export default function AboutDialog({ open, onClose }) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography component="span" sx={{ fontWeight: 700, color: 'var(--mars-orange)' }}>
          {t('about.title')}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label={t('common.close')} sx={{ color: 'var(--text-secondary)' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text-secondary)', mb: 2 }}>
          {t('about.intro')}
        </Typography>

        <Stack spacing={1}>
          <ExternalLink icon={GitHubIcon} label={t('nav.sourceCode')} href={GITHUB_URL} />
          <ExternalLink icon={PublicIcon} label={t('about.institute')} href={IASB_URL} />
        </Stack>

        <Typography sx={{ mt: 2, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          {t('about.dataCredit')}
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: '0.72rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
          v{__APP_VERSION__}
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
