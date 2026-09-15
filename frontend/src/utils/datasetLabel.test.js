import { describe, it, expect } from 'vitest';
import { formatDatasetId, datasetFileToken } from './datasetLabel';

/** i18n de test : rend visible ce qui est passe au format i18n. */
const t = (cle, vars) => `${cle}(${vars.my},${vars.lsStart},${vars.lsEnd})`;

describe('formatDatasetId', () => {
  it('rend un dataset MEAN lisible via la cle i18n partagee', () => {
    expect(formatDatasetId('mean_MY35_Ls60_90', t)).toBe('selector.dataset.format(35,60,90)');
  });

  it('passe des NOMBRES au format i18n, pas des chaines', () => {
    // Un « 09 » textuel s'afficherait tel quel ; Number() le ramene a 9 et
    // laisse l'i18n decider du formatage.
    const capture = (cle, vars) => vars;
    expect(formatDatasetId('mean_MY35_Ls00_030', capture)).toEqual({ my: 35, lsStart: 0, lsEnd: 30 });
  });

  it('rend un dataset INDIVIDUAL avec son Ls reel a deux decimales', () => {
    expect(formatDatasetId('IND_MY34_LS5.00', t)).toBe('MY34 · Ls 5.00°');
    expect(formatDatasetId('IND_MY34_LS1.8912', t)).toBe('MY34 · Ls 1.89°');
  });

  it('reconnait l identifiant individuel quelle que soit la casse', () => {
    expect(formatDatasetId('ind_my34_ls5.00', t)).toBe('MY34 · Ls 5.00°');
  });

  it('fait passer INDIVIDUAL avant MEAN', () => {
    // Les deux motifs peuvent mordre sur le meme identifiant : l'ordre decide,
    // et c'est le Ls REEL qui doit gagner sur une plage deduite.
    expect(formatDatasetId('IND_MY34_LS5.00_0000', t)).toBe('MY34 · Ls 5.00°');
  });

  it('renvoie l identifiant brut quand rien n est reconnu (aucune perte)', () => {
    expect(formatDatasetId('quelque_chose', t)).toBe('quelque_chose');
  });

  it('renvoie une chaine vide sur un identifiant absent', () => {
    expect(formatDatasetId('', t)).toBe('');
    expect(formatDatasetId(null, t)).toBe('');
    expect(formatDatasetId(undefined, t)).toBe('');
  });

  it('accepte les separateurs tolerés par le motif MEAN', () => {
    expect(formatDatasetId('MY 35 Ls 60-90', t)).toBe('selector.dataset.format(35,60,90)');
    expect(formatDatasetId('MY_35_Ls_60.90', t)).toBe('selector.dataset.format(35,60,90)');
  });
});

describe('datasetFileToken', () => {
  // Le defaut d'origine : deux tranches de TT au meme pas de temps et a la meme
  // altitude, l'une du printemps nord, l'autre de l'ete sud, se telechargeaient
  // toutes deux sous « slice_TT_t0_a0.nc ». Le jeton est ce qui les separe.
  const PRINTEMPS = 'hl-b274_032094p_ls000_0000_MY35_sol668to739_71days_mean_crossdir';
  const ETE       = 'hl-b274_056796p_ls270_0000_MY35_sol1183to1230_47days_mean_crossdir';

  it('distingue deux jeux de la meme annee martienne', () => {
    expect(datasetFileToken(PRINTEMPS)).toBe('MY35_Ls000');
    expect(datasetFileToken(ETE)).toBe('MY35_Ls270');
    expect(datasetFileToken(PRINTEMPS)).not.toBe(datasetFileToken(ETE));
  });

  it('reconnait un jeu INDIVIDUAL et rend son Ls sur en point utilisable', () => {
    // Un point est legal dans un nom de fichier mais se confond avec
    // l'extension a la lecture : « p » leve l'ambiguite.
    expect(datasetFileToken('IND_MY34_LS5.00')).toBe('MY34_Ls5p00');
  });

  it('ne produit que des caracteres surs pour un nom de fichier', () => {
    for (const id of [PRINTEMPS, ETE, 'IND_MY34_LS5.00', 'jeu/inconnu:bizarre', '']) {
      expect(datasetFileToken(id)).toMatch(/^[A-Za-z0-9._-]+$/);
    }
  });

  it('se rabat sur l identifiant assaini plutot que sur rien', () => {
    // Mieux vaut un nom long qu un nom ambigu : on ne perd jamais le jeu.
    expect(datasetFileToken('jeu/inconnu:bizarre')).toBe('jeu_inconnu_bizarre');
    expect(datasetFileToken('')).toBe('dataset');
    expect(datasetFileToken(null)).toBe('dataset');
  });

  it('borne la longueur du repli', () => {
    expect(datasetFileToken('x'.repeat(200)).length).toBeLessThanOrEqual(40);
  });
});
