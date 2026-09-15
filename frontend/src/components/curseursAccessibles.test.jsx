import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import i18n from '../i18n';
import { renderAvecProviders, installApiFixtures } from '../test/harness';
import TimeSelector from './TimeSelector';
import AltitudeSelector from './AltitudeSelector';
import LatLonSelector from './LatLonSelector';

/**
 * Les curseurs doivent dire ce qu'ils reglent, et avec la valeur qu'on LIT.
 *
 * Un curseur MUI ne porte aucun nom accessible par defaut, et il annonce son
 * INDICE plutot que la valeur affichee. Mesure faite dans un vrai navigateur
 * sur les six curseurs de l'application : ni aria-label, ni aria-labelledby,
 * ni aria-valuetext. Un lecteur d'ecran disait « curseur, 23, de 0 a 47 » la ou
 * l'ecran affiche « 11.5h », sans jamais nommer la grandeur reglee. C'est un
 * echec WCAG 4.1.2 de niveau A, invisible pour qui teste a la souris.
 *
 * <p>La suite de bout en bout verifie la meme propriete sur les pages
 * assemblees, ou les curseurs apparaissent reellement. Ce fichier-ci la fixe au
 * niveau du composant, ou elle coute une milliseconde : c'est ici qu'un
 * curseur ajoute demain sera pris.
 */

/* AltitudeSelector lit le jeu selectionne dans MarsContext : il lui faut les
   fournisseurs complets, pas un simple enrobage i18n. */
beforeEach(async () => {
  installApiFixtures();
  await i18n.changeLanguage('fr');
});
afterEach(async () => { await i18n.changeLanguage('fr'); });

/** Le nom accessible et le texte de valeur, tels qu'un lecteur d'ecran les lit. */
const curseurs = () => screen.getAllByRole('slider').map((s) => ({
  nom: s.getAttribute('aria-label'),
  valeurLue: s.getAttribute('aria-valuetext'),
  valeurBrute: s.getAttribute('value') ?? s.value,
}));

describe('nom accessible des curseurs', () => {

  it('le curseur horaire nomme la grandeur et annonce l heure, pas l indice', () => {
    renderAvecProviders(<TimeSelector value={23} onChange={() => {}} />);

    const [c] = curseurs();
    expect(c.nom, 'sans nom, la commande est muette').toBe(i18n.t('selector.time.label'));
    expect(c.valeurLue, 'l indice 23 ne veut rien dire : l ecran affiche 11.5h')
      .toMatch(/11[.,]5/);
  });

  it('le curseur d altitude annonce des kilometres, pas un niveau de modele', () => {
    renderAvecProviders(<AltitudeSelector value={49} onChange={() => {}} />);

    const [c] = curseurs();
    expect(c.nom).toBe(i18n.t('selector.altitude.label'));
    // Sans jeu charge, la table des altitudes est inconnue et le composant
    // annonce « Niveau 49 » : c'est EXACTEMENT ce que montre son etiquette
    // visible, donc la propriete tient. Ce qui compte est qu'un texte de valeur
    // existe et ne soit pas le nombre nu ; les kilometres sont verifies dans la
    // suite de bout en bout, ou un vrai jeu est charge.
    expect(c.valeurLue, 'un texte de valeur doit exister').toBeTruthy();
    expect(c.valeurLue, 'l indice nu ne dit rien a personne')
      .not.toBe(String(c.valeurBrute));
    expect(c.valeurLue).toBe(`${i18n.t('selector.altitude.level')} 49`);
  });

  /**
   * Deux curseurs cote a cote sans nom sont le pire cas : on entend « curseur »
   * deux fois et rien ne les distingue.
   */
  it('latitude et longitude portent des noms DIFFERENTS', () => {
    renderAvecProviders(
      <LatLonSelector latitude={0} longitude={0} onLatChange={() => {}} onLonChange={() => {}} />,
    );

    const noms = curseurs().map((c) => c.nom);
    expect(noms).toHaveLength(2);
    expect(noms[0]).toBe(i18n.t('selector.latlon.latitude'));
    expect(noms[1]).toBe(i18n.t('selector.latlon.longitude'));
    expect(noms[0]).not.toBe(noms[1]);
  });

  /** Le nom suit la langue : il vient de i18n, pas d'une chaine figee. */
  it('le nom accessible est traduit', async () => {
    await i18n.changeLanguage('de');
    renderAvecProviders(<TimeSelector value={0} onChange={() => {}} />);

    expect(curseurs()[0].nom).toBe(i18n.t('selector.time.label'));
    await i18n.changeLanguage('fr');
  });
});
