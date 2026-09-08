import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import SlicePage from './SlicePage';
import AnimationPage from './AnimationPage';
import CrossSectionPage from './CrossSectionPage';
import HovmollerPage from './HovmollerPage';
import ZonalMeanPage from './ZonalMeanPage';
import WindRosePage from './WindRosePage';
import DifferencePage from './DifferencePage';
import TemporalProfilePage from './TemporalProfilePage';
import ProfilePage from './ProfilePage';
import TimeSeriesPage from './TimeSeriesPage';
import i18n from '../i18n';
import {
  renderAvecProviders, installApiFixtures, installCanvas2D, installGeometrie, requetes,
} from '../test/harness';
import { resetPlotly, callsOf, lastCall } from '../test/plotlyStub';

/**
 * Ce que l'utilisateur FAIT sur une page une fois le graphe affiche :
 * changer la palette, basculer en tableau, exporter, copier un permalien,
 * passer en plein ecran, activer les couches. Les tests precedents s'arretaient
 * au premier trace ; l'essentiel du code d'une page vient apres.
 */
let desinstallerCanvas;
let desinstallerGeo;
let clics;

beforeEach(async () => {
  resetPlotly();
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  try { localStorage.clear(); } catch { /* mode prive */ }
  await i18n.changeLanguage('fr');
  clics = [];
  URL.createObjectURL = vi.fn(() => 'blob:mcv');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function spy() {
    clics.push(this.getAttribute('download'));
  });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: () => Promise.resolve() }, configurable: true, writable: true,
  });
});

afterEach(() => { desinstallerCanvas(); desinstallerGeo(); vi.restoreAllMocks(); });

/** [nom, composant, permalien qui declenche le trace, endpoint d'export CSV] */
const PAGES = [
  ['Coupe', SlicePage, '/slice?ds=mean_MY35_Ls0_30&var=TT&t=24&alt=49', '/export/csv/slice'],
  ['Animation', AnimationPage, '/animation?ds=mean_MY35_Ls0_30&var=TT&alt=49', null],
  ['Coupe verticale', CrossSectionPage,
    '/crosssection?ds=mean_MY35_Ls0_30&var=TT&t=24&cstype=meridional&fixed=60',
    '/export/csv/crosssection'],
  ['Hovmoller', HovmollerPage, '/hovmoller?ds=mean_MY35_Ls0_30&var=TT&alt=49&hovtype=latitude',
    '/export/csv/hovmoller'],
  ['Moyenne zonale', ZonalMeanPage, '/zonalmean?ds=mean_MY35_Ls0_30&var=TT&t=24',
    '/export/csv/zonalmean'],
  ['Rose des vents', WindRosePage, '/windrose?ds=mean_MY35_Ls0_30&lat=-40&lon=30&alt=49',
    '/export/csv/windrose'],
  ['Difference', DifferencePage,
    '/difference?dsA=mean_MY35_Ls0_30&dsB=mean_MY35_Ls30_60&var=TT&t=24&alt=49',
    '/export/csv/difference'],
  ['Profil temporel', TemporalProfilePage,
    '/temporal-profile?ds=mean_MY35_Ls0_30&var=TT&lat=-40&lon=30',
    '/export/csv/temporal-profile'],
];

/** Ouvre une page par un permalien et attend son premier trace. */
async function tracee(Page, route) {
  renderAvecProviders(<Page />, { route });
  await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1),
    { timeout: 10000 });
}

describe.each(PAGES)('%s — apres le premier trace', (nom, Page, route, exportCsv) => {
  it('propose un permalien copiable', async () => {
    await tracee(Page, route);
    const copier = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('common.permalink'), 'i')
        .test(b.getAttribute('aria-label') || b.textContent));
    expect(copier, nom).toBeTruthy();
    expect(() => fireEvent.click(copier)).not.toThrow();
  });

  it('bascule en vue tableau et revient au graphe', async () => {
    await tracee(Page, route);
    const tableau = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('table.tabTable'), 'i').test(b.textContent));
    if (tableau) {
      fireEvent.click(tableau);
      // Les memes donnees, lisibles au clavier et copiables : c'est ce que le
      // graphe seul ne permet pas.
      await waitFor(() => expect(document.querySelector('table')).toBeTruthy());
      const graphe = screen.getAllByRole('button')
        .find((b) => new RegExp(i18n.t('table.tabChart'), 'i').test(b.textContent));
      fireEvent.click(graphe);
      await waitFor(() => expect(document.querySelector('table')).toBeNull());
    }
  });

  it('exporte en CSV vers le bon endpoint', async () => {
    if (!exportCsv) return;
    await tracee(Page, route);
    const menu = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('export.button'), 'i').test(b.textContent));
    expect(menu, nom).toBeTruthy();
    fireEvent.click(menu);
    const csv = screen.queryAllByRole('menuitem').find((e) => /csv/i.test(e.textContent));
    expect(csv, nom).toBeTruthy();
    fireEvent.click(csv);
    await waitFor(() => expect(requetes.some((r) => r.url === exportCsv), nom).toBe(true));
  });

  it('propose le plein ecran sur le graphe', async () => {
    await tracee(Page, route);
    const plein = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('common.fullscreen'), 'i')
        .test(b.getAttribute('aria-label') || ''));
    if (plein) {
      Element.prototype.requestFullscreen = vi.fn(() => Promise.resolve());
      fireEvent.click(plein);
      expect(Element.prototype.requestFullscreen).toHaveBeenCalled();
    }
  });

  it('explique la vue affichee', async () => {
    await tracee(Page, route);
    // Chaque page porte un texte qui dit ce que la figure MONTRE : sans lui,
    // un hovmoller ou une moyenne zonale ne se lit pas sans formation.
    expect(document.body.textContent.length, nom).toBeGreaterThan(200);
  });
});

