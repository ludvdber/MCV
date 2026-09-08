import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import CurtainCompare from './CurtainCompare';
import { ExploreProvider } from './ExploreContext.jsx';
import { AppThemeProvider } from '../../context/ThemeContext';
import { ToastProvider } from '../../context/ToastContext';
import { MarsProvider } from '../../context/MarsContext';
import i18n from '../../i18n';
import {
  installApiFixtures, installCanvas2D, installGeometrie,
} from '../../test/harness';
import { resetPlotly, callsOf } from '../../test/plotlyStub';
import { SLICE } from '../../test/fixtures';

/**
 * Le rideau A/B : deux coupes superposees, la seconde decoupee a droite d'une
 * poignee glissante. Deux proprietes le rendent honnete — une ECHELLE DE
 * COULEUR COMMUNE (sinon la meme teinte ne dit pas la meme temperature d'un
 * volet a l'autre) et une poignee qui ne sort jamais du cadre.
 */
let desinstallerCanvas;
let desinstallerGeo;

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
  await i18n.changeLanguage('fr');
});

afterEach(() => { desinstallerCanvas(); desinstallerGeo(); vi.restoreAllMocks(); });

const volet = (id, min, max, label) => ({
  id, type: 'slice', label, datasetLabel: label,
  params: { variable: 'TT', time: 24, altitude: 49 },
  data: { ...SLICE, stats: { ...SLICE.stats, min, max } },
});

const rendreRideau = (props = {}) => render(
  <CurtainCompare
    resultA={volet('a', 180, 250, 'MY35 Ls 0-30')}
    resultB={volet('b', 200, 300, 'MY35 Ls 30-60')}
    {...props}
  />,
  { wrapper: DansLaConsole },
);

describe('rideau A/B', () => {
  it('trace les deux volets sur une echelle de couleur COMMUNE', () => {
    rendreRideau();
    const heatmaps = [...callsOf('newPlot'), ...callsOf('react')]
      .flatMap((c) => c.traces ?? [])
      .filter((tr) => tr.type === 'heatmap');
    expect(heatmaps.length).toBeGreaterThanOrEqual(2);
    for (const tr of heatmaps) {
      // Bornes = union des deux jeux : 180 et 300.
      expect(tr.zmin).toBe(180);
      expect(tr.zmax).toBe(300);
    }
  });

  it('nomme les deux volets', () => {
    rendreRideau();
    expect(document.body.textContent).toContain('MY35 Ls 0-30');
    expect(document.body.textContent).toContain('MY35 Ls 30-60');
  });

  it('deplace la poignee au glisser', () => {
    rendreRideau();
    // La poignee EST un curseur accessible : sa position se lit dans
    // aria-valuenow, ce qui la rend observable autant par un test que par un
    // lecteur d'ecran.
    const poignee = screen.getByRole('slider', { name: i18n.t('explore.curtain.handle') });
    expect(Number(poignee.getAttribute('aria-valuenow'))).toBe(50);
    // `fireEvent` de testing-library plutot que notre helper : la poignee est
    // un composant REACT, et React n'ecoute pas les evenements poses a la main
    // sur l'element — il delegue depuis la racine.
    fireEvent.pointerDown(poignee, { clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(poignee, { clientX: 600, pointerId: 1 });
    fireEvent.pointerUp(poignee, { clientX: 600, pointerId: 1 });
    expect(Number(poignee.getAttribute('aria-valuenow'))).toBeGreaterThan(50);
  });

  it('borne la poignee au cadre : aucun volet ne disparait', () => {
    rendreRideau();
    const poignee = screen.getByRole('slider', { name: i18n.t('explore.curtain.handle') });
    fireEvent.pointerDown(poignee, { clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(poignee, { clientX: 100000, pointerId: 1 });
    fireEvent.pointerUp(poignee, { clientX: 100000, pointerId: 1 });
    expect(Number(poignee.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(96);

    fireEvent.pointerDown(poignee, { clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(poignee, { clientX: -100000, pointerId: 1 });
    fireEvent.pointerUp(poignee, { clientX: -100000, pointerId: 1 });
    expect(Number(poignee.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(4);
  });

  it('se pilote AUSSI au clavier', () => {
    rendreRideau();
    const poignee = screen.getByRole('slider', { name: i18n.t('explore.curtain.handle') });
    const depart = Number(poignee.getAttribute('aria-valuenow'));
    fireEvent.keyDown(poignee, { key: 'ArrowRight' });
    expect(Number(poignee.getAttribute('aria-valuenow'))).toBe(depart + 2);
    fireEvent.keyDown(poignee, { key: 'ArrowLeft' });
    fireEvent.keyDown(poignee, { key: 'ArrowLeft' });
    expect(Number(poignee.getAttribute('aria-valuenow'))).toBe(depart - 2);
    // Les bornes valent aussi au clavier.
    for (let i = 0; i < 60; i++) fireEvent.keyDown(poignee, { key: 'ArrowLeft' });
    expect(Number(poignee.getAttribute('aria-valuenow'))).toBe(4);
  });

  it('ignore un mouvement sans glisser en cours', () => {
    rendreRideau();
    const poignee = screen.getByRole('slider', { name: i18n.t('explore.curtain.handle') });
    const avant = poignee.getAttribute('aria-valuenow');
    fireEvent.pointerMove(poignee, { clientX: 700, pointerId: 1 });
    expect(poignee.getAttribute('aria-valuenow')).toBe(avant);
  });

  it('annonce ses bornes a un lecteur d ecran', () => {
    rendreRideau();
    const poignee = screen.getByRole('slider', { name: i18n.t('explore.curtain.handle') });
    expect(poignee.getAttribute('aria-valuemin')).toBe('4');
    expect(poignee.getAttribute('aria-valuemax')).toBe('96');
    expect(poignee.getAttribute('tabindex')).toBe('0');
  });

  it('n affiche PAS de menu d export sur ses volets', () => {
    const { container } = rendreRideau();
    // L'export d'un rideau n'aurait pas de sens : c'est une lecture, pas une
    // figure. Le menu vit au niveau du panneau.
    expect([...container.querySelectorAll('button')]
      .some((b) => new RegExp(i18n.t('export.button'), 'i').test(b.textContent))).toBe(false);
  });

  it('laisse Plotly choisir l echelle quand les statistiques manquent', () => {
    const sansStats = {
      ...volet('a', 0, 0, 'A'),
      data: { ...SLICE, stats: undefined },
    };
    render(
      <CurtainCompare resultA={sansStats} resultB={volet('b', 200, 300, 'B')} />,
      { wrapper: DansLaConsole },
    );
    const heatmaps = [...callsOf('newPlot'), ...callsOf('react')]
      .flatMap((c) => c.traces ?? [])
      .filter((tr) => tr.type === 'heatmap');
    // Pas de bornes inventees : mieux vaut deux echelles automatiques qu'une
    // echelle commune fausse.
    expect(heatmaps.every((tr) => tr.zmin == null)).toBe(true);
  });
});
