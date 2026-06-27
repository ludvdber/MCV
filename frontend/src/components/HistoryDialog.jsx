import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, IconButton, TextField, InputAdornment, Button,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  History as HistoryIcon,
  Layers as SliceIcon,
  ShowChart as TimeSeriesIcon,
  PlayCircleOutline as AnimationIcon,
  Landscape as CrossSectionIcon,
  AlignVerticalBottom as ProfileIcon,
  ViewTimeline as HovmollerIcon,
  Equalizer as ZonalMeanIcon,
  DonutLarge as WindRoseIcon,
  CompareArrows as DifferenceIcon,
  GridOn as TemporalProfileIcon,
  Explore as ExploreIcon,
} from '@mui/icons-material';
import { useRecentHistory } from '../hooks/useRecentHistory';

/** Métadonnées par route : icône, libellé i18n et catégorie (alignées sur la nav). */
const PAGE_META = {
  '/slice':            { icon: SliceIcon,           labelKey: 'nav.slice',           group: 'maps' },
  '/animation':        { icon: AnimationIcon,       labelKey: 'nav.animation',       group: 'maps' },
  '/profile':          { icon: ProfileIcon,         labelKey: 'nav.profile',         group: 'profiles' },
  '/crosssection':     { icon: CrossSectionIcon,    labelKey: 'nav.crosssection',    group: 'profiles' },
  '/temporal-profile': { icon: TemporalProfileIcon, labelKey: 'nav.temporalprofile', group: 'profiles' },
  '/timeseries':       { icon: TimeSeriesIcon,      labelKey: 'nav.timeseries',      group: 'diagnostics' },
  '/hovmoller':        { icon: HovmollerIcon,       labelKey: 'nav.hovmoller',       group: 'diagnostics' },
  '/zonalmean':        { icon: ZonalMeanIcon,       labelKey: 'nav.zonalmean',       group: 'diagnostics' },
  '/windrose':         { icon: WindRoseIcon,        labelKey: 'nav.windrose',        group: 'diagnostics' },
  '/difference':       { icon: DifferenceIcon,      labelKey: 'nav.difference',      group: 'diagnostics' },
  '/explore':          { icon: ExploreIcon,         labelKey: 'nav.explore',         group: 'explore' },
};

const GROUP_ORDER = ['maps', 'profiles', 'diagnostics', 'explore'];
const GROUP_LABEL = {
  maps: 'nav.group.maps',
  profiles: 'nav.group.profiles',
  diagnostics: 'nav.group.diagnostics',
  explore: 'nav.explore',
};

/** Temps relatif localisé (« il y a 5 min ») via l'API Intl native. */
function relativeTime(ts, lang) {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const diffMs = ts - Date.now();
  const min = Math.round(diffMs / 60000);
  const hr = Math.round(diffMs / 3600000);
  const day = Math.round(diffMs / 86400000);
  if (Math.abs(min) < 1) return rtf.format(0, 'second');
  if (Math.abs(min) < 60) return rtf.format(min, 'minute');
  if (Math.abs(hr) < 24) return rtf.format(hr, 'hour');
  return rtf.format(day, 'day');
}

/** Résumé compact des paramètres d'une entrée (dataset, variable, t, altitude, point...). */
function paramSummary(entry) {
  const p = entry.params || {};
  const parts = [];
  if (entry.dataset) parts.push(entry.dataset);
  if (entry.variable && entry.variable !== 'UU/VV') parts.push(entry.variable);
  if (p.datasetB) parts.push(`Δ ${p.datasetB}`);
  if (p.time != null) parts.push(`t${p.time}`);
  if (p.altitude != null) parts.push(`alt ${p.altitude}`);
  if (p.lat != null && p.lon != null) parts.push(`(${p.lat}°, ${p.lon}°)`);
  else if (Array.isArray(p.points)) parts.push(`${p.points.length} pt`);
  return parts.join(' · ');
}

function matchesSearch(entry, q, t) {
  if (!q) return true;
  const meta = PAGE_META[entry.page];
  const name = meta ? t(meta.labelKey) : entry.page;
  const hay = `${name} ${entry.label || ''} ${paramSummary(entry)}`.toLowerCase();
  return hay.includes(q);
}

