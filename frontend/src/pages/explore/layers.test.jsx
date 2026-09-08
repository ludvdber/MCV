import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import RoiLayer from './RoiLayer';
import TransectLayer from './TransectLayer';
import ProbeLayer from './ProbeLayer';
import RegionHistogram from './RegionHistogram';
import MiniColorbar from './MiniColorbar';
import { publishProbe, subscribeProbe } from './probeBus';
import {
  renderSimple, installCanvas2D, installGeometrie, installApiFixtures,
  faireHotePlotly, pointeur, dessins,
} from '../../test/harness';
import { SLICE } from '../../test/fixtures';

/**
 * Les couches interactives dessinent sur un canvas pose au-dessus du div
 * Plotly de leur cellule et convertissent des pixels en coordonnees via la
 * geometrie interne du graphe (`_fullLayout`). C'est cette conversion qui
 * porte le risque : une inversion d'axe ou un oubli de la marge donne une
 * region silencieusement decalee. On la verifie sur des points dont on connait
 * la reponse.
 *
 * Geometrie de reference : trace de 600x400 px a partir de (60, 40),
 * longitudes -180..180, latitudes -90..90. Le CENTRE du trace est donc
 * (360, 240) en pixels et (0, 0) en degres.
 */
const GEO = { l: 60, t: 40, w: 600, h: 400, xr: [-180, 180], yr: [-90, 90] };

let desinstallerCanvas;
let desinstallerGeo;

beforeEach(() => {
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  publishProbe(null);
  document.body.innerHTML = '';
});

/** Rend une couche accrochee a un hote Plotly factice et renvoie son canvas. */
function monter(fabrique, geo = GEO) {
  const { hostRef, host } = faireHotePlotly(geo);
  const rendu = renderSimple(fabrique(hostRef));
  const canvas = rendu.container.querySelector('canvas');
  return { ...rendu, hostRef, host, canvas };
}

