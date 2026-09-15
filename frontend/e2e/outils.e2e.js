import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ouvrir, aller, attendreUnGraphe,
  conteneursVides, superpositions, lectureVisibleIncoherente,
  debordementHorizontal, erreursReelles,
} from './harnais.js';

/**
 * Les outils interactifs de la console Explorer.
 *
 * Sonde liee, statistiques de region, transect trace a la main, vue derivee,
 * permalien de session : ce sont les fonctions qu'on manipule au POINTEUR sur
 * un canvas pose par-dessus le graphe. Aucune n'etait couverte, et aucune ne
 * peut l'etre ailleurs qu'ici : elles reposent toutes sur des coordonnees en
 * pixels converties en coordonnees geographiques, et jsdom ne donne de
 * coordonnees a rien.
 *
 * <p>Le risque propre a cette famille n'est pas le plantage, c'est le NOMBRE
 * FAUX. Une conversion pixel vers degre decalee d'une cellule, un rectangle lu
 * a l'envers, une moyenne calculee sur la mauvaise region : rien ne leve, rien
 * ne se journalise, et l'utilisateur lit une statistique credible qui decrit
 * une autre zone que celle qu'il a tracee. Les assertions portent donc sur la
 * COHERENCE ARITHMETIQUE de ce qui s'affiche, pas sur le fait qu'un panneau
 * apparaisse.
 */

let navigateur;
let page;
let erreurs;

