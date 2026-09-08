import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCopyToClipboard } from './useCopyToClipboard';

/** Le presse-papier n'existe pas en jsdom : on le pose ici, et surtout on
 *  verifie le cas ou il REFUSE (page non securisee, permission niee), qui est
 *  le comportement reel d'un navigateur sur du HTTP simple. */
let ecrire;

beforeEach(() => {
  ecrire = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: (t) => ecrire(t) }, configurable: true, writable: true,
  });
});

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('useCopyToClipboard', () => {
  it('demarre a « pas copie »', () => {
    const { result } = renderHook(() => useCopyToClipboard());
    expect(result.current[0]).toBe(false);
  });

  it('ecrit l URL demandee et bascule le retour visuel', async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    act(() => { result.current[1]('https://exemple/permalien'); });
    expect(ecrire).toHaveBeenCalledWith('https://exemple/permalien');
    await waitFor(() => expect(result.current[0]).toBe(true));
  });

  it('retombe a false au bout de 2 secondes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => { result.current[1]('u'); await Promise.resolve(); });
    expect(result.current[0]).toBe(true);
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(result.current[0]).toBe(false);
  });

  it('deux copies rapprochees ne coupent pas le retour visuel trop tot', async () => {
    // Sans le clearTimeout, le minuteur de la PREMIERE copie eteignait le
    // retour visuel de la seconde apres quelques centiemes de seconde.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => { result.current[1]('a'); await Promise.resolve(); });
    await act(async () => { vi.advanceTimersByTime(1900); });
    await act(async () => { result.current[1]('b'); await Promise.resolve(); });
    await act(async () => { vi.advanceTimersByTime(200); });
    expect(result.current[0]).toBe(true);
    await act(async () => { vi.advanceTimersByTime(1900); });
    expect(result.current[0]).toBe(false);
  });

  it('avale un refus du navigateur sans casser la page', async () => {
    // navigator.clipboard rejette hors contexte securise : sans le `.catch`,
    // l appui sur « copier le permalien » produisait un unhandled rejection.
    ecrire = vi.fn(() => Promise.reject(new Error('NotAllowedError')));
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => { result.current[1]('u'); await Promise.resolve(); });
    expect(result.current[0]).toBe(false);
  });

  it('nettoie son minuteur au demontage', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = renderHook(() => useCopyToClipboard());
    await act(async () => { result.current[1]('u'); await Promise.resolve(); });
    unmount();
    // Sans ce nettoyage, le setState differe s executerait sur un composant
    // demonte apres une navigation.
    expect(clear).toHaveBeenCalled();
  });

  it('garde la meme fonction de copie entre deux rendus (useCallback)', () => {
    const { result, rerender } = renderHook(() => useCopyToClipboard());
    const premiere = result.current[1];
    rerender();
    expect(result.current[1]).toBe(premiere);
  });
});
