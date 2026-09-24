import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  BASE, ouvrir, aller, attendreUnGraphe,
  conteneursVides, debordementHorizontal, erreursReelles,
} from './harnais.js';

/**
 * Les parcours qu'un visiteur fait vraiment : au clavier, par permalien, par
 * export, et dans sa propre langue.
 *
 * Chacun de ces chemins a deja casse au moins une fois dans ce depot, et aucun
 * n'est observable dans jsdom. Un anneau de focus est une propriete calculee
 * apres une transition CSS ; un permalien est un aller-retour complet par
 * l'URL ; un telechargement est un evenement du navigateur. La suite unitaire
 * peut prouver que la fonction qui fabrique l'URL est juste, jamais que la
 * page qu'on obtient en la suivant montre la meme chose.
 */

let navigateur;
let page;
let erreurs;

beforeAll(async () => { ({ navigateur, page, erreurs } = await ouvrir()); }, 120000);
afterAll(async () => { await navigateur?.close(); });

describe('clavier', () => {

  /**
   * Le lien d'evitement est le premier arret de tabulation et il DEPLACE le
   * focus lui-meme : atteindre le contenu coutait 23 arrets sans lui. Il est
   * cache hors de l'ecran, jamais en display:none, ce qui le sortirait de
   * l'ordre de tabulation et le rendrait inutile.
   */
  it('le premier arret de tabulation mene au contenu', async () => {
    await aller(page, '/slice');
    await page.waitForTimeout(1500);

    await page.keyboard.press('Tab');
    const premier = await page.evaluate(() => {
      const a = document.activeElement;
      return { balise: a?.tagName?.toLowerCase(), texte: (a?.textContent || '').trim().slice(0, 40),
               href: a?.getAttribute?.('href') ?? null };
    });
    expect(premier.balise, 'le premier arret doit etre un lien').toBe('a');

    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    const apres = await page.evaluate(() => document.activeElement?.id ?? '');
    expect(apres, 'le lien d evitement doit poser le focus sur le contenu principal')
      .toBe('mcv-main');
  }, 120000);

  /**
   * Entree et Espace sont les deux seules facons d'actionner une commande au
   * clavier. Une touche captee par un raccourci de page les annulait, si bien
   * qu'un bouton ayant le focus ne se declenchait pas : echec WCAG 2.1.1 de
   * niveau A sur toutes les pages de visualisation.
   */
  it('Entree actionne le bouton qui a le focus', async () => {
    await aller(page, '/slice');
    const action = page.getByRole('button', { name: 'Visualiser', exact: true });
    await action.first().waitFor({ state: 'visible', timeout: 30000 });
    await action.first().focus();
    await page.keyboard.press('Enter');
    await attendreUnGraphe(page, 60000);

    expect(await page.locator('div[role="img"].js-plotly-plot').count(),
      'le bouton doit s activer a la touche Entree, pas seulement au clic')
      .toBeGreaterThan(0);
  }, 150000);

  /**
   * Un anneau de focus visible est le seul repere de qui navigue au clavier.
   * Il apparait ici en fondu sur 0,2 s : le lire trop tot donne une largeur de
   * zero et un faux negatif, d'ou l'attente explicite.
   */
  it('le focus clavier reste visible', async () => {
    await aller(page, '/slice');
    const action = page.getByRole('button', { name: 'Visualiser', exact: true });
    await action.first().focus();
    await page.waitForTimeout(500);

    const marque = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement);
      return {
        contour: parseFloat(s.outlineWidth) || 0,
        ombre: s.boxShadow && s.boxShadow !== 'none',
        bordure: parseFloat(s.borderWidth) || 0,
      };
    });
    expect(marque.contour > 0 || marque.ombre || marque.bordure > 0,
      `aucune marque de focus visible : ${JSON.stringify(marque)}`).toBe(true);
  }, 120000);
});

