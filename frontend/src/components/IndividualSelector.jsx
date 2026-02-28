import { useState, useMemo, useEffect } from 'react';
import {
  Box, Typography, Slider, Button, Chip,
  FormControl, InputLabel, Select, MenuItem, TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

/**
 * Selecteur de fichier INDIVIDUAL.
 * Permet de choisir une annee martienne (MY) et un Ls cible via :
 *   - un slider (navigation grossiere, pas 0.5°)
 *   - un TextField numerique synchronise (saisie precise a 4 decimales)
 *
 * Le datasetId genere (IND_MY{nn}_LS{dd.dddd}) utilise la valeur exacte
 * du TextField, pas celle arrondie par le slider.
 *
 * @param {Object[]}    years         - catalogue individual [{marsYear, lsMin, lsMax}]
 * @param {function}    onSelect      - callback avec l'identifiant genere
 * @param {number|null} [initialYear] - MY a pre-selectionner (restore permalien)
 * @param {number|null} [initialLs]   - Ls a pre-selectionner (restore permalien)
 */
function IndividualSelector({ years = [], onSelect, initialYear = null, initialLs = null }) {
  const { t } = useTranslation();
  const [selectedYear, setSelectedYear] = useState('');
  /** Valeur numerique source de verite (slider + datasetId) */
  const [targetLs, setTargetLs] = useState(0);
  /** Valeur texte du TextField (permet la saisie libre sans clamping immediat) */
  const [textValue, setTextValue] = useState('0.00');

  const yearInfo = useMemo(
    () => years.find(y => y.marsYear === selectedYear) || null,
    [years, selectedYear]
  );

  /** Sync depuis les props (restore permalien) — se declenche quand initialYear/initialLs changent */
  useEffect(() => {
    if (initialYear == null || !years.length) return;
    setSelectedYear(initialYear);
    const ls = initialLs ?? years.find(y => y.marsYear === initialYear)?.lsMin ?? 0;
    setTargetLs(ls);
    setTextValue(ls.toFixed(2));
  }, [initialYear, initialLs, years]);

  /* ---- Changement d'annee ---- */
  const handleYearChange = (e) => {
    const my = e.target.value;
    setSelectedYear(my);
    const info = years.find(y => y.marsYear === my);
    if (info) {
      setTargetLs(info.lsMin);
      setTextValue(info.lsMin.toFixed(2));
    }
  };

  /* ---- Slider → TextField (navigation grossiere 0.5°) ---- */
  const handleSliderChange = (_, v) => {
    setTargetLs(v);
    setTextValue(v.toFixed(2));
  };

  /* ---- TextField onChange → mise a jour live du slider ---- */
  const handleTextChange = (e) => {
    const raw = e.target.value;
    setTextValue(raw);

    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && yearInfo) {
      // Mise a jour du slider en temps reel (sans clamping pendant la frappe)
      setTargetLs(Math.min(Math.max(parsed, yearInfo.lsMin), yearInfo.lsMax));
    }
  };

  /* ---- TextField onBlur → clampage silencieux ---- */
  const handleTextBlur = () => {
    if (!yearInfo) return;
    const parsed = parseFloat(textValue);
    const clamped = isNaN(parsed)
      ? targetLs
      : Math.min(Math.max(parsed, yearInfo.lsMin), yearInfo.lsMax);
    setTargetLs(clamped);
    setTextValue(clamped.toFixed(2));
  };

  /* Le datasetId utilise la valeur precise du TextField (4 decimales) */
  const datasetId = selectedYear
    ? `IND_MY${selectedYear}_LS${targetLs.toFixed(2)}`
    : null;

  const sliderMarks = useMemo(() => {
    if (!yearInfo) return [];
    const marks = [];
    const start = Math.ceil(yearInfo.lsMin / 30) * 30;
    for (let v = start; v <= yearInfo.lsMax; v += 30) {
      marks.push({ value: v, label: `${v}°` });
    }
    return marks;
  }, [yearInfo]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Select annee martienne */}
      <FormControl fullWidth>
        <InputLabel>{t('selector.individual.year')}</InputLabel>
        <Select
          value={selectedYear}
          onChange={handleYearChange}
          label={t('selector.individual.year')}
        >
          {years.map(y => (
            <MenuItem key={y.marsYear} value={y.marsYear}>
              MY{y.marsYear}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {yearInfo && (
        <>
          {/* Info plage Ls */}
          <Typography variant="caption" sx={{ color: 'var(--cyan-accent)' }}>
            {t('selector.individual.range', { min: yearInfo.lsMin.toFixed(2), max: yearInfo.lsMax.toFixed(2) })}
          </Typography>

          {/* Slider + TextField sur la meme ligne */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            {/* Slider : navigation grossiere */}
            <Box sx={{ flex: 1, px: 1, pt: 0.5 }}>
              <Slider
                value={targetLs}
                onChange={handleSliderChange}
                min={yearInfo.lsMin}
                max={yearInfo.lsMax}
                step={0.01}
                marks={sliderMarks}
                valueLabelDisplay="auto"
                valueLabelFormat={v => `${v.toFixed(1)}°`}
              />
            </Box>

            {/* TextField : saisie precise a 4 decimales */}
            <TextField
              size="small"
              label="Ls (°)"
              type="number"
              value={textValue}
              onChange={handleTextChange}
              onBlur={handleTextBlur}
              slotProps={{ htmlInput: { step: 0.01, min: yearInfo.lsMin, max: yearInfo.lsMax } }}
              sx={{
                width: 130,
                flexShrink: 0,
                '& input': { fontFamily: 'var(--font-body)', fontSize: '0.85rem' },
              }}
            />
          </Box>

          {/* Preview + bouton */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              label={datasetId}
              size="small"
              sx={{
                bgcolor: 'rgba(0,188,212,0.15)',
                color: 'var(--cyan-accent)',
                border: '1px solid var(--cyan-accent)',
                fontFamily: 'var(--font-body)',
                maxWidth: 220,
              }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={() => onSelect(datasetId)}
              disabled={!datasetId}
              sx={{
                bgcolor: 'var(--cyan-accent)',
                color: '#000',
                '&:hover': { bgcolor: '#26c6da' },
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {t('selector.individual.select')}
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}

export default IndividualSelector;
