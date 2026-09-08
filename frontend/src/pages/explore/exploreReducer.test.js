import { describe, it, expect } from 'vitest';
import { exploreReducer, makeInitialState, A, MAX_SESSIONS } from './ExploreContext.jsx';
import { MAX_TABS, MAX_WIND_FIELDS } from './exploreConstants.jsx';

/**
 * Le reducteur de la console est la seule piece qui decide ce que
 * l'utilisateur VOIT : quels onglets existent, lesquels sont dans la grille,
 * quels outils restent actifs. Il se teste seul, sans monter les quatre
 * panneaux, et c'est la ou vivent les invariants qui coutent le plus cher
 * quand ils cassent (une vue qui disparait, un outil impossible a eteindre).
 */

/** Etat de depart. Le reducteur ne fabrique pas son etat par defaut : c'est
 *  `useReducer` qui le lui passe, via `makeInitialState`. */
const depart = () => makeInitialState();

/** Ajoute n vues de type `type` et renvoie l'etat obtenu. */
function avecVues(etat, n, type = 'slice') {
  let s = etat;
  for (let i = 0; i < n; i++) {
    s = exploreReducer(s, {
      type: A.ADD_RESULT,
      result: { id: `v${i}`, type, params: { variable: 'TT' }, data: {} },
    });
  }
  return s;
}

describe('etat initial', () => {
  it('demarre sur une coupe, une seule vue affichee, une session', () => {
    const s = depart();
    expect(s.vizType).toBe('slice');
    expect(s.layout).toBe(1);
    expect(s.resultOrder).toEqual([]);
    expect(s.sessions).toHaveLength(1);
  });

  it('ne connait pas l action inconnue et rend l etat inchange', () => {
    const s = depart();
    expect(exploreReducer(s, { type: 'INEXISTANTE' })).toBe(s);
  });
});

describe('onglets', () => {
  it('empile les vues dans l ordre', () => {
    const s = avecVues(depart(), 3);
    expect(s.resultOrder).toEqual(['v0', 'v1', 'v2']);
  });

  it('REFUSE d ouvrir au-dela du plafond', () => {
    // Le rejeu d une session enregistree avec plus de vues passe aussi ici :
    // le garde-fou doit vivre dans le reducteur, pas seulement dans l interface.
    const s = avecVues(depart(), MAX_TABS + 3);
    expect(s.resultOrder).toHaveLength(MAX_TABS);
  });

  it('ensemence la palette de la vue depuis le gabarit du panneau', () => {
    let s = exploreReducer(depart(), { type: A.SET_COLORSCALE, value: 'Cividis' });
    s = exploreReducer(s, { type: A.SET_Z_MIN, value: '150' });
    s = avecVues(s, 1);
    expect(s.resultsById.v0).toMatchObject({ colorscale: 'Cividis', zMin: '150' });
  });

  it('un reglage de vue ne touche pas les autres vues', () => {
    let s = avecVues(depart(), 2);
    s = exploreReducer(s, { type: A.SET_RESULT_DISPLAY, id: 'v0', key: 'colorscale', value: 'Hot' });
    expect(s.resultsById.v0.colorscale).toBe('Hot');
    expect(s.resultsById.v1.colorscale).toBe('auto');
  });

  it('remplacer le contenu d une vue GARDE sa place et son apparence', () => {
    // « Mettre a jour la vue active » ne doit pas pousser un onglet de plus
    // ni perdre la palette choisie pour cette vue.
    let s = avecVues(depart(), 2);
    s = exploreReducer(s, { type: A.SET_RESULT_DISPLAY, id: 'v0', key: 'colorscale', value: 'Hot' });
    s = exploreReducer(s, { type: A.SET_RESULT_DISPLAY, id: 'v0', key: 'zMin', value: '10' });
    s = exploreReducer(s, {
      type: A.REPLACE_RESULT, id: 'v0',
      result: { type: 'slice', params: { variable: 'H2O' }, data: {} },
    });
    expect(s.resultOrder).toEqual(['v0', 'v1']);
    expect(s.resultsById.v0.params.variable).toBe('H2O');
    expect(s.resultsById.v0.colorscale).toBe('Hot');
    expect(s.resultsById.v0.zMin).toBe('10');
  });

  it('ignore un reglage vise sur une vue disparue', () => {
    const s = avecVues(depart(), 1);
    expect(exploreReducer(s, {
      type: A.SET_RESULT_DISPLAY, id: 'absente', key: 'colorscale', value: 'Hot',
    })).toBe(s);
  });

  it('ignore le remplacement d une vue disparue', () => {
    const s = avecVues(depart(), 1);
    expect(exploreReducer(s, { type: A.REPLACE_RESULT, id: 'absente', result: {} })).toBe(s);
  });

  it('fermer la vue active bascule sur la derniere restante', () => {
    let s = avecVues(depart(), 3);
    s = exploreReducer(s, { type: A.SET_ACTIVE_RESULT, value: 'v1' });
    s = exploreReducer(s, { type: A.REMOVE_RESULT, id: 'v1' });
    expect(s.resultOrder).toEqual(['v0', 'v2']);
    expect(s.activeResult).toBe('v2');
  });

  it('fermer une vue INACTIVE ne change pas la vue active', () => {
    let s = avecVues(depart(), 3);
    s = exploreReducer(s, { type: A.SET_ACTIVE_RESULT, value: 'v2' });
    s = exploreReducer(s, { type: A.REMOVE_RESULT, id: 'v0' });
    expect(s.activeResult).toBe('v2');
  });

  it('fermer la derniere vue laisse la console vide, pas incoherente', () => {
    let s = avecVues(depart(), 1);
    s = exploreReducer(s, { type: A.SET_ACTIVE_RESULT, value: 'v0' });
    s = exploreReducer(s, { type: A.REMOVE_RESULT, id: 'v0' });
    expect(s.resultOrder).toEqual([]);
    expect(s.activeResult).toBeNull();
    expect(s.gridIds).toEqual([]);
  });
});

