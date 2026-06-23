import { describe, it, expect, beforeEach } from 'vitest';
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

  it('déduplique les permaliens identiques et remonte la dernière en tête', () => {
    const { result } = renderHook(() => useRecentHistory());
    act(() => result.current.addEntry(entry('/slice?ds=A&var=TT&t=0&alt=0', 'first')));
    act(() => result.current.addEntry(entry('/slice?ds=A&var=TT&t=0&alt=0', 'second')));
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].label).toBe('second');
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
});
