/**
 * Persistance des sessions de la console Explorer.
 *
 *   1. ?session=<base64url>  — permalien de session : rejoue TOUTES les vues
 *      partagees dans la session courante (prioritaire sur tout le reste)
 *   2. ?ds=…                 — permalien classique a une vue : flux existant
 *   3. localStorage          — reouvrir /explore restaure les sessions de la
 *      veille : chips recreees, session active rejouee immediatement, les
 *      autres rejouees a la premiere bascule (pas de rafale d'appels API)
 *
 * Seules les RECETTES sont stockees (type + params par vue) : les donnees
 * sont refetchees, en pratique servies par le cache client (5 min) ou le
 * cache HTTP (Cache-Control 30 jours) plutot que recalculees par le backend.
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useMars } from '../../context/MarsContext';
import { useToast } from '../../context/ToastContext';
import { useExploreState, useExploreDispatch, A } from './ExploreContext.jsx';
import { MAX_TABS } from './exploreConstants.jsx';
import { largeDataStore } from './largeDataStore.js';
import { fetchVizData } from './fetchVizData.js';
import { genLabel, nextResultId } from './exploreUtils.js';
import {
  buildSessionRecipe, encodeRecipe, decodeRecipe,
  loadStoredSessions, saveStoredSessions,
} from './sessionRecipes.js';
import { INDIVIDUAL_PREFIX } from '../../constants';

export function useSessionPersistence() {
  const { t } = useTranslation();
  const showToast = useToast();
  const state = useExploreState();
  const dispatch = useExploreDispatch();
  const { datasets, catalogLoading } = useMars();
  const [searchParams] = useSearchParams();

  const hydrated = useRef(false);
  const pendingRecipes = useRef(new Map());   // sessionId → recette pas encore rejouee
  const replaying = useRef(false);
  // La persistance n'ecrit QUE si l'app a pris possession des sessions stockees
  // (demarrage normal ou restauration). Un permalien (?session=, ?ds=, ?scenario=)
  // est un point d'entree ephemere : il ne doit jamais ecraser le localStorage.
  const persistEnabled = useRef(false);
  // Session cible lue en direct par le rejeu asynchrone : une bascule utilisateur
  // pendant un rejeu ne doit pas injecter de vues dans la mauvaise session.
  const activeSessionRef = useRef(state.activeSession);
  const [replayNonce, setReplayNonce] = useState(0);

  useEffect(() => { activeSessionRef.current = state.activeSession; }, [state.activeSession]);

  /** Label lisible d'un dataset arbitraire (pas forcement le selectionne). */
  const labelForDataset = useCallback((datasetId, data) => {
    if (datasetId?.startsWith(INDIVIDUAL_PREFIX)) {
      const myNum = datasetId.match(/IND_MY(\d+)/)?.[1];
      const lsNum = data?.actualLs != null
        ? data.actualLs.toFixed(2)
        : datasetId.match(/LS([\d.]+)/)?.[1];
      return myNum ? `MY${myNum} — Ls ${lsNum}°` : datasetId;
    }
    const d = datasets.find(x => x.id === datasetId);
    return d
      ? t('selector.dataset.format', { my: d.marsYear, lsStart: d.lsStart, lsEnd: d.lsEnd })
      : datasetId;
  }, [datasets, t]);

  /** Rejoue une recette dans une session cible (supposee vide).
   *  Le rejeu est asynchrone : la session cible est capturee et le rejeu
   *  s'interrompt si l'utilisateur bascule ailleurs, pour ne jamais injecter de
   *  vues dans la mauvaise session. Plafonne a MAX_TABS — au-dela le reducer
   *  ADD_RESULT rejette la vue, et la compter fausserait le total et l'onglet
   *  actif (id inexistant → viewer vide + erreur MUI Tabs).
   *  @returns {Promise<number>} nombre de vues restaurees */
  const replayRecipe = useCallback(async (recipe, targetSession = activeSessionRef.current) => {
    if (replaying.current) return 0;
    replaying.current = true;
    activeSessionRef.current = targetSession;   // prise de possession de la session cible
    dispatch({ type: A.SET_LOADING, value: true });
    const cap = Math.min(recipe.results.length, MAX_TABS);
    const wantIdx = Math.min(Math.max(recipe.activeIdx ?? 0, 0), Math.max(cap - 1, 0));
    let restored = 0, lastId = null, activeId = null, aborted = false;
    try {
      for (let i = 0; i < cap; i++) {
        const { type, params } = recipe.results[i];
        try {
          const data = await fetchVizData(type, params);
          // Bascule de session pendant le fetch : on abandonne le reste plutot
          // que d'injecter la vue dans la session desormais active.
          if (activeSessionRef.current !== targetSession) { aborted = true; break; }
          const id = nextResultId();
          if (type === 'animation') largeDataStore.set(id, data);
          dispatch({
            type: A.ADD_RESULT,
            result: {
              id, type,
              label: genLabel(type, params, t, data?.altitudeValue),
              params,
              data: type === 'animation' ? null : data,
              datasetLabel: labelForDataset(params.dataset, data),
            },
          });
          restored++;
          lastId = id;
          if (i === wantIdx) activeId = id;
        } catch {
          /* vue irrecuperable (dataset retire du catalogue…) : on restaure le reste */
        }
      }
      if (!aborted && activeSessionRef.current === targetSession) {
        if (recipe.layout) dispatch({ type: A.SET_LAYOUT, value: recipe.layout });
        const target = activeId ?? lastId;
        if (target) dispatch({ type: A.SET_ACTIVE_RESULT, value: target });
      }
    } finally {
      dispatch({ type: A.SET_LOADING, value: false });
      replaying.current = false;
      // Retrigger le rejeu differe : une session en attente vers laquelle
      // l'utilisateur a bascule pendant ce rejeu doit maintenant demarrer.
      setReplayNonce(n => n + 1);
    }
    return restored;
  }, [dispatch, t, labelForDataset]);

  /* ── Hydratation au montage (une fois le catalogue charge) ─────────────── */
  useEffect(() => {
    if (catalogLoading || hydrated.current) return;
    hydrated.current = true;

    // 1. Permalien de session
    const shared = searchParams.get('session');
    if (shared) {
      const recipe = decodeRecipe(shared);
      if (recipe) {
        if (recipe.name) dispatch({ type: A.RENAME_SESSION, id: state.activeSession, name: recipe.name });
        replayRecipe(recipe).then(n => {
          if (n > 0) showToast(t('explore.session.linkRestored', { count: n }), 'success');
        });
      }
      return;
    }

    // 2. Permalien classique ou chip de scenario : le flux d'auto-lancement
    //    existant s'en charge, on ne superpose pas la restauration locale — et
    //    surtout on n'active PAS la persistance, sinon la vue unique du
    //    permalien ecraserait les sessions sauvegardees dans le localStorage.
    if (searchParams.get('ds') || searchParams.get('scenario')) return;

    // A partir d'ici : demarrage normal ou restauration → l'app possede les
    // sessions stockees, la persistance peut ecrire sans perte de donnees.
    persistEnabled.current = true;

    // 3. localStorage
    const stored = loadStoredSessions();
    if (!stored) return;
    const total = stored.sessions.reduce((s, x) => s + (x.results?.length ?? 0), 0);
    if (total === 0) return;

    const sessions = stored.sessions.map((s, i) => ({ id: `s${i + 1}`, name: s.name ?? null, num: i + 1 }));
    const activeIdx = Math.min(Math.max(stored.activeIdx ?? 0, 0), sessions.length - 1);
    dispatch({
      type: A.HYDRATE_SESSIONS,
      sessions,
      activeSession: sessions[activeIdx].id,
      sessionCounter: sessions.length,
    });
    stored.sessions.forEach((s, i) => {
      if (i !== activeIdx && (s.results?.length ?? 0) > 0) pendingRecipes.current.set(sessions[i].id, s);
    });
    replayRecipe(stored.sessions[activeIdx], sessions[activeIdx].id).then(n => {
      if (n > 0) showToast(t('explore.session.restored', { count: n }), 'success');
    });
  }, [catalogLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Rejeu differe : premiere bascule vers une session restauree ───────── */
  useEffect(() => {
    // Un rejeu est deja en cours : on repassera quand il bumpera replayNonce.
    if (replaying.current) return;
    const recipe = pendingRecipes.current.get(state.activeSession);
    if (!recipe || state.resultOrder.length > 0) return;
    pendingRecipes.current.delete(state.activeSession);
    replayRecipe(recipe, state.activeSession);
  }, [state.activeSession, state.resultOrder.length, replayNonce, replayRecipe]);

  /* ── Sauvegarde debouncee vers le localStorage ──────────────────────────── */
  const persistTimer = useRef(null);
  useEffect(() => {
    if (!persistEnabled.current) return undefined;
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const sessions = state.sessions.map(s => {
        if (s.id === state.activeSession) return buildSessionRecipe(state, s.name);
        const pending = pendingRecipes.current.get(s.id);
        if (pending) return { ...pending, name: s.name ?? pending.name ?? null };
        const snap = state.sessionStore[s.id];
        return snap
          ? buildSessionRecipe(snap, s.name)
          : { name: s.name, layout: 1, activeIdx: 0, results: [] };
      });
      const activeIdx = Math.max(0, state.sessions.findIndex(s => s.id === state.activeSession));
      saveStoredSessions({ sessions, activeIdx });
    }, 800);
    return () => clearTimeout(persistTimer.current);
  }, [state]);

  /** Parametre ?session= du permalien de la session ACTIVE (toutes les vues
   *  ouvertes), ou null si rien n'est partageable. */
  const getSessionParam = useCallback(() => {
    if (state.resultOrder.length === 0) return null;
    const name = state.sessions.find(s => s.id === state.activeSession)?.name ?? null;
    const recipe = buildSessionRecipe(state, name);
    if (recipe.results.length === 0) return null;
    return encodeRecipe(recipe);
  }, [state]);

  return { getSessionParam };
}
