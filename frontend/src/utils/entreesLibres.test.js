import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { intParam, timeParam, altitudeParam, floatParam, BORNES_TEMPS, BORNES_ALTITUDE } from './urlParams';
import { datasetFileToken, formatDatasetId } from './datasetLabel';
import { niveauxPourBornes, niveauxContour, etendueGrille } from './contourLevels';

/**
 * Tests PAR PROPRIETES (fast-check) sur les fonctions qui recoivent des entrees
 * que personne ne controle : un permalien retouche a la main, un identifiant de
 * jeu lu dans l'URL, une grille de valeurs servie par l'API.
 *
 * Les tests par exemples du reste de la suite verifient les cas auxquels on a
 * pense. Ceux-ci enoncent un CONTRAT et laissent fast-check chercher l'entree
 * qui le viole, puis la reduire au plus petit contre-exemple. Chaque propriete
 * ci-dessous correspond a une panne deja vecue ou au contrat ecrit en tete du
 * module teste, pas a une idee abstraite :
 *
 *   - `?alt=-1` a deja fait tomber une page entiere (indice negatif, voir
 *     urlParams.js) : quelle que soit la chaine, un parametre borne rend null
 *     ou une valeur DANS les bornes ;
 *   - un nom de fichier d'export doit rester court et sans caractere qu'un
 *     systeme de fichiers refuse, quel que soit l'identifiant recu ;
 *   - une trace contour sans niveaux valides fait planter Plotly (voir
 *     contourLevels.js) : quelles que soient les bornes, la bande est finie,
 *     non vide, et ne demande pas des millions de niveaux.
 *
 * Si l'une echoue, fast-check imprime la graine et le contre-exemple reduit :
 * les rejouer avec `{ seed, path }` dans fc.assert reproduit l'echec a
 * l'identique.
 */

const params = (chaine) => new URLSearchParams(chaine);

/** Chaines qui ressemblent a ce qu'on tape dans une URL, nombres compris. */
const valeurUrl = fc.oneof(
  fc.string(),
  fc.string({ unit: 'grapheme' }),
  fc.integer().map(String),
  fc.double().map(String),
  fc.constantFrom('', ' ', '-0', '1e3', '0x10', '12abc', 'Infinity', 'NaN', '٣', '+5', '47.9', '1'.repeat(400)),
);

describe('permalien : un parametre numerique ne sort jamais de son contrat', () => {
  it('intParam borne rend null ou un entier dans les bornes, pour toute chaine', () => {
    fc.assert(
      fc.property(valeurUrl, fc.integer({ min: -1000, max: 1000 }), fc.nat(1000), (brut, min, largeur) => {
        const bornes = { min, max: min + largeur };
        const n = intParam(new Map([['x', brut]]), 'x', bornes);
        expect(n === null || (Number.isInteger(n) && n >= bornes.min && n <= bornes.max)).toBe(true);
      }),
    );
  });

  it('pas de temps et niveau d\'altitude restent des indices valides du modele', () => {
    fc.assert(
      fc.property(valeurUrl, (brut) => {
        const q = new Map([['t', brut], ['alt', brut]]);
        const t = timeParam(q);
        const alt = altitudeParam(q);
        expect(t === null || (Number.isInteger(t) && t >= BORNES_TEMPS.min && t <= BORNES_TEMPS.max)).toBe(true);
        expect(alt === null || (Number.isInteger(alt) && alt >= BORNES_ALTITUDE.min && alt <= BORNES_ALTITUDE.max)).toBe(true);
      }),
    );
  });

  it('un indice valide survit a l\'aller-retour par l\'URL, un indice hors bornes est refuse', () => {
    fc.assert(
      fc.property(fc.integer({ min: -500, max: 500 }), (n) => {
        const lu = timeParam(params(`t=${n}`));
        const dedans = n >= BORNES_TEMPS.min && n <= BORNES_TEMPS.max;
        expect(lu).toBe(dedans ? n : null);
      }),
    );
  });

  it('floatParam rend null ou un nombre fini, jamais NaN ni Infinity', () => {
    fc.assert(
      fc.property(valeurUrl, (brut) => {
        const v = floatParam(new Map([['lat', brut]]), 'lat');
        expect(v === null || Number.isFinite(v)).toBe(true);
      }),
    );
  });
});

/** Identifiants au format exact de la pipeline GEM-Mars (voir datasetLabel.test.js). */
const idMeanReel = fc
  .record({
    ls: fc.integer({ min: 0, max: 11 }).map((k) => k * 30),
    my: fc.integer({ min: 20, max: 45 }),
    sol: fc.integer({ min: 0, max: 668 }),
  })
  .map(({ ls, my, sol }) => ({
    ls,
    my,
    id: `hl-b274_032094p_ls${String(ls).padStart(3, '0')}_0000_MY${my}_sol${sol}to${sol + 71}_71days_mean_crossdir`,
  }));

