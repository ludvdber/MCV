import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ouvrir, aller, attendreUnGraphe,
  conteneursVides, superpositions, lectureVisibleIncoherente,
  debordementHorizontal, erreursReelles,
} from './harnais.js';

/**
 * Les onze pages de visualisation, chacune ouverte pour de vrai et tracee avec
 * de vraies donnees.
 *
 * Ce fichier n'existe pas pour verifier une page en particulier : il applique a
 * TOUTES les memes invariants que ceux qui ont fini par attraper le rideau A/B.
 * Un defaut d'affichage ne se signale pas — pas d'exception, pas de log, une
 * console muette — donc la seule maniere de le voir est de mesurer ce que la
 * page rend reellement. Un conteneur a taille pleine et vide, deux titres l'un
 * sur l'autre, une moyenne hors de ses bornes, une page qui deborde a droite :
 * quatre enonces mecaniques, aucun jugement esthetique, et rien de tout cela
 * n'est exprimable dans jsdom, ou aucune boite n'a ni position ni taille.
 *
 * La suite jsdom prouve la LOGIQUE. Celle-ci prouve qu'il y a quelque chose a
 * l'ecran, et que ce quelque chose est coherent.
 */

/** Chaque page et le libelle de son bouton d'action. */
const PAGES = [
  { chemin: '/slice', bouton: 'Visualiser' },
  { chemin: '/timeseries', bouton: 'Analyser' },
  { chemin: '/profile', bouton: 'Analyser' },
  { chemin: '/crosssection', bouton: 'Visualiser' },
  { chemin: '/zonalmean', bouton: 'Visualiser' },
  { chemin: '/hovmoller', bouton: 'Visualiser' },
  { chemin: '/windrose', bouton: 'Visualiser' },
  { chemin: '/temporal-profile', bouton: 'Visualiser' },
  { chemin: '/animation', bouton: "Charger l'animation" },
  {
    chemin: '/difference',
    bouton: 'Comparer',
    // Comparer exige DEUX jeux : le bouton reste desactive tant que le second
    // n'est pas choisi. Ce n'est pas un defaut, c'est la page qui refuse une
    // difference avec elle-meme — le test doit donc la remplir comme un
    // utilisateur, pas contourner la garde.
    preparer: async (page) => {
      const champs = page.locator('input[role="combobox"]');
      const second = champs.nth(1);
      await second.waitFor({ state: 'visible', timeout: 30000 });
      const premier = (await champs.nth(0).inputValue()).trim();
      await second.click();
      const options = page.locator('[role="option"]');
      await options.first().waitFor({ state: 'visible', timeout: 15000 });

      // Chaque option tient sur plusieurs lignes (le jeu, puis son decompte de
      // variables) : c'est la PREMIERE qui porte l'identite. Comparer le texte
      // entier ne trouvait jamais d'egalite et choisissait donc le meme jeu que
      // A, ce que la page refuse a juste titre.
      const n = await options.count();
      let choisi = false;
      for (let i = 0; i < n && !choisi; i++) {
        const titre = (await options.nth(i).innerText()).split(String.fromCharCode(10))[0].trim();
        if (titre && titre !== premier) { await options.nth(i).click(); choisi = true; }
      }
      expect(choisi, 'un second jeu, different du premier, doit etre selectionnable').toBe(true);
      await page.waitForTimeout(1000);
    },
  },
];

let navigateur;
let page;
let erreurs;

beforeAll(async () => { ({ navigateur, page, erreurs } = await ouvrir()); }, 120000);
afterAll(async () => { await navigateur?.close(); });

describe('pages de visualisation, rendu reel', () => {

  for (const { chemin, bouton, preparer } of PAGES) {
    it(`${chemin} trace ses donnees et respecte les invariants d affichage`, async () => {
      erreurs.length = 0;
      await aller(page, chemin);

      if (preparer) await preparer(page);

      const action = page.getByRole('button', { name: bouton, exact: true });
      await action.first().waitFor({ state: 'visible', timeout: 30000 });
      await action.first().click();
      await attendreUnGraphe(page, 60000);

      // 1. quelque chose est affiche, et rien n'occupe la place pour rien
      const traces = await page.locator('div[role="img"].js-plotly-plot').count();
      expect(traces, `${chemin} doit tracer au moins un graphe`).toBeGreaterThan(0);
      expect(await conteneursVides(page),
        `${chemin} : un conteneur a taille pleine et au contenu vide est un trou`
        + ' dans la page, et rien ne le signale a l utilisateur').toEqual([]);

      // 2. rien ne se superpose a rien
      expect(await superpositions(page, '.gtitle'),
        `${chemin} : deux titres au meme endroit se lisent en double`).toEqual([]);
      expect(await superpositions(page, '.stats-bar'),
        `${chemin} : deux barres empilees donnent une lecture composite`).toEqual([]);

      // 3. les nombres lus a l ecran forment un jeu possible
      expect(await lectureVisibleIncoherente(page),
        `${chemin} : moyenne ou mediane hors des bornes lues`).toEqual([]);

      // 4. la page ne deborde pas
      expect(await debordementHorizontal(page),
        `${chemin} : un graphe plus large que son cadre fait defiler toute la page`)
        .toEqual([]);

      // 5. et tout cela sans une erreur
      expect(erreursReelles(erreurs), `${chemin} : erreurs de console`).toEqual([]);
    }, 150000);
  }

  /**
   * Les traductions changent la longueur des libelles, donc la mise en page.
   * L'allemand et le neerlandais sont les deux langues qui debordent en
   * premier : une verification manuelle de septembre l'avait constate une fois,
   * puis plus jamais, faute de test.
   */
  it('ne deborde dans aucune des cinq langues', async () => {
    for (const langue of ['en', 'fr', 'nl', 'de', 'es']) {
      await page.evaluate((l) => {
        try { localStorage.setItem('mcv-language', l); } catch { /* mode prive */ }
      }, langue);
      await aller(page, '/slice');
      await page.waitForTimeout(1200);
      expect(await debordementHorizontal(page), `debordement en ${langue}`).toEqual([]);
    }
  }, 180000);
});
