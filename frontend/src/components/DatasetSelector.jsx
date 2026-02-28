import { useState, useEffect } from 'react';
import { Autocomplete, TextField, Box, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import IndividualSelector from './IndividualSelector';

/**
 * Selecteur de dataset Mars avec toggle MEAN / INDIVIDUAL.
 *
 * En mode MEAN  : Autocomplete classique sur les datasets du catalogue.
 * En mode INDIVIDUAL : IndividualSelector (MY + Slider Ls).
 *
 * Le onChange recoit toujours un string (ID MEAN ou IND_MY{nn}_LS{dd.dd}).
 *
 * @param {Object[]} datasets - liste des datasets MEAN
 * @param {string|null} value - ID du dataset selectionne
 * @param {function} onChange - callback avec l'ID
 * @param {boolean} [disabled=false]
 * @param {Object[]} [individualYears=[]] - catalogue individual
 * @param {number|null} [initialIndividualMY=null] - MY pre-selectionnee (restore permalien)
 * @param {number|null} [initialIndividualLs=null] - Ls pre-selectionnee (restore permalien)
 */
function DatasetSelector({ datasets, value, onChange, disabled = false, individualYears = [], initialIndividualMY = null, initialIndividualLs = null }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState('mean');
  const selected = datasets.find(ds => ds.id === value) || null;

  const showToggle = individualYears.length > 0;

  /** Basculer automatiquement en mode INDIVIDUAL si value est un IND_ (restore permalien) */
  useEffect(() => {
    if (value?.startsWith('IND_') && showToggle) setMode('individual');
  }, [value, showToggle]);

  /** Revenir en mode MEAN quand le toggle n'est pas disponible (pages legacy sans individualYears) */
  useEffect(() => {
    if (!showToggle) setMode('mean');
  }, [showToggle]);

  const handleModeChange = (_, newMode) => {
    if (newMode !== null) {
      setMode(newMode);
      onChange(null); // reset selection on mode switch
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Toggle MEAN / INDIVIDUAL */}
      {showToggle && (
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          size="small"
          fullWidth
          disabled={disabled}
          sx={{
            '& .MuiToggleButton-root': {
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: '0.85rem',
              color: 'rgba(255,255,255,0.6)',
              borderColor: 'rgba(255,255,255,0.2)',
              '&.Mui-selected': {
                color: 'var(--cyan-accent)',
                bgcolor: 'rgba(0,188,212,0.15)',
                borderColor: 'var(--cyan-accent)',
              },
            },
          }}
        >
          <ToggleButton value="mean">MEAN</ToggleButton>
          <ToggleButton value="individual">INDIVIDUAL</ToggleButton>
        </ToggleButtonGroup>
      )}

      {/* Mode MEAN : Autocomplete */}
      {mode === 'mean' && (
        <Autocomplete
          fullWidth
          options={datasets}
          value={selected}
          onChange={(_, ds) => onChange(ds?.id || null)}
          disabled={disabled}
          getOptionLabel={(ds) => t('selector.dataset.format', { my: ds.marsYear, lsStart: ds.lsStart, lsEnd: ds.lsEnd })}
          renderOption={({ key, ...props }, ds) => (
            <Box component="li" key={key} {...props}>
              <Box>
                <Typography variant="body1">
                  {t('selector.dataset.format', { my: ds.marsYear, lsStart: ds.lsStart, lsEnd: ds.lsEnd })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('selector.dataset.variables', { count: ds.variables.length, time: ds.dimensions.time })}
                </Typography>
              </Box>
            </Box>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t('selector.dataset.label')}
              placeholder={t('selector.dataset.placeholder')}
              variant="outlined"
            />
          )}
        />
      )}

      {/* Mode INDIVIDUAL : IndividualSelector */}
      {mode === 'individual' && (
        <IndividualSelector
          years={individualYears}
          onSelect={onChange}
          initialYear={initialIndividualMY}
          initialLs={initialIndividualLs}
        />
      )}
    </Box>
  );
}

export default DatasetSelector;
