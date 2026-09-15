import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { slicesComparables, voletB, etiquetteVue } from './curtainSelection.js';
import ExploreTools from './ExploreTools.jsx';
import { ExploreProvider, useExploreState, useExploreDispatch, A } from './ExploreContext.jsx';
import { AppThemeProvider } from '../../context/ThemeContext';
import { ToastProvider } from '../../context/ToastContext';
import { MarsProvider } from '../../context/MarsContext';
import i18n from '../../i18n';
import { installApiFixtures } from '../../test/harness';

/**
 * Le choix du volet B du rideau A/B.
 *
 * Le rideau existait sans qu'on puisse choisir ce qu'il compare : l'action
 * SET_CURTAIN_B etait declaree dans le reducteur, testee dans
 * exploreReducer.test.js, et DISPATCHEE DE NULLE PART. Le volet B valait
 * toujours `otherSlices[0]`, c'est-a-dire la premiere autre coupe de la liste,
 * et son nom n'apparaissait que dans l'infobulle du bouton — donc jamais au
 * doigt, et remplacee par « Quitter le comparateur » des le rideau ouvert.
 *
 * Une action que le reducteur honore et que rien n'emet passe tous les tests
 * d'unite du monde : c'est le RACCORDEMENT qui manquait, et c'est lui qu'on
 * epingle ici.
 */

const coupe = (id, variable = 'TT', label = id) => ({
  id, type: 'slice', label, datasetLabel: label, params: { variable, time: 24, altitude: 49 },
});

describe('slicesComparables', () => {
  const etat = {
    resultsById: {
      a: coupe('a'), b: coupe('b'), c: coupe('c'),
      vent: coupe('vent', 'UU'),
      serie: { id: 'serie', type: 'timeseries', params: { variable: 'TT' } },
    },
    resultOrder: ['a', 'b', 'vent', 'serie', 'c'],
    activeResult: 'a',
  };

  it('retient les coupes de la meme variable, dans l ordre des onglets', () => {
    expect(slicesComparables(etat).map((s) => s.id)).toEqual(['b', 'c']);
  });

  it('exclut la vue active : une carte comparee a elle-meme donnerait une'
    + ' difference nulle parfaitement credible', () => {
    expect(slicesComparables(etat).some((s) => s.id === 'a')).toBe(false);
  });

  it('exclut les autres variables : superposer un vent et une temperature sur'
    + ' une echelle commune ne veut rien dire', () => {
    expect(slicesComparables(etat).some((s) => s.id === 'vent')).toBe(false);
  });

  it('exclut les types qui ne sont pas des coupes', () => {
    expect(slicesComparables(etat).some((s) => s.id === 'serie')).toBe(false);
  });

  it('ne compare rien quand la vue active n est pas une coupe', () => {
    expect(slicesComparables({ ...etat, activeResult: 'serie' })).toEqual([]);
  });

  it('survit a un etat vide', () => {
    expect(slicesComparables(undefined)).toEqual([]);
    expect(slicesComparables({})).toEqual([]);
  });
});

describe('voletB', () => {
  const candidats = [coupe('b'), coupe('c')];

  it('honore le choix memorise', () => {
    expect(voletB({ curtainBId: 'c' }, candidats).id).toBe('c');
  });

  it('retombe sur la premiere quand le choix n est plus comparable', () => {
    // Fermer l onglet choisi, changer de variable ou l activer le retire des
    // candidats : sans repli le rideau pointerait sur une vue absente.
    expect(voletB({ curtainBId: 'disparu' }, candidats).id).toBe('b');
  });

  it('retombe sur la premiere quand rien n a ete choisi', () => {
    expect(voletB({ curtainBId: null }, candidats).id).toBe('b');
  });

  it('rend null quand aucune comparaison n est possible', () => {
    expect(voletB({ curtainBId: 'b' }, [])).toBeNull();
  });
});

describe('etiquetteVue', () => {
  it('prefere le jeu de donnees au titre de la vue', () => {
    expect(etiquetteVue({ datasetLabel: 'MY35 Ls 0-30', label: 'Coupe' })).toBe('MY35 Ls 0-30');
  });
  it('se rabat sur le titre, puis sur rien', () => {
    expect(etiquetteVue({ label: 'Coupe' })).toBe('Coupe');
    expect(etiquetteVue(null)).toBe('');
  });
});

/* ── Le raccordement : la liste deroulante emet-elle vraiment SET_CURTAIN_B ? ── */

const DansLaConsole = ({ children }) => (
  <MemoryRouter initialEntries={['/explore']}>
    <AppThemeProvider>
      <I18nextProvider i18n={i18n}>
        <ToastProvider>
          <MarsProvider>
            <ExploreProvider>{children}</ExploreProvider>
          </MarsProvider>
        </ToastProvider>
      </I18nextProvider>
    </AppThemeProvider>
  </MemoryRouter>
);

