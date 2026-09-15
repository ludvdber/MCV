/**
 * Harnais des tests de bout en bout : un VRAI navigateur, sur une application
 * REELLEMENT construite, servie par un vrai serveur.
 *
 * Pourquoi cette couche existe. Les 1346 tests de `npm run test` tournent dans
 * jsdom, qui n'a pas de moteur de mise en page : aucune boite n'a de position,
 * aucune n'a de taille, et `clip-path` n'existe pas. Trois defauts du rideau
 * A/B ont vecu en production sous cette suite verte, parce que les trois
 * etaient GEOMETRIQUES ou visuels — deux barres de statistiques posees au meme
 * endroit et tranchees par le rideau, deux titres centres l'un sur l'autre, un
 * conteneur de graphe a taille pleine et au contenu vide. Aucun de ces trois
 * enonces ne peut meme etre FORMULE dans jsdom.
 *
 * Les verifications ci-dessous sont donc ecrites comme des INVARIANTS de
 * l'application entiere, pas comme des assertions sur le rideau : c'est ce qui
 * leur donne une chance d'attraper le prochain defaut de la meme famille
 * plutot que celui d'hier.
 *
 * Cible : MCV_E2E_URL (defaut http://localhost:5173).
 * MCV_E2E_API rebranche /api vers un autre serveur, ce qui permet de tester une
 * interface locale contre un backend qui, lui, a les donnees.
 */
import { chromium } from 'playwright';

export const BASE = process.env.MCV_E2E_URL || 'http://localhost:5173';
const API = process.env.MCV_E2E_API || null;

