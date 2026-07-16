/**
 * Filtre quelques messages console de bibliothèques tierces qu'on ne peut pas
 * couper par configuration : le « Context Lost/Restored » et la dépréciation
 * « THREE.Clock » de three.js (internes à @react-three/fiber, rien à corriger
 * côté application, disparaîtra à la migration R3F), et la pub Locize de i18next.
 * Tout le reste passe normalement. Vite 8 (rolldown/oxc) n'expose pas de
 * drop-console au build : ce filtre runtime tient lieu de garde-console propre.
 */
const LOG_NOISE = [
  'THREE.WebGLRenderer: Context Lost.',
  'THREE.WebGLRenderer: Context Restored.',
];

const WARN_NOISE = [
  'THREE.Clock: This module has been deprecated.',
];

function startsWithNoise(args, needles) {
  return typeof args[0] === 'string' && needles.some(n => args[0].startsWith(n));
}

const originalLog = console.log.bind(console);
console.log = (...args) => {
  if (startsWithNoise(args, LOG_NOISE)) return;
  originalLog(...args);
};

const originalInfo = console.info.bind(console);
console.info = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('i18next') && args[0].includes('locize')) return;
  originalInfo(...args);
};

const originalWarn = console.warn.bind(console);
console.warn = (...args) => {
  if (startsWithNoise(args, WARN_NOISE)) return;
  originalWarn(...args);
};
