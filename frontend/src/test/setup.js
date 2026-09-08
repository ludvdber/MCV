/**
 * Mise en place commune des tests (vitest `setupFiles`).
 *
 * jsdom n'implemente PAS trois API que tout navigateur cible fournit et dont
 * l'application se sert : `matchMedia` (media queries lues en JS : thème
 * système, prefers-reduced-motion, breakpoint « vent partout »),
 * `ResizeObserver` (MUI, Plotly, la grille de l'Explorateur) et
 * `IntersectionObserver` (les revelations au defilement de la page d'accueil).
 * Sans elles, le simple rendu d'un composant leve `... is not a function`, ce
 * qui n'apprend rien sur le produit.
 *
 * Ce sont des BOUCHONS INERTES : ils ne declenchent jamais de callback. Un test
 * qui veut observer une media query precise doit la definir lui-meme, et un
 * test qui depend d'un redimensionnement doit appeler le callback a la main.
 */

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},      // API depreciee, encore lue par certaines libs
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

for (const nom of ['ResizeObserver', 'IntersectionObserver']) {
  if (!globalThis[nom]) {
    globalThis[nom] = class {
      constructor(callback) { this.callback = callback; }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    };
  }
}

// jsdom ne dessine rien : les composants qui mesurent un canvas (particules de
// vent, export d'image) recoivent un contexte 2D nul et doivent s'en sortir.
// On ne bouchonne PAS getContext ici, justement pour que ce chemin soit teste.

// jsdom DEFINIT window.scrollTo mais son implementation leve « Not
// implemented » et pollue la sortie : on la remplace inconditionnellement.
window.scrollTo = () => {};

// jsdom ne calcule aucune geometrie, donc pas de defilement : la visite
// guidee et le lien d'evitement appellent pourtant scrollIntoView sur
// leur cible. Bouchon inerte, comme les autres.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

// jsdom n'a NI `PointerEvent` NI la capture de pointeur. Toute l'interaction
// a la souris de l'application passe par ces evenements (poignee du rideau,
// selection de region, transect) : sans eux, React ne recoit rien et ces
// chemins restent inatteignables. On fournit la classe (un MouseEvent qui
// porte pointerId/pointerType) et une capture inerte.
if (typeof globalThis.PointerEvent !== 'function') {
  globalThis.PointerEvent = class PointerEvent extends MouseEvent {
    constructor(type, params = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? 'mouse';
      this.isPrimary = params.isPrimary ?? true;
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0.5;
    }
  };
}
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
