import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';

/**
 * Tests de bout en bout de l'historique : pour chaque "façon d'enregistrer"
 * (hook partagé useVisualizationPage, et chemin custom pts de la série
 * temporelle), on restaure un permalien et on vérifie que :
 *   1. la requête est relancée avec EXACTEMENT les paramètres de l'URL,
 *   2. l'entrée ré-enregistrée dans l'historique porte un permalien complet.
 * C'est ce qui garantit qu'un clic dans l'historique reproduit fidèlement la vue.
 */

// Plotly et les viewers touchent au DOM/canvas : neutralisés pour jsdom.
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
vi.mock('../components/WindRoseViewer', () => ({ default: () => null }));
vi.mock('../components/TimeSeriesChart', () => ({ default: () => null }));

vi.mock('../services/api', () => {
  const stats = { min: 1, max: 4, mean: 2.5, stddev: 1, median: 2.5 };
  return {
    default: { get: vi.fn(() => Promise.resolve({ data: {} })) },
    getCatalog: vi.fn(() => Promise.resolve({
      data: [{ id: 'mean_test', marsYear: 34, lsStart: 0, lsEnd: 30, variables: ['TT', 'UU', 'VV'] }],
    })),
    getIndividualCatalog: vi.fn(() => Promise.resolve({ data: [] })),
    getAltitudes: vi.fn(() => Promise.resolve({
      data: { surface: false, altitudes: Array.from({ length: 102 }, (_, i) => i) },
    })),
    getSlice: vi.fn(() => Promise.resolve({
      data: { data: [[1, 2], [3, 4]], latitudes: [-44, 44], longitudes: [0, 90], timeIndex: 0, altitudeIndex: 0, variable: 'TT', stats },
    })),
    getWind: vi.fn(() => Promise.resolve({ data: { lats: [], lons: [], u: [], v: [] } })),
    getTimeSeries: vi.fn(() => Promise.resolve({ data: { values: [1, 2, 3], stats } })),
    getWindRose: vi.fn(() => Promise.resolve({ data: { uu: [1, 2], vv: [3, 4], actualLat: 12, actualLon: 34 } })),
    exportSliceCSV: vi.fn(), exportSliceNetCDF: vi.fn(),
    exportTimeSeriesCSV: vi.fn(), exportWindRoseCSV: vi.fn(),
  };
});

import '../i18n';
import * as api from '../services/api';
import { AppThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
import { MarsProvider } from '../context/MarsContext';
import SlicePage from './SlicePage';
import WindRosePage from './WindRosePage';
import TimeSeriesPage from './TimeSeriesPage';

function renderAt(path, routePath, element) {
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

const savedHistory = () => JSON.parse(localStorage.getItem('mcv-recent-history') || '[]');

describe('Historique — restauration fidèle des permaliens', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('Slice : restaure dataset/variable/time/altitude (hook partagé)', async () => {
    renderAt('/slice?ds=mean_test&var=TT&t=12&alt=30', '/slice', <SlicePage />);

    await waitFor(() => expect(api.getSlice).toHaveBeenCalled());
    expect(api.getSlice).toHaveBeenCalledWith(
      expect.objectContaining({ dataset: 'mean_test', variable: 'TT', time: 12, altitude: 30 })
    );
    await waitFor(() => expect(savedHistory().length).toBeGreaterThan(0));
    const entry = savedHistory()[0];
    expect(entry.permalink).toContain('t=12');
    expect(entry.permalink).toContain('alt=30');
  });

  it('WindRose : restaure dataset/altitude/lat/lon (hook partagé)', async () => {
    renderAt('/windrose?ds=mean_test&alt=80&lat=12&lon=34', '/windrose', <WindRosePage />);

    await waitFor(() => expect(api.getWindRose).toHaveBeenCalled());
    expect(api.getWindRose).toHaveBeenCalledWith(
      expect.objectContaining({ dataset: 'mean_test', altitude: 80, latitude: 12, longitude: 34 })
    );
    const entry = savedHistory()[0];
    expect(entry.permalink).toContain('alt=80');
    expect(entry.permalink).toContain('lat=12');
    expect(entry.permalink).toContain('lon=34');
  });

  // Régression : cliquer une entrée d'historique dont les paramètres sont
  // IDENTIQUES à la sélection courante du contexte. Tous les setters de
  // restoreUrl deviennent alors des no-op, donc aucun changement d'état ne
  // provoque de rendu. L'ancien code, qui évaluait l'auto-launch uniquement au
  // rendu, ne se relançait jamais (graphe vide tant qu'on n'actualisait pas).
  // forceRestoreRender garantit désormais le rendu, donc le relancement.
  it('Slice : relance même si les params égalent la sélection courante (no-op)', async () => {
    function Harness({ to }) {
      const navigate = useNavigate();
      return (
        <>
          <button data-testid="nav" onClick={() => navigate(to)}>go</button>
          <Routes>
            <Route path="/slice" element={<SlicePage />} />
          </Routes>
        </>
      );
    }

    // Phase 1 : restauration depuis les défauts → le contexte devient
    // mean_test/TT/12/30 et un premier getSlice part. Le param `x` est ignoré
    // mais rend la query string différente de la phase 2.
    render(
      <AppThemeProvider>
        <ToastProvider>
          <MarsProvider>
            <MemoryRouter initialEntries={['/slice?ds=mean_test&var=TT&t=12&alt=30&x=1']}>
              <Harness to="/slice?ds=mean_test&var=TT&t=12&alt=30" />
            </MemoryRouter>
          </MarsProvider>
        </ToastProvider>
      </AppThemeProvider>
    );

    await waitFor(() => expect(api.getSlice).toHaveBeenCalledTimes(1));

    // Phase 2 : on navigue vers les MÊMES valeurs (query string différente, mais
    // setters tous no-op puisque le contexte les détient déjà). Le graphe doit
    // tout de même se relancer.
    fireEvent.click(document.querySelector('[data-testid="nav"]'));
    await waitFor(() => expect(api.getSlice).toHaveBeenCalledTimes(2));
  });

  it('Série temporelle : restaure les points depuis pts= (chemin custom)', async () => {
    const pts = encodeURIComponent(JSON.stringify([{ lat: 12, lon: 34 }]));
    renderAt(`/timeseries?ds=mean_test&var=TT&alt=30&pts=${pts}`, '/timeseries', <TimeSeriesPage />);

    await waitFor(() => expect(api.getTimeSeries).toHaveBeenCalled());
    expect(api.getTimeSeries).toHaveBeenCalledWith(
      expect.objectContaining({ dataset: 'mean_test', variable: 'TT', latitude: 12, longitude: 34, altitude: 30 })
    );
    const entry = savedHistory()[0];
    expect(entry.permalink).toContain('pts=');
    expect(entry.permalink).toContain('alt=30');
  });
});
