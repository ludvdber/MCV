import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
// L'accueil est charge en `lazy()` par App et tire toute la pile 3D, que jsdom
// ne sait pas dessiner : memes doublures que shell.test.jsx, posees AVANT
// l'import d'App.
vi.mock('@react-three/fiber', async () => (await import('./test/r3fStub')).fiberStub);
vi.mock('@react-three/drei', async () => (await import('./test/r3fStub')).dreiStub);
vi.mock('@react-three/postprocessing', async () => (await import('./test/r3fStub')).postprocessingStub);
vi.mock('troika-three-text', async () => (await import('./test/r3fStub')).troikaStub);

const App = (await import('./App')).default;
const SlicePage = (await import('./pages/SlicePage')).default;
const i18n = (await import('./i18n')).default;
const {
  renderAvecProviders, installApiFixtures, installCanvas2D, installGeometrie,
} = await import('./test/harness');
const { resetPlotly } = await import('./test/plotlyStub');
const { silenceR3F } = await import('./test/r3fStub');
const { render } = await import('@testing-library/react');
const { loadStoredSessions, STORAGE_KEY: CLE_SESSIONS } =
  await import('./pages/explore/sessionRecipes');
const { STORAGE_KEY: CLE_HISTORIQUE } = await import('./hooks/useRecentHistory');
const { intParam, floatParam, timeParam, altitudeParam } = await import('./utils/urlParams');

/**
 * Ce que le frontend recoit et ne controle pas.
 *
 * <p>Trois entrees arrivent de l'exterieur et aucune n'est digne de confiance :
 * le <b>stockage local</b> (partage avec toute autre page du meme domaine, et
 * avec quiconque utilise la machine), l'<b>URL</b> (un permalien se copie, se
 * modifie, se poste), et la <b>reponse du serveur</b> (tronquee par un proxy,
 * mise en cache dans une version anterieure, ou simplement d'une autre version
 * de l'API).
 *
 * <p>Le critere retenu n'est pas « l'application refuse » mais « l'application
 * ne casse pas ». Un ecran blanc est le pire resultat : l'ErrorBoundary
 * remplace la vue entiere et l'utilisateur n'a plus aucun moyen d'agir, alors
 * qu'une donnee ignoree lui laisse une interface utilisable.
 */
let desinstallerCanvas;
let desinstallerGeo;

let rendreSilencieux;

beforeEach(async () => {
  rendreSilencieux = silenceR3F();
  resetPlotly();
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  try { localStorage.clear(); } catch { /* mode prive */ }
  await i18n.changeLanguage('fr');
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  rendreSilencieux?.();
  vi.restoreAllMocks();
});

/** Charges hostiles ou simplement absurdes, ecrites dans le stockage local. */
const POISONS = [
  ['du JSON invalide', '{ceci n est pas du json'],
  ['une chaine nue', 'bonjour'],
  ['null', 'null'],
  ['un nombre', '42'],
  ['un tableau la ou on attend un objet', '[1,2,3]'],
  ['un objet vide', '{}'],
  ['une balise script', '<script>window.__pwn=1</script>'],
  ['un prototype pollue', '{"__proto__":{"pwn":true}}'],
  ['une profondeur excessive', `${'['.repeat(200)}${']'.repeat(200)}`],
  ['des champs du bon nom mais du mauvais type', '{"v":"x","sessions":"pas un tableau"}'],
];

