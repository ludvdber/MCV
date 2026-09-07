/**
 * Exécution d'un plan de commande (⌘K ou scénario du panneau latéral).
 *
 * Applique le plan aux sélections globales (MarsContext) puis réutilise le
 * mécanisme d'auto-lancement des permaliens : handleLancer part au prochain
 * rendu avec l'état frais, sans closure périmée. « 50 km » est converti en
 * indice du niveau le plus proche via l'API des altitudes (cache client).
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMars } from '../../context/MarsContext';
import { useToast } from '../../context/ToastContext';
import { getAltitudes } from '../../services/api';
import { useExploreDispatch, useExploreState, A } from './ExploreContext.jsx';
import { MAX_TABS } from './exploreConstants.jsx';

export function useCommandRunner() {
  const { t } = useTranslation();
  const showToast = useToast();
  const dispatch = useExploreDispatch();
  const { resultOrder } = useExploreState();
  const {
    selectedDataset, selectedVariable,
    setSelectedDataset, handleVariableChange, setSelectedTime,
    setSelectedAltitude, setSelectedLatitude, setSelectedLongitude,
    setSelectedIndividualMY, setSelectedIndividualLs,
  } = useMars();

  /** @returns {Promise<boolean>} true si la visualisation a été lancée */
  const runPlan = useCallback(async (plan) => {
    // La limite d'onglets se teste ICI, avant toute annonce. Elle etait laissee
    // au lancement en aval, qui refuse silencieusement : le clic sur un exemple
    // affichait alors « visualisation lancee » en vert et rien n'apparaissait,
    // la seule explication vivant dans le panneau de parametres replie.
    if (resultOrder.length >= MAX_TABS) {
      showToast(t('page.explore.tabLimit', { max: MAX_TABS }), 'warning');
      return false;
    }
    // Combinaison impossible (vue MEAN-only sur fichier individuel).
    if (plan.invalid) {
      showToast(t('explore.cmdk.meanOnly'), 'warning');
      return false;
    }

    if (plan.datasetId) setSelectedDataset(plan.datasetId);
    // Fichier individuel : synchronise aussi MY / Ls pour que le panneau de
    // paramètres reflète la sélection (même mécanisme que les permaliens).
    if (plan.individual) {
      setSelectedIndividualMY(plan.individual.my);
      setSelectedIndividualLs(plan.individual.ls);
    }
    if (plan.variable) handleVariableChange(plan.variable);
    if (plan.timeIdx != null) setSelectedTime(plan.timeIdx);
    if (plan.lat != null) setSelectedLatitude(plan.lat);
    if (plan.lon != null) setSelectedLongitude(plan.lon);
    if (plan.viz) dispatch({ type: A.SET_VIZ_TYPE, value: plan.viz });

    if (plan.altKm != null) {
      try {
        const ds = plan.datasetId ?? selectedDataset;
        const varCode = plan.variable ?? selectedVariable;
        if (ds && varCode) {
          const res = await getAltitudes({ dataset: ds, variable: varCode });
          const alts = res.data?.altitudes;
          if (Array.isArray(alts) && alts.length > 0) {
            let best = 0, bd = Infinity;
            for (let i = 0; i < alts.length; i++) {
              const d = Math.abs(alts[i] - plan.altKm);
              if (d < bd) { bd = d; best = i; }
            }
            setSelectedAltitude(best);
          }
        }
      } catch { /* altitude inchangée si l'appel échoue */ }
    }

    dispatch({ type: A.SET_PENDING_AUTO, value: true });
    showToast(t('explore.cmdk.launched'), 'success');
    return true;
  }, [t, showToast, dispatch, resultOrder.length, selectedDataset, selectedVariable,
    setSelectedDataset, handleVariableChange, setSelectedTime, setSelectedAltitude,
    setSelectedLatitude, setSelectedLongitude, setSelectedIndividualMY, setSelectedIndividualLs]);

  return runPlan;
}
