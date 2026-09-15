import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import api from '../services/api';
import { installApiFixtures, echecHttp, requetes } from '../test/harness';
import { MarsProvider, useMars } from './MarsContext';

/**
 * L'etat partage de toute l'application.
 *
 * `src/context/` n'avait aucun test alors que `MarsContext` est le point par
 * lequel passe chaque page : le catalogue, la selection courante, et le
 * clamping d'altitude au changement de variable. Ce n'est pas un composant
 * qu'on regarde, c'est une machine a etats que plusieurs pages se partagent —
 * donc exactement le genre d'endroit ou un defaut se propage partout sans se
 * voir nulle part.
 *
 * <p>Trois proprietes portent tout le reste, et ce sont des proprietes de
 * COURSE ou de BORNE, pas d'affichage : une selection deja faite ne doit jamais
 * etre ecrasee par une reponse reseau arrivee apres, une altitude doit etre
 * ramenee dans le domaine de la variable choisie, et la panne d'un catalogue
 * secondaire ne doit pas retenir l'application.
 */

/** Un consommateur minimal : il expose l'etat et laisse le piloter. */
function Sonde() {
  const m = useMars();
  return (
    <div>
      <span data-testid="chargement">{String(m.catalogLoading)}</span>
      <span data-testid="erreur">{m.catalogError ?? ''}</span>
      <span data-testid="jeu">{m.selectedDataset ?? ''}</span>
      <span data-testid="etiquette">{m.datasetLabel}</span>
      <span data-testid="variable">{m.selectedVariable}</span>
      <span data-testid="altitude">{String(m.selectedAltitude)}</span>
      <span data-testid="nbJeux">{String(m.datasets.length)}</span>
      <span data-testid="indivChargement">{String(m.individualLoading)}</span>
      <span data-testid="nbAnnees">{String(m.individualYears.length)}</span>
      <button onClick={() => m.setSelectedDataset('choisi-a-la-main')}>choisir</button>
      <button onClick={() => m.handleVariableChange('MTSF')}>surface</button>
      <button onClick={() => m.handleVariableChange('UU')}>dynamique</button>
      <button onClick={() => m.handleVariableChange('TT')}>thermo</button>
      <button onClick={() => m.setSelectedAltitude(102)}>alt102</button>
    </div>
  );
}

const rendre = () => render(
  <I18nextProvider i18n={i18n}>
    <MarsProvider><Sonde /></MarsProvider>
  </I18nextProvider>,
);

const lire = (cle) => screen.getByTestId(cle).textContent;

beforeEach(async () => {
  installApiFixtures();
  await i18n.changeLanguage('fr');
});
afterEach(() => { vi.restoreAllMocks(); });

describe('chargement du catalogue', () => {

  it('charge les deux catalogues une seule fois et choisit un jeu par defaut', async () => {
    rendre();
    await waitFor(() => expect(lire('chargement')).toBe('false'));

    expect(Number(lire('nbJeux'))).toBeGreaterThan(0);
    expect(lire('jeu'), 'une page doit etre lancable sans clic prealable').not.toBe('');
    expect(lire('erreur')).toBe('');

    // Un seul appel par catalogue : le Provider est monte une fois, et c'est
    // precisement ce qu'il economise aux pages qui appelaient chacune getCatalog.
    const appels = (url) => requetes.filter((r) => r.url === url).length;
    expect(appels('/catalog'), 'le catalogue MEAN ne doit etre demande qu une fois').toBe(1);
    expect(appels('/catalog/individual')).toBe(1);
  });

  /**
   * Le libelle du jeu est traduit : il vient de `selector.dataset.format`, pas
   * d'une chaine assemblee a la main. Changer de langue doit donc le changer.
   */
  it('le libelle du jeu suit la langue', async () => {
    rendre();
    await waitFor(() => expect(lire('etiquette')).not.toBe(''));
    const enFrancais = lire('etiquette');

    await act(async () => { await i18n.changeLanguage('de'); });
    await waitFor(() => expect(lire('etiquette')).not.toBe(enFrancais));

    await act(async () => { await i18n.changeLanguage('fr'); });
  });
});

describe('pannes de catalogue', () => {

  /**
   * Le catalogue MEAN est vital : son echec doit se VOIR. Un chargement qui ne
   * finit jamais laisserait une page en attente perpetuelle, ce qui est pire
   * qu'une erreur, parce que personne ne sait quoi en faire.
   */
  it('une panne du catalogue MEAN est annoncee et le chargement se termine', async () => {
    installApiFixtures({ '/catalog': echecHttp(500, 'serveur indisponible') });
    rendre();

    await waitFor(() => expect(lire('chargement')).toBe('false'));
    expect(lire('erreur'), 'l echec doit etre expose, pas avale').not.toBe('');
    expect(lire('nbJeux')).toBe('0');
  });

  /**
   * Le catalogue INDIVIDUAL est SECONDAIRE : l'institut peut n'en avoir aucun.
   * Sa panne est donc avalee volontairement — mais l'indicateur de chargement
   * doit quand meme se fermer, sinon le selecteur reste bloque sur un
   * chargement qui n'aboutira jamais.
   */
  it('une panne du catalogue INDIVIDUAL ne retient pas l application', async () => {
    installApiFixtures({ '/catalog/individual': echecHttp(500) });
    rendre();

    await waitFor(() => expect(lire('indivChargement')).toBe('false'));
    expect(lire('nbAnnees')).toBe('0');
    // Le catalogue principal, lui, a bien abouti : une panne secondaire ne
    // contamine pas le chemin vital.
    await waitFor(() => expect(Number(lire('nbJeux'))).toBeGreaterThan(0));
    expect(lire('erreur')).toBe('');
  });
});

