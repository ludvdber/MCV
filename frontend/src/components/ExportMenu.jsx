import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button, Menu, MenuItem, ListItemIcon, ListItemText, Divider,
  Snackbar, Alert,
} from '@mui/material';
import { useToast } from '../context/ToastContext';
import {
  PhotoCamera as PngIcon,
  Image as SvgIcon,
  TableChart as CsvIcon,
  KeyboardArrowDown as ArrowIcon,
  FileDownload as DownloadIcon,
  Storage as NetCDFIcon,
  Article as PublicationIcon,
  GridOn as GridIcon,
  Movie as VideoIcon,
} from '@mui/icons-material';
import { exportPlotImage } from '../utils/plotExport';

/**
 * Menu dropdown d'export pour les graphiques Plotly.
 * Propose PNG haute resolution, SVG vectoriel, et optionnellement CSV,
 * NetCDF, mode publication (figure blanche avec titres complets, colorbar
 * et mention du dataset) et video WebM (animations).
 *
 * @param {React.RefObject} plotRef     - ref sur le div Plotly
 * @param {string}          filename    - nom de fichier sans extension
 * @param {function|null}   onCSV       - callback pour export CSV (null = option masquee)
 * @param {Object|null}     publication - contexte { title, subtitle, credit, xTitle, yTitle }
 *                                        (null = mode publication masque)
 * @param {function|null}   onPubGrid   - export publication de la grille entiere
 * @param {function|null}   onWebM      - export video WebM (animation diurne)
 * @param {boolean}         disabled    - desactive le bouton
 */
