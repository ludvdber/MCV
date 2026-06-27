import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecentHistory } from './useRecentHistory';

/**
 * Tests du hook d'historique — couvre le correctif de déduplication :
 * deux visualisations qui ne diffèrent que par les paramètres (time, altitude…)
 * doivent rester des entrées DISTINCTES, alors que des permaliens identiques
 * sont dédupliqués (remontés en tête).
 */
describe('useRecentHistory', () => {
  beforeEach(() => localStorage.clear());

  const entry = (permalink, label, over = {}) => ({
    page: '/slice', dataset: 'A', variable: 'TT', permalink, label, ...over,
  });

  it('garde des entrées distinctes pour des paramètres différents (même page/dataset/variable)', () => {
    const { result } = renderHook(() => useRecentHistory());
    act(() => result.current.addEntry(entry('/slice?ds=A&var=TT&t=0&alt=0', 'a')));
    act(() => result.current.addEntry(entry('/slice?ds=A&var=TT&t=5&alt=10', 'b')));
    expect(result.current.history).toHaveLength(2);
  });

  it('ne réordonne pas un permalien déjà présent (revisite stable, pas de bump)', () => {
    const { result } = renderHook(() => useRecentHistory());
    act(() => result.current.addEntry(entry('/slice?ds=A&var=TT&t=0&alt=0', 'first')));
    act(() => result.current.addEntry(entry('/slice?ds=A&var=TT&t=5&alt=10', 'second')));
    // On "revient" sur la première (même permalien) : elle ne doit pas remonter.
    act(() => result.current.addEntry(entry('/slice?ds=A&var=TT&t=0&alt=0', 'first-again')));
    expect(result.current.history).toHaveLength(2);
    expect(result.current.history.map(e => e.label)).toEqual(['second', 'first']);
  });

  it('plafonne le nombre d\'entrées à 20', () => {
    const { result } = renderHook(() => useRecentHistory());
    act(() => {
      for (let i = 0; i < 25; i++) {
        result.current.addEntry(entry(`/slice?t=${i}`, `e${i}`));
      }
    });
    expect(result.current.history.length).toBeLessThanOrEqual(20);
    // la plus récente est en tête
    expect(result.current.history[0].label).toBe('e24');
  });

  it('clearHistory vide tout', () => {
    const { result } = renderHook(() => useRecentHistory());
    act(() => result.current.addEntry(entry('/slice?x=1', 'a')));
    act(() => result.current.clearHistory());
    expect(result.current.history).toHaveLength(0);
  });

  it('la plus récente est toujours en tête', () => {
    const { result } = renderHook(() => useRecentHistory());
    act(() => result.current.addEntry(entry('/slice?a', 'a')));
    act(() => result.current.addEntry(entry('/slice?b', 'b')));
    act(() => result.current.addEntry(entry('/slice?c', 'c')));
    expect(result.current.history.map(e => e.label)).toEqual(['c', 'b', 'a']);
  });

  it('deux roses des vents qui ne diffèrent que par l\'altitude restent distinctes', () => {
    const { result } = renderHook(() => useRecentHistory());
    const wr = (alt) => ({
      page: '/windrose', dataset: 'A', variable: 'UU/VV',
      permalink: `/windrose?ds=A&alt=${alt}&lat=12&lon=34`, label: 'Wind Rose (12°, 34°)',
    });
    act(() => result.current.addEntry(wr(49)));
    act(() => result.current.addEntry(wr(80)));
    expect(result.current.history).toHaveLength(2);
    // Les permaliens portent bien chacun leur altitude.
    expect(result.current.history.map(e => e.permalink)).toEqual([
      '/windrose?ds=A&alt=80&lat=12&lon=34',
      '/windrose?ds=A&alt=49&lat=12&lon=34',
    ]);
  });

  it('déduplique entre pages différentes uniquement si le permalien est identique', () => {
    const { result } = renderHook(() => useRecentHistory());
    act(() => result.current.addEntry({ page: '/slice', dataset: 'A', variable: 'TT', permalink: '/slice?ds=A', label: 's' }));
    act(() => result.current.addEntry({ page: '/profile', dataset: 'A', variable: 'TT', permalink: '/profile?ds=A', label: 'p' }));
    expect(result.current.history).toHaveLength(2);
  });

  it('ignore le localStorage corrompu sans planter', () => {
    localStorage.setItem('mcv-recent-history', '{ not valid json');
    const { result } = renderHook(() => useRecentHistory());
    expect(result.current.history).toEqual([]);
  });

  it('filtre les entrées invalides (champs requis manquants)', () => {
    localStorage.setItem('mcv-recent-history', JSON.stringify([
      { id: '1', page: '/slice', timestamp: 1 },          // valide
      { page: '/slice' },                                  // pas d'id ni timestamp
      null,                                                // null
      { id: 2, page: '/slice', timestamp: 1 },             // id non-string
    ]));
    const { result } = renderHook(() => useRecentHistory());
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].id).toBe('1');
  });

  it('ne plante pas si l\'écriture localStorage échoue (quota / navigation privée)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { result } = renderHook(() => useRecentHistory());
    expect(() => act(() => result.current.addEntry(entry('/slice?x=1', 'a')))).not.toThrow();
    spy.mockRestore();
  });

  it('removeEntry supprime une seule entrée', () => {
    const { result } = renderHook(() => useRecentHistory());
    act(() => result.current.addEntry(entry('/slice?a', 'a')));
    act(() => result.current.addEntry(entry('/slice?b', 'b')));
    const idB = result.current.history.find(e => e.label === 'b').id;
    act(() => result.current.removeEntry(idB));
    expect(result.current.history.map(e => e.label)).toEqual(['a']);
  });

  it('togglePin épingle puis désépingle une entrée', () => {
    const { result } = renderHook(() => useRecentHistory());
    act(() => result.current.addEntry(entry('/slice?a', 'a')));
    const id = result.current.history[0].id;
    act(() => result.current.togglePin(id));
    expect(result.current.history[0].pinned).toBe(true);
    act(() => result.current.togglePin(id));
    expect(result.current.history[0].pinned).toBe(false);
  });

  it('une entrée épinglée n\'est jamais évincée par le plafond', () => {
    const { result } = renderHook(() => useRecentHistory());
    act(() => result.current.addEntry(entry('/slice?keep', 'keep')));
    const id = result.current.history[0].id;
    act(() => result.current.togglePin(id));
    // On dépasse largement le plafond avec des entrées non épinglées.
    act(() => {
      for (let i = 0; i < 25; i++) result.current.addEntry(entry(`/slice?n=${i}`, `e${i}`));
    });
    expect(result.current.history.some(e => e.label === 'keep')).toBe(true);
  });
});