describe('permaliens', () => {

  /**
   * Un permalien est le moyen de citer une figure dans un article. Le suivre
   * doit rendre la MEME vue : le titre du graphe porte le jeu, la variable,
   * l'heure et l'altitude, donc il fait un temoin suffisant et lisible.
   */
  it('rejouer un permalien redonne la meme vue', async () => {
    await aller(page, '/slice');
    const action = page.getByRole('button', { name: 'Visualiser', exact: true });
    await action.first().click();
    await attendreUnGraphe(page, 60000);
    // `.gtitle` est un <text> SVG : il n'a pas d'innerText, seulement du
    // textContent. Playwright refuse innerText sur un noeud non HTML.
    const titre = () => page.evaluate(
      () => document.querySelector('.gtitle')?.textContent ?? '');
    const titreAvant = await titre();

    const lien = page.locator('button[aria-label*="ermalien" i], button:has-text("PERMALIEN")');
    if (await lien.count() === 0) return;
    await lien.first().click();
    await page.waitForTimeout(1200);

    const url = await page.evaluate(() => navigator.clipboard.readText().catch(() => location.href));
    expect(url, 'le permalien doit porter des parametres').toMatch(/[?&]/);

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await attendreUnGraphe(page, 60000);
    const titreApres = await titre();
    expect(titreApres, 'le permalien doit rendre exactement la vue citee').toBe(titreAvant);
  }, 200000);

  /**
   * Un permalien se modifie a la main. Un entier hors bornes servait autrefois
   * d'indice de tableau et faisait tomber la page entiere derriere sa frontiere
   * d'erreur. Une valeur impossible doit ramener la page a son defaut, jamais
   * la casser.
   */
  it('un permalien aux valeurs impossibles ne casse pas la page', async () => {
    for (const requete of ['?alt=-1', '?alt=99999', '?t=-5', '?t=abc', '?alt=1e400']) {
      erreurs.length = 0;
      await aller(page, `/slice${requete}`);
      await page.waitForTimeout(2000);

      const contenu = await page.locator('body').innerText();
      expect(contenu.length, `${requete} : la page doit rester rendue`).toBeGreaterThan(50);
      expect(await debordementHorizontal(page), `${requete} : debordement`).toEqual([]);
      expect(erreursReelles(erreurs), `${requete} : erreurs de console`).toEqual([]);
    }
  }, 200000);
});

describe('exports', () => {

  /**
   * L'export est la sortie du travail : une figure qu'on met dans un article,
   * un CSV qu'on rouvre dans un tableur. Un menu qui s'ouvre ne prouve rien,
   * seul un fichier recu le prouve.
   */
  it('l export PNG produit vraiment un fichier', async () => {
    await aller(page, '/slice');
    const action = page.getByRole('button', { name: 'Visualiser', exact: true });
    await action.first().click();
    await attendreUnGraphe(page, 60000);

    const menu = page.locator('button:has-text("EXPORT"), button[aria-label*="xport" i]');
    expect(await menu.count(), 'le menu d export doit exister').toBeGreaterThan(0);
    await menu.first().click();
    await page.waitForTimeout(900);

    const png = page.locator('[role="menuitem"]:has-text("PNG"), li:has-text("PNG")');
    if (await png.count() === 0) return;

    const attente = page.waitForEvent('download', { timeout: 60000 });
    await png.first().click();
    const fichier = await attente;
    expect(fichier.suggestedFilename(), 'le fichier doit etre nomme et etre un PNG')
      .toMatch(/\.png$/i);
  }, 200000);
});

describe('langues', () => {

  /**
   * Les traductions changent la longueur de chaque libelle, donc la mise en
   * page. L'allemand et le neerlandais sont les premiers a deborder. Un
   * controle manuel l'a constate une fois en septembre, puis plus jamais.
   */
  for (const [langue, chemin] of [
    ['de', '/explore'], ['nl', '/explore'], ['es', '/crosssection'],
    ['en', '/zonalmean'], ['fr', '/hovmoller'],
  ]) {
    it(`${chemin} rend correctement en ${langue}`, async () => {
      erreurs.length = 0;
      await page.evaluate((l) => {
        try { localStorage.setItem('mcv-language', l); } catch { /* mode prive */ }
      }, langue);
      await aller(page, chemin);
      await page.waitForTimeout(2500);

      expect(await debordementHorizontal(page), `${chemin} en ${langue} : debordement`).toEqual([]);
      expect(await conteneursVides(page), `${chemin} en ${langue} : conteneur vide`).toEqual([]);
      expect(erreursReelles(erreurs), `${chemin} en ${langue} : erreurs`).toEqual([]);
    }, 150000);
  }
});

describe('pages annexes', () => {

  it('une adresse inconnue rend la page 404, pas une page blanche', async () => {
    erreurs.length = 0;
    await aller(page, '/cette-page-nexiste-pas');
    await page.waitForTimeout(1500);
    expect((await page.locator('body').innerText()).length,
      'une page blanche laisse le visiteur sans issue').toBeGreaterThan(50);
    expect(erreursReelles(erreurs)).toEqual([]);

    // Le statut aussi : il repondait 200, et un scanner lisait alors
    // /actuator/env ou /wp-admin comme exposes. Exige seulement quand c'est le
    // serveur de l'application qui repond (il pose une CSP) : le serveur de
    // developpement Vite renvoie 200 a toute adresse, par construction.
    for (const chemin of ['/cette-page-nexiste-pas', '/actuator/env']) {
      const reponse = await page.request.get(BASE + chemin);
      if (reponse.headers()['content-security-policy']) {
        expect(reponse.status(), `GET ${chemin}`).toBe(404);
      }
    }
    const route = await page.request.get(BASE + '/slice');
    expect(route.status(), 'une vraie route reste en 200').toBe(200);
  }, 120000);
});
