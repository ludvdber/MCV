import { useState, useCallback, useEffect, useRef } from 'react';
import { Paper, MenuList, MenuItem, ListItemIcon, ListItemText, Typography, Box, Divider } from '@mui/material';
import {
  ShowChart as TimeSeriesIcon,
  AlignVerticalBottom as ProfileIcon,
  Landscape as CrossSectionIcon,
  GridOn as TemporalProfileIcon,
} from '@mui/icons-material';
import {
  useFloating, offset, flip, shift, autoUpdate,
  useDismiss, useInteractions, FloatingPortal,
} from '@floating-ui/react';
import { useTranslation } from 'react-i18next';

/**
 * Floating drill-down menu that appears when clicking a point on a heatmap.
 * Offers navigation to related visualizations (time series, profile, cross-section)
 * with coordinates pre-filled.
 *
 * Usage: pass `onDrillDown` and `plotRef` to the parent. The component attaches
 * a plotly_click listener and shows the menu on click.
 *
 * @param {React.RefObject} plotRef - ref to the Plotly div
 * @param {Function} onDrillDown - callback({ type, lat, lon }) when user picks an action
 */
export default function DrillDownMenu({ plotRef, onDrillDown }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [clickData, setClickData] = useState(null);
  const virtualRef = useRef(null);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'bottom-start',
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    elements: { reference: virtualRef.current },
  });

  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  // Attach plotly_click listener — re-attach periodically since Plotly.react()
  // can replace the plot DOM element (e.g. after language change).
  useEffect(() => {
    let currentEl = null;

    const handleClick = (eventData) => {
      if (!eventData?.points?.[0]) return;
      const pt = eventData.points[0];
      const lat = pt.y;
      const lon = pt.x;

      const evt = eventData.event;
      if (!evt) return;
      const x = evt.clientX || evt.pageX;
      const y = evt.clientY || evt.pageY;

      virtualRef.current = {
        getBoundingClientRect: () => ({
          x, y, width: 0, height: 0,
          top: y, left: x, right: x, bottom: y,
        }),
      };

      refs.setReference(virtualRef.current);
      setClickData({ lat: parseFloat(lat.toFixed(1)), lon: parseFloat(lon.toFixed(1)) });
      setIsOpen(true);
    };

    const attach = () => {
      const el = plotRef?.current;
      if (!el) return;
      // Always remove before re-attaching to prevent listener accumulation
      el.removeAllListeners?.('plotly_click');
      el.on('plotly_click', handleClick);
      currentEl = el;
    };

    attach();
    const interval = setInterval(attach, 3000);

    return () => {
      clearInterval(interval);
      if (currentEl) currentEl.removeAllListeners?.('plotly_click');
    };
  }, [plotRef]); // stable ref — don't depend on refs which changes every render

  const handleAction = useCallback((type) => {
    if (clickData && onDrillDown) {
      onDrillDown({ type, lat: clickData.lat, lon: clickData.lon });
    }
    setIsOpen(false);
  }, [clickData, onDrillDown]);

  if (!isOpen || !clickData) return null;

  const actions = [
    { type: 'timeseries', icon: TimeSeriesIcon, label: t('drilldown.timeseries') },
    { type: 'profile', icon: ProfileIcon, label: t('drilldown.profile') },
    { type: 'crosssection', icon: CrossSectionIcon, label: t('drilldown.crosssection') },
    { type: 'temporalprofile', icon: TemporalProfileIcon, label: t('drilldown.temporalprofile') },
  ];

  return (
    <FloatingPortal>
      <Paper
        ref={refs.setFloating}
        style={floatingStyles}
        {...getFloatingProps()}
        elevation={8}
        sx={{
          zIndex: 1500,
          borderRadius: 2,
          border: '1px solid var(--glass-border)',
          background: 'var(--bg-surface)',
          backdropFilter: 'blur(16px)',
          minWidth: 220,
        }}
      >
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid var(--glass-border)' }}>
          <Typography variant="caption" sx={{ color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('drilldown.title')}
          </Typography>
          <Typography sx={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem', color: 'var(--mars-orange)' }}>
            {clickData.lat}° N, {clickData.lon}° E
          </Typography>
        </Box>
        <MenuList dense sx={{ py: 0.5 }}>
          {actions.map(({ type, icon: Icon, label }) => (
            <MenuItem
              key={type}
              onClick={() => handleAction(type)}
              sx={{
                py: 1, px: 2,
                '&:hover': { background: 'var(--bg-surface-hover)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 32, color: 'var(--cyan-accent)' }}>
                <Icon sx={{ fontSize: 18 }} />
              </ListItemIcon>
              <ListItemText
                primary={label}
                primaryTypographyProps={{ fontSize: '0.82rem' }}
              />
            </MenuItem>
          ))}
        </MenuList>
      </Paper>
    </FloatingPortal>
  );
}
