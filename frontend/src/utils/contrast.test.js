import { describe, it, expect } from 'vitest';
import {
  parseColor, relativeLuminance, contrastRatio, compositeOver, readableOn, inkOn, toHex, INK_DARK,
} from './contrast';

/**
 * Les valeurs de reference viennent de la mesure sur pixels rendus qui a
 * revele les echecs : blanc sur l'orange de marque 3,71 ; l'orange sur sa
 * propre teinte a 12 % 3,20 ; blanc sur le cyan clair 2,14.
 */

describe('mesure du contraste', () => {
  it('les extremes', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('accepte #abc, #aabbcc et rgb()', () => {
    expect(parseColor('#abc')).toEqual([170, 187, 204]);
    expect(parseColor('#aabbcc')).toEqual([170, 187, 204]);
    expect(parseColor('rgba(170, 187, 204, 0.5)')).toEqual([170, 187, 204]);
  });

  it('retrouve les rapports mesures a l ecran', () => {
    expect(contrastRatio('#ffffff', '#e05a2b')).toBeCloseTo(3.71, 1);
    expect(contrastRatio('#ffffff', '#38bdf8')).toBeCloseTo(2.14, 1);
  });

  it('compose une couleur translucide sur son fond', () => {
    expect(toHex(compositeOver('#e05a2b', 0.12, '#ffffff'))).toBe('#fbebe6');
    expect(contrastRatio('#e05a2b', compositeOver('#e05a2b', 0.12, '#ffffff'))).toBeCloseTo(3.20, 1);
  });

  it('le noir est plus lumineux que rien, le blanc que tout', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });
});

describe('derivation d une encre lisible', () => {
  it('rend la couleur telle quelle si elle passe deja', () => {
    expect(readableOn('#111827', '#ffffff')).toBe('#111827');
  });

  it('assombrit une couleur claire sur fond clair jusqu au seuil', () => {
    for (const c of ['#e05a2b', '#38bdf8', '#a855f7', '#ff7043', '#4ade80']) {
      const fond = compositeOver(c, 0.12, '#ffffff');
      const encre = readableOn(c, fond);
      expect(contrastRatio(encre, fond)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('eclaircit sur fond sombre', () => {
    const encre = readableOn('#0369a1', '#0a1230');
    expect(contrastRatio(encre, '#0a1230')).toBeGreaterThanOrEqual(4.5);
  });

  it('conserve la teinte : l orange reste plus rouge que vert et que bleu', () => {
    const [r, g, b] = parseColor(readableOn('#e05a2b', '#fbebe6'));
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });

  it('encre sombre sur les fonds clairs, blanche sur les fonds sombres', () => {
    expect(inkOn('#38bdf8')).toBe(INK_DARK);
    expect(inkOn('#4ade80')).toBe(INK_DARK);
    expect(inkOn('#0369a1')).toBe('#ffffff');
    // Les quatre couleurs de serie doivent toutes atteindre AA avec l'encre choisie.
    for (const c of ['#38bdf8', '#e05a2b', '#a855f7', '#4ade80']) {
      expect(contrastRatio(inkOn(c), c)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
