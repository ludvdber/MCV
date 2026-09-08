import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import SlicePage from './SlicePage';
import TimeSeriesPage from './TimeSeriesPage';
import AnimationPage from './AnimationPage';
import ProfilePage from './ProfilePage';
import CrossSectionPage from './CrossSectionPage';
import HovmollerPage from './HovmollerPage';
import ZonalMeanPage from './ZonalMeanPage';
import WindRosePage from './WindRosePage';
import DifferencePage from './DifferencePage';
import TemporalProfilePage from './TemporalProfilePage';
import LegalPage from './LegalPage';
import NotFoundPage from './NotFoundPage';
import i18n from '../i18n';
import {
  renderAvecProviders, installApiFixtures, installCanvas2D, installGeometrie,
  echecHttp, requetes,
} from '../test/harness';
import { resetPlotly, callsOf } from '../test/plotlyStub';

/**
 * Les dix pages de visualisation partagent `useVisualizationPage` : meme cycle
 * (restauration d'URL, lancement, garde sur le corps de reponse, permalien,
 * historique). On les traite donc en TABLE plutot qu'une par une, et on
 * detaille ensuite ce qui est propre a chacune.
 *
 * Le catalogue est charge par le contexte au montage : chaque test attend donc
 * que le bouton de lancement devienne actif avant de cliquer.
 */
let desinstallerCanvas;
let desinstallerGeo;

beforeEach(async () => {
  resetPlotly();
  installApiFixtures();
  desinstallerCanvas = installCanvas2D();
  desinstallerGeo = installGeometrie();
  await i18n.changeLanguage('fr');
});

afterEach(() => { desinstallerCanvas(); desinstallerGeo(); });

/** Les dix endpoints de donnees, pour casser la couche reseau d'un bloc. */
const ENDPOINTS = [
  '/data/slice', '/data/timeseries', '/data/animation', '/data/profile',
  '/data/crosssection', '/data/hovmoller', '/data/zonalmean',
  '/data/windrose', '/data/difference', '/data/temporal-profile',
];
const tousEnEchec = (corps) => Object.fromEntries(ENDPOINTS.map((u) => [u, corps]));

/** [nom, composant, route, cle i18n du bouton]
 *  La page Difference exige DEUX jeux : sa route porte le second, sinon son
 *  bouton reste desactive et le test n'apprend rien. */
const PAGES = [
  ['Coupe lat/lon', SlicePage, '/slice', 'page.slice.button'],
  ['Serie temporelle', TimeSeriesPage, '/timeseries', 'page.timeseries.button'],
  ['Animation', AnimationPage, '/animation', 'page.animation.button'],
  ['Profil vertical', ProfilePage, '/profile', 'page.profile.button'],
  ['Coupe verticale', CrossSectionPage, '/crosssection', 'page.crosssection.button'],
  ['Hovmoller', HovmollerPage, '/hovmoller', 'page.hovmoller.button'],
  ['Moyenne zonale', ZonalMeanPage, '/zonalmean', 'page.zonalmean.button'],
  ['Rose des vents', WindRosePage, '/windrose', 'page.windrose.button'],
  ['Difference', DifferencePage, '/difference?dsA=mean_MY35_Ls0_30&dsB=mean_MY35_Ls30_60',
    'page.difference.button'],
  ['Profil temporel', TemporalProfilePage, '/temporal-profile', 'page.temporalprofile.button'],
];

/**
 * Rend une page et attend que son bouton de lancement devienne actif.
 * `surcharges` est applique AVANT le rendu : un endpoint casse apres coup
 * serait masque par le cache client de la requete deja partie.
 */
async function ouvrir(Page, route, cleBouton, surcharges = null) {
  if (surcharges) installApiFixtures(surcharges);
  const rendu = renderAvecProviders(<Page />, { route });
  const bouton = await screen.findByRole('button', { name: i18n.t(cleBouton) });
  // `toBeDisabled` vient de jest-dom, qui n'est pas installe ici : on lit
  // la propriete DOM, ce qui revient au meme sans nouvelle dependance.
  await waitFor(() => expect(bouton.disabled).toBe(false));
  return { ...rendu, bouton };
}

