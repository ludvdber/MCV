import { describe, it, expect } from 'vitest';
import { intParam, floatParam } from './urlParams';

/** Un permalien est editable a la main : ces helpers sont la frontiere entre une
 *  query string quelconque et l'etat des pages. Le contrat est « null plutot
 *  que NaN », parce qu'un NaN se propage silencieusement jusqu'a la requete. */
const sp = (q) => new URLSearchParams(q);

describe('intParam', () => {
  it('lit un entier', () => {
    expect(intParam(sp('t=12'), 't')).toBe(12);
    expect(intParam(sp('t=-3'), 't')).toBe(-3);
  });

  it('renvoie null sur un parametre absent', () => {
    expect(intParam(sp(''), 't')).toBeNull();
  });

  it('renvoie null au lieu de NaN sur une valeur non numerique', () => {
    expect(intParam(sp('t=abc'), 't')).toBeNull();
    expect(intParam(sp('t='), 't')).toBeNull();
  });

  it('accepte zero (piege du falsy)', () => {
    // `if (!n) return null` aurait rejete 0, qui est un pas de temps VALIDE
    // (minuit) : la page serait revenue a sa valeur par defaut.
    expect(intParam(sp('t=0'), 't')).toBe(0);
  });

  it('tronque comme parseInt le fait, sans arrondir', () => {
    expect(intParam(sp('t=12.9'), 't')).toBe(12);
  });

  it('lit le prefixe numerique d une valeur salie', () => {
    // Comportement de parseInt, documente ici pour qu'un changement le signale.
    expect(intParam(sp('t=12px'), 't')).toBe(12);
  });
});

describe('floatParam', () => {
  it('lit un flottant, signe compris', () => {
    expect(floatParam(sp('lat=-38.5'), 'lat')).toBeCloseTo(-38.5, 10);
  });

  it('renvoie null sur un parametre absent ou non numerique', () => {
    expect(floatParam(sp(''), 'lat')).toBeNull();
    expect(floatParam(sp('lat=nord'), 'lat')).toBeNull();
  });

  it('accepte zero', () => {
    expect(floatParam(sp('lat=0'), 'lat')).toBe(0);
  });

  it('rejette Infinity, que parseFloat accepte pourtant', () => {
    // parseFloat('Infinity') vaut Infinity : sans le test de finitude, une
    // longitude infinie partirait telle quelle vers l'API.
    expect(floatParam(sp('lon=Infinity'), 'lon')).toBeNull();
    expect(floatParam(sp('lon=-Infinity'), 'lon')).toBeNull();
  });

  it('lit la notation scientifique', () => {
    expect(floatParam(sp('v=1e2'), 'v')).toBe(100);
  });
});
