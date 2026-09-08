import { describe, it, expect } from 'vitest';
import {
  COLORSCALE_OPTIONS, swatchGradient, autoColorscaleFor,
  SEQUENTIAL_VARIABLES, DIVERGING_VARIABLES, VIK,
} from './colorscales';

describe('COLORSCALE_OPTIONS', () => {
  it('n a aucun doublon de valeur', () => {
    const vals = COLORSCALE_OPTIONS.map((o) => o.value);
    expect(new Set(vals).size).toBe(vals.length);
  });

  it('commence par « auto », la valeur par defaut de l application', () => {
    expect(COLORSCALE_OPTIONS[0].value).toBe('auto');
  });

  it('donne a chaque option non-auto un libelle et un sens d affichage', () => {
    for (const opt of COLORSCALE_OPTIONS.slice(1)) {
      expect(opt.label, opt.value).toBeTruthy();
      expect(typeof opt.reverse, opt.value).toBe('boolean');
    }
  });

  it('fournit des stops explicites pour les palettes non natives de Plotly', () => {
    // Plasma, Inferno et les Crameri ne sont PAS des noms de colorscale Plotly :
    // sans stops, Plotly retomberait silencieusement sur sa palette par defaut.
    for (const v of ['Batlow', 'Plasma', 'Inferno', 'Vik', 'Roma']) {
      const opt = COLORSCALE_OPTIONS.find((o) => o.value === v);
      expect(Array.isArray(opt.scale), v).toBe(true);
    }
  });

  it('marque comme cvd les palettes perceptuellement uniformes', () => {
    const cvd = COLORSCALE_OPTIONS.filter((o) => o.cvd).map((o) => o.value);
    expect(cvd).toContain('Viridis');
    expect(cvd).toContain('Batlow');
    // Hot et YlOrRd ne le sont pas et ne doivent pas se faire passer pour telles.
    expect(cvd).not.toContain('Hot');
    expect(cvd).not.toContain('YlOrRd');
  });

  it('les stops explicites vont de 0 a 1 en croissant', () => {
    for (const opt of COLORSCALE_OPTIONS.filter((o) => o.scale)) {
      const pos = opt.scale.map(([p]) => p);
      expect(pos[0], opt.value).toBe(0);
      expect(pos[pos.length - 1], opt.value).toBe(1);
      expect([...pos].sort((a, b) => a - b), opt.value).toEqual(pos);
    }
  });

  it('RdBu n est PAS inversee (froid en bas, chaud en haut)', () => {
    // L'inversion precedente affichait froid = rouge et chaud = bleu.
    expect(COLORSCALE_OPTIONS.find((o) => o.value === 'RdBu').reverse).toBe(false);
  });
});

describe('swatchGradient', () => {
  it('renvoie null pour « auto » (pas de palette a montrer)', () => {
    expect(swatchGradient({ value: 'auto', label: 'Auto' })).toBeNull();
  });

  it('renvoie null pour une option sans stops connus', () => {
    expect(swatchGradient({ value: 'Inconnue', reverse: false })).toBeNull();
  });

  it('construit un degrade CSS a partir de stops explicites', () => {
    const g = swatchGradient({ value: 'X', reverse: false, scale: [[0, 'rgb(0,0,0)'], [1, 'rgb(255,255,255)']] });
    expect(g).toBe('linear-gradient(90deg, rgb(0,0,0) 0%, rgb(255,255,255) 100%)');
  });

  it('utilise les stops nommes des palettes natives Plotly', () => {
    const g = swatchGradient({ value: 'Viridis', reverse: false });
    expect(g).toMatch(/^linear-gradient\(90deg, rgb\(68,1,84\) 0%/);
  });

  it('applique reellement l inversion — la pastille montre ce qui sera affiche', () => {
    const scale = [[0, 'A'], [0.25, 'B'], [1, 'C']];
    expect(swatchGradient({ value: 'X', reverse: true, scale }))
      .toBe('linear-gradient(90deg, C 0%, B 75%, A 100%)');
  });

  it('produit un degrade pour toutes les options sauf auto', () => {
    for (const opt of COLORSCALE_OPTIONS) {
      const g = swatchGradient(opt);
      if (opt.value === 'auto') expect(g).toBeNull();
      else expect(g, opt.value).toMatch(/^linear-gradient\(90deg, /);
    }
  });
});

describe('autoColorscaleFor', () => {
  it('donne une SEQUENTIELLE aux temperatures absolues', () => {
    // Une divergente sans point neutre fixe ferait glisser la couleur neutre
    // d'un jeu de donnees a l'autre : la meme couleur ne dirait plus la meme
    // temperature d'une figure a la suivante.
    for (const code of SEQUENTIAL_VARIABLES) {
      expect(Array.isArray(autoColorscaleFor(code)), code).toBe(true);
    }
    expect(autoColorscaleFor('TT')).toBe(autoColorscaleFor('MTSF'));
  });

  it('donne Viridis a tout le reste, y compris a une variable inconnue', () => {
    expect(autoColorscaleFor('H2O')).toBe('Viridis');
    expect(autoColorscaleFor('UU')).toBe('Viridis');
    expect(autoColorscaleFor(null)).toBe('Viridis');
    expect(autoColorscaleFor('CODE_INEXISTANT')).toBe('Viridis');
  });

  it('la sequentielle rendue est bien Batlow, pas une autre liste de stops', () => {
    const s = autoColorscaleFor('TT');
    expect(s[0]).toEqual([0, 'rgb(1,25,89)']);
    expect(s[s.length - 1]).toEqual([1, 'rgb(250,204,250)']);
  });
});

describe('listes de variables', () => {
  it('separe strictement magnitudes absolues et champs signes', () => {
    // Une variable ne peut pas etre a la fois sequentielle et divergente :
    // les deux listes decident de deux traitements incompatibles.
    const inter = SEQUENTIAL_VARIABLES.filter((v) => DIVERGING_VARIABLES.includes(v));
    expect(inter).toEqual([]);
  });

  it('les champs signes sont ceux dont le zero separe deux regimes', () => {
    expect(DIVERGING_VARIABLES).toEqual(['UU', 'VV', 'WW']);
  });

  it('VIK est exportee (TidesViewer la replie en palette cyclique)', () => {
    expect(VIK[0][0]).toBe(0);
    expect(VIK[VIK.length - 1][0]).toBe(1);
  });
});
