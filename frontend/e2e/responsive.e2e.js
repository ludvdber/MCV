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

/**
 * Ce qu'un curseur laisse depasser de la page : le halo tactile de son pouce
 * (42 px centres dessus, un pseudo-element sans rectangle propre) et sa bulle
 * de valeur, dont la largeur depend du texte affiche. Les deux ne sortent qu'aux
 * extremites de la course, et seul le cote droit provoque un defilement — a
 * gauche le navigateur coupe sans rien signaler.
 */
async function horsDeLaPage(page) {
  return page.evaluate(() => {
    const vue = document.documentElement.clientWidth;
    const fautes = [];
    for (const pouce of document.querySelectorAll('.MuiSlider-thumb')) {
      const r = pouce.getBoundingClientRect();
      const centre = r.left + r.width / 2;
      if (centre - 21 < -1 || centre + 21 > vue + 1) {
        fautes.push({ quoi: 'halo tactile', centre: Math.round(centre), vue });
      }
    }
    for (const bulle of document.querySelectorAll('.MuiSlider-valueLabel')) {
      const r = bulle.getBoundingClientRect();
      if (r.width < 2) continue;
      if (r.left < -1 || r.right > vue + 1) {
        fautes.push({ quoi: 'bulle de valeur', texte: bulle.textContent.trim().slice(0, 12),
                      gauche: Math.round(r.left), droite: Math.round(r.right), vue });
      }
    }
    return fautes;
  });
}

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
   * Un curseur POUSSE A FOND, sur les trois pages qui en portent.
   *
   * Le pouce d'un curseur MUI emporte un halo tactile de 42 px (son ::after),
   * soit 21 px de debordement de chaque cote de la piste. Au milieu de la
   * course cela ne se voit pas ; a l'extremite, le halo sort de la page. Mesure
   * a 390 px avant correction : 4 px de defilement horizontal a alt=102, 1 px a
   * alt=101, 0 px a alt=51 — le defaut suit la position du curseur, donc aucun
   * test qui laisse les valeurs par defaut ne peut le rencontrer.
   *
   * On pousse au clavier plutot que par permalien : la touche Fin est
   * l'interaction reelle, et le test n'a pas besoin d'un identifiant de jeu.
   */
  for (const chemin of ['/slice', '/animation', '/timeseries']) {
    it(`un curseur pousse a fond ne fait pas defiler ${chemin}`, async () => {
      ouvert = await ouvrir({ largeur: 390, hauteur: 844 });
      const { page } = ouvert;
      await aller(page, chemin);

      const curseurs = page.locator('.MuiSlider-root input[type="range"]');
      await curseurs.first().waitFor({ state: 'attached', timeout: 30000 });
      const combien = await curseurs.count();
      expect(combien, `${chemin} : aucun curseur trouve, le test ne verifie rien`)
        .toBeGreaterThan(0);

      for (let i = 0; i < combien; i++) {
        await curseurs.nth(i).focus();
        await page.keyboard.press('End');
      }
      await page.waitForTimeout(600);

      expect(await debordementHorizontal(page),
        `${chemin} : curseurs au maximum, la page ne doit pas defiler lateralement`)
        .toEqual([]);

      expect(await horsDeLaPage(page),
        `${chemin} : au maximum, halo tactile ou bulle de valeur hors de la page`)
        .toEqual([]);

      // Et au minimum. De ce cote un debordement ne cree AUCUN defilement, donc
      // la mesure precedente ne peut rien voir : la bulle du curseur
      // d'altitude sortait de 8 px a gauche et affichait « 143.9 km » coupe par
      // le bord de l'ecran, soit la valeur que l'utilisateur est en train de
      // lire.
      for (let i = 0; i < combien; i++) {
        await curseurs.nth(i).focus();
        await page.keyboard.press('Home');
      }
      await page.waitForTimeout(600);

      expect(await debordementHorizontal(page),
        `${chemin} : curseurs au minimum, la page ne doit pas defiler lateralement`)
        .toEqual([]);
      expect(await horsDeLaPage(page),
        `${chemin} : au minimum, halo tactile ou bulle de valeur hors de la page`)
        .toEqual([]);
    }, 120000);
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
