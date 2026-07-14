/**
 * Bundle Plotly personnalisé — n'embarque que les types de trace réellement
 * utilisés par l'application au lieu du dist complet (~4,6 Mo brut / 1,37 Mo gzip) :
 *
 *   - heatmap   : Slice, Animation, Coupe, Hovmöller, Profil temporel, Différence
 *   - scatter   : séries temporelles, profils, vecteurs de vent, POI, moyenne zonale (lignes)
 *   - histogram : DetailPanel (distribution des valeurs)
 *   - contour   : Moyenne zonale
 *   - barpolar  : Rose des vents
 *
 * Tous les composants importent Plotly depuis CE module (jamais depuis
 * 'plotly.js' directement) pour garantir un chunk unique et l'enregistrement
 * des traces avant le premier rendu.
 */
import Plotly from 'plotly.js/lib/core';
import heatmap from 'plotly.js/lib/heatmap';
import scatter from 'plotly.js/lib/scatter';
import histogram from 'plotly.js/lib/histogram';
import contour from 'plotly.js/lib/contour';
import barpolar from 'plotly.js/lib/barpolar';

Plotly.register([heatmap, scatter, histogram, contour, barpolar]);

/**
 * Rendu idempotent d'un graphe : newPlot (avec config) a la creation,
 * Plotly.react SANS config aux mises a jour.
 *
 * Ne pas passer la config a Plotly.react : dans Plotly 3.x, le chemin
 * « config change » reconstruit le graphe et le laisse vide (constate
 * empiriquement sur les heatmaps). La config ne sert qu'a la creation.
 */
export function renderPlot(el, traces, layout, config) {
  if (el.data) return Plotly.react(el, traces, layout);
  return Plotly.newPlot(el, traces, layout, config);
}

export default Plotly;