describe('grille', () => {
  it('remplit les cases manquantes depuis l ordre des onglets', () => {
    let s = avecVues(depart(), 4);
    s = exploreReducer(s, { type: A.SET_LAYOUT, value: 4 });
    expect(s.gridIds).toEqual(['v0', 'v1', 'v2', 'v3']);
  });

  it('ne garde jamais plus de cases que la disposition', () => {
    let s = avecVues(depart(), 4);
    s = exploreReducer(s, { type: A.SET_LAYOUT, value: 4 });
    s = exploreReducer(s, { type: A.SET_LAYOUT, value: 2 });
    expect(s.gridIds).toHaveLength(2);
  });

  it('purge les vues fermees de la grille', () => {
    let s = avecVues(depart(), 4);
    s = exploreReducer(s, { type: A.SET_LAYOUT, value: 4 });
    s = exploreReducer(s, { type: A.REMOVE_RESULT, id: 'v1' });
    expect(s.gridIds).not.toContain('v1');
    expect(s.gridIds).toHaveLength(3);
  });

  it('ne reorganise RIEN quand on active une vue deja affichee', () => {
    // Cliquer sur une cellule de la grille ne doit pas faire sauter les autres.
    let s = avecVues(depart(), 4);
    s = exploreReducer(s, { type: A.SET_LAYOUT, value: 4 });
    const avant = [...s.gridIds];
    s = exploreReducer(s, { type: A.SET_ACTIVE_RESULT, value: 'v2' });
    expect(s.gridIds).toEqual(avant);
  });

  it('fait entrer dans la grille une vue activee qui n y etait pas', () => {
    let s = avecVues(depart(), 4);
    s = exploreReducer(s, { type: A.SET_LAYOUT, value: 2 });
    expect(s.gridIds).toEqual(['v0', 'v1']);
    s = exploreReducer(s, { type: A.SET_ACTIVE_RESULT, value: 'v3' });
    expect(s.gridIds).toContain('v3');
    expect(s.gridIds).toHaveLength(2);
  });

  it('ne met jamais deux fois la meme vue dans la grille', () => {
    let s = avecVues(depart(), 2);
    s = exploreReducer(s, { type: A.SET_LAYOUT, value: 4 });
    expect(new Set(s.gridIds).size).toBe(s.gridIds.length);
  });
});

