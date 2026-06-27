/**
 * Panneau gauche de la page Exploration — v3 compact.
 * Sections séparées par des dividers légers, pas d'accordéon.
 * VizType en dropdown, affichage en section collapsible.
 */
import { useState } from 'react';
import {
  Box, Paper, Typography, Select, MenuItem, FormControl, InputLabel,
  Button, CircularProgress, Alert, TextField, Chip, Divider, Collapse,
  IconButton, Tooltip,
} from '@mui/material';
import {
  RocketLaunch as LaunchIcon,
  Link as LinkIcon,
  ExpandMore as ExpandIcon,
  Tune as TuneIcon,
  SwapHoriz as SwapIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useMars } from '../../context/MarsContext';
import { INDIVIDUAL_PREFIX } from '../../constants';
import { COLORSCALE_OPTIONS } from '../../utils/colorscales';
import { useExploreState, useExploreDispatch, A } from './ExploreContext.jsx';
import {
  VIZ_TYPES, COLORSCALE_TYPES, ALTITUDE_REQUIRED_TYPES, MEAN_ONLY_TYPES,
} from './exploreConstants.jsx';
import DatasetSelector from '../../components/DatasetSelector';
import VariableSelector from '../../components/VariableSelector';
import { VARIABLES_MAP } from '../../components/VariableSelector';
import TimeSelector from '../../components/TimeSelector';
import AltitudeSelector from '../../components/AltitudeSelector';
import LatLonSelector from '../../components/LatLonSelector';

