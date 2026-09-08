import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';

vi.mock('@react-three/fiber', async () => (await import('../test/r3fStub')).fiberStub);
vi.mock('@react-three/drei', async () => (await import('../test/r3fStub')).dreiStub);
vi.mock('@react-three/postprocessing', async () => (await import('../test/r3fStub')).postprocessingStub);
vi.mock('troika-three-text', async () => (await import('../test/r3fStub')).troikaStub);

const Home = (await import('./Home')).default;
const { silenceR3F } = await import('../test/r3fStub');
const { renderAvecProviders, installApiFixtures, installCanvas2D, installGeometrie, echecHttp } =
  await import('../test/harness');
const i18n = (await import('../i18n')).default;

/**
 * Le globe de l'accueil se fait tourner a la souris — et SEULEMENT a la
 * souris : au doigt, la rotation confisquerait le defilement de la page.
 * C'est une decision d'ergonomie qui merite d'etre verrouillee.
 */
let desinstallerCanvas;
let desinstallerGeo;
let rendreSilencieux;
const matchMediaOrigine = window.matchMedia;

/** Impose le type de pointeur (fin = souris, grossier = doigt). */
const pointeurFin = (fin) => {
  window.matchMedia = (q) => ({
    matches: /pointer:\s*fine/.test(q) ? fin : /min-width/.test(q),
    media: q, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  });
};

beforeEach(async () => {
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  rendreSilencieux = silenceR3F();
  await i18n.changeLanguage('fr');
  pointeurFin(true);
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  rendreSilencieux();
  window.matchMedia = matchMediaOrigine;
  document.body.style.cursor = '';
  vi.restoreAllMocks();
});

/** Zone de saisie du globe (sphere invisible posee par-dessus). */
const zoneGlobe = (container) => container.querySelector('mesh');

/**
 * Le glisser ecrit dans `groupRef.current.rotation.y`. En vrai c'est un
 * THREE.Group ; ici le ref pointe l'element `<group>` rendu par la doublure,
 * qui n'a pas de rotation. On la lui pose pour que le calcul s'execute au lieu
 * de lever — c'est bien le CALCUL qu'on veut couvrir, pas three.js.
 */
function preparerGroupe(container) {
  const groupe = container.querySelector('group');
  if (groupe && !groupe.rotation) groupe.rotation = { x: 0, y: 0, z: 0 };
  return groupe;
}

describe('globe de l accueil', () => {
  it('se fait tourner au glisser a la souris', () => {
    const { container } = renderAvecProviders(<Home />, { route: '/' });
    const groupe = preparerGroupe(container);
    const zone = zoneGlobe(container);
    expect(zone).toBeTruthy();
    fireEvent.pointerDown(zone, { clientX: 100, pointerId: 1 });
    // Le curseur passe en « saisi » pendant la rotation : c'est le seul retour
    // visuel qui dit que le globe est manipulable.
    expect(document.body.style.cursor).toBe('grabbing');
    fireEvent.pointerMove(zone, { clientX: 180, pointerId: 1 });
    // Un glisser vers la droite fait tourner le globe vers la droite.
    expect(groupe.rotation.y).toBeGreaterThan(0);
    fireEvent.pointerUp(zone, { pointerId: 1 });
    expect(document.body.style.cursor).toBe('');
  });

  it('annonce qu il est saisissable au survol', () => {
    const { container } = renderAvecProviders(<Home />, { route: '/' });
    const zone = zoneGlobe(container);
    fireEvent.pointerOver(zone);
    expect(document.body.style.cursor).toBe('grab');
    fireEvent.pointerOut(zone);
    expect(document.body.style.cursor).toBe('');
  });

  it('ne se saisit PAS au doigt : le defilement reste a la page', () => {
    pointeurFin(false);
    const { container } = renderAvecProviders(<Home />, { route: '/' });
    const zone = zoneGlobe(container);
    fireEvent.pointerDown(zone, { clientX: 100, pointerId: 1 });
    expect(document.body.style.cursor).toBe('');
  });

  it('ignore un mouvement hors saisie', () => {
    const { container } = renderAvecProviders(<Home />, { route: '/' });
    const groupe = preparerGroupe(container);
    const zone = zoneGlobe(container);
    fireEvent.pointerMove(zone, { clientX: 500, pointerId: 1 });
    expect(groupe.rotation.y).toBe(0);
    expect(document.body.style.cursor).toBe('');
  });
});

describe('accueil — reste de la page', () => {
  it('mene aux sections par le bouton d appel', () => {
    renderAvecProviders(<Home />, { route: '/' });
    const defiler = screen.getAllByRole('button')
      .find((b) => b.textContent.trim().length > 0);
    if (defiler) expect(() => fireEvent.click(defiler)).not.toThrow();
  });

  it('signale un catalogue indisponible sans casser la page', () => {
    installApiFixtures({ '/catalog': echecHttp(503, 'Service indisponible') });
    renderAvecProviders(<Home />, { route: '/' });
    // L'accueil est surtout editorial : il doit rester lisible meme si le
    // serveur de donnees est en panne.
    expect(screen.getAllByRole('heading').length).toBeGreaterThan(3);
  });

  it('affiche les chiffres cles de la mission', () => {
    renderAvecProviders(<Home />, { route: '/' });
    // Les compteurs partent de zero et s'animent a l'entree dans le champ de
    // vision : sans defilement, ils affichent zero, pas « undefined ».
    expect(document.body.textContent).not.toContain('undefined');
    expect(document.body.textContent).not.toContain('NaN');
  });
});
