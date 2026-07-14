import { useState } from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, List, ListItemButton,
  ListItemIcon, ListItemText, Drawer, IconButton,
  Tooltip, useMediaQuery, useTheme, Collapse,
} from '@mui/material';
import {
  Home as HomeIcon,
  Layers as SliceIcon,
  ShowChart as TimeSeriesIcon,
  PlayCircleOutline as AnimationIcon,
  Landscape as CrossSectionIcon,
  Explore as ExploreIcon,
  AlignVerticalBottom as ProfileIcon,
  ViewTimeline as HovmollerIcon,
  Equalizer as ZonalMeanIcon,
  DonutLarge as WindRoseIcon,
  CompareArrows as DifferenceIcon,
  GridOn as TemporalProfileIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  History as HistoryIcon,
  Keyboard as KeyboardIcon,
  ExpandLess,
  ExpandMore,
  Delete as DeleteIcon,
  Map as MapsIcon,
  Timeline as ProfilesIcon,
  BarChart as DiagnosticsIcon,
} from '@mui/icons-material';
import { DarkMode as DarkModeIcon, LightMode as LightModeIcon, Contrast as ContrastIcon, InfoOutlined as AboutIcon, Science as ScienceIcon } from '@mui/icons-material';
import MethodologyDialog from './MethodologyDialog';
import LanguageSwitcher from './LanguageSwitcher';
import AboutDialog from './AboutDialog';
import HistoryDialog from './HistoryDialog';
import { useThemeMode } from '../context/ThemeContext';
import { useRecentHistory } from '../hooks/useRecentHistory';

export const SIDEBAR_WIDTH_EXPANDED = 220;
export const SIDEBAR_WIDTH_COLLAPSED = 64;

/* ---------- Grouped navigation structure ---------- */

const NAV_GROUPS = [
  {
    id: 'maps',
    labelKey: 'nav.group.maps',
    icon: MapsIcon,
    items: [
      { labelKey: 'nav.slice',      to: '/slice',      icon: SliceIcon },
      { labelKey: 'nav.animation',  to: '/animation',  icon: AnimationIcon },
    ],
  },
  {
    id: 'profiles',
    labelKey: 'nav.group.profiles',
    icon: ProfilesIcon,
    items: [
      { labelKey: 'nav.profile',          to: '/profile',           icon: ProfileIcon },
      { labelKey: 'nav.crosssection',     to: '/crosssection',     icon: CrossSectionIcon },
      { labelKey: 'nav.temporalprofile',  to: '/temporal-profile',  icon: TemporalProfileIcon },
    ],
  },
  {
    id: 'diagnostics',
    labelKey: 'nav.group.diagnostics',
    icon: DiagnosticsIcon,
    items: [
      { labelKey: 'nav.timeseries', to: '/timeseries', icon: TimeSeriesIcon },
      { labelKey: 'nav.hovmoller',  to: '/hovmoller',  icon: HovmollerIcon },
      { labelKey: 'nav.zonalmean',  to: '/zonalmean',  icon: ZonalMeanIcon },
      { labelKey: 'nav.windrose',   to: '/windrose',   icon: WindRoseIcon },
      { labelKey: 'nav.difference', to: '/difference',  icon: DifferenceIcon },
    ],
  },
];

const PAGE_ICONS = {
  '/slice': SliceIcon,
  '/timeseries': TimeSeriesIcon,
  '/animation': AnimationIcon,
  '/crosssection': CrossSectionIcon,
  '/profile': ProfileIcon,
  '/hovmoller': HovmollerIcon,
  '/zonalmean': ZonalMeanIcon,
  '/windrose': WindRoseIcon,
  '/difference': DifferenceIcon,
  '/temporal-profile': TemporalProfileIcon,
  '/explore': ExploreIcon,
};

function MarsLogo({ size = 40 }) {
  return (
    <img
      src="/logo.webp"
      alt="MCV"
      width={size}
      height={size}
      style={{
        borderRadius: '50%',
        objectFit: 'cover',
        filter: 'drop-shadow(0 0 8px rgba(224,90,43,0.4))',
      }}
    />
  );
}

