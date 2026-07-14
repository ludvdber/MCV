import { describe, it, expect } from 'vitest';
import { parseCommand } from './commandParser.js';
import { MARS_LOCATIONS } from '../../data/marsLocations';

/**
 * Parseur de la barre de commande : cas MEAN, INDIVIDUAL et combinaisons
 * invalides. Le traducteur est un stub qui renvoie la cle telle quelle,
 * les jetons sont donc verifies sur les cles i18n.
 */

const t = (k) => k;

const MEAN = [
  { id: 'mean_MY35_Ls0_30', marsYear: 35, lsStart: 0, lsEnd: 30 },
  { id: 'mean_MY35_Ls270_300', marsYear: 35, lsStart: 270, lsEnd: 300 },
];

// Reflete le catalogue reel : MY34 n'existe QUE en individual, Ls 0 a 10.09.
const IND = [{ marsYear: 34, lsMin: 0, lsMax: 10.09 }];

const ctx = { datasets: MEAN, individualYears: IND, t };

describe('parseCommand — reconnaissance de base', () => {
  it('variable + altitude + heure locale', () => {
    const { plan } = parseCommand('TT 50 km 14h', ctx);
    expect(plan.variable).toBe('TT');
    expect(plan.altKm).toBe(50);
    // 14h → pas 28 : inverse EXACT de formatTime (idx → idx/2 h, convention des
    // fichiers), soit formatTime(28) = 14.0h. (pas k = k*0,5 h, k=0 = minuit)
    expect(plan.timeIdx).toBe(28);
  });

  it('lieu martien connu', () => {
    const hellas = MARS_LOCATIONS.find(l => l.name.toLowerCase().includes('hellas'));
    const { plan } = parseCommand('TT vers Hellas', ctx);
    expect(plan.lat).toBe(Math.round(hellas.lat));
    expect(plan.lon).toBe(Math.round(hellas.lon));
  });

  it('phrase sans rien de reconnaissable', () => {
    const { tokens, plan } = parseCommand('blabla xyz introuvable', ctx);
    expect(tokens).toHaveLength(0);
    expect(plan.datasetId).toBeUndefined();
  });
});

describe('parseCommand — heure locale coherente avec formatTime', () => {
  // formatTime(idx) = idx/2 h (convention fichiers) : midi (12h) = pas 24,
  // minuit (0h) = pas 0.
  it('midi → pas 24 (12.0h)', () => {
    expect(parseCommand('TT midi', ctx).plan.timeIdx).toBe(24);
  });
  it('noon → pas 24 (12.0h)', () => {
    expect(parseCommand('TT noon', ctx).plan.timeIdx).toBe(24);
  });
  it('minuit → pas 0 (00:00)', () => {
    expect(parseCommand('TT minuit', ctx).plan.timeIdx).toBe(0);
  });
  it('midnight → pas 0, PAS la branche midi', () => {
    expect(parseCommand('TT midnight', ctx).plan.timeIdx).toBe(0);
  });
  it('« afternoon » ne declenche pas midi (ancre de mot)', () => {
    expect(parseCommand('TT afternoon', ctx).plan.timeIdx).toBeUndefined();
  });
});

describe('parseCommand — datasets MEAN et INDIVIDUAL', () => {
  it('MY couvert par un MEAN : le MEAN reste prioritaire', () => {
    const { plan } = parseCommand('TT my 35 ls 5', ctx);
    expect(plan.datasetId).toBe('mean_MY35_Ls0_30');
    expect(plan.individual).toBeUndefined();
  });

  it('saison → plage Ls du bon MEAN', () => {
    const { plan } = parseCommand('TT hiver my 35', ctx);
    expect(plan.datasetId).toBe('mean_MY35_Ls270_300');
  });

  it('MY uniquement individual : repli sur le catalogue INDIVIDUAL', () => {
    const { plan, tokens } = parseCommand('TT 10 km ls 5 my 34', ctx);
    expect(plan.datasetId).toBe('IND_MY34_LS5.00');
    expect(plan.individual).toEqual({ my: 34, ls: 5 });
    expect(tokens.some(tk => tk.type === 'dataset'
      && tk.label.includes('explore.cmdk.individualTag'))).toBe(true);
  });

  it('individual sans Ls demande : debut de la plage disponible', () => {
    const { plan } = parseCommand('TT my 34', ctx);
    expect(plan.datasetId).toBe('IND_MY34_LS0.00');
  });

  it('Ls hors de la plage individual : aucun dataset', () => {
    const { plan, tokens } = parseCommand('TT my 34 ls 200', ctx);
    expect(plan.datasetId).toBeUndefined();
    expect(tokens.some(tk => tk.type === 'missing'
      && tk.label === 'explore.cmdk.noDataset')).toBe(true);
  });
});

describe('parseCommand — coherence vue / dataset', () => {
  it('vue MEAN-only sur un fichier individuel : plan invalide + message', () => {
    const { plan, tokens } = parseCommand('marées TT my 34 ls 5', ctx);
    expect(plan.viz).toBe('tides');
    expect(plan.datasetId).toBe('IND_MY34_LS5.00');
    expect(plan.invalid).toBe(true);
    expect(tokens.some(tk => tk.type === 'missing'
      && tk.label === 'explore.cmdk.meanOnly')).toBe(true);
  });

  it('vue compatible sur un fichier individuel : plan valide', () => {
    const { plan } = parseCommand('carte TT my 34 ls 5', ctx);
    expect(plan.viz).toBe('slice');
    expect(plan.invalid).toBeUndefined();
  });

  it('vue MEAN-only sur un dataset MEAN : plan valide', () => {
    const { plan } = parseCommand('marées TT my 35 ls 5', ctx);
    expect(plan.viz).toBe('tides');
    expect(plan.invalid).toBeUndefined();
  });
});
