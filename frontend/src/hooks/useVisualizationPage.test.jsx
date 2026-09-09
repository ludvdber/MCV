import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

/**
 * Le hook que partagent les onze pages de visualisation.
 *
 * Il n'avait aucun test dedie, alors qu'il porte tout ce qui se passe entre le
 * clic et le graphique : la garde de lancement, l'appel reseau et son
 * annulation, l'entree d'historique, les raccourcis clavier et le marquage
 * « parametres modifies ». Un defaut ici ne touche pas une page, il les touche
 * toutes.
 *
 * Les raccourcis meritent une mention particuliere. Ce projet a deja connu un
 * echec WCAG 2.1.1 de niveau A a cet endroit : le raccourci Entree appelait
 * preventDefault() sur toutes ses touches, donc appuyer sur Entree avec un
 * bouton focalise annulait l'evenement et le bouton ne s'activait jamais. On
 * fixe ici ce que le hook DECLARE, la ou useKeyboardShortcuts.test.js verifie
 * comment ces declarations sont ecoutees.
 */

// --- Dependances du hook, remplacees par des doublures observables ----------

const etatMars = { catalogLoading: false, dataset: 'jeu-A', selectedDataset: 'jeu-A' };
const ajouterEntree = vi.fn();
const afficherToast = vi.fn();
const copier = vi.fn();
let raccourcisEnregistres = null;

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (cle, opts) => (opts?.id ? `${cle}:${opts.id}` : cle) }),
}));
vi.mock('../context/MarsContext', () => ({ useMars: () => etatMars }));
vi.mock('../context/ToastContext', () => ({ useToast: () => afficherToast }));
// usePlotRef rend un COUPLE de refs, pas une ref. Une doublure qui ne rend
// pas la meme forme casse la destructuration du hook des le premier rendu.
vi.mock('./usePlotRef', () => ({
  usePlotRef: () => {
    const conteneur = { current: null };
    const graphe = { get current() { return null; } };
    return [conteneur, graphe];
  },
}));
vi.mock('./useCopyToClipboard', () => ({ useCopyToClipboard: () => [false, copier] }));
vi.mock('./useRecentHistory', () => ({ useRecentHistory: () => ({ addEntry: ajouterEntree }) }));
vi.mock('./useKeyboardShortcuts', () => ({
  // On retient les raccourcis declares au lieu de les brancher sur document :
  // c'est le contrat du hook qu'on veut lire, pas le systeme d'ecoute.
  useKeyboardShortcuts: (r) => { raccourcisEnregistres = r; },
}));
vi.mock('../utils/scrollToViewer', () => ({ scrollViewerIntoView: vi.fn() }));

const { useVisualizationPage, isUsablePayload } = await import('./useVisualizationPage');

/** Une reponse axios : le hook lit `res.data`, pas la charge directement. */
const reponse = (charge) => Promise.resolve({ data: charge });

/** Configuration minimale : chaque test surcharge ce qui l'interesse. */
function config(surcharges = {}) {
  return {
    restoreUrl: () => false,
    fetchData: () => reponse({ values: [1, 2, 3] }),
    buildPermalink: () => 'https://exemple.be/slice?ds=jeu-A',
    buildHistoryEntry: () => ({ page: 'slice', label: 'Coupe' }),
    ...surcharges,
  };
}

beforeEach(() => {
  raccourcisEnregistres = null;
  etatMars.catalogLoading = false;
  etatMars.dataset = 'jeu-A';
  etatMars.selectedDataset = 'jeu-A';
});
afterEach(() => { vi.clearAllMocks(); });