describe('stockage local empoisonne', () => {
  /**
   * Le stockage est partage par toute page du meme domaine et survit aux
   * sessions. Une entree corrompue ne doit jamais empecher l'application de
   * demarrer : c'est un confort, pas une source de verite.
   */
  it.each(POISONS)('les sessions enregistrees survivent a %s', async (_nom, charge) => {
    localStorage.setItem(CLE_SESSIONS, charge);
    expect(() => loadStoredSessions()).not.toThrow();
    // Une charge non conforme doit etre REJETEE, pas acceptee a moitie.
    const lu = loadStoredSessions();
    expect(lu === null || (lu?.v && Array.isArray(lu.sessions))).toBe(true);
  });

  it('une pollution de prototype par le stockage ne contamine pas Object', () => {
    localStorage.setItem(CLE_SESSIONS, '{"v":1,"sessions":[],"__proto__":{"pwn":true}}');
    loadStoredSessions();
    // `JSON.parse` n'affecte pas le prototype, mais une fusion naive du resultat
    // dans un objet existant le ferait. Le test verrouille la propriete.
    expect({}.pwn).toBeUndefined();
  });

  it.each(POISONS)('l application demarre malgre un historique corrompu par %s', async (_nom, charge) => {
    localStorage.setItem(CLE_HISTORIQUE, charge);
    window.history.pushState({}, '', '/');
    render(<App />);
    // Le critere est le demarrage : si l'analyse levait, l'ErrorBoundary
    // remplacerait toute l'application par son ecran d'erreur, reconnaissable
    // a son bouton de retour.
    await waitFor(() => expect(screen.getAllByRole('heading').length).toBeGreaterThan(0),
      { timeout: 15000 });
    expect(screen.queryByRole('button', { name: i18n.t('error.backHome') })).toBeNull();
  }, 20000);

  it('un stockage indisponible (mode prive) ne bloque pas le demarrage', async () => {
    const vrai = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('refus', 'SecurityError'); },
    });
    try {
      window.history.pushState({}, '', '/');
      render(<App />);
      await waitFor(() => expect(screen.getAllByRole('heading').length).toBeGreaterThan(0),
        { timeout: 15000 });
    } finally {
      Object.defineProperty(window, 'localStorage', vrai);
    }
  });
});

describe('parametres d URL hostiles', () => {
  /**
   * Un permalien se copie et se modifie. Les valeurs qui en sortent servent
   * d'index (pas de temps, niveau d'altitude) et de coordonnees : elles ne
   * doivent jamais franchir l'analyse telles quelles.
   */
  const URLS = [
    '?t=999999&alt=-5',
    '?t=NaN&alt=Infinity',
    '?lat=1e400&lon=-1e400',
    '?t=0x10&alt=1e3',
    `?ds=${'A'.repeat(10000)}`,
    '?var=<script>alert(1)</script>',
    '?t[]=1&t[]=2',
    '?__proto__[pwn]=1',
    '?t=%00%01%02',
  ];

  it.each(URLS)('l analyse de « %s » ne leve pas et ne rend rien d absurde', (requete) => {
    const params = new URLSearchParams(requete);
    const lus = {};
    expect(() => {
      lus.t = timeParam(params);
      lus.alt = altitudeParam(params);
      lus.lat = floatParam(params, 'lat');
      lus.lon = floatParam(params, 'lon');
      lus.brut = intParam(params, 't');
    }).not.toThrow();

    // Rien de rendu ne doit etre NaN ni infini : ces valeurs servent ensuite
    // d'INDICE de tableau ou de borne d'axe.
    for (const [cle, valeur] of Object.entries(lus)) {
      if (valeur !== null) {
        expect(Number.isFinite(valeur), `${cle} = ${valeur}`).toBe(true);
      }
    }
    // Et un indice doit rester dans la table qu'il va servir a lire.
    if (lus.t !== null) expect(lus.t).toBeGreaterThanOrEqual(0);
    if (lus.alt !== null) expect(lus.alt).toBeGreaterThanOrEqual(0);
    expect({}.pwn).toBeUndefined();
  });

  /**
   * Le cas exact qui faisait tomber la page, garde comme repere : `-1` est un
   * entier fini, donc l'ancienne analyse le laissait passer, et il devenait un
   * indice negatif dans `AltitudeSelector`.
   */
  it('un indice negatif est rejete, pas transmis', () => {
    const p = new URLSearchParams('?alt=-1&t=-3');
    expect(altitudeParam(p)).toBeNull();
    expect(timeParam(p)).toBeNull();
    // La forme non bornee, elle, rend bien la valeur : c'est le bornage qui
    // protege, pas l'analyse.
    expect(intParam(p, 'alt')).toBe(-1);
  });

  it('un indice au-dela du modele est rejete aussi', () => {
    const p = new URLSearchParams('?alt=103&t=48');
    expect(altitudeParam(p)).toBeNull();
    expect(timeParam(p)).toBeNull();
    expect(altitudeParam(new URLSearchParams('?alt=102'))).toBe(102);
    expect(timeParam(new URLSearchParams('?t=47'))).toBe(47);
  });

  it('une page de visualisation se monte malgre une URL absurde', async () => {
    renderAvecProviders(<SlicePage />, {
      route: '/slice?ds=<img src=x onerror=alert(1)>&var=TT&t=99999&alt=-1',
    });
    await waitFor(() => expect(document.body.textContent.length).toBeGreaterThan(0));
    // Le texte hostile, s'il s'affiche, doit etre du TEXTE : React echappe tout
    // ce qui passe par ses enfants. Aucune balise ne doit avoir ete creee.
    expect(document.querySelector('img[onerror]')).toBeNull();
    expect(document.querySelectorAll('script')).toHaveLength(0);
  });
});

