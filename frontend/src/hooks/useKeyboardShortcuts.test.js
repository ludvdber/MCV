import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

/**
 * Le gestionnaire ecoute sur `document` : il voit donc toutes les frappes de la
 * page, y compris celles destinees au controle qui a le focus. Ces tests fixent
 * la frontiere entre « raccourci de page » et « touche du controle focalise ».
 */

function frappe(cible, key, options = {}) {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  cible.dispatchEvent(ev);
  return ev;
}

describe('useKeyboardShortcuts', () => {
  const aNettoyer = [];

  afterEach(() => {
    aNettoyer.forEach(el => el.remove());
    aNettoyer.length = 0;
  });

  function monte(shortcuts) {
    renderHook(() => useKeyboardShortcuts(shortcuts));
  }

  function ajoute(html) {
    const hote = document.createElement('div');
    hote.innerHTML = html;
    document.body.appendChild(hote);
    aNettoyer.push(hote);
    return hote.firstElementChild;
  }

  it('declenche le raccourci quand rien de cliquable n’a le focus', () => {
    const fn = vi.fn();
    monte({ Enter: fn });
    const ev = frappe(ajoute('<div>zone neutre</div>'), 'Enter');
    expect(fn).toHaveBeenCalledOnce();
    expect(ev.defaultPrevented).toBe(true);
  });

  it('laisse Entrée au bouton qui a le focus', () => {
    // Sans cette regle, Entree sur un bouton lancait « Visualiser » au lieu
    // d'actionner le bouton, et l'evenement annule empechait le clic natif.
    const fn = vi.fn();
    monte({ Enter: fn });
    const ev = frappe(ajoute('<button>Exporter</button>'), 'Enter');
    expect(fn).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });

  it('laisse Espace au bouton qui a le focus', () => {
    const fn = vi.fn();
    monte({ Space: fn });
    const ev = frappe(ajoute('<button>Lire</button>'), ' ');
    expect(fn).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });

  it('laisse Entrée au lien et aux éléments porteurs d’un rôle actionnable', () => {
    const fn = vi.fn();
    monte({ Enter: fn });
    for (const html of ['<a href="/slice">Slice</a>', '<div role="button">Ouvrir</div>',
      '<div role="tab">Onglet</div>', '<div role="menuitem">Entree</div>']) {
      expect(frappe(ajoute(html), 'Enter').defaultPrevented).toBe(false);
    }
    expect(fn).not.toHaveBeenCalled();
  });

  it('déclenche quand même sur un élément enfant non actionnable', () => {
    const fn = vi.fn();
    monte({ Enter: fn });
    const span = ajoute('<p><span>texte</span></p>').querySelector('span');
    frappe(span, 'Enter');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('garde Escape et « f » globaux même sur un bouton', () => {
    // Ces touches n'ont pas de sens natif sur un controle : les rendre au
    // bouton reviendrait a supprimer le raccourci.
    const echap = vi.fn();
    const plein = vi.fn();
    monte({ Escape: echap, f: plein });
    const bouton = ajoute('<button>Plein écran</button>');
    frappe(bouton, 'Escape');
    frappe(bouton, 'f');
    expect(echap).toHaveBeenCalledOnce();
    expect(plein).toHaveBeenCalledOnce();
  });

  it('ne vole aucune combinaison au navigateur', () => {
    const fn = vi.fn();
    monte({ f: fn });
    const cible = ajoute('<div>zone</div>');
    expect(frappe(cible, 'f', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(frappe(cible, 'f', { metaKey: true }).defaultPrevented).toBe(false);
    expect(frappe(cible, 'f', { altKey: true }).defaultPrevented).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });

  it('rend toutes ses touches à une liste déroulante ouverte', () => {
    // Mesure au navigateur avant correction : liste ouverte, touche « f » ->
    // la saisie rapide ne se faisait pas et le PLEIN ECRAN se declenchait
    // par-dessus le menu.
    const plein = vi.fn();
    monte({ f: plein, Escape: vi.fn(), Enter: vi.fn() });
    const liste = ajoute('<div role="listbox"><div role="option">Fahrenheit</div></div>');
    const option = liste.querySelector('[role="option"]');

    for (const key of ['f', 'Escape', 'Enter']) {
      expect(frappe(option, key).defaultPrevented).toBe(false);
    }
    expect(plein).not.toHaveBeenCalled();
  });

  it('rend ses touches à un menu, un dialogue et une liste d’onglets', () => {
    const fn = vi.fn();
    monte({ f: fn, Escape: fn });
    for (const html of ['<div role="menu"><div role="menuitem">Exporter</div></div>',
      '<div role="dialog"><p>contenu</p></div>',
      '<div role="tablist"><div role="tab">Vue</div></div>']) {
      const hote = ajoute(html);
      expect(frappe(hote.firstElementChild || hote, 'f').defaultPrevented).toBe(false);
    }
    expect(fn).not.toHaveBeenCalled();
  });

  it('ne se déclenche pas pendant une saisie', () => {
    const fn = vi.fn();
    monte({ Enter: fn, f: fn });
    frappe(ajoute('<input type="text" />'), 'Enter');
    frappe(ajoute('<textarea></textarea>'), 'f');
    expect(fn).not.toHaveBeenCalled();
  });
});
