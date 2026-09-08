import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import CrossSectionViewer from './CrossSectionViewer';
import HovmollerViewer from './HovmollerViewer';
import ZonalMeanViewer from './ZonalMeanViewer';
import DifferenceViewer from './DifferenceViewer';
import TransectViewer from './TransectViewer';
import SliceViewer from './SliceViewer';
import LanguageSwitcher from './LanguageSwitcher';
import DatasetSelector from './DatasetSelector';
import HistoryDialog from './HistoryDialog';
import i18n from '../i18n';
import {
  renderSimple, installApiFixtures, installCanvas2D, installGeometrie,
} from '../test/harness';
import { resetPlotly, callsOf, lastCall } from '../test/plotlyStub';
import {
  CROSSSECTION, HOVMOLLER, ZONALMEAN, DIFFERENCE, TRANSECT, SLICE, CATALOGUE, LATS, ALTS,
} from '../test/fixtures';

/**
 * Les OPTIONS communes aux afficheurs de champs 2D : mode compact (cellule de
 * grille), echelle logarithmique, bornes imposees, palette. Elles se declarent
 * afficheur par afficheur, ce qui est exactement le genre d'endroit ou une
 * option se perd sur l'un des sept.
 */
let desinstallerCanvas;
let desinstallerGeo;

beforeEach(async () => {
  resetPlotly();
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  await i18n.changeLanguage('fr');
});

afterEach(() => { desinstallerCanvas(); desinstallerGeo(); vi.restoreAllMocks(); });

/** Grille positive, exploitable en log. */
const positif = (nl, nc) => Array.from({ length: nl }, (_, i) =>
  Array.from({ length: nc }, (_, j) => 10 ** (i - 2) * (j + 1)));

/** [nom, fabrique(props supplementaires)] pour les afficheurs a heatmap. */
const HEATMAPS = [
  ['CrossSectionViewer', (p) => <CrossSectionViewer crossSectionData={CROSSSECTION} variableCode="TT" {...p} />,
    { ...CROSSSECTION, data: positif(ALTS.length, LATS.length), stats: { min: 0.01, max: 600, mean: 1, stddev: 1 } }],
  ['HovmollerViewer', (p) => <HovmollerViewer hovmollerData={HOVMOLLER} variableCode="TT" {...p} />,
    { ...HOVMOLLER, data: positif(HOVMOLLER.times.length, LATS.length), stats: { min: 0.01, max: 600, mean: 1, stddev: 1 } }],
  ['ZonalMeanViewer', (p) => <ZonalMeanViewer zonalMeanData={ZONALMEAN} variableCode="TT" {...p} />,
    { ...ZONALMEAN, data: positif(ALTS.length, LATS.length), stats: { min: 0.01, max: 600, mean: 1, stddev: 1 } }],
  ['TransectViewer', (p) => <TransectViewer transectData={TRANSECT} variableCode="TT" {...p} />,
    { ...TRANSECT, data: positif(ALTS.length, 5), stats: { min: 0.01, max: 600, mean: 1, stddev: 1 } }],
];

describe.each(HEATMAPS)('%s — options', (nom, fabrique) => {
  it('en mode compact, ni titre ni titres d axes', () => {
    renderSimple(fabrique({ compact: true }));
    const layout = lastCall('newPlot').layout;
    expect(layout.title, nom).toBeUndefined();
    expect(layout.xaxis.title ?? undefined, nom).toBeUndefined();
  });

  it('applique la palette demandee et son sens', () => {
    renderSimple(fabrique({ colorscaleName: 'Cividis', reverseColorscale: true }));
    const tr = lastCall('newPlot').traces[0];
    expect(tr.colorscale, nom).toBe('Cividis');
    expect(tr.reversescale, nom).toBe(true);
  });

  it('respecte des bornes de couleur imposees', () => {
    renderSimple(fabrique({ customZMin: 150, customZMax: 300 }));
    expect(lastCall('newPlot').traces[0], nom).toMatchObject({ zmin: 150, zmax: 300 });
  });
});

describe('echelle logarithmique par afficheur', () => {
  it.each(HEATMAPS)('%s borne sur des decades entieres', (nom, fabrique, donneesLog) => {
    const props = { logScale: true };
    // Chaque afficheur porte sa donnee sous un nom different : on remplace la
    // fixture par une grille strictement positive.
    const el = fabrique(props);
    const nomProp = Object.keys(el.props).find((k) => /Data$/.test(k));
    renderSimple({ ...el, props: { ...el.props, [nomProp]: donneesLog } });
    const tr = lastCall('newPlot').traces[0];
    expect(tr.zmin, nom).toBe(-2);
    expect(tr.zmax, nom).toBe(3);
  });
});