describe('reponses du serveur malformees', () => {
  /**
   * Le cas reel n'est pas un serveur malveillant, c'est une reponse
   * incomplete : un proxy qui tronque, une entree de cache anterieure a l'ajout
   * d'un champ, une version d'API differente. La vue doit alors rester vide,
   * pas disparaitre.
   */
  const REPONSES = [
    ['un objet vide', {}],
    ['des champs a null', { data: null, latitudes: null, longitudes: null }],
    ['des types inverses', { data: 'pas une grille', latitudes: 5, longitudes: {} }],
    ['une grille de NaN', { data: [[NaN, NaN]], latitudes: [0, 1], longitudes: [0, 1] }],
    ['des axes desaccordes', { data: [[1, 2, 3]], latitudes: [0, 1, 2, 3], longitudes: [0] }],
  ];

  it.each(REPONSES)('une coupe qui repond %s ne fait pas disparaitre la page', async (_nom, charge) => {
    installApiFixtures({ '/data/slice': charge });
    renderAvecProviders(<SlicePage />, { route: '/slice?ds=mean_MY35_Ls0_30&var=TT&t=0&alt=0' });

    await waitFor(() => expect(document.querySelector('main, [role="main"]') ?? document.body)
      .toBeTruthy());
    // L'interface reste manipulable : au moins un bouton repond encore.
    await waitFor(() => expect(screen.queryAllByRole('button').length).toBeGreaterThan(0));
  });
});

describe('regles de source', () => {
  /**
   * Certaines proprietes se verifient mieux sur le TEXTE du code que sur son
   * execution : elles doivent tenir sur tous les chemins, y compris ceux
   * qu'aucun test ne parcourt.
   */
  // Vitest s'execute depuis `frontend/`, et `import.meta.url` n'y est pas une
  // URL file:// exploitable : on part du repertoire de travail, qui l'est.
  const RACINE = join(globalThis.process.cwd(), 'src');

  function fichiersSource(dossier = RACINE, acc = []) {
    for (const nom of readdirSync(dossier)) {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) {
        if (nom !== 'test' && nom !== 'node_modules') fichiersSource(chemin, acc);
      } else if (/\.jsx?$/.test(nom) && !/\.test\.jsx?$/.test(nom)) {
        acc.push(chemin);
      }
    }
    return acc;
  }

  /**
   * `dangerouslySetInnerHTML` est le seul moyen, en React, de transformer une
   * chaine en balisage. Tant qu'il n'apparait nulle part, aucune donnee — du
   * serveur, du stockage ou de l'URL — ne peut devenir du HTML executable.
   */
  it('aucun fichier n injecte de HTML brut', () => {
    const fautifs = fichiersSource().filter((f) => {
      const src = readFileSync(f, 'utf8');
      return /dangerouslySetInnerHTML|\.innerHTML\s*=|insertAdjacentHTML|document\.write/.test(src);
    });
    expect(fautifs).toEqual([]);
  });

  it('aucun fichier n evalue de chaine', () => {
    const fautifs = fichiersSource().filter((f) => {
      const src = readFileSync(f, 'utf8');
      // `setTimeout('...')` avec une chaine est un eval deguise.
      return /\beval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*['"`]/.test(src);
    });
    expect(fautifs).toEqual([]);
  });

  /**
   * Une page ouverte par {@code target="_blank"} peut, sans {@code
   * rel="noopener"}, rediriger l'onglet d'origine par {@code window.opener}.
   * Les navigateurs recents l'appliquent d'office, mais le site doit rester
   * correct sur un navigateur qui ne le fait pas.
   */
  it('tout lien ouvrant un nouvel onglet porte rel="noopener"', () => {
    const fautifs = [];
    for (const f of fichiersSource()) {
      const src = readFileSync(f, 'utf8');
      for (const bloc of src.split(/(?=<)/)) {
        if (!bloc.includes('target="_blank"')) continue;
        // La balise s'etend jusqu'a son premier `>` non imbrique : on regarde
        // les attributs voisins, pas le fichier entier.
        const attributs = src.slice(src.indexOf(bloc), src.indexOf(bloc) + 400);
        if (!/rel=\{?["'][^"']*noopener/.test(attributs)) fautifs.push(f);
      }
    }
    expect([...new Set(fautifs)]).toEqual([]);
  });
});
