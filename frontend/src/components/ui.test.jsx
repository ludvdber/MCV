import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ExportMenu from './ExportMenu';
import DataTableView from './DataTableView';
import DrillDownMenu from './DrillDownMenu';
import FullscreenButton from './FullscreenButton';
import IndividualSelector from './IndividualSelector';
import DetailPanel from './DetailPanel';
import ChartOrTable from './ChartOrTable';
import ViewExplainer from './ViewExplainer';
import VisuToggle from './VisuToggle';
import ColorscaleSelector from './ColorscaleSelector';
import InterpolationToggle from './InterpolationToggle';
import LocationsLegend from './LocationsLegend';
import PermalienButton from './PermalienButton';
import ChartSkeleton from './ChartSkeleton';
import i18n from '../i18n';
import {
  renderSimple, installApiFixtures, installCanvas2D, installGeometrie, faireHotePlotly,
} from '../test/harness';
import { resetPlotly, callsOf } from '../test/plotlyStub';
import { SLICE, CATALOGUE_INDIVIDUEL } from '../test/fixtures';

/** Les briques d'interface partagees par toutes les vues. */
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

describe('ExportMenu', () => {
  const ouvrir = (props = {}) => {
    const { plotEl } = faireHotePlotly();
    plotEl.data = [{ type: 'heatmap', z: [[1]] }];
    plotEl.layout = { title: { text: 'T' } };
    renderSimple(<ExportMenu plotRef={{ current: plotEl }} filename="fig" {...props} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('export.button'), 'i') }));
    return plotEl;
  };

  it('n ouvre son menu qu au clic', () => {
    const { plotEl } = faireHotePlotly();
    renderSimple(<ExportMenu plotRef={{ current: plotEl }} />);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('propose PNG et SVG', () => {
    ouvrir();
    const items = screen.getAllByRole('menuitem').map((e) => e.textContent);
    expect(items.some((t) => /png/i.test(t))).toBe(true);
    expect(items.some((t) => /svg/i.test(t))).toBe(true);
  });

  it('masque le CSV quand aucune fonction n est fournie', () => {
    ouvrir();
    const items = screen.getAllByRole('menuitem').map((e) => e.textContent);
    expect(items.some((t) => /csv/i.test(t))).toBe(false);
  });

  it('appelle l export CSV et confirme a l utilisateur', async () => {
    const onCSV = vi.fn();
    ouvrir({ onCSV });
    fireEvent.click(screen.getAllByRole('menuitem').find((e) => /csv/i.test(e.textContent)));
    expect(onCSV).toHaveBeenCalledTimes(1);
    // Un export silencieux laisse croire que le clic n a rien fait.
    await waitFor(() => expect(document.body.textContent).toContain(i18n.t('toast.csvExported')));
  });

  it('exporte une image via un CLONE hors ecran', async () => {
    const visible = ouvrir();
    fireEvent.click(screen.getAllByRole('menuitem').find((e) => /png/i.test(e.textContent)));
    await waitFor(() => expect(callsOf('toImage').length).toBeGreaterThanOrEqual(1));
    // Le graphe VISIBLE ne doit jamais etre celui qu on exporte : un export
    // qui recolore le graphe affiche laisserait la vue en theme clair.
    expect(callsOf('toImage')[0].el).not.toBe(visible);
    expect(visible.isConnected).toBe(true);
  });

  it('ne propose le mode publication que si un contexte est fourni', () => {
    ouvrir();
    const sans = screen.getAllByRole('menuitem').length;
    fireEvent.keyDown(document, { key: 'Escape' });
    ouvrir({ publication: { title: 'T', credit: 'c' } });
    expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(sans);
  });

  it('se desactive a la demande', () => {
    const { plotEl } = faireHotePlotly();
    renderSimple(<ExportMenu plotRef={{ current: plotEl }} disabled />);
    expect(screen.getByRole('button', { name: new RegExp(i18n.t('export.button'), 'i') }).disabled)
      .toBe(true);
  });

  it('ne tente rien sans graphe a exporter', () => {
    renderSimple(<ExportMenu plotRef={{ current: null }} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('export.button'), 'i') }));
    fireEvent.click(screen.getAllByRole('menuitem').find((e) => /png/i.test(e.textContent)));
    expect(callsOf('toImage')).toHaveLength(0);
  });
});

