/**
 * Chips de sessions nommees de la console Explorer.
 *
 * Chaque session est un jeu d'onglets independant (reducer ExploreContext) :
 * cliquer une chip bascule, double-cliquer renomme, ✕ ferme (si > 1), + cree.
 * Vit dans la rangee d'onglets (l'ancienne barre superieure dediee prenait
 * trop de place verticale — retour utilisateur).
 */
import { useState, useCallback } from 'react';
import { Box, InputBase, Tooltip } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useExploreState, useExploreDispatch, A, MAX_SESSIONS } from './ExploreContext.jsx';
import { largeDataStore } from './largeDataStore.js';
import { useToast } from '../../context/ToastContext';

export default function SessionChips() {
  const { t } = useTranslation();
  const showToast = useToast();
  const state = useExploreState();
  const dispatch = useExploreDispatch();
  const { sessions, activeSession, sessionStore, resultOrder } = state;

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');

  const sessionName = useCallback(
    (s) => s.name ?? `${t('explore.session.default')} ${s.num}`,
    [t],
  );

  const handleAdd = useCallback(() => {
    if (sessions.length >= MAX_SESSIONS) {
      showToast(t('explore.session.limit', { max: MAX_SESSIONS }), 'warning');
      return;
    }
    dispatch({ type: A.ADD_SESSION });
  }, [sessions.length, dispatch, showToast, t]);

  const handleRemove = useCallback((id) => {
    // Libere les frames d'animation de la session fermee (hors state React).
    const ids = id === activeSession ? resultOrder : (sessionStore[id]?.resultOrder ?? []);
    for (const rid of ids) largeDataStore.delete(rid);
    dispatch({ type: A.REMOVE_SESSION, id });
  }, [activeSession, resultOrder, sessionStore, dispatch]);

  const startRename = useCallback((s) => {
    setEditingId(s.id);
    setDraft(s.name ?? '');
  }, []);

  const commitRename = useCallback(() => {
    if (editingId) dispatch({ type: A.RENAME_SESSION, id: editingId, name: draft });
    setEditingId(null);
  }, [editingId, draft, dispatch]);

  return (
    <Box className="mcv-sessions" role="group" aria-label={t('explore.session.bar')} data-tour="sessions">
      {sessions.map(s => {
        const active = s.id === activeSession;
        if (editingId === s.id) {
          return (
            <InputBase
              key={s.id}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditingId(null);
              }}
              inputProps={{ 'aria-label': t('explore.session.rename'), maxLength: 28 }}
              className="mcv-session-edit"
            />
          );
        }
        return (
          <Tooltip key={s.id} title={t('explore.session.rename')} arrow enterDelay={800}>
            <Box
              component="button"
              className={active ? 'mcv-session on' : 'mcv-session'}
              aria-pressed={active}
              onClick={() => { if (!active) dispatch({ type: A.SWITCH_SESSION, id: s.id }); }}
              onDoubleClick={() => startRename(s)}
            >
              <span className="dot" aria-hidden />
              <span className="name">{sessionName(s)}</span>
              {sessions.length > 1 && (
                <Box
                  component="span"
                  role="button"
                  tabIndex={0}
                  className="x"
                  aria-label={`${t('explore.session.close')} ${sessionName(s)}`}
                  onClick={(e) => { e.stopPropagation(); handleRemove(s.id); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation(); e.preventDefault(); handleRemove(s.id);
                    }
                  }}
                >
                  <CloseIcon sx={{ fontSize: 13 }} />
                </Box>
              )}
            </Box>
          </Tooltip>
        );
      })}
      {sessions.length < MAX_SESSIONS && (
        <Box
          component="button"
          className="mcv-session add"
          aria-label={t('explore.session.new')}
          onClick={handleAdd}
        >
          +
        </Box>
      )}
    </Box>
  );
}
