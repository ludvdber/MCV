import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tout export doit nommer son JEU DE DONNEES, image comprise.
 *
 * Le defaut d'origine a ete corrige une premiere fois pour les exports de
 * DONNEES : le serveur envoyait un `Content-Disposition` complet mais
 * `triggerApiDownload` nomme le telechargement cote page, donc l'en-tete
 * n'atteignait jamais le disque. Les exports d'IMAGE n'ont pas suivi. Mesure
 * sur le site en ligne : une figure de coupe 2D se telecharge
 * `mars_slice_TT.png`, quels que soient le jeu, l'heure locale et l'altitude,
 * et la rose des vents avait meme un nom LITTERAL, `mars_windrose`. Deux
 * saisons martiennes opposees donnaient donc deux fichiers de meme nom, le
 * navigateur nommant silencieusement le second « (1) ».
 *
 * Ce test lit les SOURCES plutot que de monter les pages : le nom se construit
 * au rendu, a partir d'etats qu'un test de composant devrait tous simuler, et
 * ce qui compte ici n'est pas qu'une page donnee soit juste aujourd'hui mais
 * que la PROCHAINE ne reparte pas sans le jeu. Meme methode que
 * `services/apiParams.test.js`.
 */

const ICI = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(ICI, '..');

function fichiersSource(dossier, sortie = []) {
  for (const nom of readdirSync(dossier)) {
    if (nom === 'node_modules') continue;
    const complet = join(dossier, nom);
    if (statSync(complet).isDirectory()) fichiersSource(complet, sortie);
    else if (/\.jsx?$/.test(nom) && !/\.test\.jsx?$/.test(nom)) sortie.push(complet);
  }
  return sortie;
}

const relatif = (f) => f.slice(SRC.length + 1).split(/[\\/]/).join('/');

/**
 * La valeur de l'attribut `filename`, en suivant les accolades pour ne pas
 * s'arreter au premier `}` d'une interpolation : `${a}` en contient un.
 */
function valeurAttribut(bloc) {
  const i = bloc.indexOf('filename=');
  if (i < 0) return null;
  const reste = bloc.slice(i + 'filename='.length);
  if (reste[0] === '"' || reste[0] === "'") {
    const fin = reste.indexOf(reste[0], 1);
    return reste.slice(0, fin + 1);
  }
  if (reste[0] !== '{') return null;
  let profondeur = 0;
  for (let k = 0; k < reste.length; k++) {
    if (reste[k] === '{') profondeur++;
    else if (reste[k] === '}' && --profondeur === 0) return reste.slice(1, k);
  }
  return null;
}

/** Les `filename` passes a <ExportMenu>, avec leur fichier d'origine. */
function propsFilename() {
  const trouves = [];
  for (const f of fichiersSource(SRC)) {
    const src = readFileSync(f, 'utf8');
    // Un fichier qui se contente de NOMMER le composant dans un commentaire
    // n'en rend pas : on exige l'import.
    if (!/import\s+ExportMenu\s+from/.test(src)) continue;
    for (const morceau of src.split(/<ExportMenu[\s\n]/).slice(1)) {
      const texte = valeurAttribut(morceau.slice(0, 900));
      trouves.push({ fichier: relatif(f), texte: texte ?? '(aucun filename)' });
    }
  }
  return trouves;
}

/**
 * Les composants d'affichage portent EUX AUSSI un <ExportMenu>, avec un nom
 * qui ignore le jeu (`mars_slice_${variableCode}`). Il n'est jamais rendu :
 * les vingt-trois endroits qui montent un afficheur passent tous
 * `noExportMenu`, la console Explorer par un objet etale. Ces noms sont donc
 * du code mort — mais le jour ou quelqu'un affichera un viewer sans cette
 * prop, ils deviendront visibles et faux. Le test le dit plutot que de les
 * exempter en silence.
 */
const AFFICHEURS = [
  'SliceViewer', 'AnimationPlayer', 'CrossSectionViewer', 'HovmollerViewer',
  'ProfileViewer', 'ZonalMeanViewer', 'TransectViewer', 'DifferenceViewer',
  'WindRoseViewer', 'TimeSeriesChart', 'TemporalProfileViewer',
];

const estAfficheur = (f) => AFFICHEURS.some((v) => f.endsWith(`/${v}.jsx`));

/** Les rendus d'afficheur qui n'eteignent PAS leur menu d'export interne. */
function rendusAvecMenu() {
  const fautifs = [];
  for (const f of fichiersSource(SRC)) {
    const src = readFileSync(f, 'utf8');
    for (const v of AFFICHEURS) {
      if (f.endsWith(`/${v}.jsx`)) continue;
      for (const morceau of src.split(new RegExp(`<${v}[\\s\\n]`)).slice(1)) {
        const fin = morceau.indexOf('/>');
        const bloc = fin > 0 ? morceau.slice(0, fin) : morceau.slice(0, 1800);
        // `{...viewerProps}` peut porter la prop : on accepte l'etalement
        // si l'objet etale la declare dans le meme fichier.
        const etale = /\{\.\.\.(\w+)\}/.exec(bloc);
        const viaEtalement = etale && new RegExp(`noExportMenu\\s*:\\s*true`).test(src);
        if (!bloc.includes('noExportMenu') && !viaEtalement) {
          fautifs.push(`${relatif(f)} : <${v}`);
        }
      }
    }
  }
  return fautifs;
}

describe('noms des fichiers exportes', () => {
  it('chaque menu d export REELLEMENT affiche nomme son jeu de donnees', () => {
    const sites = propsFilename();
    // Si ce compte tombe a zero, c'est le test qui est casse, pas le code.
    expect(sites.length, 'aucun <ExportMenu> trouve : le test ne verifie rien')
      .toBeGreaterThan(5);

    const sansJeu = sites
      .filter((s) => !estAfficheur(s.fichier))
      .filter((s) => !s.texte.includes('datasetFileToken'));
    expect(sansJeu.map((s) => `${s.fichier} : ${s.texte.trim().slice(0, 70)}`))
      .toEqual([]);
  });

  it('les menus internes aux afficheurs restent eteints partout', () => {
    expect(rendusAvecMenu()).toEqual([]);
  });

  it('aucun nom d export affiche n est une chaine litterale', () => {
    // `filename="mars_windrose"` etait constant quels que soient le jeu, le
    // point et l'altitude : le pire cas de la famille.
    const litteraux = propsFilename()
      .filter((s) => !estAfficheur(s.fichier))
      .filter((s) => /^"[^"]*"$|^'[^']*'$/.test(s.texte.trim()));
    expect(litteraux.map((s) => `${s.fichier} : ${s.texte.trim()}`)).toEqual([]);
  });

  it('les exports de donnees nomment aussi leur jeu', () => {
    // Le pendant deja corrige : on le fige ici pour que les deux familles
    // restent traitees ensemble.
    const fautifs = [];
    for (const f of fichiersSource(SRC)) {
      const src = readFileSync(f, 'utf8');
      for (const appel of src.split('triggerApiDownload(').slice(1)) {
        const bloc = appel.slice(0, 400);
        const nom = bloc.match(/`([^`]*\.(?:csv|nc))`/);
        if (nom && !nom[1].includes('datasetFileToken')) {
          fautifs.push(`${relatif(f)} : ${nom[1].slice(0, 60)}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });
});
