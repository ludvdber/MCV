import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import ProfileViewer from './ProfileViewer';
import CrossSectionViewer from './CrossSectionViewer';
import HovmollerViewer from './HovmollerViewer';
import ZonalMeanViewer from './ZonalMeanViewer';
import TemporalProfileViewer from './TemporalProfileViewer';
import WindRoseViewer from './WindRoseViewer';
import TidesViewer from './TidesViewer';
import TransectViewer from './TransectViewer';
import DifferenceViewer from './DifferenceViewer';
import TimeSeriesChart from './TimeSeriesChart';
import { renderSimple, installApiFixtures, installCanvas2D, installGeometrie } from '../test/harness';
import { resetPlotly, lastCall, callsOf } from '../test/plotlyStub';
import {
  PROFILE, CROSSSECTION, HOVMOLLER, ZONALMEAN, TEMPORALPROFILE,
  WINDROSE, TIDES, TRANSECT, DIFFERENCE, TIMESERIES, ALTS, LATS, TIMES,
} from '../test/fixtures';

/**
 * Les neuf afficheurs restants. Trois proprietes valent pour tous et sont
 * verifiees pour chacun : ne RIEN tracer sur une reponse partielle (sinon la
 * page entiere tombe dans l'ErrorBoundary), purger Plotly au demontage, et
 * porter une description ARIA — une figure sans texte alternatif n'existe pas
 * pour un lecteur d'ecran.
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

/** [nom, element complet, element aux donnees partielles] */
const AFFICHEURS = [
  ['ProfileViewer',
    <ProfileViewer profiles={[PROFILE]} variableCode="TT" datasetLabel="MY35" />,
    <ProfileViewer profiles={[{ dataset: 'x' }]} variableCode="TT" />],
  ['CrossSectionViewer',
    <CrossSectionViewer crossSectionData={CROSSSECTION} variableCode="TT" datasetLabel="MY35" />,
    <CrossSectionViewer crossSectionData={{ dataset: 'x' }} variableCode="TT" />],
  ['HovmollerViewer',
    <HovmollerViewer hovmollerData={HOVMOLLER} variableCode="TT" datasetLabel="MY35" />,
    <HovmollerViewer hovmollerData={{ dataset: 'x' }} variableCode="TT" />],
  ['ZonalMeanViewer',
    <ZonalMeanViewer zonalMeanData={ZONALMEAN} variableCode="TT" datasetLabel="MY35" />,
    <ZonalMeanViewer zonalMeanData={{ dataset: 'x' }} variableCode="TT" />],
  ['TemporalProfileViewer',
    <TemporalProfileViewer profileData={TEMPORALPROFILE} variableCode="TT" datasetLabel="MY35" />,
    <TemporalProfileViewer profileData={{ dataset: 'x' }} variableCode="TT" />],
  ['WindRoseViewer',
    <WindRoseViewer windRoseData={WINDROSE} datasetLabel="MY35" />,
    <WindRoseViewer windRoseData={{ dataset: 'x' }} />],
  ['TidesViewer',
    <TidesViewer tidesData={TIDES} variableCode="TT" datasetLabel="MY35" />,
    <TidesViewer tidesData={{ dataset: 'x' }} variableCode="TT" />],
  ['TransectViewer',
    <TransectViewer transectData={TRANSECT} variableCode="TT" datasetLabel="MY35" />,
    <TransectViewer transectData={{ dataset: 'x' }} variableCode="TT" />],
  ['DifferenceViewer',
    <DifferenceViewer differenceData={DIFFERENCE} variableCode="TT" datasetLabelA="A" datasetLabelB="B" />,
    <DifferenceViewer differenceData={{ datasetA: 'x' }} variableCode="TT" />],
  ['TimeSeriesChart',
    <TimeSeriesChart series={TIMESERIES} variableCode="TT" datasetLabel="MY35" />,
    <TimeSeriesChart series={null} variableCode="TT" />],
];

describe('proprietes communes a tous les afficheurs', () => {
  it.each(AFFICHEURS)('%s trace quelque chose sur des donnees completes', (nom, complet) => {
    renderSimple(complet);
    expect(callsOf('newPlot').length, nom).toBeGreaterThanOrEqual(1);
  });

  it.each(AFFICHEURS)('%s ne trace RIEN sur une reponse partielle', (nom, _complet, partiel) => {
    renderSimple(partiel);
    expect(callsOf('newPlot').length, nom).toBe(0);
    expect(callsOf('react').length, nom).toBe(0);
  });

  it.each(AFFICHEURS)('%s purge Plotly au demontage', (nom, complet) => {
    const { unmount } = renderSimple(complet);
    unmount();
    expect(callsOf('purge').length, nom).toBeGreaterThanOrEqual(1);
  });

  it.each(AFFICHEURS)('%s decrit sa figure pour un lecteur d ecran', (nom, complet) => {
    renderSimple(complet);
    const figures = screen.getAllByRole('img');
    expect(figures.length, nom).toBeGreaterThanOrEqual(1);
    for (const f of figures) expect(f.getAttribute('aria-label'), nom).toBeTruthy();
  });
});

