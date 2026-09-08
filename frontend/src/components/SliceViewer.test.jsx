import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import SliceViewer from './SliceViewer';
import StatsBar from './StatsBar';
import { renderSimple, installApiFixtures, installCanvas2D, installGeometrie } from '../test/harness';
import { resetPlotly, lastCall, callsOf } from '../test/plotlyStub';
import { SLICE, WIND, LATS, LONS } from '../test/fixtures';
import i18n from '../i18n';

/**
 * On verifie ce que le composant DEMANDE a Plotly, pas ce que Plotly dessine :
 * le type de trace, les axes, l'echelle, les gardes defensives, et la purge au
 * demontage. C'est la partie qui appartient a ce depot.
 */
let desinstallerCanvas;
let desinstallerGeo;

beforeEach(() => {
  resetPlotly();
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
});

afterEach(() => { desinstallerCanvas(); desinstallerGeo(); });

describe('SliceViewer — trace', () => {
  it('trace une heatmap avec les axes geographiques dans le bon sens', () => {
    renderSimple(<SliceViewer sliceData={SLICE} variableCode="TT" datasetLabel="MY35" />);
    const appel = lastCall('newPlot');
    expect(appel.traces[0].type).toBe('heatmap');
    // x = longitudes, y = latitudes : intervertir les deux transpose la carte
    // sans qu aucune erreur ne soit levee.
    expect(appel.traces[0].x).toEqual(LONS);
    expect(appel.traces[0].y).toEqual(LATS);
    expect(appel.traces[0].z).toEqual(SLICE.data);
  });

  it('utilise newPlot a la creation puis react aux mises a jour', () => {
    // Plotly.newPlot detruit et reconstruit le graphe : l appeler a chaque
    // changement de prop fait clignoter la carte et perd le zoom en cours.
    const { rerender } = renderSimple(<SliceViewer sliceData={SLICE} variableCode="TT" />);
    expect(callsOf('newPlot')).toHaveLength(1);
    rerender(<SliceViewer sliceData={{ ...SLICE, timeIndex: 30 }} variableCode="TT" />);
    expect(callsOf('newPlot')).toHaveLength(1);
    expect(callsOf('react').length).toBeGreaterThanOrEqual(1);
  });

  it('purge Plotly au demontage', () => {
    // Sans purge, chaque navigation laisse un graphe et ses ecouteurs en memoire.
    const { unmount } = renderSimple(<SliceViewer sliceData={SLICE} variableCode="TT" />);
    unmount();
    expect(callsOf('purge')).toHaveLength(1);
  });

  it('ne trace RIEN sur une reponse partielle', () => {
    // Course montage/donnees : `z: undefined` ferait tomber toute la page dans
    // l ErrorBoundary au lieu de ne rien afficher.
    renderSimple(<SliceViewer sliceData={{ dataset: 'x', latitudes: LATS }} variableCode="TT" />);
    expect(callsOf('newPlot')).toHaveLength(0);
    expect(callsOf('react')).toHaveLength(0);
  });

  it('n affiche rien du tout sans donnees', () => {
    renderSimple(<SliceViewer sliceData={null} variableCode="TT" />);
    expect(callsOf('newPlot')).toHaveLength(0);
  });

  it('applique la palette demandee, et sinon la palette automatique', () => {
    renderSimple(<SliceViewer sliceData={SLICE} variableCode="TT" colorscaleName="Cividis" />);
    expect(lastCall('newPlot').traces[0].colorscale).toBe('Cividis');
    resetPlotly();
    // TT est une temperature absolue : palette SEQUENTIELLE (stops explicites).
    renderSimple(<SliceViewer sliceData={SLICE} variableCode="TT" />);
    expect(Array.isArray(lastCall('newPlot').traces[0].colorscale)).toBe(true);
  });

  it('respecte des bornes de couleur imposees', () => {
    renderSimple(<SliceViewer sliceData={SLICE} variableCode="TT" customZMin={150} customZMax={300} />);
    expect(lastCall('newPlot').traces[0]).toMatchObject({ zmin: 150, zmax: 300 });
  });

  it('passe en log10 et borne l echelle sur des decades entieres', () => {
    const data = LATS.map((_, i) => LONS.map((_, j) => 10 ** (i - 2) * (j + 1)));
    const stats = { min: 0.01, max: 600, mean: 1, stddev: 1 };
    renderSimple(<SliceViewer sliceData={{ ...SLICE, data, stats }} variableCode="H2O" logScale />);
    const tr = lastCall('newPlot').traces[0];
    expect(tr.zmin).toBe(-2);
    expect(tr.zmax).toBe(3);
    // Les valeurs ORIGINALES restent disponibles pour l infobulle.
    expect(tr.customdata).toEqual(data);
  });

  it('ne passe pas en log quand aucune valeur n est positive', () => {
    const data = LATS.map(() => LONS.map(() => -5));
    renderSimple(<SliceViewer sliceData={{ ...SLICE, data }} variableCode="TT" logScale />);
    const tr = lastCall('newPlot').traces[0];
    // log10 d un nombre negatif n existe pas : on retombe sur l echelle lineaire.
    expect(tr.z).toEqual(data);
  });

  it('elargit l echelle log quand min et max tombent sur la meme decade', () => {
    // Champ quasi constant : floor(log10(100)) = ceil(log10(100)) = 2, donc
    // zmin = zmax et la colorbar serait degeneree (une seule couleur).
    const data = LATS.map(() => LONS.map(() => 100));
    const stats = { min: 100, max: 100, mean: 100, stddev: 0 };
    renderSimple(<SliceViewer sliceData={{ ...SLICE, data, stats }} variableCode="H2O" logScale />);
    const tr = lastCall('newPlot').traces[0];
    expect(tr.zmin).toBe(1);
    expect(tr.zmax).toBe(3);
  });

  it('sur-echantillonne a la demande et marque les points crees', () => {
    renderSimple(<SliceViewer sliceData={SLICE} variableCode="TT" interpStep={30} />);
    const tr = lastCall('newPlot').traces[0];
    expect(tr.x.length).toBeGreaterThan(LONS.length);
    expect(tr.text).toBeTruthy();
    expect(tr.hovertemplate).toContain('%{text}');
  });

  it('masque la colorbar en mode compact (la cellule a la sienne)', () => {
    renderSimple(<SliceViewer sliceData={SLICE} variableCode="TT" compact />);
    expect(lastCall('newPlot').traces[0].showscale).toBe(false);
    resetPlotly();
    renderSimple(<SliceViewer sliceData={SLICE} variableCode="TT" />);
    expect(lastCall('newPlot').traces[0].showscale).toBe(true);
  });

  it('desactive le lissage a la demande', () => {
    renderSimple(<SliceViewer sliceData={SLICE} variableCode="TT" smooth={false} />);
    expect(lastCall('newPlot').traces[0].zsmooth).toBe(false);
  });

  it('ajoute une trace de lieux martiens a la demande', () => {
    renderSimple(<SliceViewer sliceData={SLICE} variableCode="TT" showLocations />);
    expect(lastCall('newPlot').traces.length).toBeGreaterThan(1);
  });

  it('superpose les vecteurs de vent quand un champ est fourni', () => {
    renderSimple(<SliceViewer sliceData={SLICE} variableCode="TT" windData={WIND} />);
    const traces = lastCall('newPlot').traces;
    expect(traces.some((tr) => tr.type === 'scatter' || tr.mode?.includes('lines'))).toBe(true);
  });

  it('affiche une legende de vitesse avec les particules', () => {
    renderSimple(
      <SliceViewer sliceData={SLICE} variableCode="TT" windData={WIND} windParticles />,
    );
    // La legende porte les seules valeurs chiffrees du champ : elle reste
    // visible meme en mode compact.
    expect(document.body.textContent).toMatch(/m\/s/);
  });

  it('rend une region ARIA decrivant la figure', () => {
    renderSimple(<SliceViewer sliceData={SLICE} variableCode="TT" />);
    expect(screen.getByRole('img')).toBeTruthy();
  });

  it('accepte un titre impose', () => {
    renderSimple(<SliceViewer sliceData={SLICE} variableCode="TT" titleText="Mon titre" />);
    expect(lastCall('newPlot').layout.title.text).toBe('Mon titre');
  });

  it('garde le code brut d une variable hors catalogue', () => {
    renderSimple(<SliceViewer sliceData={SLICE} variableCode="INCONNU" />);
    expect(JSON.stringify(lastCall('newPlot').layout)).toContain('INCONNU');
  });
});

