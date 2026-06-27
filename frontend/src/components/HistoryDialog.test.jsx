import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import i18n from '../i18n';
import HistoryDialog from './HistoryDialog';

/** Sonde qui affiche l'URL courante pour vérifier la navigation. */
function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}

function seed(entries) {
  localStorage.setItem('mcv-recent-history', JSON.stringify(entries));
}

function renderDialog() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
      <HistoryDialog open onClose={vi.fn()} />
    </MemoryRouter>
  );
}

const windrose = {
  id: 'wr1', page: '/windrose', dataset: 'mean_test', variable: 'UU/VV',
  permalink: '/windrose?ds=mean_test&alt=80&lat=12&lon=34',
  params: { altitude: 80, lat: 12, lon: 34 }, label: 'Wind Rose (12°, 34°)', timestamp: Date.now(),
};
const slice = {
  id: 'sl1', page: '/slice', dataset: 'mean_test', variable: 'TT',
  permalink: '/slice?ds=mean_test&var=TT&t=12&alt=30',
  params: { time: 12, altitude: 30 }, label: 'TT t12 alt30', timestamp: Date.now(),
};

describe('HistoryDialog', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('en');
  });

  it('affiche l\'altitude de la rose des vents (visibilité du paramètre)', () => {
    seed([windrose]);
    renderDialog();
    // Le détail rend l'altitude visible, ce qui manquait dans le libellé seul.
    expect(screen.getByText(/alt 80/)).toBeTruthy();
    expect(screen.getByText(/\(12°, 34°\)/)).toBeTruthy();
  });

  it('un clic sur une entrée navigue vers son permalien', () => {
    seed([windrose]);
    renderDialog();
    fireEvent.click(screen.getByText(/alt 80/));
    expect(screen.getByTestId('loc').textContent).toBe('/windrose?ds=mean_test&alt=80&lat=12&lon=34');
  });

  it('supprimer une entrée la retire de la liste', () => {
    seed([windrose, slice]);
    renderDialog();
    const row = screen.getByText(/alt 80/).closest('li');
    fireEvent.click(within(row).getByRole('button', { name: 'Remove' }));
    expect(screen.queryByText(/alt 80/)).toBeNull();
    expect(screen.getByText(/t12/)).toBeTruthy();
  });

  it('filtre par recherche', () => {
    seed([windrose, slice]);
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText(i18n.t('history.search')), { target: { value: 'TT' } });
    expect(screen.queryByText(/alt 80/)).toBeNull();
    expect(screen.getByText(/t12/)).toBeTruthy();
  });
});
