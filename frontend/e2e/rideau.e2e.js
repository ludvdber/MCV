import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ouvrir, aller, attendreUnGraphe, passerLaVisite,
  conteneursVides, superpositions, lectureVisibleIncoherente, erreursReelles,
} from './harnais.js';

/**
 * Le rideau A/B dans un vrai navigateur.
 *
 * Trois defauts ont vecu ici en production sous une suite jsdom verte :
 *   1. le volet A n'etait pas trace du tout — conteneur present, contenu vide ;
 *   2. les deux barres de statistiques se posaient au meme endroit et le
 *      rideau les tranchait, si bien qu'on lisait le minimum d'un volet et la
 *      moyenne de l'autre (moyenne 176,9 sous un maximum affiche a 173,6) ;
 *   3. les deux titres centres se recouvraient a 94 %.
 *
 * Les trois sont des enonces sur des POSITIONS et des CONTENUS RENDUS. Aucun
 * n'est exprimable dans jsdom, qui ne calcule ni l'un ni l'autre. Le test qui
 * existait montait CurtainCompare isole et verifiait l'echelle de couleurs
 * commune : correct, et structurellement aveugle a tout ceci.
 *
 * Le scenario est monte par permalien de session, a partir du catalogue REEL du
 * serveur vise : pas de pilotage d'interface fragile, et le jeu de donnees
 * suit ce que le serveur possede vraiment.
 */

let navigateur;
let page;
let erreurs;

/** Deux coupes de la meme variable, sur deux jeux differents. */
async function ouvrirDeuxCoupes() {
  await aller(page, '/explore');
  const catalogue = await page.evaluate(async () => {
    const r = await fetch('/api/catalog');
    return r.ok ? r.json() : [];
  });
  expect(catalogue.length,
    'le serveur vise doit exposer au moins deux jeux MEAN').toBeGreaterThan(1);

  const recette = {
    name: 'E2E rideau',
    layout: 1,
    activeIdx: 0,
    results: [catalogue[0].id, catalogue[catalogue.length - 1].id].map((dataset) => ({
      type: 'slice',
      params: { dataset, variable: 'TT', time: 23, altitude: 49 },
    })),
  };
  const jeton = await page.evaluate((obj) => {
    const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }, recette);

  await aller(page, `/explore?session=${jeton}`);
  await attendreUnGraphe(page);
  await page.waitForFunction(() => document.querySelectorAll('[role="tab"]').length === 2,
    null, { timeout: 30000 });
}

async function activerLeRideau() {
  const bouton = page.locator('button[aria-label*="ideau" i]');
  expect(await bouton.count(),
    'le bouton du rideau doit apparaitre des qu il y a deux coupes comparables').toBe(1);
  await bouton.first().click();
  await page.waitForTimeout(3500);
}

beforeAll(async () => {
  ({ navigateur, page, erreurs } = await ouvrir());
  await ouvrirDeuxCoupes();
  await activerLeRideau();
}, 180000);

afterAll(async () => { await navigateur?.close(); });

describe('rideau A/B, rendu reel', () => {

  it('trace les DEUX volets : aucun conteneur a taille pleine et vide', async () => {
    const vides = await conteneursVides(page);
    expect(vides,
      'un conteneur de la bonne taille au contenu vide est un trou dans la page,'
      + ' pas une erreur : rien ne le signale a l utilisateur').toEqual([]);
  });

  it('ne superpose pas deux titres', async () => {
    const paires = await superpositions(page, '.gtitle');
    expect(paires, 'deux titres centres au meme endroit se lisent en double').toEqual([]);
  });

  it('ne superpose pas deux barres de statistiques', async () => {
    const paires = await superpositions(page, '.stats-bar');
    expect(paires,
      'deux barres empilees sont tranchees par le rideau : on lit alors la moitie'
      + ' des nombres d un volet et la moitie de l autre').toEqual([]);
  });

  /**
   * L'invariant qui compte vraiment : il est arithmetique, pas visuel. Une
   * moyenne et une mediane vivent entre le minimum et le maximum, toujours.
   * C'est cette propriete que le melange des deux volets detruisait.
   */
  it('affiche des statistiques arithmetiquement possibles', async () => {
    const fautes = await lectureVisibleIncoherente(page);
    expect(fautes,
      'une moyenne hors des bornes affichees signale des nombres venus de deux jeux')
      .toEqual([]);
  });

  it('nomme les deux jeux compares', async () => {
    const texte = await page.locator('body').innerText();
    expect(texte).toMatch(/A\s*·/);
    expect(texte).toMatch(/B\s*·/);
  });

  /**
   * Le rideau se deplace : les invariants doivent tenir a toutes ses positions,
   * pas seulement a 50 %. Une barre tranchee ailleurs reste une barre tranchee.
   */
  it('tient ses invariants quand la poignee se deplace', async () => {
    const poignee = page.locator('[role="slider"][aria-label*="oign"]');
    expect(await poignee.count()).toBe(1);
    await poignee.focus();

    for (const [tour, touche] of [[8, 'ArrowLeft'], [16, 'ArrowRight']]) {
      for (let i = 0; i < tour; i++) await page.keyboard.press(touche);
      await page.waitForTimeout(600);
      expect(await conteneursVides(page)).toEqual([]);
      expect(await lectureVisibleIncoherente(page)).toEqual([]);
      expect(await superpositions(page, '.stats-bar')).toEqual([]);
    }
  });

  /**
   * Basculer d'onglet pendant que le rideau est ouvert REMONTE le composant
   * (sa cle contient les deux identifiants). C'est par ce chemin que les deux
   * volets se tracaient tous les deux, et donc que les deux titres centres
   * finissaient l'un sur l'autre : le defaut d'affichage n'apparaissait qu'apres
   * cette action, ce qui le faisait passer pour intermittent. Les invariants
   * doivent tenir des deux cotes de la bascule.
   */
  it('tient ses invariants apres une bascule d onglet', async () => {
    const onglets = page.locator('[role="tab"]');
    expect(await onglets.count()).toBe(2);
    await onglets.nth(1).click();
    await page.waitForTimeout(4000);

    expect(await conteneursVides(page)).toEqual([]);
    expect(await superpositions(page, '.gtitle')).toEqual([]);
    expect(await superpositions(page, '.stats-bar')).toEqual([]);
    expect(await lectureVisibleIncoherente(page)).toEqual([]);

    await onglets.nth(0).click();
    await page.waitForTimeout(3000);
    expect(await conteneursVides(page)).toEqual([]);
    expect(await superpositions(page, '.gtitle')).toEqual([]);
  });

  it('ne laisse aucune erreur dans la console', async () => {
    expect(erreursReelles(erreurs)).toEqual([]);
  });

  /**
   * Sortir du rideau doit rendre une vue simple complete. Le meme mecanisme de
   * ref partagee jouait dans les deux sens : rien ne garantissait le retour.
   */
  it('rend une vue simple complete en sortant du rideau', async () => {
    await page.locator('button[aria-label*="ideau" i]').first().click();
    await page.waitForTimeout(2500);
    await passerLaVisite(page);

    expect(await conteneursVides(page)).toEqual([]);
    expect(await lectureVisibleIncoherente(page)).toEqual([]);
    const traces = await page.locator('div[role="img"].js-plotly-plot').count();
    expect(traces, 'la vue simple doit afficher sa carte').toBeGreaterThan(0);
  });
});
