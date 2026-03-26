import { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getCatalog, getIndividualCatalog } from '../services/api';
import { VARIABLES_MAP } from '../components/VariableSelector';

/**
 * Contexte React global pour le Mars Climate Viewer.
 *
 * Centralise l'etat partage entre toutes les pages :
 * - Le catalogue est charge une seule fois au montage du Provider
 *   (plus de getCatalog() duplique dans chaque page)
 * - Les selections (dataset, variable, altitude, etc.) sont preservees
 *   quand l'utilisateur navigue entre les pages
 *
 * Expose aussi des valeurs derivees (dataset object, datasetLabel)
 * et le handleVariableChange avec clamping altitude.
 */
const MarsContext = createContext(null);

/**
 * Provider a placer autour de l'arbre de composants (dans App.jsx).
 * Charge le catalogue au montage et expose tout l'etat global + setters.
 */
function MarsProvider({ children }) {
  const { t } = useTranslation();

  // --- Catalogue MEAN ---
  const [datasets, setDatasets] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(null);

  // --- Catalogue INDIVIDUAL ---
  const [individualYears, setIndividualYears] = useState([]);
  const [individualLoading, setIndividualLoading] = useState(true);

  // --- Selection INDIVIDUAL (MY + Ls) — utilise aussi pour les permaliens ---
  const [selectedIndividualMY, setSelectedIndividualMY] = useState(null);
  const [selectedIndividualLs, setSelectedIndividualLs] = useState(null);

  // --- Selections utilisateur ---
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [selectedVariable, setSelectedVariable] = useState('TT');
  const [selectedTime, setSelectedTime] = useState(23);
  const [selectedAltitude, setSelectedAltitude] = useState(49);
  const [selectedLatitude, setSelectedLatitude] = useState(0);
  const [selectedLongitude, setSelectedLongitude] = useState(0);

  // --- Chargement unique des catalogues ---
  useEffect(() => {
    getCatalog()
      .then(res => setDatasets(res.data))
      .catch(err => setCatalogError(err.message))
      .finally(() => setCatalogLoading(false));
  }, []);

  useEffect(() => {
    getIndividualCatalog()
      .then(res => setIndividualYears(res.data))
      .catch(() => {})
      .finally(() => setIndividualLoading(false));
  }, []);

  // --- Valeurs derivees ---
  const dataset = datasets.find(d => d.id === selectedDataset) || null;
  const datasetLabel = dataset
    ? t('selector.dataset.format', { my: dataset.marsYear, lsStart: dataset.lsStart, lsEnd: dataset.lsEnd })
    : '';

  /**
   * Change la variable selectionnee avec clamping automatique de l'altitude.
   * - Variable de surface (altitudeType null) → altitude forcee a 0
   * - Variable dynamique (altitudeM, 102 niveaux) → altitude plafonnee a 101
   * - Variable thermodynamique (altitudeT, 103 niveaux) → pas de changement
   */
  const handleVariableChange = useCallback((code) => {
    setSelectedVariable(code);
    const v = VARIABLES_MAP.get(code);
    if (!v?.altitudeType) setSelectedAltitude(0);
    else if (v.altitudeType === 'altitudeM') setSelectedAltitude(prev => prev > 101 ? 101 : prev);
  }, []);

  const value = useMemo(() => ({
    // Catalogue
    datasets,
    catalogLoading,
    catalogError,
    // Selections
    selectedDataset,
    setSelectedDataset,
    selectedVariable,
    handleVariableChange,
    selectedTime,
    setSelectedTime,
    selectedAltitude,
    setSelectedAltitude,
    selectedLatitude,
    setSelectedLatitude,
    selectedLongitude,
    setSelectedLongitude,
    // Catalogue INDIVIDUAL
    individualYears,
    individualLoading,
    selectedIndividualMY,
    setSelectedIndividualMY,
    selectedIndividualLs,
    setSelectedIndividualLs,
    // Valeurs derivees
    dataset,
    datasetLabel,
  }), [
    datasets, catalogLoading, catalogError,
    selectedDataset, selectedVariable, selectedTime,
    selectedAltitude, selectedLatitude, selectedLongitude,
    individualYears, individualLoading,
    selectedIndividualMY, selectedIndividualLs,
    dataset, datasetLabel, handleVariableChange,
  ]);

  return (
    <MarsContext.Provider value={value}>
      {children}
    </MarsContext.Provider>
  );
}

/**
 * Hook custom pour acceder au contexte Mars.
 * Lance une erreur si utilise hors d'un MarsProvider.
 *
 * @returns {Object} etat global + setters + valeurs derivees
 */
function useMars() {
  const context = useContext(MarsContext);
  if (!context) {
    throw new Error('useMars doit etre utilise dans un MarsProvider');
  }
  return context;
}

export { MarsProvider, useMars };
