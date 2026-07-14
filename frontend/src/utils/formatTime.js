/**
 * Formatte un pas de temps GEM-Mars (0-47) en heure locale solaire martienne.
 * Convention alignee sur la coordonnee `time` des fichiers (long_name
 * « Hour of day (local solar time) », valeurs 0.0, 0.5, ..., 23.5 h) : le pas k
 * correspond a l'heure locale k * 0,5 h, avec k=0 = minuit. (L'ancienne formule
 * (k+1)*0,5 decalait tout l'affichage de +0,5 h par rapport aux fichiers.)
 * (Vivait dans TimeSelector.jsx ; extrait pour que ce composant n'exporte
 * qu'un composant — règle react-refresh/only-export-components.)
 */
export const formatTime = (timestep) => `${timestep * 0.5}h`;