export default function ExploreParamsPanel({ onLancer, onCopyLink }) {
  const { t } = useTranslation();
  const {
    datasets,
    selectedDataset, setSelectedDataset,
    selectedVariable, handleVariableChange,
    selectedTime, setSelectedTime,
    selectedAltitude, setSelectedAltitude,
    selectedLatitude, setSelectedLatitude,
    selectedLongitude, setSelectedLongitude,
    dataset,
    individualYears,
    selectedIndividualMY,
    selectedIndividualLs,
  } = useMars();

  const state    = useExploreState();
  const dispatch = useExploreDispatch();

  const {
    vizType, crossSectionType, hovmollerType, colorscale, zMinInput, zMaxInput,
    loading, error, linkCopied,
    resultsById, activeResult, datasetB,
  } = state;

  const isIndividual   = selectedDataset?.startsWith(INDIVIDUAL_PREFIX);
  const isMeanOnly     = MEAN_ONLY_TYPES.includes(vizType);
  const needsTime      = ['slice', 'profile', 'crosssection', 'zonalmean', 'difference'].includes(vizType);
  const needsLatLon    = ['timeseries', 'profile', 'windrose', 'temporalprofile'].includes(vizType);
  const needsAltitude  = ['slice', 'timeseries', 'animation', 'hovmoller', 'windrose', 'difference'].includes(vizType);
  const showColorscale = COLORSCALE_TYPES.includes(vizType);

  const isSurfaceVariable = (() => {
    const v = VARIABLES_MAP.get(selectedVariable);
    return v?.altitudeType === null;
  })();

  const activeResultObj = resultsById[activeResult] ?? null;
  const dataStats = activeResultObj?.data?.stats;

  const [showDisplay, setShowDisplay] = useState(false);

  return (
    <Paper sx={{
      width: '100%', flexShrink: 0, p: 2,
      overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5,
      height: '100%', boxSizing: 'border-box',
    }}>
      {/* ═══ Title ═══ */}
      <Typography
        sx={{
          fontFamily: 'var(--font-display)',
          color: 'var(--mars-orange)',
          fontSize: '0.95rem',
          fontWeight: 700,
        }}
      >
        {t('page.explore.title')}
      </Typography>

      {/* ═══ Viz type dropdown ═══ */}
      <FormControl fullWidth size="small">
        <InputLabel>{t('page.explore.vizType')}</InputLabel>
        <Select
          value={vizType}
          label={t('page.explore.vizType')}
          onChange={e => dispatch({ type: A.SET_VIZ_TYPE, value: e.target.value })}
        >
          {VIZ_TYPES.map(vt => (
            <MenuItem key={vt.value} value={vt.value}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {vt.icon} {t(vt.labelKey)}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Divider sx={{ borderColor: 'var(--glass-border)' }} />

      {/* ═══ Dataset(s) ═══ */}
      {vizType === 'difference' && (
        <Typography variant="caption" fontWeight={600} color="text.secondary">
          {t('page.difference.datasetA')}
        </Typography>
      )}

      <DatasetSelector
        datasets={datasets}
        value={selectedDataset}
        onChange={setSelectedDataset}
        individualYears={individualYears}
        initialIndividualMY={selectedIndividualMY}
        initialIndividualLs={selectedIndividualLs}
        disableIndividual={isMeanOnly}
        disableIndividualReason={isMeanOnly ? t('page.explore.meanOnlyReason') : ''}
      />

      {vizType === 'difference' && (
        <>
          <Typography variant="caption" fontWeight={600} color="text.secondary">
            {t('page.difference.datasetB')}
          </Typography>
          <DatasetSelector
            datasets={datasets}
            value={datasetB}
            onChange={v => dispatch({ type: A.SET_DATASET_B, value: v })}
            individualYears={individualYears}
          />
          {selectedDataset && datasetB && selectedDataset === datasetB && (
            <Alert severity="info" sx={{ py: 0, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
              {t('page.difference.sameDataset')}
            </Alert>
          )}
        </>
      )}

      {isIndividual && (
        <Chip
          label={`INDIVIDUAL — ${selectedDataset}`}
          size="small"
          sx={{
            bgcolor: 'var(--cyan-highlight)',
            color: 'var(--cyan-accent)',
            border: '1px solid var(--cyan-accent)',
            fontFamily: 'var(--font-body)',
            fontSize: '0.75rem',
          }}
        />
      )}

      {/* ═══ Variable ═══ */}
      <VariableSelector
        value={selectedVariable}
        onChange={handleVariableChange}
        availableVariables={dataset?.variables}
      />

      {ALTITUDE_REQUIRED_TYPES.includes(vizType) && isSurfaceVariable && (
        <Alert severity="warning" sx={{ py: 0.5, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
          {t('page.explore.surfaceNoProfile')}
        </Alert>
      )}

      {/* ═══ Coordinates ═══ */}
      {needsTime && !isIndividual && (
        <TimeSelector value={selectedTime} onChange={setSelectedTime} />
      )}

      {needsLatLon && (
        <LatLonSelector
          latitude={selectedLatitude}
          longitude={selectedLongitude}
          onLatChange={setSelectedLatitude}
          onLonChange={setSelectedLongitude}
        />
      )}

      {vizType === 'crosssection' && (
        <>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>{t('page.crosssection.cutType')}</InputLabel>
              <Select
                value={crossSectionType}
                label={t('page.crosssection.cutType')}
                onChange={e => dispatch({ type: A.SET_CROSS_SECTION, value: e.target.value })}
              >
                <MenuItem value="meridional">{t('page.crosssection.meridional')}</MenuItem>
                <MenuItem value="zonal">{t('page.crosssection.zonal')}</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title={t('page.crosssection.swap')} arrow>
              <IconButton
                size="small"
                onClick={() => dispatch({ type: A.SET_CROSS_SECTION, value: crossSectionType === 'meridional' ? 'zonal' : 'meridional' })}
                sx={{ color: 'var(--cyan-accent)', border: '1px solid var(--glass-border)', borderRadius: 1 }}
              >
                <SwapIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
          <TextField
            size="small"
            label={crossSectionType === 'meridional' ? t('page.crosssection.fixedLon') : t('page.crosssection.fixedLat')}
            type="number"
            value={crossSectionType === 'meridional' ? selectedLongitude : selectedLatitude}
            onChange={e => {
              const val = parseFloat(e.target.value) || 0;
              if (crossSectionType === 'meridional') setSelectedLongitude(val);
              else setSelectedLatitude(val);
            }}
            fullWidth
          />
        </>
      )}

      {vizType === 'hovmoller' && (
        <FormControl fullWidth size="small">
          <InputLabel>{t('page.hovmoller.axisType')}</InputLabel>
          <Select
            value={hovmollerType}
            label={t('page.hovmoller.axisType')}
            onChange={e => dispatch({ type: A.SET_HOVMOLLER_TYPE, value: e.target.value })}
          >
            <MenuItem value="latitude">{t('page.hovmoller.latitude')}</MenuItem>
            <MenuItem value="longitude">{t('page.hovmoller.longitude')}</MenuItem>
          </Select>
        </FormControl>
      )}

      {needsAltitude && (
        <AltitudeSelector
          value={selectedAltitude}
          onChange={setSelectedAltitude}
          variableCode={selectedVariable}
        />
      )}

      {/* ═══ Display options (collapsible) ═══ */}
      {showColorscale && (
        <>
          <Box
            onClick={() => setShowDisplay(v => !v)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              cursor: 'pointer', color: 'var(--text-secondary)',
              '&:hover': { color: 'var(--text-primary)' },
            }}
          >
            <TuneIcon sx={{ fontSize: 16 }} />
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>
              {t('page.explore.sectionDisplay')}
            </Typography>
            <ExpandIcon sx={{ fontSize: 16, transform: showDisplay ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
          </Box>
          <Collapse in={showDisplay}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('selector.colorscale.label')}</InputLabel>
                <Select
                  value={colorscale}
                  label={t('selector.colorscale.label')}
                  onChange={e => dispatch({ type: A.SET_COLORSCALE, value: e.target.value })}
                >
                  {COLORSCALE_OPTIONS.map(opt => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  label={t('page.explore.zMin')}
                  type="number"
                  value={zMinInput}
                  onChange={e => dispatch({ type: A.SET_Z_MIN, value: e.target.value })}
                  fullWidth
                />
                <TextField
                  size="small"
                  label={t('page.explore.zMax')}
                  type="number"
                  value={zMaxInput}
                  onChange={e => dispatch({ type: A.SET_Z_MAX, value: e.target.value })}
                  fullWidth
                />
              </Box>
              {dataStats && (
                <Typography variant="caption" color="text.secondary">
                  {t('page.explore.dataRange', { min: dataStats.min?.toFixed(1), max: dataStats.max?.toFixed(1) })}
                </Typography>
              )}
            </Box>
          </Collapse>
        </>
      )}

      {/* ═══ Sticky actions at bottom ═══ */}
      <Box sx={{
        position: 'sticky',
        bottom: 0,
        pt: 1.5,
        pb: 0.5,
        mt: 'auto',
        background: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        borderTop: '1px solid var(--glass-border)',
      }}>
        <Button
          variant="contained"
          fullWidth
          onClick={onLancer}
          disabled={!selectedDataset || !selectedVariable || loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <LaunchIcon />}
        >
          {loading ? t('page.explore.loading') : t('page.explore.launch')}
        </Button>

        <Button
          variant="outlined"
          color={linkCopied ? 'success' : 'secondary'}
          fullWidth
          onClick={onCopyLink}
          startIcon={<LinkIcon />}
          disabled={!selectedDataset || !selectedVariable}
          size="small"
        >
          {linkCopied ? t('common.linkCopied') : t('page.explore.copyLink')}
        </Button>

        {error && (
          <Alert severity="error" onClose={() => dispatch({ type: A.CLEAR_ERROR })} sx={{ mt: 0.5 }}>
            {error}
          </Alert>
        )}
      </Box>
    </Paper>
  );
}
