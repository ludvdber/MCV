import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ExplorePage from './ExplorePage';
import i18n from '../i18n';
import {
  renderAvecProviders, installApiFixtures, installCanvas2D, installGeometrie, requetes, pointeur,
} from '../test/harness';
import { resetPlotly } from '../test/plotlyStub';
import { largeDataStore } from './explore/largeDataStore';

/**
 * Les exports CSV de la console, type par type. Trois d'entre eux n'ont AUCUN
 * endpoint serveur (couches derivees, transect, marees) : leur fichier est
 * fabrique dans le navigateur, et c'est justement le code qu'aucun test
 * d'API ne peut atteindre.
 */
let desinstallerCanvas;
let desinstallerGeo;
let telecharges;

beforeEach(async () => {
  resetPlotly();
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  largeDataStore.clear();
  try { localStorage.clear(); } catch { /* mode prive */ }
  localStorage.setItem('mcv-explore-tour-done', '1');
  await i18n.changeLanguage('fr');

  // L'ordre reel est createObjectURL PUIS click : on retient le dernier blob
  // construit et on l'associe au nom au moment du clic.
  telecharges = [];
  let dernierBlob = null;
  URL.createObjectURL = vi.fn((blob) => { dernierBlob = blob; return 'blob:mcv'; });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function spy() {
    telecharges.push({ nom: this.getAttribute('download'), blob: dernierBlob });
  });
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  largeDataStore.clear();
  vi.restoreAllMocks();
});

const DS = 'mean_MY35_Ls0_30';

/** Ouvre la console par permalien et attend le trace. */
async function parPermalien(query) {
  renderAvecProviders(<ExplorePage />, { route: `/explore?${query}` });
  await waitFor(() => expect(screen.queryAllByRole('tab').length).toBeGreaterThanOrEqual(1),
    { timeout: 10000 });
}

/** Ouvre le menu d'export et clique l'entree CSV. */
async function exporterCSV() {
  const menu = screen.getByRole('button', { name: new RegExp(i18n.t('export.button'), 'i') });
  fireEvent.click(menu);
  const csv = screen.queryAllByRole('menuitem').find((e) => /csv/i.test(e.textContent));
  expect(csv, 'l entree CSV doit exister').toBeTruthy();
  fireEvent.click(csv);
}

describe('exports CSV passant par le serveur', () => {
  it.each([
    ['slice', `ds=${DS}&var=TT&viz=slice&t=24&alt=49`, '/export/csv/slice'],
    ['timeseries', `ds=${DS}&var=TT&viz=timeseries&lat=-40&lon=30&alt=49`, '/export/csv/timeseries'],
    ['profile', `ds=${DS}&var=TT&viz=profile&t=24&lat=-40&lon=30`, '/export/csv/profile'],
    ['crosssection', `ds=${DS}&var=TT&viz=crosssection&cstype=meridional&lat=-40&lon=30`, '/export/csv/crosssection'],
    ['hovmoller', `ds=${DS}&var=TT&viz=hovmoller&alt=49`, '/export/csv/hovmoller'],
    ['zonalmean', `ds=${DS}&var=TT&viz=zonalmean&t=24`, '/export/csv/zonalmean'],
    ['windrose', `ds=${DS}&var=TT&viz=windrose&lat=-40&lon=30&alt=49`, '/export/csv/windrose'],
    ['temporalprofile', `ds=${DS}&var=TT&viz=temporalprofile&lat=-40&lon=30`, '/export/csv/temporal-profile'],
  ])('« %s » appelle %s', async (type, query, endpoint) => {
    await parPermalien(query);
    await exporterCSV();
    await waitFor(() => expect(requetes.some((r) => r.url === endpoint), type).toBe(true),
      { timeout: 8000 });
  });

  it('envoie altitude 0 pour une variable de SURFACE', async () => {
    // MTSF n'a pas de dimension altitude : transmettre l'indice du formulaire
    // ferait lire un niveau inexistant.
    await parPermalien(`ds=${DS}&var=MTSF&viz=slice&t=24&alt=49`);
    await exporterCSV();
    await waitFor(() => {
      const appel = requetes.find((r) => r.url === '/export/csv/slice');
      expect(appel.params.altitude).toBe(0);
    }, { timeout: 8000 });
  });
});