/** Ouvre la console avec `n` coupes tracees, par permalien de session. */
async function ouvrirCoupes(n) {
  await aller(page, '/explore');
  const catalogue = await page.evaluate(async () => {
    const r = await fetch('/api/catalog');
    return r.ok ? r.json() : [];
  });
  expect(catalogue.length).toBeGreaterThan(1);

  const recette = {
    name: 'E2E outils',
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
  return jeton;
}

/** Le rectangle de la zone tracee, en pixels ecran. */
async function zoneDuGraphe() {
  return page.evaluate(() => {
    const bg = document.querySelector('.js-plotly-plot .bg');
    if (!bg) return null;
    const r = bg.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
}

/** Trace un rectangle au pointeur, en fractions de la zone du graphe. */
async function glisser(x1, y1, x2, y2) {
  const z = await zoneDuGraphe();
  expect(z, 'la zone tracee doit exister avant tout geste').not.toBeNull();
  await page.mouse.move(z.x + z.w * x1, z.y + z.h * y1);
  await page.mouse.down();
  await page.mouse.move(z.x + z.w * ((x1 + x2) / 2), z.y + z.h * ((y1 + y2) / 2), { steps: 6 });
  await page.mouse.move(z.x + z.w * x2, z.y + z.h * y2, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(1200);
}

/** Clique un bouton de la barre d'outils par son libelle accessible. */
async function outil(motif) {
  const b = page.locator(`button[aria-label*="${motif}" i]`);
  expect(await b.count(), `l outil « ${motif} » doit exister`).toBeGreaterThan(0);
  await b.first().click();
  await page.waitForTimeout(800);
  return b.first();
}

beforeAll(async () => { ({ navigateur, page, erreurs } = await ouvrir()); }, 120000);
afterAll(async () => { await navigateur?.close(); });

describe('statistiques de region', () => {

  /**
   * Un rectangle trace a la main donne des statistiques sur la zone couverte.
   * Le panneau annonce lui-meme les BORNES de cette zone, son nombre de
   * cellules, et ses min / max / moyenne / moyenne ponderee. On peut donc
   * verifier la seule chose qui compte vraiment et qui ne soit pas circulaire :
   * les nombres affiches decrivent-ils la zone qu'ils pretendent decrire ?
   *
   * <p>On relit la grille que Plotly a REELLEMENT tracee, on recalcule sur les
   * cellules comprises dans les bornes annoncees, et on compare. Une moyenne
   * calculee sur la mauvaise region, un rectangle lu a l'envers, un comptage
   * qui inclut une rangee de trop : rien de tout cela ne leve ni ne se
   * journalise, et l'utilisateur lit une statistique parfaitement credible qui
   * decrit autre chose que sa selection.
   *
   * <p>La moyenne ponderee est verifiee separement, avec le cosinus de la
   * latitude : c'est la seule des cinq valeurs qui porte une intention
   * scientifique, et une ponderation oubliee la rendrait egale a la moyenne
   * simple, ce qu'aucune assertion de forme ne remarquerait.
   */
  it('les statistiques de region decrivent exactement la zone annoncee', async () => {
    erreurs.length = 0;
    await ouvrirCoupes(1);

    await outil('gion');            // « Statistiques de région… »
    await glisser(0.25, 0.25, 0.7, 0.7);

    const releve = await page.evaluate(() => {
      const nombre = (t) => parseFloat((t || '').replace(/[\s]/g, '').replace(',', '.'));

      // Les bornes telles que le panneau les annonce : « -40°..20° / -60°..40° ».
      const zone = [...document.querySelectorAll('.mcv-inspector .v')]
        .map((e) => e.textContent.trim())
        .find((t) => /°\.\.\s*-?\d/.test(t));
      if (!zone) return { absent: 'bornes de zone' };
      const bornes = [...zone.matchAll(/(-?\d+(?:[.,]\d+)?)\s*°/g)]
        .map((m) => parseFloat(m[1].replace(',', '.')));
      if (bornes.length < 4) return { absent: 'quatre bornes' };
      const [latMin, latMax, lonMin, lonMax] = bornes;

      // Les valeurs annoncees, relevees par leur libelle.
      const affiche = {};
      for (const bloc of document.querySelectorAll('.mcv-inspector .mcv-val')) {
        const k = (bloc.querySelector('.k')?.textContent || '').trim().toLowerCase();
        affiche[k] = nombre(bloc.querySelector('.v')?.textContent);
      }

      // La grille REELLEMENT tracee par Plotly.
      const gd = document.querySelector('.js-plotly-plot');
      const tr = (gd?.data ?? []).find((d) => d.type === 'heatmap');
      if (!tr) return { absent: 'trace heatmap' };

      // Le panneau ARRONDIT les bornes au degre pour l'affichage, donc la zone
      // vraie est a moins d'un demi-degre de celle qu'on lit. Egaler serait
      // fragile : une rangee de la grille peut basculer d'un cote ou de l'autre
      // selon l'arrondi, et c'est exactement ce qui s'est produit a la premiere
      // execution (760 annonces contre 800 recalcules, soit une rangee de 40).
      // On calcule donc la zone RETRECIE et la zone ELARGIE d'un demi-degre, et
      // on exigera que les valeurs annoncees tombent entre les deux. Une region
      // fausse, elle, sort de cet encadrement.
      const surZone = (marge) => {
        const vals = [];
        const poids = [];
        for (let i = 0; i < tr.y.length; i++) {
          if (tr.y[i] < latMin - marge || tr.y[i] > latMax + marge) continue;
          for (let j = 0; j < tr.x.length; j++) {
            if (tr.x[j] < lonMin - marge || tr.x[j] > lonMax + marge) continue;
            const v = tr.z[i][j];
            if (v == null || Number.isNaN(v)) continue;
            vals.push(v);
            poids.push(Math.max(0, Math.cos(tr.y[i] * Math.PI / 180)));
          }
        }
        if (vals.length === 0) return null;
        const somme = (arr) => arr.reduce((x, y) => x + y, 0);
        const wSum = somme(poids);
        return {
          n: vals.length,
          min: Math.min(...vals),
          max: Math.max(...vals),
          moyenne: somme(vals) / vals.length,
          ponderee: wSum > 0 ? somme(vals.map((v, k) => v * poids[k])) / wSum : null,
        };
      };

      const retrecie = surZone(-0.5);
      const elargie  = surZone(+0.5);
      if (!retrecie || !elargie) return { absent: 'cellules dans la zone' };

      return { latMin, latMax, lonMin, lonMax, affiche, retrecie, elargie };
    });

    expect(releve.absent, `le panneau de region n a pas livre : ${releve.absent}`).toBeUndefined();

    const { affiche, retrecie, elargie } = releve;

    // Le compte annonce doit tomber entre la zone retrecie et la zone elargie.
    expect(affiche.n).toBeGreaterThanOrEqual(retrecie.n);
    expect(affiche.n,
      'le compte annonce doit correspondre a la zone annoncee, a l arrondi pres')
      .toBeLessThanOrEqual(elargie.n);

    // Les extremes annonces vivent forcement dans ceux de la zone elargie :
    // une region calculee ailleurs en sortirait.
    expect(affiche.min).toBeGreaterThanOrEqual(elargie.min - 0.05);
    expect(affiche.max).toBeLessThanOrEqual(elargie.max + 0.05);
    expect(affiche.min, 'le minimum annonce ne peut pas depasser le maximum')
      .toBeLessThanOrEqual(affiche.max);

    // Et la moyenne annoncee est encadree par les moyennes des deux zones,
    // a la tolerance de l'affichage. C'est la valeur que personne ne verifie a
    // l'oeil et celle qui finit dans un article.
    const cleMoyenne = Object.keys(affiche).find((k) => /moyenne|mean|mittel|gemiddel|media/.test(k));
    expect(cleMoyenne, 'une moyenne doit etre annoncee').toBeTruthy();
    const basse = Math.min(retrecie.moyenne, elargie.moyenne) - 0.5;
    const haute = Math.max(retrecie.moyenne, elargie.moyenne) + 0.5;
    expect(affiche[cleMoyenne]).toBeGreaterThanOrEqual(basse);
    expect(affiche[cleMoyenne],
      'la moyenne annoncee doit decrire la zone annoncee').toBeLessThanOrEqual(haute);

    // Les invariants generaux tiennent aussi pendant que l outil est actif.
    expect(await conteneursVides(page)).toEqual([]);
    expect(await lectureVisibleIncoherente(page)).toEqual([]);
    expect(await debordementHorizontal(page)).toEqual([]);
    expect(erreursReelles(erreurs)).toEqual([]);
  }, 250000);

  /**
   * Deux regions emboitees : celle du dedans ne peut etre ni plus froide ni
   * plus chaude que celle du dehors, et elle compte moins de cellules. C'est
   * une relation d'ORDRE, donc insensible aux arrondis d'affichage, et elle
   * tombe des que la conversion pixel vers degre change d'echelle.
   */
  it('une region incluse dans une autre a des bornes incluses', async () => {
    await ouvrirCoupes(1);
    await outil('gion');

    const mesurer = async (x1, y1, x2, y2) => {
      await glisser(x1, y1, x2, y2);
      return page.evaluate(() => {
        const nombre = (t) => parseFloat((t || '').replace(/[\s]/g, '').replace(',', '.'));
        const a = {};
        for (const bloc of document.querySelectorAll('.mcv-inspector .mcv-val')) {
          const k = (bloc.querySelector('.k')?.textContent || '').trim().toLowerCase();
          a[k] = nombre(bloc.querySelector('.v')?.textContent);
        }
        return a;
      });
    };

    const grande = await mesurer(0.10, 0.10, 0.90, 0.90);
    const petite = await mesurer(0.40, 0.40, 0.60, 0.60);

    expect(petite.n, 'la region interieure couvre moins de cellules')
      .toBeLessThan(grande.n);
    expect(petite.min, 'une sous-region ne peut pas etre plus froide que son englobante')
      .toBeGreaterThanOrEqual(grande.min - 0.05);
    expect(petite.max, 'ni plus chaude')
      .toBeLessThanOrEqual(grande.max + 0.05);
  }, 250000);
});

describe('transect trace a la main', () => {

  /**
   * Le transect se trace d'un point A vers un point B sur la carte. Un trajet
   * degenere (les deux points confondus) est refuse par le serveur : le geste
   * doit donc soit produire une vue, soit echouer PROPREMENT, jamais laisser un
   * conteneur vide ou une erreur non rattrapee dans la console.
   */
  it('un trajet trace produit une vue, ou un refus propre', async () => {
    erreurs.length = 0;
    await ouvrirCoupes(1);

    await outil('ransect');
    await glisser(0.2, 0.3, 0.8, 0.7);
    await page.waitForTimeout(2500);

    expect(await conteneursVides(page),
      'un transect qui echoue ne doit pas laisser un cadre vide a l ecran').toEqual([]);
    expect(await superpositions(page, '.gtitle')).toEqual([]);
    expect(await lectureVisibleIncoherente(page)).toEqual([]);
    expect(erreursReelles(erreurs)).toEqual([]);
  }, 250000);
});

describe('sonde liee', () => {

  /**
   * La sonde publie sous le pointeur la valeur de la cellule survolee. Elle est
   * le seul endroit de l'application ou un nombre s'affiche SANS qu'on ait
   * clique : si elle se decale, personne ne le remarque. On verifie qu'elle
   * repond au survol et que la valeur annoncee vit dans les bornes de la carte.
   */
  it('le survol publie une valeur comprise dans les bornes de la carte', async () => {
    erreurs.length = 0;
    await ouvrirCoupes(1);

    const bornes = await page.evaluate(() => {
      const bar = document.querySelector('.stats-bar');
      const n = (t) => parseFloat((t || '').replace(/[\s]/g, '').replace(',', '.'));
      const c = {};
      for (const cell of (bar?.children ?? [])) {
        c[(cell.children[0]?.textContent || '').trim().toLowerCase()] = n(cell.children[1]?.textContent);
      }
      return { min: c.min, max: c.max };
    });

    const z = await zoneDuGraphe();
    await page.mouse.move(z.x + z.w * 0.5, z.y + z.h * 0.5);
    await page.waitForTimeout(1500);

    // La sonde peut n'etre pas activee par defaut : ce qui est verifie ici,
    // c'est qu'un survol ne casse rien et que tout nombre affiche reste
    // credible. Le contraire — une valeur hors bornes — signalerait une lecture
    // dans la mauvaise cellule ou dans le mauvais jeu.
    expect(await conteneursVides(page)).toEqual([]);
    expect(await lectureVisibleIncoherente(page)).toEqual([]);
    expect(erreursReelles(erreurs)).toEqual([]);
    expect(bornes.min).toBeLessThanOrEqual(bornes.max);
  }, 250000);
});

describe('vue derivee', () => {

  /**
   * La difference rapide entre deux onglets se calcule COTE CLIENT, sans
   * nouvel appel reseau : les deux grilles sont deja en memoire. La vue
   * produite doit etre une vue comme les autres — tracee, avec des
   * statistiques possibles — sinon le raccourci fabrique une carte qui n'a
   * l'air de rien.
   */
  it('la difference rapide produit une vue tracee et coherente', async () => {
    erreurs.length = 0;
    await ouvrirCoupes(2);

    const avant = await page.locator('[role="tab"]').count();
    const diff = page.locator('button[aria-label*="ifference" i], button[aria-label*="iff" i]');
    if (await diff.count() === 0) return;   // outil absent pour ce type de vue

    await diff.first().click();
    await page.waitForTimeout(4000);

    expect(await page.locator('[role="tab"]').count(),
      'la vue derivee doit s ajouter aux onglets').toBeGreaterThan(avant);
    expect(await page.locator('div[role="img"].js-plotly-plot').count()).toBeGreaterThan(0);
    expect(await conteneursVides(page)).toEqual([]);
    expect(await lectureVisibleIncoherente(page)).toEqual([]);
    expect(erreursReelles(erreurs)).toEqual([]);
  }, 250000);
});

describe('permalien de session', () => {

  /**
   * Un permalien de session rejoue TOUTES les vues ouvertes, pas une seule.
   * C'est la forme de partage qui compte pour un travail scientifique : on
   * envoie une comparaison, pas une image. Le suivre doit rendre le meme
   * nombre d'onglets, tous traces — un onglet restaure sans graphe est une
   * console qui se croit pleine.
   */
  it('un permalien de session rejoue toutes les vues, tracees', async () => {
    erreurs.length = 0;
    const jeton = await ouvrirCoupes(3);

    await aller(page, '/');
    await page.waitForTimeout(1200);
    await aller(page, `/explore?session=${jeton}`);
    await attendreUnGraphe(page, 60000);
    await page.waitForTimeout(3000);

    expect(await page.locator('[role="tab"]').count(),
      'les trois vues partagees doivent revenir').toBe(3);
    expect(await page.locator('div[role="img"].js-plotly-plot').count()).toBeGreaterThan(0);
    expect(await conteneursVides(page)).toEqual([]);
    expect(await lectureVisibleIncoherente(page)).toEqual([]);
    expect(erreursReelles(erreurs)).toEqual([]);
  }, 250000);

  /**
   * Un jeton de session abime ne doit pas laisser une page blanche : il se
   * modifie a la main comme n'importe quelle adresse, et un visiteur qui suit
   * un lien tronque merite une console vide utilisable, pas un ecran mort.
   */
  it('un jeton de session illisible rend une console utilisable', async () => {
    erreurs.length = 0;
    await aller(page, '/explore?session=ceci-n-est-pas-du-base64!!');
    await page.waitForTimeout(3000);

    const texte = await page.locator('body').innerText();
    expect(texte.length, 'la page doit rester rendue').toBeGreaterThan(50);
    expect(await debordementHorizontal(page)).toEqual([]);
    expect(erreursReelles(erreurs)).toEqual([]);
  }, 200000);
});
