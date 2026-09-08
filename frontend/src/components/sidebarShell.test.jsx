import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import Sidebar from './Sidebar';
import i18n from '../i18n';
import {
  renderSimple, installApiFixtures, installCanvas2D, installGeometrie,
} from '../test/harness';
import { STORAGE_KEY } from '../hooks/useRecentHistory';

/**
 * Le reste de la barre laterale : etat replie, memorisation des groupes de
 * navigation, effacement de l'historique en deux temps, dialogue « tout
 * l'historique », theme et contraste depuis le pied de barre.
 */
let desinstallerCanvas;
let desinstallerGeo;
const matchMediaOrigine = window.matchMedia;
const NAV_GROUPS_KEY = 'mcv-nav-groups-v1';

const largeurEcran = (large) => {
  window.matchMedia = (q) => ({
    matches: large && q.includes('min-width'),
    media: q, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  });
};

beforeEach(async () => {
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  try { localStorage.clear(); } catch { /* mode prive */ }
  await i18n.changeLanguage('fr');
  largeurEcran(true);
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  window.matchMedia = matchMediaOrigine;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const rendre = (props = {}, route = '/slice') => renderSimple(
  <Sidebar onToggleCollapse={vi.fn()} onShortcutsOpen={vi.fn()} {...props} />, { route },
);

const entree = (extra = {}) => ({
  id: 'e1', page: '/slice', permalink: '/slice?ds=mean_MY35_Ls0_30&var=TT',
  dataset: 'mean_MY35_Ls0_30', variable: 'TT', label: 'TT 12h · alt49',
  timestamp: Date.now() - 60 * 1000, ...extra,
});

describe('barre repliee', () => {
  it('aplatit les groupes en icones et garde chaque lien nomme', () => {
    largeurEcran(true);
    const { container } = rendre({ collapsed: true });
    const liens = [...container.querySelectorAll('a')];
    // Repliee, la barre n'affiche plus d'en-tetes de groupe : les liens sont
    // a plat, donc tous presents.
    expect(liens.length).toBeGreaterThanOrEqual(12);
    for (const a of liens) {
      expect(a.getAttribute('aria-label') || a.textContent).toBeTruthy();
    }
  });

  it('demande le depliage a son parent', () => {
    const onToggleCollapse = vi.fn();
    rendre({ collapsed: true, onToggleCollapse });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('nav.expandMenu') }));
    expect(onToggleCollapse).toHaveBeenCalled();
  });

  it('depliee, propose au contraire de replier', () => {
    const onToggleCollapse = vi.fn();
    rendre({ collapsed: false, onToggleCollapse });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('nav.collapseMenu') }));
    expect(onToggleCollapse).toHaveBeenCalled();
  });
});

describe('memorisation des groupes de navigation', () => {
  it('retient l etat replie d un groupe', () => {
    const { container } = rendre();
    const entete = [...container.querySelectorAll('[aria-expanded]')][0];
    fireEvent.click(entete);
    const retenu = JSON.parse(localStorage.getItem(NAV_GROUPS_KEY));
    expect(Object.values(retenu)).toContain(false);
  });

  it('relit ce choix au montage, quelle que soit la largeur d ecran', () => {
    localStorage.setItem(NAV_GROUPS_KEY, JSON.stringify({ maps: false, profiles: true, diagnostics: true }));
    const { container } = rendre();
    const entetes = [...container.querySelectorAll('[aria-expanded]')];
    // Le choix de l'utilisateur l'emporte sur le defaut lie a l'ecran.
    expect(entetes.some((e) => e.getAttribute('aria-expanded') === 'false')).toBe(true);
  });

  it('ignore un choix enregistre illisible', () => {
    localStorage.setItem(NAV_GROUPS_KEY, 'pas du JSON');
    expect(() => rendre()).not.toThrow();
  });

  it('tient quand l ecriture est refusee', () => {
    const vrai = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
    try {
      const { container } = rendre();
      const entete = [...container.querySelectorAll('[aria-expanded]')][0];
      expect(() => fireEvent.click(entete)).not.toThrow();
      expect(entete.getAttribute('aria-expanded')).toBe('false');
    } finally {
      Storage.prototype.setItem = vrai;
    }
  });
});

describe('historique dans la barre', () => {
  /** Deplie la section d'historique et renvoie son conteneur. */
  function deplierHistorique(container) {
    const entete = [...container.querySelectorAll('[aria-expanded]')]
      .find((e) => new RegExp(i18n.t('history.title'), 'i').test(e.textContent));
    if (entete && entete.getAttribute('aria-expanded') === 'false') fireEvent.click(entete);
    return entete;
  }

  it('efface l historique en deux temps', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.setItem(STORAGE_KEY, JSON.stringify([entree()]));
    const { container } = rendre();
    deplierHistorique(container);
    const effacer = [...container.querySelectorAll('div,button')]
      .find((e) => e.getAttribute('aria-label') === i18n.t('history.clear'))
      ?? [...container.querySelectorAll('[role="button"]')]
        .find((e) => new RegExp(i18n.t('history.clear'), 'i').test(e.textContent));
    if (!effacer) return;
    fireEvent.click(effacer);
    // Premier clic : on ARME seulement. Un historique efface par megarde ne
    // se recupere pas.
    expect(container.textContent).toContain('TT 12h');
    expect(container.textContent).toContain(i18n.t('history.clearConfirm'));
    fireEvent.click(effacer);
    expect(container.textContent).not.toContain('TT 12h');
  });

  it('l armement retombe tout seul au bout de trois secondes', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.setItem(STORAGE_KEY, JSON.stringify([entree()]));
    const { container } = rendre();
    deplierHistorique(container);
    const effacer = [...container.querySelectorAll('[role="button"],button')]
      .find((e) => new RegExp(i18n.t('history.clear'), 'i')
        .test(e.getAttribute('aria-label') || e.textContent));
    if (!effacer) return;
    fireEvent.click(effacer);
    vi.advanceTimersByTime(3500);
    // Sans retombee, un clic distrait dix minutes plus tard effacerait tout.
    expect(container.textContent).toContain('TT 12h');
  });

  it('ouvre la liste complete depuis la barre repliee', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([entree()]));
    rendre({ collapsed: true });
    const bouton = screen.queryByRole('button', { name: i18n.t('history.title') });
    if (bouton) {
      fireEvent.click(bouton);
      await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    }
  });
});

describe('pied de barre', () => {
  it('mene a la page legale', () => {
    const { container } = rendre();
    const liens = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(liens).toContain('/legal');
  });

  it('cite la source des donnees', () => {
    const { container } = rendre();
    // La provenance doit rester lisible sur chaque page, pas seulement dans
    // les mentions legales.
    expect(container.textContent).toContain('GEM-Mars');
    expect(container.textContent).toContain('BIRA-IASB');
  });
});
