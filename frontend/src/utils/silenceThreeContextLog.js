/**
 * Filtre deux messages console de bibliothèques tierces qu'on ne peut pas couper
 * par configuration : le « Context Lost/Restored » de three.js (normal au démontage
 * d'un Canvas) et la pub Locize de i18next. Tout le reste passe normalement.
 */
const LOG_NOISE = [
  'THREE.WebGLRenderer: Context Lost.',
  'THREE.WebGLRenderer: Context Restored.',
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
