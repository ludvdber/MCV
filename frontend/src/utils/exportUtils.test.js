import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { triggerDownload, triggerApiDownload, downloadTextFile, downloadAnimationCSV } from './exportUtils';

/**
 * jsdom n'implemente ni URL.createObjectURL ni le telechargement d'une ancre :
 * on instrumente les deux pour observer CE QUI EST DEMANDE au navigateur
 * (l'URL construite, le nom de fichier, la revocation) plutot que le
 * telechargement lui-meme, qui n'appartient pas a ce module.
 */
let clicked;
let revoked;
let created;

beforeEach(() => {
  clicked = [];
  revoked = [];
  created = [];
  let seq = 0;
  URL.createObjectURL = vi.fn((blob) => { created.push(blob); return `blob:mcv/${seq++}`; });
  URL.revokeObjectURL = vi.fn((url) => { revoked.push(url); });
  // HTMLAnchorElement.prototype.click ne navigue pas en jsdom mais existe :
  // on l'espionne pour lire href/download au moment du clic.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function spy() {
    clicked.push({ href: this.getAttribute('href'), download: this.getAttribute('download') });
  });
});

afterEach(() => { vi.restoreAllMocks(); });

/** Lit le texte d'un Blob (FileReader n'est pas necessaire : .text() existe en jsdom). */
const texte = (blob) => blob.text();

describe('triggerDownload', () => {
  it('clique une ancre portant l URL et le nom demandes', () => {
    triggerDownload('blob:xyz', 'fichier.csv');
    expect(clicked).toEqual([{ href: 'blob:xyz', download: 'fichier.csv' }]);
  });

  it('revoque l Object URL immediatement apres le clic', () => {
    triggerDownload('blob:xyz', 'fichier.csv');
    // Sans revocation, chaque export garde son blob en memoire jusqu'au
    // rechargement de la page : une session d'exploration en produit des dizaines.
    expect(revoked).toEqual(['blob:xyz']);
  });

  it('ne laisse pas l ancre dans le document', () => {
    triggerDownload('blob:xyz', 'fichier.csv');
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
  });
});

describe('downloadTextFile', () => {
  it('construit un Blob CSV UTF-8 par defaut', async () => {
    downloadTextFile('a,b\n1,2', 'test.csv');
    expect(created).toHaveLength(1);
    expect(created[0].type).toBe('text/csv;charset=utf-8;');
    expect(await texte(created[0])).toBe('a,b\n1,2');
    expect(clicked[0].download).toBe('test.csv');
  });

  it('accepte un type MIME explicite', () => {
    downloadTextFile('{}', 'test.json', 'application/json');
    expect(created[0].type).toBe('application/json');
  });
});

describe('triggerApiDownload', () => {
  it('telecharge le corps de la reponse sous le nom demande', async () => {
    const blob = new Blob(['contenu'], { type: 'text/csv' });
    await triggerApiDownload(Promise.resolve({ data: blob }), 'api.csv');
    expect(created[0]).toBe(blob);
    expect(clicked[0].download).toBe('api.csv');
  });

  it('avale un rejet sans propager (l intercepteur Axios a deja notifie)', async () => {
    // Le contrat compte : si cette promesse rejetait, le `.catch` manquant dans
    // les pages appelantes produirait un unhandled rejection dans la console
    // du visiteur pour une erreur DEJA affichee par le toast.
    await expect(triggerApiDownload(Promise.reject(new Error('503')), 'api.csv'))
      .resolves.toBeUndefined();
    expect(clicked).toHaveLength(0);
  });
});

describe('downloadAnimationCSV', () => {
  const frames = [
    [[1, 2], [3, 4]],       // min 1, max 4, moyenne 2.5
    [[10, 20], [30, 40]],   // min 10, max 40, moyenne 25
  ];

  it('produit un en-tete nomme d apres la variable', async () => {
    downloadAnimationCSV(frames, 'TT', 49);
    const lignes = (await texte(created[0])).split('\n');
    expect(lignes[0]).toBe('timestep,heure_martienne_h,TT_min,TT_max,TT_mean');
  });

  it('calcule min, max et moyenne sur toute la grille de chaque frame', async () => {
    downloadAnimationCSV(frames, 'TT', 49);
    const lignes = (await texte(created[0])).split('\n');
    expect(lignes[1]).toBe('0,12.00,1.0000,4.0000,2.5000');
    expect(lignes[2]).toBe('1,24.00,10.0000,40.0000,25.0000');
  });

  it('repartit les frames sur 24 h quelle que soit leur nombre', async () => {
    const huit = Array.from({ length: 8 }, (_, k) => [[k]]);
    downloadAnimationCSV(huit, 'TT', 0);
    const lignes = (await texte(created[0])).split('\n');
    // 8 frames => pas de 3 h ; la derniere ligne boucle a 24 h.
    expect(lignes[1].split(',')[1]).toBe('3.00');
    expect(lignes[8].split(',')[1]).toBe('24.00');
  });

  it('nomme le fichier avec la variable et l altitude', () => {
    downloadAnimationCSV(frames, 'H2O', 7);
    expect(clicked[0].download).toBe('animation_H2O_alt7.csv');
  });

  it('ne deplie pas les grilles (pas de Math.max(...flat))', async () => {
    // 40 000 cellules : `Math.max(...frame.flat())` depasse la taille maximale
    // de la pile d'arguments et leve un RangeError. L'iteration directe non.
    const grande = [Array.from({ length: 200 }, (_, i) => Array.from({ length: 200 }, (_, j) => i * 200 + j))];
    expect(() => downloadAnimationCSV(grande, 'TT', 0)).not.toThrow();
    const ligne = (await texte(created[0])).split('\n')[1];
    expect(ligne).toContain('0.0000,39999.0000');
  });
});