describe('identifiant de jeu : libelle et nom de fichier', () => {
  it('le jeton de nom de fichier est court et sans caractere interdit, pour tout identifiant', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.string({ unit: 'grapheme' }), fc.string({ minLength: 100, maxLength: 2000 })), (id) => {
        const jeton = datasetFileToken(id);
        expect(jeton).toMatch(/^[A-Za-z0-9._-]+$/);
        expect(jeton.length).toBeLessThanOrEqual(40);
      }),
    );
  });

  it('un identifiant qui imite le format reel mais porte des nombres demesures reste borne', () => {
    // `size: 'max'` est indispensable : par defaut fast-check genere des chaines
    // courtes (12 chiffres au plus, mesure sur 200 tirages), et cette propriete
    // passait alors sur le code fautif, qui rendait 108 caracteres pour 100.
    const nombre = (motif) => fc.stringMatching(motif, { size: 'max' });
    fc.assert(
      fc.property(nombre(/^\d{1,400}$/), nombre(/^[\d.]{1,400}$/), (chiffres, ls) => {
        for (const id of [`x_ls000_MY${chiffres}_mean`, `IND_MY${chiffres}_LS${ls}`]) {
          const jeton = datasetFileToken(id);
          expect(jeton).toMatch(/^[A-Za-z0-9._-]+$/);
          expect(jeton.length).toBeLessThanOrEqual(40);
        }
      }),
    );
  });

  it('un vrai identifiant MEAN donne l\'annee et la saison que le serveur en deduit', () => {
    const t = (_cle, v) => `MY${v.my} Ls ${v.lsStart}-${v.lsEnd}`;
    fc.assert(
      fc.property(idMeanReel, ({ id, ls, my }) => {
        expect(datasetFileToken(id)).toBe(`MY${my}_Ls${String(ls).padStart(3, '0')}`);
        expect(formatDatasetId(id, t)).toBe(`MY${my} Ls ${ls}-${ls === 330 ? 360 : ls + 30}`);
      }),
    );
  });

  it('le libelle ne leve jamais et ne perd jamais l\'information', () => {
    const t = (_cle, v) => `MY${v.my} Ls ${v.lsStart}-${v.lsEnd}`;
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme' }), (id) => {
        const libelle = formatDatasetId(id, t);
        expect(typeof libelle).toBe('string');
        if (id) expect(libelle.length).toBeGreaterThan(0);
      }),
    );
  });
});

/** Tout double fini, y compris les sous-normaux et les extremes de la plage. */
const fini = fc.double({ noNaN: true, noDefaultInfinity: true });

describe('niveaux de contour : jamais une bande que Plotly ne sait pas tracer', () => {
  it('pour toutes bornes finies, la bande est finie, non vide et d\'un nombre de niveaux raisonnable', () => {
    fc.assert(
      fc.property(fini, fini, fc.integer({ min: 1, max: 60 }), (a, b, n) => {
        const { start, end, size } = niveauxPourBornes(a, b, n);
        expect(Number.isFinite(start) && Number.isFinite(end) && Number.isFinite(size)).toBe(true);
        expect(size).toBeGreaterThan(0);
        expect(start).toBeLessThanOrEqual(end);
        // Plotly trace un niveau par pas de start a end : une bande qui en
        // demanderait des milliers gelerait l'onglet. Le pas valant au moins
        // l'etendue / n, il y a au plus n intervalles ; la marge de 3 couvre la
        // marge expandRange et un ulp de decalage a chaque bout quand l'etendue
        // frole la resolution des doubles. Avant correction : 50 000 pour n = 32.
        expect((end - start) / size).toBeLessThanOrEqual(n + 3);
      }),
      { numRuns: 2000 },
    );
  });

  it('sur une etendue ordinaire, les niveaux tombent dans la plage coloree', () => {
    // Etendues du monde reel : de 1e-12 (traceurs en kg/kg) a 1e6 (pression).
    const echelle = fc.integer({ min: -12, max: 6 }).map((e) => 10 ** e);
    fc.assert(
      fc.property(fc.double({ min: -1, max: 1, noNaN: true }), fc.double({ min: 1e-3, max: 1, noNaN: true }), echelle, (centre, demi, s) => {
        const min = (centre - demi) * s;
        const max = (centre + demi) * s;
        const { start, end, size } = niveauxPourBornes(min, max);
        const tolerance = size * 1e-6;
        expect(start).toBeGreaterThanOrEqual(min - size - tolerance);
        expect(end).toBeLessThanOrEqual(max + size + tolerance);
      }),
      { numRuns: 2000 },
    );
  });

  it('etendueGrille ne leve sur aucune forme de reponse et ne retient que des nombres finis', () => {
    const cellule = fc.oneof(fini, fc.constantFrom(null, undefined, NaN, Infinity, -Infinity, '12', true, {}));
    const grille = fc.oneof(fc.array(fc.oneof(fc.array(cellule), cellule)), fc.anything());
    fc.assert(
      fc.property(grille, (g) => {
        const e = etendueGrille(g);
        if (e !== null) {
          expect(Number.isFinite(e.min) && Number.isFinite(e.max)).toBe(true);
          expect(e.min).toBeLessThanOrEqual(e.max);
        }
        const { start, end, size } = niveauxContour(g);
        expect(Number.isFinite(start) && Number.isFinite(end) && size > 0 && start <= end).toBe(true);
      }),
    );
  });
});
