import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RouteErrorBoundary from './RouteErrorBoundary';

/**
 * Le filet de securite qui separe « une vue a plante » de « l'application a
 * disparu ». Avant son ajout, l'ErrorBoundary racine enveloppait aussi la
 * barre laterale : la moindre erreur de rendu effacait la navigation.
 *
 * `t` renvoie la cle : on verifie donc les cles i18n, pas leur traduction.
 */

const t = (k) => k;

function Boom({ explode }) {
  if (explode) throw new Error('rendu impossible');
  return <p>contenu de la vue</p>;
}

// React journalise l'erreur attrapee : on tait la sortie pour garder les
// resultats de test lisibles, sans masquer d'autres appels.
let spy;
beforeEach(() => { spy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => spy.mockRestore());

describe('RouteErrorBoundary', () => {
  it('laisse passer le rendu normal', () => {
    render(
      <RouteErrorBoundary t={t}>
        <Boom explode={false} />
      </RouteErrorBoundary>,
    );
    expect(screen.getByText('contenu de la vue')).toBeTruthy();
  });

  it('confine une erreur de rendu et propose de reessayer', () => {
    render(
      <RouteErrorBoundary t={t}>
        <Boom explode />
      </RouteErrorBoundary>,
    );
    expect(screen.getByText('error.pageTitle')).toBeTruthy();
    expect(screen.getByText('error.pageBody')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'error.retry' })).toBeTruthy();
    // L'erreur ne remonte pas : le test lui-meme n'a pas plante.
  });

  it('la NAVIGATION voisine survit au plantage', () => {
    // Reproduit la structure de App.jsx : la barre laterale est HORS du filet.
    render(
      <div>
        <nav><a href="/slice">Slice 2D</a></nav>
        <main>
          <RouteErrorBoundary t={t}>
            <Boom explode />
          </RouteErrorBoundary>
        </main>
      </div>,
    );
    expect(screen.getByText('error.pageTitle')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Slice 2D' })).toBeTruthy();
  });

  it('« Reessayer » retente le rendu et reussit si la cause a disparu', () => {
    let explode = true;
    const Flaky = () => {
      if (explode) throw new Error('rendu impossible');
      return <p>contenu de la vue</p>;
    };
    render(<RouteErrorBoundary t={t}><Flaky /></RouteErrorBoundary>);
    expect(screen.getByText('error.pageTitle')).toBeTruthy();

    explode = false;
    fireEvent.click(screen.getByRole('button', { name: 'error.retry' }));
    expect(screen.getByText('contenu de la vue')).toBeTruthy();
  });

  it('changer de route (key) repart d\'un etat sain', () => {
    const { rerender } = render(
      <RouteErrorBoundary key="/slice" t={t}><Boom explode /></RouteErrorBoundary>,
    );
    expect(screen.getByText('error.pageTitle')).toBeTruthy();

    // Nouvelle key = nouvelle instance : l'etat d'erreur ne suit pas.
    rerender(
      <RouteErrorBoundary key="/profile" t={t}><Boom explode={false} /></RouteErrorBoundary>,
    );
    expect(screen.getByText('contenu de la vue')).toBeTruthy();
  });
});
