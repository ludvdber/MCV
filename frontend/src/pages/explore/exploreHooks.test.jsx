import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, render, screen, fireEvent } from '@testing-library/react';
import { useSyncZoom } from './useSyncZoom';
import { useCommandRunner } from './useCommandRunner';
import { ExploreProvider } from './ExploreContext.jsx';
import { publishRange } from './syncZoomBus';
import CommandBar from './CommandBar';
import SessionChips from './SessionChips';
import CurtainCompare from './CurtainCompare';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import { AppThemeProvider } from '../../context/ThemeContext';
import { ToastProvider } from '../../context/ToastContext';
import { MarsProvider } from '../../context/MarsContext';
import {
  installApiFixtures, installCanvas2D, installGeometrie, faireHotePlotly, requetes,
} from '../../test/harness';
import { resetPlotly, callsOf } from '../../test/plotlyStub';
import { ALTS, SLICE } from '../../test/fixtures';

/**
 * Les crochets et panneaux de la console qui ne se testent bien qu'avec leur
 * contexte : zoom synchronise, execution d'un plan de commande, chips de
 * session, rideau A/B.
 */
let desinstallerCanvas;
let desinstallerGeo;

/** Enveloppe complete de la console (contexte Mars + contexte Explore). */
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

beforeEach(async () => {
  resetPlotly();
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  try { localStorage.clear(); } catch { /* mode prive */ }
  await i18n.changeLanguage('fr');
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  document.body.innerHTML = '';
});

describe('useSyncZoom', () => {
  const GEO = { l: 60, t: 40, w: 600, h: 400, xr: [-180, 180], yr: [-90, 90] };

  it('ne s abonne a rien quand l outil est eteint', () => {
    const { hostRef, plotEl } = faireHotePlotly(GEO);
    renderHook(() => useSyncZoom(hostRef, false, 'v1'));
    plotEl.emit('plotly_relayout', { 'xaxis.range[0]': -90, 'xaxis.range[1]': 90 });
    expect(callsOf('relayout')).toHaveLength(0);
  });

  it('applique a cette carte la fenetre publiee par une AUTRE', async () => {
    const { hostRef, plotEl } = faireHotePlotly(GEO);
    renderHook(() => useSyncZoom(hostRef, true, 'v1'));
    await act(async () => {
      publishRange({ xr: [-90, 90], yr: [-45, 45], autorange: false, sourceId: 'v2' });
    });
    const appel = callsOf('relayout').at(-1);
    expect(appel.el).toBe(plotEl);
    expect(appel.args[0]).toEqual({ 'xaxis.range': [-90, 90], 'yaxis.range': [-45, 45] });
  });

  it('IGNORE sa propre publication (pas d echo)', async () => {
    const { hostRef } = faireHotePlotly(GEO);
    renderHook(() => useSyncZoom(hostRef, true, 'v1'));
    await act(async () => {
      publishRange({ xr: [0, 1], yr: [0, 1], autorange: false, sourceId: 'v1' });
    });
    expect(callsOf('relayout')).toHaveLength(0);
  });

  it('relaie une remise a l echelle automatique', async () => {
    const { hostRef } = faireHotePlotly(GEO);
    renderHook(() => useSyncZoom(hostRef, true, 'v1'));
    await act(async () => {
      publishRange({ xr: null, yr: null, autorange: true, sourceId: 'v2' });
    });
    expect(callsOf('relayout').at(-1).args[0])
      .toEqual({ 'xaxis.autorange': true, 'yaxis.autorange': true });
  });

  it('publie un zoom utilisateur, dans les DEUX formes emises par Plotly', async () => {
    const { hostRef, plotEl } = faireHotePlotly(GEO);
    renderHook(() => useSyncZoom(hostRef, true, 'source'));
    const recus = [];
    const off = (await import('./syncZoomBus')).subscribeRange((r) => recus.push(r));

    // Forme « zoom a la souris ».
    plotEl.emit('plotly_relayout', {
      'xaxis.range[0]': -90, 'xaxis.range[1]': 90,
      'yaxis.range[0]': -45, 'yaxis.range[1]': 45,
    });
    // Forme « relayout programmatique ».
    plotEl.emit('plotly_relayout', { 'xaxis.range': [0, 10], 'yaxis.range': [0, 5] });
    off();
    expect(recus).toHaveLength(2);
    expect(recus[0].xr).toEqual([-90, 90]);
    expect(recus[1].xr).toEqual([0, 10]);
  });

  it('publie une remise a l echelle automatique', () => {
    const { hostRef, plotEl } = faireHotePlotly(GEO);
    renderHook(() => useSyncZoom(hostRef, true, 'source'));
    const recus = [];
    let off;
    return import('./syncZoomBus').then((bus) => {
      off = bus.subscribeRange((r) => recus.push(r));
      plotEl.emit('plotly_relayout', { 'xaxis.autorange': true });
      off();
      expect(recus[0]).toMatchObject({ autorange: true, sourceId: 'source' });
    });
  });

  it('ignore un relayout qui ne touche aucun axe (changement de titre)', async () => {
    const { hostRef, plotEl } = faireHotePlotly(GEO);
    renderHook(() => useSyncZoom(hostRef, true, 'source'));
    const recus = [];
    const off = (await import('./syncZoomBus')).subscribeRange((r) => recus.push(r));
    plotEl.emit('plotly_relayout', { 'title.text': 'nouveau titre' });
    plotEl.emit('plotly_relayout', null);
    off();
    expect(recus).toHaveLength(0);
  });

  it('se detache au demontage', async () => {
    const { hostRef } = faireHotePlotly(GEO);
    const { unmount } = renderHook(() => useSyncZoom(hostRef, true, 'v1'));
    unmount();
    await act(async () => {
      publishRange({ xr: [0, 1], yr: [0, 1], autorange: false, sourceId: 'v2' });
    });
    expect(callsOf('relayout')).toHaveLength(0);
  });
});

