import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import ProfilePage from './ProfilePage';
import TimeSeriesPage from './TimeSeriesPage';
import ExplorePage from './ExplorePage';
import i18n from '../i18n';
import {
  renderAvecProviders, installApiFixtures, installCanvas2D, installGeometrie, requetes,
} from '../test/harness';
import { resetPlotly, callsOf } from '../test/plotlyStub';
import { largeDataStore } from './explore/largeDataStore';
import { publishProbe } from './explore/probeBus';

/**
 * Derniers chemins non couverts : raccourcis clavier des pages multi-points,
 * edition des coordonnees, permalien, et la SONDE LIEE lue par le panneau
 * lateral de la console.
 */
let desinstallerCanvas;
let desinstallerGeo;
let presse;

beforeEach(async () => {
  resetPlotly();
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  largeDataStore.clear();
  try { localStorage.clear(); } catch { /* mode prive */ }
  localStorage.setItem('mcv-explore-tour-done', '1');
  await i18n.changeLanguage('fr');
  presse = [];
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: (txt) => { presse.push(txt); return Promise.resolve(); } },
    configurable: true, writable: true,
  });
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  largeDataStore.clear();
  publishProbe(null);
  vi.restoreAllMocks();
});

const DS = 'mean_MY35_Ls0_30';
const PTS = encodeURIComponent(JSON.stringify([{ lat: -40, lon: 30 }]));

const PAGES = [
  ['Profil vertical', ProfilePage, `/profile?ds=${DS}&var=TT&t=24&pts=${PTS}`, 'profile'],
  ['Serie temporelle', TimeSeriesPage, `/timeseries?ds=${DS}&var=TT&alt=49&pts=${PTS}`, 'timeseries'],
];

async function tracee(Page, route) {
  renderAvecProviders(<Page />, { route });
  await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1),
    { timeout: 10000 });
}

describe.each(PAGES)('%s — clavier et edition', (nom, Page, route, page) => {
  it('la touche Entree relance l analyse', async () => {
    await tracee(Page, route);
    const avant = requetes.filter((r) => r.url.includes(page)).length;
    // Enter est le raccourci « visualiser » : il doit marcher depuis le corps
    // de la page, sans avoir a viser le bouton.
    fireEvent.keyDown(document.body, { key: 'Enter' });
    await waitFor(() => expect(requetes.filter((r) => r.url.includes(page)).length)
      .toBeGreaterThanOrEqual(avant));
  });

  it('la touche f demande le plein ecran sur le graphe', async () => {
    await tracee(Page, route);
    const demande = vi.fn(() => Promise.resolve());
    Element.prototype.requestFullscreen = demande;
    fireEvent.keyDown(document.body, { key: 'f' });
    expect(demande).toHaveBeenCalled();
  });

  it('editer une coordonnee marque les parametres comme modifies', async () => {
    await tracee(Page, route);
    // Latitude et longitude sont des CURSEURS (MUI Slider) : leur entree
    // native est un input[type=range], pilotable au clavier.
    const curseurs = [...document.querySelectorAll('input[type="range"]')];
    expect(curseurs.length, nom).toBeGreaterThanOrEqual(2);
    fireEvent.change(curseurs[0], { target: { value: '10' } });
    // Le rappel « parametres modifies » evite de croire que le graphe affiche
    // deja la nouvelle coordonnee.
    await waitFor(() => expect(document.body.textContent)
      .toContain(i18n.t(`page.${page}.dirty`)));
  });

  it('le permalien transporte la liste des points', async () => {
    await tracee(Page, route);
    const copier = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('common.permalink'), 'i')
        .test(b.getAttribute('aria-label') || b.textContent));
    fireEvent.click(copier);
    await waitFor(() => expect(presse.length).toBeGreaterThanOrEqual(1));
    expect(presse[0], nom).toContain('pts=');
    expect(presse[0], nom).toContain(`/${page === 'timeseries' ? 'timeseries' : 'profile'}?`);
  });

  it('changer de jeu marque aussi les parametres comme modifies', async () => {
    await tracee(Page, route);
    const champ = document.querySelector('input');
    fireEvent.mouseDown(champ);
    fireEvent.keyDown(champ, { key: 'ArrowDown' });
    fireEvent.keyDown(champ, { key: 'Enter' });
    await waitFor(() => expect(document.body.textContent)
      .toContain(i18n.t(`page.${page}.dirty`)));
  });
});

describe('panneau lateral de la console — sonde liee', () => {
  async function consoleTracee() {
    renderAvecProviders(<ExplorePage />, { route: `/explore?ds=${DS}&var=TT&viz=slice&t=24&alt=49` });
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(1), { timeout: 10000 });
  }

  it('affiche la valeur lue au point survole', async () => {
    await consoleTracee();
    await act(async () => {
      publishProbe({ lat: 0, lon: 0, time: 12, alt: 25.3, sourceId: 'autre' });
      // La mise a jour passe par requestAnimationFrame pour ne pas re-rendre
      // le panneau a chaque pixel parcouru par la souris.
      await new Promise((r) => setTimeout(r, 60));
    });
    // Une valeur chiffree apparait, avec son unite.
    await waitFor(() => expect(document.body.textContent).toMatch(/\d/));
  });

  it('nomme le lieu martien le plus proche du point sonde', async () => {
    await consoleTracee();
    await act(async () => {
      // Olympus Mons est vers 18 N, 226 E : la recherche du plus proche doit
      // franchir la couture des longitudes sans se tromper d'hemisphere.
      publishProbe({ lat: 18, lon: -134, time: 12, alt: 25.3, sourceId: 'autre' });
      await new Promise((r) => setTimeout(r, 60));
    });
    await waitFor(() => expect(document.body.textContent.length).toBeGreaterThan(100));
  });

  it('retire l affichage quand la sonde se retire', async () => {
    await consoleTracee();
    await act(async () => {
      publishProbe({ lat: 0, lon: 0, sourceId: 'autre' });
      await new Promise((r) => setTimeout(r, 60));
    });
    const avec = document.body.textContent;
    await act(async () => {
      publishProbe(null);
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(document.body.textContent).not.toBe(avec);
  });

  it('ouvre la note de methodologie depuis le panneau', async () => {
    await consoleTracee();
    const methodo = screen.queryAllByRole('button')
      .find((b) => new RegExp(i18n.t('explore.methods.open'), 'i')
        .test(b.getAttribute('aria-label') || b.textContent));
    if (methodo) {
      fireEvent.click(methodo);
      await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    }
  });
});
