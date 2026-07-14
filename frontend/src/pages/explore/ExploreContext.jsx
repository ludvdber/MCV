/* eslint-disable react-refresh/only-export-components -- fichier contexte : Provider + hooks colocalises (pattern React standard) */
/**
 * Contexte React pour la page d'exploration.
 *
 * Gère l'état local de la page Explore (17 variables) via useReducer.
 * Deux contextes séparés (pattern recommandé React docs) :
 *   - ExploreStateContext   → données, re-render quand state change
 *   - ExploreDispatchContext → dispatch stable, ne cause pas de re-renders
 *
 * Usage :
 *   const state    = useExploreState();
 *   const dispatch = useExploreDispatch();
 *   dispatch({ type: A.SET_VIZ_TYPE, value: 'slice' });
 */
import { createContext, useContext, useReducer } from 'react';
import { MAX_TABS } from './exploreConstants.jsx';

/* ─── Action types ─────────────────────────────────────────────────────────── */
export const A = Object.freeze({
  // Paramètres de visualisation
  SET_VIZ_TYPE:        'SET_VIZ_TYPE',
  SET_CROSS_SECTION:   'SET_CROSS_SECTION',
  SET_HOVMOLLER_TYPE:  'SET_HOVMOLLER_TYPE',
  SET_COLORSCALE:      'SET_COLORSCALE',
  SET_Z_MIN:           'SET_Z_MIN',
  SET_Z_MAX:           'SET_Z_MAX',
  // Palette / plage de légende PROPRES à une vue (override par résultat)
  SET_RESULT_DISPLAY:  'SET_RESULT_DISPLAY',
  // Toggles d'affichage
  TOGGLE_LOCATIONS:    'TOGGLE_LOCATIONS',
  TOGGLE_SURFACE:      'TOGGLE_SURFACE',
  TOGGLE_TOOLTIP:      'TOGGLE_TOOLTIP',
  TOGGLE_ANOMALY:      'TOGGLE_ANOMALY',
  TOGGLE_WIND:         'TOGGLE_WIND',
  TOGGLE_WIND_PARTICLES: 'TOGGLE_WIND_PARTICLES',
  TOGGLE_TOPO:         'TOGGLE_TOPO',
  SET_TOPO_DATA:       'SET_TOPO_DATA',
  TOGGLE_LOG:          'TOGGLE_LOG',
  TOGGLE_SMOOTH:       'TOGGLE_SMOOTH',
  SET_INTERP_STEP:     'SET_INTERP_STEP',
  // Données de vent (fetch async)
  SET_WIND_DATA:       'SET_WIND_DATA',
  // Gestion des onglets de résultats
  ADD_RESULT:          'ADD_RESULT',
  REPLACE_RESULT:      'REPLACE_RESULT',
  REMOVE_RESULT:       'REMOVE_RESULT',
  SET_ACTIVE_RESULT:   'SET_ACTIVE_RESULT',
  // Console multi-vues
  SET_LAYOUT:          'SET_LAYOUT',
  TOGGLE_CURTAIN:      'TOGGLE_CURTAIN',
  SET_CURTAIN_B:       'SET_CURTAIN_B',
  // Statistiques de region (rectangle trace sur la carte active)
  TOGGLE_ROI:          'TOGGLE_ROI',
  SET_ROI_ENTRY:       'SET_ROI_ENTRY',
  // Transect grand-cercle (ligne A → B tracee sur la carte active)
  TOGGLE_TRANSECT:     'TOGGLE_TRANSECT',
  // Zoom synchronise entre cartes lat/lon de la grille
  TOGGLE_SYNC_ZOOM:    'TOGGLE_SYNC_ZOOM',
  // Sessions nommees (jeux d'onglets independants, chips de la barre d'onglets)
  ADD_SESSION:         'ADD_SESSION',
  SWITCH_SESSION:      'SWITCH_SESSION',
  RENAME_SESSION:      'RENAME_SESSION',
  REMOVE_SESSION:      'REMOVE_SESSION',
  HYDRATE_SESSIONS:    'HYDRATE_SESSIONS',
  // État UI asynchrone
  SET_LOADING:         'SET_LOADING',
  SET_ERROR:           'SET_ERROR',
  CLEAR_ERROR:         'CLEAR_ERROR',
  SET_LINK_COPIED:     'SET_LINK_COPIED',
  SET_PENDING_AUTO:    'SET_PENDING_AUTO',
  SET_DATASET_B:       'SET_DATASET_B',
  REORDER_RESULTS:     'REORDER_RESULTS',
});

