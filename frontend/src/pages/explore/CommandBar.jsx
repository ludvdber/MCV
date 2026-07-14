/**
 * Barre de commande de l'Explorer (Ctrl+K / Cmd+K).
 *
 * On tape une phrase (« TT 50 km Ls 270 14h en coupe vers Jezero »), le
 * parseur deterministe (commandParser.js) la decompose en jetons types et
 * VALIDES contre les catalogues MEAN + INDIVIDUAL, affiches en direct.
 * Entree confie le plan au runner partage (useCommandRunner) qui reutilise
 * l'auto-lancement des permaliens.
 *
 * Pattern « command palette » (Linear, Raycast, VS Code) ancre sur une couche
 * semantique : pas de generation, donc pas d'hallucination possible.
 *
 * Props :
 *   inline — true : le declencheur est un bouton de barre (header console) ;
 *            false : pilule flottante en bas a droite (pages classiques).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Paper, InputBase, Chip, Typography, List, ListItemButton } from '@mui/material';
import { KeyboardCommandKey as CmdIcon, AutoAwesome as SparkIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useMars } from '../../context/MarsContext';
import { useToast } from '../../context/ToastContext';
import { parseCommand } from './commandParser.js';
import { useCommandRunner } from './useCommandRunner.js';

const CHIP_COLORS = {
  variable: { color: '#ff8a55', borderColor: 'rgba(224, 90, 43, 0.55)' },
  altitude: { color: 'var(--cyan-accent, #38bdf8)', borderColor: 'rgba(56, 189, 248, 0.5)' },
  time:     { color: 'var(--sand, #d9a066)', borderColor: 'rgba(217, 160, 102, 0.5)' },
  dataset:  { color: 'var(--sand, #d9a066)', borderColor: 'rgba(217, 160, 102, 0.5)' },
  viz:      { color: '#b39bff', borderColor: 'rgba(139, 92, 246, 0.55)' },
  location: { color: '#4ade80', borderColor: 'rgba(74, 222, 128, 0.45)' },
  missing:  { color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.5)' },
};

export default function CommandBar({ inline = false }) {
  const { t } = useTranslation();
  const showToast = useToast();
  const runPlan = useCommandRunner();
  const { datasets, individualYears } = useMars();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  const parsed = query.trim() ? parseCommand(query, { datasets, individualYears, t }) : { tokens: [], plan: {} };

  const openBar = useCallback(() => { setQuery(''); setOpen(true); }, []);
  const closeBar = useCallback(() => setOpen(false), []);

  /* Ctrl+K / Cmd+K global sur la page Explorer */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) closeBar(); else openBar();
      }
      if (e.key === 'Escape') closeBar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, openBar, closeBar]);

  /* Focus a l'ouverture (pas de setState ici : la saisie est videe a l'ouverture) */
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 40);
  }, [open]);

  const execute = useCallback(async () => {
    const { plan, tokens } = parseCommand(query, { datasets, individualYears, t });
    if (tokens.length === 0 || tokens.every(tk => tk.type === 'missing')) {
      showToast(t('explore.cmdk.nothing'), 'warning');
      return;
    }
    const launched = await runPlan(plan);
    if (launched) closeBar();
  }, [query, datasets, individualYears, t, showToast, runPlan, closeBar]);

  const suggestions = [
    t('explore.cmdk.s1'),
    t('explore.cmdk.s2'),
    t('explore.cmdk.s3'),
  ];

  return (
    <>
      {/* Declencheur : bouton de header (inline) ou pilule flottante */}
      {inline ? (
        <Box
          component="button"
          onClick={openBar}
          aria-label={t('explore.cmdk.trigger')}
          className="mcv-cmdk-btn"
        >
          <SparkIcon sx={{ fontSize: 15, color: 'var(--cyan-accent, #38bdf8)' }} />
          <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t('explore.cmdk.trigger')}
          </Box>
          <Box component="kbd">Ctrl K</Box>
        </Box>
      ) : (
        <Box
          component="button"
          onClick={openBar}
          aria-label={t('explore.cmdk.trigger')}
          sx={{
            all: 'unset', position: 'fixed', right: 22, bottom: 22, zIndex: 1250,
            display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer',
            px: 1.75, py: 0.9, borderRadius: 100,
            bgcolor: 'var(--bg-surface, rgba(13,27,64,.75))',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(0,0,0,.45)',
            color: 'var(--text-secondary, #cbd5e1)', fontSize: 13.5, fontWeight: 600,
            transition: 'border-color .15s, transform .15s',
            '&:hover': { borderColor: 'var(--cyan-accent, #38bdf8)', transform: 'translateY(-2px)' },
          }}
        >
          <SparkIcon sx={{ fontSize: 16, color: 'var(--cyan-accent, #38bdf8)' }} />
          {t('explore.cmdk.trigger')}
          <Box component="kbd" sx={{
            font: '600 11px Rajdhani, sans-serif', px: 0.75, py: 0.1, borderRadius: 1,
            border: '1px solid rgba(255,255,255,.25)', color: 'var(--cyan-accent, #38bdf8)',
          }}>
            Ctrl K
          </Box>
        </Box>
      )}

      {/* Voile + palette */}
      {open && (
        <Box
          onClick={(e) => { if (e.target === e.currentTarget) closeBar(); }}
          sx={{
            position: 'fixed', inset: 0, zIndex: 1300,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            pt: '14vh', bgcolor: 'rgba(2, 6, 16, 0.6)', backdropFilter: 'blur(5px)',
          }}
        >
          <Paper sx={{ width: 'min(640px, 92vw)', overflow: 'hidden', borderRadius: 3 }}>
            <InputBase
              inputRef={inputRef}
              fullWidth
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') execute(); }}
              placeholder={t('explore.cmdk.placeholder')}
              startAdornment={<CmdIcon sx={{ mr: 1.25, opacity: 0.5, fontSize: 19 }} />}
              sx={{ px: 2.25, py: 1.5, fontSize: 17, borderBottom: '1px solid rgba(128,128,128,.2)' }}
            />

            {/* Jetons reconnus */}
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', px: 2, pt: 1.25, minHeight: 30 }}>
              {parsed.tokens.length > 0 ? parsed.tokens.map((tk, i) => (
                <Chip
                  key={`${tk.type}-${i}`}
                  size="small"
                  label={tk.label}
                  sx={{ fontWeight: 600, bgcolor: 'transparent', border: '1px solid', ...CHIP_COLORS[tk.type] }}
                />
              )) : (
                <Typography variant="caption" sx={{ opacity: 0.55 }}>
                  {t('explore.cmdk.empty')}
                </Typography>
              )}
            </Box>

            {/* Suggestions d'exemples */}
            <List dense sx={{ px: 1, py: 0.75 }}>
              {suggestions.map((s) => (
                <ListItemButton
                  key={s}
                  onClick={() => { setQuery(s); inputRef.current?.focus(); }}
                  sx={{ borderRadius: 2, fontSize: 14.5, color: 'var(--text-secondary)', gap: 1.25 }}
                >
                  <SparkIcon sx={{ fontSize: 14, color: 'var(--cyan-accent, #38bdf8)' }} />
                  {s}
                </ListItemButton>
              ))}
            </List>

            <Box sx={{
              display: 'flex', gap: 2.5, px: 2, py: 1,
              borderTop: '1px solid rgba(128,128,128,.2)', fontSize: 12, opacity: 0.65,
            }}>
              <span><b>↵</b> {t('explore.cmdk.launch')}</span>
              <span><b>Esc</b> {t('explore.cmdk.close')}</span>
              <span>{t('explore.cmdk.grounded')}</span>
            </Box>
          </Paper>
        </Box>
      )}
    </>
  );
}
