import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, screen } from '@testing-library/react';
import { useReveal } from './useReveal';
import { useCountUp } from './useCountUp';

/**
 * Les deux hooks de l'accueil declenches par le defilement. jsdom ne calcule
 * aucune geometrie : on remplace IntersectionObserver par une version PILOTEE,
 * ce qui permet de tester le declenchement, le desabonnement et — surtout —
 * qu'un element qui n'a jamais ete vu ne s'anime pas.
 */
let observateurs;

class ObservateurPilote {
  constructor(cb, options) {
    this.cb = cb;
    this.options = options;
    this.observes = [];
    this.deconnecte = false;
    observateurs.push(this);
  }
  observe(el) { this.observes.push(el); }
  unobserve(el) { this.observes = this.observes.filter((e) => e !== el); }
  disconnect() { this.deconnecte = true; this.observes = []; }
  /** Simule l'entree dans le champ de vision. */
  entrer() { this.cb([{ isIntersecting: true }], this); }
  sortir() { this.cb([{ isIntersecting: false }], this); }
}

const vrai = globalThis.IntersectionObserver;

beforeEach(() => {
  observateurs = [];
  globalThis.IntersectionObserver = ObservateurPilote;
});

afterEach(() => {
  globalThis.IntersectionObserver = vrai;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function Bloc({ delay = 0 }) {
  const { ref, style } = useReveal(delay);
  return <div ref={ref} data-testid="bloc" style={style}>contenu</div>;
}

describe('useReveal', () => {
  it('part invisible et decale vers le bas', () => {
    render(<Bloc />);
    const el = screen.getByTestId('bloc');
    expect(el.style.opacity).toBe('0');
    expect(el.style.transform).toBe('translateY(28px)');
  });

  it('se revele en entrant dans le champ de vision', () => {
    render(<Bloc />);
    act(() => observateurs[0].entrer());
    const el = screen.getByTestId('bloc');
    expect(el.style.opacity).toBe('1');
    expect(el.style.transform).toBe('translateY(0)');
  });

  it('ne se revele pas tant qu il n est pas vu', () => {
    render(<Bloc />);
    act(() => observateurs[0].sortir());
    expect(screen.getByTestId('bloc').style.opacity).toBe('0');
  });

  it('cesse d observer une fois revele (l animation ne rejoue pas)', () => {
    render(<Bloc />);
    act(() => observateurs[0].entrer());
    expect(observateurs[0].observes).toHaveLength(0);
  });

  it('applique le retard demande a la transition', () => {
    render(<Bloc delay={0.3} />);
    expect(screen.getByTestId('bloc').style.transition).toContain('0.3s');
  });

  it('se deconnecte au demontage', () => {
    const { unmount } = render(<Bloc />);
    unmount();
    expect(observateurs[0].deconnecte).toBe(true);
  });
});

function Compteur({ target, decimals = 0, delay = 0 }) {
  const { ref, value } = useCountUp(target, decimals, delay);
  return <span ref={ref} data-testid="n">{value}</span>;
}

describe('useCountUp', () => {
  /** Les faux minuteurs de Vitest pilotent AUSSI requestAnimationFrame et
   *  performance.now : avancer l'horloge fait donc avancer l'animation, sans
   *  qu'on ait a remplacer les globales (ce qui casserait le nettoyage React,
   *  qui appelle cancelAnimationFrame au demontage). */
  const avancer = (ms) => act(() => { vi.advanceTimersByTime(ms); });

  it('affiche zero tant que le bloc n est pas vu', () => {
    render(<Compteur target={972} />);
    expect(screen.getByTestId('n').textContent).toBe('0');
  });

  it('atteint EXACTEMENT la cible en fin d animation', () => {
    // Un compteur qui s arrete a 971,8 sur une donnee affichee comme « 972
    // fichiers » est un bug visible : la derniere image force la valeur.
    vi.useFakeTimers();
    render(<Compteur target={972} />);
    act(() => observateurs[0].entrer());
    avancer(2000);
    expect(screen.getByTestId('n').textContent).toBe('972');
  });

  it('progresse avant la fin, sans depasser la cible', () => {
    vi.useFakeTimers();
    render(<Compteur target={100} />);
    act(() => observateurs[0].entrer());
    avancer(900);
    const v = Number(screen.getByTestId('n').textContent);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThanOrEqual(100);
  });

  it('respecte le nombre de decimales demande', () => {
    vi.useFakeTimers();
    render(<Compteur target={4.27} decimals={2} />);
    act(() => observateurs[0].entrer());
    avancer(500);
    expect(screen.getByTestId('n').textContent).toMatch(/^\d+(\.\d{1,2})?$/);
  });

  it('attend le retard demande avant de demarrer', () => {
    vi.useFakeTimers();
    render(<Compteur target={100} delay={0.5} />);
    act(() => observateurs[0].entrer());
    avancer(400);
    expect(screen.getByTestId('n').textContent).toBe('0');
    // ... et demarre bien une fois le retard ecoule.
    avancer(200);
    expect(Number(screen.getByTestId('n').textContent)).toBeGreaterThan(0);
  });

  it('ne demarre qu une fois, meme si l element repasse dans le champ', () => {
    vi.useFakeTimers();
    render(<Compteur target={100} />);
    act(() => observateurs[0].entrer());
    // L observateur se deconnecte des la premiere entree : l animation ne
    // rejouera pas a chaque aller-retour de defilement.
    expect(observateurs[0].deconnecte).toBe(true);
  });

  it('ne s anime pas du tout si le bloc n est jamais vu', () => {
    vi.useFakeTimers();
    render(<Compteur target={100} />);
    avancer(5000);
    expect(screen.getByTestId('n').textContent).toBe('0');
  });

  it('se deconnecte au demontage', () => {
    vi.useFakeTimers();
    const { unmount } = render(<Compteur target={100} />);
    act(() => observateurs[0].entrer());
    avancer(10);
    unmount();
    expect(observateurs[0].deconnecte).toBe(true);
  });
});