/** Verse deux coupes comparables dans la console et active la premiere. */
function Amorcer({ vues }) {
  const dispatch = useExploreDispatch();
  useEffect(() => {
    vues.forEach((v) => dispatch({ type: A.ADD_RESULT, result: v }));
    dispatch({ type: A.SET_ACTIVE_RESULT, value: vues[0].id });
  }, [dispatch, vues]);
  return null;
}

/** Rend l etat du rideau lisible depuis le test. */
function Sonde() {
  const { curtainOn, curtainBId } = useExploreState();
  return <output data-testid="etat">{`${curtainOn ? 'on' : 'off'}:${curtainBId ?? '-'}`}</output>;
}

const VUES = [
  coupe('a', 'TT', 'MY35 Ls 0-30'),
  coupe('b', 'TT', 'MY35 Ls 30-60'),
  coupe('c', 'TT', 'MY35 Ls 60-90'),
];

const monterOutils = (vues = VUES) => render(
  <DansLaConsole>
    <Amorcer vues={vues} />
    <Sonde />
    <ExploreTools />
  </DansLaConsole>,
);

const etat = () => screen.getByTestId('etat').textContent;
const listeB = () => screen.getByRole('combobox', { name: i18n.t('explore.curtain.paneB') });
const boutonRideau = () => screen.getByRole('button', { name: /rideau/i });

beforeEach(async () => {
  installApiFixtures();
  await i18n.changeLanguage('fr');
});
afterEach(() => { vi.restoreAllMocks(); });

describe('ExploreTools, comparateur A/B', () => {
  it('nomme le volet A AVANT toute ouverture : c est la vue active, ce que rien'
    + ' n ecrivait nulle part', () => {
    monterOutils();
    expect(screen.getByText(/Volet A.*MY35 Ls 0-30/)).toBeTruthy();
  });

  it('propose toutes les coupes comparables, et elles seules', () => {
    monterOutils();
    fireEvent.mouseDown(listeB());
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['MY35 Ls 30-60', 'MY35 Ls 60-90']);
  });

  it('affiche le volet B EFFECTIF meme si rien n a ete choisi', () => {
    // Sans choix, le rideau s ouvre sur la premiere coupe comparable : la
    // liste doit deja le dire, sans quoi elle mentirait par omission.
    monterOutils();
    expect(listeB().textContent).toBe('MY35 Ls 30-60');
  });

  it('choisir une vue emet SET_CURTAIN_B', () => {
    monterOutils();
    fireEvent.mouseDown(listeB());
    fireEvent.click(within(screen.getByRole('listbox')).getByText('MY35 Ls 60-90'));
    expect(etat()).toBe('off:c');
    expect(listeB().textContent).toBe('MY35 Ls 60-90');
  });

  it('le rideau s ouvre sur la vue AFFICHEE par la liste, pas sur la premiere', () => {
    // Le defaut d origine tenait en une ligne : `bId: otherSlices[0].id`.
    monterOutils();
    fireEvent.mouseDown(listeB());
    fireEvent.click(within(screen.getByRole('listbox')).getByText('MY35 Ls 60-90'));
    fireEvent.click(boutonRideau());
    expect(etat()).toBe('on:c');
  });

  it('s ouvre sans choix prealable sur la premiere coupe comparable', () => {
    monterOutils();
    fireEvent.click(boutonRideau());
    expect(etat()).toBe('on:b');
  });

  it('change de volet B rideau OUVERT, sans le fermer', () => {
    monterOutils();
    fireEvent.click(boutonRideau());
    fireEvent.mouseDown(listeB());
    fireEvent.click(within(screen.getByRole('listbox')).getByText('MY35 Ls 60-90'));
    expect(etat()).toBe('on:c');
  });

  it('referme le rideau au second clic', () => {
    monterOutils();
    fireEvent.click(boutonRideau());
    fireEvent.click(boutonRideau());
    expect(etat()).toBe('off:-');
  });

  it('ne propose aucun comparateur avec une seule coupe', () => {
    // Le bloc entier disparait : une liste deroulante vide et un bouton qui ne
    // peut rien faire valent moins que rien.
    monterOutils([VUES[0]]);
    expect(screen.queryByRole('combobox', { name: i18n.t('explore.curtain.paneB') })).toBeNull();
    expect(screen.queryByRole('button', { name: /rideau/i })).toBeNull();
  });

  it('garde un seul bouton nomme « rideau » : le libelle est le point d entree'
    + ' de la suite de bout en bout', () => {
    monterOutils();
    expect(screen.getAllByRole('button', { name: /rideau/i })).toHaveLength(1);
  });
});
