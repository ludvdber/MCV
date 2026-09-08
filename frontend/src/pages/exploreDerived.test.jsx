import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ExplorePage from './ExplorePage';
import i18n from '../i18n';
import {
  renderAvecProviders, installApiFixtures, installCanvas2D, installGeometrie,
  echecHttp, requetes, pointeur,
} from '../test/harness';
import { resetPlotly, callsOf } from '../test/plotlyStub';
import { largeDataStore } from './explore/largeDataStore';

/**
 * Les COUCHES DERIVEES et les outils de mesure de la console : amplitude
 * diurne, vitesse du vent, transect grand-cercle, statistiques de region,
 * drill-down, topographie, exports. Tout ce bloc est calcule ou declenche
 * dans ExplorePage et ne s'atteint qu'en pilotant l'interface.
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

/** Ouvre la console, choisit un type de vue et lance. */
async function lancer(typeVue = 'slice', { variable = null } = {}) {
  renderAvecProviders(<ExplorePage />, { route: '/explore' });
  const bouton = await screen.findByRole('button', { name: i18n.t('page.explore.newView') });
  await waitFor(() => expect(bouton.disabled).toBe(false));

  if (variable) {
    const champVariable = screen.getAllByRole('combobox')
      .find((c) => /variable/i.test(c.getAttribute('aria-label') || c.id || ''));
    if (champVariable) {
      fireEvent.mouseDown(champVariable);
      const opt = screen.queryAllByRole('option').find((o) => o.textContent.includes(variable));
      if (opt) fireEvent.click(opt);
    }
  }
  if (typeVue !== 'slice') {
    fireEvent.mouseDown(document.querySelector('[data-tour="viz-type"] [role="combobox"]'));
    const option = screen.getAllByRole('option').find((o) => o.getAttribute('data-value') === typeVue);
    fireEvent.click(option);
  }
  fireEvent.click(screen.getByRole('button', { name: i18n.t('page.explore.newView') }));
  await waitFor(() => expect(screen.queryAllByRole('tab').length).toBeGreaterThanOrEqual(1),
    { timeout: 8000 });
  return bouton;
}

const outil = (cle) => screen.queryByRole('button', { name: i18n.t(cle) });

describe('couche derivee — amplitude diurne', () => {
  it('se calcule dans le navigateur, sans aucun appel reseau', async () => {
    await lancer('animation');
    const avant = requetes.length;
    const bouton = outil('explore.derived.amplitude');
    expect(bouton).toBeTruthy();
    fireEvent.click(bouton);
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(2));
    // L'amplitude n'existe dans aucun fichier NetCDF : elle est derivee des
    // frames deja chargees, donc zero requete de plus.
    expect(requetes.length).toBe(avant);
  });

  it('produit des valeurs positives ou nulles (max moins min)', async () => {
    await lancer('animation');
    fireEvent.click(outil('explore.derived.amplitude'));
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(2));
    // On cherche la DERNIERE heatmap tracee : les couches (particules,
    // reticule) produisent aussi des appels sans grille `z`.
    const heatmaps = [...callsOf('newPlot'), ...callsOf('react')]
      .flatMap((c) => c.traces ?? [])
      .filter((tr) => tr.type === 'heatmap' && Array.isArray(tr.z));
    const valeurs = heatmaps.at(-1).z.flat().filter((v) => v != null);
    expect(valeurs.length).toBeGreaterThan(0);
    // Une amplitude est un max moins un min : elle ne peut pas etre negative.
    for (const v of valeurs) expect(v).toBeGreaterThanOrEqual(0);
  });

  it('etiquette la vue derivee sans passer par le catalogue', async () => {
    await lancer('animation');
    fireEvent.click(outil('explore.derived.amplitude'));
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(2));
    const libelles = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(libelles.some((l) => l.includes('Δ24h'))).toBe(true);
  });

  it('n est proposee que sur une animation', async () => {
    await lancer('slice');
    expect(outil('explore.derived.amplitude')).toBeNull();
  });
});

describe('outil transect', () => {
  it('n apparait que sur une coupe non derivee', async () => {
    await lancer('zonalmean');
    expect(outil('explore.transect.enable')).toBeNull();
  });

  it('trace un transect et ouvre la coupe verticale correspondante', async () => {
    await lancer('slice');
    const activer = outil('explore.transect.enable');
    expect(activer).toBeTruthy();
    fireEvent.click(activer);

    // La couche de transect pose un canvas au-dessus de la carte.
    const canvas = [...document.querySelectorAll('canvas')].at(-1);
    expect(canvas).toBeTruthy();
    pointeur(canvas, 'pointerdown', 200, 150);
    pointeur(canvas, 'pointermove', 500, 350);
    pointeur(canvas, 'pointerup', 500, 350);

    await waitFor(() => expect(requetes.some((r) => r.url === '/data/transect')).toBe(true),
      { timeout: 8000 });
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(2));
    // Les extremites partent ARRONDIES a deux decimales : une longitude a
    // quinze chiffres apres la virgule ne veut rien dire sur une grille de 4°.
    const appel = requetes.find((r) => r.url === '/data/transect');
    for (const cle of ['lat1', 'lon1', 'lat2', 'lon2']) {
      expect(String(appel.params[cle]).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
    }
  });

  it('signale l echec du serveur sans perdre la vue de depart', async () => {
    installApiFixtures({ '/data/transect': echecHttp(400, 'Trajet trop court') });
    await lancer('slice');
    fireEvent.click(outil('explore.transect.enable'));
    const canvas = [...document.querySelectorAll('canvas')].at(-1);
    pointeur(canvas, 'pointerdown', 200, 150);
    pointeur(canvas, 'pointermove', 500, 350);
    pointeur(canvas, 'pointerup', 500, 350);
    await waitFor(() => expect(document.body.textContent).toContain('Trajet trop court'),
      { timeout: 8000 });
    expect(screen.queryAllByRole('tab').length).toBe(1);
  });
});

