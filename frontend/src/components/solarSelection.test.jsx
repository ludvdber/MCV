import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';

vi.mock('@react-three/fiber', async () => (await import('../test/r3fStub')).fiberStub);
vi.mock('@react-three/drei', async () => (await import('../test/r3fStub')).dreiStub);
vi.mock('@react-three/postprocessing', async () => (await import('../test/r3fStub')).postprocessingStub);
vi.mock('troika-three-text', async () => (await import('../test/r3fStub')).troikaStub);

const SolarSystem = (await import('./SolarSystem')).default;
const { silenceR3F } = await import('../test/r3fStub');
const { renderSimple, installCanvas2D, installGeometrie, installApiFixtures } =
  await import('../test/harness');
const i18n = (await import('../i18n')).default;

/**
 * SELECTION dans la scene 3D et sonification. Les corps sont cliquables par
 * une sphere de detection invisible ; sans WebGL, la doublure R3F les rend
 * comme des elements ordinaires portant le meme `onClick`, ce qui rend la
 * selection testable. La sonification, elle, demande une API Web Audio que
 * jsdom n'a pas : on la fournit pour executer le code au lieu de le sauter.
 */
let desinstallerCanvas;
let desinstallerGeo;
let rendreSilencieux;
let notes;

/** Web Audio minimal : compte les notes jouees. */
function installerAudio() {
  notes = [];
  class FauxOscillateur {
    constructor() { this.frequency = { value: 0 }; this.type = 'sine'; }
    connect(n) { return n; }
    start() { notes.push(this.frequency.value); }
    stop() {}
  }
  class FauxGain {
    constructor() {
      this.gain = {
        setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {},
      };
    }
    connect(n) { return n; }
  }
  class FauxAudioContext {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; }
    resume() { this.state = 'running'; }
    createOscillator() { return new FauxOscillateur(); }
    createGain() { return new FauxGain(); }
  }
  vi.stubGlobal('AudioContext', FauxAudioContext);
}

beforeEach(async () => {
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  rendreSilencieux = silenceR3F();
  installerAudio();
  await i18n.changeLanguage('fr');
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  rendreSilencieux();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('selection dans la scene', () => {
  it('cliquer un corps ouvre son panneau d information', () => {
    const { container } = renderSimple(<SolarSystem />);
    const zones = [...container.querySelectorAll('mesh')];
    expect(zones.length).toBeGreaterThan(5);
    // On clique jusqu'a ce qu'un panneau s'ouvre : l'ordre exact des meshes
    // dans la scene n'est pas un contrat.
    for (const z of zones) {
      fireEvent.click(z);
      if (screen.queryByRole('button', { name: i18n.t('solar.close') })) break;
    }
    expect(screen.queryByRole('button', { name: i18n.t('solar.close') })).toBeTruthy();
  });

  it('le panneau donne les grandeurs physiques du corps', () => {
    const { container } = renderSimple(<SolarSystem />);
    for (const z of [...container.querySelectorAll('mesh')]) {
      fireEvent.click(z);
      if (screen.queryByRole('button', { name: i18n.t('solar.close') })) break;
    }
    const texte = document.body.textContent;
    // Diametre, gravite, annee : ce sont ces chiffres qui font du systeme
    // solaire autre chose qu'une decoration.
    expect(texte).toMatch(/km/);
    expect(texte).not.toContain('undefined');
    expect(texte).not.toContain('NaN');
  });

  it('le survol d un corps change le curseur puis le rend', () => {
    const { container } = renderSimple(<SolarSystem />);
    const zone = container.querySelector('mesh');
    fireEvent.pointerOver(zone);
    fireEvent.pointerOut(zone);
    // Un curseur « pointer » laisse sur le corps de la page apres la sortie
    // reste actif partout ailleurs.
    expect(document.body.style.cursor).toBe('');
  });

  it('navigue d un corps a l autre depuis le panneau', () => {
    const { container } = renderSimple(<SolarSystem />);
    for (const z of [...container.querySelectorAll('mesh')]) {
      fireEvent.click(z);
      if (screen.queryByRole('button', { name: i18n.t('solar.next') })) break;
    }
    const suivant = screen.queryByRole('button', { name: i18n.t('solar.next') });
    const precedent = screen.queryByRole('button', { name: i18n.t('solar.prev') });
    expect(suivant).toBeTruthy();
    // Un tour complet dans les deux sens : la navigation doit boucler sans
    // jamais sortir du tableau des corps.
    for (let i = 0; i < 14; i++) fireEvent.click(suivant);
    for (let i = 0; i < 14; i++) fireEvent.click(precedent);
    expect(document.body.textContent).not.toContain('undefined');
  });

  it('ferme le panneau et revient a la vue d ensemble', () => {
    const { container } = renderSimple(<SolarSystem />);
    for (const z of [...container.querySelectorAll('mesh')]) {
      fireEvent.click(z);
      if (screen.queryByRole('button', { name: i18n.t('solar.close') })) break;
    }
    fireEvent.click(screen.getByRole('button', { name: i18n.t('solar.close') }));
    expect(screen.queryByRole('button', { name: i18n.t('solar.close') })).toBeNull();
  });
});

describe('sonification', () => {
  it('reste MUETTE tant que le son n est pas demande', () => {
    renderSimple(<SolarSystem />);
    // Un son qui demarre tout seul au chargement d'une page d'accueil est une
    // faute : rien ne doit sortir avant un geste explicite.
    expect(notes).toHaveLength(0);
  });

  it('accepte d etre activee sans exiger l API audio', () => {
    // Certains navigateurs bloquent AudioContext hors geste utilisateur ; le
    // bouton doit fonctionner quand meme.
    vi.stubGlobal('AudioContext', undefined);
    renderSimple(<SolarSystem />);
    expect(() => fireEvent.click(screen.getByRole('button', { name: i18n.t('solar.soundOn') })))
      .not.toThrow();
  });

  it('bascule l etiquette du bouton dans les deux sens', () => {
    renderSimple(<SolarSystem />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('solar.soundOn') }));
    const couper = screen.getByRole('button', { name: i18n.t('solar.soundOff') });
    fireEvent.click(couper);
    expect(screen.getByRole('button', { name: i18n.t('solar.soundOn') })).toBeTruthy();
  });
});

describe('vue et cadrage', () => {
  it('la vue large et la vue interieure sont exclusives', () => {
    renderSimple(<SolarSystem />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('solar.viewFull') }));
    expect(screen.queryByRole('button', { name: i18n.t('solar.viewFull') })).toBeNull();
    expect(screen.getByRole('button', { name: i18n.t('solar.viewInner') })).toBeTruthy();
  });

  it('suit le plein ecran demande par le navigateur', () => {
    const { container } = renderSimple(<SolarSystem />);
    Object.defineProperty(document, 'fullscreenElement', {
      value: container.firstChild, configurable: true,
    });
    fireEvent(document, new Event('fullscreenchange'));
    // L'etiquette doit refleter l'etat REEL : l'utilisateur peut sortir du
    // plein ecran par la touche Echap, sans passer par le bouton.
    expect(screen.queryByRole('button', { name: i18n.t('solar.exitFullscreen') })).toBeTruthy();
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
  });
});