/** Une ligne d'historique : clic = navigation, plus actions épingler / supprimer. */
function HistoryRow({ entry, onOpen, onTogglePin, onRemove }) {
  const { t, i18n } = useTranslation();
  const meta = PAGE_META[entry.page] || { icon: ExploreIcon, labelKey: 'nav.explore' };
  const Icon = meta.icon;
  const summary = paramSummary(entry);
  return (
    <ListItem
      disablePadding
      secondaryAction={
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title={entry.pinned ? t('history.unpin') : t('history.pin')} arrow>
            <IconButton size="small" aria-label={entry.pinned ? t('history.unpin') : t('history.pin')}
              onClick={() => onTogglePin(entry.id)}
              sx={{ color: entry.pinned ? 'var(--mars-orange)' : 'var(--text-secondary)' }}>
              {entry.pinned ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title={t('history.delete')} arrow>
            <IconButton size="small" aria-label={t('history.delete')}
              onClick={() => onRemove(entry.id)} sx={{ color: 'var(--text-secondary)' }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      }
      sx={{ '& .MuiListItemSecondaryAction-root': { right: 8 } }}
    >
      <ListItemButton onClick={() => onOpen(entry)} sx={{ borderRadius: '8px', pr: 9 }}>
        <ListItemIcon sx={{ minWidth: 36, color: 'var(--mars-orange)' }}>
          <Icon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={t(meta.labelKey)}
          secondary={`${summary}${summary ? ' — ' : ''}${relativeTime(entry.timestamp, i18n.language)}`}
          primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 600 }}
          secondaryTypographyProps={{ fontSize: '0.75rem', noWrap: true }}
        />
      </ListItemButton>
    </ListItem>
  );
}

/**
 * Fenêtre « Historique » : parcours complet des visualisations récentes,
 * regroupées par catégorie, avec recherche, favoris épinglés et suppression.
 * Un clic relance la vue à l'identique (le permalien encode tous les paramètres).
 */
export default function HistoryDialog({ open, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { history, removeEntry, togglePin, clearHistory } = useRecentHistory();
  const [search, setSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => history.filter(e => matchesSearch(e, q, t)), [history, q, t]);
  const pinned = filtered.filter(e => e.pinned);
  const groups = useMemo(() => {
    const rest = filtered.filter(e => !e.pinned);
    return GROUP_ORDER
      .map(g => ({ group: g, entries: rest.filter(e => (PAGE_META[e.page]?.group || 'explore') === g) }))
      .filter(s => s.entries.length > 0);
  }, [filtered]);

  const handleOpen = (entry) => {
    onClose();
    navigate(entry.permalink || entry.page);
  };

  const handleClear = () => {
    if (confirmClear) { clearHistory(); setConfirmClear(false); }
    else { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3000); }
  };

  const renderSection = (titleNode, entries) => (
    <Box sx={{ mb: 1 }}>
      <Typography sx={{
        px: 1, py: 0.5, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: 'var(--text-secondary)',
      }}>
        {titleNode}
      </Typography>
      <List dense disablePadding>
        {entries.map(e => (
          <HistoryRow key={e.id} entry={e} onOpen={handleOpen} onTogglePin={togglePin} onRemove={removeEntry} />
        ))}
      </List>
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon fontSize="small" sx={{ color: 'var(--mars-orange)' }} />
            <Typography component="span" sx={{ fontWeight: 700 }}>{t('history.title')}</Typography>
          </Box>
          <IconButton onClick={onClose} size="small" aria-label={t('common.close')} sx={{ color: 'var(--text-secondary)' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <TextField
          fullWidth size="small" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('history.search')}
          slotProps={{ input: { startAdornment: (
            <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
          ) } }}
        />
      </DialogTitle>

      <DialogContent dividers>
        {history.length === 0 ? (
          <Typography sx={{ py: 3, textAlign: 'center', color: 'var(--text-secondary)' }}>
            {t('history.empty')}
          </Typography>
        ) : filtered.length === 0 ? (
          <Typography sx={{ py: 3, textAlign: 'center', color: 'var(--text-secondary)' }}>
            {t('history.noResults')}
          </Typography>
        ) : (
          <>
            {pinned.length > 0 && renderSection(
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <StarIcon sx={{ fontSize: 13, color: 'var(--mars-orange)' }} /> {t('history.pinned')}
              </Box>,
              pinned,
            )}
            {groups.map(s => (
              <Box key={s.group}>{renderSection(t(GROUP_LABEL[s.group]), s.entries)}</Box>
            ))}
          </>
        )}
      </DialogContent>

      {history.length > 0 && (
        <DialogActions>
          <Button onClick={handleClear} color={confirmClear ? 'error' : 'inherit'}
            startIcon={<DeleteIcon />} size="small">
            {confirmClear ? t('history.clearConfirm') : t('history.clear')}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
