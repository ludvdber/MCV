/**
 * Panneau gauche (320px) de la page Exploration.
 *
 * Contient tous les sélecteurs de paramètres et les boutons d'action.
 * Consomme ExploreContext + MarsContext directement — 2 props seulement.
 *
 * Props :
 *   onLancer    () => void — déclenche la requête API
 *   onCopyLink  () => void — copie le permalien
 */
import {
  Box, Paper, Typography, Select, MenuItem, FormControl, InputLabel,
  Button, CircularProgress, Alert, Divider, TextField, Chip,
} from '@mui/material';
import {
  RocketLaunch as LaunchIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useMars } from '../../context/MarsContext';
import { INDIVIDUAL_PREFIX } from '../../constants';
import { COLORSCALE_OPTIONS } from '../../utils/colorscales';
import { useExploreState, useExploreDispatch, A } from './ExploreContext.jsx';
import {
  VIZ_TYPES, COLORSCALE_TYPES, ALTITUDE_REQUIRED_TYPES,
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
    vizType, crossSectionType, colorscale, zMinInput, zMaxInput,
    loading, error, linkCopied,
    resultsById, activeResult,
  } = state;

  const isIndividual   = selectedDataset?.startsWith(INDIVIDUAL_PREFIX);
  const needsTime      = ['slice', 'profile', 'crosssection'].includes(vizType);
  const needsLatLon    = ['timeseries', 'profile'].includes(vizType);
  const needsAltitude  = ['slice', 'timeseries', 'animation'].includes(vizType);

  const isSurfaceVariable = (() => {
    const v = VARIABLES_MAP.get(selectedVariable);
    return v?.altitudeType === null;
  })();

  const activeResultObj = resultsById[activeResult] ?? null;
  const dataStats = activeResultObj?.data?.stats;

  return (
    <Paper sx={{
      width: 320, flexShrink: 0, p: 2.5,
      overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <Typography
        variant="h6"
        sx={{
          fontFamily: 'var(--font-display)',
          color: 'var(--mars-orange)',
          textShadow: '0 0 16px rgba(224, 90, 43, 0.4)',
        }}
      >
        {t('page.explore.title')}
      </Typography>

      <DatasetSelector
        datasets={datasets}
        value={selectedDataset}
        onChange={setSelectedDataset}
        individualYears={individualYears}
        initialIndividualMY={selectedIndividualMY}
        initialIndividualLs={selectedIndividualLs}
      />

      {isIndividual && (
        <Chip
          label={`INDIVIDUAL — ${selectedDataset}`}
          size="small"
          sx={{
            bgcolor: 'rgba(0,188,212,0.15)',
            color: 'var(--cyan-accent)',
            border: '1px solid var(--cyan-accent)',
            fontFamily: 'var(--font-body)',
            fontSize: '0.75rem',
          }}
        />
      )}

      <Divider sx={{ borderColor: 'rgba(56, 189, 248, 0.12)' }} />

      <FormControl fullWidth size="small">
        <InputLabel>{t('page.explore.vizType')}</InputLabel>
        <Select
          value={vizType}
          label={t('page.explore.vizType')}
          onChange={e => dispatch({ type: A.SET_VIZ_TYPE, value: e.target.value })}
        >
          {VIZ_TYPES.map(vt => (
            <MenuItem
              key={vt.value}
              value={vt.value}
              disabled={isIndividual && ['timeseries', 'animation'].includes(vt.value)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {vt.icon} {t(vt.labelKey)}
                {isIndividual && ['timeseries', 'animation'].includes(vt.value) && (
                  <Typography variant="caption" sx={{ color: 'text.disabled', ml: 0.5 }}>{t('page.explore.meanOnly')}</Typography>
                )}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Divider sx={{ borderColor: 'rgba(56, 189, 248, 0.12)' }} />

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
          <FormControl fullWidth size="small">
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

      {needsAltitude && (
        <AltitudeSelector
          value={selectedAltitude}
          onChange={setSelectedAltitude}
          variableCode={selectedVariable}
        />
      )}

      {COLORSCALE_TYPES.includes(vizType) && (
        <>
          <Divider sx={{ borderColor: 'rgba(56, 189, 248, 0.12)' }} />

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
        </>
      )}

      {vizType === 'animation' && (
        <Typography variant="caption" color="text.secondary">
          {t('page.explore.animCaption')}
        </Typography>
      )}

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
      >
        {linkCopied ? t('common.linkCopied') : t('page.explore.copyLink')}
      </Button>

      {error && (
        <Alert severity="error" onClose={() => dispatch({ type: A.CLEAR_ERROR })}>
          {error}
        </Alert>
      )}
    </Paper>
  );
}
