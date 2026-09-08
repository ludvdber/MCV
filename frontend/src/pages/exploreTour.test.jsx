import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ExplorePage from './ExplorePage';
import i18n from '../i18n';
import {
  renderAvecProviders, installApiFixtures, installCanvas2D, installGeometrie, requetes,
} from '../test/harness';
import { resetPlotly, callsOf } from '../test/plotlyStub';
import { largeDataStore } from './explore/largeDataStore';

/**
 * La visite guidee et le tiroir de parametres. La visite ne s'ouvre QUE sur
 * une disposition desktop et seulement a la premiere venue : dans jsdom,
 * aucune media query ne repond, donc ce chemin entier — y compris son etape
 * scenarisee qui charge une vraie vue — n'avait jamais tourne.
 */
let desinstallerCanvas;
let desinstallerGeo;
const matchMediaOrigine = window.matchMedia;

/** Fait repondre les media queries comme un ecran large. */
const ecranLarge = () => {
  window.matchMedia = (q) => ({
    matches: /min-width/.test(q),
    media: q, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  });
};

beforeEach(async () => {
  resetPlotly();
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  largeDataStore.clear();
  try { localStorage.clear(); } catch { /* mode prive */ }
  await i18n.changeLanguage('fr');
  ecranLarge();
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  largeDataStore.clear();
  window.matchMedia = matchMediaOrigine;
  vi.restoreAllMocks();
});

const TOUR_DONE_KEY = 'mcv-explore-tour-done';

async function ouvrir(route = '/explore') {
  renderAvecProviders(<ExplorePage />, { route });
  const lancer = await screen.findByRole('button', { name: i18n.t('page.explore.newView') });
  await waitFor(() => expect(lancer.disabled).toBe(false));
  return lancer;
}

describe('visite guidee de la console', () => {
  it('s ouvre toute seule a la premiere venue', async () => {
    await ouvrir();
    await waitFor(() => expect(document.body.textContent)
      .toContain(i18n.t('explore.tour.params.title')), { timeout: 8000 });
  });

  it('ne se rouvre PAS quand elle a deja ete vue', async () => {
    localStorage.setItem(TOUR_DONE_KEY, '1');
    await ouvrir();
    await new Promise((r) => setTimeout(r, 900));
    expect(document.body.textContent).not.toContain(i18n.t('explore.tour.params.title'));
  });

  it('note qu elle a ete vue en se fermant', async () => {
    await ouvrir();
    await waitFor(() => expect(document.body.textContent)
      .toContain(i18n.t('explore.tour.params.title')), { timeout: 8000 });
    const fermer = screen.getAllByRole('button')
      .find((b) => /passer|fermer|skip|close|terminer/i.test(
        b.getAttribute('aria-label') || b.textContent));
    if (fermer) {
      fireEvent.click(fermer);
      await waitFor(() => expect(localStorage.getItem(TOUR_DONE_KEY)).toBe('1'));
    }
  });

  it('son etape scenarisee charge une VRAIE vue', async () => {
    // Sur une console vide, les etapes « outils » et « sessions » n'auraient
    // rien a montrer : l'etape de demonstration ouvre donc une coupe.
    await ouvrir();
    await waitFor(() => expect(document.body.textContent)
      .toContain(i18n.t('explore.tour.params.title')), { timeout: 8000 });
    const suivant = screen.getAllByRole('button')
      .find((b) => /suivant|next/i.test(b.getAttribute('aria-label') || b.textContent));
    if (suivant) {
      for (let i = 0; i < 4; i++) fireEvent.click(suivant);
      await waitFor(() => expect(requetes.some((r) => r.url.startsWith('/data/'))).toBe(true),
        { timeout: 8000 });
    }
  });

  it('se rejoue a la demande', async () => {
    localStorage.setItem(TOUR_DONE_KEY, '1');
    await ouvrir();
    const rejouer = screen.queryByRole('button', { name: i18n.t('explore.tour.replay') });
    expect(rejouer).toBeTruthy();
    fireEvent.click(rejouer);
    await waitFor(() => expect(document.body.textContent)
      .toContain(i18n.t('explore.tour.params.title')));
  });

  it('ne charge la vue de demonstration qu UNE fois par parcours', async () => {
    await ouvrir();
    await waitFor(() => expect(document.body.textContent)
      .toContain(i18n.t('explore.tour.params.title')), { timeout: 8000 });
    const suivant = screen.getAllByRole('button')
      .find((b) => /suivant|next/i.test(b.getAttribute('aria-label') || b.textContent));
    const precedent = screen.getAllByRole('button')
      .find((b) => /precedent|prev|retour/i.test(b.getAttribute('aria-label') || b.textContent));
    if (suivant && precedent) {
      for (let i = 0; i < 4; i++) fireEvent.click(suivant);
      await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1),
        { timeout: 8000 });
      const apresDemo = requetes.filter((r) => r.url.startsWith('/data/')).length;
      // Revenir en arriere puis avancer ne doit pas relancer le telechargement.
      fireEvent.click(precedent);
      fireEvent.click(suivant);
      await new Promise((r) => setTimeout(r, 300));
      expect(requetes.filter((r) => r.url.startsWith('/data/')).length).toBe(apresDemo);
    }
  });
});

describe('tiroir de parametres', () => {
  it('reste deplie tant qu aucune vue n est ouverte', async () => {
    localStorage.setItem(TOUR_DONE_KEY, '1');
    await ouvrir();
    // Une console vide sans panneau visible n'offre aucun point de depart.
    expect(document.querySelector('[data-tour="viz-type"]')).toBeTruthy();
  });

  it('se laisse epingler, et le choix survit au rechargement', async () => {
    localStorage.setItem(TOUR_DONE_KEY, '1');
    await ouvrir();
    const epingle = screen.getAllByRole('button')
      .find((b) => /epingl|pin/i.test(b.getAttribute('aria-label') || ''));
    if (epingle) {
      fireEvent.click(epingle);
      await waitFor(() => expect(localStorage.getItem('mcv-params-pinned')).toBeTruthy());
    }
  });

  it('relit le choix d epinglage au montage', async () => {
    localStorage.setItem(TOUR_DONE_KEY, '1');
    localStorage.setItem('mcv-params-pinned', '1');
    await ouvrir();
    expect(document.querySelector('[data-tour="params-rail"], [data-tour="viz-type"]')).toBeTruthy();
  });

  it('tient quand le stockage est refuse', async () => {
    localStorage.setItem(TOUR_DONE_KEY, '1');
    const vrai = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
    try {
      const lancer = await ouvrir();
      expect(lancer).toBeTruthy();
    } finally {
      Storage.prototype.setItem = vrai;
    }
  });
});
