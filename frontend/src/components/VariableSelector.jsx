import { Autocomplete, TextField, Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

/**
 * Liste des 23 variables atmospheriques du modele GEM-Mars.
 * Chaque variable possede :
 * - code : identifiant dans les fichiers NetCDF (ex: 'TT')
 * - unit : unite physique (les labels lisibles sont dans les fichiers i18n : variable.TT, variable.PX, etc.)
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
  { code: 'TT',   unit: 'K',      category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'PX',   unit: 'Pa',     category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'GZ',   unit: 'm2/s2',  category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'H2O',  unit: 'ppmv',   category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'CO2',  unit: 'ppmv',   category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'O3',   unit: 'ppmv',   category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'CO',   unit: 'ppmv',   category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'T9',   unit: 'K',      category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'DVM1', unit: 'kg/kg',  category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'DVM2', unit: 'kg/kg',  category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'DVM3', unit: 'kg/kg',  category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'RWIC', unit: 'um',     category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  { code: 'WW',   unit: 'Pa/s',   category: 'Thermodynamiques', altitudeType: 'altitudeT' },
  // Dynamiques (altitudeM, 102 niveaux)
  { code: 'UU',   unit: 'm/s',    category: 'Dynamiques',       altitudeType: 'altitudeM' },
  { code: 'VV',   unit: 'm/s',    category: 'Dynamiques',       altitudeType: 'altitudeM' },
  // Surface (pas d'altitude)
  { code: 'P0',   unit: 'Pa',     category: 'Surface',          altitudeType: null },
  { code: 'MLOC', unit: 'kg/m2',  category: 'Surface',          altitudeType: null },
  { code: 'MALO', unit: '-',      category: 'Surface',          altitudeType: null },
  { code: 'MCZ',  unit: 'kg/m2',  category: 'Surface',          altitudeType: null },
  { code: 'MH',   unit: 'pr-um',  category: 'Surface',          altitudeType: null },
  { code: 'MTSF', unit: 'K',      category: 'Surface',          altitudeType: null },
  { code: 'MCO2', unit: 'kg/m2',  category: 'Surface',          altitudeType: null },
  { code: 'MSN',  unit: 'kg/m2',  category: 'Surface',          altitudeType: null },
];

/** Map code → variable pour lookup O(1) au lieu de Array.find() O(n) */
export const VARIABLES_MAP = new Map(VARIABLES.map(v => [v.code, v]));

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
  const { t } = useTranslation();

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
      groupBy={(v) => t(`variable.category.${v.category}`)}
      getOptionLabel={(v) => `${v.code} — ${t(`variable.${v.code}`)} (${v.unit})`}
      renderOption={({ key, ...props }, v) => (
        <Box component="li" key={key} {...props}>
          <Typography variant="body2">
            <strong>{v.code}</strong> — {t(`variable.${v.code}`)} ({v.unit})
          </Typography>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={t('selector.variable.label')}
          placeholder={t('selector.variable.placeholder')}
          variant="outlined"
        />
      )}
    />
  );
}

export default VariableSelector;