function timeAgo(ts, t) {
  const diff = Date.now() - ts;
  if (diff < 60000) return t('history.timeAgo.now');
  if (diff < 3600000) return t('history.timeAgo.minutes', { count: Math.floor(diff / 60000) });
  if (diff < 86400000) return t('history.timeAgo.hours', { count: Math.floor(diff / 3600000) });
  return t('history.timeAgo.days', { count: Math.floor(diff / 86400000) });
}

/** Infobulle d'une entrée d'historique : libellé complet (non tronqué) + date exacte. */
function historyTooltip(entry) {
  return `${entry.label} · ${new Date(entry.timestamp).toLocaleString()}`;
}

/** Vrai si l'entrée correspond à la page + paramètres actuellement affichés. */
function isActiveEntry(entry, location) {
  if (!entry.permalink) return location.pathname === entry.page;
  const [path, query = ''] = entry.permalink.split('?');
  if (path !== location.pathname) return false;
  const a = new URLSearchParams(query); a.sort();
  const b = new URLSearchParams(location.search); b.sort();
  return a.toString() === b.toString();
}

/* ---------- Nav item (single link) ---------- */

function NavItem({ labelKey, to, icon: Icon, collapsed, onClose, nested = false }) {
  const { t } = useTranslation();
  const button = (
    <ListItemButton
      component={NavLink}
      to={to}
      end={to === '/'}
      onClick={onClose}
      sx={{
        borderRadius: '8px',
        mb: 0.3,
        px: collapsed ? 0 : (nested ? 1.5 : 2),
        pl: collapsed ? 0 : (nested ? 3 : 2),
        py: nested ? 0.8 : 1.2,
        justifyContent: collapsed ? 'center' : 'flex-start',
        color: 'var(--text-secondary)',
        transition: 'all 0.2s ease',
        '&:hover': { background: 'var(--bg-surface-hover)' },
        '&.active': {
          background: 'var(--bg-surface-hover)',
          borderLeft: '3px solid var(--mars-orange)',
          color: 'var(--mars-orange)',
          '& .MuiListItemIcon-root': { color: 'var(--mars-orange)' },
        },
      }}
    >
      <ListItemIcon sx={{ minWidth: collapsed ? 0 : 32, color: 'inherit', justifyContent: 'center' }}>
        <Icon sx={{ fontSize: nested ? 18 : 20 }} />
      </ListItemIcon>
      {!collapsed && (
        <ListItemText
          primary={t(labelKey)}
          primaryTypographyProps={{ fontSize: nested ? '0.82rem' : '0.9rem', fontWeight: 500 }}
        />
      )}
    </ListItemButton>
  );

  return collapsed ? (
    <Tooltip title={t(labelKey)} placement="right" arrow>
      {button}
    </Tooltip>
  ) : button;
}

/* ---------- Nav section (intertitre cliquable + liens repliables) ----------
   Chaque groupe se replie : indispensable sur petits écrans, où dix liens
   dépliés noient la navigation. État persisté dans localStorage ; ouverts
   par défaut sur desktop, repliés par défaut sous le breakpoint md. */

const NAV_GROUPS_KEY = 'mcv-nav-groups-v1';

