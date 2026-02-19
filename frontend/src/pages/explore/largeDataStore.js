/**
 * Stockage externe des donnees volumineuses (frames d'animation) hors du state React.
 *
 * Problème : les frames d'animation (48 frames × ~180×360 floats ≈ 3M valeurs
 * par onglet) transitaient par le reducer useReducer et le contexte React.
 * Chaque action dispatche (toggle, changement d'onglet…) causait une
 * reconciliation React sur la totalite de ces donnees, meme sans changement
 * sur les frames elles-memes.
 *
 * Solution : stocker les donnees ici (Map module-level, hors React),
 * ne garder qu'un { id, type, params, label, data: null } leger dans le state.
 *
 * Cycle de vie :
 *   Ajout       → largeDataStore.set(id, data)     dans handleLancer (ExplorePage)
 *   Lecture     → largeDataStore.get(id)            dans ExploreResultsPanel
 *   Suppression → largeDataStore.delete(id)         dans handleRemoveResult (ExplorePage)
 */
export const largeDataStore = new Map();
