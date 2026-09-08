/**
 * Doublure de `src/plotlyBundle.js` pour les tests (alias declare dans
 * vitest.config.js).
 *
 * POURQUOI : plotly.js pese 4,6 Mo, s'appuie sur une geometrie SVG que jsdom
 * ne calcule pas, et n'est PAS le code de ce depot. Ce qu'on veut verifier,
 * c'est ce que l'application LUI DEMANDE — les traces, le layout, la config,
 * l'ordre newPlot/react, la purge au demontage — pas son rendu.
 *
 * La doublure enregistre donc chaque appel dans `plotlyCalls`, marque l'element
 * comme « deja trace » (`el.data`) exactement comme Plotly le fait, ce qui rend
 * observable la regle « newPlot a la creation, react ensuite ».
 */
export const plotlyCalls = [];

/** Vide le journal — a appeler dans un beforeEach. */
export function resetPlotly() {
  plotlyCalls.length = 0;
}

/** Dernier appel enregistre pour une methode donnee. */
export function lastCall(method) {
  for (let i = plotlyCalls.length - 1; i >= 0; i--) {
    if (plotlyCalls[i].method === method) return plotlyCalls[i];
  }
  return null;
}

/** Tous les appels d'une methode. */
export function callsOf(method) {
  return plotlyCalls.filter((c) => c.method === method);
}

const journalise = (method) => (el, ...args) => {
  plotlyCalls.push({ method, el, args, traces: args[0], layout: args[1], config: args[2] });
  return Promise.resolve(el);
};

/** Geometrie interne que Plotly greffe sur le div apres un trace. Les couches
 *  canvas et le recalcul des fleches d'export la relisent : sans elle, ces
 *  chemins sortent immediatement et ne sont jamais executes. */
/**
 * Greffe sur un div l'emetteur d'evenements que Plotly y installe.
 * La sonde liee, le zoom synchronise et le menu de drill-down REFUSENT de
 * s'attacher a un element sans `.on` : sans cela, leurs chemins restent morts.
 * `el.emit(nom, evenement)` permet a un test de simuler un survol ou un clic.
 */
export function greffonEvenements(el) {
  if (!el || el.on) return el;
  const ecouteurs = new Map();
  el.on = (nom, fn) => {
    if (!ecouteurs.has(nom)) ecouteurs.set(nom, new Set());
    ecouteurs.get(nom).add(fn);
  };
  el.removeListener = (nom, fn) => { ecouteurs.get(nom)?.delete(fn); };
  el.removeAllListeners = (nom) => {
    if (nom) ecouteurs.delete(nom); else ecouteurs.clear();
  };
  el.emit = (nom, ev) => { for (const fn of [...(ecouteurs.get(nom) ?? [])]) fn(ev); };
  return el;
}

function poserFullLayout(el, layout) {
  if (!el) return;
  // Plotly marque le div qu'il a trace avec la classe `js-plotly-plot`. Les
  // couches canvas (sonde, ROI, transect, zoom synchronise) et le ref d'export
  // s'y accrochent par `host.querySelector('.js-plotly-plot')` : sans elle,
  // elles ne s'attachent jamais et leurs chemins restent morts en test.
  el.classList?.add('js-plotly-plot');
  greffonEvenements(el);
  const m = layout?.margin ?? {};
  el._fullLayout = {
    _size: { l: m.l ?? 70, t: m.t ?? 80, w: 800, h: 500 },
    xaxis: { range: layout?.xaxis?.range ?? [-180, 180] },
    yaxis: { range: layout?.yaxis?.range ?? [-90, 90] },
  };
}

const Plotly = {
  newPlot: (el, traces, layout, config) => {
    plotlyCalls.push({ method: 'newPlot', el, traces, layout, config });
    // Plotly pose `data` sur l'element : c'est ce marqueur que renderPlot lit
    // pour choisir entre newPlot et react.
    if (el) el.data = traces;
    poserFullLayout(el, layout);
    return Promise.resolve(el);
  },
  react: (el, traces, layout) => {
    plotlyCalls.push({ method: 'react', el, traces, layout });
    if (el) el.data = traces;
    poserFullLayout(el, layout);
    return Promise.resolve(el);
  },
  purge: (el) => { plotlyCalls.push({ method: 'purge', el }); if (el) delete el.data; },
  restyle: journalise('restyle'),
  relayout: journalise('relayout'),
  register: () => {},
  toImage: (el, opts) => {
    plotlyCalls.push({ method: 'toImage', el, opts });
    // 1x1 PNG transparent : une vraie data URL, decodable par un <img>.
    return Promise.resolve('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
  },
  // `Plots.resize` rend une PROMESSE dans la vraie bibliotheque, et du code
  // applicatif y enchaine un `.then(...).catch(...)` (FullscreenButton restaure
  // la hauteur des graphes en sortie de plein ecran). Une doublure qui rend
  // undefined faisait lever « Cannot read properties of undefined » a
  // l'interieur d'un ecouteur d'evenement, donc hors de portee du test : celui
  // qui exercait ce chemin passait au vert avec une exception non rattrapee a
  // cote. Une doublure doit rendre la meme FORME que l'originale.
  Plots: {
    resize: (el) => {
      plotlyCalls.push({ method: 'resize', el });
      return Promise.resolve(el);
    },
  },
};

/** Meme signature que le vrai module : newPlot a la creation, react ensuite. */
export function renderPlot(el, traces, layout, config) {
  if (el.data) return Plotly.react(el, traces, layout);
  return Plotly.newPlot(el, traces, layout, config);
}

export default Plotly;
