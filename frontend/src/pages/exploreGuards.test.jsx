import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ExplorePage from './ExplorePage';
import SlicePage from './SlicePage';
import i18n from '../i18n';
import {
  renderAvecProviders, installApiFixtures, installCanvas2D, installGeometrie, requetes,
} from '../test/harness';
import { resetPlotly, callsOf, lastCall } from '../test/plotlyStub';
import { largeDataStore } from './explore/largeDataStore';
import { CATALOGUE_INDIVIDUEL } from '../test/fixtures';

/**
 * Les GARDE-FOUS de la console : combinaisons impossibles, identifiant de jeu
 * inconnu venu d'une URL editable, restauration des reglages d'affichage. Ce
 * sont des chemins d'ERREUR, donc jamais rencontres en usage normal, et
 * pourtant ceux qui decident si un lien casse ou explique.
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

describe('garde-fous de la console', () => {
  it('signale un identifiant de jeu absent du catalogue', async () => {
    // L'identifiant vient d'une URL editable a la main : rester muet laisserait
    // croire a une panne.
    renderAvecProviders(<ExplorePage />, { route: '/explore?ds=mean_MY99_Ls0_30&var=TT&viz=slice' });
    await waitFor(() => expect(document.body.textContent)
      .toContain(i18n.t('error.datasetNotFound', { id: 'mean_MY99_Ls0_30' })), { timeout: 10000 });
    expect(requetes.some((r) => r.url === '/data/slice')).toBe(false);
  });

  it('refuse une vue MEAN sur un fichier individuel', async () => {
    installApiFixtures({ '/catalog/individual': CATALOGUE_INDIVIDUEL });
    renderAvecProviders(<ExplorePage />, {
      route: '/explore?ds=IND_MY34_LS5.00&var=TT&viz=hovmoller',
    });
    await waitFor(() => expect(document.body.textContent)
      .toContain(i18n.t('page.explore.individualError')), { timeout: 10000 });
  });

  it('refuse une vue a altitude sur une variable de SURFACE', async () => {
    // MTSF n'a pas de dimension altitude : demander un profil vertical dessus
    // n'a pas de sens, et le serveur repondrait 400.
    renderAvecProviders(<ExplorePage />, { route: `/explore?ds=${DS}&var=MTSF&viz=profile` });
    const lancer = await screen.findByRole('button', { name: i18n.t('page.explore.newView') });
    await waitFor(() => expect(lancer.disabled).toBe(false));
    fireEvent.click(lancer);
    await waitFor(() => expect(document.body.textContent)
      .toContain(i18n.t('page.explore.surfaceError')), { timeout: 8000 });
  });

  it('restaure palette et bornes depuis le permalien', async () => {
    renderAvecProviders(<ExplorePage />, {
      route: `/explore?ds=${DS}&var=TT&viz=slice&t=24&alt=49&cs=Cividis&zmin=150&zmax=300`,
    });
    await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1),
      { timeout: 10000 });
    // La derniere trace HEATMAP : les couches (reticule, particules) produisent
    // aussi des appels, sans palette.
    const tr = [...callsOf('newPlot'), ...callsOf('react')]
      .flatMap((c) => c.traces ?? [])
      .filter((x) => x.type === 'heatmap').at(-1);
    expect(tr.colorscale).toBe('Cividis');
    expect(tr.zmin).toBe(150);
    expect(tr.zmax).toBe(300);
  });

  it('borne une longitude hors plage venue de l URL', async () => {
    // Une query string se modifie a la main : 500 degres de longitude
    // n'existent pas.
    renderAvecProviders(<ExplorePage />, {
      route: `/explore?ds=${DS}&var=TT&viz=timeseries&lat=-40&lon=500&alt=49`,
    });
    await waitFor(() => expect(requetes.some((r) => r.url === '/data/timeseries')).toBe(true),
      { timeout: 10000 });
    const appel = requetes.find((r) => r.url === '/data/timeseries');
    expect(appel.params.longitude).toBeLessThanOrEqual(180);
    expect(appel.params.longitude).toBeGreaterThanOrEqual(-180);
  });

  it('ignore une longitude non numerique', async () => {
    renderAvecProviders(<ExplorePage />, {
      route: `/explore?ds=${DS}&var=TT&viz=timeseries&lat=-40&lon=abc&alt=49`,
    });
    await waitFor(() => expect(requetes.some((r) => r.url === '/data/timeseries')).toBe(true),
      { timeout: 10000 });
    const appel = requetes.find((r) => r.url === '/data/timeseries');
    expect(Number.isFinite(appel.params.longitude)).toBe(true);
  });

  it('met a jour la vue active au lieu d en ouvrir une seconde', async () => {
    renderAvecProviders(<ExplorePage />, { route: `/explore?ds=${DS}&var=TT&viz=slice&t=24&alt=49` });
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(1), { timeout: 10000 });
    const majour = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('page.explore.updateView'), 'i').test(b.textContent));
    expect(majour, 'le bouton de mise a jour doit apparaitre').toBeTruthy();
    const libelleAvant = screen.getAllByRole('tab')[0].textContent;
    fireEvent.click(majour);
    await new Promise((r) => setTimeout(r, 300));
    // Le MEME onglet est reutilise : c'est toute la difference avec
    // « Nouvelle vue », qui en empile un de plus. (Les parametres n'ayant pas
    // change, le cache client repond sans aller-retour et le trace n'est meme
    // pas refait — le contrat observable ici, c'est le nombre d'onglets.)
    expect(screen.queryAllByRole('tab')).toHaveLength(1);
    expect(screen.getAllByRole('tab')[0].textContent).toBe(libelleAvant);
  });

  it('« Nouvelle vue » en empile un de plus, elle', async () => {
    renderAvecProviders(<ExplorePage />, { route: `/explore?ds=${DS}&var=TT&viz=slice&t=24&alt=49` });
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(1), { timeout: 10000 });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('page.explore.newView') }));
    await waitFor(() => expect(screen.queryAllByRole('tab')).toHaveLength(2), { timeout: 8000 });
  });
});

describe('SlicePage — reste des reglages', () => {
  it('restaure la palette depuis le permalien', async () => {
    renderAvecProviders(<SlicePage />, {
      route: `/slice?ds=${DS}&var=TT&t=24&alt=49&cs=Cividis`,
    });
    await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1),
      { timeout: 10000 });
    expect(lastCall('newPlot').traces[0].colorscale).toBe('Cividis');
  });

  it('le permalien copie contient la palette choisie', async () => {
    const presse = [];
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (t) => { presse.push(t); return Promise.resolve(); } },
      configurable: true, writable: true,
    });
    renderAvecProviders(<SlicePage />, { route: `/slice?ds=${DS}&var=TT&t=24&alt=49&cs=Hot` });
    await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1),
      { timeout: 10000 });
    const copier = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('common.permalink'), 'i')
        .test(b.getAttribute('aria-label') || b.textContent));
    fireEvent.click(copier);
    await waitFor(() => expect(presse.length).toBeGreaterThanOrEqual(1));
    // Une palette « auto » n'est PAS ecrite (c'est le defaut) ; une palette
    // choisie doit l'etre, sinon le lien ne reproduit pas la figure.
    expect(presse[0]).toContain('cs=Hot');
  });

  it('titre une variable de SURFACE « Surface », jamais un niveau', async () => {
    // Le backend ignore l'altitude sur une variable de surface (il lit
    // {time, lat, lon}) et renvoie donc `altitudeValue: null`. L'afficheur
    // retombait alors sur « Niveau 49 », qui affirme un niveau inexistant —
    // un permalien portant un ancien `alt=49` suffisait a le produire.
    renderAvecProviders(<SlicePage />, { route: `/slice?ds=${DS}&var=MTSF&t=24&alt=49` });
    await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1),
      { timeout: 10000 });
    const titre = lastCall('newPlot').layout.title.text;
    expect(titre).toContain(i18n.t('selector.altitude.surface'));
    expect(titre).not.toContain(`${i18n.t('selector.altitude.level')} 49`);
  });
});
