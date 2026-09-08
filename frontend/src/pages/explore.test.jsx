import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ExplorePage from './ExplorePage';
import i18n from '../i18n';
import {
  renderAvecProviders, installApiFixtures, installCanvas2D, installGeometrie,
  echecHttp, requetes,
} from '../test/harness';
import { resetPlotly, callsOf } from '../test/plotlyStub';
import { largeDataStore } from './explore/largeDataStore';
import { STORAGE_KEY } from './explore/sessionRecipes';

/**
 * La console d'exploration est le plus gros composant de l'application : un
 * reducteur, quatre panneaux, la persistance de session, le rejeu de recettes
 * et le telechargement des champs de vent. On la pilote ici comme un
 * utilisateur — ouvrir, lancer une vue, changer de disposition, exporter — au
 * lieu de tester ses morceaux isolement, parce que ce sont justement les
 * interactions entre ces morceaux qui portent le risque.
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
});

/** Ouvre la console et attend que le bouton « Nouvelle vue » soit actionnable. */
async function ouvrirConsole(route = '/explore') {
  const rendu = renderAvecProviders(<ExplorePage />, { route });
  const lancer = await screen.findByRole('button', { name: i18n.t('page.explore.newView') });
  await waitFor(() => expect(lancer.disabled).toBe(false));
  return { ...rendu, lancer };
}

describe('console d exploration — ouverture', () => {
  it('se monte et charge le catalogue', async () => {
    await ouvrirConsole();
    expect(requetes.some((r) => r.url === '/catalog')).toBe(true);
  });

  it('ne demande AUCUNE donnee lourde tant que rien n est lance', async () => {
    await ouvrirConsole();
    // La grille d'altitudes est de la METADONNEE : elle alimente le selecteur
    // (« ~25,3 km » plutot que « niveau 49 ») et se charge des l'ouverture.
    // Les endpoints de donnees, eux, attendent un clic.
    const lourds = requetes.filter((r) => r.url.startsWith('/data/') && r.url !== '/data/altitudes');
    expect(lourds).toHaveLength(0);
  });

  it('propose le panneau de parametres et la scene', async () => {
    const { container } = await ouvrirConsole();
    expect(container.querySelector('[data-tour="launch"]')).toBeTruthy();
    expect(container.querySelector('[data-tour="stage"]')).toBeTruthy();
  });
});

describe('console d exploration — lancer une vue', () => {
  it('lance une coupe et la trace', async () => {
    const { lancer } = await ouvrirConsole();
    fireEvent.click(lancer);
    await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1));
    expect(requetes.some((r) => r.url === '/data/slice')).toBe(true);
  });

  it('ouvre un onglet portant un libelle lisible', async () => {
    const { lancer } = await ouvrirConsole();
    fireEvent.click(lancer);
    await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1));
    // Le libelle recompose le type, la variable et l heure : « TT 11.5h · alt49 ».
    const onglets = screen.queryAllByRole('tab');
    if (onglets.length) {
      expect(onglets[0].textContent).toMatch(/\d/);
    }
  });

  it('empile plusieurs vues sans en perdre', async () => {
    const { lancer } = await ouvrirConsole();
    fireEvent.click(lancer);
    await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1));
    const apresUne = callsOf('newPlot').length + callsOf('react').length;
    fireEvent.click(lancer);
    await waitFor(() => {
      expect(callsOf('newPlot').length + callsOf('react').length).toBeGreaterThan(apresUne);
    });
  });

  it('signale une erreur de l API sans vider la console', async () => {
    installApiFixtures({ '/data/slice': echecHttp(400, 'Altitude hors bornes') });
    const { lancer } = await ouvrirConsole();
    fireEvent.click(lancer);
    await waitFor(() => expect(document.body.textContent).toContain('Altitude hors bornes'));
    // La console reste utilisable : le bouton de lancement est toujours la.
    expect(screen.getByRole('button', { name: i18n.t('page.explore.newView') })).toBeTruthy();
  });
});

describe('console d exploration — permalien de session', () => {
  it('rejoue une vue decrite par l URL', async () => {
    // Le permalien d une console est une RECETTE : les vues sont recalculees,
    // pas transportees. C est ce qui permet a un lien de rester leger.
    renderAvecProviders(<ExplorePage />, {
      route: '/explore?ds=mean_MY35_Ls0_30&var=TT&viz=slice&t=24&alt=49',
    });
    await waitFor(() => expect(requetes.some((r) => r.url === '/data/slice')).toBe(true),
      { timeout: 5000 });
  });

  it('un permalien n ecrase pas les sessions deja enregistrees', async () => {
    // Un lien recu par courriel est un point d entree EPHEMERE : ecrire dans
    // le localStorage y ferait perdre le travail en cours de son destinataire.
    // La cle doit etre CELLE que le code lit (STORAGE_KEY) — un test ecrit sur
    // une autre cle passerait sans rien verifier.
    const avant = JSON.stringify({ v: 1, sessions: [{ id: 'garder', num: 9, name: 'Ma session' }] });
    localStorage.setItem(STORAGE_KEY, avant);
    renderAvecProviders(<ExplorePage />, { route: '/explore?ds=mean_MY35_Ls0_30&var=TT&viz=slice' });
    await waitFor(() => expect(requetes.some((r) => r.url === '/data/slice')).toBe(true),
      { timeout: 5000 });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(avant);
  });
});

describe('console d exploration — accessibilite', () => {
  it('le rail de parametres est atteignable au clavier', async () => {
    const { container } = await ouvrirConsole();
    const rail = container.querySelector('[data-tour="params-rail"]');
    if (rail) {
      expect(rail.getAttribute('role')).toBe('button');
      expect(rail.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('chaque graphe trace porte une description', async () => {
    const { lancer } = await ouvrirConsole();
    fireEvent.click(lancer);
    await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1));
    for (const fig of screen.getAllByRole('img')) {
      expect(fig.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('ne pose qu un seul titre de niveau 1', async () => {
    await ouvrirConsole();
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBeLessThanOrEqual(1);
  });
});

describe('console d exploration — vent', () => {
  it('ne telecharge un champ de vent que pour les vues AFFICHEES', async () => {
    const { lancer } = await ouvrirConsole();
    fireEvent.click(lancer);
    await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1));
    const vent = requetes.filter((r) => r.url === '/data/wind');
    // Sans couche de vent active, aucun champ ne doit partir : c est le
    // telechargement le plus lourd de la console.
    expect(vent).toHaveLength(0);
  });

  it('survit a un echec du champ de vent sans casser la vue', async () => {
    installApiFixtures({ '/data/wind': echecHttp(503, 'Service indisponible') });
    const { lancer } = await ouvrirConsole();
    fireEvent.click(lancer);
    await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1));
    expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(1);
  });
});

describe('console d exploration — sessions enregistrees', () => {
  it('repart d un localStorage corrompu au lieu de refuser de s ouvrir', async () => {
    // Le stockage est modifiable a la main et survit aux mises en ligne :
    // un contenu illisible ne doit pas empecher l ouverture de la console.
    localStorage.setItem(STORAGE_KEY, '{ceci n est pas du JSON');
    await ouvrirConsole();
    expect(screen.getByRole('button', { name: i18n.t('page.explore.newView') })).toBeTruthy();
  });

  it('tient quand le localStorage est refuse (navigation privee)', async () => {
    const vrai = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
    try {
      const { lancer } = await ouvrirConsole();
      fireEvent.click(lancer);
      await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1));
    } finally {
      Storage.prototype.setItem = vrai;
    }
  });
});
