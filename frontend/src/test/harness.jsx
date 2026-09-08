/**
 * Harnais de rendu des composants et des pages.
 *
 * Trois choix expliquent tout le reste :
 *
 * 1. On ne bouchonne PAS `services/api`. On substitue l'ADAPTATEUR Axios, si
 *    bien que les intercepteurs, le cache client et la normalisation des
 *    erreurs restent dans le chemin teste — c'est du code de ce depot.
 * 2. On monte les VRAIS providers (theme MUI, i18n, contexte Mars, toasts) :
 *    un test qui bouchonne le contexte ne verifie plus que le composant sait
 *    s'en servir.
 * 3. jsdom ne dessine rien. Les composants qui peignent sur un canvas
 *    recoivent ici un contexte 2D FACTICE qui journalise les appels, ce qui
 *    permet de verifier qu'on a bien dessine quelque chose sans comparer des
 *    pixels.
 */
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { vi } from 'vitest';
import i18n from '../i18n';
import api from '../services/api';
import { AppThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
import { MarsProvider } from '../context/MarsContext';
import { PAR_URL } from './fixtures';

/* ── API ──────────────────────────────────────────────────────────────── */

/** Requetes vues par l'adaptateur depuis le dernier `installApiFixtures`. */
export const requetes = [];

/**
 * Sert les fixtures a la place du reseau.
 *
 * @param {Object} [surcharges] table url -> corps, ou url -> Error pour
 *        provoquer un echec sur cet endpoint precis.
 */
let generation = 0;
const dateNowReel = Date.now.bind(Date);

export function installApiFixtures(surcharges = {}) {
  requetes.length = 0;
  // `api.js` garde un cache MEMOIRE au niveau du module (TTL 5 min), partage
  // par tous les tests d'un meme fichier : sans isolement, le second test qui
  // demande la meme coupe est servi par le cache et ne voit jamais la fixture
  // qu'on vient d'installer. Plutot que d'ajouter une porte de sortie dans le
  // code de production, on avance l'horloge de six minutes a chaque
  // installation : les entrees precedentes EXPIRENT par le chemin normal.
  generation += 1;
  const decalage = generation * 6 * 60 * 1000;
  Date.now = () => dateNowReel() + decalage;

  const table = { ...PAR_URL, ...surcharges };
  api.defaults.adapter = (config) => {
    requetes.push(config);
    const corps = table[config.url];
    if (corps instanceof Error) return Promise.reject(corps);
    if (corps === undefined) {
      return Promise.reject(Object.assign(new Error('404'), {
        response: { status: 404, data: { message: `Pas de fixture pour ${config.url}` } },
        config,
      }));
    }
    const data = config.responseType === 'blob'
      ? new Blob([typeof corps === 'string' ? corps : JSON.stringify(corps)], { type: 'text/csv' })
      : corps;
    return Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config });
  };
}

/** Fabrique un echec HTTP exploitable comme surcharge de fixture. */
export function echecHttp(status, message = 'Erreur de test') {
  return Object.assign(new Error(message), { response: { status, data: { message } } });
}

/* ── Canvas ───────────────────────────────────────────────────────────── */

/** Journal des appels de dessin, par canvas. */
export const dessins = [];

const CONTEXTE_2D = [
  'clearRect', 'fillRect', 'strokeRect', 'beginPath', 'closePath', 'moveTo',
  'lineTo', 'arc', 'arcTo', 'rect', 'ellipse', 'fill', 'stroke', 'save',
  'restore', 'translate', 'rotate', 'scale', 'setTransform', 'resetTransform',
  'setLineDash', 'fillText', 'strokeText', 'drawImage', 'clip', 'quadraticCurveTo',
  'roundRect',
  'bezierCurveTo', 'putImageData', 'transform',
];

/**
 * Remplace `HTMLCanvasElement.prototype.getContext` par un contexte 2D factice.
 * jsdom renvoie `null` sans le paquet natif `canvas` : tous les composants qui
 * peignent (particules de vent, reticule, ROI, transect, histogramme, textures
 * de planetes) sortiraient immediatement de leur effet sans rien executer.
 *
 * @returns {() => void} desinstallation
 */
export function installCanvas2D() {
  dessins.length = 0;
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function getContext(type) {
    if (type !== '2d') return null;
    if (!this.__ctx2d) {
      const journal = [];
      dessins.push({ canvas: this, journal });
      const ctx = {
        canvas: this,
        journal,
        globalAlpha: 1, globalCompositeOperation: 'source-over',
        fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt',
        lineJoin: 'miter', font: '10px sans-serif', textAlign: 'start',
        textBaseline: 'alphabetic', shadowBlur: 0, shadowColor: 'transparent',
        measureText: (t) => ({ width: String(t).length * 6 }),
        createLinearGradient: () => ({ addColorStop: () => {} }),
        createRadialGradient: () => ({ addColorStop: () => {} }),
        createPattern: () => null,
        getImageData: (x, y, w, h) => ({
          data: new Uint8ClampedArray(Math.max(1, w) * Math.max(1, h) * 4),
          width: w, height: h,
        }),
        createImageData: (w, h) => ({
          data: new Uint8ClampedArray(Math.max(1, w) * Math.max(1, h) * 4),
          width: w, height: h,
        }),
      };
      for (const m of CONTEXTE_2D) {
        ctx[m] = (...args) => { journal.push({ m, args }); };
      }
      this.__ctx2d = ctx;
    }
    return this.__ctx2d;
  };
  HTMLCanvasElement.prototype.toDataURL = function toDataURL() {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  };
  return () => { HTMLCanvasElement.prototype.getContext = original; };
}