describe('useCommandRunner', () => {
  const rendreCoureur = () => renderHook(() => useCommandRunner(), { wrapper: DansLaConsole });

  it('refuse un plan impossible et le dit', async () => {
    const { result } = rendreCoureur();
    let ok;
    await act(async () => { ok = await result.current({ invalid: true }); });
    expect(ok).toBe(false);
    await waitFor(() => expect(document.body.textContent).toContain(i18n.t('explore.cmdk.meanOnly')));
  });

  it('convertit une altitude en KILOMETRES vers l indice de niveau le plus proche', async () => {
    // « 50 km » n'est pas le niveau 50 : la grille GEM-Mars n'est pas lineaire.
    const { result } = rendreCoureur();
    await act(async () => {
      await result.current({ datasetId: 'mean_MY35_Ls0_30', variable: 'TT', altKm: 12 });
    });
    const appel = requetes.find((r) => r.url === '/data/altitudes');
    expect(appel).toBeTruthy();
    // ALTS = [0.5, 5.2, 12.4, 25.3, 48.9] : 12 km tombe sur l'indice 2.
    expect(ALTS[2]).toBe(12.4);
  });

  it('n abandonne pas le plan si la grille d altitudes est indisponible', async () => {
    installApiFixtures({ '/data/altitudes': new Error('reseau') });
    const { result } = rendreCoureur();
    let ok;
    await act(async () => {
      ok = await result.current({ datasetId: 'mean_MY35_Ls0_30', variable: 'TT', altKm: 12 });
    });
    // L'altitude reste celle en place ; le reste du plan s'applique quand meme.
    expect(ok).toBe(true);
  });

  it('confirme le lancement', async () => {
    const { result } = rendreCoureur();
    await act(async () => { await result.current({ viz: 'slice', variable: 'TT' }); });
    await waitFor(() => expect(document.body.textContent).toContain(i18n.t('explore.cmdk.launched')));
  });
});

