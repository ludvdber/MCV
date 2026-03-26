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

/* ─── Action types ─────────────────────────────────────────────────────────── */
export const A = Object.freeze({
  // Paramètres de visualisation
  SET_VIZ_TYPE:        'SET_VIZ_TYPE',
  SET_CROSS_SECTION:   'SET_CROSS_SECTION',
  SET_HOVMOLLER_TYPE:  'SET_HOVMOLLER_TYPE',
  SET_COLORSCALE:      'SET_COLORSCALE',
  SET_Z_MIN:           'SET_Z_MIN',
  SET_Z_MAX:           'SET_Z_MAX',
  // Toggles d'affichage
  TOGGLE_LOCATIONS:    'TOGGLE_LOCATIONS',
  TOGGLE_SURFACE:      'TOGGLE_SURFACE',
  TOGGLE_TOOLTIP:      'TOGGLE_TOOLTIP',
  TOGGLE_ANOMALY:      'TOGGLE_ANOMALY',
  TOGGLE_WIND:         'TOGGLE_WIND',
  TOGGLE_LOG:          'TOGGLE_LOG',
  // Données de vent (fetch async)
  SET_WIND_DATA:       'SET_WIND_DATA',
  // Gestion des onglets de résultats
  ADD_RESULT:          'ADD_RESULT',
  REMOVE_RESULT:       'REMOVE_RESULT',
  SET_ACTIVE_RESULT:   'SET_ACTIVE_RESULT',
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
  showLog:             false,
  windData:            null,
  resultsById:         {},   // { [id]: result } — lookup O(1) sans parcourir tout le tableau
  resultOrder:         [],   // [id, id, ...] — ordre des onglets pour le rendu
  activeResult:        null,
  loading:             false,
  error:               null,
  linkCopied:          false,
  pendingAutoLaunch:   false,
  datasetB:            '',
};

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
    case A.TOGGLE_LOG:
      return { ...state, showLog: !state.showLog };

    case A.SET_WIND_DATA:
      return { ...state, windData: action.value };

    case A.ADD_RESULT: {
      const { [action.result.id]: _, ...rest } = state.resultsById; // evite doublon
      return {
        ...state,
        resultsById: { ...rest, [action.result.id]: action.result },
        resultOrder: [...state.resultOrder, action.result.id],
      };
    }
    case A.REMOVE_RESULT: {
      const { [action.id]: _removed, ...restById } = state.resultsById;
      const nextOrder = state.resultOrder.filter(id => id !== action.id);
      const activeResult = state.activeResult === action.id
        ? (nextOrder.length > 0 ? nextOrder[nextOrder.length - 1] : null)
        : state.activeResult;
      return { ...state, resultsById: restById, resultOrder: nextOrder, activeResult };
    }
    case A.SET_ACTIVE_RESULT:
      return { ...state, activeResult: action.value };
    case A.REORDER_RESULTS:
      return { ...state, resultOrder: action.value };

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
