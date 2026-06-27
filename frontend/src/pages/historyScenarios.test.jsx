import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render, waitFor, fireEvent, screen, renderHook, act,
} from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';

/**
 * 20 scénarios (nominaux et non-nominaux) couvrant l'INTÉGRALITÉ de la
 * fonctionnalité historique : le hook de stockage, la restauration/permaliens
 * de chaque type de page, et la fenêtre de gestion. Objectif : verrouiller le
 * comportement et prévenir les régressions. Étiquetage [N]=nominal,
 * [NN]=non-nominal (entrée hostile, état corrompu, limite franchie...).
 */

/* ── Neutralisation des dépendances lourdes (canvas / Plotly / tableaux) ──── */
vi.mock('plotly.js-dist-min', () => ({
  default: {
    newPlot: vi.fn(() => Promise.resolve()),
    react: vi.fn(() => Promise.resolve()),
    purge: vi.fn(),
    Plots: { resize: vi.fn(() => Promise.resolve()) },
    toImage: vi.fn(() => Promise.resolve('data:image/png;base64,')),
  },
}));
vi.mock('../components/SliceViewer', () => ({ default: () => null }));
vi.mock('../components/ProfileViewer', () => ({ default: () => null }));
vi.mock('../components/TimeSeriesChart', () => ({ default: () => null }));
vi.mock('../components/CrossSectionViewer', () => ({ default: () => null }));
vi.mock('../components/HovmollerViewer', () => ({ default: () => null }));
vi.mock('../components/AnimationPlayer', () => ({ default: () => null }));
vi.mock('../components/MiniMarsMap', () => ({ default: () => null }));
// Les générateurs de tableaux supposent des structures précises : on les neutralise
// pour que les pages restent montables avec des réponses API minimales.
vi.mock('../utils/dataToTable', () => ({
  gridToTable: () => null,
  grid2DToTable: () => null,
  profileToTable: () => null,
  timeSeriesToTable: () => null,
  animationToTable: () => null,
}));

vi.mock('../services/api', () => {
  const stats = { min: 1, max: 4, mean: 2.5, stddev: 1, median: 2.5 };
  const grid = { variable: 'TT', data: [[1, 2], [3, 4]], stats };
  return {
    default: { get: vi.fn(() => Promise.resolve({ data: {} })) },
    getCatalog: vi.fn(() => Promise.resolve({
      data: [{ id: 'mean_test', marsYear: 34, lsStart: 0, lsEnd: 30, variables: ['TT', 'UU', 'VV'] }],
    })),
    getIndividualCatalog: vi.fn(() => Promise.resolve({ data: [] })),
    getAltitudes: vi.fn(() => Promise.resolve({
      data: { surface: false, altitudes: Array.from({ length: 102 }, (_, i) => i) },
    })),
    getSlice: vi.fn(() => Promise.resolve({ data: { ...grid, latitudes: [-44, 44], longitudes: [0, 90] } })),
    getWind: vi.fn(() => Promise.resolve({ data: { lats: [], lons: [], u: [], v: [] } })),
    getProfile: vi.fn(() => Promise.resolve({ data: { variable: 'TT', altitudes: [0, 1], values: [1, 2], stats } })),
    getTimeSeries: vi.fn(() => Promise.resolve({ data: { variable: 'TT', values: [1, 2, 3], stats } })),
    getCrossSection: vi.fn(() => Promise.resolve({ data: { ...grid, altitudes: [0, 1], horizontalCoords: [0, 1] } })),
    getHovmoller: vi.fn(() => Promise.resolve({ data: { ...grid, times: [0, 1], spatialCoords: [0, 1] } })),
    getAnimation: vi.fn(() => Promise.resolve({ data: { variable: 'TT', frames: [], latitudes: [], longitudes: [] } })),
    exportSliceCSV: vi.fn(), exportSliceNetCDF: vi.fn(), exportProfileCSV: vi.fn(),
    exportTimeSeriesCSV: vi.fn(), exportCrossSectionCSV: vi.fn(), exportHovmollerCSV: vi.fn(),
  };
});

