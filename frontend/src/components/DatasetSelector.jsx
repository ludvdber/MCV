import { Autocomplete, TextField, Box, Typography } from '@mui/material';

/**
 * Selecteur de dataset Mars.
 * Affiche un Autocomplete MUI avec les datasets disponibles.
 * Chaque option montre l'annee martienne (MY) et la plage de longitude solaire (Ls).
 *
 * @param {Object[]} datasets - liste des datasets du catalogue (depuis getCatalog)
 * @param {string|null} value - ID du dataset selectionne
 * @param {function} onChange - callback appelee avec l'ID du dataset choisi (ou null)
 * @param {boolean} [disabled=false]
 */
function DatasetSelector({ datasets, value, onChange, disabled = false }) {
  const selected = datasets.find(ds => ds.id === value) || null;

  return (
    <Autocomplete
      fullWidth
      options={datasets}
      value={selected}
      onChange={(_, ds) => onChange(ds?.id || null)}
      disabled={disabled}
      getOptionLabel={(ds) => `MY${ds.marsYear} — Ls ${ds.lsStart}° a ${ds.lsEnd}°`}
      renderOption={({ key, ...props }, ds) => (
        <Box component="li" key={key} {...props}>
          <Box>
            <Typography variant="body1">
              MY{ds.marsYear} — Ls {ds.lsStart}° a {ds.lsEnd}°
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {ds.variables.length} variables | {ds.dimensions.time} pas de temps
            </Typography>
          </Box>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Dataset"
          placeholder="Selectionnez un dataset..."
          variant="outlined"
        />
      )}
    />
  );
}

export default DatasetSelector;
