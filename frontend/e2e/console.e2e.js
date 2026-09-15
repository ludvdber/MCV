import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ouvrir, aller, attendreUnGraphe,
  conteneursVides, superpositions, lectureVisibleIncoherente,
  debordementHorizontal, erreursReelles,
} from './harnais.js';

/**
 * La console Explorer au-dela du rideau : grilles, outils, sessions.
 *
 * C'est la partie la plus exposee de l'application, parce que la composition de
 * la zone de vues y change en permanence — une, deux ou quatre cartes, chacune
 * avec ses couches. Le code note lui-meme que Plotly fige la largeur de chaque
 * graphe en pixels et ne se recale que sur un evenement resize : toute
 * recomposition qui oublie ce reveil laisse un graphe plus large que son cadre,
 * et la page entiere se met a defiler lateralement. Cela ne leve rien, ne
 * journalise rien, et n'est pas mesurable dans jsdom.
 *
 * Chaque bascule d'outil provoque un redessin complet. On les enchaine donc en
 * verifiant les memes invariants apres chacune : c'est le moyen le moins cher
 * de couvrir beaucoup de chemins de rendu.
 */

let navigateur;
let page;
let erreurs;

/** Ouvre la console avec `n` coupes deja tracees, par permalien de session. */
async function ouvrirCoupes(n) {
  await aller(page, '/explore');
  const catalogue = await page.evaluate(async () => {
    const r = await fetch('/api/catalog');
    return r.ok ? r.json() : [];
  });
  expect(catalogue.length).toBeGreaterThan(1);

  const recette = {
    name: 'E2E console',
    layout: 1,
    activeIdx: 0,
    results: Array.from({ length: n }, (_, i) => ({
      type: 'slice',
      params: {
        dataset: catalogue[i % catalogue.length].id,
        variable: 'TT', time: 23, altitude: 49,
      },
    })),
  };
  const jeton = await page.evaluate((obj) => {
    const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }, recette);

  await aller(page, `/explore?session=${jeton}`);
  await attendreUnGraphe(page, 60000);
  await page.waitForFunction(
    (attendu) => document.querySelectorAll('[role="tab"]').length === attendu,
    n, { timeout: 40000 },
  );
}

/** Les quatre invariants, en un appel. */
async function invariants(page, contexte) {
  expect(await conteneursVides(page), `${contexte} : conteneur vide`).toEqual([]);
  expect(await superpositions(page, '.gtitle'), `${contexte} : titres superposes`).toEqual([]);
  expect(await superpositions(page, '.stats-bar'), `${contexte} : barres superposees`).toEqual([]);
  expect(await lectureVisibleIncoherente(page), `${contexte} : statistiques impossibles`).toEqual([]);
  expect(await debordementHorizontal(page), `${contexte} : debordement horizontal`).toEqual([]);
}

beforeAll(async () => { ({ navigateur, page, erreurs } = await ouvrir()); }, 120000);
afterAll(async () => { await navigateur?.close(); });

describe('console Explorer, rendu reel', () => {

  /**
   * Le passage d'une vue a quatre est la recomposition la plus brutale de
   * l'application : quatre graphes naissent dans des cadres quatre fois plus
   * petits. C'est le chemin ou un oubli de resize se voit tout de suite.
   */
  it('la grille de quatre vues trace ses quatre cartes sans deborder', async () => {
    erreurs.length = 0;
    await ouvrirCoupes(4);

    const grille = page.locator('button[aria-label*="grille" i]');
    expect(await grille.count(), 'le bouton de grille doit exister').toBeGreaterThan(0);
    await grille.first().click();
    await page.waitForTimeout(5000);

    const traces = await page.locator('div[role="img"].js-plotly-plot').count();
    expect(traces, 'les quatre cellules doivent porter un graphe trace').toBe(4);
    await invariants(page, 'grille de quatre');
    expect(erreursReelles(erreurs)).toEqual([]);
  }, 200000);

  it('le retour a une seule vue laisse une carte complete', async () => {
    const simple = page.locator('button[aria-label*="1 vue" i]');
    expect(await simple.count()).toBeGreaterThan(0);
    await simple.first().click();
    await page.waitForTimeout(3500);

    expect(await page.locator('div[role="img"].js-plotly-plot').count()).toBeGreaterThan(0);
    await invariants(page, 'retour a une vue');
  }, 150000);

  /**
   * Chaque outil provoque un redessin complet du graphe actif. On les enchaine
   * en verifiant les invariants apres chacun : une couche qui se pose mal, un
   * cadre qui ne se recale pas ou une statistique qui n'appartient plus au jeu
   * affiche se voient ici et nulle part ailleurs.
   */
  const OUTILS = [
    'Points d', 'Surface Mars', 'Tooltip', 'anomalie', 'Vecteurs de vent',
    'particules', 'Relief', 'logarithmique', 'Lissage',
  ];

  for (const outil of OUTILS) {
    it(`l outil « ${outil} » laisse la vue coherente`, async () => {
      erreurs.length = 0;
      const bouton = page.locator(`button[aria-label*="${outil}" i]`);
      if (await bouton.count() === 0) return;   // outil absent pour ce type de vue

      await bouton.first().click();
      await page.waitForTimeout(3000);
      await invariants(page, `outil ${outil} actif`);

      await bouton.first().click();             // on rend l'etat au suivant
      await page.waitForTimeout(2000);
      await invariants(page, `outil ${outil} eteint`);
      expect(erreursReelles(erreurs), `outil ${outil} : erreurs de console`).toEqual([]);
    }, 150000);
  }

  /**
   * Les sessions sont persistees dans localStorage et rejouees au retour. Une
   * restauration qui rate laisse une console vide, ou pire, des onglets sans
   * graphe : le compte d'onglets seul ne suffit donc pas a la declarer bonne.
   */
  it('recharger la page restaure des vues REELLEMENT tracees', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await attendreUnGraphe(page, 60000);
    await page.waitForTimeout(2500);

    expect(await page.locator('[role="tab"]').count(),
      'les onglets de la session doivent revenir').toBeGreaterThan(0);
    expect(await page.locator('div[role="img"].js-plotly-plot').count(),
      'un onglet restaure sans graphe est une console vide qui se croit pleine')
      .toBeGreaterThan(0);
    await invariants(page, 'apres rechargement');
  }, 200000);
});