describe('StatsBar', () => {
  it('n affiche rien sans statistiques', () => {
    const { container } = renderSimple(<StatsBar stats={null} />);
    expect(container.querySelector('.stats-bar')).toBeNull();
  });

  it('affiche min, max, moyenne et ecart-type', () => {
    renderSimple(<StatsBar stats={{ min: 1, max: 2, mean: 1.5, stddev: 0.5 }} />);
    const txt = document.body.textContent.replace(/,/g, '.');
    for (const v of ['1', '2', '1.5', '0.5']) expect(txt).toContain(v);
  });

  it('formate les nombres dans la langue courante', async () => {
    // Le separateur decimal suit la langue de l interface : c est la raison
    // d etre du `toLocaleString(i18n.language)`, et la difference se voit.
    await i18n.changeLanguage('fr');
    const { unmount } = renderSimple(<StatsBar stats={{ min: 1.5, max: 2, mean: 1.5, stddev: 0.5 }} />);
    expect(document.body.textContent).toContain('1,5');
    unmount();
    await i18n.changeLanguage('en');
    renderSimple(<StatsBar stats={{ min: 1.5, max: 2, mean: 1.5, stddev: 0.5 }} />);
    expect(document.body.textContent).toContain('1.5');
  });

  it('n affiche la mediane que lorsqu elle existe', () => {
    const { container, unmount } = renderSimple(<StatsBar stats={{ min: 1, max: 2, mean: 1.5, stddev: 0.5 }} />);
    const sansMediane = container.querySelectorAll('.stats-bar > *').length;
    unmount();
    const { container: c2 } = renderSimple(<StatsBar stats={{ min: 1, max: 2, mean: 1.5, stddev: 0.5, median: 1.4 }} />);
    expect(c2.querySelectorAll('.stats-bar > *').length).toBe(sansMediane + 1);
  });

  it('passe en notation scientifique sur les valeurs extremes', () => {
    // Un rapport de melange vaut 1e-8 : « 0,00000001 » serait illisible, et
    // « 42 290 000 000 » l est tout autant.
    renderSimple(<StatsBar stats={{ min: 1e-8, max: 4.2e10, mean: 1, stddev: 0 }} />);
    const sup = document.querySelectorAll('sup');
    expect(sup.length).toBeGreaterThanOrEqual(2);
    expect([...sup].map((e) => e.textContent)).toContain('-8');
  });

  it('affiche zero comme zero, pas en notation scientifique', () => {
    // 0 est plus petit que 1e-3 : sans son cas special il deviendrait 0×10⁰.
    renderSimple(<StatsBar stats={{ min: 0, max: 1, mean: 0.5, stddev: 0 }} />);
    expect(document.querySelectorAll('sup')).toHaveLength(0);
  });

  it('affiche un tiret pour une statistique absente', () => {
    renderSimple(<StatsBar stats={{ min: 1, max: 2, mean: null, stddev: null }} />);
    expect(document.body.textContent).toContain('-');
  });
});