describe('ProfileViewer', () => {
  it('met l ALTITUDE en ordonnee — c est un profil vertical', () => {
    renderSimple(<ProfileViewer profiles={[PROFILE]} variableCode="TT" />);
    const tr = lastCall('newPlot').traces[0];
    expect(tr.y).toEqual(ALTS);
    expect(tr.x).toEqual(PROFILE.values);
  });

  it('superpose plusieurs points compares', () => {
    const deux = [PROFILE, { ...PROFILE, latitude: 20, values: [1, 2, 3, 4, 5] }];
    renderSimple(<ProfileViewer profiles={deux} variableCode="TT" />);
    expect(lastCall('newPlot').traces).toHaveLength(2);
  });

  it('affiche une legende des qu il y a plus d une courbe', () => {
    renderSimple(<ProfileViewer profiles={[PROFILE]} variableCode="TT" />);
    expect(lastCall('newPlot').traces[0].showlegend).toBe(false);
    resetPlotly();
    renderSimple(<ProfileViewer profiles={[PROFILE, PROFILE]} variableCode="TT" />);
    expect(lastCall('newPlot').traces[0].showlegend).toBe(true);
  });

  it('affiche un message quand la liste est vide', () => {
    renderSimple(<ProfileViewer profiles={[]} variableCode="TT" />);
    expect(callsOf('newPlot')).toHaveLength(0);
    expect(document.body.textContent.trim().length).toBeGreaterThan(0);
  });
});

describe('CrossSectionViewer', () => {
  it('met l altitude en ordonnee et la coordonnee horizontale en abscisse', () => {
    renderSimple(<CrossSectionViewer crossSectionData={CROSSSECTION} variableCode="TT" />);
    const tr = lastCall('newPlot').traces[0];
    expect(tr.y).toEqual(ALTS);
    expect(tr.x).toEqual(LATS);
  });

  it('nomme l axe horizontal d apres la direction de la coupe', () => {
    renderSimple(<CrossSectionViewer crossSectionData={CROSSSECTION} variableCode="TT" />);
    const meridional = JSON.stringify(lastCall('newPlot').layout);
    resetPlotly();
    renderSimple(<CrossSectionViewer
      crossSectionData={{ ...CROSSSECTION, type: 'zonal' }} variableCode="TT" />);
    // Une coupe zonale parcourt les longitudes, une meridionale les latitudes :
    // le meme libelle pour les deux tromperait sur ce qui est trace.
    expect(JSON.stringify(lastCall('newPlot').layout)).not.toBe(meridional);
  });
});

describe('HovmollerViewer', () => {
  it('met le TEMPS en ordonnee', () => {
    renderSimple(<HovmollerViewer hovmollerData={HOVMOLLER} variableCode="TT" />);
    const tr = lastCall('newPlot').traces[0];
    expect(tr.y).toEqual(TIMES);
    expect(tr.x).toEqual(LATS);
  });
});

describe('ZonalMeanViewer', () => {
  it('trace latitude en abscisse et altitude en ordonnee', () => {
    renderSimple(<ZonalMeanViewer zonalMeanData={ZONALMEAN} variableCode="TT" />);
    const tr = lastCall('newPlot').traces[0];
    expect(tr.x).toEqual(LATS);
    expect(tr.y).toEqual(ALTS);
  });
});

describe('WindRoseViewer', () => {
  it('trace des secteurs polaires', () => {
    renderSimple(<WindRoseViewer windRoseData={WINDROSE} />);
    const traces = lastCall('newPlot').traces;
    expect(traces.every((tr) => tr.type === 'barpolar')).toBe(true);
    // 16 secteurs de direction : les rayons de chaque classe de vitesse.
    expect(traces[0].r).toHaveLength(16);
  });

  it('la somme de tous les secteurs fait 100 % des pas de temps', () => {
    renderSimple(<WindRoseViewer windRoseData={WINDROSE} />);
    const total = lastCall('newPlot').traces
      .flatMap((tr) => tr.r)
      .reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(100, 6);
  });

  it('annonce le point REELLEMENT lu, pas celui demande', () => {
    // La reponse porte latitude -38 (demande) et actualLat -40 (noeud lu).
    renderSimple(<WindRoseViewer windRoseData={WINDROSE} datasetLabel="MY35" />);
    const layout = JSON.stringify(lastCall('newPlot').layout);
    expect(layout).toContain('-40');
  });
});

