/**
 * Toolbar helper components for ExploreResultsPanel.
 * Extracted to a separate file to satisfy react-refresh (one component per file).
 */
import { useState } from 'react';
import {
  IconButton, Tooltip, Menu, MenuItem, ListItemText, Typography,
} from '@mui/material';
import {
  CompareArrows as AnomalyIcon,
} from '@mui/icons-material';

/** Mini dropdown for choosing which slice to diff against */
export function DiffMenuButton({ slices, onSelect, t }) {
  const [anchorEl, setAnchorEl] = useState(null);
  return (
    <>
      <Tooltip title={t('explore.quickDiff')} arrow>
        <IconButton size="small" onClick={e => setAnchorEl(e.currentTarget)}
          sx={{ flexShrink: 0, color: 'var(--text-secondary)' }}>
          <AnomalyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { bgcolor: 'var(--bg-surface)', border: '1px solid var(--glass-border)' } } }}>
        <Typography variant="caption" sx={{ px: 2, py: 0.5, color: 'var(--text-secondary)', display: 'block' }}>
          {t('explore.quickDiff')}
        </Typography>
        {slices.map(s => (
          <MenuItem key={s.id} onClick={() => { onSelect(s.id); setAnchorEl(null); }}
            sx={{ fontSize: '0.82rem' }}>
            <ListItemText primary={s.label} primaryTypographyProps={{ fontSize: '0.82rem', noWrap: true }} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

