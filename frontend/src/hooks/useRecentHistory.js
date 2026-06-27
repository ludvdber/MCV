import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'mcv-recent-history';
const MAX_ENTRIES = 20;

// Shared listeners so all hook instances stay in sync within the same tab
const listeners = new Set();
function emitChange() { listeners.forEach(fn => fn()); }

/**
 * Structure d'une entree d'historique :
 * {
 *   id: string,          - identifiant unique (timestamp)
 *   page: string,        - route ('/slice', '/timeseries', etc.)
 *   permalink: string,   - full path with query params ('/slice?ds=...&var=...')
 *   dataset: string,     - dataset ID
 *   variable: string,    - code variable (TT, PX, etc.)
 *   params: Object,      - parametres supplementaires (time, altitude, lat, lon, etc.)
 *   timestamp: number,   - Date.now()
 *   label: string,       - label court pour l'affichage
 * }
 */

function loadHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(stored)) return [];
    // Validate entries have required fields
    return stored.filter(e =>
      e && typeof e.id === 'string' && typeof e.page === 'string' && typeof e.timestamp === 'number'
    );
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function saveHistory(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage indisponible ou plein (navigation privee, quota depasse) :
    // l'historique est un confort, on ignore l'echec sans casser la visualisation.
  }
}

/**
 * Applique le plafond sans jamais supprimer les entrees epinglees : on garde
 * tous les favoris + les MAX_ENTRIES entrees non epinglees les plus recentes,
 * en preservant l'ordre de la liste.
 */
function capHistory(list) {
  let unpinned = 0;
  return list.filter(e => {
    if (e.pinned) return true;
    unpinned += 1;
    return unpinned <= MAX_ENTRIES;
  });
}

/** Signature d'identite d'une entree (le permalien encode tous les parametres). */
function signatureOf(e) {
  return e.permalink || `${e.page}|${e.dataset}|${e.variable}`;
}

/**
 * Identifiant unique d'entree. Date.now() seul collisionnait quand deux ajouts
 * tombaient dans la meme milliseconde (memes id -> suppression/epinglage cassés).
 */
function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Hook pour gerer l'historique des visualisations recentes.
 * Stocke les MAX_ENTRIES dernieres dans localStorage.
 */
export function useRecentHistory() {
  const [history, setHistory] = useState(loadHistory);

  // Sync across tabs (storage event) AND within the same tab (custom listeners)
  useEffect(() => {
    const refresh = () => setHistory(loadHistory());
    // Cross-tab
    const storageHandler = (e) => { if (e.key === STORAGE_KEY) refresh(); };
    window.addEventListener('storage', storageHandler);
    // Same-tab: other hook instances calling addEntry/clearHistory
    listeners.add(refresh);
    return () => {
      window.removeEventListener('storage', storageHandler);
      listeners.delete(refresh);
    };
  }, []);

  const addEntry = useCallback((entry) => {
    const prev = loadHistory(); // always read fresh from localStorage
    // Si la meme config existe deja (meme permalien), on ne la deplace PAS :
    // revenir sur une vue depuis l'historique ne doit pas reordonner la liste
    // sous les yeux de l'utilisateur. Seules les nouvelles configs s'ajoutent en tete.
    const sig = signatureOf(entry);
    if (prev.some(e => signatureOf(e) === sig)) return;
    const newEntry = { ...entry, id: makeId(), timestamp: Date.now(), pinned: false };
    saveHistory(capHistory([newEntry, ...prev]));
    emitChange(); // notify all hook instances in this tab
  }, []);

  const removeEntry = useCallback((id) => {
    saveHistory(loadHistory().filter(e => e.id !== id));
    emitChange();
  }, []);

  const togglePin = useCallback((id) => {
    const updated = loadHistory().map(e => e.id === id ? { ...e, pinned: !e.pinned } : e);
    saveHistory(capHistory(updated));
    emitChange();
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    emitChange();
  }, []);

  return { history, addEntry, removeEntry, togglePin, clearHistory };
}