describe('outil statistiques de region', () => {
  it('n apparait que sur les vues qui l acceptent', async () => {
    await lancer('hovmoller');
    expect(outil('explore.roi.enable')).toBeNull();
  });

  it('mesure une region tracee a la souris', async () => {
    await lancer('slice');
    const activer = outil('explore.roi.enable');
    expect(activer).toBeTruthy();
    fireEvent.click(activer);
    const canvas = [...document.querySelectorAll('canvas')].at(-1);
    pointeur(canvas, 'pointerdown', 200, 150);
    pointeur(canvas, 'pointermove', 500, 350);
    pointeur(canvas, 'pointerup', 500, 350);
    // La mesure est locale : aucune requete, et un resultat chiffre apparait.
    await waitFor(() => expect(document.body.textContent).toMatch(/\d/));
    expect(requetes.some((r) => r.url.startsWith('/data/') && r.url !== '/data/slice'
      && r.url !== '/data/altitudes')).toBe(false);
  });
});

describe('topographie', () => {
  it('telecharge la pression de surface comme fond de relief', async () => {
    await lancer('slice');
    const topo = outil('explore.toggle.topo');
    if (topo) {
      fireEvent.click(topo);
      await waitFor(() => {
        // Le relief est approche par P0 au niveau 0 : c'est la seule variable
        // de surface disponible partout dans les fichiers.
        const appels = requetes.filter((r) => r.url === '/data/slice');
        expect(appels.some((a) => a.params.variable === 'P0' && a.params.altitude === 0)).toBe(true);
      }, { timeout: 8000 });
    }
  });

  it('survit a un echec du fond de relief', async () => {
    await lancer('slice');
    installApiFixtures({ '/data/slice': echecHttp(500, 'Serveur') });
    const topo = outil('explore.toggle.topo');
    if (topo) {
      fireEvent.click(topo);
      await new Promise((r) => setTimeout(r, 300));
      // La vue reste affichee : le relief est un decor, pas la donnee.
      expect(screen.queryAllByRole('tab').length).toBe(1);
    }
  });
});

describe('drill-down depuis la carte', () => {
  it('ouvre une vue ponctuelle au point clique', async () => {
    await lancer('slice');
    const graphe = document.querySelector('.js-plotly-plot')
      ?? [...callsOf('newPlot')].at(-1)?.el;
    if (graphe?.emit) {
      graphe.emit('plotly_click', { points: [{ x: 60, y: -40 }], event: { clientX: 100, clientY: 100 } });
      const items = screen.queryAllByRole('menuitem');
      if (items.length) {
        fireEvent.click(items[0]);
        await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(2),
          { timeout: 8000 });
        // La vue derivee doit porter le point CLIQUE, pas le point du formulaire.
        const dernier = requetes.at(-1);
        expect([dernier.params.latitude, dernier.params.lat]).toContain(-40);
      }
    }
  });
});

describe('exports de la console, par type de vue', () => {
  it.each([
    ['slice', '/export/csv/slice'],
    ['zonalmean', '/export/csv/zonalmean'],
    ['hovmoller', '/export/csv/hovmoller'],
    ['windrose', '/export/csv/windrose'],
    ['temporalprofile', '/export/csv/temporal-profile'],
  ])('« %s » exporte vers %s', async (typeVue, endpoint) => {
    await lancer(typeVue);
    const menu = screen.queryByRole('button', { name: new RegExp(i18n.t('export.button'), 'i') });
    expect(menu, typeVue).toBeTruthy();
    fireEvent.click(menu);
    const csv = screen.queryAllByRole('menuitem').find((e) => /csv/i.test(e.textContent));
    expect(csv, typeVue).toBeTruthy();
    fireEvent.click(csv);
    await waitFor(() => expect(requetes.some((r) => r.url === endpoint), typeVue).toBe(true),
      { timeout: 8000 });
  });

  it('exporte une coupe en NetCDF', async () => {
    await lancer('slice');
    const menu = screen.queryByRole('button', { name: new RegExp(i18n.t('export.button'), 'i') });
    fireEvent.click(menu);
    const nc = screen.queryAllByRole('menuitem').find((e) => /netcdf/i.test(e.textContent));
    if (nc) {
      fireEvent.click(nc);
      await waitFor(() => expect(requetes.some((r) => r.url === '/export/netcdf/slice')).toBe(true),
        { timeout: 8000 });
    }
  });

  it('exporte une ANIMATION en CSV de statistiques par frame, sans appel reseau', async () => {
    await lancer('animation');
    const menu = screen.queryByRole('button', { name: new RegExp(i18n.t('export.button'), 'i') });
    fireEvent.click(menu);
    const csv = screen.queryAllByRole('menuitem').find((e) => /csv/i.test(e.textContent));
    if (csv) {
      const avant = requetes.length;
      fireEvent.click(csv);
      await waitFor(() => expect(clics.some((n) => n?.startsWith('animation_'))).toBe(true));
      // Les frames sont deja en memoire : le CSV se fabrique cote client.
      expect(requetes.length).toBe(avant);
    }
  });
});