describe('outils contextuels', () => {
  it('eteint l outil region quand la vue active ne le propose pas', () => {
    // Le bouton de l outil disparait avec la vue : sans cet assainissement,
    // le mode devenait impossible a eteindre et se rallumait tout seul.
    let s = avecVues(depart(), 1, 'slice');
    s = exploreReducer(s, { type: A.SET_ACTIVE_RESULT, value: 'v0' });
    s = exploreReducer(s, { type: A.TOGGLE_ROI });
    expect(s.roiMode).toBe(true);
    s = exploreReducer(s, {
      type: A.ADD_RESULT,
      result: { id: 'p', type: 'profile', params: {}, data: {} },
    });
    s = exploreReducer(s, { type: A.SET_ACTIVE_RESULT, value: 'p' });
    expect(s.roiMode).toBe(false);
    expect(s.roiEntry).toBeNull();
  });

  it('garde l outil region sur une vue qui le propose', () => {
    let s = avecVues(depart(), 1, 'difference');
    s = exploreReducer(s, { type: A.SET_ACTIVE_RESULT, value: 'v0' });
    s = exploreReducer(s, { type: A.TOGGLE_ROI });
    s = exploreReducer(s, { type: A.SET_ACTIVE_RESULT, value: 'v0' });
    expect(s.roiMode).toBe(true);
  });

  it('l outil transect ne vit que sur une coupe NON derivee', () => {
    let s = avecVues(depart(), 1, 'slice');
    s = exploreReducer(s, { type: A.SET_ACTIVE_RESULT, value: 'v0' });
    s = exploreReducer(s, { type: A.TOGGLE_TRANSECT });
    expect(s.transectMode).toBe(true);
    s = exploreReducer(s, {
      type: A.ADD_RESULT,
      result: { id: 'd', type: 'slice', derived: 'wsp', params: {}, data: {} },
    });
    s = exploreReducer(s, { type: A.SET_ACTIVE_RESULT, value: 'd' });
    expect(s.transectMode).toBe(false);
  });
});

describe('rideau A/B', () => {
  it('ne survit pas a la fermeture d un de ses deux volets', () => {
    let s = avecVues(depart(), 2);
    s = exploreReducer(s, { type: A.SET_ACTIVE_RESULT, value: 'v0' });
    s = exploreReducer(s, { type: A.SET_CURTAIN_B, value: 'v1' });
    s = exploreReducer(s, { type: A.TOGGLE_CURTAIN });
    expect(s.curtainOn).toBe(true);
    s = exploreReducer(s, { type: A.REMOVE_RESULT, id: 'v1' });
    expect(s.curtainOn).toBe(false);
    expect(s.curtainBId).toBeNull();
  });

  it('survit a la fermeture d une TROISIEME vue', () => {
    let s = avecVues(depart(), 3);
    s = exploreReducer(s, { type: A.SET_ACTIVE_RESULT, value: 'v0' });
    s = exploreReducer(s, { type: A.SET_CURTAIN_B, value: 'v1' });
    s = exploreReducer(s, { type: A.TOGGLE_CURTAIN });
    s = exploreReducer(s, { type: A.REMOVE_RESULT, id: 'v2' });
    expect(s.curtainOn).toBe(true);
  });
});

describe('cache des champs de vent', () => {
  it('est BORNE et evince la plus ancienne entree', () => {
    // Un champ de vent pese plusieurs centaines de kilo-octets : sans plafond,
    // une longue session d exploration les accumule tous.
    let s = depart();
    for (let i = 0; i < MAX_WIND_FIELDS + 3; i++) {
      s = exploreReducer(s, { type: A.SET_WIND_FIELD, key: `cle${i}`, value: { u: [i] } });
    }
    const cles = Object.keys(s.windFields);
    expect(cles).toHaveLength(MAX_WIND_FIELDS);
    expect(cles).not.toContain('cle0');
    expect(cles).toContain(`cle${MAX_WIND_FIELDS + 2}`);
  });

  it('la cle EST la requete : une entree ne peut pas servir pour une autre altitude', () => {
    let s = exploreReducer(depart(), {
      type: A.SET_WIND_FIELD, key: 'ds|24|49', value: { u: [1] },
    });
    s = exploreReducer(s, { type: A.SET_WIND_FIELD, key: 'ds|24|50', value: { u: [2] } });
    expect(s.windFields['ds|24|49'].u).toEqual([1]);
    expect(s.windFields['ds|24|50'].u).toEqual([2]);
  });
});

