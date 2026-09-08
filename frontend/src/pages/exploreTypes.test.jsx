import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ExplorePage from './ExplorePage';
import i18n from '../i18n';
import {
  renderAvecProviders, installApiFixtures, installCanvas2D, installGeometrie, requetes,
} from '../test/harness';
import { resetPlotly, callsOf } from '../test/plotlyStub';
import { largeDataStore } from './explore/largeDataStore';
import { VIZ_TYPES } from './explore/exploreConstants.jsx';

/**
 * Chaque type de vue de la console, lance depuis l'interface. Le chemin
 * traverse : selecteur -> reducteur -> fetchVizData -> endpoint -> afficheur
 * correspondant -> onglet + panneau lateral. Une seule table couvre les douze,
 * ce qui rend visible tout type oublie dans un des maillons.
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
  await i18n.changeLanguage('fr');
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  largeDataStore.clear();
  vi.restoreAllMocks();
});

/** Endpoint attendu pour chaque type de vue. */
const ENDPOINT = {
  slice: '/data/slice',
  timeseries: '/data/timeseries',
  animation: '/data/animation',
  profile: '/data/profile',
  crosssection: '/data/crosssection',
  hovmoller: '/data/hovmoller',
  zonalmean: '/data/zonalmean',
  windrose: '/data/windrose',
  temporalprofile: '/data/temporal-profile',
  tides: '/data/tides',
  transect: '/data/transect',
  difference: '/data/difference',
};

/** Ouvre la console, choisit un type de vue et lance. */
async function lancerType(valeur) {
  renderAvecProviders(<ExplorePage />, { route: '/explore' });
  const lancer = await screen.findByRole('button', { name: i18n.t('page.explore.newView') });
  await waitFor(() => expect(lancer.disabled).toBe(false));

  // Le type de vue est un Select MUI : ses options n'existent qu'ouvert.
  const selecteur = document.querySelector('[data-tour="viz-type"] [role="combobox"]');
  fireEvent.mouseDown(selecteur);
  const option = screen.getAllByRole('option')
    .find((o) => o.getAttribute('data-value') === valeur);
  expect(option, `option ${valeur}`).toBeTruthy();
  fireEvent.click(option);

  fireEvent.click(screen.getByRole('button', { name: i18n.t('page.explore.newView') }));
  return lancer;
}

describe('tous les types de vue de la console', () => {
  // La difference exige un second jeu, choisi dans un champ dedie : elle est
  // traitee a part plus bas.
  const types = VIZ_TYPES.map((v) => v.value).filter((v) => v !== 'difference');

  it.each(types)('« %s » interroge son endpoint et trace', async (valeur) => {
    await lancerType(valeur);
    await waitFor(
      () => expect(requetes.some((r) => r.url === ENDPOINT[valeur]), valeur).toBe(true),
      { timeout: 6000 },
    );
    await waitFor(() => expect(callsOf('newPlot').length, valeur).toBeGreaterThanOrEqual(1));
  });

  it.each(types)('« %s » ouvre un onglet dont le libelle est traduit', async (valeur) => {
    await lancerType(valeur);
    await waitFor(() => expect(screen.queryAllByRole('tab').length, valeur).toBe(1),
      { timeout: 6000 });
    const libelle = screen.getAllByRole('tab')[0].textContent;
    expect(libelle.length, valeur).toBeGreaterThan(0);
    // Un libelle qui contient encore une cle i18n signale une traduction
    // manquante : « explore.tab_xxx_short » ne doit jamais s'afficher.
    expect(libelle, valeur).not.toMatch(/^explore\./);
  });

  it('la liste des types proposes est exactement celle de la constante', async () => {
    renderAvecProviders(<ExplorePage />, { route: '/explore' });
    await screen.findByRole('button', { name: i18n.t('page.explore.newView') });
    fireEvent.mouseDown(document.querySelector('[data-tour="viz-type"] [role="combobox"]'));
    const proposees = screen.getAllByRole('option').map((o) => o.getAttribute('data-value'));
    expect(proposees).toEqual(VIZ_TYPES.map((v) => v.value));
  });
});

describe('vue « difference »', () => {
  it('reste bloquee tant qu un second jeu n est pas choisi', async () => {
    await lancerType('difference');
    // Elle ne doit PAS partir vers l API avec un datasetB vide : le serveur
    // repondrait 400 la ou l'interface peut le dire tout de suite.
    await new Promise((r) => setTimeout(r, 200));
    expect(requetes.some((r) => r.url === '/data/difference')).toBe(false);
  });
});

describe('erreurs par type', () => {
  it('affiche le message du backend et laisse la console utilisable', async () => {
    installApiFixtures({
      '/data/tides': Object.assign(new Error('x'), {
        response: { status: 400, data: { message: 'Altitude hors bornes' } },
      }),
    });
    await lancerType('tides');
    await waitFor(() => expect(document.body.textContent).toContain('Altitude hors bornes'),
      { timeout: 6000 });
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });
});