/** État initial des groupes : localStorage, sinon selon la largeur d'écran. */
function defaultOpenGroups() {
  try {
    const saved = JSON.parse(localStorage.getItem(NAV_GROUPS_KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      return Object.fromEntries(NAV_GROUPS.map(g => [g.id, saved[g.id] !== false]));
    }
  } catch { /* stockage indisponible : on retombe sur la largeur d'écran */ }
  const wide = window.matchMedia('(min-width: 900px)').matches;
  return Object.fromEntries(NAV_GROUPS.map(g => [g.id, wide]));
}

function NavSection({ group, collapsed, onClose, open, onToggle }) {
  const { t } = useTranslation();
  // Replié : uniquement les icônes des liens, à plat.
  if (collapsed) {
    return group.items.map(item => (
      <NavItem key={item.to} {...item} collapsed onClose={onClose} />
    ));
  }
  return (
    <>
      <ListItemButton
        onClick={onToggle}
        aria-expanded={open}
        sx={{
          borderRadius: '8px', mt: 0.5, py: 0.35, px: 2,
          '&:hover': { background: 'var(--bg-surface-hover)' },
        }}
      >
        <ListItemText
          primary={t(group.labelKey)}
          primaryTypographyProps={{
            fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--text-secondary)', sx: { opacity: 0.72 },
          }}
        />
        {open
          ? <ExpandLess sx={{ fontSize: 16, color: 'var(--text-secondary)', opacity: 0.72 }} />
          : <ExpandMore sx={{ fontSize: 16, color: 'var(--text-secondary)', opacity: 0.72 }} />}
      </ListItemButton>
      <Collapse in={open} timeout="auto">
        {group.items.map(item => (
          <NavItem key={item.to} {...item} collapsed={false} onClose={onClose} nested />
        ))}
      </Collapse>
    </>
  );
}

/* ---------- Explorer : la console, accès principal du site ---------- */

function ExplorerNavItem({ collapsed, onClose }) {
  const { t } = useTranslation();
  const button = (
    <ListItemButton
      component={NavLink}
      to="/explore"
      onClick={onClose}
      sx={{
        borderRadius: '10px',
        mt: 0.5, mb: 0.5,
        px: collapsed ? 0 : 2,
        py: 1.05,
        justifyContent: collapsed ? 'center' : 'flex-start',
        color: 'var(--mars-orange)',
        background: 'rgba(224, 90, 43, 0.08)',
        border: '1px solid rgba(224, 90, 43, 0.3)',
        transition: 'all 0.2s ease',
        '&:hover': { background: 'rgba(224, 90, 43, 0.16)' },
        '&.active': {
          background: 'rgba(224, 90, 43, 0.18)',
          borderColor: 'rgba(224, 90, 43, 0.55)',
        },
      }}
    >
      <ListItemIcon sx={{ minWidth: collapsed ? 0 : 32, color: 'inherit', justifyContent: 'center' }}>
        <ExploreIcon sx={{ fontSize: 20 }} />
      </ListItemIcon>
      {!collapsed && (
        <ListItemText
          primary={t('nav.explore')}
          primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 700 }}
        />
      )}
      {!collapsed && (
        <Typography component="span" sx={{
          fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.09em',
          border: '1px solid rgba(224, 90, 43, 0.45)', borderRadius: '5px',
          px: 0.6, py: 0.1, opacity: 0.9, flexShrink: 0,
        }}>
          {t('nav.consoleBadge')}
        </Typography>
      )}
    </ListItemButton>
  );
  return collapsed
    ? <Tooltip title={t('nav.explore')} placement="right" arrow>{button}</Tooltip>
    : button;
}

/* ---------- Sidebar content ---------- */

