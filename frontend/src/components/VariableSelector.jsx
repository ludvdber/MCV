import { Autocomplete, TextField, Box, Typography } from '@mui/material';

/**
 * Liste des 23 variables atmospheriques du modele GEM-Mars.
 * Chaque variable possede :
 * - code : identifiant dans les fichiers NetCDF (ex: 'TT')
 * - label : nom lisible
 * - unit : unite physique
 * - category : groupe d'affichage (Thermodynamiques, Dynamiques, Surface)
 * - altitudeType : grille d'altitude utilisee
 *     'altitudeT' = 103 niveaux (variables thermodynamiques)
 *     'altitudeM' = 102 niveaux (variables dynamiques UU/VV)
 *     null = variable de surface, pas de dimension altitude
 *
 * Exporte en constante nommee car reutilisee par AltitudeSelector et les pages.
 */
export const VARIABLES = [
  // Thermodynamiques (altitudeT, 103 niveaux)
  { code: 'TT',   label: 'Temperature',            unit: 'K',      category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'PX',   label: 'Pression',               unit: 'Pa',     category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'GZ',   label: 'Geopotentiel',            unit: 'm2/s2',  category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'H2O',  label: 'Vapeur d\'eau',           unit: 'ppmv',   category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'CO2',  label: 'Dioxyde de carbone',      unit: 'ppmv',   category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'O3',   label: 'Ozone',                   unit: 'ppmv',   category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'CO',   label: 'Monoxyde de carbone',     unit: 'ppmv',   category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'T9',   label: 'Glace d\'eau nuages',     unit: 'K',      category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'DVM1', label: 'Poussiere mode 1',        unit: 'kg/kg',  category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'DVM2', label: 'Poussiere mode 2',        unit: 'kg/kg',  category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'DVM3', label: 'Poussiere mode 3',        unit: 'kg/kg',  category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'RWIC', label: 'Rayon effectif glace',    unit: 'um',     category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'WW',   label: 'Vitesse verticale',       unit: 'Pa/s',   category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  // Dynamiques (altitudeM, 102 niveaux)
  { code: 'UU',   label: 'Vent zonal',              unit: 'm/s',    category: 'Dynamiques',       altitudeType: 'altitudeM' },
  { code: 'VV',   label: 'Vent meridien',           unit: 'm/s',    category: 'Dynamiques',       altitudeType: 'altitudeM' },
  // Surface (pas d'altitude)
  { code: 'P0',   label: 'Pression surface',        unit: 'Pa',     category: 'Surface',          altitudeType: null },
  { code: 'MLOC', label: 'Poussiere colonne',       unit: 'kg/m2',  category: 'Surface',          altitudeType: null },
  { code: 'MALO', label: 'Opacite locale',          unit: '-',      category: 'Surface',          altitudeType: null },
  { code: 'MCZ',  label: 'Glace colonne',           unit: 'kg/m2',  category: 'Surface',          altitudeType: null },
  { code: 'MH',   label: 'Vapeur colonne',          unit: 'pr-um',  category: 'Surface',          altitudeType: null },
  { code: 'MTSF', label: 'Temperature surface',     unit: 'K',      category: 'Surface',          altitudeType: null },
  { code: 'MCO2', label: 'Glace CO2 surface',       unit: 'kg/m2',  category: 'Surface',          altitudeType: null },
  { code: 'MSN',  label: 'Glace H2O surface',       unit: 'kg/m2',  category: 'Surface',          altitudeType: null },
];

/**
 * Selecteur de variable atmospherique avec groupement par categorie.
 * Utilise MUI Autocomplete avec groupBy pour organiser les options.
 *
 * @param {string|null} value - code de la variable selectionnee (ex: 'TT')
 * @param {function} onChange - callback appelee avec le code choisi (ou null)
 * @param {boolean} [disabled=false]
 * @param {string[]} [availableVariables] - si fourni, filtre la liste aux variables
 *   presentes dans le dataset selectionne (provient de dataset.variables)
 */
function VariableSelector({ value, onChange, disabled = false, availableVariables }) {
  const options = availableVariables
    ? VARIABLES.filter(v => availableVariables.includes(v.code))
    : VARIABLES;

  const selected = options.find(v => v.code === value) || null;

  return (
    <Autocomplete
      fullWidth
      options={options}
      value={selected}
      onChange={(_, v) => onChange(v?.code || null)}
      disabled={disabled}
      groupBy={(v) => v.category}
      getOptionLabel={(v) => `${v.code} — ${v.label} (${v.unit})`}
      renderOption={({ key, ...props }, v) => (
        <Box component="li" key={key} {...props}>
          <Typography variant="body2">
            <strong>{v.code}</strong> — {v.label} ({v.unit})
          </Typography>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Variable atmospherique"
          placeholder="Selectionnez une variable..."
          variant="outlined"
        />
      )}
    />
  );
}

export default VariableSelector;
