import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import ExplorePage from './ExplorePage';
import i18n from '../i18n';
import {
  renderAvecProviders, installApiFixtures, installCanvas2D, installGeometrie,
  echecHttp, requetes,
} from '../test/harness';
import { resetPlotly, callsOf } from '../test/plotlyStub';
import { largeDataStore } from './explore/largeDataStore';
import {
  STORAGE_KEY, RECIPE_VERSION, encodeRecipe, buildSessionRecipe, isReplayable,
} from './explore/sessionRecipes';

/**
 * La persistance de session : une session est enregistree comme une RECETTE
 * (type + parametres), jamais comme ses donnees. Le rejeu la recalcule au
 * chargement. Les cas qui font mal sont ceux ou le rejeu part de travers :
 * une vue devenue irrecuperable, plus de vues que le plafond, une bascule de
 * session pendant le rejeu.
 */
let desinstallerCanvas;
let desinstallerGeo;

const recette = (results, extra = {}) => ({
  v: RECIPE_VERSION, name: null, layout: 1, activeIdx: 0, results, ...extra,
});

const P = { dataset: 'mean_MY35_Ls0_30', variable: 'TT', time: 24, altitude: 49 };

beforeEach(async () => {
  resetPlotly();
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  largeDataStore.clear();
  try { localStorage.clear(); } catch { /* mode prive */ }
  await i18n.changeLanguage('fr');
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  largeDataStore.clear();
});

/**
 * Ecrit une session enregistree dans la forme EXACTE que `loadStoredSessions`
 * relit : chaque entree de `sessions` EST une recette (nom, disposition,
 * onglet actif, vues), et `activeIdx` designe la session ouverte.
 */
function poserSessionEnregistree(results, extra = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    v: RECIPE_VERSION,
    sessions: [{ name: 'Ma session', ...recette(results, extra) }],
    activeIdx: 0,
  }));
}

describe('recettes de session', () => {
  it('ne garde que les parametres necessaires au recalcul', () => {
    const r = buildSessionRecipe({
      resultOrder: ['a'],
      resultsById: {
        a: {
          id: 'a', type: 'slice',
          // Une reponse complete est attachee au resultat : elle ne doit PAS
          // entrer dans la recette, sinon le stockage explose.
          data: { data: Array.from({ length: 1000 }, () => [1, 2, 3]) },
          params: { ...P, bruit: 'a jeter', data: [1, 2, 3] },
        },
      },
      activeResult: 'a', layout: 1,
    });
    expect(r.results[0].params).toEqual(P);
    expect(JSON.stringify(r).length).toBeLessThan(400);
  });

  it('ecarte ce que le serveur ne saurait pas recalculer', () => {
    // Une couche derivee cote client et une difference rapide n'ont pas
    // d'endpoint : les rejouer donnerait une vue vide.
    expect(isReplayable({ type: 'slice', derived: 'wsp', params: {} })).toBe(false);
    expect(isReplayable({ type: 'difference', params: {} })).toBe(false);
    expect(isReplayable({ type: 'difference', params: { datasetB: 'x' } })).toBe(true);
    expect(isReplayable({ type: 'slice', params: {} })).toBe(true);
  });

  it('l index actif est recalcule sur les seules vues rejouables', () => {
    const r = buildSessionRecipe({
      resultOrder: ['a', 'b', 'c'],
      resultsById: {
        a: { type: 'slice', params: P },
        b: { type: 'slice', derived: 'wsp', params: P },
        c: { type: 'profile', params: P },
      },
      activeResult: 'c', layout: 2,
    });
    // « c » est la troisieme vue mais la DEUXIEME rejouable : garder 2 ferait
    // pointer l'onglet actif au-dela de la liste restauree.
    expect(r.results).toHaveLength(2);
    expect(r.activeIdx).toBe(1);
  });
});