function SidebarContent({ onClose, collapsed = false, onShortcutsOpen }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mode, toggleTheme, highContrast, toggleContrast } = useThemeMode();
  const width = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;
  const location = useLocation();
  const { history, clearHistory } = useRecentHistory();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [methodsOpen, setMethodsOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState(defaultOpenGroups);

  const toggleGroup = (id) => {
    const next = { ...openGroups, [id]: !openGroups[id] };
    setOpenGroups(next);
    try { localStorage.setItem(NAV_GROUPS_KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ }
  };

  // Effacement de l'historique en deux temps (1er clic arme, 2e confirme).
  const requestClear = () => {
    if (confirmClear) {
      clearHistory();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  return (
    <Box
      sx={{
        width,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderRight: '1px solid var(--glass-border)',
        overflow: 'hidden',
        transition: 'width 0.2s ease',
      }}
    >
      {/* --- Header: Logo --- */}
      <Box
        sx={{
          p: collapsed ? 1.5 : 2.5,
          pb: collapsed ? 1 : 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        <Box
          onClick={() => { navigate('/'); onClose(); }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            cursor: 'pointer',
            justifyContent: collapsed ? 'center' : 'flex-start',
            '&:hover': { opacity: 0.8 },
          }}
        >
          <MarsLogo size={collapsed ? 34 : 40} />
          {!collapsed && (
            <Box>
              <Typography
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--mars-orange)',
                  textShadow: '0 0 16px rgba(224, 90, 43, 0.5)',
                  lineHeight: 1.2,
                }}
              >
                MCV
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.2,
                }}
              >
                Mars Climate Viewer
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* --- Navigation --- */}
      <Box sx={{ flex: 1, overflow: 'auto', px: collapsed ? 0.5 : 1, pt: 0.5 }}>
        <List disablePadding>
          {/* Accueil, puis la console Explorer : l'outil phare, mis en avant */}
          <NavItem labelKey="nav.home" to="/" icon={HomeIcon} collapsed={collapsed} onClose={onClose} />
          <ExplorerNavItem collapsed={collapsed} onClose={onClose} />

          {/* Vues simples : groupes repliables, état persisté */}
          {NAV_GROUPS.map(group => (
            <NavSection
              key={group.id}
              group={group}
              collapsed={collapsed}
              onClose={onClose}
              open={!!openGroups[group.id]}
              onToggle={() => toggleGroup(group.id)}
            />
          ))}
        </List>
      </Box>

      {/* --- Historique recent --- */}
      {!collapsed && history.length > 0 && (
        <Box sx={{ px: 1, borderTop: '1px solid var(--glass-border)' }}>
          <ListItemButton
            onClick={() => setHistoryOpen(v => !v)}
            sx={{ borderRadius: '8px', py: 0.8, px: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: 32, color: 'var(--text-secondary)' }}>
              <HistoryIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={t('history.title')}
              primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)' }}
            />
            {historyOpen ? <ExpandLess sx={{ fontSize: 18, color: 'var(--text-secondary)' }} /> : <ExpandMore sx={{ fontSize: 18, color: 'var(--text-secondary)' }} />}
          </ListItemButton>
          <Collapse in={historyOpen} timeout="auto">
            <List dense disablePadding sx={{ pl: 1, pr: 0.5, pb: 0.5 }}>
              {history.slice(0, 5).map(entry => {
                const Icon = PAGE_ICONS[entry.page] || ExploreIcon;
                const active = isActiveEntry(entry, location);
                return (
                  <Tooltip key={entry.id} title={historyTooltip(entry)} placement="right" arrow enterDelay={500}>
                  <ListItemButton
                    component={Link}
                    to={entry.permalink || entry.page}
                    onClick={onClose}
                    sx={{
                      borderRadius: '6px',
                      py: 0.4,
                      px: 1,
                      mb: 0.3,
                      borderLeft: active ? '2px solid var(--mars-orange)' : '2px solid transparent',
                      background: active ? 'var(--bg-surface-hover)' : 'transparent',
                      '&:hover': { background: 'var(--bg-surface-hover)' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 26, color: active ? 'var(--mars-orange)' : 'var(--text-secondary)' }}>
                      <Icon sx={{ fontSize: 16 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={entry.label}
                      secondary={timeAgo(entry.timestamp, t)}
                      primaryTypographyProps={{ fontSize: '0.78rem', noWrap: true, color: active ? 'var(--mars-orange)' : undefined }}
                      secondaryTypographyProps={{ fontSize: '0.65rem' }}
                    />
                  </ListItemButton>
                  </Tooltip>
                );
              })}
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.3 }}>
                <ListItemButton
                  onClick={() => setHistoryDialogOpen(true)}
                  sx={{ borderRadius: '6px', py: 0.3, px: 1, flex: 1 }}
                >
                  <ListItemText
                    primary={t('history.seeAll', { count: history.length })}
                    primaryTypographyProps={{ fontSize: '0.72rem', color: 'secondary.main', textAlign: 'center' }}
                  />
                </ListItemButton>
                <Tooltip title={confirmClear ? t('history.clearConfirm') : t('history.clear')} placement="top" arrow>
                  <ListItemButton
                    onClick={requestClear}
                    sx={{ borderRadius: '6px', py: 0.3, px: 1, flex: confirmClear ? 1 : 0, minWidth: 'auto' }}
                  >
                    <ListItemIcon sx={{ minWidth: 26, color: confirmClear ? 'var(--mars-orange)' : 'var(--text-secondary)' }}>
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </ListItemIcon>
                    {confirmClear && (
                      <ListItemText
                        primary={t('history.clearConfirm')}
                        primaryTypographyProps={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--mars-orange)' }}
                      />
                    )}
                  </ListItemButton>
                </Tooltip>
              </Box>
            </List>
          </Collapse>
        </Box>
      )}

      {/* --- Historique : fenêtre complète (groupée, recherche, favoris) --- */}
      <HistoryDialog open={historyDialogOpen} onClose={() => setHistoryDialogOpen(false)} />

      {/* --- Pied --- */}
      <Box
        sx={{
          p: collapsed ? 1 : 2,
          borderTop: '1px solid var(--glass-border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: collapsed ? 'center' : 'stretch',
          gap: 1,
        }}
      >
        {!collapsed && onShortcutsOpen && (
          <Box
            onClick={onShortcutsOpen}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.8, cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: '0.75rem',
              '&:hover': { color: 'var(--text-primary)' },
            }}
          >
            <KeyboardIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" color="inherit">{t('shortcuts.title')}</Typography>
            <Typography variant="caption" sx={{ ml: 'auto', fontFamily: 'monospace', fontSize: '0.65rem', opacity: 0.6 }}>?</Typography>
          </Box>
        )}
        {/* Historique (accès en mode replié, où l'aperçu est masqué) */}
        {collapsed && history.length > 0 && (
          <Tooltip title={t('history.title')} placement="right" arrow>
            <IconButton onClick={() => setHistoryDialogOpen(true)} aria-label={t('history.title')} sx={{ color: 'var(--text-secondary)', p: 1 }}>
              <HistoryIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {/* Reglages en une rangee d'icones (theme, contraste, a propos) +
            langue : cinq lignes compressees en une, la place revient au contenu */}
        {collapsed ? (
          <>
            <Tooltip title={mode === 'dark' ? t('theme.light') : t('theme.dark')} placement="right" arrow>
              <IconButton onClick={toggleTheme} sx={{ color: 'var(--text-secondary)', p: 1 }}>
                {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title={t('about.title')} placement="right" arrow>
              <IconButton
                onClick={() => setAboutOpen(true)}
                aria-label={t('about.title')}
                sx={{ color: 'var(--text-secondary)', p: 1, '&:hover': { color: 'var(--text-primary)' } }}
              >
                <AboutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {/* Langue accessible même rail replié (sinon /explore, qui replie la
                nav automatiquement, prive l'utilisateur du choix de langue). */}
            <LanguageSwitcher iconOnly />
          </>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <Tooltip title={mode === 'dark' ? t('theme.light') : t('theme.dark')} arrow>
                <IconButton size="small" onClick={toggleTheme} aria-label={mode === 'dark' ? t('theme.light') : t('theme.dark')} sx={{ color: 'var(--text-secondary)', '&:hover': { color: 'var(--text-primary)' } }}>
                  {mode === 'dark' ? <LightModeIcon sx={{ fontSize: 17 }} /> : <DarkModeIcon sx={{ fontSize: 17 }} />}
                </IconButton>
              </Tooltip>
              <Tooltip title={t('theme.contrast')} arrow>
                <IconButton size="small" onClick={toggleContrast} aria-label={t('theme.contrast')} sx={{ color: highContrast ? 'var(--mars-orange)' : 'var(--text-secondary)', '&:hover': { color: 'var(--text-primary)' } }}>
                  <ContrastIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('about.title')} arrow>
                <IconButton size="small" onClick={() => setAboutOpen(true)} aria-label={t('about.title')} sx={{ color: 'var(--text-secondary)', '&:hover': { color: 'var(--text-primary)' } }}>
                  <AboutIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('method.title')} arrow>
                <IconButton size="small" onClick={() => setMethodsOpen(true)} aria-label={t('method.title')} sx={{ color: 'var(--text-secondary)', '&:hover': { color: 'var(--mars-orange)' } }}>
                  <ScienceIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
              <Box sx={{ ml: 'auto' }}>
                <LanguageSwitcher />
              </Box>
            </Box>
            {/* Provenance des donnees, visible sur toutes les pages */}
            <Typography variant="caption" sx={{ color: 'var(--text-secondary)', opacity: 0.65, fontSize: '0.66rem', letterSpacing: '0.02em' }}>
              {t('nav.dataCredit')} : GEM-Mars · BIRA-IASB
            </Typography>
          </>
        )}
      </Box>

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <MethodologyDialog open={methodsOpen} onClose={() => setMethodsOpen(false)} />
    </Box>
  );
}