import i18n from '../i18n';
import * as api from '../services/api';
import { AppThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
import { MarsProvider } from '../context/MarsContext';
import { useRecentHistory } from '../hooks/useRecentHistory';
import HistoryDialog from '../components/HistoryDialog';
import SlicePage from './SlicePage';
import ProfilePage from './ProfilePage';
import TimeSeriesPage from './TimeSeriesPage';
import CrossSectionPage from './CrossSectionPage';
import HovmollerPage from './HovmollerPage';
import AnimationPage from './AnimationPage';

const KEY = 'mcv-recent-history';
const saved = () => JSON.parse(localStorage.getItem(KEY) || '[]');
const seed = (entries) => localStorage.setItem(KEY, JSON.stringify(entries));

/** Rend une page à une URL donnée, dans tout l'arbre de contextes. */
function renderPage(path, routePath, element) {
  return render(
    <AppThemeProvider>
      <ToastProvider>
        <MarsProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path={routePath} element={element} />
            </Routes>
          </MemoryRouter>
        </MarsProvider>
      </ToastProvider>
    </AppThemeProvider>
  );
}

/** Rend une page avec un bouton de navigation interne (pour enchaîner 2 URLs). */
function renderPageWithNav(first, second, routePath, element) {
  function Harness() {
    const navigate = useNavigate();
    return (
      <>
        <button data-testid="nav" onClick={() => navigate(second)}>go</button>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </>
    );
  }
  return render(
    <AppThemeProvider>
      <ToastProvider>
        <MarsProvider>
          <MemoryRouter initialEntries={[first]}>
            <Harness />
          </MemoryRouter>
        </MarsProvider>
      </ToastProvider>
    </AppThemeProvider>
  );
}

function renderDialog() {
  return render(
    <MemoryRouter>
      <HistoryDialog open onClose={vi.fn()} />
    </MemoryRouter>
  );
}

// id + timestamp inclus pour que les entrées SEEDÉES passent la validation de
// loadHistory. Pour les tests qui passent par addEntry, ces deux champs sont de
// toute façon réécrits par le hook (makeId + Date.now).
let seq = 0;
const baseEntry = (over = {}) => ({
  id: `seed-${seq++}`, timestamp: Date.now(), pinned: false,
  page: '/slice', dataset: 'mean_test', variable: 'TT',
  permalink: '/slice?ds=mean_test&var=TT&t=0&alt=0', label: 'e', ...over,
});

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  await i18n.changeLanguage('en');
});

/* ════════════ SECTION 1 — Hook de stockage (useRecentHistory) ════════════ */