describe('course entre un permalien et la reponse du catalogue', () => {

  /**
   * LE cas qui justifie le `setSelectedDataset(prev => prev ?? ...)`.
   *
   * Un permalien ou une restauration d'historique pose la selection tout de
   * suite ; la reponse du catalogue arrive apres et propose son defaut. Si elle
   * ecrasait, l'utilisateur qui ouvre un lien partage verrait le premier jeu du
   * catalogue au lieu de celui qu'on lui a envoye — une figure differente sous
   * la meme adresse, sans le moindre message.
   *
   * <p>Le test met vraiment les deux dans cet ordre : l'adaptateur ne repond
   * qu'une fois la selection posee. Sans retard controle, la course ne se
   * produit pas et le test passerait meme sur le code fautif.
   */
  it('une selection posee AVANT la reponse survit a l arrivee du catalogue', async () => {
    let repondre;
    const enAttente = new Promise((resolve) => { repondre = resolve; });
    const adaptateurFixtures = api.defaults.adapter;

    api.defaults.adapter = (config) => {
      if (config.url === '/catalog') {
        return enAttente.then(() => adaptateurFixtures(config));
      }
      return adaptateurFixtures(config);
    };

    rendre();
    // La selection arrive la premiere, catalogue toujours en vol.
    fireEvent.click(screen.getByText('choisir'));
    expect(lire('jeu')).toBe('choisi-a-la-main');

    await act(async () => { repondre(); await enAttente; });
    await waitFor(() => expect(lire('chargement')).toBe('false'));

    expect(lire('jeu'),
      'le defaut du catalogue ne doit jamais ecraser une selection deja faite')
      .toBe('choisi-a-la-main');
    expect(Number(lire('nbJeux')),
      'le catalogue est bien arrive : la course a eu lieu').toBeGreaterThan(0);

    api.defaults.adapter = adaptateurFixtures;
  });
});

describe('clamping de l altitude au changement de variable', () => {

  /**
   * Chaque famille de variable a son propre domaine vertical. Sans clamping,
   * l'altitude heritee de la variable precedente sort du domaine de la nouvelle
   * et la requete part avec un indice que le serveur refuse — ou pire, qu'il
   * accepte en lisant ailleurs.
   */
  it('une variable de SURFACE ramene l altitude a zero', async () => {
    rendre();
    await waitFor(() => expect(lire('chargement')).toBe('false'));
    expect(lire('altitude')).toBe('49');

    fireEvent.click(screen.getByText('surface'));
    expect(lire('variable')).toBe('MTSF');
    expect(lire('altitude'), 'une variable de surface n a pas de niveau').toBe('0');
  });

  it('une variable DYNAMIQUE plafonne l altitude a 101', async () => {
    rendre();
    await waitFor(() => expect(lire('chargement')).toBe('false'));

    // On se place d'abord au-dessus du plafond de la grille dynamique.
    fireEvent.click(screen.getByText('alt102'));
    expect(lire('altitude')).toBe('102');

    fireEvent.click(screen.getByText('dynamique'));
    expect(lire('variable')).toBe('UU');
    expect(lire('altitude'), 'la grille dynamique s arrete a 101').toBe('101');
  });

  /**
   * Le clamping ne doit pas etre aveugle : une altitude DEJA valide pour la
   * nouvelle variable ne doit pas bouger. Un clamping systematique ramenerait
   * l'utilisateur au sol a chaque changement de variable, ce qui serait un
   * defaut plus penible que celui qu'il corrige.
   */
  it('une altitude deja valide n est pas touchee', async () => {
    rendre();
    await waitFor(() => expect(lire('chargement')).toBe('false'));

    fireEvent.click(screen.getByText('dynamique'));
    expect(lire('altitude'), '49 est valide pour la grille dynamique').toBe('49');

    fireEvent.click(screen.getByText('thermo'));
    expect(lire('variable')).toBe('TT');
    expect(lire('altitude'), 'la grille thermodynamique est la plus haute : rien a ramener')
      .toBe('49');
  });

  /**
   * Le retour depuis une variable de surface est le chemin qui perd le plus
   * facilement l'information : l'altitude a ete forcee a 0, et rien ne la
   * restaure. Ce test ne demande pas qu'elle revienne — il FIXE le
   * comportement, pour que le jour ou quelqu'un decide de la restaurer, il le
   * fasse en connaissance de cause plutot que par accident.
   */
  it('revenir d une variable de surface laisse l altitude a zero', async () => {
    rendre();
    await waitFor(() => expect(lire('chargement')).toBe('false'));

    fireEvent.click(screen.getByText('surface'));
    expect(lire('altitude')).toBe('0');
    fireEvent.click(screen.getByText('thermo'));
    expect(lire('altitude'), 'le zero de surface persiste : comportement fixe, pas fortuit')
      .toBe('0');
  });
});