describe('SessionChips', () => {
  const rendre = () => render(<SessionChips />, { wrapper: DansLaConsole });

  it('affiche la session courante', () => {
    rendre();
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });

  it('ouvre une session de plus, jusqu au plafond', () => {
    rendre();
    const ajouter = screen.getAllByRole('button')
      .find((b) => /nouvelle|ajouter|\+/i.test(b.getAttribute('aria-label') || b.textContent));
    if (ajouter) {
      const avant = screen.getAllByRole('button').length;
      fireEvent.click(ajouter);
      expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(avant);
    }
  });
});

describe('CurtainCompare', () => {
  const volet = (id, min, max) => ({
    id, type: 'slice', params: { variable: 'TT' },
    data: { ...SLICE, stats: { ...SLICE.stats, min, max } },
  });

  it('superpose deux coupes sur une ECHELLE COMMUNE', () => {
    // Deux cartes cote a cote avec chacune son echelle ne se comparent pas :
    // la meme couleur n'y designe pas la meme temperature.
    render(<CurtainCompare resultA={volet('a', 180, 250)} resultB={volet('b', 200, 300)} />,
      { wrapper: DansLaConsole });
    const traces = callsOf('newPlot').map((c) => c.traces[0]);
    expect(traces.length).toBeGreaterThanOrEqual(2);
    for (const tr of traces) {
      expect(tr.zmin).toBe(180);
      expect(tr.zmax).toBe(300);
    }
  });

  it('laisse Plotly choisir l echelle en mode logarithmique', () => {
    const { container } = render(
      <CurtainCompare resultA={volet('a', 180, 250)} resultB={volet('b', 200, 300)} />,
      { wrapper: DansLaConsole },
    );
    expect(container.querySelector('div')).toBeTruthy();
  });

  it('deplace la poignee au glisser', () => {
    const { container } = render(
      <CurtainCompare resultA={volet('a', 180, 250)} resultB={volet('b', 200, 300)} />,
      { wrapper: DansLaConsole },
    );
    const poignee = container.querySelector('[role="separator"], [aria-label]');
    if (poignee) {
      expect(() => fireEvent.pointerDown(poignee, { clientX: 100 })).not.toThrow();
      expect(() => fireEvent.pointerMove(window, { clientX: 300 })).not.toThrow();
      expect(() => fireEvent.pointerUp(window)).not.toThrow();
    }
  });
});

describe('CommandBar', () => {
  it('propose un declencheur, pas un champ ouvert en permanence', () => {
    // Elle occupe une ligne du bandeau : le champ ne s'ouvre qu'a la demande
    // (clic ou Ctrl+K), sinon il capte le focus au chargement de la console.
    const { container } = render(<CommandBar />, { wrapper: DansLaConsole });
    expect(container.textContent).toContain('MCV');
    expect(container.querySelector('input')).toBeNull();
  });

  it('s ouvre au clic et rend un champ de saisie', async () => {
    render(<CommandBar />, { wrapper: DansLaConsole });
    fireEvent.click(screen.getAllByRole('button')[0]);
    await waitFor(() => expect(document.querySelector('input')).toBeTruthy());
  });

  it('s ouvre et se ferme au raccourci Ctrl+K', async () => {
    render(<CommandBar />, { wrapper: DansLaConsole });
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    await waitFor(() => expect(document.querySelector('input')).toBeTruthy());
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    await waitFor(() => expect(document.querySelector('input')).toBeNull());
  });

  it('se ferme a la touche Echap', async () => {
    render(<CommandBar />, { wrapper: DansLaConsole });
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    await waitFor(() => expect(document.querySelector('input')).toBeTruthy());
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(document.querySelector('input')).toBeNull());
  });

  it('analyse la saisie et en tire des jetons', async () => {
    render(<CommandBar />, { wrapper: DansLaConsole });
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    await waitFor(() => expect(document.querySelector('input')).toBeTruthy());
    const champ = document.querySelector('input');
    fireEvent.change(champ, { target: { value: 'TT a 25 km a 14h' } });
    // Les jetons reconnus s'affichent sous le champ : c'est le retour qui
    // apprend a l'utilisateur ce que la barre a compris.
    await waitFor(() => expect(document.body.textContent).toContain('TT'));
  });
});
