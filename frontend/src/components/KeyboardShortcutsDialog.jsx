import { Dialog, DialogTitle, DialogContent, Box, Typography, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';

const SHORTCUT_GROUPS = [
  {
    titleKey: 'shortcuts.navigation',
    items: [
      { keys: ['?'], actionKey: 'shortcuts.help' },
      { keys: ['Escape'], actionKey: 'shortcuts.closeDialog' },
      { keys: ['F'], actionKey: 'shortcuts.fullscreen' },
    ],
  },
  {
    titleKey: 'shortcuts.visualization',
    items: [
      { keys: ['Enter'], actionKey: 'shortcuts.launch' },
      { keys: ['Space'], actionKey: 'shortcuts.playPause' },
    ],
  },
];

/**
 * Dialog qui affiche les raccourcis clavier disponibles.
 */
function KeyboardShortcutsDialog({ open, onClose }) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'var(--bg-surface)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(56, 189, 248, 0.15)',
        },
      }}
    >
      <DialogTitle sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, pb: 1 }}>
        {t('shortcuts.title')}
      </DialogTitle>
      <DialogContent>
        {SHORTCUT_GROUPS.map((group) => (
          <Box key={group.titleKey} sx={{ mb: 2.5 }}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ fontSize: '0.7rem', letterSpacing: '0.1em', mb: 1, display: 'block' }}
            >
              {t(group.titleKey)}
            </Typography>
            {group.items.map((item) => (
              <Box
                key={item.actionKey}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  py: 0.8,
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {t(item.actionKey)}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {item.keys.map((key) => (
                    <Chip
                      key={key}
                      label={key}
                      size="small"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        height: 24,
                        minWidth: 32,
                        backgroundColor: 'rgba(56, 189, 248, 0.12)',
                        color: 'var(--text-primary)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                      }}
                    />
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        ))}
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          {t('shortcuts.inputNote')}
        </Typography>
      </DialogContent>
    </Dialog>
  );
}

export default KeyboardShortcutsDialog;