describe('TidesViewer', () => {
  it('trace amplitude ET phase cote a cote', () => {
    renderSimple(<TidesViewer tidesData={TIDES} variableCode="TT" />);
    expect(callsOf('newPlot').length).toBe(2);
  });

  it('la phase est bornee a la periode du mode', () => {
    renderSimple(<TidesViewer tidesData={TIDES} variableCode="TT" />);
    // Mode diurne : la phase est une heure locale, dans [0, 24[.
    const phase = callsOf('newPlot').map((c) => c.traces[0]).find((tr) => tr.zmax === 24 || tr.zmax === 12);
    expect(phase).toBeTruthy();
    expect(phase.zmin).toBe(0);
  });

  it('bascule entre mode diurne et semi-diurne', () => {
    renderSimple(<TidesViewer tidesData={TIDES} variableCode="TT" />);
    const avant = callsOf('newPlot').length + callsOf('react').length;
    fireEvent.click(screen.getByRole('button', { name: /semi/i }));
    expect(callsOf('newPlot').length + callsOf('react').length).toBeGreaterThan(avant);
  });
});

describe('TransectViewer', () => {
  it('met la distance en abscisse et l altitude en ordonnee', () => {
    renderSimple(<TransectViewer transectData={TRANSECT} variableCode="TT" />);
    const tr = lastCall('newPlot').traces[0];
    expect(tr.y).toEqual(ALTS);
    expect(tr.x).toEqual(TRANSECT.distances);
  });
});

describe('DifferenceViewer', () => {
  it('centre la palette divergente sur zero', () => {
    // Une difference A-B a un zero qui SIGNIFIE quelque chose : si la couleur
    // neutre ne tombe pas dessus, la ligne de changement de signe disparait.
    renderSimple(<DifferenceViewer differenceData={DIFFERENCE} variableCode="TT" />);
    const tr = lastCall('newPlot').traces[0];
    expect(tr.zmin).toBeCloseTo(-tr.zmax, 10);
  });

  it('respecte des bornes imposees plutot que la symetrie automatique', () => {
    renderSimple(<DifferenceViewer differenceData={DIFFERENCE} variableCode="TT"
      customZMin={-3} customZMax={12} />);
    expect(lastCall('newPlot').traces[0]).toMatchObject({ zmin: -3, zmax: 12 });
  });
});

describe('TimeSeriesChart', () => {
  it('trace les 48 pas de temps en heures locales', () => {
    renderSimple(<TimeSeriesChart series={TIMESERIES} variableCode="TT" />);
    const tr = lastCall('newPlot').traces[0];
    expect(tr.y).toEqual(TIMESERIES.values);
    expect(tr.x[0]).toBe('00:00');
    expect(tr.x[tr.x.length - 1]).toBe('23:30');
  });

  it('titre la courbe avec le point REELLEMENT lu', () => {
    // La reponse demande (-38, 30) et lit (-40, 60) : afficher la demande
    // etiquetterait la courbe d une coordonnee qui n a pas produit ces valeurs.
    renderSimple(<TimeSeriesChart series={TIMESERIES} variableCode="TT" datasetLabel="MY35" />);
    const titre = lastCall('newPlot').layout.title.text;
    expect(titre).toContain('-40');
    expect(titre).toContain('60');
    expect(titre).not.toContain('-38');
  });

  it('retombe sur la coordonnee demandee si la reponse ne porte pas le noeud lu', () => {
    // Reponse mise en cache avant que l API ne porte actualLat/actualLon.
    const ancienne = { ...TIMESERIES, actualLat: undefined, actualLon: undefined };
    renderSimple(<TimeSeriesChart series={ancienne} variableCode="TT" datasetLabel="MY35" />);
    expect(lastCall('newPlot').layout.title.text).toContain('-38');
  });

  it('accepte plusieurs series et les nomme chacune par son point', () => {
    const deux = [TIMESERIES, { ...TIMESERIES, actualLat: 20, actualLon: -60 }];
    renderSimple(<TimeSeriesChart series={deux} variableCode="TT" />);
    const traces = lastCall('newPlot').traces;
    expect(traces).toHaveLength(2);
    expect(traces[0].name).not.toBe(traces[1].name);
    expect(traces[0].showlegend).toBe(true);
  });

  it('accepte l ancienne prop timeSeriesData', () => {
    renderSimple(<TimeSeriesChart timeSeriesData={TIMESERIES} variableCode="TT" />);
    expect(callsOf('newPlot')).toHaveLength(1);
  });

  it('n affiche qu un tick sur trois heures, pour ne pas les chevaucher', () => {
    renderSimple(<TimeSeriesChart series={TIMESERIES} variableCode="TT" />);
    expect(lastCall('newPlot').layout.xaxis.tickvals).toHaveLength(8);
    resetPlotly();
    renderSimple(<TimeSeriesChart series={TIMESERIES} variableCode="TT" compact />);
    expect(lastCall('newPlot').layout.xaxis.tickvals).toHaveLength(4);
  });

  it('en mode compact, ni titre ni annotation', () => {
    renderSimple(<TimeSeriesChart series={TIMESERIES} variableCode="TT" compact />);
    const layout = lastCall('newPlot').layout;
    expect(layout.title).toBeUndefined();
    expect(layout.annotations).toEqual([]);
  });
});
