/**
 * Scénarios scientifiques partagés : presets ancrés sur le catalogue.
 *
 * Utilisés par le panneau latéral de la console (SCÉNARIOS), par les chips
 * du hero de l'accueil (liens /explore?scenario=N) et par la restauration
 * d'URL d'ExplorePage. Un scénario n'est qu'un plan PARTIEL : le dataset
 * réel est résolu au moment du clic contre le catalogue courant
 * (resolveDataset : MEAN prioritaire, repli fichier individuel), puis le
 * plan passe par le même runner déterministe que ⌘K et les permaliens.
 */
import { useCallback, useMemo } from 'react';
import {
  GraphicEq as TidesIcon,
  Landscape as JetIcon,
  WaterDrop as WaterIcon,
} from '@mui/icons-material';
import { useMars } from '../../context/MarsContext';
import { resolveDataset } from './commandParser.js';
import { useCommandRunner } from './useCommandRunner.js';
import { MEAN_ONLY_TYPES } from './exploreConstants.jsx';
import { INDIVIDUAL_PREFIX } from '../../constants';

export const SCENARIOS = [
  { key: '1', icon: <TidesIcon sx={{ fontSize: 15 }} />, plan: { viz: 'tides', variable: 'TT', altKm: 50, lsTarget: 270 } },
  { key: '2', icon: <JetIcon sx={{ fontSize: 15 }} />, plan: { viz: 'crosssection', variable: 'UU', lsTarget: 270, timeIdx: 24 } },
  { key: '3', icon: <WaterIcon sx={{ fontSize: 15 }} />, plan: { viz: 'slice', variable: 'H2O', altKm: 30, lsTarget: 90, timeIdx: 24 } },
];

/**
 * Exemples REELLEMENT jouables avec le catalogue courant : un exemple qui cible
 * un Ls sans fichier correspondant (l'IASB peut deployer un sous-ensemble de
 * donnees) est masque plutot que d'ouvrir une vue sur le mauvais fichier. Sert
 * au panneau (liste affichee) et a la visite guidee (etape « Exemples » incluse
 * seulement si au moins un exemple resout).
 */
export function useResolvedScenarios() {
  const { datasets, individualYears } = useMars();
  return useMemo(
    () => SCENARIOS.filter(s => !!resolveDataset(
      { lsTarget: s.plan.lsTarget ?? null, myTarget: null },
      { datasets, individualYears },
    )),
    [datasets, individualYears],
  );
}

/** Résout un plan partiel contre le catalogue puis l'exécute.
 *  @returns {(partial: Object) => Promise<boolean>} */
export function useScenarioRunner() {
  const runPlan = useCommandRunner();
  const { datasets, individualYears } = useMars();

  return useCallback((partial) => {
    const resolved = resolveDataset(
      { lsTarget: partial.lsTarget ?? null, myTarget: null },
      { datasets, individualYears },
    );
    const plan = { ...partial, datasetId: resolved?.datasetId, individual: resolved?.individual };
    if (plan.datasetId?.startsWith(INDIVIDUAL_PREFIX) && MEAN_ONLY_TYPES.includes(plan.viz)) {
      plan.invalid = true;
    }
    return runPlan(plan);
  }, [datasets, individualYears, runPlan]);
}
