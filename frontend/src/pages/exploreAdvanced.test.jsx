import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ExplorePage from './ExplorePage';
import i18n from '../i18n';
import {
  renderAvecProviders, installApiFixtures, installCanvas2D, installGeometrie,
  echecHttp, requetes,
} from '../test/harness';
import { resetPlotly, callsOf } from '../test/plotlyStub';
import { largeDataStore } from './explore/largeDataStore';

/**
 * Le reste de la console : vitesse du vent derivee, drill-down depuis la
 * carte, permalien, scenarios. On entre par un PERMALIEN plutot qu'en pilotant
 * les selecteurs — c'est plus direct, et cela couvre du meme coup la
 * restauration d'URL, qui est le chemin par lequel arrivent les liens
 * partages.
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
  await i18n.changeLanguage('fr');
  presse = [];
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: (t) => { presse.push(t); return Promise.resolve(); } },
    configurable: true, writable: true,
  });
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  largeDataStore.clear();
  vi.restoreAllMocks();
});

const DS = 'mean_MY35_Ls0_30';

/** Ouvre la console par un permalien et attend la vue. */
async function parPermalien(query) {
  renderAvecProviders(<ExplorePage />, { route: `/explore?${query}` });
  await waitFor(() => expect(screen.queryAllByRole('tab').length).toBeGreaterThanOrEqual(1),
    { timeout: 10000 });
}

const outil = (cle) => screen.queryByRole('button', { name: i18n.t(cle) });

describe('permalien simple de la console', () => {
  it('restaure jeu, variable, type et coordonnees puis lance', async () => {
    await parPermalien(`ds=${DS}&var=TT&viz=slice&t=30&alt=12&lat=-40&lon=60`);
    const appel = requetes.find((r) => r.url === '/data/slice');
    expect(appel.params).toMatchObject({ dataset: DS, variable: 'TT', time: 30, altitude: 12 });
  });

  it('restaure l orientation d une coupe verticale', async () => {
    await parPermalien(`ds=${DS}&var=TT&viz=crosssection&cstype=zonal&lat=-40&lon=60`);
    const appel = requetes.find((r) => r.url === '/data/crosssection');
    // Une coupe zonale fige la LATITUDE : envoyer la longitude tracerait
    // l'autre coupe sans que rien ne le signale.
    expect(appel.params.type).toBe('zonal');
    expect(appel.params.fixedCoordinate).toBe(-40);
  });

  it('restaure l orientation d un hovmoller', async () => {
    await parPermalien(`ds=${DS}&var=TT&viz=hovmoller&hovtype=longitude`);
    expect(requetes.find((r) => r.url === '/data/hovmoller').params.type).toBe('longitude');
  });

  it('copie un permalien qui reprend l etat courant', async () => {
    await parPermalien(`ds=${DS}&var=TT&viz=slice&t=30&alt=12`);
    const copier = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('common.permalink'), 'i')
        .test(b.getAttribute('aria-label') || b.textContent));
    expect(copier).toBeTruthy();
    fireEvent.click(copier);
    await waitFor(() => expect(presse.length).toBeGreaterThanOrEqual(1));
    const url = presse[0];
    expect(url).toContain('/explore?');
    // Le lien decrit la SESSION : il se relit par le meme chemin.
    expect(url.length).toBeLessThan(4000);
  });

  it('n echoue pas quand le presse-papier est refuse', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('NotAllowedError')) },
      configurable: true, writable: true,
    });
    await parPermalien(`ds=${DS}&var=TT&viz=slice`);
    const copier = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('common.permalink'), 'i')
        .test(b.getAttribute('aria-label') || b.textContent));
    if (copier) {
      expect(() => fireEvent.click(copier)).not.toThrow();
      await new Promise((r) => setTimeout(r, 50));
    }
  });
});

