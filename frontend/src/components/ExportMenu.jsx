import { useState } from 'react';
import Plotly from 'plotly.js-dist-min';
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
  PictureAsPdf as PdfIcon,
  Storage as NetCDFIcon,
} from '@mui/icons-material';

/**
 * Menu dropdown d'export pour les graphiques Plotly.
 * Propose PNG haute resolution, SVG vectoriel, et optionnellement CSV.
 *
 * @param {React.RefObject} plotRef   - ref sur le div Plotly
 * @param {string}          filename  - nom de fichier sans extension
 * @param {function|null}   onCSV     - callback pour export CSV (null = option masquee)
 * @param {boolean}         disabled  - desactive le bouton
 */
function ExportMenu({ plotRef, filename = 'mars_export', onCSV = null, onNetCDF = null, pdfMeta = null, disabled = false }) {
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

  /**
   * Rend une copie hors-écran du graphique avec thème clair, exporte depuis là.
   * - Aucun flash sur le graphique visible (on ne touche jamais au gd d'origine).
   * - Corrige TOUTES les couleurs : layout global, titre principal, axes (color +
   *   tickfont + title quelle que soit la forme string|objet), colorbar des traces.
   */
  const exportAsImage = async (gd, format, opts = {}) => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:-9999px;top:0;width:1200px;height:700px;visibility:hidden;';
    document.body.appendChild(el);
    try {
      const L = gd.layout ?? {};

      // ── Layout clair ────────────────────────────────────────────────────
      const lightLayout = { ...L,
        paper_bgcolor: 'white',
        plot_bgcolor:  '#eeeeee',
        font:   { ...(L.font   ?? {}), color: '#222222' },
        legend: { ...(L.legend ?? {}), font: { ...(L.legend?.font ?? {}), color: '#222222' } },
      };

      // Titre principal (string ou { text, font })
      if (L.title != null) {
        lightLayout.title = typeof L.title === 'string'
          ? { text: L.title, font: { color: '#222222' } }
          : { ...L.title, font: { ...(L.title.font ?? {}), color: '#222222' } };
      }

      // Axes : `color` couvre ticks + labels + titre-chaîne ; `tickfont` et
      // `title.font` couvrent les formes objet explicitement colorées (fontColor blanc).
      for (const k of Object.keys(L).filter(k => /^[xy]axis\d*$/.test(k))) {
        const ax = L[k];
        lightLayout[k] = { ...ax,
          color:    '#222222',
          tickfont: { ...(ax.tickfont ?? {}), color: '#222222' },
          // titre d'axe : string → conservé tel quel (coloré via axis.color)
          //               objet  → font.color overridé
          title: ax.title == null || typeof ax.title === 'string'
            ? ax.title
            : { ...ax.title, font: { ...(ax.title.font ?? {}), color: '#222222' } },
        };
      }

      // Annotations
      if (Array.isArray(L.annotations)) {
        lightLayout.annotations = L.annotations.map(a => ({
          ...a, font: { ...(a.font ?? {}), color: '#222222' },
        }));
      }

      // ── Traces : colorbar fonts ──────────────────────────────────────────
      const lightData = (gd.data ?? []).map(t => {
        if (!t.colorbar) return t;
        const cb = t.colorbar;
        return { ...t,
          colorbar: { ...cb,
            tickfont: { ...(cb.tickfont ?? {}), color: '#222222' },
            title: cb.title == null ? cb.title
              : typeof cb.title === 'string'
                ? { text: cb.title, font: { color: '#222222' } }
                : { ...cb.title, font: { ...(cb.title.font ?? {}), color: '#222222' } },
          },
        };
      });

      await Plotly.newPlot(el, lightData, lightLayout, { staticPlot: true, responsive: false });
      return await Plotly.toImage(el, { format, ...opts });
    } finally {
      Plotly.purge(el);
      document.body.removeChild(el);
    }
  };

  const handlePNG = async () => {
    handleClose();
    if (!plotRef?.current) return;
    try {
      const url = await exportAsImage(plotRef.current, 'png', { width: 1920, height: 1080, scale: 2 });
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
      const url = await exportAsImage(plotRef.current, 'svg', { width: 1920, height: 1080 });
      triggerDownload(url, `${filename}.svg`);
      showToast(t('toast.svgExported'));
    } catch {
      setExportError(t('export.svgError'));
    }
  };

  const handleCSV = () => {
    handleClose();
    if (onCSV) {
      onCSV();
      showToast(t('toast.csvExported'));
    }
  };

  const handlePDF = async () => {
    handleClose();
    if (!plotRef?.current || !pdfMeta) return;
    try {
      const { exportPDF } = await import('../utils/exportUtils');
      await exportPDF(plotRef.current, pdfMeta, filename);
      showToast(t('toast.pdfExported') || 'PDF exported');
    } catch {
      setExportError('PDF export failed');
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
        {pdfMeta && (
          <MenuItem onClick={handlePDF}>
            <ListItemIcon><PdfIcon fontSize="small" /></ListItemIcon>
            <ListItemText
              primary="PDF"
              secondary={t('export.pdfDesc') || 'Report with chart + parameters'}
              slotProps={{ secondary: { sx: { fontSize: '0.7rem' } } }}
            />
          </MenuItem>
        )}
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
