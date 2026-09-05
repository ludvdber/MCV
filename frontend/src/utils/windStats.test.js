import { describe, it, expect } from 'vitest';
import {
  windSpeedStats, windBand, windRamp,
  WIND_BANDS, WIND_RAMP_DARK, WIND_RAMP_LIGHT, WIND_WIDTHS,
} from './windStats';

/**
 * Ce que ces statistiques corrigent : avant, seul le MAXIMUM etait calcule,
 * a la volee dans le rendu de SliceViewer, et il disparaissait entierement en
 * mode compact (donc dans toute la grille de la console Explorer). Le champ
 * porte pourtant des trous (mailles sans donnee) qu'il ne faut pas compter
 * comme des vents nuls, sans quoi la moyenne est tiree vers le bas.
 */

/** Champ minimal au format servi par /api/data/wind (points aplatis). */
function champ(paires) {
  return { u: paires.map(p => p[0]), v: paires.map(p => p[1]) };
}

describe('windSpeedStats', () => {
  it('calcule minimum, maximum et moyenne sur la norme des composantes', () => {
    // Normes : 5 (3-4-5), 10, 25
    const s = windSpeedStats(champ([[3, 4], [6, 8], [7, 24]]));
    expect(s.min).toBeCloseTo(5, 10);
    expect(s.max).toBeCloseTo(25, 10);
    expect(s.mean).toBeCloseTo((5 + 10 + 25) / 3, 10);
    expect(s.count).toBe(3);
  });

  it('ignore les mailles sans donnee au lieu de les compter comme du vent nul', () => {
    const avecTrous = windSpeedStats(champ([[3, 4], [NaN, 2], [1, NaN], [6, 8]]));
    const sansTrous = windSpeedStats(champ([[3, 4], [6, 8]]));
    expect(avecTrous.count).toBe(2);
    expect(avecTrous.mean).toBeCloseTo(sansTrous.mean, 10);
    // Le piege : compter les trous comme 0 donnerait 3,75 au lieu de 7,5.
    expect(avecTrous.mean).toBeCloseTo(7.5, 10);
  });

  it('traite le vent nul comme une vitesse valide, pas comme un trou', () => {
    const s = windSpeedStats(champ([[0, 0], [3, 4]]));
    expect(s.min).toBe(0);
    expect(s.count).toBe(2);
  });

  it('rend null sur un champ absent, vide, desaccorde ou entierement troue', () => {
    expect(windSpeedStats(null)).toBeNull();
    expect(windSpeedStats(undefined)).toBeNull();
    expect(windSpeedStats({})).toBeNull();
    expect(windSpeedStats(champ([]))).toBeNull();
    expect(windSpeedStats({ u: [1, 2, 3], v: [1, 2] })).toBeNull();
    expect(windSpeedStats(champ([[NaN, NaN], [NaN, 1]]))).toBeNull();
  });

  it('accepte les tableaux types que renvoie la couche de donnees', () => {
    const s = windSpeedStats({ u: Float32Array.from([3, 6]), v: Float32Array.from([4, 8]) });
    expect(s.min).toBeCloseTo(5, 5);
    expect(s.max).toBeCloseTo(10, 5);
  });
});

describe('windBand', () => {
  it('place les bornes de l echelle dans la premiere et la derniere bande', () => {
    expect(windBand(0, 0, 70)).toBe(0);
    expect(windBand(70, 0, 70)).toBe(WIND_BANDS - 1);
  });

  it('reste dans les bornes meme hors echelle', () => {
    expect(windBand(-10, 0, 70)).toBe(0);
    expect(windBand(1e6, 0, 70)).toBe(WIND_BANDS - 1);
    expect(windBand(NaN, 0, 70)).toBe(0);
  });

  it('progresse de facon monotone avec la vitesse', () => {
    let precedent = -1;
    for (let s = 0; s <= 70; s += 1) {
      const b = windBand(s, 0, 70);
      expect(b).toBeGreaterThanOrEqual(precedent);
      precedent = b;
    }
  });

  it('met un champ de vitesse constante dans la bande haute, pas la bande basse', () => {
    // L'unique vitesse presente EST le maximum : l'afficher en trait le plus
    // faible ferait croire a un vent negligeable.
    expect(windBand(42, 42, 42)).toBe(WIND_BANDS - 1);
  });
});

describe('rampe', () => {
  it('fournit autant de couleurs et d epaisseurs que de bandes', () => {
    expect(WIND_RAMP_DARK).toHaveLength(WIND_BANDS);
    expect(WIND_RAMP_LIGHT).toHaveLength(WIND_BANDS);
    expect(WIND_WIDTHS).toHaveLength(WIND_BANDS);
  });

  it('epaissit le trait avec la vitesse', () => {
    for (let i = 1; i < WIND_WIDTHS.length; i++) {
      expect(WIND_WIDTHS[i]).toBeGreaterThan(WIND_WIDTHS[i - 1]);
    }
  });

  it('choisit la rampe selon le theme', () => {
    expect(windRamp('light')).toBe(WIND_RAMP_LIGHT);
    expect(windRamp('dark')).toBe(WIND_RAMP_DARK);
  });

  it('rend les particules rapides plus opaques dans les deux themes', () => {
    const alpha = c => Number(c.match(/([\d.]+)\)$/)[1]);
    for (const rampe of [WIND_RAMP_DARK, WIND_RAMP_LIGHT]) {
      for (let i = 1; i < rampe.length; i++) {
        expect(alpha(rampe[i])).toBeGreaterThan(alpha(rampe[i - 1]));
      }
    }
  });
});
