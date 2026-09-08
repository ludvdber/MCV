/**
 * Champs de vent des vues affichees, un par couple (jeu de donnees, pas de
 * temps, altitude).
 *
 * Avant, un seul champ vivait dans l'etat : celui de la vue ACTIVE. En grille
 * de deux ou quatre cartes, une seule animait donc son vent et les autres
 * restaient nues, sans que rien ne l'explique a l'ecran. Les champs sont
 * desormais ranges dans un cache ADRESSE PAR SON CONTENU : deux vues du meme
 * instant et de la meme altitude partagent une seule entree et une seule
 * requete, deux altitudes differentes en obtiennent chacune une.
 *
 * La cle EST la requete, serialisee. Elle ne peut donc pas decrire autre chose
 * que ce qui a ete demande, et un champ range sous une cle ne peut jamais etre
 * affiche pour une autre altitude : c'est ce qui remplace l'invalidation
 * manuelle de l'ancien champ unique.
 *
 * Le cache est borne a MAX_WIND_FIELDS entrees, purgees a l'insertion (la plus
 * ancienne d'abord). Un champ pese peu — la grille est sous-echantillonnee d'un
 * facteur 3 cote serveur, deux composantes par point — et le conserver evite de
 * retelecharger en revenant sur une altitude deja visitee.
 */
import { useEffect, useRef } from 'react';
import { getWind } from '../../services/api';
import { WIND_FETCH_DEBOUNCE_MS } from '../../utils/windStats';
import { INDIVIDUAL_PREFIX } from '../../constants';
import { visibleResultIds } from './exploreUtils.js';
import { A } from './ExploreContext.jsx';

/** Composantes du vent : leur carte EST le vent, on n'y superpose rien. */
const WIND_COMPONENTS = ['UU', 'VV'];

/**
 * Requete de vent correspondant aux parametres d'une carte, ou null si la vue
 * n'en admet pas.
 */
export function windRequestFor(params) {
  const dataset = params?.dataset;
  const altitude = Number(params?.altitude);
  if (!dataset || !Number.isFinite(altitude)) return null;
  // Un fichier annuel ne contient qu'un pas de temps : meme normalisation que
  // pour la carte elle-meme, sinon le serveur refuse l'instant demande.
  const time = dataset.startsWith(INDIVIDUAL_PREFIX) ? 0 : (Number(params.time) || 0);
  return { dataset, time, altitude };
}

/** Cle de cache d'une requete. Aucun identifiant de dataset ne contient « | ». */
export function windKeyOf(request) {
  return request ? `${request.dataset}|${request.time}|${request.altitude}` : null;
}

/** Operation inverse : la cle porte tout ce qu'il faut pour (re)lancer l'appel. */
export function requestFromKey(key) {
  const [dataset, time, altitude] = key.split('|');
  return { dataset, time: Number(time), altitude: Number(altitude) };
}

/**
 * Cle du champ qu'une vue doit afficher, ou null si elle n'en affiche pas.
 * Une seule definition de la regle « qui voit le vent », partagee par le rendu
 * et par le telechargement : ils ne peuvent donc pas diverger.
 */
function windKeyForView(state, result, isActive) {
  if (!state.showWind && !state.showWindParticles) return null;
  if (!result || result.type !== 'slice') return null;
  if (!state.windAllViews && !isActive) return null;
  if (WIND_COMPONENTS.includes(result.params?.variable)) return null;
  return windKeyOf(windRequestFor(result.params));
}

/** Champ deja telecharge pour cette vue, ou null (absent ou pas encore arrive). */
export function windFieldFor(state, result, isActive) {
  const key = windKeyForView(state, result, isActive);
  return key ? (state.windFields[key] ?? null) : null;
}

/** Cles distinctes a telecharger pour l'etat courant, dans l'ordre des vues. */
export function windTargetKeys(state) {
  const ids = state.windAllViews
    ? visibleResultIds(state)
    : (state.activeResult ? [state.activeResult] : []);
  const keys = [];
  for (const id of ids) {
    const key = windKeyForView(state, state.resultsById[id], id === state.activeResult);
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

/**
 * Maintient le cache a jour pour les vues affichees.
 *
 * L'effet ne depend que de la liste des cles MANQUANTES, calculee au rendu :
 * il ne se relance donc pas pour les champs deja en main, et une reponse qui
 * arrive retire simplement sa cle de la liste.
 *
 * Chaque requete porte son propre AbortController, range par cle : une reponse
 * qui arrive n'annule pas les requetes soeurs de la meme grille. Seules les
 * cles qui cessent d'etre demandees (changement d'altitude, vue fermee) sont
 * annulees, plus toutes celles encore en vol au demontage.
 *
 * Un echec ne laisse aucune trace : la cle reste absente du cache. Il n'y a
 * PAS de reprise automatique pour autant, et c'est deliberé : la signature de
 * l'effet est faite des cles manquantes, donc un echec ne la change pas et
 * n'en relance pas la demande. La couche de vent manque jusqu'au prochain
 * changement de vue, d'altitude ou d'instant. Une reprise en boucle
 * martelerait un serveur deja en difficulte, et la carte reste lisible sans
 * le vent.
 */
export function useWindFields(state, dispatch) {
  const manquantes = windTargetKeys(state).filter(key => !state.windFields[key]);
  const signature = manquantes.join(',');
  const enCours = useRef(null);
  if (enCours.current === null) enCours.current = new Map();

  useEffect(() => {
    const voulues = signature ? signature.split(',') : [];
    const vol = enCours.current;
    for (const [key, controller] of [...vol]) {
      if (!voulues.includes(key)) { controller.abort(); vol.delete(key); }
    }
    const aDemander = voulues.filter(key => !vol.has(key));
    if (aDemander.length === 0) return undefined;

    // Anti-rebond : un balayage du curseur d'altitude traverse des dizaines de
    // valeurs, chacune avec sa propre cle. Sans ce delai, chaque cran partirait
    // en requete (26 mesurees sur un seul glissement) ; elles atteignent le
    // serveur meme annulees, et comptent dans la limite de debit par IP.
    const timer = setTimeout(() => {
      for (const key of aDemander) {
        const controller = new AbortController();
        vol.set(key, controller);
        getWind(requestFromKey(key), controller.signal)
          .then(res => dispatch({ type: A.SET_WIND_FIELD, key, value: res.data }))
          .catch(() => { /* rien a memoriser : la cle reste absente et sera retentee */ })
          .finally(() => { if (vol.get(key) === controller) vol.delete(key); });
      }
    }, WIND_FETCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [signature, dispatch]);

  /* Demontage de la console : plus personne n'attend ces champs. */
  useEffect(() => {
    const vol = enCours.current;
    return () => { for (const controller of vol.values()) controller.abort(); vol.clear(); };
  }, []);
}