/** Vrai si au moins un trait a ete peint sur au moins un canvas. */
export function aDessine() {
  return dessins.some((d) => d.journal.length > 0);
}

/* ── Geometrie ────────────────────────────────────────────────────────── */

/**
 * jsdom donne 0 a toutes les dimensions : les composants qui dimensionnent un
 * canvas d'apres son conteneur ne dessineraient rien. On impose une taille.
 */
export function installGeometrie(largeur = 800, hauteur = 600) {
  const rect = {
    width: largeur, height: hauteur, top: 0, left: 0,
    right: largeur, bottom: hauteur, x: 0, y: 0, toJSON: () => ({}),
  };
  const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect);
  for (const [prop, val] of [['offsetWidth', largeur], ['offsetHeight', hauteur],
    ['clientWidth', largeur], ['clientHeight', hauteur]]) {
    Object.defineProperty(HTMLElement.prototype, prop, { value: val, configurable: true });
  }
  return () => spy.mockRestore();
}

/* ── Rendu ────────────────────────────────────────────────────────────── */

/**
 * Enveloppe complete de l'application, sans le routeur du navigateur.
 * L'ordre reproduit celui d'App.jsx : theme, puis i18n, puis toasts, puis
 * contexte Mars (qui appelle le catalogue au montage).
 */
export function Providers({ children, route = '/' }) {
  return (
    <MemoryRouter initialEntries={[route]}>
      <AppThemeProvider>
        <I18nextProvider i18n={i18n}>
          <ToastProvider>
            <MarsProvider>{children}</MarsProvider>
          </ToastProvider>
        </I18nextProvider>
      </AppThemeProvider>
    </MemoryRouter>
  );
}

/** `render` de testing-library, enveloppe des providers reels. */
export function renderAvecProviders(ui, { route = '/', ...options } = {}) {
  return render(ui, {
    wrapper: ({ children }) => <Providers route={route}>{children}</Providers>,
    ...options,
  });
}

/** Variante sans contexte Mars, pour les composants de presentation purs. */
export function renderSimple(ui, { route = '/', ...options } = {}) {
  return render(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[route]}>
        <AppThemeProvider>
          <I18nextProvider i18n={i18n}>
            <ToastProvider>{children}</ToastProvider>
          </I18nextProvider>
        </AppThemeProvider>
      </MemoryRouter>
    ),
    ...options,
  });
}

/* ── Plotly factice pour les couches canvas ───────────────────────────── */

/**
 * Les couches (sonde, ROI, transect) se raccrochent au div `.js-plotly-plot`
 * de leur cellule et relisent sa geometrie dans `el._fullLayout` — c'est ainsi
 * qu'elles suivent le zoom et le pan. La doublure Plotly ne pose pas cette
 * structure interne : on la fabrique ici.
 *
 * @returns {{ hostRef, host, plotEl }} conteneur pret a etre passe en hostRef
 */
export function faireHotePlotly({
  l = 60, t = 40, w = 600, h = 400,
  xr = [-180, 180], yr = [-90, 90],
} = {}) {
  const host = document.createElement('div');
  host.style.position = 'relative';
  const plotEl = document.createElement('div');
  plotEl.className = 'js-plotly-plot';
  plotEl._fullLayout = {
    _size: { l, t, w, h },
    xaxis: { range: xr },
    yaxis: { range: yr },
  };
  // Plotly greffe un emetteur d'evenements sur le div du graphe : la sonde
  // liee REFUSE de s'attacher a un element qui n'en a pas (`typeof el.on`),
  // parce qu'elle s'abonne a plotly_hover / plotly_unhover.
  const ecouteurs = new Map();
  plotEl.on = (nom, fn) => {
    if (!ecouteurs.has(nom)) ecouteurs.set(nom, new Set());
    ecouteurs.get(nom).add(fn);
  };
  plotEl.removeListener = (nom, fn) => { ecouteurs.get(nom)?.delete(fn); };
  plotEl.removeAllListeners = () => ecouteurs.clear();
  /** Declenche un evenement Plotly comme le ferait un survol reel. */
  plotEl.emit = (nom, ev) => { for (const fn of ecouteurs.get(nom) ?? []) fn(ev); };

  host.appendChild(plotEl);
  document.body.appendChild(host);
  return { hostRef: { current: host }, host, plotEl };
}

/**
 * Emet un evenement de pointeur a des coordonnees ecran precises.
 * jsdom n'implemente ni `PointerEvent` ni la capture de pointeur : on passe
 * par un MouseEvent portant le bon type, ce que `addEventListener('pointer…')`
 * recoit sans distinction.
 */
export function pointeur(cible, type, x, y, extra = {}) {
  // `PointerEvent` vient du bouchon de src/test/setup.js : React 19 ne
  // reconnait un evenement de pointeur que par son type, mais les
  // gestionnaires lisent `pointerId`, et la capture doit exister.
  const ev = new PointerEvent(type, {
    bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, ...extra,
  });
  cible.dispatchEvent(ev);
  return ev;
}
