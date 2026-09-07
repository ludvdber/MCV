import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Garde-fou contre le decalage de nom de parametre entre le frontend et Spring.
 *
 * Le defaut corrige : les deux appelants de /api/data/wind envoyaient
 * `altitudeIndex`, alors que le controleur declare
 * `@RequestParam(defaultValue = "49") int altitude`. Spring ignore simplement le
 * parametre inconnu et applique son defaut, SANS erreur ni 400 : la
 * superposition de vent affichait donc toujours le champ du niveau 49 (~41 km)
 * quelle que soit l'altitude choisie, et la legende de vitesse annoncait des
 * min/max/moyenne appartenant a un autre niveau. Ecart mesure entre les niveaux
 * 10 et 95 : facteur 7 sur le maximum, facteur 11 sur la moyenne.
 *
 * Une faute de ce genre est invisible a l'execution ; seul un test qui compare
 * les deux cotes peut l'attraper.
 */

const ICI = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(ICI, '..');
const CONTROLLERS = resolve(ICI, '../../../src/main/java/com/mars/visualizer/controller');

const PARAM_RE = /@RequestParam(?:\(([^)]*)\))?\s+(?:final\s+)?[\w<>[\],\s]+?\s+(\w+)\s*[,)]/g;

function sourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(js|jsx)$/.test(name) && !/\.test\.jsx?$/.test(name)) out.push(full);
  }
  return out;
}

const relatif = f => f.slice(SRC.length + 1).split(/[\\/]/).join('/');

/** Noms de parametres attendus par un endpoint, lus dans la signature Java. */
function backendParams(route) {
  for (const name of readdirSync(CONTROLLERS)) {
    const src = readFileSync(join(CONTROLLERS, name), 'utf8');
    const m = src.match(new RegExp(`@GetMapping\\("${route}"\\)([\\s\\S]{0,1600}?)\\)\\s*\\{`));
    if (!m) continue;
    return [...`${m[1]})`.matchAll(PARAM_RE)]
      .map(p => (p[1]?.match(/(?:name|value)\s*=\s*"([^"]+)"/) ?? [])[1] ?? p[2]);
  }
  return null;
}

/** Objets litteraux passes a un helper d'API, tels quels. */
function objetsPassesA(helper) {
  const trouves = [];
  const re = new RegExp(`${helper}\\(\\s*\\{([^}]*)\\}`, 'g');
  for (const f of sourceFiles(SRC)) {
    for (const m of readFileSync(f, 'utf8').matchAll(re)) {
      trouves.push({ fichier: relatif(f), objet: m[1] });
    }
  }
  return trouves;
}

describe('parametres de requete frontend / backend', () => {
  it('le controleur du champ de vent attend « altitude »', () => {
    const params = backendParams('/data/wind');
    expect(params).not.toBeNull();
    expect(params).toContain('altitude');
    expect(params).not.toContain('altitudeIndex');
  });

  it('la couche services ne documente plus « altitudeIndex »', () => {
    // `altitudeIndex` reste un nom LEGITIME dans les reponses (SliceResponse,
    // AnimationResponse l'exposent), on ne peut donc pas l'interdire partout.
    // En revanche il n'a rien a faire dans api.js, qui decrit ce qu'on ENVOIE :
    // c'est la JSDoc de getWind qui a propage la faute aux deux appelants.
    const api = readFileSync(join(SRC, 'services', 'api.js'), 'utf8');
    expect(api).not.toMatch(/altitudeIndex/);
  });

  it('chaque appel a getWind porte « altitude »', () => {
    // On inspecte le texte de l'objet plutot que des cles extraites : la
    // propriete peut etre abregee (`{ altitude }`), et un ternaire dans la
    // valeur d'une autre cle fait derailler toute extraction naive.
    const appels = objetsPassesA('getWind');
    expect(appels.length).toBeGreaterThan(0);
    for (const a of appels) {
      expect(/\baltitude\b/.test(a.objet), `${a.fichier} -> ${a.objet.trim()}`).toBe(true);
    }
  });
});