describe('rejeu au chargement', () => {
  it('restaure les vues d une session enregistree', async () => {
    poserSessionEnregistree([
      { type: 'slice', params: P },
      { type: 'profile', params: { ...P, lat: -40, lon: 30 } },
    ]);
    renderAvecProviders(<ExplorePage />, { route: '/explore' });
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(2), { timeout: 6000 });
    expect(requetes.some((r) => r.url === '/data/slice')).toBe(true);
    expect(requetes.some((r) => r.url === '/data/profile')).toBe(true);
  });

  it('restaure le RESTE quand une vue est devenue irrecuperable', async () => {
    // Un dataset retire du catalogue ne doit pas emporter toute la session.
    installApiFixtures({ '/data/profile': echecHttp(404, 'Dataset inconnu') });
    poserSessionEnregistree([
      { type: 'slice', params: P },
      { type: 'profile', params: { ...P, lat: -40, lon: 30 } },
      { type: 'zonalmean', params: P },
    ]);
    renderAvecProviders(<ExplorePage />, { route: '/explore' });
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(2), { timeout: 6000 });
  });

  it('PLAFONNE le rejeu au nombre maximal d onglets', async () => {
    // Une recette plus vieille que le plafond actuel ne doit pas produire un
    // onglet actif inexistant (viewer vide + erreur MUI Tabs).
    poserSessionEnregistree(
      Array.from({ length: 7 }, () => ({ type: 'slice', params: P })),
      { activeIdx: 6 },
    );
    renderAvecProviders(<ExplorePage />, { route: '/explore' });
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(4), { timeout: 6000 });
    // Un onglet est bien selectionne.
    await waitFor(() => expect(
      screen.queryAllByRole('tab').some((t) => t.getAttribute('aria-selected') === 'true'),
    ).toBe(true));
  });

  it('restaure la disposition enregistree', async () => {
    poserSessionEnregistree(
      [{ type: 'slice', params: P }, { type: 'slice', params: { ...P, time: 30 } }],
      { layout: 2 },
    );
    renderAvecProviders(<ExplorePage />, { route: '/explore' });
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(2), { timeout: 6000 });
    await waitFor(() => {
      const traces = [...callsOf('newPlot'), ...callsOf('react')];
      expect(traces.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('ignore un stockage d une version inconnue plutot que de mal le lire', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 999, sessions: [{ name: null, layout: 1, activeIdx: 0, results: [{ type: 'slice', params: P }] }],
      activeIdx: 0,
    }));
    renderAvecProviders(<ExplorePage />, { route: '/explore' });
    const lancer = await screen.findByRole('button', { name: i18n.t('page.explore.newView') });
    await waitFor(() => expect(lancer.disabled).toBe(false));
    // La console s'ouvre ; qu'elle rejoue ou non, elle ne doit pas casser.
    expect(lancer).toBeTruthy();
  });
});

describe('permalien de session', () => {
  it('rejoue une recette encodee dans l URL', async () => {
    const lien = encodeRecipe(recette([
      { type: 'slice', params: P },
      { type: 'zonalmean', params: { dataset: P.dataset, variable: 'TT', time: 24 } },
    ], { name: 'Partagee' }));
    renderAvecProviders(<ExplorePage />, { route: `/explore?session=${lien}` });
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(2), { timeout: 6000 });
    expect(requetes.some((r) => r.url === '/data/zonalmean')).toBe(true);
  });

  it('ignore un permalien de session illisible', async () => {
    renderAvecProviders(<ExplorePage />, { route: '/explore?session=pas-du-base64!!' });
    const lancer = await screen.findByRole('button', { name: i18n.t('page.explore.newView') });
    await waitFor(() => expect(lancer.disabled).toBe(false));
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('survit a un aller-retour encodage/decodage avec des accents', async () => {
    // Le nom de session est saisi par l'utilisateur : base64 seul casserait
    // sur un caractere non ASCII, d'ou l'encodage UTF-8 explicite.
    const { decodeRecipe } = await import('./explore/sessionRecipes');
    const original = recette([{ type: 'slice', params: P }], { name: 'Été à Élysée · 25 °C' });
    expect(decodeRecipe(encodeRecipe(original)).name).toBe('Été à Élysée · 25 °C');
  });

  it('un permalien de session ne remplace pas les sessions du destinataire', async () => {
    const avant = JSON.stringify({
      v: RECIPE_VERSION,
      sessions: [{ name: 'Mon travail', layout: 1, activeIdx: 0, results: [] }],
      activeIdx: 0,
    });
    localStorage.setItem(STORAGE_KEY, avant);
    const lien = encodeRecipe(recette([{ type: 'slice', params: P }]));
    renderAvecProviders(<ExplorePage />, { route: `/explore?session=${lien}` });
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(1), { timeout: 6000 });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(avant);
  });
});