describe('RoiLayer', () => {
  it('ne rend aucun canvas tant que le mode region est inactif', () => {
    const { canvas } = monter((hostRef) => (
      <RoiLayer hostRef={hostRef} enabled={false} onSelect={vi.fn()} onClear={vi.fn()} />
    ));
    expect(canvas).toBeNull();
  });

  it('convertit un glisser en bornes lat/lon exactes', () => {
    const onSelect = vi.fn();
    const { canvas } = monter((hostRef) => (
      <RoiLayer hostRef={hostRef} enabled onSelect={onSelect} onClear={vi.fn()} />
    ));
    // Du centre (360, 240) vers (510, 340) : un quart de la largeur vers l'est,
    // un quart de la hauteur vers le sud.
    pointeur(canvas, 'pointerdown', 360, 240);
    pointeur(canvas, 'pointermove', 510, 340);
    pointeur(canvas, 'pointerup', 510, 340);
    expect(onSelect).toHaveBeenCalledTimes(1);
    const b = onSelect.mock.calls[0][0];
    expect(b.lonMin).toBeCloseTo(0, 6);
    expect(b.lonMax).toBeCloseTo(90, 6);
    // L'axe Y de l'ecran descend, celui des latitudes monte : sans l'inversion
    // la region serait le miroir nord/sud de celle que l'utilisateur a tracee.
    expect(b.latMax).toBeCloseTo(0, 6);
    expect(b.latMin).toBeCloseTo(-45, 6);
  });

  it('normalise le sens du glisser (bas-droite vers haut-gauche donne la meme region)', () => {
    const onSelect = vi.fn();
    const { canvas } = monter((hostRef) => (
      <RoiLayer hostRef={hostRef} enabled onSelect={onSelect} onClear={vi.fn()} />
    ));
    pointeur(canvas, 'pointerdown', 510, 340);
    pointeur(canvas, 'pointermove', 360, 240);
    pointeur(canvas, 'pointerup', 360, 240);
    const b = onSelect.mock.calls[0][0];
    expect(b.lonMin).toBeLessThan(b.lonMax);
    expect(b.latMin).toBeLessThan(b.latMax);
  });

  it('ignore un clic simple : il ne selectionne pas une region de zero degre', () => {
    const onSelect = vi.fn();
    const { canvas } = monter((hostRef) => (
      <RoiLayer hostRef={hostRef} enabled onSelect={onSelect} onClear={vi.fn()} />
    ));
    pointeur(canvas, 'pointerdown', 360, 240);
    pointeur(canvas, 'pointermove', 363, 242);
    pointeur(canvas, 'pointerup', 363, 242);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('efface la region au double-clic', () => {
    const onClear = vi.fn();
    const { canvas } = monter((hostRef) => (
      <RoiLayer hostRef={hostRef} enabled onSelect={vi.fn()} onClear={onClear} />
    ));
    canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('dessine le rectangle pendant le glisser', () => {
    const { canvas } = monter((hostRef) => (
      <RoiLayer hostRef={hostRef} enabled onSelect={vi.fn()} onClear={vi.fn()} />
    ));
    const journal = dessins.find((d) => d.canvas === canvas).journal;
    journal.length = 0;
    pointeur(canvas, 'pointerdown', 200, 100);
    pointeur(canvas, 'pointermove', 400, 300);
    expect(journal.some((a) => a.m === 'strokeRect')).toBe(true);
    // Le rectangle est decoupe sur la zone de trace : sans `clip`, il deborde
    // sur les axes et la colorbar.
    expect(journal.some((a) => a.m === 'clip')).toBe(true);
  });

  it('n emet rien quand la geometrie du graphe est absente', () => {
    // Cellule pas encore tracee : l attache reessaie plus tard plutot que de
    // convertir des pixels avec des axes inexistants.
    const onSelect = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const { container } = renderSimple(
      <RoiLayer hostRef={{ current: host }} enabled onSelect={onSelect} onClear={vi.fn()} />,
    );
    const canvas = container.querySelector('canvas');
    pointeur(canvas, 'pointerdown', 360, 240);
    pointeur(canvas, 'pointermove', 510, 340);
    pointeur(canvas, 'pointerup', 510, 340);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('retire ses ecouteurs au demontage', () => {
    const onSelect = vi.fn();
    const { canvas, unmount } = monter((hostRef) => (
      <RoiLayer hostRef={hostRef} enabled onSelect={onSelect} onClear={vi.fn()} />
    ));
    unmount();
    pointeur(canvas, 'pointerdown', 360, 240);
    pointeur(canvas, 'pointerup', 510, 340);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('TransectLayer', () => {
  it('ne rend rien quand l outil est inactif', () => {
    const { canvas } = monter((hostRef) => (
      <TransectLayer hostRef={hostRef} enabled={false} onSelect={vi.fn()} />
    ));
    expect(canvas).toBeNull();
  });

  it('remonte les deux extremites dans l ordre du glisser', () => {
    const onSelect = vi.fn();
    const { canvas } = monter((hostRef) => (
      <TransectLayer hostRef={hostRef} enabled onSelect={onSelect} />
    ));
    pointeur(canvas, 'pointerdown', 360, 240);
    pointeur(canvas, 'pointermove', 510, 140);
    pointeur(canvas, 'pointerup', 510, 140);
    expect(onSelect).toHaveBeenCalledTimes(1);
    const p = onSelect.mock.calls[0][0];
    // A = centre, B = un quart a l est et un quart au nord. L ordre compte :
    // un transect A->B n est pas le meme trajet que B->A a l affichage.
    expect(p.lat1).toBeCloseTo(0, 6);
    expect(p.lon1).toBeCloseTo(0, 6);
    expect(p.lon2).toBeCloseTo(90, 6);
    expect(p.lat2).toBeCloseTo(45, 6);
  });

  it('ignore un glisser trop court', () => {
    const onSelect = vi.fn();
    const { canvas } = monter((hostRef) => (
      <TransectLayer hostRef={hostRef} enabled onSelect={onSelect} />
    ));
    pointeur(canvas, 'pointerdown', 360, 240);
    pointeur(canvas, 'pointermove', 365, 244);
    pointeur(canvas, 'pointerup', 365, 244);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('dessine la corde et ses deux extremites', () => {
    const { canvas } = monter((hostRef) => (
      <TransectLayer hostRef={hostRef} enabled onSelect={vi.fn()} />
    ));
    const journal = dessins.find((d) => d.canvas === canvas).journal;
    journal.length = 0;
    pointeur(canvas, 'pointerdown', 200, 100);
    pointeur(canvas, 'pointermove', 400, 300);
    expect(journal.some((a) => a.m === 'lineTo')).toBe(true);
    expect(journal.filter((a) => a.m === 'arc').length).toBeGreaterThanOrEqual(2);
  });
});

describe('ProbeLayer', () => {
  const resultat = { id: 'v1', type: 'slice', params: { variable: 'TT', time: 24 }, data: SLICE };

  it('dessine un reticule quand une AUTRE vue publie un point', () => {
    const { canvas } = monter((hostRef) => (
      <ProbeLayer resultId="v1" result={resultat} hostRef={hostRef} />
    ));
    const journal = dessins.find((d) => d.canvas === canvas).journal;
    journal.length = 0;
    act(() => publishProbe({ lat: 0, lon: 0, sourceId: 'autre' }));
    expect(journal.length).toBeGreaterThan(0);
  });

  it('efface le reticule quand la sonde se retire', () => {
    const { canvas } = monter((hostRef) => (
      <ProbeLayer resultId="v1" result={resultat} hostRef={hostRef} />
    ));
    act(() => publishProbe({ lat: 0, lon: 0, sourceId: 'autre' }));
    const journal = dessins.find((d) => d.canvas === canvas).journal;
    journal.length = 0;
    act(() => publishProbe(null));
    expect(journal.some((a) => a.m === 'clearRect')).toBe(true);
  });

  it('ne rend rien pour une vue que la sonde ne sait pas lire', () => {
    const { canvas } = monter((hostRef) => (
      <ProbeLayer resultId="v9" result={{ id: 'v9', type: 'windrose', data: {} }} hostRef={hostRef} />
    ));
    // Le canvas peut exister, mais aucun dessin ne doit avoir lieu.
    if (canvas) {
      const journal = dessins.find((d) => d.canvas === canvas)?.journal ?? [];
      journal.length = 0;
      act(() => publishProbe({ lat: 0, lon: 0, sourceId: 'autre' }));
      expect(journal).toHaveLength(0);
    }
  });

  it('un survol publie le point ET les coordonnees fixes de la vue', () => {
    // C est le chemin qui alimente toutes les autres vues : le point publie
    // doit porter les deux axes survoles PLUS l heure et l altitude de la
    // vue source, sinon les vues d une autre dimension ne peuvent rien lire.
    const { hostRef } = faireHotePlotly(GEO);
    renderSimple(<ProbeLayer resultId="v1" result={resultat} hostRef={hostRef} />);
    const plotEl = hostRef.current.querySelector('.js-plotly-plot');
    let publie = null;
    const off = subscribeProbe((p) => { publie = p; });
    act(() => plotEl.emit('plotly_hover', { points: [{ x: 60, y: -40 }] }));
    off();
    expect(publie).toMatchObject({ lon: 60, lat: -40, sourceId: 'v1', time: 12, alt: 25.3 });
  });

  it('ignore un survol sans coordonnees numeriques', () => {
    const { hostRef } = faireHotePlotly(GEO);
    renderSimple(<ProbeLayer resultId="v1" result={resultat} hostRef={hostRef} />);
    const plotEl = hostRef.current.querySelector('.js-plotly-plot');
    let publie = 'inchange';
    const off = subscribeProbe((p) => { publie = p; });
    act(() => plotEl.emit('plotly_hover', { points: [{ x: 'a', y: null }] }));
    act(() => plotEl.emit('plotly_hover', {}));
    off();
    expect(publie).toBe('inchange');
  });

  it('la sortie de survol retire la sonde', () => {
    const { hostRef } = faireHotePlotly(GEO);
    renderSimple(<ProbeLayer resultId="v1" result={resultat} hostRef={hostRef} />);
    const plotEl = hostRef.current.querySelector('.js-plotly-plot');
    let publie = 'inchange';
    const off = subscribeProbe((p) => { publie = p; });
    act(() => plotEl.emit('plotly_unhover', {}));
    off();
    expect(publie).toBeNull();
  });

  it('ne dessine pas de reticule sur la vue SOURCE (Plotly gere son survol)', () => {
    const { canvas } = monter((hostRef) => (
      <ProbeLayer resultId="v1" result={resultat} hostRef={hostRef} />
    ));
    const journal = dessins.find((d) => d.canvas === canvas).journal;
    journal.length = 0;
    act(() => publishProbe({ lat: 0, lon: 0, sourceId: 'v1' }));
    // Seul l effacement a lieu : pas de croix par-dessus celle de Plotly.
    expect(journal.every((a) => a.m === 'clearRect')).toBe(true);
  });

  it('se desabonne au demontage', () => {
    const { canvas, unmount } = monter((hostRef) => (
      <ProbeLayer resultId="v1" result={resultat} hostRef={hostRef} />
    ));
    const journal = dessins.find((d) => d.canvas === canvas).journal;
    unmount();
    journal.length = 0;
    act(() => publishProbe({ lat: 10, lon: 10, sourceId: 'autre' }));
    expect(journal).toHaveLength(0);
  });
});

describe('RegionHistogram', () => {
  it('ne dessine rien sans valeurs', () => {
    const { container } = renderSimple(<RegionHistogram values={[]} />);
    const canvas = container.querySelector('canvas');
    if (canvas) {
      const journal = dessins.find((d) => d.canvas === canvas)?.journal ?? [];
      expect(journal).toHaveLength(0);
    }
  });

  it('dessine une barre par classe non vide', () => {
    const { container } = renderSimple(
      <RegionHistogram values={Array.from({ length: 200 }, (_, i) => i)} />,
    );
    const canvas = container.querySelector('canvas');
    const journal = dessins.find((d) => d.canvas === canvas).journal;
    // Les barres sont des rectangles arrondis ; une distribution uniforme sur
    // 200 valeurs remplit les 22 classes.
    expect(journal.filter((a) => a.m === 'roundRect')).toHaveLength(22);
  });

  it('tient sur une distribution CONSTANTE (etendue nulle)', () => {
    // span = 0 : sans le `|| 1`, chaque valeur donnerait une division par zero
    // et un indice de classe NaN.
    const { container } = renderSimple(<RegionHistogram values={[5, 5, 5, 5]} />);
    const canvas = container.querySelector('canvas');
    const journal = dessins.find((d) => d.canvas === canvas).journal;
    expect(journal.filter((a) => a.m === 'fillRect').length).toBeGreaterThanOrEqual(1);
  });

  it('tient sur une seule valeur', () => {
    expect(() => renderSimple(<RegionHistogram values={[42]} />)).not.toThrow();
  });
});

describe('MiniColorbar', () => {
  const stats = { min: 200.123, max: 604.5 };

  it('ne s affiche pas sans statistiques exploitables', () => {
    expect(renderSimple(<MiniColorbar stats={null} colorscaleName="Viridis" />)
      .container.querySelector('.mcv-cbar')).toBeNull();
    expect(renderSimple(<MiniColorbar stats={{ min: null, max: 3 }} colorscaleName="Viridis" />)
      .container.querySelector('.mcv-cbar')).toBeNull();
  });

  it('affiche les bornes et l unite de la variable', () => {
    const { container } = renderSimple(
      <MiniColorbar stats={stats} colorscaleName="Viridis" variableCode="TT" />,
    );
    expect(container.querySelector('.mcv-cbar')).toBeTruthy();
    expect(container.textContent).toContain('K');
  });

  it('accepte un NOM de palette comme un TABLEAU de stops', () => {
    // Batlow, Plasma, Vik... ne sont pas des noms natifs Plotly :
    // useResultColorscale renvoie leur tableau de stops. Un find() par nom
    // echouait et faisait disparaitre la colorbar des cellules de la grille.
    // Le degrade est pose par une classe emotion, pas par un attribut style :
    // on le relit donc dans le style CALCULE.
    const fond = (el) => getComputedStyle(el).background || getComputedStyle(el).backgroundImage;

    const parNom = renderSimple(
      <MiniColorbar stats={stats} colorscaleName="Viridis" variableCode="TT" />,
    ).container.querySelector('.grad');
    expect(fond(parNom)).toContain('linear-gradient');

    const parStops = renderSimple(
      <MiniColorbar stats={stats} colorscaleName={[[0, 'rgb(0,0,0)'], [1, 'rgb(255,255,255)']]} variableCode="TT" />,
    ).container.querySelector('.grad');
    expect(fond(parStops)).toContain('linear-gradient');
  });

  it('disparait plutot que d afficher un degrade faux pour une palette inconnue', () => {
    const { container } = renderSimple(
      <MiniColorbar stats={stats} colorscaleName="Inexistante" variableCode="TT" />,
    );
    expect(container.querySelector('.mcv-cbar')).toBeNull();
  });

  it('reste hors de l arbre d accessibilite (les valeurs sont deja dans la vue)', () => {
    const { container } = renderSimple(
      <MiniColorbar stats={stats} colorscaleName="Viridis" variableCode="TT" />,
    );
    expect(container.querySelector('.mcv-cbar').getAttribute('aria-hidden')).not.toBeNull();
  });
});
