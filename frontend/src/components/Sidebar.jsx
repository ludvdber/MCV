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
import { DarkMode as DarkModeIcon, LightMode as LightModeIcon, Contrast as ContrastIcon, InfoOutlined as AboutIcon } from '@mui/icons-material';
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
        pl: collapsed ? 0 : (nested ? 4.5 : 2),
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

/* ---------- Nav group (collapsible category) ---------- */

function NavGroup({ group, collapsed, onClose, openGroups, toggleGroup, activeGroupId }) {
  const { t } = useTranslation();
  // Ouvert si l'utilisateur l'a explicitement (dé)plié, sinon ouvert par défaut
  // pour le groupe contenant la page courante.
  const isOpen = openGroups[group.id] !== undefined ? openGroups[group.id] : (group.id === activeGroupId);
  const GroupIcon = group.icon;

  // In collapsed mode, show only the child items as flat icons
  if (collapsed) {
    return group.items.map(item => (
      <NavItem key={item.to} {...item} collapsed onClose={onClose} />
    ));
  }

  return (
    <>
      <ListItemButton
        onClick={() => toggleGroup(group.id)}
        sx={{
          borderRadius: '8px',
          mb: 0.3,
          px: 2,
          py: 0.6,
          color: 'var(--text-secondary)',
          '&:hover': { background: 'var(--bg-surface-hover)' },
        }}
      >
        <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
          <GroupIcon sx={{ fontSize: 18 }} />
        </ListItemIcon>
        <ListItemText
          primary={t(group.labelKey)}
          primaryTypographyProps={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        />
        {isOpen
          ? <ExpandLess sx={{ fontSize: 16, color: 'var(--text-secondary)' }} />
          : <ExpandMore sx={{ fontSize: 16, color: 'var(--text-secondary)' }} />}
      </ListItemButton>
      <Collapse in={isOpen} timeout="auto" unmountOnExit>
        <List disablePadding>
          {group.items.map(item => (
            <NavItem key={item.to} {...item} collapsed={false} onClose={onClose} nested />
          ))}
        </List>
      </Collapse>
    </>
  );
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
  const [openGroups, setOpenGroups] = useState({});
  const [confirmClear, setConfirmClear] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Groupe de navigation contenant la page courante (déplié par défaut).
  const activeGroupId = NAV_GROUPS.find(g => g.items.some(i => i.to === location.pathname))?.id;

  const toggleGroup = (id) => {
    setOpenGroups(prev => {
      const currentlyOpen = prev[id] !== undefined ? prev[id] : (id === activeGroupId);
      return { ...prev, [id]: !currentlyOpen };
    });
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
          {/* Home (always visible, not in a group) */}
          <NavItem labelKey="nav.home" to="/" icon={HomeIcon} collapsed={collapsed} onClose={onClose} />

          {/* Grouped nav items */}
          {NAV_GROUPS.map(group => (
            <NavGroup
              key={group.id}
              group={group}
              collapsed={collapsed}
              onClose={onClose}
              openGroups={openGroups}
              toggleGroup={toggleGroup}
              activeGroupId={activeGroupId}
            />
          ))}

          {/* Explore (always visible, not in a group) */}
          <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid var(--glass-border)' }}>
            <NavItem labelKey="nav.explore" to="/explore" icon={ExploreIcon} collapsed={collapsed} onClose={onClose} />
          </Box>
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
        {/* Theme toggle */}
        {collapsed ? (
          <Tooltip title={mode === 'dark' ? t('theme.light') : t('theme.dark')} placement="right" arrow>
            <IconButton onClick={toggleTheme} sx={{ color: 'var(--text-secondary)', p: 1 }}>
              {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        ) : (
          <Box
            onClick={toggleTheme}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.8, cursor: 'pointer',
              color: 'text.secondary', fontSize: '0.75rem',
              '&:hover': { color: 'text.primary' },
            }}
          >
            {mode === 'dark' ? <LightModeIcon sx={{ fontSize: 16 }} /> : <DarkModeIcon sx={{ fontSize: 16 }} />}
            <Typography variant="caption" color="inherit">
              {mode === 'dark' ? t('theme.light') : t('theme.dark')}
            </Typography>
          </Box>
        )}
        {!collapsed && (
          <Box
            onClick={toggleContrast}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.8, cursor: 'pointer',
              color: highContrast ? 'var(--mars-orange)' : 'text.secondary', fontSize: '0.75rem',
              '&:hover': { color: 'text.primary' },
            }}
          >
            <ContrastIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" color="inherit">
              {t('theme.contrast')}
            </Typography>
          </Box>
        )}
        {!collapsed && <LanguageSwitcher />}
        {/* À propos : projet, source des données et liens utiles */}
        {collapsed ? (
          <Tooltip title={t('about.title')} placement="right" arrow>
            <IconButton
              onClick={() => setAboutOpen(true)}
              aria-label={t('about.title')}
              sx={{ color: 'var(--text-secondary)', p: 1, '&:hover': { color: 'var(--text-primary)' } }}
            >
              <AboutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : (
          <Box
            onClick={() => setAboutOpen(true)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.8, cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: '0.75rem',
              '&:hover': { color: 'var(--text-primary)' },
            }}
          >
            <AboutIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" color="inherit">{t('about.title')}</Typography>
          </Box>
        )}
      </Box>

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
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
