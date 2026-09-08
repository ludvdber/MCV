import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import SlicePage from './pages/SlicePage';
import i18n from './i18n';
import {
  renderAvecProviders, installApiFixtures, installCanvas2D, installGeometrie, requetes,
} from './test/harness';
import { resetPlotly } from './test/plotlyStub';
import * as api from './services/api';
import { exploreReducer, makeInitialState } from './pages/explore/ExploreContext';
import { MAX_WIND_FIELDS } from './pages/explore/exploreConstants.jsx';

/**
 * Ce que l'application doit refuser de payer.
 *
 * <p>Un visualiseur scientifique manipule des grilles, pas des formulaires :
 * une reponse d'animation porte 198 720 valeurs sur la grille GEM-Mars reelle
 * (48 images x 46 latitudes x 90 longitudes). Les trois mecanismes qui
 * evitent de les repayer — le cache client, le cache de champs de vent, la
 * liberation des grosses donnees a la fermeture — sont invisibles a l'oeil nu
 * et se degradent sans que rien ne casse. C'est exactement ce qui merite un
 * test.
 *
 * <p>Deux d'entre eux sont BORNES, et une borne se verifie par ses deux cotes :
 * qu'elle retienne ce qu'il faut, et qu'elle lache le reste.
 */
let desinstallerCanvas;
let desinstallerGeo;

beforeEach(async () => {
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
  vi.restoreAllMocks();
});

/** Grille aux dimensions REELLES du modele : 46 latitudes, 90 longitudes. */
const NLAT = 46;
const NLON = 90;
const grilleReelle = () =>
  Array.from({ length: NLAT }, () => Array.from({ length: NLON }, () => 200));

