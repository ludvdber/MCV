/**
 * Qui est A, qui est B, et quelles vues peuvent l'etre — une seule definition.
 *
 * Le rideau compare la vue ACTIVE (volet A) a une autre coupe de la meme
 * variable (volet B). Cette regle etait ecrite deux fois, dans ExploreTools et
 * dans ExploreResultsPanel, et les deux copies avaient deja diverge : le
 * panneau verifiait que l'id memorise designe toujours une coupe comparable,
 * la barre d'outils se contentait de `resultsById[curtainBId]`. L'infobulle du
 * bouton pouvait donc nommer un volet B que le panneau n'affichait pas.
 *
 * Meme famille de piege que `windKeyForView` : deux copies d'une regle de
 * selection finissent toujours par montrer deux choses differentes.
 */

/**
 * Les coupes comparables a la vue active : meme type, meme variable, et pas
 * elle-meme. L'ordre est celui des onglets.
 *
 * @param {Object} state etat de la console (resultsById, resultOrder, activeResult)
 * @returns {Array<Object>} les resultats comparables, jamais null
 */
export function slicesComparables(state) {
  const { resultsById = {}, resultOrder = [], activeResult = null } = state ?? {};
  const active = resultsById[activeResult];
  if (active?.type !== 'slice') return [];
  return resultOrder
    .filter((id) => resultsById[id]?.type === 'slice' && id !== activeResult
      && resultsById[id]?.params?.variable === active.params?.variable)
    .map((id) => resultsById[id]);
}

/**
 * Le volet B effectif : la vue choisie si elle est toujours comparable, sinon
 * la premiere de la liste.
 *
 * Le repli n'est pas un detail de confort. Fermer l'onglet choisi, changer de
 * variable ou activer l'onglet qui servait de B laisserait sinon le rideau
 * pointer sur une vue absente ou sur lui-meme, c'est-a-dire une comparaison
 * d'une carte avec elle-meme, dont les statistiques seraient parfaitement
 * credibles.
 *
 * @param {Object} state etat de la console (ajoute curtainBId)
 * @param {Array<Object>} [candidats] liste deja calculee, pour ne pas la refaire
 * @returns {Object|null} le volet B, ou null si aucune comparaison n'est possible
 */
export function voletB(state, candidats = slicesComparables(state)) {
  const choisi = candidats.find((s) => s.id === state?.curtainBId);
  return choisi ?? candidats[0] ?? null;
}

/** Le nom affichable d'une vue : son jeu de donnees, faute de quoi son titre. */
export function etiquetteVue(resultat) {
  return resultat ? (resultat.datasetLabel || resultat.label || '') : '';
}