describe('DifferenceViewer — options', () => {
  it('en compact, masque sa colorbar', () => {
    renderSimple(<DifferenceViewer differenceData={DIFFERENCE} variableCode="TT" compact />);
    expect(lastCall('newPlot').traces[0].showscale).toBe(false);
  });

  it('ajoute les lieux et le relief a la demande', () => {
    renderSimple(
      <DifferenceViewer differenceData={DIFFERENCE} variableCode="TT" showLocations showSurface />,
    );
    expect(lastCall('newPlot').traces.length).toBeGreaterThan(1);
  });

  it('sur-echantillonne comme une coupe', () => {
    renderSimple(<DifferenceViewer differenceData={DIFFERENCE} variableCode="TT" interpStep={30} />);
    expect(lastCall('newPlot').traces[0].text).toBeTruthy();
  });

  it('nomme les DEUX jeux compares', () => {
    renderSimple(
      <DifferenceViewer differenceData={DIFFERENCE} variableCode="TT"
        datasetLabelA="MY35 Ls 0-30" datasetLabelB="MY35 Ls 30-60" />,
    );
    const titre = JSON.stringify(lastCall('newPlot').layout);
    // Une carte de difference sans ses deux termes ne veut rien dire.
    expect(titre).toContain('0-30');
    expect(titre).toContain('30-60');
  });
});

describe('SliceViewer — reste des options', () => {
  it('superpose le relief en attenuant la carte', () => {
    renderSimple(<SliceViewer sliceData={SLICE} variableCode="TT" showSurface
      topoData={{ data: SLICE.data, latitudes: SLICE.latitudes, longitudes: SLICE.longitudes }} />);
    const tr = lastCall('newPlot').traces[0];
    // La carte passe en semi-transparent pour laisser lire le relief dessous.
    expect(tr.opacity).toBeLessThan(1);
  });

  it('accepte un ref de trace fourni par la page', () => {
    const externe = { current: null };
    renderSimple(<SliceViewer sliceData={SLICE} variableCode="TT" externalPlotRef={externe} />);
    expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1);
  });

  it('masque son menu d export a la demande', () => {
    const { container } = renderSimple(
      <SliceViewer sliceData={SLICE} variableCode="TT" noExportMenu />,
    );
    expect([...container.querySelectorAll('button')]
      .some((b) => new RegExp(i18n.t('export.button'), 'i').test(b.textContent))).toBe(false);
  });
});

describe('LanguageSwitcher', () => {
  it('propose les cinq langues et change celle de l interface', async () => {
    // Hors mode icone, c'est un Select MUI : son declencheur porte le role
    // « combobox », pas « button ».
    renderSimple(<LanguageSwitcher />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(5);
    fireEvent.click(options.find((o) => o.getAttribute('data-value') === 'nl'));
    expect(i18n.language.split('-')[0]).toBe('nl');
    await i18n.changeLanguage('fr');
  });

  it('en mode icone, ouvre un menu de cinq langues', async () => {
    renderSimple(<LanguageSwitcher iconOnly />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('nav.language') }));
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(5);
    fireEvent.click(items.find((o) => /^DE$/i.test(o.textContent.trim())));
    expect(i18n.language.split('-')[0]).toBe('de');
    await i18n.changeLanguage('fr');
  });

  it('en mode icone, garde un nom accessible', () => {
    renderSimple(<LanguageSwitcher iconOnly />);
    const bouton = screen.getAllByRole('button')[0];
    expect(bouton.getAttribute('aria-label') || bouton.textContent).toBeTruthy();
  });
});

describe('DatasetSelector', () => {
  it('liste les jeux du catalogue avec un libelle lisible', () => {
    const { container } = renderSimple(
      <DatasetSelector datasets={CATALOGUE} value={CATALOGUE[0].id} onChange={vi.fn()} />,
    );
    // « mean_MY35_Ls0_30 » est un nom de fichier ; l'utilisateur doit lire une
    // annee martienne et une plage de Ls. Le libelle vit dans le champ.
    const champ = container.querySelector('input');
    expect(champ.value).toContain('35');
    expect(champ.value).not.toContain('mean_');
  });

  it('remonte le choix de l utilisateur', () => {
    const onChange = vi.fn();
    const { container } = renderSimple(
      <DatasetSelector datasets={CATALOGUE} value={CATALOGUE[0].id} onChange={onChange} />,
    );
    const champ = container.querySelector('input');
    fireEvent.mouseDown(champ);
    fireEvent.keyDown(champ, { key: 'ArrowDown' });
    fireEvent.keyDown(champ, { key: 'Enter' });
    expect(onChange).toHaveBeenCalled();
  });

  it('se desactive a la demande', () => {
    const { container } = renderSimple(
      <DatasetSelector datasets={CATALOGUE} value={CATALOGUE[0].id} onChange={vi.fn()} disabled />,
    );
    expect(container.querySelector('input').disabled).toBe(true);
  });
});

describe('HistoryDialog', () => {
  it('ne s affiche que lorsqu il est ouvert', () => {
    const { container } = renderSimple(
      <HistoryDialog open={false} onClose={vi.fn()} history={[]} onClear={vi.fn()} />,
    );
    expect(container.textContent).toBe('');
  });

  it('annonce un historique vide plutot qu une liste blanche', () => {
    renderSimple(<HistoryDialog open onClose={vi.fn()} history={[]} onClear={vi.fn()} />);
    expect(screen.getByRole('dialog').textContent.length).toBeGreaterThan(0);
  });
});
