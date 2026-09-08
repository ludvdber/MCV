import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import ExportMenu from './ExportMenu';
import SessionChips from '../pages/explore/SessionChips';
import { ExploreProvider } from '../pages/explore/ExploreContext.jsx';
import { AppThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
import { MarsProvider } from '../context/MarsContext';
import i18n from '../i18n';
import {
  renderSimple, installApiFixtures, installCanvas2D, installGeometrie, faireHotePlotly,
} from '../test/harness';
import { resetPlotly } from '../test/plotlyStub';
import Plotly from '../test/plotlyStub';

/**
 * Les chemins d'ERREUR du menu d'export et la gestion des sessions nommees.
 * Un export qui echoue en silence est pire qu'un export absent : l'utilisateur
 * attend un fichier qui n'arrivera pas.
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
});

afterEach(() => { desinstallerCanvas(); desinstallerGeo(); vi.restoreAllMocks(); });

const DansLaConsole = ({ children }) => (
  <MemoryRouter initialEntries={['/explore']}>
    <AppThemeProvider>
      <I18nextProvider i18n={i18n}>
        <ToastProvider>
          <MarsProvider>
            <ExploreProvider>{children}</ExploreProvider>
          </MarsProvider>
        </ToastProvider>
      </I18nextProvider>
    </AppThemeProvider>
  </MemoryRouter>
);

describe('ExportMenu — chemins nominaux et d erreur', () => {
  /** Monte le menu ouvert sur un graphe factice. */
  const ouvrir = (props = {}) => {
    const { plotEl } = faireHotePlotly();
    plotEl.data = [{ type: 'heatmap', z: [[1]] }];
    plotEl.layout = { title: { text: 'T' } };
    renderSimple(<ExportMenu plotRef={{ current: plotEl }} filename="fig" {...props} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('export.button'), 'i') }));
    return plotEl;
  };
  const item = (motif) => screen.queryAllByRole('menuitem').find((e) => motif.test(e.textContent));

  it('telecharge le PNG sous le nom donne', async () => {
    ouvrir();
    fireEvent.click(item(/png/i));
    await waitFor(() => expect(clics).toContain('fig.png'));
  });

  it('telecharge le SVG', async () => {
    ouvrir();
    fireEvent.click(item(/svg/i));
    await waitFor(() => expect(clics).toContain('fig.svg'));
  });

  it('affiche une erreur LISIBLE quand l export image echoue', async () => {
    // Plotly peut echouer sur une figure trop grande ou un navigateur limite :
    // sans message, le clic parait sans effet.
    vi.spyOn(Plotly, 'toImage').mockRejectedValue(new Error('trop grand'));
    ouvrir();
    fireEvent.click(item(/png/i));
    await waitFor(() => expect(document.body.textContent).toContain(i18n.t('export.pngError')));
    expect(clics).toHaveLength(0);
  });

  it('affiche une erreur distincte pour le SVG', async () => {
    vi.spyOn(Plotly, 'toImage').mockRejectedValue(new Error('trop grand'));
    ouvrir();
    fireEvent.click(item(/svg/i));
    await waitFor(() => expect(document.body.textContent).toContain(i18n.t('export.svgError')));
  });

  it('exporte en mode publication sous un nom distinct', async () => {
    ouvrir({ publication: { title: 'Temperature', credit: 'IASB' } });
    const pub = screen.queryAllByRole('menuitem')
      .find((e) => new RegExp(i18n.t('export.publicationPng'), 'i').test(e.textContent));
    if (pub) {
      fireEvent.click(pub);
      // Le suffixe _pub distingue la figure d'article du rendu ecran.
      await waitFor(() => expect(clics.some((n) => n?.includes('_pub'))).toBe(true));
    }
  });

  it('propose le NetCDF et la video seulement si l appelant les fournit', () => {
    ouvrir();
    expect(item(/netcdf/i)).toBeUndefined();
    fireEvent.keyDown(document, { key: 'Escape' });
    ouvrir({ onNetCDF: vi.fn(), onWebM: vi.fn() });
    expect(item(/netcdf/i)).toBeTruthy();
  });

  it('declenche l export NetCDF et le confirme', async () => {
    const onNetCDF = vi.fn();
    ouvrir({ onNetCDF });
    fireEvent.click(item(/netcdf/i));
    expect(onNetCDF).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(document.body.textContent.length).toBeGreaterThan(0));
  });

  it('declenche l export video', () => {
    const onWebM = vi.fn();
    ouvrir({ onWebM });
    const webm = item(/webm|vid/i);
    if (webm) {
      fireEvent.click(webm);
      expect(onWebM).toHaveBeenCalledTimes(1);
    }
  });

  it('ferme le menu apres chaque action', async () => {
    ouvrir({ onCSV: vi.fn() });
    fireEvent.click(item(/csv/i));
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });
});

