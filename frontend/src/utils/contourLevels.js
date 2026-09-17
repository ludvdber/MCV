/**
 * Niveaux de contour EXPLICITES pour les traces `contour` de Plotly.
 *
 * Pourquoi ne pas laisser Plotly les calculer tout seul, comme avant ?
 *
 * Parce qu'une trace `contour` dont les niveaux sont automatiques perd ces
 * niveaux des que Plotly redessine SANS recalculer. C'est le cas de
 * `Plotly.react` quand seule une propriete de mise en page change : le titre,
 * par exemple. Le scenario minimal, mesure hors de l'application :
 *
 *   Plotly.newPlot(div, [contourAuto], { title: 'A' })   -> ok
 *   Plotly.react (div, [contourAuto], { title: 'B' })    -> TypeError
 *       « Cannot read properties of undefined (reading 'z') » dans makeCrossings
 *
 * Le mecanisme : `emptyPathinfo` construit un niveau par valeur de
 * `contours.start` a `contours.end` par pas de `contours.size`. Ces trois
 * champs ne sont remplis que pendant le CALCUL de la trace ; un redessin qui
 * saute le calcul les retrouve indefinis, la boucle ne tourne aucune fois, et
 * `makeCrossings` lit `pathinfo[0].z` sur un tableau vide.
 *
 * Dans l'application cela se voyait sur la moyenne zonale : on affiche une
 * vue, on change de jeu de donnees ou de variable dans le selecteur (ce qui
 * change le TITRE sans changer les donnees), et la page entiere tombait dans
 * l'ErrorBoundary. « Reessayer » semblait reparer parce que le composant etait
 * remonte a neuf, donc repasse par `newPlot`.
 *
 * Fournir les trois champs supprime la dependance a ce chemin interne. Le
 * calcul ci-dessous reproduit celui de Plotly (autoContours + autoTicks en
 * lineaire) pour que les figures ne changent pas : l'accord a ete mesure
 * contre Plotly lui-meme sur 27 etendues, dont les quatre servies par
 * /api/data/zonalmean, et il est fige dans contourLevels.test.js.
 */

/** Mantisses admises, comme `roundBase10` de Plotly. */
const PALIERS = [2, 5, 10];

/**
 * Reproduit `Lib.roundUp(val, [2, 5, 10])` : le premier palier STRICTEMENT
 * superieur a la valeur (5 donne 10, pas 5).
 */
function palierSuperieur(valeur) {
  for (const p of PALIERS) if (valeur < p) return p;
  return PALIERS[PALIERS.length - 1];
}