describe('Historique — hook de stockage', () => {
  it('[NN] 1. deux ajouts dans la même milliseconde reçoivent des id distincts', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const { result } = renderHook(() => useRecentHistory());
    act(() => result.current.addEntry(baseEntry({ permalink: '/slice?a', label: 'a' })));
    act(() => result.current.addEntry(baseEntry({ permalink: '/slice?b', label: 'b' })));
    const [b, a] = result.current.history;
    expect(a.id).not.toBe(b.id);
    now.mockRestore();
  });

  it('[NN] 2. déduplique sans permalien via la signature page|dataset|variable', () => {
    const { result } = renderHook(() => useRecentHistory());
    const noLink = { page: '/slice', dataset: 'mean_test', variable: 'TT', label: 'x' };
    act(() => result.current.addEntry({ ...noLink }));
    act(() => result.current.addEntry({ ...noLink, label: 'x-again' }));
    expect(result.current.history).toHaveLength(1);
    // Variable différente => signature différente => entrée distincte.
    act(() => result.current.addEntry({ ...noLink, variable: 'UU' }));
    expect(result.current.history).toHaveLength(2);
  });

  it('[NN] 3. un localStorage contenant "null" (JSON valide non-tableau) donne une liste vide', () => {
    seed(null); // JSON.stringify(null) === "null"
    const { result } = renderHook(() => useRecentHistory());
    expect(result.current.history).toEqual([]);
  });

  it('[NN] 4. un localStorage contenant un objet (non-tableau) donne une liste vide', () => {
    localStorage.setItem(KEY, JSON.stringify({ foo: 'bar' }));
    const { result } = renderHook(() => useRecentHistory());
    expect(result.current.history).toEqual([]);
  });

  it('[NN] 5. togglePin sur un id inexistant ne plante pas et ne change rien', () => {
    const { result } = renderHook(() => useRecentHistory());
    act(() => result.current.addEntry(baseEntry({ permalink: '/slice?a', label: 'a' })));
    expect(() => act(() => result.current.togglePin('does-not-exist'))).not.toThrow();
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].pinned).toBe(false);
  });

  it('[NN] 6. removeEntry sur un id inexistant laisse la liste intacte', () => {
    const { result } = renderHook(() => useRecentHistory());
    act(() => result.current.addEntry(baseEntry({ permalink: '/slice?a', label: 'a' })));
    act(() => result.current.removeEntry('nope'));
    expect(result.current.history.map(e => e.label)).toEqual(['a']);
  });

  it('[N] 7. deux instances du hook dans le même onglet restent synchronisées', () => {
    const { result: r1 } = renderHook(() => useRecentHistory());
    const { result: r2 } = renderHook(() => useRecentHistory());
    act(() => r1.current.addEntry(baseEntry({ permalink: '/slice?z', label: 'z' })));
    expect(r2.current.history).toHaveLength(1);
    expect(r2.current.history[0].label).toBe('z');
  });

  it('[NN] 8. désépingler une entrée la rend de nouveau évinçable par le plafond', () => {
    const { result } = renderHook(() => useRecentHistory());
    act(() => result.current.addEntry(baseEntry({ permalink: '/slice?keep', label: 'keep' })));
    const id = result.current.history[0].id;
    act(() => result.current.togglePin(id)); // épinglée
    act(() => {
      for (let i = 0; i < 20; i++) result.current.addEntry(baseEntry({ permalink: `/slice?n=${i}`, label: `e${i}` }));
    });
    expect(result.current.history.some(e => e.label === 'keep')).toBe(true); // protégée tant qu'épinglée
    act(() => result.current.togglePin(id)); // désépinglée : 21 non-épinglées => évincée
    expect(result.current.history.some(e => e.label === 'keep')).toBe(false);
  });

  it('[N] 9. addEntry préserve les champs métier (params) intacts', () => {
    const { result } = renderHook(() => useRecentHistory());
    const params = { altitude: 80, lat: 12, lon: 34 };
    act(() => result.current.addEntry(baseEntry({ permalink: '/windrose?x', page: '/windrose', params })));
    expect(result.current.history[0].params).toEqual(params);
  });
});

/* ════════════ SECTION 2 — Restauration / permaliens (pages) ════════════ */

