import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Box, Typography, List, ListItemButton,
  ListItemIcon, ListItemText, Drawer, IconButton,
  useMediaQuery, useTheme
} from '@mui/material';
import {
  Home as HomeIcon,
  Layers as SliceIcon,
  ShowChart as TimeSeriesIcon,
  PlayCircleOutline as AnimationIcon,
  Landscape as CrossSectionIcon,
  Explore as ExploreIcon,
  AlignVerticalBottom as ProfileIcon,
  Menu as MenuIcon,
  Close as CloseIcon
} from '@mui/icons-material';

/**
 * Sidebar de navigation — design glassmorphism spatial.
 *
 * - Desktop (>= 768px) : sidebar fixee a gauche, 220px, toujours visible
 * - Mobile (< 768px) : cachee par defaut, ouverte via bouton burger → Drawer MUI
 *
 * Utilise NavLink de react-router-dom pour le style actif automatique.
 * Le logo SVG est un cercle gradient Mars avec glow pulsant.
 */

const SIDEBAR_WIDTH = 220;

/** Liens de navigation */
const NAV_ITEMS = [
  { label: 'Accueil',           to: '/',           icon: HomeIcon },
  { label: 'Slice 2D',          to: '/slice',      icon: SliceIcon },
  { label: 'Serie temporelle',  to: '/timeseries', icon: TimeSeriesIcon },
  { label: 'Animation',         to: '/animation',  icon: AnimationIcon },
  { label: 'Coupe verticale',  to: '/crosssection', icon: CrossSectionIcon },
  { label: 'Profil vertical',  to: '/profile', icon: ProfileIcon },
  { label: 'Explorer',          to: '/explore',    icon: ExploreIcon },
];

/** Logo SVG cercle gradient Mars */
function MarsLogo() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <defs>
        <radialGradient id="marsGrad" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#ff7043" />
          <stop offset="100%" stopColor="#bf3a0a" />
        </radialGradient>
      </defs>
      <circle
        cx="20" cy="20" r="18"
        fill="url(#marsGrad)"
        style={{
          filter: 'drop-shadow(0 0 8px rgba(224, 90, 43, 0.6))',
          animation: 'logoPulse 3s ease-in-out infinite',
        }}
      />
    </svg>
  );
}

/** Contenu commun de la sidebar (desktop et drawer mobile) */
function SidebarContent({ onClose }) {
  return (
    <Box
      sx={{
        width: SIDEBAR_WIDTH,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderRight: '1px solid var(--glass-border)',
        overflow: 'hidden',
      }}
    >
      {/* --- Logo --- */}
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <MarsLogo />
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
      </Box>

      {/* --- Navigation --- */}
      <List sx={{ flex: 1, px: 1, pt: 1 }}>
        {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
          <ListItemButton
            key={to}
            component={NavLink}
            to={to}
            end={to === '/'}
            onClick={onClose}
            sx={{
              borderRadius: '8px',
              mb: 0.5,
              px: 2,
              py: 1.2,
              color: 'var(--text-secondary)',
              transition: 'all 0.2s ease',
              '&:hover': {
                background: 'var(--bg-surface-hover)',
              },
              '&.active': {
                background: 'var(--bg-surface-hover)',
                borderLeft: '3px solid var(--mars-orange)',
                color: 'var(--mars-orange)',
                '& .MuiListItemIcon-root': {
                  color: 'var(--mars-orange)',
                },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={label}
              primaryTypographyProps={{
                fontSize: '0.9rem',
                fontWeight: 500,
              }}
            />
          </ListItemButton>
        ))}
      </List>

      {/* --- Pied --- */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid rgba(56, 189, 248, 0.1)',
        }}
      >
        <Typography variant="caption" color="text.secondary" display="block">
          v1.0.0
        </Typography>
      </Box>
    </Box>
  );
}

function Sidebar() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* Mobile : bouton burger + Drawer */
  if (isMobile) {
    return (
      <>
        <IconButton
          onClick={() => setDrawerOpen(true)}
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
            '&:hover': {
              background: 'var(--bg-surface-hover)',
            },
          }}
        >
          <MenuIcon />
        </IconButton>

        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{
            sx: {
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
            },
          }}
          slotProps={{
            backdrop: {
              sx: { backgroundColor: 'rgba(2, 8, 24, 0.7)' },
            },
          }}
        >
          <Box sx={{ position: 'relative' }}>
            <IconButton
              onClick={() => setDrawerOpen(false)}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                zIndex: 1,
                color: 'var(--text-secondary)',
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
            <SidebarContent onClose={() => setDrawerOpen(false)} />
          </Box>
        </Drawer>
      </>
    );
  }

  /* Desktop : sidebar fixee */
  return (
    <Box
      component="nav"
      sx={{
        position: 'fixed',
        left: 0,
        top: 0,
        height: '100vh',
        width: SIDEBAR_WIDTH,
        zIndex: 100,
      }}
    >
      <SidebarContent onClose={() => {}} />
    </Box>
  );
}

/** Largeur exportee pour le margin-left du contenu principal */
export const SIDEBAR_WIDTH_PX = SIDEBAR_WIDTH;

export default Sidebar;
