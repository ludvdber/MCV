/**
 * Amène le conteneur du viewer à l'écran quand un résultat arrive, uniquement
 * en disposition étroite (< 900 px, le breakpoint md des pages) : sur mobile le
 * graphique se rend sous la ligne de flottaison et, sans défilement, l'appui
 * sur « Visualiser » semble ne rien faire.
 *
 * Respecte prefers-reduced-motion (défilement instantané au lieu d'animé) et
 * laisse 72 px de marge haute pour le bouton de menu flottant mobile.
 *
 * @param {Element|null} el — conteneur du viewer (viewerContainerRef.current)
 */
export function scrollViewerIntoView(el) {
  if (!el || window.innerWidth >= 900) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  el.style.scrollMarginTop = '72px';
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}