describe('sessions', () => {
  it('ouvre une session vierge et met l ancienne de cote', () => {
    let s = avecVues(depart(), 2);
    const idPremiere = s.activeSession;
    s = exploreReducer(s, { type: A.ADD_SESSION });
    expect(s.sessions).toHaveLength(2);
    expect(s.resultOrder).toEqual([]);
    expect(s.sessionStore[idPremiere].resultOrder).toEqual(['v0', 'v1']);
  });

  it('reprend le premier numero LIBRE, pas un compteur qui monte', () => {
    // Fermer « Session 2 » puis en creer une doit redonner « Session 2 ».
    let s = exploreReducer(depart(), { type: A.ADD_SESSION });
    const deuxieme = s.activeSession;
    s = exploreReducer(s, { type: A.ADD_SESSION });
    s = exploreReducer(s, { type: A.REMOVE_SESSION, id: deuxieme });
    s = exploreReducer(s, { type: A.ADD_SESSION });
    expect(s.sessions.map((x) => x.num).sort()).toEqual([1, 2, 3]);
  });

  it('refuse d ouvrir au-dela du plafond', () => {
    let s = depart();
    for (let i = 0; i < MAX_SESSIONS + 2; i++) s = exploreReducer(s, { type: A.ADD_SESSION });
    expect(s.sessions).toHaveLength(MAX_SESSIONS);
  });

  it('restaure les onglets en revenant sur une session', () => {
    let s = avecVues(depart(), 2);
    const premiere = s.activeSession;
    s = exploreReducer(s, { type: A.ADD_SESSION });
    s = avecVues(s, 1);
    s = exploreReducer(s, { type: A.SWITCH_SESSION, id: premiere });
    expect(s.resultOrder).toEqual(['v0', 'v1']);
  });

  it('ignore une bascule vers la session courante ou vers une session inconnue', () => {
    const s = avecVues(depart(), 1);
    expect(exploreReducer(s, { type: A.SWITCH_SESSION, id: s.activeSession })).toBe(s);
    expect(exploreReducer(s, { type: A.SWITCH_SESSION, id: 'inexistante' })).toBe(s);
  });

  it('vide les champs de vent en changeant de session', () => {
    // Ils appartiennent aux vues de la session quittee : les garder ferait
    // porter a la nouvelle session la memoire de l ancienne.
    let s = exploreReducer(depart(), { type: A.SET_WIND_FIELD, key: 'k', value: {} });
    s = exploreReducer(s, { type: A.ADD_SESSION });
    expect(s.windFields).toEqual({});
  });

  it('refuse de fermer la DERNIERE session', () => {
    const s = depart();
    expect(exploreReducer(s, { type: A.REMOVE_SESSION, id: s.activeSession })).toBe(s);
  });

  it('fermer la session active bascule sur la premiere restante', () => {
    let s = exploreReducer(depart(), { type: A.ADD_SESSION });
    const active = s.activeSession;
    s = exploreReducer(s, { type: A.REMOVE_SESSION, id: active });
    expect(s.sessions).toHaveLength(1);
    expect(s.activeSession).not.toBe(active);
  });

  it('fermer une session INACTIVE ne deplace pas l utilisateur', () => {
    let s = exploreReducer(depart(), { type: A.ADD_SESSION });
    const active = s.activeSession;
    const autre = s.sessions.find((x) => x.id !== active).id;
    s = exploreReducer(s, { type: A.REMOVE_SESSION, id: autre });
    expect(s.activeSession).toBe(active);
  });

  it('renomme une session, et un nom vide revient au nom par defaut', () => {
    let s = depart();
    const id = s.activeSession;
    s = exploreReducer(s, { type: A.RENAME_SESSION, id, name: '  Tempete  ' });
    expect(s.sessions[0].name).toBe('Tempete');
    s = exploreReducer(s, { type: A.RENAME_SESSION, id, name: '   ' });
    expect(s.sessions[0].name).toBeNull();
  });

  it('rehydrate les sessions enregistrees', () => {
    const s = exploreReducer(depart(), {
      type: A.HYDRATE_SESSIONS,
      sessions: [{ id: 'a', name: 'Une', num: 1 }, { id: 'b', name: null, num: 2 }],
      activeSession: 'b',
      sessionCounter: 2,
    });
    expect(s.sessions).toHaveLength(2);
    expect(s.activeSession).toBe('b');
  });
});

describe('bascules simples', () => {
  it.each([
    [A.TOGGLE_LOCATIONS, 'showLocations'],
    [A.TOGGLE_SURFACE, 'showSurface'],
    [A.TOGGLE_TOOLTIP, 'showDetailedTooltip'],
    [A.TOGGLE_ANOMALY, 'showAnomaly'],
    [A.TOGGLE_WIND, 'showWind'],
    [A.TOGGLE_WIND_PARTICLES, 'showWindParticles'],
    [A.TOGGLE_TOPO, 'showTopo'],
    [A.TOGGLE_LOG, 'showLog'],
    [A.TOGGLE_SYNC_ZOOM, 'syncZoom'],
  ])('%s inverse %s', (action, champ) => {
    const avant = depart()[champ];
    const apres = exploreReducer(depart(), { type: action });
    expect(apres[champ]).toBe(!avant);
  });

  it('le lissage part actif et se coupe', () => {
    expect(depart().smoothHeatmap).toBe(true);
    expect(exploreReducer(depart(), { type: A.TOGGLE_SMOOTH }).smoothHeatmap).toBe(false);
  });

  it('porte l erreur puis l efface', () => {
    let s = exploreReducer(depart(), { type: A.SET_ERROR, value: 'Boum' });
    expect(s.error).toBe('Boum');
    s = exploreReducer(s, { type: A.CLEAR_ERROR });
    expect(s.error).toBeNull();
  });
});
