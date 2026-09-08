/**
 * Doublures de la pile 3D (@react-three/fiber, drei, postprocessing, troika).
 *
 * jsdom n'a pas de WebGL : monter un vrai `<Canvas>` echoue avant le premier
 * rendu, et la scene entiere — neuf planetes, leurs lunes, la comete, les
 * sondes, le panneau d'information — resterait sans aucun test.
 *
 * Le parti pris : `Canvas` rend ses ENFANTS dans un div ordinaire. Les
 * composants de scene s'executent donc reellement (leurs `useMemo`, leurs
 * calculs d'orbite, leurs callbacks de selection), et seul le dessin GPU
 * disparait. Les balises R3F minuscules (`<mesh>`, `<sphereGeometry>`) sont
 * remplacees par des `<div>` : React DOM ne les connait pas et se plaindrait
 * de chacun de leurs attributs.
 */
import { forwardRef, useEffect } from 'react';
import * as THREE from 'three';

/** Balises intrinsèques de three.js rencontrées dans la scène. */
const BALISES_R3F = [
  'mesh', 'group', 'points', 'line', 'lineSegments', 'sprite', 'instancedMesh',
  'sphereGeometry', 'boxGeometry', 'ringGeometry', 'circleGeometry', 'planeGeometry',
  'torusGeometry', 'bufferGeometry', 'bufferAttribute', 'tubeGeometry',
  'meshStandardMaterial', 'meshBasicMaterial', 'meshPhongMaterial',
  'meshPhysicalMaterial', 'pointsMaterial', 'lineBasicMaterial', 'spriteMaterial',
  'shaderMaterial', 'ambientLight', 'pointLight', 'directionalLight',
  'hemisphereLight', 'spotLight', 'primitive', 'color', 'fog',
];

/**
 * Enregistre les balises R3F comme composants globaux impossibles.
 * On ne peut pas « declarer » une balise minuscule pour JSX : c'est le
 * transformeur qui decide. On neutralise donc plutot les avertissements que
 * React emet pour ces elements inconnus (voir `silenceR3F`).
 */
export const R3F_TAGS = BALISES_R3F;

/** Avale les avertissements React propres aux balises three.js. */
export function silenceR3F() {
  const warn = console.error;
  console.error = (...args) => {
    const m = typeof args[0] === 'string' ? args[0] : '';
    if (/is unrecognized in this browser|non-boolean attribute|Invalid DOM property|for a non-boolean attribute|React does not recognize/i.test(m)) return;
    warn(...args);
  };
  return () => { console.error = warn; };
}

/* ── @react-three/fiber ───────────────────────────────────────────────── */

export const fiberStub = {
  Canvas: forwardRef(function Canvas({ children, ...props }, ref) {
    return <div ref={ref} data-testid="r3f-canvas" data-camera={JSON.stringify(props.camera ?? null)}>{children}</div>;
  }),
  /**
   * `useFrame` appelle son rappel a CHAQUE image dans R3F. Ne rien faire
   * laisserait toute la mecanique orbitale (positions, rotations, trainees,
   * suivi de camera) hors de portee des tests. On l'appelle donc quelques fois
   * apres le montage, avec un etat plausible : assez pour executer le calcul
   * et les franchissements, sans simuler une boucle infinie.
   */
  useFrame: (rappel) => {
    useEffect(() => {
      // TROIS images, a des instants ecartes : une seule ne suffit pas pour
      // les effets qui dependent d'un franchissement (une planete qui boucle
      // son orbite declenche une note de la sonification). Les rappels sont
      // tous parametres par le temps, un saut ne les gene pas.
      for (const t of [0.016, 12, 90]) {
        const etat = {
          clock: { getElapsedTime: () => t, elapsedTime: t },
          camera: {
            position: new THREE.Vector3(0, 10, 20),
            lookAt: () => {},
            updateProjectionMatrix: () => {},
          },
          scene: new THREE.Scene(),
          size: { width: 800, height: 600 },
          gl: { domElement: document.createElement('canvas') },
          // `OrbitControls` publie ses controles dans l'etat R3F : le suivi
          // de camera (FocusRig) sort immediatement sans eux.
          controls: {
            target: new THREE.Vector3(),
            update() {},
            object: { position: new THREE.Vector3(0, 10, 20) },
          },
        };
        try { rappel(etat, 0.016); } catch { /* refs pas encore posees */ }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
  },
  useThree: () => ({
    camera: { position: { set: () => {}, lerp: () => {} }, lookAt: () => {} },
    gl: { domElement: document.createElement('canvas') },
    scene: {},
    size: { width: 800, height: 600 },
  }),
  extend: () => {},
  invalidate: () => {},
};

/* ── @react-three/drei ────────────────────────────────────────────────── */

const passeplat = (nom) => function Passeplat({ children }) {
  return <div data-drei={nom}>{children}</div>;
};

export const dreiStub = {
  OrbitControls: passeplat('OrbitControls'),
  Stars: passeplat('Stars'),
  Billboard: passeplat('Billboard'),
  Trail: passeplat('Trail'),
  // Le texte 3D porte son contenu : c'est la seule chose lisible d'une scene
  // sans GPU, et les etiquettes de planetes doivent etre traduites.
  Text: function Text({ children, ...p }) {
    return <span data-drei="Text" data-color={p.color}>{children}</span>;
  },
  // Le globe de l'accueil parcourt la scene chargee (`traverse`), la
  // recentre et la met a l'echelle via Box3 : il lui faut donc un VRAI objet
  // three.js, pas un objet nu. three tourne sans GPU, seul le rendu en a besoin.
  useGLTF: Object.assign(
    () => {
      const scene = new THREE.Group();
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: '#c1440e' }),
      );
      scene.add(mesh);
      return { scene, nodes: { mesh }, materials: { mat: mesh.material } };
    },
    { preload: () => {} },
  ),
  Html: passeplat('Html'),
  Environment: passeplat('Environment'),
};

/* ── @react-three/postprocessing ──────────────────────────────────────── */

export const postprocessingStub = {
  EffectComposer: passeplat('EffectComposer'),
  Bloom: passeplat('Bloom'),
  Vignette: passeplat('Vignette'),
};

/* ── troika-three-text ────────────────────────────────────────────────── */

export const troikaStub = {
  configureTextBuilder: () => {},
  preloadFont: () => {},
  Text: class {},
};
