import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, render } from '@testing-library/react';

vi.mock('@react-three/fiber', async () => (await import('./test/r3fStub')).fiberStub);
vi.mock('@react-three/drei', async () => (await import('./test/r3fStub')).dreiStub);
vi.mock('@react-three/postprocessing', async () => (await import('./test/r3fStub')).postprocessingStub);
vi.mock('troika-three-text', async () => (await import('./test/r3fStub')).troikaStub);

const App = (await import('./App')).default;
const RouteErrorBoundary = (await import('./components/RouteErrorBoundary')).default;
const { silenceR3F } = await import('./test/r3fStub');
const { renderSimple, installApiFixtures, installCanvas2D, installGeometrie } =
  await import('./test/harness');
const i18n = (await import('./i18n')).default;
const { useThemeMode } = await import('./context/ThemeContext');

/**
 * La coquille au clavier : lien d'evitement, raccourcis globaux, bascule de
 * theme et de contraste, garde-fou d'erreur de route. Ce sont les chemins par
 * lesquels passe un visiteur qui n'utilise pas la souris.
 */
let desinstallerCanvas;
let desinstallerGeo;
let rendreSilencieux;

beforeEach(async () => {
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  rendreSilencieux = silenceR3F();
  try { localStorage.clear(); } catch { /* mode prive */ }
  await i18n.changeLanguage('fr');
  window.history.pushState({}, '', '/slice');
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  rendreSilencieux();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-contrast');
});

describe('lien d evitement', () => {
  it('deplace le focus sur le contenu SANS salir l URL', async () => {
    render(<App />);
    await waitFor(() => expect(document.querySelector('#mcv-main')).toBeTruthy(),
      { timeout: 15000 });
    const lien = document.querySelector('.mcv-skip-link');
    expect(lien).toBeTruthy();
    fireEvent.click(lien);
    // Le focus se pose sur le contenu principal...
    expect(document.activeElement.id).toBe('mcv-main');
    // ...et le hash ne se retrouve pas dans les permaliens copies ensuite.
    expect(window.location.hash).toBe('');
  }, 20000);
});

describe('raccourcis globaux', () => {
  it('« ? » ouvre et referme l aide des raccourcis', async () => {
    render(<App />);
    await waitFor(() => expect(document.querySelector('#mcv-main')).toBeTruthy(),
      { timeout: 15000 });
    fireEvent.keyDown(document, { key: '?' });
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    fireEvent.keyDown(document, { key: '?' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  }, 20000);

  it('Echap sort du plein ecran plutot que de fermer l aide', async () => {
    render(<App />);
    await waitFor(() => expect(document.querySelector('#mcv-main')).toBeTruthy(),
      { timeout: 15000 });
    const sortir = vi.fn(() => Promise.resolve());
    document.exitFullscreen = sortir;
    Object.defineProperty(document, 'fullscreenElement', {
      value: document.body, configurable: true,
    });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(sortir).toHaveBeenCalled();
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
  }, 20000);
});

describe('theme et contraste', () => {
  /** Petit consommateur du contexte de theme. */
  function Sonde() {
    const { mode, toggleTheme, highContrast, toggleContrast } = useThemeMode();
    return (
      <div>
        <span data-testid="mode">{mode}</span>
        <span data-testid="contraste">{String(highContrast)}</span>
        <button type="button" onClick={toggleTheme}>theme</button>
        <button type="button" onClick={toggleContrast}>contraste</button>
      </div>
    );
  }

  it('bascule entre sombre et clair', () => {
    renderSimple(<Sonde />);
    expect(screen.getByTestId('mode').textContent).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: 'theme' }));
    expect(screen.getByTestId('mode').textContent).toBe('light');
  });

  it('active le contraste renforce et le marque sur le document', () => {
    renderSimple(<Sonde />);
    fireEvent.click(screen.getByRole('button', { name: 'contraste' }));
    expect(screen.getByTestId('contraste').textContent).toBe('true');
    // Le marqueur sur <html> est ce que la feuille de style lit.
    expect(document.documentElement.getAttribute('data-contrast')).toBe('high');
    fireEvent.click(screen.getByRole('button', { name: 'contraste' }));
    expect(document.documentElement.getAttribute('data-contrast')).toBeNull();
  });

  it('retient le contraste choisi', () => {
    renderSimple(<Sonde />);
    fireEvent.click(screen.getByRole('button', { name: 'contraste' }));
    expect(localStorage.getItem('mcv-high-contrast')).toBe('true');
  });

  it('tient quand le stockage est refuse', () => {
    const vrai = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
    try {
      renderSimple(<Sonde />);
      expect(() => fireEvent.click(screen.getByRole('button', { name: 'contraste' })))
        .not.toThrow();
      expect(screen.getByTestId('contraste').textContent).toBe('true');
    } finally {
      Storage.prototype.setItem = vrai;
    }
  });
});

describe('garde-fou d erreur de route', () => {
  function Explose() { throw new Error('vue cassee'); }

  it('attrape l erreur d une vue et propose de reessayer', () => {
    // React journalise l'erreur : on la tait pour garder la sortie lisible.
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {});
    // `t` est passe en PROP (composant classe : pas de hook possible).
    renderSimple(
      <RouteErrorBoundary t={i18n.t.bind(i18n)}><Explose /></RouteErrorBoundary>,
    );
    // Un message plutot qu'une page blanche : c'est toute la difference.
    expect(document.body.textContent).toContain(i18n.t('error.pageTitle'));
    expect(screen.getByRole('button', { name: i18n.t('error.retry') })).toBeTruthy();
    erreur.mockRestore();
  });

  it('se remet en etat quand on reessaie', () => {
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {});
    let doitExploser = true;
    function Instable() {
      if (doitExploser) throw new Error('vue cassee');
      return <p>vue reparee</p>;
    }
    renderSimple(
      <RouteErrorBoundary t={i18n.t.bind(i18n)}><Instable /></RouteErrorBoundary>,
    );
    doitExploser = false;
    fireEvent.click(screen.getByRole('button', { name: i18n.t('error.retry') }));
    expect(document.body.textContent).toContain('vue reparee');
    erreur.mockRestore();
  });
});