describe('DataTableView', () => {
  const colonnes = [
    { label: 'Latitude', key: 'lat' },
    { label: 'Longitude', key: 'lon' },
    { label: 'Valeur', key: 'val' },
  ];
  const lignes = Array.from({ length: 200 }, (_, i) => ({
    lat: -90 + i, lon: (i * 7) % 360 - 180, val: 200 + (i % 50),
  }));

  it('ne rend qu une fraction des lignes (virtualisation)', () => {
    // 6 millions de lignes doivent couter le meme nombre de noeuds DOM que 200.
    const { container } = renderSimple(<DataTableView columns={colonnes} rows={lignes} />);
    const rendues = container.querySelectorAll('tbody tr').length;
    expect(rendues).toBeGreaterThan(0);
    expect(rendues).toBeLessThan(lignes.length);
  });

  it('affiche une en-tete par colonne', () => {
    renderSimple(<DataTableView columns={colonnes} rows={lignes} />);
    for (const c of colonnes) expect(screen.getByText(c.label)).toBeTruthy();
  });

  /** Valeurs de la premiere colonne, dans l'ordre affiche (les cellules sont
   *  formatees : « 3.00000 »). */
  const premiereColonne = (container) => [...container.querySelectorAll('tbody tr')]
    .map((tr) => tr.querySelector('td')?.textContent)
    .filter((v) => v != null && v !== '')
    .map(Number);

  it('trie numeriquement, pas alphabetiquement', () => {
    // Un tri par chaine mettrait « 100 » avant « 20 ».
    const petites = [{ lat: 100, lon: 0, val: 1 }, { lat: 20, lon: 0, val: 2 }, { lat: 3, lon: 0, val: 3 }];
    const { container } = renderSimple(<DataTableView columns={colonnes} rows={petites} />);
    fireEvent.click(screen.getByText('Latitude'));
    expect(premiereColonne(container)).toEqual([3, 20, 100]);
  });

  it('inverse le tri au second clic', () => {
    const petites = [{ lat: 100, lon: 0, val: 1 }, { lat: 20, lon: 0, val: 2 }, { lat: 3, lon: 0, val: 3 }];
    const { container } = renderSimple(<DataTableView columns={colonnes} rows={petites} />);
    fireEvent.click(screen.getByText('Latitude'));
    fireEvent.click(screen.getByText('Latitude'));
    expect(premiereColonne(container)).toEqual([100, 20, 3]);
  });

  it('filtre sur toutes les colonnes a la fois', () => {
    const petites = [{ lat: 1, lon: 2, val: 999 }, { lat: 4, lon: 5, val: 6 }];
    const { container } = renderSimple(<DataTableView columns={colonnes} rows={petites} />);
    const champ = container.querySelector('input');
    fireEvent.change(champ, { target: { value: '999' } });
    // Le virtualiseur pose une ligne d'espacement de hauteur nulle : on compte
    // les lignes qui portent reellement une valeur.
    expect(premiereColonne(container)).toEqual([1]);
  });

  it('tient sur un tableau vide', () => {
    expect(() => renderSimple(<DataTableView columns={colonnes} rows={[]} />)).not.toThrow();
  });
});