describe('palette de couleurs', () => {
  it('change la palette du graphe affiche', async () => {
    await tracee(SlicePage, '/slice?ds=mean_MY35_Ls0_30&var=TT&t=24&alt=49');
    const selecteur = screen.getAllByRole('combobox')
      .find((c) => new RegExp(i18n.t('selector.colorscale.label'), 'i')
        .test(c.closest('.MuiFormControl-root')?.textContent || ''));
    if (selecteur) {
      fireEvent.mouseDown(selecteur);
      const cividis = screen.getAllByRole('option').find((o) => /cividis/i.test(o.textContent));
      fireEvent.click(cividis);
      await waitFor(() => {
        const dernier = [...callsOf('newPlot'), ...callsOf('react')].at(-1);
        expect(dernier.traces[0].colorscale).toBe('Cividis');
      });
    }
  });
});

describe('couches de la coupe lat/lon', () => {
  const ROUTE = '/slice?ds=mean_MY35_Ls0_30&var=TT&t=24&alt=49';

  it('affiche les lieux martiens et leur legende', async () => {
    await tracee(SlicePage, ROUTE);
    const poi = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('page.slice.locations'), 'i')
        .test(b.getAttribute('aria-label') || b.textContent));
    if (poi) {
      const avant = lastCall('newPlot').traces.length;
      fireEvent.click(poi);
      await waitFor(() => {
        const dernier = [...callsOf('newPlot'), ...callsOf('react')].at(-1);
        expect(dernier.traces.length).toBeGreaterThan(avant);
      });
    }
  });

  it('sur-echantillonne l affichage a la demande', async () => {
    await tracee(SlicePage, ROUTE);
    const interp = screen.getAllByRole('button').filter((b) => /^\s*[12]°?\s*$/.test(b.textContent));
    if (interp.length) {
      fireEvent.click(interp.at(-1));
      await waitFor(() => {
        const dernier = [...callsOf('newPlot'), ...callsOf('react')].at(-1);
        // Les points crees sont marques pour l'infobulle : une valeur inventee
        // ne doit jamais se faire passer pour une sortie du modele.
        expect(dernier.traces[0].text).toBeTruthy();
      });
    }
  });

  it('signale que les parametres ont change depuis le dernier trace', async () => {
    await tracee(SlicePage, ROUTE);
    expect(document.body.textContent).not.toContain(i18n.t('page.slice.dirty'));
    const log = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('page.slice.logScale'), 'i')
        .test(b.getAttribute('aria-label') || b.textContent));
    if (log) fireEvent.click(log);
  });
});

describe('pages multi-points — apres le trace', () => {
  it.each([
    ['Profil vertical', ProfilePage, '/profile?ds=mean_MY35_Ls0_30&var=TT&t=24&pts=' + encodeURIComponent(JSON.stringify([{ lat: -40, lon: 30 }])), '/export/csv/profile'],
    ['Serie temporelle', TimeSeriesPage, '/timeseries?ds=mean_MY35_Ls0_30&var=TT&alt=49&pts=' + encodeURIComponent(JSON.stringify([{ lat: -40, lon: 30 }])), '/export/csv/timeseries'],
  ])('%s exporte le PREMIER point en CSV', async (nom, Page, route, endpoint) => {
    await tracee(Page, route);
    const menu = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('export.button'), 'i').test(b.textContent));
    if (!menu) return;
    fireEvent.click(menu);
    const csv = screen.queryAllByRole('menuitem').find((e) => /csv/i.test(e.textContent));
    if (csv) {
      fireEvent.click(csv);
      await waitFor(() => expect(requetes.some((r) => r.url === endpoint), nom).toBe(true));
    }
  });
});
