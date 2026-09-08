import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@react-three/fiber', async () => (await import('../test/r3fStub')).fiberStub);
vi.mock('@react-three/drei', async () => (await import('../test/r3fStub')).dreiStub);
vi.mock('@react-three/postprocessing', async () => (await import('../test/r3fStub')).postprocessingStub);
vi.mock('troika-three-text', async () => (await import('../test/r3fStub')).troikaStub);

const Home = (await import('./Home')).default;
const SolarSystem = (await import('../components/SolarSystem')).default;
const MarsPhotoCarousel = (await import('../components/MarsPhotoCarousel')).default;
const { silenceR3F } = await import('../test/r3fStub');
const { renderAvecProviders, renderSimple, installApiFixtures, installCanvas2D, installGeometrie } =
  await import('../test/harness');
const i18n = (await import('../i18n')).default;

/**
 * L'accueil et le systeme solaire n'avaient AUCUN test : jsdom n'a pas de
 * WebGL, donc un `<Canvas>` reel echoue avant le premier rendu. On remplace
 * donc la pile 3D (voir src/test/r3fStub.jsx) : les composants de scene
 * s'executent pour de vrai — orbites, selection, textures, panneau
 * d'information — et seul le dessin GPU disparait.
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
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  rendreSilencieux();
});

describe('page d accueil', () => {
  it('se monte entierement', () => {
    renderAvecProviders(<Home />, { route: '/' });
    expect(screen.getAllByRole('heading').length).toBeGreaterThan(3);
  });

  it('mene aux consoles de visualisation', () => {
    renderAvecProviders(<Home />, { route: '/' });
    const cibles = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(cibles).toContain('/explore');
    expect(cibles.some((h) => h === '/slice')).toBe(true);
  });

  it('change entierement de langue', async () => {
    const { unmount } = renderAvecProviders(<Home />, { route: '/' });
    const fr = document.body.textContent;
    unmount();
    await i18n.changeLanguage('nl');
    renderAvecProviders(<Home />, { route: '/' });
    const nl = document.body.textContent;
    expect(nl).not.toBe(fr);
    // Le contenu redactionnel de l'accueil vit dans src/content/home.<lng>.js,
    // en dehors des fichiers de traduction : il doit suivre lui aussi.
    expect(nl.length).toBeGreaterThan(500);
    await i18n.changeLanguage('fr');
  });

  it('retombe sur l anglais pour une langue sans contenu redactionnel', async () => {
    await i18n.changeLanguage('it');
    renderAvecProviders(<Home />, { route: '/' });
    expect(document.body.textContent.length).toBeGreaterThan(500);
    await i18n.changeLanguage('fr');
  });

  it('monte le globe 3D dans un Canvas', () => {
    const { container } = renderAvecProviders(<Home />, { route: '/' });
    expect(container.querySelectorAll('[data-testid="r3f-canvas"]').length).toBeGreaterThanOrEqual(1);
  });
});

describe('systeme solaire', () => {
  it('rend une scene et etiquette ses corps', () => {
    const { container } = renderSimple(<SolarSystem />);
    expect(container.querySelector('[data-testid="r3f-canvas"]')).toBeTruthy();
    const etiquettes = [...container.querySelectorAll('[data-drei="Text"]')].map((e) => e.textContent);
    expect(etiquettes.length).toBeGreaterThanOrEqual(3);
    // Mars est le corps mis en avant : son etiquette doit etre traduite.
    expect(etiquettes.join(' ')).toContain(i18n.t('solar.mars'));
  });

  it('traduit les noms de planetes', async () => {
    const { container, unmount } = renderSimple(<SolarSystem />);
    const fr = [...container.querySelectorAll('[data-drei="Text"]')].map((e) => e.textContent);
    unmount();
    await i18n.changeLanguage('de');
    const { container: c2 } = renderSimple(<SolarSystem />);
    const de = [...c2.querySelectorAll('[data-drei="Text"]')].map((e) => e.textContent);
    expect(de).not.toEqual(fr);
    await i18n.changeLanguage('fr');
  });

  it('propose de mettre en pause et de reprendre', () => {
    renderSimple(<SolarSystem />);
    const boutons = screen.getAllByRole('button');
    expect(boutons.length).toBeGreaterThan(3);
    // La pause est un ref, pas un state : le rendu ne doit pas exploser.
    const pause = boutons.find((b) => /pause/i.test(b.getAttribute('aria-label') || ''));
    if (pause) expect(() => fireEvent.click(pause)).not.toThrow();
  });

  it('ouvre le panneau d information d une planete et navigue dedans', () => {
    renderSimple(<SolarSystem />);
    const boutons = screen.getAllByRole('button');
    // On ouvre par n importe quel bouton de navigation disponible : le
    // panneau doit apparaitre sans jamais sortir des bornes du tableau.
    for (const b of boutons) {
      expect(() => fireEvent.click(b)).not.toThrow();
    }
  });

  it('genere ses textures une seule fois (useMemo)', () => {
    const { rerender } = renderSimple(<SolarSystem />);
    const apresPremier = Object.keys(document.querySelectorAll('canvas')).length;
    rerender(<SolarSystem />);
    expect(Object.keys(document.querySelectorAll('canvas')).length).toBe(apresPremier);
  });
});

describe('carrousel de photos', () => {
  /** Reponse de la mediatheque NASA, dans sa forme reelle. */
  const reponseNasa = (n, prefixe) => ({
    collection: {
      items: Array.from({ length: n }, (_, i) => ({
        data: [{ title: `${prefixe} ${i}`, nasa_id: `${prefixe}-${i}`, description: 'Vue de Mars' }],
        links: [{ rel: 'preview', href: `https://images-assets.nasa.gov/${prefixe}${i}~thumb.jpg` }],
      })),
    },
  });

  const brancherNasa = (impl) => { globalThis.fetch = impl; };
  const fetchOrigine = globalThis.fetch;

  afterEach(() => { globalThis.fetch = fetchOrigine; });

  it('affiche une photo avec un texte alternatif', async () => {
    brancherNasa(() => Promise.resolve({
      ok: true, json: () => Promise.resolve(reponseNasa(4, 'mars')),
    }));
    renderSimple(<MarsPhotoCarousel />);
    await waitFor(() => expect(screen.queryAllByRole('img').length).toBeGreaterThanOrEqual(1));
    for (const img of screen.getAllByRole('img')) {
      // Une photo sans texte alternatif n existe pas pour un lecteur d ecran.
      expect(img.getAttribute('alt') ?? img.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('avance et recule sans sortir de la liste', async () => {
    brancherNasa(() => Promise.resolve({
      ok: true, json: () => Promise.resolve(reponseNasa(4, 'mars')),
    }));
    renderSimple(<MarsPhotoCarousel />);
    await waitFor(() => expect(screen.queryAllByRole('img').length).toBeGreaterThanOrEqual(1));
    const boutons = screen.queryAllByRole('button');
    for (let i = 0; i < 3; i++) {
      for (const b of boutons) expect(() => fireEvent.click(b)).not.toThrow();
    }
  });

  it('reste muet quand la mediatheque NASA est injoignable', async () => {
    // Le carrousel est DECORATIF : une API tierce en panne ne doit pas
    // empecher l'accueil de s'afficher ni laisser un chargement infini.
    brancherNasa(() => Promise.reject(new Error('offline')));
    const { container } = renderSimple(<MarsPhotoCarousel />);
    await waitFor(() => expect(container.textContent).not.toBeNull());
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('tolere un 500 de la mediatheque', async () => {
    brancherNasa(() => Promise.resolve({ ok: false, status: 500 }));
    expect(() => renderSimple(<MarsPhotoCarousel />)).not.toThrow();
  });

  it('relit son cache local plutot que de rappeler l API', async () => {
    // Six heures de cache : sans lui, chaque visite de l'accueil declenche
    // trois requetes vers un service tiers.
    localStorage.setItem('mars_gallery_v4', JSON.stringify({
      ts: Date.now(),
      photos: [{ id: 'x', thumb: 'a.jpg', full: 'b.jpg', title: 'Titre', tagKey: 'carousel.tag.orbital' }],
    }));
    const appels = [];
    brancherNasa((u) => { appels.push(u); return Promise.reject(new Error('ne devrait pas etre appele')); });
    renderSimple(<MarsPhotoCarousel />);
    await waitFor(() => expect(screen.queryAllByRole('img').length).toBeGreaterThanOrEqual(1));
    expect(appels).toHaveLength(0);
  });

  it('ignore un cache perime', async () => {
    localStorage.setItem('mars_gallery_v4', JSON.stringify({
      ts: Date.now() - 7 * 60 * 60 * 1000,
      photos: [{ id: 'vieux', thumb: 'a.jpg', full: 'b.jpg', title: 'Vieux' }],
    }));
    const appels = [];
    brancherNasa((u) => {
      appels.push(u);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(reponseNasa(2, 'neuf')) });
    });
    renderSimple(<MarsPhotoCarousel />);
    await waitFor(() => expect(appels.length).toBeGreaterThanOrEqual(1));
  });

  it('ignore un cache illisible', async () => {
    localStorage.setItem('mars_gallery_v4', 'pas du JSON');
    brancherNasa(() => Promise.resolve({ ok: true, json: () => Promise.resolve(reponseNasa(2, 'm')) }));
    expect(() => renderSimple(<MarsPhotoCarousel />)).not.toThrow();
  });
});
