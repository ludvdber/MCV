import { describe, it, expect, vi, afterEach } from 'vitest';
import * as bus from './probeBus';
import { publishRange, subscribeRange } from './syncZoomBus';

/**
 * Deux mini pub/sub hors React : leur raison d'etre est de ne PAS re-rendre la
 * console a chaque mouvement de souris. Les tests portent donc sur le contrat
 * d'abonnement (livraison, desabonnement, isolement) et sur la republication
 * declenchee par un changement de frame.
 */

afterEach(() => {
  bus.publishProbe(null);
  for (const id of ['a', 'b']) bus.clearAnimationFrame(id);
});

describe('bus de la sonde', () => {
  it('livre la position a tous les abonnes', () => {
    const un = vi.fn(); const deux = vi.fn();
    const off1 = bus.subscribeProbe(un);
    const off2 = bus.subscribeProbe(deux);
    const point = { lat: -40, lon: 30, sourceId: 'v1' };
    bus.publishProbe(point);
    expect(un).toHaveBeenCalledWith(point);
    expect(deux).toHaveBeenCalledWith(point);
    off1(); off2();
  });

  it('le desabonnement coupe reellement la livraison', () => {
    const fn = vi.fn();
    bus.subscribeProbe(fn)();
    bus.publishProbe({ lat: 0, sourceId: 'v1' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('memorise la derniere position pour qu un nouvel abonne se cale dessus', () => {
    const point = { lat: 12, sourceId: 'v1' };
    bus.publishProbe(point);
    expect(bus.currentProbe).toBe(point);
    bus.publishProbe(null);
    expect(bus.currentProbe).toBeNull();
  });

  it('publie aussi la sortie de survol (null)', () => {
    const fn = vi.fn();
    const off = bus.subscribeProbe(fn);
    bus.publishProbe(null);
    expect(fn).toHaveBeenCalledWith(null);
    off();
  });

  it('un abonne inscrit deux fois n est livre qu une fois (Set)', () => {
    const fn = vi.fn();
    bus.subscribeProbe(fn);
    bus.subscribeProbe(fn);
    bus.publishProbe({ lat: 1, sourceId: 'v' });
    expect(fn).toHaveBeenCalledTimes(1);
    bus.subscribeProbe(fn)();
  });
});

describe('frame courante des animations', () => {
  it('vaut 0 tant que le lecteur n a rien publie', () => {
    expect(bus.getAnimationFrame('jamais-vu')).toBe(0);
  });

  it('garde un index par vue : deux animations ne se marchent pas dessus', () => {
    bus.setAnimationFrame('a', 5);
    bus.setAnimationFrame('b', 30);
    expect(bus.getAnimationFrame('a')).toBe(5);
    expect(bus.getAnimationFrame('b')).toBe(30);
  });

  it('republie la position pour que reticules et panneau suivent la lecture', () => {
    // Sans cette republication, le reticule reste sur la valeur de la frame
    // precedente pendant toute la lecture.
    const fn = vi.fn();
    bus.publishProbe({ lat: 0, sourceId: 'v' });
    const off = bus.subscribeProbe(fn);
    bus.setAnimationFrame('a', 7);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
  });

  it('ne republie pas quand la frame ne change pas', () => {
    // Le lecteur publie a chaque tick : sans ce garde, chaque tick redessinerait
    // tous les canvas abonnes pour rien.
    bus.setAnimationFrame('a', 7);
    bus.publishProbe({ lat: 0, sourceId: 'v' });
    const fn = vi.fn();
    const off = bus.subscribeProbe(fn);
    bus.setAnimationFrame('a', 7);
    expect(fn).not.toHaveBeenCalled();
    off();
  });

  it('ne republie pas non plus sans sonde active', () => {
    bus.publishProbe(null);
    const fn = vi.fn();
    const off = bus.subscribeProbe(fn);
    bus.setAnimationFrame('a', 9);
    expect(fn).not.toHaveBeenCalled();
    off();
  });

  it('oublie une vue fermee', () => {
    bus.setAnimationFrame('a', 12);
    bus.clearAnimationFrame('a');
    expect(bus.getAnimationFrame('a')).toBe(0);
  });
});

describe('bus du zoom synchronise', () => {
  it('diffuse la fenetre a tous les abonnes', () => {
    const fn = vi.fn();
    const off = subscribeRange(fn);
    const fenetre = { xr: [-90, 90], yr: [-40, 40], autorange: false, sourceId: 'v1' };
    publishRange(fenetre);
    expect(fn).toHaveBeenCalledWith(fenetre);
    off();
  });

  it('le desabonnement coupe la diffusion', () => {
    const fn = vi.fn();
    subscribeRange(fn)();
    publishRange({ xr: null, yr: null, autorange: true, sourceId: 'v1' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('est independant du bus de la sonde', () => {
    // Deux Set distincts : un abonne au zoom ne doit pas recevoir les survols.
    const zoom = vi.fn(); const sonde = vi.fn();
    const offZ = subscribeRange(zoom);
    const offS = bus.subscribeProbe(sonde);
    publishRange({ xr: [0, 1], yr: null, autorange: false, sourceId: 'v' });
    expect(sonde).not.toHaveBeenCalled();
    bus.publishProbe({ lat: 0, sourceId: 'v' });
    expect(zoom).toHaveBeenCalledTimes(1);
    offZ(); offS();
  });
});
