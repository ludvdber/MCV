/**
 * Recettes de sessions : serialisation des sessions de la console Explorer.
 *
 * On ne persiste JAMAIS les donnees (elles sont refetchees — le cache client
 * 5 min et le Cache-Control 30 jours du backend absorbent le cout) : chaque
 * resultat est reduit a { type, params }, une session a son nom, sa
 * disposition et ses resultats. Deux transports :
 *   - localStorage (cle STORAGE_KEY) : reouvrir l'onglet restaure le travail
 *   - permalien ?session= (base64url) : partager TOUTES les vues ouvertes
 *
 * Les resultats derives cote client (amplitude diurne, |V|, diff rapide)
 * n'ont pas d'equivalent serveur : ils sont exclus des recettes.
 */

export const STORAGE_KEY = 'mcv-flux-sessions-v1';
export const RECIPE_VERSION = 1;

/** Un resultat est rejouable si le serveur peut le recalculer seul. */
export function isReplayable(result) {
  if (result.derived) return false;
  if (result.type === 'difference' && !result.params?.datasetB) return false; // diff rapide client
  return true;
}

/** Champs de params conserves dans une recette (pas de payload parasite). */
const PARAM_KEYS = [
  'dataset', 'variable', 'time', 'altitude', 'lat', 'lon',
  'crossSectionType', 'hovmollerType', 'datasetB',
  'lat1', 'lon1', 'lat2', 'lon2',
];

function slimParams(params) {
  const out = {};
  for (const k of PARAM_KEYS) {
    if (params?.[k] !== undefined) out[k] = params[k];
  }
  return out;
}

/**
 * Recette d'un jeu d'onglets (session active OU instantane du sessionStore).
 * @param {{resultsById, resultOrder, activeResult, layout}} slice
 */
export function buildSessionRecipe(slice, name = null) {
  const results = slice.resultOrder
    .map(id => slice.resultsById[id])
    .filter(r => r && isReplayable(r))
    .map(r => ({ type: r.type, params: slimParams(r.params) }));
  const activeIdx = Math.max(0, slice.resultOrder
    .filter(id => isReplayable(slice.resultsById[id] ?? {}))
    .indexOf(slice.activeResult));
  return { name, layout: slice.layout ?? 1, activeIdx, results };
}

/* ── base64url (UTF-8 sur) pour le permalien ─────────────────────────────── */

export function encodeRecipe(obj) {
  const json = JSON.stringify(obj);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeRecipe(str) {
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    if (!obj || !Array.isArray(obj.results)) return null;
    return obj;
  } catch {
    return null;
  }
}

/* ── localStorage (quota et JSON invalides toleres) ──────────────────────── */

export function loadStoredSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj?.v !== RECIPE_VERSION || !Array.isArray(obj.sessions)) return null;
    return obj;
  } catch {
    return null;
  }
}

export function saveStoredSessions(payload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: RECIPE_VERSION, ...payload }));
  } catch {
    /* quota plein ou stockage indisponible : la persistance est un confort */
  }
}
