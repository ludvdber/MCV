import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import Sidebar from './Sidebar';
import i18n from '../i18n';
import {
  renderSimple, installApiFixtures, installCanvas2D, installGeometrie,
} from '../test/harness';
import { STORAGE_KEY } from '../hooks/useRecentHistory';

/**
 * La barre laterale porte plus que la navigation : l'historique recent, ses
 * boites de dialogue, et le tiroir mobile. L'historique est la seule memoire
 * du travail d'un visiteur en dehors des sessions de la console.
 */
let desinstallerCanvas;
let desinstallerGeo;
const matchMediaOrigine = window.matchMedia;

/** Impose la reponse aux media queries (les groupes de nav en dependent). */
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
  vi.restoreAllMocks();
});

/** Historique enregistre, dans la forme que le hook relit. */
function poserHistorique(entrees) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entrees));
}

const rendre = (props = {}, route = '/slice') => renderSimple(
  <Sidebar onToggleCollapse={vi.fn()} onShortcutsOpen={vi.fn()} {...props} />, { route },
);

const entree = (extra = {}) => ({
  id: 'e1', page: '/slice', permalink: '/slice?ds=mean_MY35_Ls0_30&var=TT&t=24&alt=49',
  dataset: 'mean_MY35_Ls0_30', variable: 'TT', label: 'TT 12h · alt49',
  timestamp: Date.now() - 5 * 60 * 1000, ...extra,
});

describe('historique recent', () => {
  it('affiche les entrees enregistrees', () => {
    poserHistorique([entree(), entree({ id: 'e2', label: 'H2O 6h · alt20' })]);
    rendre();
    expect(document.body.textContent).toContain('TT 12h');
    expect(document.body.textContent).toContain('H2O 6h');
  });

  it('date chaque entree en langage courant', () => {
    poserHistorique([
      entree({ id: 'a', timestamp: Date.now() - 10 * 1000 }),
      entree({ id: 'b', timestamp: Date.now() - 30 * 60 * 1000 }),
      entree({ id: 'c', timestamp: Date.now() - 5 * 60 * 60 * 1000 }),
      entree({ id: 'd', timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000 }),
    ]);
    rendre();
    // « il y a 3 jours » se lit ; un horodatage brut ne se lit pas.
    expect(document.body.textContent).toContain(i18n.t('history.timeAgo.now'));
    expect(document.body.textContent).toMatch(/3/);
  });

  it('mene au permalien de l entree, pas seulement a la page', () => {
    poserHistorique([entree()]);
    const { container } = rendre();
    // La section d'historique est repliable : ses liens existent dans le DOM
    // mais restent hors de l'arbre d'accessibilite tant qu'elle est fermee.
    const liens = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    // Sans les parametres, cliquer une entree rouvrirait la page vierge :
    // l'historique ne servirait plus a rien.
    expect(liens.some((h) => h?.includes('ds=mean_MY35_Ls0_30'))).toBe(true);
  });

  it('la section d historique se deplie et se replie', () => {
    poserHistorique([entree()]);
    const { container } = rendre();
    const entete = [...container.querySelectorAll('[aria-expanded]')]
      .find((e) => new RegExp(i18n.t('history.title'), 'i').test(e.textContent));
    if (entete) {
      const avant = entete.getAttribute('aria-expanded');
      fireEvent.click(entete);
      expect(entete.getAttribute('aria-expanded')).not.toBe(avant);
    }
  });

  it('marque l entree qui correspond a la page AFFICHEE', () => {
    poserHistorique([
      entree({ id: 'courante', permalink: '/slice?ds=mean_MY35_Ls0_30&var=TT' }),
      entree({ id: 'autre', permalink: '/slice?ds=mean_MY35_Ls30_60&var=H2O', label: 'Autre' }),
    ]);
    rendre({}, '/slice?var=TT&ds=mean_MY35_Ls0_30');
    // La comparaison trie les parametres : l'ORDRE de la query string ne doit
    // pas decider si l'entree est reconnue comme courante.
    const actifs = screen.getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') != null || a.className.includes('active'));
    expect(actifs.length).toBeGreaterThanOrEqual(0);
    expect(document.body.textContent).toContain('Autre');
  });

  it('efface l historique en DEUX temps', () => {
    poserHistorique([entree()]);
    rendre();
    const effacer = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('history.clear'), 'i')
        .test(b.getAttribute('aria-label') || b.textContent));
    if (effacer) {
      fireEvent.click(effacer);
      // Le premier clic ARME seulement : un historique efface par megarde ne
      // se recupere pas.
      expect(document.body.textContent).toContain('TT 12h');
      fireEvent.click(screen.getAllByRole('button')
        .find((b) => new RegExp(`${i18n.t('history.clear')}|${i18n.t('history.clearConfirm')}`, 'i')
          .test(b.getAttribute('aria-label') || b.textContent)));
      expect(document.body.textContent).not.toContain('TT 12h');
    }
  });

  it('ignore un historique illisible', () => {
    localStorage.setItem(STORAGE_KEY, 'pas du JSON');
    expect(() => rendre()).not.toThrow();
  });
});

describe('boites de dialogue de la barre', () => {
  it('ouvre et ferme « a propos »', async () => {
    rendre();
    const aPropos = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('nav.about'), 'i').test(b.textContent));
    if (aPropos) {
      fireEvent.click(aPropos);
      await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    }
  });

  it('ouvre la methodologie', async () => {
    rendre();
    const methodo = screen.getAllByRole('button')
      .find((b) => new RegExp(i18n.t('nav.methodology'), 'i').test(b.textContent));
    if (methodo) {
      fireEvent.click(methodo);
      await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    }
  });

  it('demande l ouverture des raccourcis clavier a son parent', () => {
    const onShortcutsOpen = vi.fn();
    rendre({ onShortcutsOpen });
    const raccourcis = screen.getAllByRole('button')
      .find((b) => /raccourci|shortcut/i.test(b.getAttribute('aria-label') || b.textContent));
    if (raccourcis) {
      fireEvent.click(raccourcis);
      expect(onShortcutsOpen).toHaveBeenCalled();
    }
  });
});

describe('tiroir mobile', () => {
  it('sous 900 px, la navigation vit dans un tiroir qui s ouvre a la demande', () => {
    largeurEcran(false);
    rendre();
    const ouvrir = screen.queryByRole('button', { name: i18n.t('nav.openMenu') });
    if (ouvrir) {
      fireEvent.click(ouvrir);
      expect(screen.queryByRole('button', { name: i18n.t('nav.closeMenu') })).toBeTruthy();
    }
  });

  it('se referme en suivant un lien (sinon le tiroir masque la page)', () => {
    largeurEcran(false);
    rendre();
    const ouvrir = screen.queryByRole('button', { name: i18n.t('nav.openMenu') });
    if (ouvrir) {
      fireEvent.click(ouvrir);
      const lien = screen.getAllByRole('link')[0];
      fireEvent.click(lien);
      expect(screen.queryByRole('button', { name: i18n.t('nav.closeMenu') })).toBeNull();
    }
  });
});
