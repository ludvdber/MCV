import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Container, Paper, Typography, Button, CircularProgress,
  Alert, Box, Chip, IconButton, LinearProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { Add as AddIcon, Close as RemoveIcon } from '@mui/icons-material';
import { getTimeSeries, exportTimeSeriesCSV } from '../services/api';
import DatasetSelector from '../components/DatasetSelector';
import VariableSelector from '../components/VariableSelector';
import AltitudeSelector from '../components/AltitudeSelector';
import LatLonSelector from '../components/LatLonSelector';
import TimeSeriesChart from '../components/TimeSeriesChart';
import ExportMenu from '../components/ExportMenu';
import PermalienButton from '../components/PermalienButton';
import ChartSkeleton from '../components/ChartSkeleton';
import FullscreenButton from '../components/FullscreenButton';
import PageLoader from '../components/PageLoader';
import MiniMarsMap from '../components/MiniMarsMap';
import { useTranslation } from 'react-i18next';
import { useMars } from '../context/MarsContext';
import { useToast } from '../context/ToastContext';
import { usePlotRef } from '../hooks/usePlotRef';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useRecentHistory } from '../hooks/useRecentHistory';
import { isSurfaceVariable as checkIsSurface } from '../utils/variableUtils';
import ChartOrTable from '../components/ChartOrTable';
import { timeSeriesToTable } from '../utils/dataToTable';
import { VARIABLES_MAP } from '../components/VariableSelector';

const MAX_POINTS = 4;

/**
 * Page serie temporelle — 1 to 4 comparison points on a single chart.
 * Supports permalinks: ?ds=&var=&alt=&pts=[{lat,lon},...]
 * Backward compatible with old single-point links: ?ds=&var=&lat=&lon=&alt=
 */