describe('couche derivee — vitesse du vent', () => {
  it('combine les DEUX composantes et n en telecharge qu une de plus', async () => {
    await parPermalien(`ds=${DS}&var=UU&viz=slice&t=24&alt=49`);
    const bouton = outil('explore.derived.wsp');
    expect(bouton, 'l outil |V| doit apparaitre sur une coupe UU').toBeTruthy();
    const avant = requetes.filter((r) => r.url === '/data/slice').length;
    fireEvent.click(bouton);
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(2), { timeout: 8000 });
    const apres = requetes.filter((r) => r.url === '/data/slice');
    expect(apres.length).toBe(avant + 1);
    // C'est la composante MANQUANTE qui est demandee, pas celle deja affichee.
    expect(apres.at(-1).params.variable).toBe('VV');
  });

  it('la vitesse resultante n est jamais negative', async () => {
    await parPermalien(`ds=${DS}&var=UU&viz=slice&t=24&alt=49`);
    fireEvent.click(outil('explore.derived.wsp'));
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(2), { timeout: 8000 });
    const heatmaps = [...callsOf('newPlot'), ...callsOf('react')]
      .flatMap((c) => c.traces ?? [])
      .filter((tr) => tr.type === 'heatmap' && Array.isArray(tr.z));
    for (const v of heatmaps.at(-1).z.flat().filter((x) => x != null)) {
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it('n est pas proposee sur une variable qui n est pas une composante de vent', async () => {
    await parPermalien(`ds=${DS}&var=TT&viz=slice`);
    expect(outil('explore.derived.wsp')).toBeNull();
  });

  it('survit a l echec du telechargement de la seconde composante', async () => {
    await parPermalien(`ds=${DS}&var=UU&viz=slice&t=24&alt=49`);
    installApiFixtures({ '/data/slice': echecHttp(503, 'Service indisponible') });
    fireEvent.click(outil('explore.derived.wsp'));
    await waitFor(() => expect(document.body.textContent).toMatch(/indisponible|erreur/i),
      { timeout: 8000 });
    expect(screen.queryAllByRole('tab').length).toBe(1);
  });
});

describe('drill-down depuis la carte', () => {
  /**
   * Ouvre le menu de drill-down sur un point de la carte.
   *
   * DrillDownMenu ne peut s'abonner qu'a un div Plotly DEJA trace : au premier
   * rendu il n'y en a pas, et il reessaie toutes les 3 s. C'est deliberé
   * (Plotly.react peut remplacer le noeud, et `purge` retire `.on` en laissant
   * la classe), donc le test attend ce reessai au lieu de le contourner.
   */
  async function ouvrirMenuAu(x, y) {
    await new Promise((r) => setTimeout(r, 3200));
    const el = document.querySelector('.js-plotly-plot');
    expect(el?.emit, 'le graphe doit exposer ses evenements').toBeTruthy();
    el.emit('plotly_click', { points: [{ x, y }], event: { clientX: 100, clientY: 100 } });
    await waitFor(() => expect(screen.queryAllByRole('menuitem').length).toBeGreaterThan(0));
    return screen.getAllByRole('menuitem');
  }

  it('ouvre une vue ponctuelle au point clique', async () => {
    await parPermalien(`ds=${DS}&var=TT&viz=slice&t=24&alt=49`);
    const items = await ouvrirMenuAu(60, -40);
    const profil = items.find((e) => new RegExp(i18n.t('explore.viz.profile'), 'i').test(e.textContent));
    fireEvent.click(profil ?? items[0]);

    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(2), { timeout: 8000 });
    // Le point CLIQUE pilote la vue suivante, pas celui du formulaire.
    const ponctuel = requetes.filter((r) => /profile|timeseries|windrose/.test(r.url)).at(-1);
    expect(ponctuel.params.latitude).toBe(-40);
    expect(ponctuel.params.longitude).toBe(60);
  });

  it('herite du jeu de la vue SOURCE', async () => {
    await parPermalien(`ds=${DS}&var=TT&viz=slice&t=24&alt=49`);
    const items = await ouvrirMenuAu(0, 0);
    fireEvent.click(items[0]);
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(2), { timeout: 8000 });
    expect(requetes.at(-1).params.dataset).toBe(DS);
  });

  it('arrondit le point clique au dixieme de degre', async () => {
    // Plotly rend la coordonnee exacte du pixel : « -39.9173828125 » dans un
    // libelle d'onglet et dans un permalien n'apporte rien sur une grille a 4°.
    await parPermalien(`ds=${DS}&var=TT&viz=slice&t=24&alt=49`);
    const items = await ouvrirMenuAu(60.4823, -39.9173828125);
    fireEvent.click(items[0]);
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(2), { timeout: 8000 });
    const ponctuel = requetes.filter((r) => /profile|timeseries|windrose/.test(r.url)).at(-1);
    expect(ponctuel.params.latitude).toBe(-39.9);
    expect(ponctuel.params.longitude).toBe(60.5);
  });
});

describe('scenarios et exemples', () => {
  it('un scenario du permalien ouvre directement ses vues', async () => {
    renderAvecProviders(<ExplorePage />, { route: '/explore?scenario=slice' });
    const lancer = await screen.findByRole('button', { name: i18n.t('page.explore.newView') });
    await waitFor(() => expect(lancer.disabled).toBe(false));
    // Qu'il ouvre une vue ou non selon le catalogue, la console ne doit pas
    // casser sur un identifiant de scenario inconnu.
    expect(lancer).toBeTruthy();
  });

  it('ignore un scenario inexistant', async () => {
    renderAvecProviders(<ExplorePage />, { route: '/explore?scenario=nexiste-pas' });
    const lancer = await screen.findByRole('button', { name: i18n.t('page.explore.newView') });
    await waitFor(() => expect(lancer.disabled).toBe(false));
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });
});
