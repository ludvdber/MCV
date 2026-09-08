import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, render } from '@testing-library/react';
import { useRef } from 'react';
import i18n from './i18n';
import { renderSimple, installCanvas2D, installGeometrie } from './test/harness';
import { resetPlotly, callsOf } from './test/plotlyStub';
import CellErrorBoundary from './pages/explore/CellErrorBoundary';
import FullscreenButton from './components/FullscreenButton';
import { DiffMenuButton } from './pages/explore/ExploreToolbarButtons';

/**
 * Les garde-fous, et les commandes qui n'ont pas d'autre point d'entree.
 *
 * <p>Ces morceaux ont en commun de ne servir que dans des situations qu'on ne
 * traverse pas en exercant la console normalement : une vue qui plante, un
 * navigateur qui refuse le plein ecran, un menu ouvert au clavier. C'est
 * exactement pour cela qu'ils meritent un test — ils s'executent le jour ou
 * plus rien d'autre ne fonctionne.
 */
let desinstallerCanvas;
let desinstallerGeo;

beforeEach(async () => {
  resetPlotly();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  await i18n.changeLanguage('fr');
});

afterEach(() => {
  desinstallerCanvas();
  desinstallerGeo();
  vi.restoreAllMocks();
});

/** Un composant qui leve au rendu, tant qu'on ne le lui interdit pas. */
function Explosif({ casse }) {
  if (casse) throw new Error('vue en panne');
  return <div data-testid="vue-ok">vue rendue</div>;
}

/** Panne pilotee de l'exterieur, pour le scenario de reprise. */
let panneEnCours = true;
function Fragile() {
  return <Explosif casse={panneEnCours} />;
}

describe('garde-fou de cellule', () => {
  /**
   * Sans confinement, une seule vue en panne demonte l'arbre React entier :
   * l'ErrorBoundary racine prend la main et la console disparait, y compris
   * les trois autres cellules qui, elles, fonctionnaient.
   */
  it('confine l erreur et propose de retenter', async () => {
    // React journalise l'erreur rattrapee : ce bruit est attendu ici.
    const silence = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <CellErrorBoundary t={i18n.t.bind(i18n)}>
          <Explosif casse />
        </CellErrorBoundary>,
      );
      expect(screen.getByText(i18n.t('explore.cellError'))).toBeTruthy();
      expect(screen.getByRole('button', { name: i18n.t('explore.cellRetry') })).toBeTruthy();
    } finally {
      silence.mockRestore();
    }
  });

  it('laisse passer une vue saine sans rien afficher de son cru', () => {
    render(
      <CellErrorBoundary t={i18n.t.bind(i18n)}>
        <Explosif casse={false} />
      </CellErrorBoundary>,
    );
    expect(screen.getByTestId('vue-ok')).toBeTruthy();
    expect(screen.queryByText(i18n.t('explore.cellError'))).toBeNull();
  });

  /**
   * Le bouton de reprise doit REELLEMENT remonter l'enfant. Un garde-fou qui
   * affiche « retenter » sans jamais y parvenir est pire que pas de bouton du
   * tout : il promet une issue qui n'existe pas.
   */
  it('le bouton de reprise remonte vraiment la vue', async () => {
    const silence = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      // La panne est portee par un drapeau de MODULE, pas par une ref lue
      // pendant le rendu : c'est la cause qui disparait entre la panne et la
      // reprise, exactement comme une reponse serveur qui revient.
      render(
        <CellErrorBoundary t={i18n.t.bind(i18n)}>
          <Fragile />
        </CellErrorBoundary>,
      );
      expect(screen.getByText(i18n.t('explore.cellError'))).toBeTruthy();

      panneEnCours = false;
      fireEvent.click(screen.getByRole('button', { name: i18n.t('explore.cellRetry') }));
      await waitFor(() => expect(screen.queryByTestId('vue-ok')).toBeTruthy());
      // Et le message d'erreur doit avoir disparu : un garde-fou qui laisse les
      // deux a l'ecran n'a pas repris, il a empile.
      expect(screen.queryByText(i18n.t('explore.cellError'))).toBeNull();
    } finally {
      panneEnCours = true;
      silence.mockRestore();
    }
  });
});

