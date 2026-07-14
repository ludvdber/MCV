/**
 * Mode compact des viewers (cellules de la grille Explorer).
 *
 * Transforme un layout Plotly complet en version cellule : pas de titre
 * (il est porte par l'en-tete de la cellule), pas de titres d'axes, marges
 * serrees, ticks discrets. La colorbar est masquee au niveau de la trace
 * (showscale: false) : la MiniColorbar CSS de la cellule la remplace.
 */
export function compactLayout(layout) {
  const shrinkAxis = (axis) => ({
    ...axis,
    title: undefined,
    tickfont: { ...(axis?.tickfont || {}), size: 10 },
  });
  return {
    ...layout,
    title: undefined,
    margin: { l: 42, r: 8, t: 8, b: 26 },
    xaxis: shrinkAxis(layout.xaxis),
    yaxis: shrinkAxis(layout.yaxis),
  };
}