/* ─── État initial ─────────────────────────────────────────────────────────── */
const initialState = {
  vizType:             'slice',
  crossSectionType:    'meridional',
  hovmollerType:       'latitude',
  colorscale:          'auto',
  zMinInput:           '',
  zMaxInput:           '',
  showLocations:       false,
  showSurface:         false,
  showDetailedTooltip: false,
  showAnomaly:         false,
  showWind:            false,
  showWindParticles:   false,
  showTopo:            false,
  topoData:            null,
  showLog:             false,
  // Defauts : lissage actif sur la grille native (interpolation en option).
  smoothHeatmap:       true,
  interpStep:          0,
  windData:            null,
  resultsById:         {},   // { [id]: result } — lookup O(1) sans parcourir tout le tableau
  resultOrder:         [],   // [id, id, ...] — ordre des onglets pour le rendu
  activeResult:        null,
  // Console multi-vues : nombre de vues affichées simultanément (1, 2 ou 4)
  layout:              1,
  // Contenu EXPLICITE de la grille (layout > 1) : la liste ne change que via
  // normalizeGrid — jamais recalculée au rendu, donc jamais de vue qui
  // disparaît sans action de l'utilisateur.
  gridIds:             [],
  // Rideau A/B : superpose deux slices de même variable avec une poignée glissante
  curtainOn:           false,
  curtainBId:          null,
  // Statistiques de région : outil actif + dernière sélection { resultId, stats }
  roiMode:             false,
  roiEntry:            null,
  // Outil transect grand-cercle (exclusif avec l'outil région : les deux
  // couches canvas se superposeraient sur la même carte)
  transectMode:        false,
  // Zoom synchronisé : un recadrage sur une carte lat/lon de la grille
  // s'applique à toutes les autres (bus syncZoomBus)
  syncZoom:            false,
  // Sessions nommées : chaque session est un jeu d'onglets complet ; les
  // sessions inactives vivent en instantanés dans sessionStore.
  sessions:            [{ id: 's1', name: null, num: 1 }],
  activeSession:       's1',
  sessionStore:        {},
  sessionCounter:      1,
  loading:             false,
  error:               null,
  linkCopied:          false,
  pendingAutoLaunch:   false,
  datasetB:            '',
};

/** Nombre maximum de sessions simultanées (chips du header). */
export const MAX_SESSIONS = 4;

/** État vierge d'une session (champs sauvegardés/restaurés par session). */
const SESSION_BLANK = {
  resultsById: {}, resultOrder: [], gridIds: [], activeResult: null,
  layout: 1, curtainOn: false, curtainBId: null, roiEntry: null,
};

/** Instantané des champs de session de l'état courant. */
function snapshotOf(state) {
  const snap = {};
  for (const k of Object.keys(SESSION_BLANK)) snap[k] = state[k];
  return snap;
}

/**
 * Contenu de grille valide et prévisible :
 *   - uniquement des ids vivants, sans doublon, au plus `layout` cases
 *   - les cases manquantes sont complétées depuis l'ordre des onglets
 *   - l'onglet actif est toujours visible (il prend la dernière case s'il manquait)
 * En dehors de ces règles la grille ne bouge JAMAIS : activer une vue déjà
 * affichée (clic sur sa cellule ou son onglet) ne réorganise rien.
 */
function normalizeGrid(gridIds, order, active, layout) {
  const next = gridIds.filter(id => order.includes(id)).slice(0, layout);
  for (const id of order) {
    if (next.length >= layout) break;
    if (!next.includes(id)) next.push(id);
  }
  if (active && order.includes(active) && !next.includes(active) && next.length > 0) {
    next[next.length - 1] = active;
  }
  return next;
}

