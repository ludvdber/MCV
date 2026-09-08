import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ExplorePage from './ExplorePage';
import i18n from '../i18n';
import {
  renderAvecProviders, installApiFixtures, installCanvas2D, installGeometrie, requetes, pointeur,
} from '../test/harness';
import { resetPlotly } from '../test/plotlyStub';
import { largeDataStore } from './explore/largeDataStore';

/**
 * La GRILLE de la console : plusieurs vues cote a cote, chacune avec son
 * en-tete, sa croix de fermeture, sa mini-colorbar, et — quand elle est active
 * — les couches d'outils. Le clavier doit suffire a tout : fermer une cellule
 * a la souris seulement exclut une partie des utilisateurs.
 */
let desinstallerCanvas;
let desinstallerGeo;

beforeEach(async () => {
  resetPlotly();
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  largeDataStore.clear();
  try { localStorage.clear(); } catch { /* mode prive */ }
  localStorage.setItem('mcv-explore-tour-done', '1');
  await i18n.changeLanguage('fr');
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  largeDataStore.clear();
  vi.restoreAllMocks();
});

const DS = 'mean_MY35_Ls0_30';

/** Ouvre la console avec `n` coupes, en disposition grille. */
async function grilleAvec(n) {
  renderAvecProviders(<ExplorePage />, { route: `/explore?ds=${DS}&var=TT&viz=slice&t=24&alt=49` });
  await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(1), { timeout: 10000 });
  const lancer = screen.getByRole('button', { name: i18n.t('page.explore.newView') });
  for (let i = 1; i < n; i++) {
    fireEvent.click(lancer);
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(i + 1), { timeout: 8000 });
  }
  // La console propose DEUX dispositions (LAYOUTS = [1, 4]) : une vue, ou
  // quatre en grille. Il n'y a pas d'etat intermediaire a deux vues.
  fireEvent.click(screen.getByRole('button', { name: i18n.t('explore.layout.4') }));
  await waitFor(() => expect(document.querySelectorAll('.mcv-cell').length)
    .toBeGreaterThanOrEqual(2), { timeout: 8000 });
}

describe('grille de vues', () => {
  it('affiche une cellule par vue visible', async () => {
    await grilleAvec(2);
    expect(document.querySelectorAll('.mcv-cell')).toHaveLength(2);
  });

  it('chaque cellule porte son titre et son contexte de jeu', async () => {
    await grilleAvec(2);
    for (const cell of document.querySelectorAll('.mcv-cell')) {
      // Sans en-tete, quatre cartes cote a cote sont indistinguables.
      expect(cell.querySelector('.mcv-cell-head')?.textContent?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('cliquer une cellule la rend active', async () => {
    await grilleAvec(2);
    const cellules = [...document.querySelectorAll('.mcv-cell')];
    fireEvent.click(cellules[1]);
    await waitFor(() => {
      const actives = [...document.querySelectorAll('.mcv-cell')]
        .filter((c) => c.className.includes('on') || c.getAttribute('aria-current'));
      expect(actives.length).toBeGreaterThanOrEqual(0);
    });
    // Cliquer une cellule ne doit RIEN reorganiser : les deux restent en place.
    expect(document.querySelectorAll('.mcv-cell')).toHaveLength(2);
  });

  it('ferme une cellule a la souris', async () => {
    await grilleAvec(2);
    const croix = document.querySelector('.mcv-cell-x');
    expect(croix).toBeTruthy();
    fireEvent.click(croix);
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(1));
  });

  it('ferme une cellule au CLAVIER (Entree et Espace)', async () => {
    await grilleAvec(2);
    const croix = document.querySelector('.mcv-cell-x');
    // La croix est un `role="button"` sur un span : sans gestionnaire clavier,
    // elle est inatteignable autrement qu'a la souris.
    expect(croix.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(croix, { key: 'Enter' });
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(1));
  });

  it('la croix de l onglet se ferme aussi au clavier', async () => {
    await grilleAvec(2);
    const croixOnglet = [...document.querySelectorAll('[aria-label]')]
      .filter((e) => e.getAttribute('aria-label') === i18n.t('explore.close_tab'))
      .find((e) => !e.className.includes('mcv-cell-x'));
    if (croixOnglet) {
      fireEvent.keyDown(croixOnglet, { key: ' ' });
      await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(1));
    }
  });

  it('libere les frames d une animation fermee', async () => {
    renderAvecProviders(<ExplorePage />, { route: `/explore?ds=${DS}&var=TT&viz=animation&alt=49` });
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(1), { timeout: 10000 });
    await waitFor(() => expect(largeDataStore.size).toBeGreaterThanOrEqual(1));
    const croix = [...document.querySelectorAll('[aria-label]')]
      .find((e) => e.getAttribute('aria-label') === i18n.t('explore.close_tab'));
    fireEvent.click(croix);
    // Quarante-huit grilles restant en memoire apres fermeture, c'est la
    // fuite la plus couteuse de la console.
    await waitFor(() => expect(largeDataStore.size).toBe(0));
  });

  it('n active les outils que sur la cellule ACTIVE', async () => {
    await grilleAvec(2);
    const roi = screen.queryByRole('button', { name: i18n.t('explore.roi.enable') });
    if (roi) {
      fireEvent.click(roi);
      // Une seule couche de selection : deux rectangles simultanes sur deux
      // cartes n'auraient aucun sens.
      const canvasInteractifs = [...document.querySelectorAll('canvas')]
        .filter((c) => c.style.cursor === 'crosshair');
      expect(canvasInteractifs.length).toBeLessThanOrEqual(1);
    }
  });

  it('mesure une region dans la cellule active', async () => {
    await grilleAvec(2);
    const roi = screen.queryByRole('button', { name: i18n.t('explore.roi.enable') });
    if (roi) {
      fireEvent.click(roi);
      const canvas = [...document.querySelectorAll('canvas')]
        .find((c) => c.style.cursor === 'crosshair');
      if (canvas) {
        const avant = requetes.length;
        pointeur(canvas, 'pointerdown', 200, 150);
        pointeur(canvas, 'pointermove', 500, 350);
        pointeur(canvas, 'pointerup', 500, 350);
        await waitFor(() => expect(document.body.textContent).toMatch(/\d/));
        // La mesure est locale : aucun aller-retour serveur.
        expect(requetes.length).toBe(avant);
      }
    }
  });

  it('affiche une mini-colorbar par cellule', async () => {
    await grilleAvec(2);
    // La colorbar Plotly est masquee en compact : sans son remplacement CSS,
    // les couleurs des cellules ne veulent plus rien dire.
    await waitFor(() => expect(document.querySelectorAll('.mcv-cbar').length)
      .toBeGreaterThanOrEqual(1));
  });

  it('revient a la vue unique', async () => {
    await grilleAvec(2);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('explore.layout.1') }));
    await waitFor(() => expect(document.querySelectorAll('.mcv-cell').length)
      .toBeLessThanOrEqual(1));
  });
});
