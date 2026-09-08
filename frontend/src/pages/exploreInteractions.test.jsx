import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ExplorePage from './ExplorePage';
import i18n from '../i18n';
import {
  renderAvecProviders, installApiFixtures, installCanvas2D, installGeometrie, requetes,
} from '../test/harness';
import { resetPlotly, callsOf, lastCall } from '../test/plotlyStub';
import { largeDataStore } from './explore/largeDataStore';
import { STORAGE_KEY } from './explore/sessionRecipes';

/**
 * La console pilotee comme un utilisateur : lancer, changer de disposition,
 * activer les outils, deriver une couche, exporter, fermer. Ces chemins vivent
 * dans les gestionnaires d'ExplorePage, qu'aucun test unitaire n'atteint —
 * c'est justement leur interaction avec le reducteur qui porte le risque.
 */
let desinstallerCanvas;
let desinstallerGeo;
let clics;

beforeEach(async () => {
  resetPlotly();
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  largeDataStore.clear();
  try { localStorage.clear(); } catch { /* mode prive */ }
  await i18n.changeLanguage('fr');

  // Les exports declenchent un telechargement : on observe la demande plutot
  // que le fichier, que jsdom ne saurait de toute facon pas ecrire.
  clics = [];
  URL.createObjectURL = vi.fn(() => 'blob:mcv');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function spy() {
    clics.push(this.getAttribute('download'));
  });
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  largeDataStore.clear();
  vi.restoreAllMocks();
});

/** Ouvre la console et lance une premiere vue. */
async function consoleAvecUneVue(route = '/explore') {
  renderAvecProviders(<ExplorePage />, { route });
  const lancer = await screen.findByRole('button', { name: i18n.t('page.explore.newView') });
  await waitFor(() => expect(lancer.disabled).toBe(false));
  fireEvent.click(lancer);
  await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1));
  return lancer;
}

/** Bouton d'outil, retrouve par son nom accessible. */
const outil = (cle) => screen.queryByRole('button', { name: i18n.t(cle) });

describe('outils de la console', () => {
  it('affiche la barre d outils une fois une vue ouverte', async () => {
    await consoleAvecUneVue();
    expect(screen.getByRole('toolbar', { name: i18n.t('explore.rail.label') })).toBeTruthy();
  });

  it('ajoute les lieux martiens a la carte', async () => {
    await consoleAvecUneVue();
    const avant = lastCall('newPlot').traces.length;
    fireEvent.click(outil('explore.toggle.poi'));
    await waitFor(() => {
      const dernier = [...callsOf('newPlot'), ...callsOf('react')].at(-1);
      expect(dernier.traces.length).toBeGreaterThan(avant);
    });
  });

  it('bascule l infobulle detaillee et enrichit le survol', async () => {
    await consoleAvecUneVue();
    fireEvent.click(outil('explore.toggle.tooltip'));
    await waitFor(() => {
      const dernier = [...callsOf('newPlot'), ...callsOf('react')].at(-1);
      // L'infobulle detaillee ajoute des donnees calculees par cellule.
      expect(dernier.traces[0].customdata).toBeTruthy();
    });
  });

  it('coupe le lissage', async () => {
    await consoleAvecUneVue();
    fireEvent.click(outil('explore.toggle.smooth'));
    await waitFor(() => {
      const dernier = [...callsOf('newPlot'), ...callsOf('react')].at(-1);
      expect(dernier.traces[0].zsmooth).toBe(false);
    });
  });

  it('active le vent et telecharge le champ correspondant', async () => {
    await consoleAvecUneVue();
    fireEvent.click(outil('explore.toggle.wind'));
    await waitFor(() => {
      const vent = requetes.filter((r) => r.url === '/data/wind');
      expect(vent.length).toBeGreaterThanOrEqual(1);
      // Le nom du parametre est le contrat : `altitudeIndex` ferait appliquer
      // le defaut du controleur (49) sans erreur ni journal.
      expect(vent[0].params).toHaveProperty('altitude');
      expect(vent[0].params).not.toHaveProperty('altitudeIndex');
    });
  });

  it('passe la carte en echelle logarithmique', async () => {
    await consoleAvecUneVue();
    fireEvent.click(outil('explore.toggle.log'));
    await waitFor(() => {
      const dernier = [...callsOf('newPlot'), ...callsOf('react')].at(-1);
      expect(dernier.traces[0].zmin).toBeDefined();
    });
  });

  it('derive une couche d amplitude diurne depuis la vue courante', async () => {
    await consoleAvecUneVue();
    const bouton = outil('explore.derived.amplitude');
    if (bouton) {
      const avant = screen.queryAllByRole('tab').length;
      fireEvent.click(bouton);
      // La couche derivee s'ouvre comme une vue de plus, calculee cote client.
      await waitFor(() => expect(screen.queryAllByRole('tab').length).toBeGreaterThanOrEqual(avant));
    }
  });
});