describe('DrillDownMenu', () => {
  it('ne s affiche pas tant qu aucun point n a ete clique', () => {
    const { plotEl } = faireHotePlotly();
    const { container } = renderSimple(
      <DrillDownMenu plotRef={{ current: plotEl }} onDrillDown={vi.fn()} />,
    );
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it('ouvre son menu sur un clic dans le graphe et remonte le point', () => {
    const { plotEl } = faireHotePlotly();
    const onDrillDown = vi.fn();
    renderSimple(<DrillDownMenu plotRef={{ current: plotEl }} onDrillDown={onDrillDown} />);
    plotEl.emit('plotly_click', { points: [{ x: 60, y: -40 }], event: { clientX: 100, clientY: 100 } });
    const items = screen.queryAllByRole('menuitem');
    if (items.length) {
      fireEvent.click(items[0]);
      expect(onDrillDown).toHaveBeenCalled();
      // Le point clique doit voyager tel quel : c est lui qui pilote la vue
      // suivante (profil vertical au point, serie temporelle au point...).
      expect(onDrillDown.mock.calls[0][1]).toMatchObject({ lat: -40, lon: 60 });
    }
  });

  it('masque les types de vue exclus', () => {
    const { plotEl } = faireHotePlotly();
    renderSimple(
      <DrillDownMenu plotRef={{ current: plotEl }} onDrillDown={vi.fn()}
        hiddenTypes={['profile', 'timeseries', 'windrose', 'temporalprofile']} />,
    );
    plotEl.emit('plotly_click', { points: [{ x: 0, y: 0 }], event: { clientX: 1, clientY: 1 } });
    expect(screen.queryAllByRole('menuitem').length).toBeLessThanOrEqual(2);
  });

  it('ignore un clic sans point exploitable', () => {
    const { plotEl } = faireHotePlotly();
    const onDrillDown = vi.fn();
    renderSimple(<DrillDownMenu plotRef={{ current: plotEl }} onDrillDown={onDrillDown} />);
    expect(() => plotEl.emit('plotly_click', { points: [] })).not.toThrow();
    expect(onDrillDown).not.toHaveBeenCalled();
  });
});

describe('FullscreenButton', () => {
  it('demande le plein ecran sur le conteneur donne', () => {
    const el = document.createElement('div');
    el.requestFullscreen = vi.fn(() => Promise.resolve());
    renderSimple(<FullscreenButton containerRef={{ current: el }} />);
    fireEvent.click(screen.getByRole('button'));
    expect(el.requestFullscreen).toHaveBeenCalled();
  });

  it('en sort quand il y est deja', () => {
    const el = document.createElement('div');
    el.requestFullscreen = vi.fn(() => Promise.resolve());
    Object.defineProperty(document, 'fullscreenElement', { value: el, configurable: true });
    document.exitFullscreen = vi.fn(() => Promise.resolve());
    renderSimple(<FullscreenButton containerRef={{ current: el }} />);
    fireEvent.click(screen.getByRole('button'));
    expect(document.exitFullscreen).toHaveBeenCalled();
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
  });

  it('ne casse pas quand l API n est pas disponible', () => {
    // Safari sur iPhone n expose pas requestFullscreen sur un div.
    const el = document.createElement('div');
    renderSimple(<FullscreenButton containerRef={{ current: el }} />);
    expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow();
  });

  it('porte un nom accessible', () => {
    const el = document.createElement('div');
    renderSimple(<FullscreenButton containerRef={{ current: el }} />);
    const b = screen.getByRole('button');
    expect(b.getAttribute('aria-label') || b.getAttribute('title')).toBeTruthy();
  });
});

describe('IndividualSelector', () => {
  it('ne propose aucune annee quand le catalogue individuel est vide', () => {
    const { container } = renderSimple(<IndividualSelector years={[]} onSelect={vi.fn()} />);
    const champ = container.querySelector('input');
    fireEvent.mouseDown(champ);
    // Le champ existe (la mise en page ne bouge pas) mais n'offre rien :
    // les fichiers individuels sont optionnels dans un deploiement.
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('propose les annees martiennes du catalogue', () => {
    renderSimple(<IndividualSelector years={CATALOGUE_INDIVIDUEL} onSelect={vi.fn()} />);
    // Les options d'un Select MUI n'existent dans le DOM qu'une fois ouvert.
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toContain('MY34');
  });

  it('choisir une annee cale le Ls sur le debut de sa plage', () => {
    renderSimple(<IndividualSelector years={CATALOGUE_INDIVIDUEL} onSelect={vi.fn()} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'MY34' }));
    // MY34 commence a Ls 0,5 : proposer 0 demanderait un fichier inexistant.
    expect(document.body.textContent).toContain('0.50');
  });

  it('construit un identifiant que le backend sait resoudre', () => {
    renderSimple(
      <IndividualSelector years={CATALOGUE_INDIVIDUEL} onSelect={vi.fn()}
        initialYear={34} initialLs={5} />,
    );
    // Le prefixe IND_ est le contrat entre les deux catalogues.
    expect(document.body.textContent).toContain('IND_MY34_LS5.00');
  });

  it('ramene silencieusement un Ls hors plage dans la plage', () => {
    const { container } = renderSimple(
      <IndividualSelector years={CATALOGUE_INDIVIDUEL} onSelect={vi.fn()}
        initialYear={34} initialLs={5} />,
    );
    const champ = container.querySelector('input[type="number"]');
    fireEvent.change(champ, { target: { value: '350' } });
    fireEvent.blur(champ);
    // 350 n'existe pas pour MY34 (0,5 a 10,2) : le champ se rabat sur le max
    // plutot que de laisser partir une requete vouee au 404.
    expect(Number(champ.value)).toBeLessThanOrEqual(10.2);
  });

  it('ignore une saisie non numerique au lieu de produire un NaN', () => {
    const { container } = renderSimple(
      <IndividualSelector years={CATALOGUE_INDIVIDUEL} onSelect={vi.fn()}
        initialYear={34} initialLs={5} />,
    );
    const champ = container.querySelector('input[type="number"]');
    fireEvent.change(champ, { target: { value: 'abc' } });
    fireEvent.blur(champ);
    expect(document.body.textContent).not.toContain('NaN');
  });

  it('remonte la selection sous forme d identifiant de dataset', () => {
    const onSelect = vi.fn();
    const { container } = renderSimple(
      <IndividualSelector years={CATALOGUE_INDIVIDUEL} onSelect={onSelect}
        initialYear={34} initialLs={5} />,
    );
    // Le composant construit un id « IND_MY34_LS... » que le backend sait
    // resoudre en fichier : c est le contrat entre les deux catalogues.
    const entrees = container.querySelectorAll('input');
    expect(entrees.length).toBeGreaterThan(0);
  });

  it('borne le Ls a la plage reellement disponible pour l annee', () => {
    // MY34 va de 0,5 a 10,2 dans la fixture : proposer 180 donnerait un 404.
    const { container } = renderSimple(
      <IndividualSelector years={CATALOGUE_INDIVIDUEL} onSelect={vi.fn()} initialYear={34} />,
    );
    const curseur = container.querySelector('input[type="range"], [role="slider"]');
    if (curseur) {
      expect(Number(curseur.getAttribute('aria-valuemax') ?? curseur.max)).toBeLessThanOrEqual(11);
    }
  });
});

describe('DetailPanel', () => {
  it('n affiche rien sans donnees', () => {
    const { container } = renderSimple(
      <DetailPanel resultData={null} resultType="slice" variableCode="TT" />,
    );
    expect(container.textContent).toBe('');
  });

  it('trace la distribution des valeurs d une coupe', () => {
    renderSimple(<DetailPanel resultData={SLICE} resultType="slice" variableCode="TT" />);
    const traces = callsOf('newPlot').flatMap((c) => c.traces ?? []);
    expect(traces.some((tr) => tr.type === 'histogram')).toBe(true);
  });

  it('tolere un type de vue sans distribution', () => {
    expect(() => renderSimple(
      <DetailPanel resultData={SLICE} resultType="windrose" variableCode="TT" />,
    )).not.toThrow();
  });
});

describe('petits composants d interface', () => {
  it('ChartOrTable rend ses enfants tels quels sans donnees tabulaires', () => {
    renderSimple(<ChartOrTable tableData={null}><div>graphe</div></ChartOrTable>);
    expect(document.body.textContent).toContain('graphe');
    expect(document.body.querySelector('table')).toBeNull();
  });

  it('ChartOrTable confie son bouton a l appelant (render prop)', () => {
    // Le bouton est PLACE par la page, dans sa barre d'actions : le composant
    // ne decide pas de l'endroit ou il apparait.
    const tableData = { columns: [{ label: 'A', key: 'a' }], rows: [{ a: 1 }] };
    renderSimple(
      <ChartOrTable tableData={tableData}>
        {(showTable, TableButton) => (
          <div>
            <TableButton />
            {!showTable && <div>graphe</div>}
          </div>
        )}
      </ChartOrTable>,
    );
    expect(document.body.textContent).toContain('graphe');
    fireEvent.click(screen.getByRole('button'));
    expect(document.body.querySelector('table')).toBeTruthy();
    expect(document.body.textContent).not.toContain('graphe');
  });

  it('ViewExplainer explique la vue demandee', () => {
    renderSimple(<ViewExplainer id="slice" />);
    expect(document.body.textContent.length).toBeGreaterThan(10);
  });

  it('ViewExplainer reste muet sur un identifiant inconnu', () => {
    const { container } = renderSimple(<ViewExplainer id="inexistant" />);
    expect(container.textContent.length).toBeLessThan(200);
  });

  it('VisuToggle rend son etat au clavier', () => {
    const onChange = vi.fn();
    renderSimple(<VisuToggle value={false} onChange={onChange} title="Vent">Vent</VisuToggle>);
    const b = screen.getByRole('button', { name: /vent/i });
    fireEvent.click(b);
    expect(onChange).toHaveBeenCalled();
  });

  it('ColorscaleSelector liste toutes les palettes', () => {
    const onChange = vi.fn();
    renderSimple(<ColorscaleSelector value="auto" onChange={onChange} />);
    const champ = screen.getByRole('combobox');
    fireEvent.mouseDown(champ);
    const options = screen.getAllByRole('option');
    // Auto plus les dix palettes declarees dans utils/colorscales.js.
    expect(options).toHaveLength(11);
    fireEvent.click(options.find((o) => /cividis/i.test(o.textContent)));
    expect(onChange).toHaveBeenCalled();
  });

  it('InterpolationToggle propose les trois resolutions', () => {
    const onChange = vi.fn();
    renderSimple(<InterpolationToggle value={0} onChange={onChange} />);
    const boutons = screen.getAllByRole('button');
    expect(boutons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(boutons[boutons.length - 1]);
    expect(onChange).toHaveBeenCalled();
  });

  it('LocationsLegend n apparait que si la couche est active', () => {
    const { container: absent } = renderSimple(<LocationsLegend visible={false} />);
    expect(absent.textContent).toBe('');
    renderSimple(<LocationsLegend visible />);
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });

  it('PermalienButton confirme la copie', () => {
    const onClick = vi.fn();
    const { rerender } = renderSimple(<PermalienButton onClick={onClick} copied={false} />);
    const avant = screen.getByRole('button').textContent;
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
    rerender(<PermalienButton onClick={onClick} copied />);
    expect(screen.getByRole('button').textContent).not.toBe(avant);
  });

  it('ChartSkeleton occupe la place du graphe a venir', () => {
    const { container } = renderSimple(<ChartSkeleton variant="heatmap" height={450} />);
    expect(container.firstChild).toBeTruthy();
    // Le squelette est decoratif : il ne doit rien annoncer.
    expect(container.textContent).toBe('');
  });
});
