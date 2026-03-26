import { useEffect } from 'react';

/**
 * Enregistre des raccourcis clavier globaux.
 * Ignore les evenements provenant d'inputs/textareas/selects pour ne pas
 * interferer avec la saisie utilisateur.
 *
 * @param {Object.<string, function>} shortcuts - { key: handler }
 *   Cles supportees : 'Space', 'Enter', 'Escape', '?', 'f'
 */
export function useKeyboardShortcuts(shortcuts) {
  useEffect(() => {
    const handler = (e) => {
      // Ne pas intercepter si on tape dans un champ de saisie
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.target?.isContentEditable) return;

      const key = e.key === ' ' ? 'Space' : e.key;
      const fn = shortcuts[key];
      if (fn) {
        e.preventDefault();
        fn(e);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [shortcuts]);
}
