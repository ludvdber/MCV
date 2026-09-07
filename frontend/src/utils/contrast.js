/**
 * Contraste WCAG : mesure, composition alpha, et derivation d'une encre lisible.
 *
 * Le meme defaut s'est produit cinq fois dans ce projet : une couleur validee
 * sur UN fond (souvent le blanc) puis posee sur un autre — un degrade, une
 * teinte a 12 % de la couleur elle-meme, une puce pleine. Les jetons corriges a
 * la main tiennent tant que personne n'ajoute une couleur ; `readableOn` calcule
 * l'encre a la place, si bien qu'une couleur ajoutee demain reste conforme.
 *
 * Reference : WCAG 2.1, formule de luminance relative et rapport
 * (L1 + 0,05) / (L2 + 0,05). Seuil AA du texte courant : 4,5.
 */

/** '#rgb', '#rrggbb', 'rgb(...)' ou 'rgba(...)' → [r, g, b] (0-255). */
export function parseColor(c) {
  if (Array.isArray(c)) return c;
  const s = String(c).trim();
  if (s.startsWith('#')) {
    const h = s.slice(1);
    const plein = h.length === 3 ? h.split('').map(x => x + x).join('') : h;
    return [0, 2, 4].map(i => parseInt(plein.slice(i, i + 2), 16));
  }
  const n = (s.match(/-?\d+(\.\d+)?/g) || []).map(Number);
  return n.length >= 3 ? n.slice(0, 3) : [0, 0, 0];
}

const canal = v => {
  const x = v / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};

/** Luminance relative WCAG, entre 0 (noir) et 1 (blanc). */
export function relativeLuminance(color) {
  const [r, g, b] = parseColor(color);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Rapport de contraste entre deux couleurs OPAQUES, de 1 a 21. */
export function contrastRatio(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Couleur resultante de `color` posee a l'opacite `alpha` sur `background`. */
export function compositeOver(color, alpha, background) {
  const f = parseColor(color), b = parseColor(background);
  return f.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)));
}

const hex2 = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
export const toHex = color => '#' + parseColor(color).map(hex2).join('');

/**
 * Variante de `color` qui atteint `target` sur `background`, en conservant la
 * teinte : on assombrit (ou on eclaircit, selon le fond) par melange progressif
 * vers le noir ou le blanc.
 *
 * On melange plutot qu'on ne remplace pour que l'identite visuelle survive :
 * l'orange reste orange, simplement plus profond. Si meme le noir ou le blanc
 * n'atteint pas la cible — un fond de luminance intermediaire, cas classique de
 * l'ambre — on renvoie l'extremite la plus contrastee des deux.
 */
export function readableOn(color, background, target = 4.5) {
  if (contrastRatio(color, background) >= target) return toHex(color);
  const base = parseColor(color);
  const versNoir = relativeLuminance(background) > 0.4;
  const bout = versNoir ? [0, 0, 0] : [255, 255, 255];
  let repli = toHex(bout);
  for (let k = 0.05; k <= 1.0001; k += 0.05) {
    const essai = base.map((v, i) => v + (bout[i] - v) * k);
    if (contrastRatio(essai, background) >= target) return toHex(essai);
  }
  // Cible inatteignable dans cette direction : on garde le plus contraste des
  // deux extremes plutot que de rendre une couleur pire que celle d'origine.
  const autre = versNoir ? [255, 255, 255] : [0, 0, 0];
  if (contrastRatio(autre, background) > contrastRatio(bout, background)) repli = toHex(autre);
  return repli;
}

/**
 * Encre a poser SUR un fond colore : blanc ou encre sombre, la plus lisible.
 *
 * #0b1020 et pas un gris anthracite ordinaire : sur le violet des series
 * (#a855f7), #111827 tombe a 4,48 — sous le seuil de trois centiemes. Les
 * quatre couleurs de serie atteignent AA avec cette valeur (4,78 au pire).
 */
export const INK_DARK = '#0b1020';
export function inkOn(background) {
  return contrastRatio('#ffffff', background) >= contrastRatio(INK_DARK, background)
    ? '#ffffff' : INK_DARK;
}
