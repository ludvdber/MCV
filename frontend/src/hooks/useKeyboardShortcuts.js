import { useEffect } from 'react';

/**
 * Enregistre des raccourcis clavier globaux.
 *
 * @param {Object.<string, function>} shortcuts - { key: handler }
 *   Cles supportees : 'Space', 'Enter', 'Escape', '?', 'f'
 *
 * Deux regles, toutes deux nees d'un defaut mesure :
 *
 * 1. Un raccourci ne s'applique pas pendant une SAISIE (input, textarea,
 *    select, zone editable).
 *
 * 2. Un raccourci ne VOLE jamais une touche au controle qui a le focus.
 *    Le gestionnaire ecoute sur `document` et appelait `preventDefault()` des
 *    que la touche figurait dans la table. Sur les pages de visualisation,
 *    `Enter` est le raccourci « Visualiser » : mesure faite au navigateur,
 *    appuyer sur Entree alors qu'un bouton avait le focus annulait l'evenement
 *    et le bouton ne s'activait pas. Entree et Espace sont les deux seules
 *    facons d'actionner un controle au clavier, donc la page devenait
 *    partiellement inutilisable sans souris (WCAG 2.1.1, niveau A).
 *
 *    Ces deux touches sont donc laissees au controle focalise. Les autres
 *    (Escape, f, ?) n'ont pas de sens natif sur un bouton et restent globales.
 *
 * 3. Une combinaison avec Ctrl, Alt ou Meta appartient au navigateur ou au
 *    systeme (Ctrl+F, Ctrl+K...), jamais a un raccourci d'une seule lettre.
 *
 * 4. Un widget COMPOSITE ouvert (liste deroulante, menu, dialogue) garde toutes
 *    ses touches. Mesure faite : avec une liste ouverte, taper « f » ne faisait
 *    pas la saisie rapide attendue mais declenchait le PLEIN ECRAN par-dessus
 *    le menu.
 */

/**
 * Widgets COMPOSITES : une liste, un menu ou un dialogue ouvert possede son
 * propre clavier (saisie rapide a la lettre, fleches, Echap pour fermer). Un
 * raccourci de page doit s'y effacer entierement, et pas seulement pour les
 * touches d'activation.
 *
 * Mesure faite au navigateur avant correction : une liste deroulante ouverte,
 * touche « f » -> l'evenement etait annule, la saisie rapide ne se faisait pas,
 * et le raccourci PLEIN ECRAN se declenchait par-dessus le menu ouvert.
 */
const WIDGET_COMPOSITE = [
  '[role="listbox"]',
  '[role="menu"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="combobox"]',
  '[role="grid"]',
  '[role="tree"]',
  '[role="tablist"]',
].join(',');

/** Touches qu'un controle focalise consomme lui-meme. */
const TOUCHES_D_ACTIVATION = new Set(['Enter', 'Space']);

/** Elements qui s'actionnent au clavier et gardent donc la priorite. */
const CONTROLE_ACTIONNABLE = [
  'button',
  'a[href]',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="tab"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
].join(',');

export function useKeyboardShortcuts(shortcuts) {
  useEffect(() => {
    const handler = (e) => {
      // Ne pas intercepter si on tape dans un champ de saisie
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.target?.isContentEditable) return;

      // Une combinaison appartient au navigateur, pas a nous
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Un widget composite ouvert garde TOUTES ses touches
      if (e.target?.closest?.(WIDGET_COMPOSITE)) return;

      const key = e.key === ' ' ? 'Space' : e.key;

      // Le controle focalise est prioritaire sur sa propre touche d'activation
      if (TOUCHES_D_ACTIVATION.has(key) && e.target?.closest?.(CONTROLE_ACTIONNABLE)) return;

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