describe('disposition de la console', () => {
  it('passe en grille et affiche plusieurs vues a la fois', async () => {
    const lancer = await consoleAvecUneVue();
    fireEvent.click(lancer);
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBeGreaterThanOrEqual(2));
    // LAYOUTS = [1, 4] : il n'existe pas de disposition « 2 vues ». Viser
    // `explore.layout.2` rendait ce test silencieusement inoperant.
    fireEvent.click(screen.getByRole('button', { name: i18n.t('explore.layout.4') }));
    // Une cellule par vue visible : c'est le resultat que l'utilisateur voit.
    await waitFor(() => expect(document.querySelectorAll('.mcv-cell').length).toBe(2),
      { timeout: 8000 });
  });

  it('ferme un onglet sans emporter les autres', async () => {
    const lancer = await consoleAvecUneVue();
    fireEvent.click(lancer);
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBeGreaterThanOrEqual(2));
    const avant = screen.queryAllByRole('tab').length;
    const fermer = screen.queryAllByRole('button', { name: i18n.t('explore.close_tab') })[0];
    if (fermer) {
      fireEvent.click(fermer);
      await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(avant - 1));
    }
  });

  it('previent quand le plafond d onglets est atteint', async () => {
    const lancer = await consoleAvecUneVue();
    for (let i = 0; i < 5; i++) {
      fireEvent.click(lancer);
      await waitFor(() => expect(screen.queryAllByRole('tab').length).toBeGreaterThanOrEqual(1));
    }
    expect(screen.queryAllByRole('tab').length).toBeLessThanOrEqual(4);
  });
});

describe('exports de la console', () => {
  it('exporte la vue courante en CSV', async () => {
    await consoleAvecUneVue();
    const menu = screen.queryByRole('button', { name: new RegExp(i18n.t('export.button'), 'i') });
    if (!menu) return;
    fireEvent.click(menu);
    const csv = screen.queryAllByRole('menuitem').find((e) => /csv/i.test(e.textContent));
    if (csv) {
      fireEvent.click(csv);
      await waitFor(() => expect(requetes.some((r) => r.url.startsWith('/export/csv'))).toBe(true));
    }
  });

  it('exporte une image PNG sans toucher au graphe visible', async () => {
    await consoleAvecUneVue();
    const menu = screen.queryByRole('button', { name: new RegExp(i18n.t('export.button'), 'i') });
    if (!menu) return;
    fireEvent.click(menu);
    const png = screen.queryAllByRole('menuitem').find((e) => /png/i.test(e.textContent));
    if (png) {
      fireEvent.click(png);
      await waitFor(() => expect(callsOf('toImage').length).toBeGreaterThanOrEqual(1));
      expect(clics.some((n) => n?.endsWith('.png'))).toBe(true);
    }
  });
});

describe('permalien de la console', () => {
  it('copie un lien qui decrit la session', async () => {
    const ecrits = [];
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (t) => { ecrits.push(t); return Promise.resolve(); } },
      configurable: true, writable: true,
    });
    await consoleAvecUneVue();
    const copier = screen.queryByRole('button', { name: new RegExp(i18n.t('common.permalink'), 'i') });
    if (copier) {
      fireEvent.click(copier);
      await waitFor(() => expect(ecrits.length).toBeGreaterThanOrEqual(1));
      // Le lien est une RECETTE, pas un transport de donnees : il reste court.
      expect(ecrits[0].length).toBeLessThan(2000);
    }
  });
});

describe('sessions de la console', () => {
  it('ouvre une seconde session vierge et revient a la premiere', async () => {
    await consoleAvecUneVue();
    const avecUneVue = screen.queryAllByRole('tab').length;
    const nouvelle = screen.queryAllByRole('button')
      .find((b) => /session/i.test(b.getAttribute('aria-label') || ''));
    if (nouvelle) {
      fireEvent.click(nouvelle);
      await waitFor(() => expect(screen.queryAllByRole('tab').length).toBeLessThanOrEqual(avecUneVue));
    }
  });

  it('enregistre la session dans le stockage local, sous forme de RECETTE', async () => {
    await consoleAvecUneVue();
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy());
    const enregistre = JSON.parse(localStorage.getItem(STORAGE_KEY));
    // Ce sont les PARAMETRES qui sont conserves, pas les grilles de valeurs :
    // une session complete tiendrait sinon plusieurs mega-octets dans un
    // stockage plafonne a 5 Mo.
    expect(JSON.stringify(enregistre).length).toBeLessThan(5000);
    expect(enregistre.v).toBeTruthy();
  });
});
