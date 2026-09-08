import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import TimeSeriesPage from './TimeSeriesPage';
import ProfilePage from './ProfilePage';
import i18n from '../i18n';
import {
  renderAvecProviders, installApiFixtures, installCanvas2D, installGeometrie,
  echecHttp, requetes,
} from '../test/harness';
import { resetPlotly, callsOf, lastCall } from '../test/plotlyStub';

/**
 * Les deux pages qui comparent PLUSIEURS points sur un meme graphe. Elles ne
 * passent pas par `useVisualizationPage` (N requetes au lieu d'une) et
 * portent donc leur propre cycle : ajout/retrait de points, validation
 * groupee du corps de reponse, permalien qui transporte la liste.
 */
let desinstallerCanvas;
let desinstallerGeo;

beforeEach(async () => {
  resetPlotly();
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  try { localStorage.clear(); } catch { /* mode prive */ }
  await i18n.changeLanguage('fr');
});

afterEach(() => { desinstallerCanvas(); desinstallerGeo(); vi.restoreAllMocks(); });

const PAGES = [
  ['Serie temporelle', TimeSeriesPage, '/timeseries', 'page.timeseries.button', '/data/timeseries'],
  ['Profil vertical', ProfilePage, '/profile', 'page.profile.button', '/data/profile'],
];

async function ouvrir(Page, route, cleBouton) {
  renderAvecProviders(<Page />, { route });
  const analyser = await screen.findByRole('button', { name: i18n.t(cleBouton) });
  await waitFor(() => expect(analyser.disabled).toBe(false));
  return analyser;
}

/** Le bouton « ajouter un point ». */
const boutonAjout = () => screen.getAllByRole('button')
  .find((b) => new RegExp(i18n.t('page.profile.addPoint'), 'i').test(b.textContent));

describe.each(PAGES)('%s — points compares', (nom, Page, route, cleBouton, endpoint) => {
  it('demarre avec un seul point', async () => {
    await ouvrir(Page, route, cleBouton);
    expect(document.body.textContent).toContain('(1/');
  });

  it('ajoute un point et interroge l API une fois par point', async () => {
    const analyser = await ouvrir(Page, route, cleBouton);
    const ajouter = boutonAjout();
    expect(ajouter, nom).toBeTruthy();
    fireEvent.click(ajouter);
    fireEvent.click(analyser);
    await waitFor(() => {
      expect(requetes.filter((r) => r.url === endpoint), nom).toHaveLength(2);
    });
  });

  it('trace une courbe par point', async () => {
    const analyser = await ouvrir(Page, route, cleBouton);
    fireEvent.click(boutonAjout());
    fireEvent.click(analyser);
    await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1));
    expect(lastCall('newPlot').traces, nom).toHaveLength(2);
  });

  it('retire un point', async () => {
    const analyser = await ouvrir(Page, route, cleBouton);
    fireEvent.click(boutonAjout());
    expect(document.body.textContent).toContain('(2/');
    // Le bouton de suppression n'apparait qu'a partir du deuxieme point.
    const supprimer = screen.getAllByRole('button')
      .filter((b) => b.classList.contains('MuiIconButton-colorError'));
    expect(supprimer.length, nom).toBeGreaterThanOrEqual(1);
    fireEvent.click(supprimer[0]);
    expect(document.body.textContent).toContain('(1/');
    expect(analyser).toBeTruthy();
  });

  it('plafonne le nombre de points comparables', async () => {
    await ouvrir(Page, route, cleBouton);
    for (let i = 0; i < 8; i++) {
      const b = boutonAjout();
      if (b && !b.disabled) fireEvent.click(b);
    }
    // MAX_POINTS = 4 : au-dela les couleurs de series se repeteraient et le
    // graphe deviendrait illisible.
    expect(document.body.textContent).toContain('(4/4)');
  });

  it('REFUSE le lot entier si une seule reponse est inexploitable', async () => {
    // Les points forment une comparaison : en afficher trois sur quatre
    // laisserait croire que le quatrieme n'a pas de donnees.
    const analyser = await ouvrir(Page, route, cleBouton);
    fireEvent.click(boutonAjout());
    installApiFixtures({ [endpoint]: '<html>502</html>' });
    fireEvent.click(analyser);
    await waitFor(() => expect(document.body.textContent, nom)
      .toContain(i18n.t('error.malformedResponse')));
    expect(callsOf('newPlot').length, nom).toBe(0);
  });

  it('affiche le message du backend en cas d echec', async () => {
    const analyser = await ouvrir(Page, route, cleBouton);
    installApiFixtures({ [endpoint]: echecHttp(400, 'Latitude hors bornes') });
    fireEvent.click(analyser);
    await waitFor(() => expect(document.body.textContent, nom).toContain('Latitude hors bornes'));
  });
});

describe('permalien multi-points', () => {
  it('restaure la liste complete des points depuis l URL', async () => {
    const pts = encodeURIComponent(JSON.stringify([{ lat: -40, lon: 30 }, { lat: 20, lon: -60 }]));
    renderAvecProviders(<TimeSeriesPage />, {
      route: `/timeseries?ds=mean_MY35_Ls0_30&var=TT&alt=49&pts=${pts}`,
    });
    await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1),
      { timeout: 6000 });
    const appels = requetes.filter((r) => r.url === '/data/timeseries');
    expect(appels).toHaveLength(2);
    expect(appels.map((a) => a.params.latitude)).toEqual([-40, 20]);
    expect(appels.map((a) => a.params.longitude)).toEqual([30, -60]);
  });

  it('tolere une liste de points illisible sans casser la page', async () => {
    renderAvecProviders(<TimeSeriesPage />, {
      route: '/timeseries?ds=mean_MY35_Ls0_30&var=TT&pts=pas-du-json',
    });
    const analyser = await screen.findByRole('button', { name: i18n.t('page.timeseries.button') });
    await waitFor(() => expect(analyser.disabled).toBe(false));
    expect(analyser).toBeTruthy();
  });

  it('accepte l ancienne forme a un seul point (lat/lon)', async () => {
    renderAvecProviders(<TimeSeriesPage />, {
      route: '/timeseries?ds=mean_MY35_Ls0_30&var=TT&alt=49&lat=-40&lon=30',
    });
    await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1),
      { timeout: 6000 });
    const appels = requetes.filter((r) => r.url === '/data/timeseries');
    expect(appels).toHaveLength(1);
    expect(appels[0].params).toMatchObject({ latitude: -40, longitude: 30 });
  });
});