/* ─── Reducer ──────────────────────────────────────────────────────────────── */
function exploreReducer(state, action) {
  switch (action.type) {
    case A.SET_VIZ_TYPE:
      return { ...state, vizType: action.value };
    case A.SET_CROSS_SECTION:
      return { ...state, crossSectionType: action.value };
    case A.SET_HOVMOLLER_TYPE:
      return { ...state, hovmollerType: action.value };
    case A.SET_COLORSCALE:
      return { ...state, colorscale: action.value };
    case A.SET_Z_MIN:
      return { ...state, zMinInput: action.value };
    case A.SET_Z_MAX:
      return { ...state, zMaxInput: action.value };
    // Override palette/plage d'UNE vue : n'affecte que le résultat ciblé.
    case A.SET_RESULT_DISPLAY: {
      const cur = state.resultsById[action.id];
      if (!cur) return state;
      return {
        ...state,
        resultsById: { ...state.resultsById, [action.id]: { ...cur, [action.key]: action.value } },
      };
    }

    case A.TOGGLE_LOCATIONS:
      return { ...state, showLocations: !state.showLocations };
    case A.TOGGLE_SURFACE:
      return { ...state, showSurface: !state.showSurface };
    case A.TOGGLE_TOOLTIP:
      return { ...state, showDetailedTooltip: !state.showDetailedTooltip };
    case A.TOGGLE_ANOMALY:
      return { ...state, showAnomaly: !state.showAnomaly };
    case A.TOGGLE_WIND:
      return { ...state, showWind: !state.showWind };
    case A.TOGGLE_WIND_PARTICLES:
      return { ...state, showWindParticles: !state.showWindParticles };
    case A.TOGGLE_TOPO:
      return { ...state, showTopo: !state.showTopo };
    case A.SET_TOPO_DATA:
      return { ...state, topoData: action.value };
    case A.TOGGLE_LOG:
      return { ...state, showLog: !state.showLog };
    case A.TOGGLE_SMOOTH:
      return { ...state, smoothHeatmap: !state.smoothHeatmap };
    case A.SET_INTERP_STEP:
      return { ...state, interpStep: action.value };

    case A.SET_WIND_DATA:
      return { ...state, windData: action.value };

    case A.ADD_RESULT: {
      // Garde-fou central : les appelants previennent (toast) avant d'appeler,
      // mais un rejeu de session enregistree avec plus de vues passe aussi ici.
      if (state.resultOrder.length >= MAX_TABS) return state;
      const { [action.result.id]: _, ...rest } = state.resultsById; // evite doublon
      const resultOrder = [...state.resultOrder, action.result.id];
      // Palette / plage de légende PROPRES à la vue : chaque résultat porte les
      // siennes. On les ensemence depuis le gabarit du panneau (état global) au
      // moment du lancement ; ensuite elles s'éditent par vue (SET_RESULT_DISPLAY)
      // sans toucher aux autres.
      const seeded = {
        colorscale: state.colorscale,
        zMin: state.zMinInput,
        zMax: state.zMaxInput,
        ...action.result,
      };
      return {
        ...state,
        resultsById: { ...rest, [action.result.id]: seeded },
        resultOrder,
        gridIds: normalizeGrid(state.gridIds, resultOrder, state.activeResult, state.layout),
      };
    }
    // Remplace le CONTENU d'une vue existante sans la recreer : meme id, meme
    // place dans l'ordre des onglets ET dans la grille. Conserve les overrides
    // d'affichage propres a la vue (palette, plage de legende) — "Mettre a jour
    // la vue active" garde la vue et son apparence, il ne pousse pas un onglet.
    case A.REPLACE_RESULT: {
      const cur = state.resultsById[action.id];
      if (!cur) return state;
      const merged = {
        ...action.result,
        id: action.id,
        colorscale: cur.colorscale,
        zMin: cur.zMin,
        zMax: cur.zMax,
      };
      return {
        ...state,
        resultsById: { ...state.resultsById, [action.id]: merged },
      };
    }
    case A.REMOVE_RESULT: {
      const { [action.id]: _removed, ...restById } = state.resultsById;
      const nextOrder = state.resultOrder.filter(id => id !== action.id);
      const activeResult = state.activeResult === action.id
        ? (nextOrder.length > 0 ? nextOrder[nextOrder.length - 1] : null)
        : state.activeResult;
      // Le rideau ne survit pas à la fermeture d'un de ses deux volets
      const curtainOn = state.curtainOn
        && action.id !== state.curtainBId
        && action.id !== state.activeResult;
      return {
        ...state, resultsById: restById, resultOrder: nextOrder, activeResult,
        gridIds: normalizeGrid(state.gridIds, nextOrder, activeResult, state.layout),
        curtainOn, curtainBId: curtainOn ? state.curtainBId : null,
      };
    }
    case A.SET_ACTIVE_RESULT:
      return {
        ...state,
        activeResult: action.value,
        gridIds: normalizeGrid(state.gridIds, state.resultOrder, action.value, state.layout),
      };

    case A.SET_LAYOUT:
      return {
        ...state,
        layout: action.value,
        gridIds: normalizeGrid(state.gridIds, state.resultOrder, state.activeResult, action.value),
      };
    case A.TOGGLE_CURTAIN:
      return state.curtainOn
        ? { ...state, curtainOn: false, curtainBId: null }
        : { ...state, curtainOn: true, curtainBId: action.bId ?? state.curtainBId };
    case A.SET_CURTAIN_B:
      return { ...state, curtainBId: action.value };
    case A.REORDER_RESULTS:
      return { ...state, resultOrder: action.value };

    case A.TOGGLE_ROI:
      return { ...state, roiMode: !state.roiMode, roiEntry: null, transectMode: false };
    case A.SET_ROI_ENTRY:
      return { ...state, roiEntry: action.value };
    case A.TOGGLE_TRANSECT:
      return { ...state, transectMode: !state.transectMode, roiMode: false, roiEntry: null };
    case A.TOGGLE_SYNC_ZOOM:
      return { ...state, syncZoom: !state.syncZoom };

    case A.ADD_SESSION: {
      if (state.sessions.length >= MAX_SESSIONS) return state;
      // Premier numero libre, pas un compteur monotone : fermer « Session 2 »
      // puis en creer une redonne « Session 2 » (et non « Session 3 »).
      const used = new Set(state.sessions.map(s => s.num));
      let num = 1;
      while (used.has(num)) num += 1;
      const id = `s${num}-${Date.now()}`;
      return {
        ...state, ...SESSION_BLANK,
        sessions: [...state.sessions, { id, name: null, num }],
        sessionCounter: num,
        activeSession: id,
        sessionStore: { ...state.sessionStore, [state.activeSession]: snapshotOf(state) },
        windData: null, topoData: null,
      };
    }
    case A.SWITCH_SESSION: {
      if (action.id === state.activeSession
        || !state.sessions.some(s => s.id === action.id)) return state;
      const restored = state.sessionStore[action.id] ?? SESSION_BLANK;
      const { [action.id]: _restored, ...restStore } = state.sessionStore;
      return {
        ...state, ...restored,
        activeSession: action.id,
        sessionStore: { ...restStore, [state.activeSession]: snapshotOf(state) },
        windData: null, topoData: null,
      };
    }
    case A.RENAME_SESSION:
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === action.id ? { ...s, name: action.name?.trim() || null } : s),
      };
    // Restauration depuis le localStorage : recree les chips de sessions au
    // montage (les resultats sont rejoues ensuite, session par session).
    case A.HYDRATE_SESSIONS:
      return {
        ...state,
        sessions: action.sessions,
        activeSession: action.activeSession,
        sessionCounter: action.sessionCounter,
      };
    case A.REMOVE_SESSION: {
      if (state.sessions.length <= 1) return state;
      const sessions = state.sessions.filter(s => s.id !== action.id);
      if (action.id !== state.activeSession) {
        const { [action.id]: _gone, ...sessionStore } = state.sessionStore;
        return { ...state, sessions, sessionStore };
      }
      const nextId = sessions[0].id;
      const restored = state.sessionStore[nextId] ?? SESSION_BLANK;
      const { [nextId]: _r, ...sessionStore } = state.sessionStore;
      return {
        ...state, ...restored,
        sessions, activeSession: nextId, sessionStore,
        windData: null, topoData: null,
      };
    }

    case A.SET_LOADING:
      return { ...state, loading: action.value };
    case A.SET_ERROR:
      return { ...state, error: action.value };
    case A.CLEAR_ERROR:
      return { ...state, error: null };
    case A.SET_LINK_COPIED:
      return { ...state, linkCopied: action.value };
    case A.SET_PENDING_AUTO:
      return { ...state, pendingAutoLaunch: action.value };
    case A.SET_DATASET_B:
      return { ...state, datasetB: action.value };

    default:
      return state;
  }
}

/* ─── Contextes ────────────────────────────────────────────────────────────── */
const ExploreStateContext    = createContext(null);
const ExploreDispatchContext = createContext(null);

/* ─── Provider ─────────────────────────────────────────────────────────────── */
export function ExploreProvider({ children }) {
  const [state, dispatch] = useReducer(exploreReducer, initialState);
  return (
    <ExploreDispatchContext.Provider value={dispatch}>
      <ExploreStateContext.Provider value={state}>
        {children}
      </ExploreStateContext.Provider>
    </ExploreDispatchContext.Provider>
  );
}

/* ─── Hooks publics ────────────────────────────────────────────────────────── */
export function useExploreState() {
  const ctx = useContext(ExploreStateContext);
  if (ctx === null) throw new Error('useExploreState must be used inside <ExploreProvider>');
  return ctx;
}

export function useExploreDispatch() {
  const ctx = useContext(ExploreDispatchContext);
  if (ctx === null) throw new Error('useExploreDispatch must be used inside <ExploreProvider>');
  return ctx;
}
