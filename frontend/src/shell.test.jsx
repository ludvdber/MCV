import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';

// L'accueil est charge en `lazy()` par App et importe toute la pile 3D.
vi.mock('@react-three/fiber', async () => (await import('./test/r3fStub')).fiberStub);
vi.mock('@react-three/drei', async () => (await import('./test/r3fStub')).dreiStub);
vi.mock('@react-three/postprocessing', async () => (await import('./test/r3fStub')).postprocessingStub);
vi.mock('troika-three-text', async () => (await import('./test/r3fStub')).troikaStub);

const App = (await import('./App')).default;
const Sidebar = (await import('./components/Sidebar')).default;
const GuidedTour = (await import('./components/GuidedTour')).default;
const KeyboardShortcutsDialog = (await import('./components/KeyboardShortcutsDialog')).default;
const StarField = (await import('./components/StarField')).default;
const PageTransition = (await import('./components/PageTransition')).default;
const { silenceR3F } = await import('./test/r3fStub');
const { renderSimple, installApiFixtures, installCanvas2D, installGeometrie } =
  await import('./test/harness');
const i18n = (await import('./i18n')).default;
const { render } = await import('@testing-library/react');

/**
 * La coquille : routeur, barre laterale, SEO par route, visite guidee.
 * C'est le seul endroit ou le titre du document et les balises meta sont
 * ecrits — une SPA ne les change pas toute seule, et les moteurs voyaient
 * douze pages identiques.
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
  window.history.pushState({}, '', '/');
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  rendreSilencieux();
});

describe('App — routage et SEO', () => {
  // L'accueil est charge en `lazy()` et tire toute la pile 3D : sous charge
  // (suite complete en parallele) son import depasse le delai par defaut.
  it('monte l application et affiche l accueil', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getAllByRole('heading').length).toBeGreaterThan(0),
      { timeout: 15000 });
  }, 20000);

  it('ecrit un titre de document PROPRE a la route', async () => {
    window.history.pushState({}, '', '/slice');
    render(<App />);
    await waitFor(() => expect(document.title).toContain(i18n.t('nav.slice')), { timeout: 5000 });
    expect(document.title).toContain('Mars Climate Viewer');
  });

  it('pose une description, l Open Graph et un lien canonique', async () => {
    window.history.pushState({}, '', '/timeseries');
    render(<App />);
    await waitFor(() => {
      expect(document.head.querySelector('meta[name="description"]')?.content).toBeTruthy();
    }, { timeout: 5000 });
    expect(document.head.querySelector('meta[property="og:title"]')).toBeTruthy();
    const canonique = document.head.querySelector('link[rel="canonical"]');
    expect(canonique?.getAttribute('href')).toContain('/timeseries');
  });

  it('met le titre a jour quand la langue change', async () => {
    window.history.pushState({}, '', '/slice');
    render(<App />);
    await waitFor(() => expect(document.title).toContain(i18n.t('nav.slice')), { timeout: 5000 });
    const fr = document.title;
    await i18n.changeLanguage('en');
    await waitFor(() => expect(document.title).not.toBe(fr));
    await i18n.changeLanguage('fr');
  });

  it('sert une page 404 pour une route inconnue', async () => {
    window.history.pushState({}, '', '/route-qui-n-existe-pas');
    render(<App />);
    await waitFor(() => expect(document.body.textContent).toContain('404'), { timeout: 5000 });
  });

  it('pose un lien d evitement en PREMIER, vers le contenu principal', async () => {
    render(<App />);
    await waitFor(() => expect(document.querySelector('#mcv-main')).toBeTruthy(), { timeout: 5000 });
    // Atteindre le contenu de /slice coutait 23 tabulations sans ce lien.
    const evitement = document.body.querySelector('a[href="#mcv-main"], a[href*="mcv-main"]');
    expect(evitement).toBeTruthy();
    // Cache HORS ECRAN, jamais display:none : sinon il sort de l ordre de
    // tabulation et ne sert plus a rien.
    const style = getComputedStyle(evitement);
    expect(style.display).not.toBe('none');
    // La cible doit pouvoir recevoir le focus.
    expect(document.querySelector('#mcv-main').getAttribute('tabindex')).toBe('-1');
  });
});

describe('barre laterale', () => {
  // Les groupes de navigation s'ouvrent selon la LARGEUR d'ecran (repliés sous
  // 900 px, pour ne pas noyer un telephone sous douze liens). jsdom ne repond
  // a aucune media query : on impose donc la reponse.
  const largeurEcran = (large) => {
    window.matchMedia = (q) => ({
      matches: large && q.includes('min-width'),
      media: q, addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {},
    });
  };
  const matchMediaOrigine = window.matchMedia;
  afterEach(() => { window.matchMedia = matchMediaOrigine; });

  const rendreSidebar = (props = {}) => renderSimple(
    <Sidebar onToggleCollapse={vi.fn()} onShortcutsOpen={vi.fn()} {...props} />,
    { route: '/slice' },
  );

  it('sur un ecran etroit, les groupes partent replies', () => {
    largeurEcran(false);
    rendreSidebar();
    const liens = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(liens).not.toContain('/slice');
    // Les points d'entree principaux restent visibles.
    expect(liens).toContain('/');
    expect(liens).toContain('/explore');
  });

  it('deplier un groupe revele ses vues', () => {
    largeurEcran(false);
    rendreSidebar();
    const groupe = screen.getAllByRole('button')
      .find((b) => b.getAttribute('aria-expanded') === 'false');
    expect(groupe).toBeTruthy();
    fireEvent.click(groupe);
    expect(groupe.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href')).length)
      .toBeGreaterThan(3);
  });

  it('liste toutes les vues de l application', () => {
    largeurEcran(true);
    rendreSidebar();
    const liens = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    for (const route of ['/', '/explore', '/slice', '/timeseries', '/animation',
      '/profile', '/crosssection', '/hovmoller', '/zonalmean', '/windrose',
      '/difference', '/temporal-profile']) {
      expect(liens, route).toContain(route);
    }
  });

  it('marque la route courante comme selectionnee', () => {
    largeurEcran(true);
    rendreSidebar();
    const courant = screen.getAllByRole('link').find((a) => a.getAttribute('href') === '/slice');
    expect(courant.getAttribute('aria-current') ?? courant.className).toBeTruthy();
  });

  it('garde ses liens accessibles une fois repliee', () => {
    // Repliee, la barre n affiche que des icones : sans nom accessible, un
    // lecteur d ecran annonce « lien » douze fois.
    largeurEcran(true);
    rendreSidebar({ collapsed: true });
    for (const lien of screen.getAllByRole('link')) {
      const nom = lien.textContent || lien.getAttribute('aria-label') || lien.getAttribute('title');
      expect(nom, lien.getAttribute('href')).toBeTruthy();
    }
  });

  it('demande le repli a son parent', () => {
    const onToggleCollapse = vi.fn();
    rendreSidebar({ onToggleCollapse });
    const bascule = screen.getAllByRole('button')
      .find((b) => /repli|collapse|reduire/i.test(b.getAttribute('aria-label') || ''));
    if (bascule) {
      fireEvent.click(bascule);
      expect(onToggleCollapse).toHaveBeenCalled();
    }
  });

  it('traduit sa navigation', async () => {
    largeurEcran(true);
    const { unmount } = rendreSidebar();
    const fr = screen.getAllByRole('link').map((a) => a.textContent).join('|');
    unmount();
    await i18n.changeLanguage('nl');
    rendreSidebar();
    const nl = screen.getAllByRole('link').map((a) => a.textContent).join('|');
    expect(nl).not.toBe(fr);
    await i18n.changeLanguage('fr');
  });
});

describe('visite guidee', () => {
  const etapes = [
    { selector: '[data-tour="a"]', titleKey: 'explore.tour.params.title', bodyKey: 'explore.tour.params.body' },
    { selector: '[data-tour="b"]', titleKey: 'explore.tour.viz.title', bodyKey: 'explore.tour.viz.body' },
  ];

  beforeEach(() => {
    document.body.insertAdjacentHTML('beforeend',
      '<div data-tour="a">A</div><div data-tour="b">B</div>');
  });

  it('ne rend rien tant qu elle est fermee', () => {
    const { container } = renderSimple(
      <GuidedTour open={false} steps={etapes} onClose={vi.fn()} />,
    );
    expect(container.textContent).toBe('');
  });

  it('affiche la premiere etape a l ouverture', () => {
    renderSimple(<GuidedTour open steps={etapes} onClose={vi.fn()} />);
    expect(document.body.textContent).toContain(i18n.t('explore.tour.params.title'));
  });

  it('avance d une etape a l autre puis se ferme', () => {
    const onClose = vi.fn();
    renderSimple(<GuidedTour open steps={etapes} onClose={onClose} />);
    const boutons = screen.getAllByRole('button');
    for (const b of boutons) fireEvent.click(b);
    // Au bout de la visite, elle doit se fermer d elle-meme.
    expect(onClose).toHaveBeenCalled();
  });

  it('previent son parent du changement d etape', () => {
    const onStepChange = vi.fn();
    renderSimple(
      <GuidedTour open steps={etapes} onClose={vi.fn()} onStepChange={onStepChange} />,
    );
    expect(onStepChange).toHaveBeenCalled();
  });

  it('tient si la cible d une etape n existe pas dans le DOM', () => {
    // Les etapes sont FIGEES a l ouverture : une cible peut disparaitre
    // pendant la visite (fermeture d un panneau).
    expect(() => renderSimple(
      <GuidedTour open steps={[{ selector: '[data-tour="absent"]', titleKey: 'explore.tour.params.title', bodyKey: 'explore.tour.params.body' }]} onClose={vi.fn()} />,
    )).not.toThrow();
  });

  it('se ferme a la touche Echap', () => {
    const onClose = vi.fn();
    renderSimple(<GuidedTour open steps={etapes} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('dialogue des raccourcis clavier', () => {
  it('ne s affiche que lorsqu il est ouvert', () => {
    const { container } = renderSimple(
      <KeyboardShortcutsDialog open={false} onClose={vi.fn()} />,
    );
    expect(container.textContent).toBe('');
  });

  it('liste les raccourcis et se ferme', () => {
    const onClose = vi.fn();
    renderSimple(<KeyboardShortcutsDialog open onClose={onClose} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('decor', () => {
  it('le champ d etoiles est purement decoratif', () => {
    const { container } = renderSimple(<StarField />);
    // Aucun texte, aucun role : il ne doit rien annoncer a un lecteur d ecran.
    expect(container.textContent).toBe('');
    expect(container.querySelectorAll('[role]')).toHaveLength(0);
  });

  it('la transition de page laisse passer son contenu', () => {
    renderSimple(<PageTransition><p>contenu</p></PageTransition>);
    expect(document.body.textContent).toContain('contenu');
  });
});