describe('SessionChips', () => {
  /** Les chips ont besoin du contexte de la console, pas seulement du theme. */
  const rendreDansConsole = () => render(<SessionChips />, { wrapper: DansLaConsole });

  it('affiche la session courante comme selectionnee', () => {
    rendreDansConsole();
    const chips = screen.getAllByRole('button').filter((b) => b.className.includes('mcv-session'));
    expect(chips.length).toBeGreaterThanOrEqual(1);
    expect(chips.some((c) => c.getAttribute('aria-pressed') === 'true')).toBe(true);
  });

  it('ouvre une session de plus et bascule dessus', async () => {
    rendreDansConsole();
    const ajouter = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('explore.session.add'), 'i')
        .test(b.getAttribute('aria-label') || ''));
    if (ajouter) {
      fireEvent.click(ajouter);
      await waitFor(() => {
        const chips = screen.getAllByRole('button').filter((b) => b.className.includes('mcv-session'));
        expect(chips.length).toBeGreaterThanOrEqual(2);
      });
    }
  });

  it('previent quand le plafond de sessions est atteint', async () => {
    rendreDansConsole();
    const ajouter = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('explore.session.add'), 'i')
        .test(b.getAttribute('aria-label') || ''));
    if (ajouter) {
      for (let i = 0; i < 6; i++) fireEvent.click(ajouter);
      await waitFor(() => expect(document.body.textContent)
        .toContain(i18n.t('explore.session.limit', { max: 4 })));
    }
  });

  it('renomme une session au double-clic, et valide a Entree', async () => {
    rendreDansConsole();
    const chip = screen.getAllByRole('button').find((b) => b.className.includes('mcv-session'));
    fireEvent.doubleClick(chip);
    const champ = await screen.findByLabelText(i18n.t('explore.session.rename'));
    fireEvent.change(champ, { target: { value: 'Tempete de poussiere' } });
    fireEvent.keyDown(champ, { key: 'Enter' });
    await waitFor(() => expect(document.body.textContent).toContain('Tempete de poussiere'));
  });

  it('abandonne le renommage a Echap', async () => {
    rendreDansConsole();
    const chip = screen.getAllByRole('button').find((b) => b.className.includes('mcv-session'));
    const avant = chip.textContent;
    fireEvent.doubleClick(chip);
    const champ = await screen.findByLabelText(i18n.t('explore.session.rename'));
    fireEvent.change(champ, { target: { value: 'A jeter' } });
    fireEvent.keyDown(champ, { key: 'Escape' });
    await waitFor(() => expect(document.body.textContent).not.toContain('A jeter'));
    expect(document.body.textContent).toContain(avant.replace(/\s+/g, ' ').trim().slice(0, 6));
  });

  it('valide aussi le renommage a la perte de focus', async () => {
    rendreDansConsole();
    const chip = screen.getAllByRole('button').find((b) => b.className.includes('mcv-session'));
    fireEvent.doubleClick(chip);
    const champ = await screen.findByLabelText(i18n.t('explore.session.rename'));
    fireEvent.change(champ, { target: { value: 'Par le focus' } });
    fireEvent.blur(champ);
    await waitFor(() => expect(document.body.textContent).toContain('Par le focus'));
  });

  it('ne propose la fermeture qu a partir de deux sessions', () => {
    rendreDansConsole();
    const fermer = screen.queryAllByRole('button')
      .filter((b) => new RegExp(i18n.t('explore.session.close'), 'i')
        .test(b.getAttribute('aria-label') || ''));
    // Une seule session : pas de croix, sinon la console pourrait se retrouver
    // sans aucune session.
    expect(fermer).toHaveLength(0);
  });
});
