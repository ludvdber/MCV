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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
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
    // Dedup on the full parameter signature: two visualisations that differ only
    // by time / altitude / points / colorscale must stay as DISTINCT entries.
    // The permalink encodes every parameter, so it is the correct identity key.
    // Fall back to page+dataset+variable when no permalink could be built.
    const signature = e => e.permalink || `${e.page}|${e.dataset}|${e.variable}`;
    const entrySignature = signature(entry);
    const deduped = prev.filter(e => signature(e) !== entrySignature);
    const updated = [
      { ...entry, id: String(Date.now()), timestamp: Date.now() },
      ...deduped,
    ].slice(0, MAX_ENTRIES);
    saveHistory(updated);
    emitChange(); // notify all hook instances in this tab
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    emitChange();
  }, []);

  return { history, addEntry, clearHistory };
}