function ExportMenu({ plotRef, filename = 'mars_export', onCSV = null, onNetCDF = null, publication = null, onPubGrid = null, onWebM = null, disabled = false }) {
  const { t } = useTranslation();
  const showToast = useToast();
  const [anchorEl, setAnchorEl] = useState(null);
  const [exportError, setExportError] = useState(null);
  const open = Boolean(anchorEl);

  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const triggerDownload = (url, name) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
  };

  /* Le rendu hors ecran en theme clair vit dans utils/plotExport.js :
   * partage avec le montage de grille et l'export video WebM. */

  const handlePNG = async () => {
    handleClose();
    if (!plotRef?.current) return;
    try {
      const url = await exportPlotImage(plotRef.current, 'png', { width: 1920, height: 1080, scale: 2 });
      triggerDownload(url, `${filename}.png`);
      showToast(t('toast.pngExported'));
    } catch {
      setExportError(t('export.pngError'));
    }
  };

  const handleSVG = async () => {
    handleClose();
    if (!plotRef?.current) return;
    try {
      const url = await exportPlotImage(plotRef.current, 'svg', { width: 1920, height: 1080 });
      triggerDownload(url, `${filename}.svg`);
      showToast(t('toast.svgExported'));
    } catch {
      setExportError(t('export.svgError'));
    }
  };

  const handlePublication = async (format) => {
    handleClose();
    if (!plotRef?.current || !publication) return;
    try {
      const url = await exportPlotImage(plotRef.current, format, {
        width: 1600, height: 1000, ...(format === 'png' ? { scale: 3 } : {}),
        publication,
      });
      triggerDownload(url, `${filename}_pub.${format}`);
      showToast(format === 'png' ? t('toast.pngExported') : t('toast.svgExported'));
    } catch {
      setExportError(format === 'png' ? t('export.pngError') : t('export.svgError'));
    }
  };

  const handleCSV = () => {
    handleClose();
    if (onCSV) {
      onCSV();
      showToast(t('toast.csvExported'));
    }
  };

  const handleNetCDF = () => {
    handleClose();
    if (onNetCDF) {
      onNetCDF();
      showToast(t('toast.netcdfExported') || 'NetCDF export started');
    }
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        color="secondary"
        disabled={disabled}
        endIcon={<ArrowIcon />}
        startIcon={<DownloadIcon />}
        onClick={handleOpen}
        aria-haspopup="true"
        aria-expanded={open}
        sx={{ whiteSpace: 'nowrap' }}
      >
        {t('export.button')}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handlePNG}>
          <ListItemIcon><PngIcon fontSize="small" /></ListItemIcon>
          <ListItemText
            primary={t('export.pngTitle')}
            secondary={t('export.pngDesc')}
            slotProps={{ secondary: { sx: { fontSize: '0.7rem' } } }}
          />
        </MenuItem>
        <MenuItem onClick={handleSVG}>
          <ListItemIcon><SvgIcon fontSize="small" /></ListItemIcon>
          <ListItemText
            primary={t('export.svgTitle')}
            secondary={t('export.svgDesc')}
            slotProps={{ secondary: { sx: { fontSize: '0.7rem' } } }}
          />
        </MenuItem>
        {onCSV && [
          <Divider key="div" />,
          <MenuItem key="csv" onClick={handleCSV}>
            <ListItemIcon><CsvIcon fontSize="small" /></ListItemIcon>
            <ListItemText
              primary={t('export.csvTitle')}
              secondary={t('export.csvDesc')}
              slotProps={{ secondary: { sx: { fontSize: '0.7rem' } } }}
            />
          </MenuItem>,
        ]}
        {onNetCDF && [
          <Divider key="ncdiv" />,
          <MenuItem key="nc" onClick={handleNetCDF}>
            <ListItemIcon><NetCDFIcon fontSize="small" /></ListItemIcon>
            <ListItemText
              primary="NetCDF (.nc)"
              secondary={t('export.netcdfDesc') || 'Scientific format for Python/Matlab'}
              slotProps={{ secondary: { sx: { fontSize: '0.7rem' } } }}
            />
          </MenuItem>,
        ]}
        {publication && [
          <Divider key="pubdiv" />,
          <MenuItem key="pubpng" onClick={() => handlePublication('png')}>
            <ListItemIcon><PublicationIcon fontSize="small" /></ListItemIcon>
            <ListItemText
              primary={t('export.pubPngTitle')}
              secondary={t('export.pubDesc')}
              slotProps={{ secondary: { sx: { fontSize: '0.7rem' } } }}
            />
          </MenuItem>,
          <MenuItem key="pubsvg" onClick={() => handlePublication('svg')}>
            <ListItemIcon><PublicationIcon fontSize="small" /></ListItemIcon>
            <ListItemText
              primary={t('export.pubSvgTitle')}
              secondary={t('export.pubDesc')}
              slotProps={{ secondary: { sx: { fontSize: '0.7rem' } } }}
            />
          </MenuItem>,
        ]}
        {onPubGrid && (
          <MenuItem onClick={() => { handleClose(); onPubGrid(); }}>
            <ListItemIcon><GridIcon fontSize="small" /></ListItemIcon>
            <ListItemText
              primary={t('export.pubGridTitle')}
              secondary={t('export.pubGridDesc')}
              slotProps={{ secondary: { sx: { fontSize: '0.7rem' } } }}
            />
          </MenuItem>
        )}
        {onWebM && [
          <Divider key="webmdiv" />,
          <MenuItem key="webm" onClick={() => { handleClose(); onWebM(); }}>
            <ListItemIcon><VideoIcon fontSize="small" /></ListItemIcon>
            <ListItemText
              primary={t('export.webmTitle')}
              secondary={t('export.webmDesc')}
              slotProps={{ secondary: { sx: { fontSize: '0.7rem' } } }}
            />
          </MenuItem>,
        ]}
      </Menu>

      <Snackbar
        open={Boolean(exportError)}
        autoHideDuration={4000}
        onClose={() => setExportError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setExportError(null)} sx={{ width: '100%' }}>
          {exportError}
        </Alert>
      </Snackbar>
    </>
  );
}

export default ExportMenu;