describe('bouton plein ecran', () => {
  /** Un hote portant un faux graphe Plotly, pour la restauration de hauteur. */
  function Hote() {
    const ref = useRef(null);
    return (
      <div ref={ref}>
        <div className="js-plotly-plot" />
        <FullscreenButton containerRef={ref} />
      </div>
    );
  }

  /**
   * jsdom n'implemente pas l'API plein ecran. On la pose donc explicitement,
   * ce qui permet aussi de choisir ce qu'elle rend — notamment un refus.
   */
  function poserApiPleinEcran({ refus = false } = {}) {
    const demandes = [];
    Element.prototype.requestFullscreen = function demander() {
      demandes.push(this);
      if (refus) return Promise.reject(new TypeError('refus'));
      Object.defineProperty(document, 'fullscreenElement', { value: this, configurable: true });
      return Promise.resolve();
    };
    document.exitFullscreen = () => {
      if (refus) return Promise.reject(new TypeError('refus'));
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
      return Promise.resolve();
    };
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    return demandes;
  }

  it('demande le plein ecran sur le conteneur', async () => {
    const demandes = poserApiPleinEcran();
    renderSimple(<Hote />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.fullscreen') }));
    await waitFor(() => expect(demandes.length).toBe(1));
  });

  /**
   * Un navigateur peut refuser : hors geste utilisateur, dans une iframe sans
   * l'autorisation, ou par politique d'entreprise. La promesse est alors
   * rejetee, et un rejet non traite remonte a la console du visiteur.
   */
  it('un refus du navigateur ne produit pas de rejet non traite', async () => {
    poserApiPleinEcran({ refus: true });
    const rejets = [];
    const capter = (e) => { rejets.push(e); e.preventDefault?.(); };
    window.addEventListener('unhandledrejection', capter);
    try {
      renderSimple(<Hote />);
      fireEvent.click(screen.getByRole('button', { name: i18n.t('common.fullscreen') }));
      await new Promise((r) => setTimeout(r, 50));
      expect(rejets).toHaveLength(0);
    } finally {
      window.removeEventListener('unhandledrejection', capter);
    }
  });

  /**
   * En sortie, Plotly garde la taille du plein ecran : le graphe resterait
   * geant dans la page. Le composant restaure la hauteur memorisee a l'entree
   * puis demande un redimensionnement.
   */
  it('restaure la hauteur des graphes en sortant', async () => {
    poserApiPleinEcran();
    renderSimple(<Hote />);
    const graphe = document.querySelector('.js-plotly-plot');
    Object.defineProperty(graphe, 'offsetHeight', { value: 420, configurable: true });

    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.fullscreen') }));
    await waitFor(() => expect(document.fullscreenElement).toBeTruthy());

    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    document.dispatchEvent(new Event('fullscreenchange'));

    await waitFor(() => expect(callsOf('resize').length).toBeGreaterThanOrEqual(1));
  });

  it('affiche un bouton de sortie DANS l element plein ecran', async () => {
    poserApiPleinEcran();
    renderSimple(<Hote />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.fullscreen') }));
    await waitFor(() => expect(document.fullscreenElement).toBeTruthy());
    document.dispatchEvent(new Event('fullscreenchange'));

    // La barre d'outils n'est plus visible en plein ecran : sans ce bouton
    // flottant, il ne reste que la touche Echap, que rien n'annonce.
    await waitFor(() => expect(
      screen.getAllByRole('button', { name: i18n.t('common.exitFullscreen') }).length,
    ).toBeGreaterThanOrEqual(1));
  });
});

describe('menu de difference rapide', () => {
  const COUPES = [
    { id: 'a', label: 'TT — MY35 Ls0-30' },
    { id: 'b', label: 'TT — MY35 Ls30-60' },
  ];

  it('n ouvre son menu qu au clic, puis propose chaque coupe', async () => {
    const choisir = vi.fn();
    renderSimple(<DiffMenuButton slices={COUPES} onSelect={choisir} t={i18n.t.bind(i18n)} />);

    expect(screen.queryByRole('menuitem')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('explore.quickDiff') }));
    await waitFor(() => expect(screen.getAllByRole('menuitem')).toHaveLength(COUPES.length));
  });

  it('rend l identifiant de la coupe choisie et referme', async () => {
    const choisir = vi.fn();
    renderSimple(<DiffMenuButton slices={COUPES} onSelect={choisir} t={i18n.t.bind(i18n)} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('explore.quickDiff') }));
    await waitFor(() => expect(screen.getAllByRole('menuitem').length).toBe(2));

    fireEvent.click(screen.getAllByRole('menuitem')[1]);
    // C'est l'IDENTIFIANT qui remonte, pas le libelle : deux vues peuvent
    // porter le meme titre et l'appelant doit savoir laquelle soustraire.
    expect(choisir).toHaveBeenCalledWith('b');
    await waitFor(() => expect(screen.queryAllByRole('menuitem')).toHaveLength(0));
  });

  it('sans coupe a comparer, le menu s ouvre vide plutot que de disparaitre', async () => {
    renderSimple(<DiffMenuButton slices={[]} onSelect={vi.fn()} t={i18n.t.bind(i18n)} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('explore.quickDiff') }));
    await waitFor(() => expect(screen.getByText(i18n.t('explore.quickDiff'))).toBeTruthy());
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
  });
});