function Sidebar({ collapsed = false, onToggleCollapse, onShortcutsOpen }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { t } = useTranslation();

  if (isMobile) {
    return (
      <>
        <IconButton
          onClick={() => setDrawerOpen(true)}
          aria-label={t('nav.openMenu')}
          sx={{
            position: 'fixed',
            top: 12,
            left: 12,
            zIndex: 200,
            background: 'var(--bg-surface)',
            backdropFilter: 'blur(var(--glass-blur))',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            '&:hover': { background: 'var(--bg-surface-hover)' },
          }}
        >
          <MenuIcon />
        </IconButton>

        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{ sx: { background: 'transparent', border: 'none', boxShadow: 'none' } }}
          slotProps={{ backdrop: { sx: { backgroundColor: 'rgba(2, 8, 24, 0.7)' } } }}
        >
          <Box sx={{ position: 'relative' }}>
            <IconButton
              onClick={() => setDrawerOpen(false)}
              aria-label={t('nav.closeMenu')}
              sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, color: 'var(--text-secondary)' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
            <SidebarContent onClose={() => setDrawerOpen(false)} onShortcutsOpen={onShortcutsOpen} />
          </Box>
        </Drawer>
      </>
    );
  }

  const width = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  return (
    <Box
      component="nav"
      sx={{
        position: 'fixed',
        left: 0,
        top: 0,
        height: '100vh',
        width,
        zIndex: 100,
        overflow: 'visible',
        transition: 'width 0.2s ease',
        '&:hover .sidebar-collapse-btn': { opacity: 1 },
      }}
    >
      <SidebarContent
        onClose={() => {}}
        collapsed={collapsed}
        onShortcutsOpen={onShortcutsOpen}
      />
      {/* Hover-reveal collapse/expand button — on the sidebar edge */}
      {onToggleCollapse && (
        <Tooltip title={collapsed ? t('nav.expandMenu') : t('nav.collapseMenu')} placement="right" arrow>
          <IconButton
            className="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            aria-label={collapsed ? t('nav.expandMenu') : t('nav.collapseMenu')}
            size="small"
            sx={{
              opacity: collapsed ? 1 : 0,
              position: 'absolute',
              right: -14,
              top: 32,
              zIndex: 10,
              color: 'var(--text-secondary)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--glass-border)',
              borderRadius: '50%',
              width: 28,
              height: 28,
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              transition: 'opacity 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                color: 'var(--mars-orange)',
                borderColor: 'rgba(224, 90, 43, 0.4)',
                background: 'var(--bg-surface)',
                boxShadow: '0 2px 12px rgba(224, 90, 43, 0.25)',
              },
            }}
          >
            {collapsed ? <ChevronRightIcon sx={{ fontSize: 16 }} /> : <ChevronLeftIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

export default Sidebar;
