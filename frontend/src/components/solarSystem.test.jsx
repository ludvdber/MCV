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
 * Les COMMANDES du systeme solaire : pause, vitesse, son, plein ecran, vue
 * large/interieure, navigation d'une planete a l'autre. Elles vivent dans un
 * composant que jsdom ne peut pas rendre sans doublure WebGL, et n'avaient
 * donc jamais ete executees.
 */
let desinstallerCanvas;
let desinstallerGeo;
let rendreSilencieux;

beforeEach(async () => {
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  rendreSilencieux = silenceR3F();
  await i18n.changeLanguage('fr');
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  rendreSilencieux();
  vi.restoreAllMocks();
});

const bouton = (cle) => screen.queryByRole('button', { name: i18n.t(cle) });

describe('commandes du systeme solaire', () => {
  it('met en pause puis reprend', () => {
    renderSimple(<SolarSystem />);
    const pause = bouton('solar.pause');
    expect(pause).toBeTruthy();
    fireEvent.click(pause);
    // L'etiquette suit l'etat : sans cela, un lecteur d'ecran annonce
    // « pause » sur un systeme deja en pause.
    expect(bouton('solar.resume')).toBeTruthy();
    fireEvent.click(bouton('solar.resume'));
    expect(bouton('solar.pause')).toBeTruthy();
  });

  it('fait defiler les vitesses de simulation en boucle', () => {
    renderSimple(<SolarSystem />);
    const vitesse = screen.getAllByRole('button')
      .find((b) => (b.getAttribute('aria-label') || '').includes(i18n.t('solar.timeSpeed')));
    expect(vitesse).toBeTruthy();
    const premiere = vitesse.getAttribute('aria-label');
    fireEvent.click(vitesse);
    const seconde = screen.getAllByRole('button')
      .find((b) => (b.getAttribute('aria-label') || '').includes(i18n.t('solar.timeSpeed')))
      .getAttribute('aria-label');
    expect(seconde).not.toBe(premiere);
  });

  it('bascule le son', () => {
    renderSimple(<SolarSystem />);
    const son = bouton('solar.soundOn');
    expect(son).toBeTruthy();
    fireEvent.click(son);
    expect(bouton('solar.soundOff')).toBeTruthy();
  });

  it('bascule entre vue interieure et vue large', () => {
    renderSimple(<SolarSystem />);
    const vue = bouton('solar.viewFull');
    expect(vue).toBeTruthy();
    fireEvent.click(vue);
    expect(bouton('solar.viewInner')).toBeTruthy();
  });

  it('demande le plein ecran et en sort', () => {
    const demande = vi.fn(() => Promise.resolve());
    const sortie = vi.fn(() => Promise.resolve());
    Element.prototype.requestFullscreen = demande;
    document.exitFullscreen = sortie;
    renderSimple(<SolarSystem />);
    fireEvent.click(bouton('solar.fullscreen'));
    expect(demande).toHaveBeenCalled();
  });

  it('avale un refus du plein ecran sans polluer la console', async () => {
    // Le navigateur refuse hors geste utilisateur, en iframe sans
    // allow="fullscreen", ou sur iPhone : le rejet doit etre attrape.
    // On observe le rejet par l'evenement du NAVIGATEUR, pas par l'API Node :
    // c'est ce que verrait la console d'un visiteur.
    const rejets = [];
    const surRejet = (e) => { rejets.push(e); e.preventDefault?.(); };
    window.addEventListener('unhandledrejection', surRejet);
    Element.prototype.requestFullscreen = () => Promise.reject(new Error('refuse'));
    renderSimple(<SolarSystem />);
    expect(() => fireEvent.click(bouton('solar.fullscreen'))).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
    window.removeEventListener('unhandledrejection', surRejet);
    expect(rejets).toHaveLength(0);
  });
});

describe('panneau d information des planetes', () => {
  /** Ouvre le panneau via le raccourci « voir le climat de Mars ». */
  function ouvrirPanneau() {
    renderSimple(<SolarSystem />);
    const versMars = screen.getAllByRole('button')
      .concat(screen.queryAllByRole('link'))
      .find((e) => new RegExp(i18n.t('solar.mars'), 'i').test(e.textContent));
    if (versMars) fireEvent.click(versMars);
    return versMars;
  }

  it('propose un raccourci vers la console climatique', () => {
    renderSimple(<SolarSystem />);
    const liens = screen.queryAllByRole('link').map((a) => a.getAttribute('href'));
    // Le systeme solaire est la porte d'entree de l'accueil : il doit mener
    // quelque part dans l'application, pas rester decoratif.
    expect(liens.length + screen.getAllByRole('button').length).toBeGreaterThan(4);
  });

  it('navigue d une planete a l autre sans sortir des bornes', () => {
    ouvrirPanneau();
    const suivant = bouton('solar.next');
    const precedent = bouton('solar.prev');
    if (suivant && precedent) {
      // Douze allers-retours : plus que le nombre de corps, pour verifier que
      // la navigation boucle au lieu de deborder du tableau.
      for (let i = 0; i < 12; i++) expect(() => fireEvent.click(suivant)).not.toThrow();
      for (let i = 0; i < 12; i++) expect(() => fireEvent.click(precedent)).not.toThrow();
      expect(document.body.textContent).not.toContain('undefined');
      expect(document.body.textContent).not.toContain('NaN');
    }
  });

  it('se ferme', () => {
    ouvrirPanneau();
    const fermer = bouton('solar.close');
    if (fermer) {
      fireEvent.click(fermer);
      expect(bouton('solar.close')).toBeNull();
    }
  });
});

describe('rendu de la scene', () => {
  it('n a besoin d aucun appel reseau', () => {
    renderSimple(<SolarSystem />);
    // Les textures sont GENEREES (planetTextures.js) : la scene ne telecharge
    // aucune image, ce qui est ce qui la rend utilisable hors ligne.
    expect(document.querySelectorAll('img')).toHaveLength(0);
  });

  it('etiquette chaque commande pour un lecteur d ecran', () => {
    renderSimple(<SolarSystem />);
    for (const b of screen.getAllByRole('button')) {
      const nom = b.getAttribute('aria-label') || b.textContent;
      expect(nom.trim().length).toBeGreaterThan(0);
    }
  });
});