describe('exports CSV fabriques dans le navigateur', () => {
  it('une couche DERIVEE produit son propre CSV, sans reseau', async () => {
    await parPermalien(`ds=${DS}&var=TT&viz=animation&alt=49`);
    const amplitude = screen.getByRole('button', { name: i18n.t('explore.derived.amplitude') });
    fireEvent.click(amplitude);
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(2));
    const avant = requetes.length;
    await exporterCSV();
    await waitFor(() => expect(telecharges.some((d) => d.nom?.startsWith('derived_amplitude'))).toBe(true));
    expect(requetes.length).toBe(avant);
    // Le fichier porte les colonnes attendues d'une grille lat/lon.
    const texte = await telecharges.at(-1).blob.text();
    expect(texte.split('\n')[0]).toBe('latitude,longitude,value');
  });

  it('un TRANSECT produit son CSV client, avec distance et trajet', async () => {
    await parPermalien(`ds=${DS}&var=TT&viz=slice&t=24&alt=49`);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('explore.transect.enable') }));
    const canvas = [...document.querySelectorAll('canvas')].at(-1);
    pointeur(canvas, 'pointerdown', 200, 150);
    pointeur(canvas, 'pointermove', 500, 350);
    pointeur(canvas, 'pointerup', 500, 350);
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBe(2), { timeout: 8000 });

    await exporterCSV();
    await waitFor(() => expect(telecharges.some((d) => d.nom?.startsWith('transect_'))).toBe(true));
    const texte = await telecharges.at(-1).blob.text();
    // La distance ET le trajet suivi : sans les coordonnees, le transect n'est
    // pas rejouable dans un autre outil.
    expect(texte.split('\n')[0]).toBe('distance_km,latitude,longitude,altitude_km,value');
  });

  it('les MAREES produisent un CSV client a sept colonnes', async () => {
    await parPermalien(`ds=${DS}&var=TT&viz=tides&alt=49`);
    const avant = requetes.length;
    await exporterCSV();
    await waitFor(() => expect(telecharges.some((d) => d.nom?.startsWith('tides_'))).toBe(true));
    expect(requetes.length).toBe(avant);
    const texte = await telecharges.at(-1).blob.text();
    const entete = texte.split('\n')[0].split(',');
    // Moyenne + amplitude et phase des deux modes : la phase seule ne se lit
    // pas sans son amplitude.
    expect(entete).toHaveLength(7);
    expect(entete).toContain('phase_diurnal_h');
    expect(entete).toContain('amplitude_semidiurnal');
  });
});

describe('export NetCDF de la console', () => {
  it('n est propose que sur une coupe NON derivee', async () => {
    await parPermalien(`ds=${DS}&var=TT&viz=zonalmean&t=24`);
    const menu = screen.getByRole('button', { name: new RegExp(i18n.t('export.button'), 'i') });
    fireEvent.click(menu);
    expect(screen.queryAllByRole('menuitem').find((e) => /netcdf/i.test(e.textContent)))
      .toBeUndefined();
  });

  it('envoie altitude 0 pour une variable de surface', async () => {
    await parPermalien(`ds=${DS}&var=MTSF&viz=slice&t=24&alt=49`);
    const menu = screen.getByRole('button', { name: new RegExp(i18n.t('export.button'), 'i') });
    fireEvent.click(menu);
    const nc = screen.queryAllByRole('menuitem').find((e) => /netcdf/i.test(e.textContent));
    expect(nc).toBeTruthy();
    fireEvent.click(nc);
    await waitFor(() => {
      const appel = requetes.find((r) => r.url === '/export/netcdf/slice');
      expect(appel.params.altitude).toBe(0);
    }, { timeout: 8000 });
  });
});