describe('useVisualizationPage', () => {

  describe('garde de lancement', () => {
    it('ne lance rien quand la page declare ne pas pouvoir', async () => {
      const fetchData = vi.fn(() => reponse({ values: [1] }));
      const { result } = renderHook(() =>
        useVisualizationPage(config({ fetchData, canLaunch: () => false })));

      await act(async () => { result.current.handleLaunch(); });

      expect(fetchData).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
    });

    it('lance quand la page declare pouvoir', async () => {
      const fetchData = vi.fn(() => reponse({ values: [1] }));
      const { result } = renderHook(() =>
        useVisualizationPage(config({ fetchData, canLaunch: () => true })));

      await act(async () => { result.current.handleLaunch(); });
      await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(1));
    });

    it('sans garde declaree, le lancement passe', async () => {
      const fetchData = vi.fn(() => reponse({ values: [1] }));
      const { result } = renderHook(() => useVisualizationPage(config({ fetchData })));

      await act(async () => { result.current.handleLaunch(); });
      await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(1));
    });
  });

  describe('resultat et historique', () => {
    it('expose les donnees et enregistre une entree d historique', async () => {
      const { result } = renderHook(() => useVisualizationPage(config()));

      await act(async () => { result.current.handleLaunch(); });

      await waitFor(() => expect(result.current.data).toEqual({ values: [1, 2, 3] }));
      expect(ajouterEntree).toHaveBeenCalledTimes(1);
      // Le permalien est stocke SANS l'origine : l'historique doit rester
      // valable si le site change d'adresse.
      expect(ajouterEntree.mock.calls[0][0].permalink).toBe('/slice?ds=jeu-A');
    });

    /**
     * Si le permalien est illisible, l'entree doit quand meme etre enregistree :
     * elle retombe sur sa page. Perdre l'historique entier parce qu'une URL est
     * malformee serait une punition disproportionnee.
     */
    it('un permalien illisible ne fait pas perdre l entree d historique', async () => {
      const { result } = renderHook(() => useVisualizationPage(
        config({ buildPermalink: () => 'pas une URL' })));

      await act(async () => { result.current.handleLaunch(); });

      await waitFor(() => expect(ajouterEntree).toHaveBeenCalledTimes(1));
      expect(ajouterEntree.mock.calls[0][0].permalink).toBeUndefined();
      expect(ajouterEntree.mock.calls[0][0].page).toBe('slice');
    });

    it('aucune entree n est ecrite quand la page n en fabrique pas', async () => {
      const { result } = renderHook(() => useVisualizationPage(
        config({ buildHistoryEntry: () => null })));

      await act(async () => { result.current.handleLaunch(); });

      await waitFor(() => expect(result.current.data).not.toBeNull());
      expect(ajouterEntree).not.toHaveBeenCalled();
    });
  });

  describe('reponse inexploitable', () => {
    /**
     * Un 200 ne garantit pas un corps utilisable : axios rend une CHAINE quand
     * son JSON.parse echoue en silence, ce qui arrive avec un JSON tronque ou
     * une page HTML inseree par un intermediaire. Sans ce refus, la donnee
     * explosait au rendu et emportait la page dans l'ErrorBoundary.
     */
    it('une page HTML servie a la place du JSON est refusee proprement', async () => {
      const { result } = renderHook(() => useVisualizationPage(
        config({ fetchData: () => reponse('<html>erreur du proxy</html>') })));

      await act(async () => { result.current.handleLaunch(); });

      await waitFor(() => expect(result.current.error).toBe('error.malformedResponse'));
      expect(result.current.data).toBeNull();
      expect(ajouterEntree).not.toHaveBeenCalled();
    });

    it('un corps vide est refuse de la meme facon', async () => {
      const { result } = renderHook(() => useVisualizationPage(
        config({ fetchData: () => reponse({ data: null }) })));

      await act(async () => { result.current.handleLaunch(); });
      await waitFor(() => expect(result.current.error).toBe('error.malformedResponse'));
    });
  });

  describe('erreurs reseau', () => {
    it('le message du serveur prime sur celui de la bibliotheque', async () => {
      const { result } = renderHook(() => useVisualizationPage(config({
        fetchData: () => Promise.reject(
          Object.assign(new Error('Request failed'),
            { response: { data: { message: 'Jeu de donnees introuvable' } } })),
      })));

      await act(async () => { result.current.handleLaunch(); });

      await waitFor(() => expect(result.current.error).toBe('Jeu de donnees introuvable'));
      expect(result.current.loading).toBe(false);
    });

    it('sans message du serveur, celui de l erreur est affiche', async () => {
      const { result } = renderHook(() => useVisualizationPage(config({
        fetchData: () => Promise.reject(new Error('Network Error')),
      })));

      await act(async () => { result.current.handleLaunch(); });
      await waitFor(() => expect(result.current.error).toBe('Network Error'));
    });

    /**
     * Une requete annulee n'est pas une panne : c'est l'utilisateur qui a
     * relance avant la fin. L'afficher en rouge ferait clignoter une erreur a
     * chaque changement rapide de parametre.
     */
    it('une annulation volontaire n affiche aucune erreur', async () => {
      const { result } = renderHook(() => useVisualizationPage(config({
        fetchData: () => Promise.reject(Object.assign(new Error('canceled'),
          { code: 'ERR_CANCELED' })),
      })));

      await act(async () => { result.current.handleLaunch(); });

      await new Promise(r => setTimeout(r, 20));
      expect(result.current.error).toBeNull();
    });
  });

  describe('raccourcis clavier declares', () => {
    it('declare Entree et f', () => {
      renderHook(() => useVisualizationPage(config()));
      expect(Object.keys(raccourcisEnregistres ?? {})).toEqual(
        expect.arrayContaining(['Enter', 'f']));
    });

    it('Entree lance la visualisation', async () => {
      const fetchData = vi.fn(() => reponse({ values: [1] }));
      renderHook(() => useVisualizationPage(config({ fetchData })));

      await act(async () => { raccourcisEnregistres.Enter(); });
      await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(1));
    });

    it('Entree ne lance pas quand la page declare ne pas pouvoir', async () => {
      const fetchData = vi.fn(() => reponse({ values: [1] }));
      renderHook(() => useVisualizationPage(
        config({ fetchData, canLaunch: () => false })));

      await act(async () => { raccourcisEnregistres.Enter(); });
      expect(fetchData).not.toHaveBeenCalled();
    });

    it('f demande le plein ecran, puis en sort', async () => {
      const demander = vi.fn();
      const sortir = vi.fn();
      document.exitFullscreen = sortir;

      const { result } = renderHook(() => useVisualizationPage(config()));
      result.current.viewerContainerRef.current = { requestFullscreen: demander };

      // Aucun element en plein ecran : la touche doit le demander.
      Object.defineProperty(document, 'fullscreenElement', {
        value: null, configurable: true,
      });
      act(() => { raccourcisEnregistres.f(); });
      expect(demander).toHaveBeenCalledTimes(1);
      expect(sortir).not.toHaveBeenCalled();

      // Deja en plein ecran : la meme touche doit en sortir.
      Object.defineProperty(document, 'fullscreenElement', {
        value: {}, configurable: true,
      });
      act(() => { raccourcisEnregistres.f(); });
      expect(sortir).toHaveBeenCalledTimes(1);
      expect(demander).toHaveBeenCalledTimes(1);
    });

    it('f ne fait rien tant qu aucun viseur n est monte', () => {
      renderHook(() => useVisualizationPage(config()));
      expect(() => act(() => { raccourcisEnregistres.f(); })).not.toThrow();
    });
  });

  describe('parametres modifies', () => {
    /**
     * Le bandeau « parametres modifies » n'a de sens qu'en regard d'un
     * resultat affiche. Le lever avant tout calcul demanderait a l'utilisateur
     * de rafraichir quelque chose qui n'existe pas encore.
     */
    it('ne se leve pas tant qu aucun resultat n est affiche', () => {
      const { result } = renderHook(() => useVisualizationPage(config()));

      act(() => { result.current.markDirty(); });
      expect(result.current.isDirty).toBe(false);
    });

    it('se leve une fois un resultat affiche, et retombe au relancement', async () => {
      const { result } = renderHook(() => useVisualizationPage(config()));

      await act(async () => { result.current.handleLaunch(); });
      await waitFor(() => expect(result.current.data).not.toBeNull());

      act(() => { result.current.markDirty(); });
      expect(result.current.isDirty).toBe(true);

      await act(async () => { result.current.handleLaunch(); });
      await waitFor(() => expect(result.current.isDirty).toBe(false));
    });
  });

  describe('copie du permalien', () => {
    it('copie l URL et le signale', () => {
      const { result } = renderHook(() => useVisualizationPage(config()));

      act(() => { result.current.handleCopyLink(); });

      expect(copier).toHaveBeenCalledWith('https://exemple.be/slice?ds=jeu-A');
      expect(afficherToast).toHaveBeenCalledWith('toast.linkCopied');
    });
  });

  describe('isUsablePayload', () => {
    it('accepte un objet portant au moins un tableau non vide', () => {
      expect(isUsablePayload({ values: [1] })).toBe(true);
      expect(isUsablePayload({ data: [], frames: [1] })).toBe(true);
    });

    it('accepte un tableau non vide', () => {
      expect(isUsablePayload([1, 2])).toBe(true);
      expect(isUsablePayload([])).toBe(false);
    });

    /**
     * Le cas qui motive la fonction : axios rend une CHAINE quand son
     * JSON.parse echoue en silence, ce qui arrive avec un JSON tronque ou une
     * page HTML renvoyee par un intermediaire.
     */
    it('refuse ce qui n est pas une donnee exploitable', () => {
      expect(isUsablePayload('<html>erreur du proxy</html>')).toBe(false);
      expect(isUsablePayload('')).toBe(false);
      expect(isUsablePayload(null)).toBe(false);
      expect(isUsablePayload(undefined)).toBe(false);
      expect(isUsablePayload({})).toBe(false);
      expect(isUsablePayload({ data: null })).toBe(false);
      expect(isUsablePayload({ data: [] })).toBe(false);
      expect(isUsablePayload(42)).toBe(false);
    });
  });
});