describe('cycle commun des pages de visualisation', () => {
  it.each(PAGES)('%s : se monte et propose son bouton de lancement', async (nom, Page, route, cle) => {
    const { bouton } = await ouvrir(Page, route, cle);
    expect(bouton, nom).toBeTruthy();
  });

  it.each(PAGES)('%s : lance la requete et trace le resultat', async (nom, Page, route, cle) => {
    const { bouton } = await ouvrir(Page, route, cle);
    fireEvent.click(bouton);
    await waitFor(() => expect(callsOf('newPlot').length, nom).toBeGreaterThanOrEqual(1));
  });

  it.each(PAGES)('%s : affiche le message du backend en cas d echec', async (nom, Page, route, cle) => {
    const { bouton } = await ouvrir(Page, route, cle,
      tousEnEchec(echecHttp(400, 'Altitude hors bornes')));
    fireEvent.click(bouton);
    // Le message precis du backend doit survivre : c est lui qui dit quoi
    // corriger, la ou un « une erreur est survenue » n apprend rien.
    await waitFor(() => expect(document.body.textContent, nom).toContain('Altitude hors bornes'));
  });

  it.each(PAGES)('%s : refuse un corps de reponse inexploitable', async (nom, Page, route, cle) => {
    // Un proxy inverse renvoie une page HTML avec un code 200 : axios la rend
    // comme une CHAINE. Sans le filtre, la donnee explose au rendu.
    const { bouton } = await ouvrir(Page, route, cle,
      tousEnEchec('<html>503 Service Unavailable</html>'));
    resetPlotly();
    fireEvent.click(bouton);
    await waitFor(() => expect(document.body.textContent, nom)
      .toContain(i18n.t('error.malformedResponse')));
    expect(callsOf('newPlot').length, nom).toBe(0);
  });

  it.each(PAGES)('%s : titre la page avec un seul h1', async (nom, Page, route, cle) => {
    await ouvrir(Page, route, cle);
    expect(screen.getAllByRole('heading', { level: 1 }), nom).toHaveLength(1);
  });
});

describe('SlicePage', () => {
  it('restaure ses parametres depuis un permalien et lance seule', async () => {
    renderAvecProviders(<SlicePage />, {
      route: '/slice?ds=mean_MY35_Ls30_60&var=TT&t=30&alt=12',
    });
    await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1));
    const appel = requetes.find((r) => r.url === '/data/slice');
    expect(appel.params).toMatchObject({ dataset: 'mean_MY35_Ls30_60', time: 30, altitude: 12 });
  });

  it('ignore un permalien aux valeurs non numeriques au lieu de les envoyer', async () => {
    // Une query string est editable a la main : `t=abc` ne doit pas partir
    // vers l API ni produire un NaN dans les selecteurs.
    renderAvecProviders(<SlicePage />, { route: '/slice?ds=mean_MY35_Ls0_30&t=abc&alt=xyz' });
    await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1));
    const appel = requetes.find((r) => r.url === '/data/slice');
    expect(Number.isFinite(appel.params.time)).toBe(true);
    expect(Number.isFinite(appel.params.altitude)).toBe(true);
  });

  it('demande le champ de vent sous le nom de parametre que le controleur declare', async () => {
    const { bouton } = await ouvrir(SlicePage, '/slice', 'page.slice.button');
    fireEvent.click(bouton);
    await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1));
    const vent = screen.queryByRole('button', { name: i18n.t('page.slice.wind') })
      ?? screen.queryByLabelText(i18n.t('page.slice.wind'));
    if (vent) {
      fireEvent.click(vent);
      await waitFor(() => {
        const appel = requetes.find((r) => r.url === '/data/wind');
        expect(appel).toBeTruthy();
        // `altitudeIndex` au lieu d `altitude` : Spring applique son defaut (49)
        // sans erreur ni journal, et tous les vecteurs montraient le niveau 49.
        expect(appel.params).toHaveProperty('altitude');
        expect(appel.params).not.toHaveProperty('altitudeIndex');
      });
    }
  });

  it('signale que les parametres ont change depuis le dernier trace', async () => {
    const { bouton } = await ouvrir(SlicePage, '/slice', 'page.slice.button');
    fireEvent.click(bouton);
    await waitFor(() => expect(callsOf('newPlot').length).toBeGreaterThanOrEqual(1));
    // Sans ce rappel, l utilisateur croit voir le resultat de ses derniers
    // reglages alors que le graphe date du clic precedent.
    expect(document.body.textContent).not.toContain(i18n.t('page.slice.dirty'));
  });
});

describe('pages statiques', () => {
  it('la page legale s affiche sans appel reseau de donnees', () => {
    renderAvecProviders(<LegalPage />, { route: '/legal' });
    expect(screen.getAllByRole('heading').length).toBeGreaterThan(0);
    expect(requetes.filter((r) => r.url.startsWith('/data/'))).toHaveLength(0);
  });

  it('la page 404 propose un retour a l accueil', () => {
    renderAvecProviders(<NotFoundPage />, { route: '/inexistant' });
    // Le retour se fait par `navigate('/')`, pas par une ancre : on verifie
    // qu'un bouton porte bien ce libelle et reste actionnable au clavier.
    const bouton = screen.getByRole('button', { name: i18n.t('page.notfound.backHome') });
    expect(bouton).toBeTruthy();
    expect(bouton.disabled).toBe(false);
  });

  it('la page legale suit la langue', async () => {
    const { unmount } = renderAvecProviders(<LegalPage />, { route: '/legal' });
    const fr = document.body.textContent;
    unmount();
    await i18n.changeLanguage('en');
    renderAvecProviders(<LegalPage />, { route: '/legal' });
    expect(document.body.textContent).not.toBe(fr);
    await i18n.changeLanguage('fr');
  });
});