describe('Historique — restauration et permaliens des pages', () => {
  it('[N] 10. Profile : le permalien sérialise les points SANS leur id interne', async () => {
    const pts = encodeURIComponent(JSON.stringify([{ lat: 12, lon: 34 }]));
    renderPage(`/profile?ds=mean_test&var=TT&t=6&pts=${pts}`, '/profile', <ProfilePage />);
    await waitFor(() => expect(api.getProfile).toHaveBeenCalled());
    await waitFor(() => expect(saved().length).toBe(1));
    const link = decodeURIComponent(saved()[0].permalink);
    expect(link).toContain('"lat":12');
    expect(link).not.toContain('"id"');
  });

  it('[NN] 11. Profile : deux analyses des mêmes points ne créent qu\'une entrée (dédup)', async () => {
    const pts = JSON.stringify([{ lat: 12, lon: 34 }]);
    const url = (extra) => `/profile?ds=mean_test&var=TT&t=6&pts=${encodeURIComponent(pts)}${extra}`;
    renderPageWithNav(url(''), url('&x=1'), '/profile', <ProfilePage />);
    await waitFor(() => expect(api.getProfile).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId('nav'));
    await waitFor(() => expect(api.getProfile).toHaveBeenCalledTimes(2));
    // Permaliens identiques (id absent) => une seule entrée d'historique.
    expect(saved()).toHaveLength(1);
  });

  it('[N] 12. CrossSection : restaure type=zonal + coordonnée fixe vers la latitude', async () => {
    renderPage('/crosssection?ds=mean_test&var=TT&t=6&type=zonal&fixed=45', '/crosssection', <CrossSectionPage />);
    await waitFor(() => expect(api.getCrossSection).toHaveBeenCalled());
    expect(api.getCrossSection).toHaveBeenCalledWith(
      expect.objectContaining({ dataset: 'mean_test', variable: 'TT', type: 'zonal', fixedCoordinate: 45 })
    );
  });

  it('[NN] 13. Slice : un dataset inexistant affiche une erreur sans lancer de requête', async () => {
    renderPage('/slice?ds=NOPE&var=TT&t=6&alt=30', '/slice', <SlicePage />);
    expect(await screen.findByText(/NOPE/)).toBeTruthy();
    expect(api.getSlice).not.toHaveBeenCalled();
  });

  it('[NN] 14. Slice : des paramètres numériques invalides retombent sur les défauts (pas de NaN)', async () => {
    renderPage('/slice?ds=mean_test&var=TT&t=abc&alt=xyz', '/slice', <SlicePage />);
    await waitFor(() => expect(api.getSlice).toHaveBeenCalled());
    const arg = api.getSlice.mock.calls[0][0];
    expect(Number.isFinite(arg.time)).toBe(true);
    expect(Number.isFinite(arg.altitude)).toBe(true);
    expect(arg).toMatchObject({ time: 23, altitude: 49 }); // valeurs par défaut du contexte
  });

  it('[N] 15. Hovmoller : restaure le type d\'axe depuis le permalien', async () => {
    renderPage('/hovmoller?ds=mean_test&var=TT&alt=30&type=longitude', '/hovmoller', <HovmollerPage />);
    await waitFor(() => expect(api.getHovmoller).toHaveBeenCalled());
    expect(api.getHovmoller).toHaveBeenCalledWith(
      expect.objectContaining({ dataset: 'mean_test', variable: 'TT', type: 'longitude' })
    );
  });

  it('[NN] 16. TimeSeries : un pts= non-JSON ne plante pas et retombe sur le point (0,0)', async () => {
    renderPage('/timeseries?ds=mean_test&var=TT&alt=30&pts=NOT_JSON', '/timeseries', <TimeSeriesPage />);
    await waitFor(() => expect(api.getTimeSeries).toHaveBeenCalled());
    expect(api.getTimeSeries).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 0, longitude: 0 })
    );
  });

  it('[N] 17. Animation : restaure et enregistre une entrée d\'historique de la bonne page', async () => {
    renderPage('/animation?ds=mean_test&var=TT&alt=30', '/animation', <AnimationPage />);
    await waitFor(() => expect(api.getAnimation).toHaveBeenCalled());
    await waitFor(() => expect(saved().length).toBe(1));
    expect(saved()[0].page).toBe('/animation');
  });
});

/* ════════════ SECTION 3 — Fenêtre de gestion (HistoryDialog) ════════════ */

describe('Historique — fenêtre de gestion', () => {
  it('[N] 18. regroupe les entrées par catégorie et affiche la section épinglés en tête', () => {
    seed([
      baseEntry({ id: 's', page: '/slice', permalink: '/slice?a', label: 'slice', pinned: true }),
      baseEntry({ id: 'p', page: '/profile', permalink: '/profile?a', label: 'profile' }),
      baseEntry({ id: 'h', page: '/hovmoller', permalink: '/hovmoller?a', label: 'hovmoller' }),
    ]);
    renderDialog();
    expect(screen.getByText(i18n.t('history.pinned'))).toBeTruthy();
    // Profile et Hovmoller appartiennent à des groupes distincts (profiles / diagnostics).
    expect(screen.getByText(i18n.t('nav.group.profiles'))).toBeTruthy();
    expect(screen.getByText(i18n.t('nav.group.diagnostics'))).toBeTruthy();
  });

  it('[NN] 19. une recherche sans correspondance affiche l\'état "aucun résultat"', () => {
    seed([baseEntry({ id: 's', permalink: '/slice?a', label: 'slice' })]);
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText(i18n.t('history.search')), { target: { value: 'zzzzzz' } });
    expect(screen.getByText(i18n.t('history.noResults'))).toBeTruthy();
  });

  it('[N] 20. épingler depuis la fenêtre fait apparaître la section épinglés', () => {
    seed([
      baseEntry({ id: 'a', permalink: '/slice?a', label: 'aaa' }),
      baseEntry({ id: 'b', permalink: '/slice?b', label: 'bbb' }),
    ]);
    renderDialog();
    expect(screen.queryByText(i18n.t('history.pinned'))).toBeNull();
    // Le dialog n'affiche pas le label brut mais le nom de page + résumé ;
    // on épingle simplement la première entrée via son action dédiée.
    fireEvent.click(screen.getAllByRole('button', { name: i18n.t('history.pin') })[0]);
    expect(screen.getByText(i18n.t('history.pinned'))).toBeTruthy();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