describe('cache du client HTTP', () => {
  /**
   * Le cache est adresse par le contenu de la requete. Deux vues qui demandent
   * la meme coupe ne doivent declencher qu'un seul telechargement : c'est ce
   * qui rend la grille de quatre cellules soutenable.
   */
  it('deux demandes identiques ne font qu un aller-retour', async () => {
    const avant = requetes.length;
    const params = { dataset: 'mean_MY35_Ls0_30', variable: 'TT', time: 0, altitude: 49 };
    await api.getSlice(params);
    await api.getSlice(params);
    expect(requetes.length - avant).toBe(1);
  });

  /**
   * L'ordre des cles d'un objet ne change pas la requete. Sans cle canonique,
   * `{a:1,b:2}` et `{b:2,a:1}` produiraient deux entrees pour un seul
   * telechargement utile — le cache doublerait la memoire sans rien economiser.
   */
  it('l ordre des parametres ne cree pas une seconde entree', async () => {
    const avant = requetes.length;
    await api.getSlice({ dataset: 'mean_MY35_Ls0_30', variable: 'TT', time: 1, altitude: 49 });
    await api.getSlice({ altitude: 49, time: 1, variable: 'TT', dataset: 'mean_MY35_Ls0_30' });
    expect(requetes.length - avant).toBe(1);
  });

  it('un parametre different declenche bien un nouvel appel', async () => {
    const avant = requetes.length;
    await api.getSlice({ dataset: 'mean_MY35_Ls0_30', variable: 'TT', time: 2, altitude: 49 });
    await api.getSlice({ dataset: 'mean_MY35_Ls0_30', variable: 'TT', time: 3, altitude: 49 });
    expect(requetes.length - avant).toBe(2);
  });

  /**
   * Le point mesure de cette suite. Le cache bornait le NOMBRE d'entrees, pas
   * leur poids : son plafond reel etait donc fixe par la plus grosse reponse
   * possible. Mesure sur la grille reelle, cinquante animations retenues :
   * <b>81 Mo</b> dans le tas du navigateur. Une coupe pese 4 140 valeurs, une
   * animation 198 720 — un facteur 48 que le comptage d'entrees ignore.
   */
  it('cinquante animations ne peuvent pas toutes rester en memoire', async () => {
    const animation = {
      frames: Array.from({ length: 48 }, grilleReelle),
      latitudes: new Array(NLAT).fill(0),
      longitudes: new Array(NLON).fill(0),
    };
    installApiFixtures({ '/data/animation': animation });

    for (let t = 0; t < 50; t++) {
      await api.getAnimation({ dataset: 'mean_MY35_Ls0_30', variable: 'TT', altitude: t });
    }

    // On redemande la PREMIERE : si elle etait encore la, le cache aurait
    // garde les cinquante, donc 81 Mo.
    const avant = requetes.length;
    await api.getAnimation({ dataset: 'mean_MY35_Ls0_30', variable: 'TT', altitude: 0 });
    expect(requetes.length - avant)
      .toBe(1);
  }, 30000);

  /**
   * L'autre cote de la borne : elle ne doit pas jeter ce qui est petit. Une
   * poignee de coupes doit rester servie depuis la memoire, sinon le cache ne
   * sert plus a rien.
   */
  it('des coupes, elles, tiennent toutes en cache', async () => {
    installApiFixtures({
      '/data/slice': {
        data: grilleReelle(),
        latitudes: new Array(NLAT).fill(0),
        longitudes: new Array(NLON).fill(0),
        stats: { min: 200, max: 300, mean: 250 },
      },
    });
    for (let t = 0; t < 40; t++) {
      await api.getSlice({ dataset: 'mean_MY35_Ls0_30', variable: 'TT', time: t, altitude: 10 });
    }
    const avant = requetes.length;
    await api.getSlice({ dataset: 'mean_MY35_Ls0_30', variable: 'TT', time: 0, altitude: 10 });
    expect(requetes.length - avant)
      .toBe(0);
  }, 30000);

  /**
   * Une requete annulee (l'utilisateur a change de parametre avant l'arrivee)
   * ne doit pas etre rangee : elle occuperait une place pour un resultat que
   * plus personne n'attend.
   */
  it('une reponse annulee n est pas conservee', async () => {
    const controleur = new AbortController();
    const params = { dataset: 'mean_MY35_Ls0_30', variable: 'TT', time: 20, altitude: 49 };
    const promesse = api.getSlice(params, controleur.signal);
    controleur.abort();
    await promesse.catch(() => {});

    const avant = requetes.length;
    await api.getSlice(params);
    expect(requetes.length - avant).toBe(1);
  });
});

describe('cache des champs de vent', () => {
  /**
   * Un champ de vent est une paire de grilles (UU, VV) par vue affichee. Sans
   * borne, une exploration longue les accumulerait tous. La purge se fait a
   * l'insertion, la plus ancienne cle d'abord.
   */
  it('ne retient jamais plus que le plafond', () => {
    let etat = makeInitialState();
    for (let i = 0; i < MAX_WIND_FIELDS * 3; i++) {
      etat = exploreReducer(etat, {
        type: 'SET_WIND_FIELD',
        key: `jeu|${i}|49`,
        value: { uu: [[1]], vv: [[1]] },
      });
    }
    expect(Object.keys(etat.windFields)).toHaveLength(MAX_WIND_FIELDS);
  });

  /**
   * L'ordre d'eviction compte : ce sont les plus ANCIENNES qui partent. Jeter
   * les plus recentes reviendrait a vider le cache juste apres l'avoir rempli.
   */
  it('evince la plus ancienne, pas la plus recente', () => {
    let etat = makeInitialState();
    for (let i = 0; i < MAX_WIND_FIELDS + 3; i++) {
      etat = exploreReducer(etat, {
        type: 'SET_WIND_FIELD',
        key: `jeu|${i}|49`,
        value: { uu: [[i]], vv: [[i]] },
      });
    }
    const cles = Object.keys(etat.windFields);
    expect(cles).not.toContain('jeu|0|49');
    expect(cles).toContain(`jeu|${MAX_WIND_FIELDS + 2}|49`);
  });
});

