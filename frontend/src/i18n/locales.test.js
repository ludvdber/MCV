import { describe, it, expect } from 'vitest';
import en from './locales/en.json';
import fr from './locales/fr.json';
import nl from './locales/nl.json';
import de from './locales/de.json';
import es from './locales/es.json';

/**
 * Invariants des cinq fichiers de traduction.
 *
 * Rien ne les verifiait : la parite des cles etait controlee a la main, et le
 * CONTENU ne l'avait jamais ete. Un audit a trouve 43 chaines francaises
 * privees de leurs accents, dont « Parametres modifies » sur cinq pages,
 * « Retour a l'accueil » sur deux, et « Vent meridien » dans la liste des
 * variables. Aucune verification de cles ne pouvait les voir : le jeu de cles
 * etait parfait, c'est le texte qui etait faux.
 */

const LOCALES = { en, fr, nl, de, es };
const NOMS = Object.keys(LOCALES);

/** Retire les variables d'interpolation et les balises avant toute analyse du texte. */
function texteSeul(valeur) {
  return valeur.replace(/\{\{[^}]*\}\}/g, ' ').replace(/<[^>]*>/g, ' ');
}

function sansDiacritiques(mot) {
  return mot.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();
}

function porteUnDiacritique(mot) {
  return /\p{Mn}/u.test(mot.normalize('NFD'));
}

describe('fichiers de traduction', () => {

  it('portent exactement le même jeu de clés', () => {
    const reference = Object.keys(en).sort();
    for (const nom of NOMS) {
      expect(Object.keys(LOCALES[nom]).sort(), 'locale ' + nom).toEqual(reference);
    }
  });

  it('n’ont aucune valeur vide', () => {
    for (const nom of NOMS) {
      for (const [cle, valeur] of Object.entries(LOCALES[nom])) {
        expect(typeof valeur, nom + ' / ' + cle).toBe('string');
        expect(valeur.trim(), nom + ' / ' + cle).not.toBe('');
      }
    }
  });

  it('ne laissent pas d’espace en début ou en fin de valeur', () => {
    // Une valeur qui commence par un espace decale visiblement un libelle,
    // et la difference ne se voit pas dans un diff.
    for (const nom of NOMS) {
      for (const [cle, valeur] of Object.entries(LOCALES[nom])) {
        expect(valeur, nom + ' / ' + cle).toBe(valeur.trim());
      }
    }
  });

  it('portent les mêmes variables d’interpolation que l’anglais', () => {
    // Une variable oubliee dans une traduction supprime silencieusement un
    // nombre ou un nom a l'affichage : i18next n'avertit pas.
    const extraire = (v) => (v.match(/\{\{\s*[^}]+?\s*\}\}/g) || [])
      .map((s) => s.replace(/[{}\s]/g, '')).sort();

    for (const cle of Object.keys(en)) {
      const attendu = extraire(en[cle]);
      for (const nom of NOMS) {
        expect(extraire(LOCALES[nom][cle]), nom + ' / ' + cle).toEqual(attendu);
      }
    }
  });

  /**
   * Homographes reels : deux orthographes qui existent toutes les deux et ne
   * veulent pas dire la meme chose. Verifies un par un dans leur contexte.
   *
   * Limite assumee : l'exemption porte sur le MOT dans toute la locale, pas
   * sur une cle precise. « charge » restera donc accepte partout en francais,
   * y compris la ou « charge » serait fautif. Une exemption par cle serait
   * plus fine mais casserait au moindre renommage.
   */
  const HOMOGRAPHES = {
    fr: [
      'a',        // il a / a la vue
      'charge',   // un clic charge une vue / le graphique est chargé
      'compare',  // cette vue compare / un champ comparé
      'change',   // une grandeur change / un réglage changé
      'moyennes', // les moyennes décrites / des champs moyennés
      'video',    // « NASA Image & Video Library », nom propre anglais
      'cote', 'ou', 'la', 'des', 'du', 'sur', 'entree', 'age', 'notre', 'votre',
      'pres', 'mais', 'marche', 'active', 'interne', 'moyenne', 'donne',
      'trace', 'echelle', 'somme', 'zone', 'ligne', 'mode', 'ordre', 'point',
      'ete', 'jeune', 'foret', 'cout', 'sale', 'gene',
    ],
    de: [
      // « ß » n'est pas un diacritique : NFD ne le decompose pas, donc la
      // forme reduite de « große » reste « große » et non « grosse ».
      'große',    // große Monde (adjectif) / Größe (nom)
      'hoher',    // hoher Kontrast (positif) / höher (comparatif)
      'wurde',    // wurde (prétérit) / würde (conditionnel)
      'schon', 'fur', 'uber', 'konnen', 'zahlen', 'wahrend', 'mussen',
      'losung', 'hohe', 'lasst', 'andert', 'wahlen',
    ],
    es: [
      'cuanto',   // cuanto más larga (comparatif) / ¿cuánto? (interrogatif)
      'donde',    // los lugares donde (relatif) / hasta dónde (interrogatif)
      'min',      // « 24 h 37 min » (abréviation de minute) / « máx − mín »
      'video',    // « NASA Image & Video Library », nom propre anglais
      'esta', 'este', 'como', 'que', 'si', 'mas', 'el', 'tu', 'mi', 'se',
      'solo', 'aun', 'de', 'te', 'sobre', 'publico', 'termino', 'critico',
      'practico', 'numero', 'calculo', 'analisis',
    ],
    nl: ['een', 'voor', 'zon', 'over'],
    en: [],
  };

  it.each(NOMS)('n’écrivent pas le même mot avec et sans accent (%s)', (nom) => {
    // Methode des jumeaux : le fichier est sa propre reference. Si un mot y
    // apparait tantot accentue tantot nu, l'une des deux graphies est fautive.
    // Aucun dictionnaire n'est necessaire, la preuve est interne.
    const parBase = new Map();
    for (const [cle, valeur] of Object.entries(LOCALES[nom])) {
      for (const mot of texteSeul(valeur).match(/[\p{L}]{2,}/gu) || []) {
        const base = sansDiacritiques(mot);
        if (!parBase.has(base)) parBase.set(base, new Map());
        if (!parBase.get(base).has(mot.toLowerCase())) {
          parBase.get(base).set(mot.toLowerCase(), []);
        }
        parBase.get(base).get(mot.toLowerCase()).push(cle);
      }
    }

    const exemptes = new Set(HOMOGRAPHES[nom]);
    const fautifs = [];
    for (const [base, formes] of parBase) {
      if (exemptes.has(base)) continue;
      const accentuees = [...formes.keys()].filter(porteUnDiacritique);
      const nues = [...formes.keys()].filter((f) => !porteUnDiacritique(f));
      if (accentuees.length > 0 && nues.length > 0) {
        fautifs.push(nues[0] + ' (attendu « ' + accentuees[0] + ' ») dans '
          + [...new Set(formes.get(nues[0]))].slice(0, 3).join(', '));
      }
    }

    expect(fautifs).toEqual([]);
  });
});