/** Ouvre un navigateur et une page prete a l'emploi. */
export async function ouvrir({ largeur = 1600, hauteur = 1000, langue = 'fr-FR' } = {}) {
  const navigateur = await chromium.launch();
  const contexte = await navigateur.newContext({
    viewport: { width: largeur, height: hauteur },
    locale: langue,
    // Le permalien passe par le presse-papier : sans cette permission, le test
    // du parcours mesurerait le refus du navigateur, pas l'application.
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  // La visite guidee s'ouvre au premier passage et pose un voile qui intercepte
  // les clics. On la marque comme deja vue AVANT le premier rendu : un test doit
  // etre deterministe, et fermer une fenetre modale au jugé ne l'est pas.
  await contexte.addInitScript(() => {
    try { localStorage.setItem('mcv-explore-tour-done', '1'); } catch { /* mode prive */ }
  });

  const page = await contexte.newPage();

  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(`PAGEERROR ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });

  if (API) {
    await page.route('**/api/**', async (route) => {
      const u = new URL(route.request().url());
      try {
        await route.fulfill({ response: await route.fetch({ url: API + u.pathname + u.search }) });
      } catch {
        await route.abort();
      }
    });
  }
  return { navigateur, page, erreurs };
}

/** Va sur un chemin de l'application et attend que React ait rendu. */
export async function aller(page, chemin) {
  await page.goto(BASE + chemin, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('main, #root > *', { timeout: 30000 });
  await passerLaVisite(page);
}

/** La visite guidee couvre l'interface au premier passage. */
export async function passerLaVisite(page) {
  const passer = page.getByRole('button', { name: /^PASSER$/i });
  if (await passer.count()) {
    await passer.first().click().catch(() => {});
    await page.waitForTimeout(500);
  }
}

/** Attend qu'au moins un graphe soit trace. */
export async function attendreUnGraphe(page, timeout = 45000) {
  await page.waitForSelector('.js-plotly-plot', { timeout });
  await page.waitForTimeout(1500);
}

/* ─────────────────────── Invariants verifiables ─────────────────────────── */

/**
 * INVARIANT 1 — un conteneur de graphe qui occupe de la place doit AFFICHER
 * quelque chose.
 *
 * Le defaut qu'il attrape ne ressemble pas a une panne : le conteneur est la,
 * a la bonne taille, la page ne leve rien, la console est muette. Il est
 * simplement vide, et l'utilisateur voit un trou. C'est exactement ce qui est
 * arrive au volet A du rideau.
 */
export async function conteneursVides(page) {
  return page.evaluate(() => [...document.querySelectorAll('div[role="img"]')]
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        aria: el.getAttribute('aria-label'),
        largeur: Math.round(r.width),
        hauteur: Math.round(r.height),
        contenu: el.innerHTML.length,
        trace: el.classList.contains('js-plotly-plot'),
      };
    })
    .filter((c) => c.largeur > 50 && c.hauteur > 50 && c.contenu === 0));
}

/**
 * INVARIANT 2 — deux elements de MEME nature ne se superposent pas.
 *
 * Empiler deux vues completes empile tout ce qu'elles rendent. Ce test compare
 * les rectangles deux a deux et signale toute intersection significative, ce
 * qui couvre aussi bien les titres que les barres de statistiques ou n'importe
 * quel bandeau ajoute plus tard.
 */
export async function superpositions(page, selecteur, recouvrementMin = 0.25) {
  return page.evaluate(({ sel, seuil }) => {
    const boites = [...document.querySelectorAll(sel)]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { texte: (el.textContent || '').slice(0, 60), x: r.x, y: r.y, w: r.width, h: r.height };
      })
      .filter((b) => b.w > 4 && b.h > 4);

    const paires = [];
    for (let i = 0; i < boites.length; i++) {
      for (let j = i + 1; j < boites.length; j++) {
        const a = boites[i];
        const b = boites[j];
        const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (dx <= 0 || dy <= 0) continue;
        const part = (dx * dy) / Math.min(a.w * a.h, b.w * b.h);
        if (part >= seuil) {
          paires.push({
            a: a.texte, b: b.texte,
            recouvrement: Math.round(part * 100) + '%',
            largeurCommune: Math.round(dx), hauteurCommune: Math.round(dy),
          });
        }
      }
    }
    return paires;
  }, { sel: selecteur, seuil: recouvrementMin });
}

/**
 * INVARIANT 3 — les cinq nombres qu'on LIT decrivent un seul jeu de donnees.
 *
 * Ce controle a du etre reecrit, et l'erreur vaut d'etre gardee : la premiere
 * version lisait les barres dans le DOM, ou chacune est parfaitement coherente.
 * Elle ne voyait donc RIEN du defaut, qui etait purement visuel — deux barres
 * empilees, l'une decoupee par le rideau, si bien que l'oeil recomposait une
 * ligne de cinq nombres pris dans deux jeux. Lire le DOM ne suffit pas quand le
 * defaut est un probleme de ce qui est DEVANT.
 *
 * On procede donc par test de pointage : au centre de chaque cellule, on
 * demande au navigateur quel element est reellement au-dessus, et on remonte a
 * la barre qui le possede. Si une meme ligne de statistiques est servie par
 * plusieurs barres, la lecture est un montage. On verifie ensuite l'arithmetique
 * SUR CETTE LECTURE : une moyenne et une mediane vivent entre le minimum et le
 * maximum, toujours. C'est la propriete que le montage detruisait, et elle
 * n'exige aucun jugement esthetique.
 */
export async function lectureVisibleIncoherente(page) {
  return page.evaluate(() => {
    const nombre = (txt) => {
      if (!txt || /×10/.test(txt)) return null;
      const n = parseFloat(txt.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    };

    const barres = [...document.querySelectorAll('.stats-bar')];
    const bandes = new Map();

    barres.forEach((barre, indexBarre) => {
      for (const cellule of barre.children) {
        const r = cellule.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        // Qui est REELLEMENT affiche a cet endroit ?
        const dessus = document.elementFromPoint(cx, cy)?.closest('.stats-bar');
        if (!dessus) continue;
        const proprietaire = barres.indexOf(dessus);

        const bande = Math.round(cy / 12);
        if (!bandes.has(bande)) bandes.set(bande, { barresVues: new Set(), lecture: {} });
        const b = bandes.get(bande);
        b.barresVues.add(proprietaire);

        // La valeur LUE est celle de la barre qui occupe le pixel, pas celle
        // de la cellule qu'on interrogeait.
        const cellVisible = [...dessus.children].find((c) => {
          const cr = c.getBoundingClientRect();
          return cx >= cr.x && cx <= cr.x + cr.width && cy >= cr.y && cy <= cr.y + cr.height;
        }) ?? cellule;
        const libelle = (cellVisible.children[0]?.textContent || '').trim().toLowerCase();
        if (libelle) b.lecture[libelle] = { valeur: nombre(cellVisible.children[1]?.textContent), proprietaire, indexBarre };
      }
    });

    const fautes = [];
    for (const [, b] of bandes) {
      if (b.barresVues.size > 1) {
        fautes.push({
          probleme: 'une meme ligne de statistiques est servie par plusieurs barres',
          barresVisibles: [...b.barresVues],
          lecture: Object.fromEntries(Object.entries(b.lecture)
            .map(([k, v]) => [k, v.valeur])),
        });
      }
      const v = (cle) => b.lecture[cle]?.valeur ?? null;
      const min = v('min') ?? v('minimum');
      const max = v('max') ?? v('maximum');
      const moy = v('moyenne') ?? v('mean');
      const med = v('médiane') ?? v('mediane') ?? v('median');
      if (min == null || max == null) continue;
      const dire = (quoi, valeur) => fautes.push({ probleme: quoi, min, max, valeur });
      if (min > max) dire('minimum superieur au maximum', null);
      if (moy != null && (moy < min || moy > max)) dire('moyenne lue hors des bornes lues', moy);
      if (med != null && (med < min || med > max)) dire('mediane lue hors des bornes lues', med);
    }
    return fautes;
  });
}

/**
 * INVARIANT 4 — la page ne deborde jamais horizontalement.
 *
 * Un graphe Plotly fige sa largeur en pixels et ne se recale que sur un
 * evenement resize : toute recomposition de la zone de vues peut laisser un
 * plot plus large que son cadre. Le symptome est une barre de defilement
 * horizontale sur toute la page, invisible pour un test qui ne mesure rien.
 * On renvoie les elements fautifs, pas seulement le verdict, pour que l'echec
 * soit diagnosticable sans rejouer le scenario.
 */
export async function debordementHorizontal(page) {
  return page.evaluate(() => {
    const limite = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= limite + 1) return [];
    return [...document.querySelectorAll('body *')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { droite: Math.round(r.right), largeur: Math.round(r.width),
                 balise: el.tagName.toLowerCase(),
                 classe: (el.className || '').toString().slice(0, 60) };
      })
      .filter((e) => e.droite > limite + 1 && e.largeur > 20)
      .slice(0, 5);
  });
}

/**
 * INVARIANT 5 — deux familles d'elements ne se marchent pas dessus.
 *
 * Variante de l'invariant 2 pour le cas ou les deux elements ne sont PAS de
 * meme nature : un titre de graphe et la barre d'outils Plotly, une legende et
 * une pastille. C'est le recouvrement le plus courant en petite largeur, ou
 * chaque piece garde sa taille et finit par empieter sur la voisine.
 */
export async function chevauchement(page, selecteurA, selecteurB, recouvrementMin = 0.15) {
  return page.evaluate(({ sa, sb, seuil }) => {
    const boites = (sel) => [...document.querySelectorAll(sel)]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          texte: (el.textContent || el.getAttribute('aria-label') || '').slice(0, 50),
          x: r.x, y: r.y, w: r.width, h: r.height,
          visible: style.visibility !== 'hidden' && style.display !== 'none'
            && parseFloat(style.opacity || '1') > 0.05,
        };
      })
      .filter((b) => b.w > 4 && b.h > 4 && b.visible);

    const fautes = [];
    for (const a of boites(sa)) {
      for (const b of boites(sb)) {
        const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (dx <= 0 || dy <= 0) continue;
        const part = (dx * dy) / Math.min(a.w * a.h, b.w * b.h);
        if (part >= seuil) {
          fautes.push({
            a: a.texte, b: b.texte,
            recouvrement: Math.round(part * 100) + '%',
            zoneCommune: `${Math.round(dx)}x${Math.round(dy)} px`,
          });
        }
      }
    }
    return fautes;
  }, { sa: selecteurA, sb: selecteurB, seuil: recouvrementMin });
}

/**
 * INVARIANT 6 — une cible tactile mesure au moins 24 par 24 pixels.
 *
 * C'est le critere 2.5.8 des WCAG 2.2, niveau AA. Il ne se voit pas a l'oeil
 * sur un ecran de bureau ou l'on vise a la souris, et il n'a aucun effet sur
 * une suite jsdom, ou tout element mesure zero. Les elements espaces d'au moins
 * 24 px de leurs voisins beneficient de l'exception d'espacement ; on ne la
 * modelise pas ici, on se contente de signaler, ce qui reste actionnable.
 */
export async function ciblesTactilesTropPetites(page, minimum = 24) {
  return page.evaluate((min) => {
    const interactifs = 'button, a[href], [role="button"], [role="tab"], [role="slider"], input, select, summary';
    // La cible EFFECTIVE n'est pas toujours l'element interrogeable. Un
    // curseur MUI expose un input de 20 px pose sur la pastille, mais l'appui
    // est pris sur tout le rail : mesure faite, 352 x 30 px la ou l'input en
    // annonce 20 x 20. Mesurer l'input reviendrait a signaler un defaut qui
    // n'existe pas, et un test qui crie pour rien finit ignore.
    const cible = (el) => (el.matches('input[type=range]')
      ? el.closest('[class*="Slider-root"]') ?? el
      : el);

    return [...document.querySelectorAll(interactifs)]
      .map((el0) => {
        const el = cible(el0);
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          balise: el.tagName.toLowerCase(),
          etiquette: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
          largeur: Math.round(r.width), hauteur: Math.round(r.height),
          visible: r.width > 0 && r.height > 0 && style.visibility !== 'hidden'
            && style.display !== 'none' && parseFloat(style.opacity || '1') > 0.05,
        };
      })
      .filter((e) => e.visible && (e.largeur < min || e.hauteur < min));
  }, minimum);
}

/**
 * INVARIANT 7 — un curseur dit ce qu'il regle et ce qu'il vaut.
 *
 * Un curseur MUI ne porte aucun nom accessible par defaut, et il annonce son
 * INDICE plutot que la valeur affichee. Mesure faite sur les six curseurs de
 * l'application : ni aria-label, ni aria-labelledby, ni aria-valuetext. Un
 * lecteur d'ecran disait « curseur, 23, de 0 a 47 » la ou l'ecran affiche
 * « 11.5h », sans jamais nommer la grandeur reglee. C'est un echec WCAG 4.1.2
 * de niveau A, et il est invisible pour qui teste a la souris comme pour une
 * suite jsdom.
 */
export async function curseursSansNom(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('input[type=range]')]
      .filter((x) => {
        const r = x.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map((x) => ({
        nom: x.getAttribute('aria-label')
          || (x.getAttribute('aria-labelledby')
            && document.getElementById(x.getAttribute('aria-labelledby'))?.textContent?.trim())
          || (x.labels && x.labels.length ? x.labels[0].textContent.trim() : null),
        valeurLue: x.getAttribute('aria-valuetext'),
        valeurBrute: x.value,
        bornes: `${x.min}-${x.max}`,
      }))
      .filter((c) => !c.nom || !c.valeurLue));
}

/** Les erreurs de console qui ne viennent pas du reseau de test. */
export function erreursReelles(erreurs) {
  return erreurs.filter((e) => !/favicon|net::ERR_|Failed to load resource/i.test(e));
}