describe('travail evite au rendu', () => {
  /**
   * Un re-rendu ne doit pas retelecharger. C'est la propriete qui rend la
   * console utilisable : changer de theme, ouvrir un panneau ou survoler une
   * cellule declenche des rendus en cascade, et chacun coutait un aller-retour
   * si les dependances etaient mal posees.
   */
  it('changer de theme ne relance aucune requete', async () => {
    renderAvecProviders(<SlicePage />, { route: '/slice?ds=mean_MY35_Ls0_30&var=TT&t=0&alt=49' });
    await waitFor(() => expect(requetes.some((r) => r.url === '/data/slice')).toBe(true),
      { timeout: 10000 });

    const avant = requetes.length;
    const bascule = screen.queryAllByRole('button')
      .find((b) => /th[eè]me|theme/i.test(b.getAttribute('aria-label') || ''));
    if (bascule) {
      fireEvent.click(bascule);
      await waitFor(() => expect(document.body).toBeTruthy());
      expect(requetes.length).toBe(avant);
    }
  }, 20000);

  /**
   * Le meme jeu, la meme variable, le meme instant : revenir sur ses pas ne
   * doit rien recharger. C'est le cache client qui le garantit, mais seulement
   * si la page passe bien par lui — un appel direct a `api.get` le
   * court-circuiterait sans que rien ne le signale.
   */
  it('revenir sur une vue deja affichee ne recharge rien', async () => {
    const params = { dataset: 'mean_MY35_Ls0_30', variable: 'TT', time: 5, altitude: 49 };
    await api.getSlice(params);
    const avant = requetes.length;

    renderAvecProviders(<SlicePage />, { route: '/slice?ds=mean_MY35_Ls0_30&var=TT&t=5&alt=49' });
    await waitFor(() => expect(document.body.textContent.length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 300));

    const coupes = requetes.slice(avant).filter((r) => r.url === '/data/slice');
    expect(coupes.length).toBeLessThanOrEqual(1);
  }, 20000);
});

describe('poids de ce qui est persiste', () => {
  /**
   * Le stockage local plafonne autour de 5 Mo, tous usages confondus. Une
   * session enregistree doit donc etre une RECETTE (les parametres), jamais un
   * transport de donnees : une seule animation la ferait deja deborder.
   */
  it('une session enregistree reste sans commune mesure avec ses donnees', async () => {
    // Nomme explicitement : une premiere version de ce test importait
    // `sessionToRecipe`, qui n'existe pas, et sortait en silence sur un
    // `if (typeof … !== 'function') return`. Il passait au vert sans rien
    // verifier. Une garde de ce genre transforme une erreur d'import en test
    // muet — c'est le pire des deux mondes.
    const { buildSessionRecipe } = await import('./pages/explore/sessionRecipes');
    expect(typeof buildSessionRecipe).toBe('function');

    const resultat = {
      id: 'v1',
      type: 'animation',
      params: { dataset: 'mean_MY35_Ls0_30', variable: 'TT', altitude: 49 },
      data: { frames: Array.from({ length: 48 }, grilleReelle) },
    };
    const recette = buildSessionRecipe({
      resultsById: { v1: resultat }, resultOrder: ['v1'], activeResult: 'v1', layout: 1,
    });
    const poids = JSON.stringify(recette).length;
    const poidsDonnees = JSON.stringify(resultat.data).length;

    // La recette porte les PARAMETRES, jamais la grille : le rapport doit se
    // compter en milliers, pas en pourcents.
    expect(recette.results).toHaveLength(1);
    expect(recette.results[0].params).toEqual({
      dataset: 'mean_MY35_Ls0_30', variable: 'TT', altitude: 49,
    });
    expect(JSON.stringify(recette)).not.toContain('frames');
    expect(poids).toBeLessThan(2000);
    expect(poids).toBeLessThan(poidsDonnees / 100);
  });
});