/** Bornes finies d'une grille 2D, en ignorant les mailles masquees. */
export function etendueGrille(grille) {
  let min = Infinity;
  let max = -Infinity;
  if (!Array.isArray(grille)) return null;
  for (const ligne of grille) {
    if (!Array.isArray(ligne)) continue;
    for (const v of ligne) {
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return Number.isFinite(min) ? { min, max } : null;
}

/**
 * Niveaux de contour pour une grille de valeurs.
 *
 * Rend TOUJOURS une bande non vide : c'est le contrat, et c'est tout l'objet
 * du module. Rendre null « quand il n'y a rien a contourer » rouvrirait
 * exactement la porte que ce fichier ferme, puisque l'appelant se rabattrait
 * alors sur le calcul automatique.
 *
 * @param {Array<Array<number|null>>} grille  valeurs affichees (apres passage
 *        au log le cas echeant : ce sont les valeurs QUE PLOTLY VOIT)
 * @param {number} [ncontours=15] nombre vise, comme l'attribut Plotly
 * @returns {{start:number,end:number,size:number}}
 */
export function niveauxContour(grille, ncontours = 15) {
  const etendue = etendueGrille(grille);
  return niveauxPourBornes(etendue?.min, etendue?.max, ncontours);
}

/**
 * Meme calcul a partir de bornes deja connues : les bornes IMPOSEES a la trace
 * quand il y en a (zmin/zmax), sinon celles de la grille. Il faut les memes
 * que celles vues par Plotly, sans quoi les niveaux ne couvriraient pas la
 * plage coloree.
 *
 * @returns {{start:number,end:number,size:number}} toujours une bande non vide
 */
export function niveauxPourBornes(min, max, ncontours = 15) {
  // Aucune maille exploitable (grille entierement masquee, reponse vide) :
  // il n'y a rien a tracer, mais il faut quand meme une bande valide.
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { start: -1, end: 1, size: 1 };

  // Champ uniforme : aucune ligne de niveau n'a de sens, mais il faut quand
  // meme une bande NON VIDE, sinon on reproduit exactement la panne que ce
  // module existe pour empecher. On encadre la valeur unique.
  if (max <= min) return bandeUnique(min);

  // ---- Ce qui suit reproduit set_contours.js de Plotly, pas a pas ----------
  // Le calcul a ete releve dans la source (traces/contour/set_contours.js et
  // plots/cartesian/axes.js) apres qu'une premiere version ecrite « au bon
  // sens » se soit ecartee de Plotly sur 11 etendues sur 18 : la regle a des
  // details qu'on ne devine pas, en particulier l'egalite EXACTE ci-dessous et
  // un epsilon de 1e-4, qui est large.

  // Pas : mantisse arrondie au palier superieur de [2, 5, 10] (roundDTick).
  const grossier = (max - min) / (ncontours || 15);
  const base = Math.pow(10, Math.floor(Math.log10(grossier)));
  const size = base * palierSuperieur(grossier / base);

  // Etendue si etroite que le pas s'annule par sous-depassement : mesure sur
  // [0, Number.MIN_VALUE], ou Math.pow(10, -325) rend deja zero. Plus aucun
  // niveau n'est representable, donc on retombe sur la bande unique plutot
  // que de publier un NaN — que Plotly transformerait en bande vide, c'est a
  // dire en la panne meme.
  if (!Number.isFinite(size) || size <= 0) return bandeUnique(min);

  // Premier et dernier multiple du pas dans l'etendue, celle-ci etant d'abord
  // elargie de 1e-4 de sa largeur (expandRange) : sans cette marge, un minimum
  // infime mais non nul (3,6e-11 pour H2O) sauterait le niveau zero.
  const marge = (max - min) * 1e-4;
  let start = Math.ceil((min - marge) / size) * size;
  let end = Math.floor((max + marge) / size) * size;

  // Un niveau pose exactement sur un extremum longe le bord de la carte sans
  // rien separer : Plotly le decale d'un cran. L'egalite est EXACTE, ce qui
  // explique pourquoi elle mord sur un minimum de 0 pile et pas sur 3,6e-11.
  if (start === min) start += size;
  if (end === max) end -= size;

  // Etendue plus etroite que deux pas : on garde un niveau unique au milieu
  // plutot qu'une bande vide, qui est precisement la panne evitee ici.
  if (start > end) {
    const milieu = (start + end) / 2;
    return { start: milieu, end: milieu, size };
  }

  // Le produit reintroduit des miettes binaires (0.0045000000000000005) : on
  // les enleve, sinon elles remontent jusqu'aux etiquettes des niveaux. C'est
  // fait APRES les egalites ci-dessus, qui portent sur les valeurs brutes.
  return { start: arrondir(start, size), end: arrondir(end, size), size };
}

/** Bande minimale encadrant une valeur unique, jamais vide. */
function bandeUnique(valeur) {
  const pas = Math.abs(valeur) > 0 && Number.isFinite(valeur) ? Math.abs(valeur) / 10 : 1;
  if (!Number.isFinite(pas) || pas <= 0) return { start: -1, end: 1, size: 1 };
  return { start: arrondir(valeur - pas, pas), end: arrondir(valeur + pas, pas), size: pas };
}

/** Arrondit au chiffre significatif du pas (12 decimales sous le pas). */
function arrondir(valeur, pas) {
  const decimales = Math.min(15, Math.max(0, -Math.floor(Math.log10(Math.abs(pas))) + 6));
  return Number(valeur.toFixed(decimales));
}
