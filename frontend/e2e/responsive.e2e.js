import { describe, it, expect, afterEach } from 'vitest';
import {
  ouvrir, aller, attendreUnGraphe,
  conteneursVides, debordementHorizontal, chevauchement,
  ciblesTactilesTropPetites, curseursSansNom, erreursReelles,
} from './harnais.js';

/**
 * L'application aux tailles d'ecran reelles, et au doigt.
 *
 * Rien de ce qui suit n'existe dans jsdom : aucune largeur de fenetre, aucune
 * requete media, aucune taille d'element. Une interface peut donc y etre verte
 * en etant inutilisable sur un telephone, ce qui est exactement le genre de
 * defaut qu'un developpeur sur grand ecran ne rencontre jamais lui-meme.
 *
 * Les seuils employes ne sont pas des gouts : 24 par 24 pixels est le critere
 * 2.5.8 des WCAG 2.2 niveau AA, et un debordement horizontal est un fait
 * mesurable, pas une impression.
 */

const ECRANS = [
  { nom: 'telephone', largeur: 390, hauteur: 844 },
  { nom: 'tablette', largeur: 820, hauteur: 1180 },
  { nom: 'bureau', largeur: 1600, hauteur: 1000 },
];

let ouvert = null;
afterEach(async () => { await ouvert?.navigateur?.close(); ouvert = null; });

describe('tailles d ecran et cibles tactiles', () => {

  for (const ecran of ECRANS) {
    it(`la page d accueil tient sur ${ecran.nom} (${ecran.largeur} px)`, async () => {
      ouvert = await ouvrir({ largeur: ecran.largeur, hauteur: ecran.hauteur });
      const { page, erreurs } = ouvert;
      await aller(page, '/');
      await page.waitForTimeout(3000);

      expect(await debordementHorizontal(page),
        `${ecran.nom} : la page ne doit pas defiler lateralement`).toEqual([]);
      expect(erreursReelles(erreurs), `${ecran.nom} : erreurs de console`).toEqual([]);
    }, 120000);

    it(`une carte se trace et tient sur ${ecran.nom}`, async () => {
      ouvert = await ouvrir({ largeur: ecran.largeur, hauteur: ecran.hauteur });
      const { page } = ouvert;
      await aller(page, '/slice');
      const action = page.getByRole('button', { name: 'Visualiser', exact: true });
      await action.first().waitFor({ state: 'visible', timeout: 30000 });
      await action.first().click();
      await attendreUnGraphe(page, 60000);

      expect(await conteneursVides(page)).toEqual([]);
      expect(await debordementHorizontal(page),
        `${ecran.nom} : un graphe plus large que son cadre fait defiler toute la page`)
        .toEqual([]);
    }, 150000);
  }

  /**
   * La barre d'outils Plotly est positionnee en haut a droite de la zone de
   * trace, tandis que le titre est centre : en petite largeur les deux se
   * rejoignent. Sur grand ecran la barre n'apparait qu'au survol, donc le
   * probleme est invisible pour qui developpe a la souris — au doigt, il n'y a
   * pas de survol et la barre reste affichee.
   */
  it('la barre d outils Plotly ne recouvre pas le titre du graphe', async () => {
    ouvert = await ouvrir({ largeur: 390, hauteur: 844 });
    const { page } = ouvert;
    await aller(page, '/slice');
    const action = page.getByRole('button', { name: 'Visualiser', exact: true });
    await action.first().waitFor({ state: 'visible', timeout: 30000 });
    await action.first().click();
    await attendreUnGraphe(page, 60000);

    // Au doigt il n'y a pas de survol : on force l'etat que voit un utilisateur
    // tactile, ou la barre est rendue en permanence.
    await page.evaluate(() => {
      for (const b of document.querySelectorAll('.modebar')) b.style.opacity = '1';
    });
    await page.waitForTimeout(300);

    expect(await chevauchement(page, '.gtitle', '.modebar'),
      'le titre et la barre d outils occupent la meme zone en petite largeur')
      .toEqual([]);
  }, 150000);

  /**
   * WCAG 2.2, critere 2.5.8 : une cible tactile mesure au moins 24 par 24
   * pixels. On regarde la page d'accueil, qui porte le carrousel et la
   * navigation, sur une largeur de telephone.
   */
  it('les commandes de la page d accueil sont assez grandes pour un doigt', async () => {
    ouvert = await ouvrir({ largeur: 390, hauteur: 844 });
    const { page } = ouvert;
    await aller(page, '/');
    await page.waitForTimeout(3500);

    const petites = await ciblesTactilesTropPetites(page);
    expect(petites, 'cibles sous 24x24 px : critere WCAG 2.2 AA 2.5.8').toEqual([]);
  }, 120000);

  it('les commandes de la console Explorer sont assez grandes pour un doigt', async () => {
    ouvert = await ouvrir({ largeur: 390, hauteur: 844 });
    const { page } = ouvert;
    await aller(page, '/explore');
    await page.waitForTimeout(3000);

    expect(await ciblesTactilesTropPetites(page)).toEqual([]);
  }, 120000);

  /**
   * Un curseur qui n'annonce ni ce qu'il regle ni ce qu'il vaut est une commande
   * muette pour qui n'a pas l'ecran. On regarde les pages qui en portent.
   */
  for (const chemin of ['/slice', '/animation', '/explore', '/timeseries']) {
    it(`les curseurs de ${chemin} annoncent leur role et leur valeur`, async () => {
      ouvert = await ouvrir({ largeur: 1600, hauteur: 1000 });
      const { page } = ouvert;
      await aller(page, chemin);
      await page.waitForTimeout(3000);

      expect(await curseursSansNom(page),
        `${chemin} : un curseur sans aria-label annonce « curseur, 23, de 0 a 47 »,`
        + ' sans dire de quelle grandeur il s agit (WCAG 4.1.2, niveau A)').toEqual([]);
    }, 120000);
  }

  /**
   * Le theme clair est un second jeu de couleurs complet, pas une inversion :
   * il a deja produit des tokens illisibles sur les surfaces grises de
   * l'application. On verifie ici qu'il rend et ne deborde pas ; les contrastes
   * eux-memes se mesurent au pixel et sortent du cadre de ce fichier.
   */
  it('le theme clair rend sans debordement', async () => {
    ouvert = await ouvrir({ largeur: 1600, hauteur: 1000 });
    const { page, erreurs } = ouvert;
    await aller(page, '/slice');
    const bascule = page.locator('button[aria-label*="clair" i], button[aria-label*="sombre" i]');
    if (await bascule.count()) {
      await bascule.first().click();
      await page.waitForTimeout(1200);
    }
    const action = page.getByRole('button', { name: 'Visualiser', exact: true });
    await action.first().click();
    await attendreUnGraphe(page, 60000);

    expect(await conteneursVides(page)).toEqual([]);
    expect(await debordementHorizontal(page)).toEqual([]);
    expect(erreursReelles(erreurs)).toEqual([]);
  }, 150000);
});