function TimeSeriesPage() {
  const {
    datasets, catalogLoading,
    selectedDataset, setSelectedDataset,
    selectedVariable, handleVariableChange,
    selectedAltitude, setSelectedAltitude,
    dataset, datasetLabel,
  } = useMars();
  const { t } = useTranslation();

  const [seriesData, setSeriesData] = useState(null);
  const nextId = useRef(1);
  const [points, setPoints] = useState([{ id: 0, lat: 0, lon: 0 }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

  const [viewerContainerRef, exportPlotRef] = usePlotRef();
  const [linkCopied, copyToClipboard] = useCopyToClipboard();
  const [searchParams] = useSearchParams();
  const lastSearchRef = useRef(undefined);
  const pendingAutoLaunch = useRef(false);
  const showToast = useToast();
  const { addEntry } = useRecentHistory();

  const isSurfaceVariable = checkIsSurface(selectedVariable);

  // Restore from permalink — on mount AND when the query string changes (e.g.
  // clicking a history entry while already on this page).
  useEffect(() => {
    if (catalogLoading) return;
    const search = searchParams.toString();
    if (search === lastSearchRef.current) return;
    lastSearchRef.current = search;
    const ds = searchParams.get('ds');
    if (!ds) return;
    setSelectedDataset(ds);
    const v = searchParams.get('var');
    if (v) handleVariableChange(v);
    const alt = searchParams.get('alt');
    if (alt != null) setSelectedAltitude(parseInt(alt, 10));
    const pts = searchParams.get('pts');
    if (pts) {
      try {
        const parsed = JSON.parse(pts);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const withIds = parsed.map((p, i) => ({ ...p, id: p.id ?? i }));
          nextId.current = withIds.length;
          setPoints(withIds);
        }
      } catch { /* ignore */ }
    } else {
      const lat = searchParams.get('lat');
      const lon = searchParams.get('lon');
      if (lat != null && lon != null) {
        setPoints([{ lat: parseFloat(lat), lon: parseFloat(lon) }]);
      }
    }
    pendingAutoLaunch.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogLoading, searchParams]);

  const handleAnalyze = () => {
    if (!selectedDataset || !selectedVariable || points.length === 0) return;
    setLoading(true);
    setError(null);
    setIsDirty(false);

    const altitudeToSend = isSurfaceVariable ? 0 : selectedAltitude;

    Promise.all(
      points.map(p =>
        getTimeSeries({
          dataset: selectedDataset,
          variable: selectedVariable,
          latitude: p.lat,
          longitude: p.lon,
          altitude: altitudeToSend,
        }).then(res => res.data)
      )
    )
      .then(results => {
        setSeriesData(results);
        const pp = new URLSearchParams();
        if (selectedDataset) pp.set('ds', selectedDataset);
        if (selectedVariable) pp.set('var', selectedVariable);
        pp.set('alt', String(selectedAltitude));
        pp.set('pts', JSON.stringify(points));
        addEntry({
          page: '/timeseries',
          permalink: `/timeseries?${pp.toString()}`,
          dataset: selectedDataset,
          variable: selectedVariable,
          params: { altitude: selectedAltitude, points },
          label: `${selectedVariable} (${points.map(p => `${p.lat},${p.lon}`).join(' | ')})`,
        });
      })
      .catch(err => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  };

  if (pendingAutoLaunch.current && dataset && !loading) {
    pendingAutoLaunch.current = false;
    setTimeout(handleAnalyze, 0);
  }

  const addPoint = () => {
    if (points.length < MAX_POINTS) {
      setPoints(prev => [...prev, { id: nextId.current++, lat: 0, lon: 0 }]);
      markDirty();
    }
  };

  const removePoint = (idx) => {
    setPoints(prev => prev.filter((_, i) => i !== idx));
    markDirty();
  };

  const updatePoint = (idx, field, value) => {
    setPoints(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
    markDirty();
  };

  const handleCopyLink = useCallback(() => {
    const p = new URLSearchParams();
    if (selectedDataset) p.set('ds', selectedDataset);
    if (selectedVariable) p.set('var', selectedVariable);
    p.set('alt', String(selectedAltitude));
    p.set('pts', JSON.stringify(points));
    copyToClipboard(`${window.location.origin}/timeseries?${p.toString()}`);
    showToast(t('toast.linkCopied'));
  }, [selectedDataset, selectedVariable, selectedAltitude, points, copyToClipboard, showToast, t]);

  const shortcuts = useMemo(() => ({
    Enter: () => { if (!loading && selectedDataset && selectedVariable) handleAnalyze(); },
    f: () => {
      if (viewerContainerRef.current) {
        if (!document.fullscreenElement) viewerContainerRef.current.requestFullscreen?.();
        else document.exitFullscreen?.();
      }
    },
  }), [loading, selectedDataset, selectedVariable]);
  useKeyboardShortcuts(shortcuts);

  const handleExportCSV = () => {
    if (points.length > 0) {
      const altitudeToSend = isSurfaceVariable ? 0 : selectedAltitude;
      exportTimeSeriesCSV({
        dataset: selectedDataset,
        variable: selectedVariable,
        latitude: points[0].lat,
        longitude: points[0].lon,
        altitude: altitudeToSend,
      }).then(res => {
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timeseries_${selectedVariable}_lat${points[0].lat}_lon${points[0].lon}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }).catch(() => { showToast(t('export.error'), 'error'); });
    }
  };

  const markDirty = () => { if (seriesData) setIsDirty(true); };

  const varUnit = VARIABLES_MAP.get(selectedVariable)?.unit || '';
  const tableData = useMemo(() =>
    seriesData?.length > 0 ? timeSeriesToTable(seriesData[0].values, varUnit) : null,
  [seriesData, varUnit]);

  if (catalogLoading) return <PageLoader />;

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      <Typography variant="h5" gutterBottom>{t('page.timeseries.title')}</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <DatasetSelector datasets={datasets} value={selectedDataset}
              onChange={v => { setSelectedDataset(v); markDirty(); }} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <VariableSelector value={selectedVariable}
              onChange={v => { handleVariableChange(v); markDirty(); }}
              availableVariables={dataset?.variables} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <AltitudeSelector value={selectedAltitude}
              onChange={v => { setSelectedAltitude(v); markDirty(); }}
              variableCode={selectedVariable} />
          </Grid>
        </Grid>

        {/* Comparison points */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {t('page.profile.pointsLabel')} ({points.length}/{MAX_POINTS})
          </Typography>
          {points.map((pt, idx) => (
            <Box key={pt.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
              <Chip
                size="small"
                label={`${t('page.profile.point')} ${idx + 1}`}
                sx={{
                  mt: 1,
                  flexShrink: 0,
                  backgroundColor: ['var(--cyan-accent)', 'var(--mars-orange)', '#a855f7', '#22c55e'][idx],
                  color: '#fff',
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  height: 22,
                }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <LatLonSelector
                  latitude={pt.lat}
                  longitude={pt.lon}
                  onLatChange={v => updatePoint(idx, 'lat', v)}
                  onLonChange={v => updatePoint(idx, 'lon', v)}
                />
              </Box>
              {points.length > 1 && (
                <IconButton size="small" onClick={() => removePoint(idx)} color="error" sx={{ mt: 0.5 }}>
                  <RemoveIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          ))}
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={addPoint}
            disabled={points.length >= MAX_POINTS}
            sx={{ mt: 0.5 }}
          >
            {t('page.profile.addPoint')}
          </Button>
        </Box>

        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={handleAnalyze}
            disabled={!selectedDataset || !selectedVariable || loading}>
            {loading ? <CircularProgress size={20} color="inherit" /> : t('page.timeseries.button')}
          </Button>
          {isDirty && (
            <Chip label={t('page.timeseries.dirty')} color="warning" size="small" />
          )}
        </Box>

      </Paper>

      {loading && <LinearProgress color="primary" sx={{ mb: 2, borderRadius: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && !seriesData && <ChartSkeleton variant="line" />}

      <ChartOrTable tableData={tableData}>
        {(showTable, TableButton) => (
          <>
            {seriesData && (
              <Box sx={{ mb: 1, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <MiniMarsMap lat={points[0]?.lat} lon={points[0]?.lon} size={100} />
                <PermalienButton onClick={handleCopyLink} copied={linkCopied} />
                <ExportMenu
                  plotRef={exportPlotRef}
                  filename={`mars_timeseries_${selectedVariable || 'plot'}`}
                  onCSV={handleExportCSV}
                />
                <TableButton />
                <FullscreenButton containerRef={viewerContainerRef} />
              </Box>
            )}
            {!showTable && (
              <Box ref={viewerContainerRef} sx={{ position: 'relative' }}>
                <TimeSeriesChart
                  series={seriesData}
                  variableCode={selectedVariable}
                  datasetLabel={datasetLabel}
                  noExportMenu
                />
              </Box>
            )}
          </>
        )}
      </ChartOrTable>
    </Container>
  );
}

export default TimeSeriesPage;
