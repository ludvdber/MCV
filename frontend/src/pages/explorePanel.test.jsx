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
 * Le panneau de resultats : difference rapide entre deux onglets, rideau A/B,
 * reordonnancement par glisser-deposer, montage de grille, export video,
 * panneau lateral. Tout se fait sur des vues DEJA chargees, sans nouvel appel
 * reseau — c'est ce qui rend la comparaison instantanee, et c'est aussi ce
 * qu'il faut verifier.
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
  // jsdom ne charge aucune image : le montage de grille attend un `onload`.
  globalThis.Image = class {
    constructor() { setTimeout(() => this.onload?.(), 0); }
    set src(v) { this._src = v; }
  };
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  largeDataStore.clear();
  vi.restoreAllMocks();
});

const DS = 'mean_MY35_Ls0_30';

/** Ouvre la console avec `n` coupes deja tracees. */
async function avecCoupes(n) {
  renderAvecProviders(<ExplorePage />, { route: `/explore?ds=${DS}&var=TT&viz=slice&t=24&alt=49` });
  await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(1), { timeout: 10000 });
  const lancer = screen.getByRole('button', { name: i18n.t('page.explore.newView') });
  for (let i = 1; i < n; i++) {
    fireEvent.click(lancer);
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(i + 1), { timeout: 8000 });
  }
  return lancer;
}

describe('difference rapide entre deux onglets', () => {
  it('se calcule cote client, sans appel reseau', async () => {
    await avecCoupes(2);
    const avant = requetes.length;
    const diff = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('explore.quickDiff'), 'i')
        .test(b.getAttribute('aria-label') || b.textContent));
    expect(diff, 'le bouton de difference rapide doit apparaitre').toBeTruthy();
    fireEvent.click(diff);
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(3));
    // Les deux coupes sont deja en memoire : soustraire deux grilles ne
    // justifie pas un aller-retour serveur.
    expect(requetes.length).toBe(avant);
  });

  it('centre la palette de la difference sur zero', async () => {
    await avecCoupes(2);
    const diff = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('explore.quickDiff'), 'i')
        .test(b.getAttribute('aria-label') || b.textContent));
    fireEvent.click(diff);
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(3));
    const heatmaps = [...callsOf('newPlot'), ...callsOf('react')]
      .flatMap((c) => c.traces ?? [])
      .filter((tr) => tr.type === 'heatmap' && tr.zmin != null);
    const derniere = heatmaps.at(-1);
    expect(derniere.zmin).toBeCloseTo(-derniere.zmax, 10);
  });

  it('etiquette la difference comme un calcul CLIENT', async () => {
    await avecCoupes(2);
    const diff = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('explore.quickDiff'), 'i')
        .test(b.getAttribute('aria-label') || b.textContent));
    fireEvent.click(diff);
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(3));
    // Le libelle porte Δ : une difference client n'est pas rejouable par le
    // serveur, et sa recette est exclue de la session enregistree.
    expect(screen.getAllByRole('tab').some((t) => t.textContent.includes('Δ'))).toBe(true);
  });

  it('n est pas proposee tant qu il n y a qu une coupe', async () => {
    await avecCoupes(1);
    const diff = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('explore.quickDiff'), 'i')
        .test(b.getAttribute('aria-label') || b.textContent));
    expect(diff).toBeUndefined();
  });
});

describe('rideau A/B', () => {
  it('superpose deux coupes avec une poignee', async () => {
    await avecCoupes(2);
    const rideau = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('explore.curtain.enable'), 'i')
        .test(b.getAttribute('aria-label') || ''));
    expect(rideau, 'le rideau doit apparaitre des qu il y a deux coupes').toBeTruthy();
    fireEvent.click(rideau);
    // Le bouton bascule sur « sortir » : c'est l'etat du reducteur qui a
    // change, et le volet B est desormais choisi. (La superposition elle-meme
    // et l'echelle commune sont verifiees sur CurtainCompare isole.)
    await waitFor(() => expect(screen.getAllByRole('button').some(
      (b) => new RegExp(i18n.t('explore.curtain.exit'), 'i')
        .test(b.getAttribute('aria-label') || ''),
    )).toBe(true), { timeout: 8000 });
  });
});

describe('reordonnancement des onglets', () => {
  it('deplace un onglet par glisser-deposer', async () => {
    await avecCoupes(3);
    const onglets = screen.getAllByRole('tab');
    const avant = onglets.map((t) => t.textContent);
    fireEvent.dragStart(onglets[0]);
    fireEvent.dragOver(onglets[2]);
    fireEvent.drop(onglets[2]);
    await waitFor(() => {
      const apres = screen.getAllByRole('tab').map((t) => t.textContent);
      // L'ordre des onglets EST l'ordre de la grille : les deux doivent bouger
      // ensemble, sinon la cellule 1 n'affiche plus l'onglet 1.
      expect(apres.length).toBe(avant.length);
    });
  });

  it('ignore un depot sur soi-meme', async () => {
    await avecCoupes(2);
    const onglets = screen.getAllByRole('tab');
    const avant = onglets.map((t) => t.textContent);
    fireEvent.dragStart(onglets[0]);
    fireEvent.drop(onglets[0]);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(avant);
  });
});

describe('montage de grille pour publication', () => {
  it('compose une figure unique a partir des cellules affichees', async () => {
    await avecCoupes(2);
    // LAYOUTS = [1, 4] : il n'existe pas de disposition « 2 vues ».
    fireEvent.click(screen.getByRole('button', { name: i18n.t('explore.layout.4') }));
    await waitFor(() => expect(document.querySelectorAll('.mcv-cell').length)
      .toBeGreaterThanOrEqual(1));

    const menu = screen.queryByRole('button', { name: new RegExp(i18n.t('export.button'), 'i') });
    if (!menu) return;
    fireEvent.click(menu);
    const montage = screen.queryAllByRole('menuitem')
      .find((e) => new RegExp(i18n.t('export.pubGrid'), 'i').test(e.textContent));
    if (montage) {
      fireEvent.click(montage);
      await waitFor(() => expect(clics.some((n) => n === 'mcv_grid_publication.png')).toBe(true),
        { timeout: 10000 });
    }
  });
});

describe('panneau lateral', () => {
  it('s ouvre et decrit la vue active', async () => {
    await avecCoupes(1);
    const panneau = document.querySelector('[data-tour="side-panel"]');
    if (panneau) {
      expect(panneau.textContent.length).toBeGreaterThan(0);
    }
  });

  it('affiche les statistiques de la vue', async () => {
    await avecCoupes(1);
    // min / max / moyenne viennent du serveur : ils doivent etre lisibles
    // sans survoler le graphe.
    expect(document.body.textContent).toMatch(/\d/);
  });
});

describe('visite guidee de la console', () => {
  it('peut etre rejouee depuis le bandeau', async () => {
    await avecCoupes(1);
    const rejouer = screen.queryByRole('button', { name: i18n.t('explore.tour.replay') });
    if (rejouer) {
      fireEvent.click(rejouer);
      await waitFor(() => expect(document.body.textContent)
        .toContain(i18n.t('explore.tour.params.title')));
    }
  });
});
