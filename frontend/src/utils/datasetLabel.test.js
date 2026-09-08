import { describe, it, expect } from 'vitest';
import { formatDatasetId } from './datasetLabel';

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
