/**
 * Systeme solaire interactif — R3F.
 * Fond opaque (#020818) pour masquer les etoiles CSS du site.
 * 8 planetes + 2 planetes naines (Pluton, Ceres) + Soleil + 2 ceintures
 * (asteroides & Kuiper) + troyens de Jupiter (L4/L5) + lunes principales +
 * comete Siding Spring (queue anti-solaire douce, cliquable) + sonde ExoMars
 * TGO + sondes Voyager en echappement.
 * Echelle radiale en racine carree pour que les planetes internes soient lisibles.
 * Rendu : textures procedurales (planetTextures.js) + bloom selectif +
 * atmospheres additives + terminateur jour/nuit (lumiere radiale sans falloff).
 * Clic sur un corps : panneau d'info lateral avec navigation par fleches.
 * Vitesse du temps + Play/Pause + sonification (musique des spheres) + plein ecran.
 * OrbitControls : rotation + zoom, auto-rotation lente.
 */
import { useRef, useState, useMemo, useEffect, useCallback, createRef } from 'react';
import { Link } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Billboard, Text, Trail } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { configureTextBuilder } from 'troika-three-text';

/* Generation des glyphes SDF sur le thread principal : le worker de troika
   passe par des URL blob: (creation PUIS importScripts interne) que la CSP
   stricte du backend bloque — la section restait figee sur son fallback sur
   :8080. Neuf etiquettes courtes ne justifient pas d'affaiblir script-src.
   NB : @react-three/postprocessing n'utilise AUCUN worker pour Bloom (le seul
   worker de la lib sert au sur-echantillonnage de LUT, jamais appele ici). */
configureTextBuilder({ useWorker: false });
import * as THREE from 'three';
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import {
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Close as CloseIcon,
  ZoomOutMap as ViewFullIcon,
  CenterFocusStrong as ViewInnerIcon,
  TravelExplore as ExploreClimateIcon,
  FastForward as SpeedIcon,
  VolumeUp as SoundOnIcon,
  VolumeOff as SoundOffIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { makePlanetTexture, makeEarthTexture, makeSunTexture } from '../utils/planetTextures';

/**
 * Orbites en echelle racine carree par rapport aux distances reelles en UA.
 * scale(r) = sqrt(r / 30.1) * 11  (Neptune = 11)
 * Champs enrichis : tilt (inclinaison d'axe, rad), spin (rotation propre
 * visuelle, signe = sens), gravity (m/s²), massEarth (× Terre), velocity
 * (km/s), composition (formules chimiques, non traduites), sats (lunes visibles).
 */
const PLANETS = [
  {
    nameKey: 'solar.mercury', color: '#a0998a', emissive: '#1a1a1a', size: 0.09, orbit: 1.25, speed: 0.87, angle0: 0.0,
    moons: 0, dist: '0.39 AU', year: 88, temp: '+167°C', diameter: 4879, type: 'rocky',
    tilt: 0.03, spin: 0.05, gravity: 3.7, massEarth: 0.055, velocity: 47.4, composition: 'Fe, Ni, Si', sats: [],
  },
  {
    nameKey: 'solar.venus', color: '#d4a96a', emissive: '#4a2800', size: 0.15, orbit: 1.71, speed: 0.54, angle0: 0.8,
    moons: 0, dist: '0.72 AU', year: 225, temp: '+464°C', diameter: 12104, type: 'rocky',
    tilt: 3.09, spin: -0.02, gravity: 8.9, massEarth: 0.815, velocity: 35.0, composition: 'CO₂, N₂', sats: [],
  },
  {
    nameKey: 'solar.earth', color: '#2979ff', emissive: '#0a2060', size: 0.16, orbit: 2.01, speed: 0.35, angle0: 1.6,
    moons: 1, dist: '1.0 AU', year: 365, temp: '+15°C', diameter: 12742, type: 'rocky', earth: true,
    tilt: 0.41, spin: 0.3, gravity: 9.8, massEarth: 1, velocity: 29.8, composition: 'N₂, O₂',
    atmosphere: '#5aa9ff',
    sats: [{ labelKey: 'solar.moon', size: 0.045, orbit: 0.32, speed: 2.2, color: '#cfcfcf' }],
  },
  {
    nameKey: 'solar.mars', color: '#e05a2b', emissive: '#8b2500', size: 0.13, orbit: 2.47, speed: 0.19, angle0: 2.4,
    moons: 2, dist: '1.52 AU', year: 687, temp: '−55°C', diameter: 6779, type: 'rocky', highlight: true,
    tilt: 0.44, spin: 0.29, gravity: 3.7, massEarth: 0.107, velocity: 24.1, composition: 'CO₂, Ar, N₂',
    atmosphere: '#e0703a',
    sats: [
      { label: 'Phobos', size: 0.02, orbit: 0.24, speed: 3.4, color: '#8a7a6a' },
      { label: 'Deimos', size: 0.016, orbit: 0.34, speed: 2.4, color: '#9a8a7a' },
    ],
  },
  {
    nameKey: 'solar.jupiter', color: '#c4a24d', emissive: '#3a2800', size: 0.42, orbit: 4.57, speed: 0.04, angle0: 3.2,
    moons: 95, dist: '5.2 AU', year: 4333, temp: '−110°C', diameter: 139820, type: 'gas',
    tilt: 0.05, spin: 0.7, gravity: 24.8, massEarth: 318, velocity: 13.1, composition: 'H₂, He',
    sats: [
      { label: 'Io', size: 0.05, orbit: 0.62, speed: 1.9, color: '#e8d27a' },
      { label: 'Europa', size: 0.045, orbit: 0.76, speed: 1.5, color: '#d8c8b0' },
      { label: 'Ganymede', size: 0.06, orbit: 0.92, speed: 1.15, color: '#a89a86' },
      { label: 'Callisto', size: 0.055, orbit: 1.08, speed: 0.9, color: '#7a6f60' },
    ],
  },
  {
    nameKey: 'solar.saturn', color: '#dcc88a', emissive: '#4a3a10', size: 0.33, orbit: 6.18, speed: 0.025, angle0: 4.0,
    moons: 146, dist: '9.5 AU', year: 10759, temp: '−140°C', diameter: 116460, type: 'gas', rings: true,
    tilt: 0.47, spin: 0.65, gravity: 10.4, massEarth: 95, velocity: 9.7, composition: 'H₂, He',
    sats: [{ label: 'Titan', size: 0.06, orbit: 0.78, speed: 0.85, color: '#e0a94a' }],
  },
  {
    nameKey: 'solar.uranus', color: '#7de8e8', emissive: '#103a3a', size: 0.22, orbit: 8.78, speed: 0.018, angle0: 4.8,
    moons: 27, dist: '19.2 AU', year: 30687, temp: '−195°C', diameter: 50724, type: 'ice',
    tilt: 1.71, spin: -0.4, gravity: 8.9, massEarth: 14.5, velocity: 6.8, composition: 'H₂, He, CH₄',
    atmosphere: '#a6f0f0', sats: [],
  },
  {
    nameKey: 'solar.neptune', color: '#3355dd', emissive: '#0a1a6a', size: 0.21, orbit: 11.0, speed: 0.014, angle0: 5.6,
    moons: 14, dist: '30.1 AU', year: 60190, temp: '−200°C', diameter: 49244, type: 'ice',
    tilt: 0.49, spin: 0.45, gravity: 11.2, massEarth: 17, velocity: 5.4, composition: 'H₂, He, CH₄',
    atmosphere: '#5a78ff', sats: [],
  },
  /* ─ Planetes naines ─ */
  {
    nameKey: 'solar.pluto', color: '#c9b39a', emissive: '#241a12', size: 0.055, orbit: 12.2, speed: 0.011, angle0: 0.5,
    moons: 5, dist: '39.5 AU', year: 90560, temp: '−229°C', diameter: 2377, type: 'rocky', dwarf: true,
    tilt: 2.13, spin: 0.1, gravity: 0.62, massEarth: 0.0022, velocity: 4.7, composition: 'N₂, CH₄, CO', sats: [],
  },
  {
    nameKey: 'solar.ceres', color: '#8f8574', emissive: '#1a1712', size: 0.04, orbit: 3.02, speed: 0.16, angle0: 2.0,
    moons: 0, dist: '2.77 AU', year: 1682, temp: '−105°C', diameter: 940, type: 'rocky', dwarf: true,
    tilt: 0.07, spin: 0.5, gravity: 0.27, massEarth: 0.00016, velocity: 17.9, composition: 'H₂O, SiO₂', sats: [],
  },
];

/* Comète Siding Spring (C/2013 A1) : objet sélectionnable, hors du tableau
   PLANETS. En octobre 2014 elle a frôlé Mars — d'où sa présence ici. */
const COMET = { name: 'Siding Spring', designation: 'C/2013 A1' };

const LABEL_FONT = '/fonts/rajdhani-labels.ttf';

/* ─── Sonification : « musique des sphères ». Web Audio pur (aucun réseau, aucun
   worker → compatible CSP). Une note par orbite bouclée ; toutes les hauteurs
   appartiennent à la gamme pentatonique de do (do/ré/mi/sol/la) donc chaque
   combinaison reste consonante. Interne haute, externe grave. ─── */
let audioCtx = null;
function ensureAudio() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function playNote(freq, gainPeak = 0.08) {
  try {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 1.2);
  } catch { /* audio indisponible : on ignore silencieusement */ }
}
// Mer, Vén, Ter, Mars, Jup, Sat, Ura, Nep, Plu, Cérès — toutes pentatoniques
const PLANET_NOTES = [880.0, 783.99, 659.25, 587.33, 130.81, 110.0, 98.0, 82.41, 261.63, 440.0];

/* Directions d'échappement (unitaires) des sondes Voyager, hors du plan. */
const VOYAGER_1_DIR = [0.5416, 0.8123, -0.2166];
const VOYAGER_2_DIR = [-0.6656, -0.4992, 0.5547];

/* Petite texture radiale douce, utilisée pour les bouffées de la queue de
   comète (points ronds et progressifs, jamais de carrés durs ni d'arêtes de
   cône). Générée une fois, hors-ligne (CanvasTexture, pas de blob → CSP-safe). */
let SOFT_DOT = null;
function softDot() {
  if (SOFT_DOT) return SOFT_DOT;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(220,240,255,0.7)');
  g.addColorStop(0.7, 'rgba(150,200,255,0.15)');
  g.addColorStop(1, 'rgba(150,200,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  SOFT_DOT = new THREE.CanvasTexture(c);
  return SOFT_DOT;
}

/* Texture des anneaux de Saturne : fines bandes concentriques (particules),
   fondu aux deux bords et division de Cassini. Generee hors-ligne
   (CanvasTexture → CSP-safe). RingGeometry projette la texture a plat (UV
   planaire), donc les cercles concentriques deviennent des anneaux. Le rayon
   normalise rr correspond a g/outer ; l'anneau visible occupe rr ∈ [IR, 1]. */
let RING_TEX = null;
const RING_IR = 0.583;   // inner/outer de la RingGeometry (doit correspondre au mesh)
function ringTexture() {
  if (RING_TEX) return RING_TEX;
  if (typeof document === 'undefined') return null;
  const S = 256, R = S / 2;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, S, S);
  for (let r = 0; r < R; r++) {
    const rr = r / R;
    if (rr < RING_IR) continue;                                  // trou central
    let a = Math.sin((rr - RING_IR) / (1 - RING_IR) * Math.PI);  // fondu aux deux bords
    if (rr > 0.80 && rr < 0.85) a *= 0.30;                       // division de Cassini
    a *= 0.5 + 0.5 * Math.sin(rr * 150);                         // grain fin (particules)
    a = Math.max(0, a) * 0.95;
    const tone = 205 + Math.round(35 * Math.sin(rr * 60));       // beige variable
    ctx.strokeStyle = `rgba(${tone}, ${tone - 25}, ${Math.round(tone * 0.62)}, ${a})`;
    ctx.beginPath();
    ctx.arc(R, R, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  RING_TEX = new THREE.CanvasTexture(c);
  return RING_TEX;
}

/* ─── Soleil ─── */
function Sun({ elapsedRef, onSelect, texture, t }) {
  const ref = useRef();
  const coronaRef = useRef();
  useFrame(() => {
    if (ref.current) ref.current.rotation.y = elapsedRef.current * 0.08;
    if (coronaRef.current) {
      const s = 1 + Math.sin(elapsedRef.current * 1.5) * 0.03;
      coronaRef.current.scale.setScalar(s);
    }
  });
  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[0.72, 48, 48]} />
        <meshStandardMaterial
          map={texture || null}
          color="#ffb020"
          emissive="#ff7a00"
          emissiveMap={texture || null}
          emissiveIntensity={1.05}
          roughness={1}
        />
      </mesh>
      {/* Zone de detection invisible */}
      <mesh onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <sphereGeometry args={[0.95, 8, 8]} />
        <meshStandardMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Couronne pulsante + UN seul halo additif discret. Le grand halo
          externe (r=1.35) est retire et les autres attenues : le Soleil
          debordait de lumiere sur toute la scene. */}
      <mesh ref={coronaRef}>
        <sphereGeometry args={[0.82, 24, 24]} />
        <meshBasicMaterial color="#ffcc55" transparent opacity={0.05} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh><sphereGeometry args={[1.02, 20, 20]} /><meshBasicMaterial color="#ffaa33" transparent opacity={0.018} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
      {/* Lumière radiale SANS atténuation (decay 0) : chaque planète reçoit
          le Soleil de la même façon quelle que soit sa distance → un vrai
          terminateur jour/nuit, même sur Neptune, sans assombrir les lointaines. */}
      <pointLight color="#fff0d0" intensity={2.4} decay={0} />
      {/* Etiquette = nom du Soleil (caracteres latins, couverts par la police
          locale). NB : ne PAS utiliser le glyphe ☀ ici — absent du sous-ensemble
          de police, troika tenterait de le resoudre via un CDN que la CSP bloque. */}
      <Billboard position={[0, 1.2, 0]}>
        <Text font={LABEL_FONT} fontSize={0.15} color="#ffb020" anchorX="center" anchorY="bottom" outlineWidth={0.012} outlineColor="#020818" outlineOpacity={0.9} letterSpacing={0.05}>
          {t('solar.sun')}
        </Text>
      </Billboard>
    </group>
  );
}

/* ─── Atmosphere additive (rim glow doux, revele par le bloom) ─── */
function Atmosphere({ radius, color }) {
  return (
    <>
      <mesh>
        <sphereGeometry args={[radius * 1.08, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.16} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.22, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.07} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </>
  );
}

/* ─── Anneau orbital ─── */
function OrbitRing({ radius, highlighted, selected, dwarf }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, selected ? 0.018 : highlighted ? 0.012 : 0.007, 4, 256]} />
      <meshBasicMaterial
        color={selected ? '#ffffff' : highlighted ? '#e05a2b' : dwarf ? '#7a6f9a' : '#38bdf8'}
        transparent
        opacity={selected ? 0.6 : highlighted ? 0.45 : dwarf ? 0.1 : 0.12}
      />
    </mesh>
  );
}

/* ─── Ceinture (asteroides & Kuiper) — parametrable ─── */
function Belt({ inner, spread, count, ySpread, size, color, opacity, seed }) {
  const positions = useMemo(() => {
    // PRNG deterministe (mulberry32) : rendu pur et identique entre montages.
    let s = seed | 0;
    const rand = () => {
      s = (s + 0x6d2b79f5) | 0;
      let z = Math.imul(s ^ (s >>> 15), 1 | s);
      z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
    const pts = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const r = inner + rand() * spread;
      pts[i * 3] = Math.cos(angle) * r;
      pts[i * 3 + 1] = (rand() - 0.5) * ySpread;
      pts[i * 3 + 2] = Math.sin(angle) * r;
    }
    return pts;
  }, [inner, spread, count, ySpread, seed]);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={size} color={color} sizeAttenuation transparent opacity={opacity} />
    </points>
  );
}

/* ─── Anneau de selection anime ─── */
function SelectionRing({ radius, color }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.material.opacity = 0.3 + Math.sin(t * 3) * 0.2;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.02, 8, 64]} />
      <meshStandardMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ─── Lune ─── */
function MoonMesh({ moon, elapsedRef }) {
  const ref = useRef();
  useFrame(() => {
    if (!ref.current) return;
    const a = elapsedRef.current * moon.speed + (moon.phase || 0);
    ref.current.position.set(Math.cos(a) * moon.orbit, Math.sin(a * 1.3) * 0.03, Math.sin(a) * moon.orbit);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[moon.size, 16, 16]} />
      <meshStandardMaterial color={moon.color} emissive={moon.color} emissiveIntensity={0.04} roughness={0.9} />
    </mesh>
  );
}

/* ─── Sonde ExoMars TGO en orbite de Mars — le clin d'oeil BIRA-IASB ─── */
function MarsProbe({ elapsedRef }) {
  const ref = useRef();
  useFrame(() => {
    if (!ref.current) return;
    const a = elapsedRef.current * 1.6;
    ref.current.position.set(Math.cos(a) * 0.42, Math.sin(a * 0.7) * 0.12, Math.sin(a) * 0.42);
    ref.current.rotation.y = a;
  });
  return (
    <group ref={ref}>
      <mesh><boxGeometry args={[0.03, 0.03, 0.05]} /><meshStandardMaterial color="#dfe6ee" emissive="#88aaff" emissiveIntensity={0.7} metalness={0.6} roughness={0.3} /></mesh>
      <mesh position={[0.055, 0, 0]}><boxGeometry args={[0.06, 0.002, 0.032]} /><meshStandardMaterial color="#2a4a7a" emissive="#22406a" emissiveIntensity={0.4} /></mesh>
      <mesh position={[-0.055, 0, 0]}><boxGeometry args={[0.06, 0.002, 0.032]} /><meshStandardMaterial color="#2a4a7a" emissive="#22406a" emissiveIntensity={0.4} /></mesh>
      <Billboard position={[0, 0.09, 0]}>
        <Text font={LABEL_FONT} fontSize={0.072} color="#9fc4ff" anchorX="center" anchorY="bottom" outlineWidth={0.008} outlineColor="#020818" outlineOpacity={0.95}>
          ExoMars TGO
        </Text>
      </Billboard>
    </group>
  );
}

/* ─── Comète Siding Spring — orbite elliptique inclinée.
   Sa queue pointe TOUJOURS à l'opposé du Soleil (placé à l'origine), comme dans
   la réalité : le vent solaire repousse poussière et gaz. Détail rarement
   respecté dans les maquettes web, où la « queue » suit bêtement le mouvement. */
function Comet({ elapsedRef, onSelect, selected }) {
  const groupRef = useRef();   // position de la tête
  const tailRef = useRef();    // pivote pour rester anti-solaire
  const [hovered, setHovered] = useState(false);
  const tailTex = useMemo(() => softDot(), []);
  const tmpDir = useMemo(() => new THREE.Vector3(), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);
  const UP = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const a = elapsedRef.current * 0.12 + 1.0;
    g.position.set(Math.cos(a) * 9.5 - 2.6, Math.sin(a) * 1.4, Math.sin(a) * 4.6);
    if (tailRef.current) {
      tmpDir.copy(g.position).normalize();      // Soleil → tête = direction anti-solaire
      tmpQuat.setFromUnitVectors(UP, tmpDir);   // aligne l'axe +Y de la queue sur l'anti-solaire
      tailRef.current.quaternion.copy(tmpQuat);
    }
  });
  return (
    <group ref={groupRef}>
      {/* Noyau + coma */}
      <mesh>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#eafcff" emissive="#8fe9ff" emissiveIntensity={selected ? 2 : 1.3} roughness={0.4} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color="#bff2ff" transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Zone de détection (clic = panneau d'info) */}
      <mesh
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = ''; }}
      >
        <sphereGeometry args={[0.34, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Queue anti-solaire (toujours à l'opposé du Soleil) : chapelet de
          bouffées douces qui rétrécissent et s'estompent, souple et sans arêtes.
          +Y local est réorienté chaque frame vers l'anti-solaire. */}
      <group ref={tailRef}>
        {Array.from({ length: 16 }).map((_, i) => {
          const f = i / 15;
          const y = 0.08 + f * 2.7;
          const s = 0.22 * (1 - 0.68 * f) + 0.02;
          const o = 0.22 * (1 - f) ** 1.4;
          return (
            <sprite key={i} position={[0, y, 0]} scale={[s, s, s]}>
              <spriteMaterial map={tailTex} color={i < 3 ? '#eafcff' : '#9fd6ff'} transparent opacity={o} blending={THREE.AdditiveBlending} depthWrite={false} />
            </sprite>
          );
        })}
      </group>
      {(hovered || selected) && (
        <Billboard position={[0, 0.22, 0]}>
          <Text font={LABEL_FONT} fontSize={0.1} color="#bff2ff" anchorX="center" anchorY="bottom" outlineWidth={0.009} outlineColor="#020818" outlineOpacity={0.95} letterSpacing={0.04}>
            {COMET.name}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

/* ─── Astéroïdes troyens de Jupiter (résonance orbitale 1:1) : deux essaims
   « verrouillés » 60° devant (L4) et 60° derrière (L5) Jupiter, co-orbitaux
   avec elle. On en connaît des dizaines de milliers, mais presque aucune
   maquette web ne les montre. ─── */
function TrojanSwarm({ elapsedRef }) {
  const ref = useRef();
  const jup = useMemo(() => PLANETS.find((p) => p.nameKey === 'solar.jupiter'), []);
  useFrame(() => { if (ref.current) ref.current.rotation.y = -elapsedRef.current * jup.speed; });
  const clusters = useMemo(() => {
    const make = (centerAngle, seed) => {
      let s = seed | 0;
      const rand = () => {
        s = (s + 0x6d2b79f5) | 0;
        let z = Math.imul(s ^ (s >>> 15), 1 | s);
        z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
        return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
      };
      const n = 140;
      const pts = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const ang = centerAngle + (rand() - 0.5) * 0.5;
        const r = jup.orbit + (rand() - 0.5) * 0.6;
        pts[i * 3] = Math.cos(ang) * r;
        pts[i * 3 + 1] = (rand() - 0.5) * 0.28;
        pts[i * 3 + 2] = Math.sin(ang) * r;
      }
      return pts;
    };
    return { l4: make(jup.angle0 + Math.PI / 3, 0x51ed270b), l5: make(jup.angle0 - Math.PI / 3, 0x2545f491) };
  }, [jup]);
  const labelPos = (sign) => [Math.cos(jup.angle0 + sign * Math.PI / 3) * jup.orbit, 0.4, Math.sin(jup.angle0 + sign * Math.PI / 3) * jup.orbit];
  return (
    <group ref={ref}>
      {['l4', 'l5'].map((k) => (
        <points key={k}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[clusters[k], 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.05} color="#8a7f6a" sizeAttenuation transparent opacity={0.7} />
        </points>
      ))}
      {/* Repères de Lagrange (L4/L5 : notation scientifique universelle, ASCII) */}
      <Billboard position={labelPos(1)}>
        <Text font={LABEL_FONT} fontSize={0.11} color="#b9ad90" anchorX="center" anchorY="bottom" outlineWidth={0.008} outlineColor="#020818" outlineOpacity={0.9}>L4</Text>
      </Billboard>
      <Billboard position={labelPos(-1)}>
        <Text font={LABEL_FONT} fontSize={0.11} color="#b9ad90" anchorX="center" anchorY="bottom" outlineWidth={0.008} outlineColor="#020818" outlineOpacity={0.9}>L5</Text>
      </Billboard>
    </group>
  );
}

/* ─── Sonde en trajectoire d'échappement (Voyager) : dérive lente et
   rectiligne vers l'extérieur, puis boucle. Étiquette au survol. ─── */
function Probe({ elapsedRef, dir, phase, speed, label }) {
  const ref = useRef();
  const [hovered, setHovered] = useState(false);
  useFrame(() => {
    if (!ref.current) return;
    const d = 6 + ((elapsedRef.current * speed + phase) % 22);   // rayon de départ + boucle
    ref.current.position.set(dir[0] * d, dir[1] * d, dir[2] * d);
  });
  return (
    <group ref={ref}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = ''; }}
      >
        <boxGeometry args={[0.06, 0.02, 0.06]} />
        <meshStandardMaterial color="#cfd6e0" emissive="#8899bb" emissiveIntensity={0.5} metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Antenne parabolique */}
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshStandardMaterial color="#e8eef6" emissive="#aab4c6" emissiveIntensity={0.4} metalness={0.5} roughness={0.5} />
      </mesh>
      {hovered && (
        <Billboard position={[0, 0.14, 0]}>
          <Text font={LABEL_FONT} fontSize={0.09} color="#dfe7f2" anchorX="center" anchorY="bottom" outlineWidth={0.008} outlineColor="#020818" outlineOpacity={0.95}>
            {label}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

/* ─── Planete ─── */
function PlanetMesh({ planet, elapsedRef, selected, hovered, onSelect, onHover, groupRef, texture, heavy, t }) {
  const spinRef = useRef();
  useFrame(() => {
    if (groupRef.current) {
      const angle = planet.angle0 + elapsedRef.current * planet.speed;
      groupRef.current.position.x = Math.cos(angle) * planet.orbit;
      groupRef.current.position.z = Math.sin(angle) * planet.orbit;
    }
    if (spinRef.current) spinRef.current.rotation.y = elapsedRef.current * planet.spin;
  });

  const accent = planet.highlight ? '#e05a2b' : planet.color;
  const hitRadius = Math.max(planet.size * 3.5, 0.32);
  // Les etiquettes n'apparaissent qu'au survol ou a la selection (Mars reste
  // toujours nommee) : pres du Soleil, neuf etiquettes permanentes se
  // chevauchaient et rendaient la scene illisible.
  const showLabel = planet.highlight || selected || hovered;

  const sphere = (
    <mesh ref={spinRef} rotation={[0, 0, planet.tilt]}>
      <sphereGeometry args={[planet.size, 32, 32]} />
      <meshStandardMaterial
        map={texture || null}
        color={texture ? '#ffffff' : planet.color}
        emissive={planet.emissive}
        emissiveIntensity={selected ? 0.34 : planet.highlight ? 0.2 : 0.06}
        roughness={0.82}
        metalness={0.05}
      />
      {/* Anneaux Saturne : disque PLAT (RingGeometry) texture, pas un tore.
          Un torus donnait un tube facette ; ici bandes concentriques + Cassini,
          solidaires de l'inclinaison de l'axe. */}
      {planet.rings && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[planet.size * 1.4, planet.size * 2.4, 96]} />
          <meshBasicMaterial
            map={ringTexture()}
            color="#efe0b8"
            transparent
            opacity={0.92}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </mesh>
  );

  return (
    <group ref={groupRef}>
      {/* Zone de detection invisible (large) — clic pour selectionner */}
      <mesh
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { onHover(false); document.body.style.cursor = ''; }}
      >
        <sphereGeometry args={[hitRadius, 8, 8]} />
        <meshStandardMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Sphere principale (texturee) + trainee orbitale.
          Trainee reservee aux planetes internes rapides : les geantes externes
          bougent trop lentement pour qu'une trainee soit lisible, et leur point
          d'origine mettrait des secondes a se vider (artefact « rayon »). */}
      {heavy && !planet.dwarf && planet.speed >= 0.15
        ? <Trail width={planet.size * 6} length={4} color={new THREE.Color(accent)} attenuation={(w) => w}>{sphere}</Trail>
        : sphere}

      {/* Atmosphere / glow */}
      {planet.atmosphere && <Atmosphere radius={planet.size} color={planet.atmosphere} />}
      {planet.highlight && (
        <>
          <mesh><sphereGeometry args={[planet.size * 2.2, 16, 16]} /><meshBasicMaterial color="#e05a2b" transparent opacity={0.09} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
          <pointLight color="#e05a2b" intensity={0.6} distance={2.0} />
        </>
      )}

      {/* Lunes principales */}
      {planet.sats.map((moon, mi) => (
        <MoonMesh key={moon.label || moon.labelKey || mi} moon={moon} elapsedRef={elapsedRef} />
      ))}

      {/* Sonde ExoMars autour de Mars */}
      {planet.highlight && <MarsProbe elapsedRef={elapsedRef} />}

      {/* Anneau de selection anime */}
      {selected && <SelectionRing radius={planet.size * 2.5} color={accent} />}

      {/* Label WebGL (drei Text) : aucun reflow HTML par frame */}
      {showLabel && (
        <Billboard position={[0, planet.size + 0.24, 0]}>
          <Text
            font={LABEL_FONT}
            fontSize={planet.highlight ? 0.17 : 0.13}
            color={selected ? '#ffffff' : accent}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.011}
            outlineColor="#020818"
            outlineOpacity={0.95}
            letterSpacing={0.05}
          >
            {t(planet.nameKey)}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

/* ─── Scene complete ─── */
function SolarSystemScene({ isPausedRef, timeScaleRef, selectedIndex, hoveredIndex, onSelectPlanet, onHoverPlanet, onSelectSun, onSelectComet, cometSelected, soundOnRef, planetRefs, textures, sunTexture, heavy, t }) {
  const elapsedRef = useRef(0);
  const prevClockRef = useRef(null);
  const lapsRef = useRef(null);   // nombre d'orbites bouclées par planète (sonification)

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    if (!isPausedRef.current) {
      if (prevClockRef.current !== null) elapsedRef.current += (now - prevClockRef.current) * timeScaleRef.current;
    }
    prevClockRef.current = now;

    // Sonification : une note à chaque orbite complétée. On tient les compteurs
    // à jour même son coupé, pour ne pas déclencher une salve en réactivant.
    const lapOf = (p) => Math.floor((p.angle0 + elapsedRef.current * p.speed) / (Math.PI * 2));
    if (lapsRef.current === null) {
      lapsRef.current = PLANETS.map(lapOf);
    } else {
      for (let i = 0; i < PLANETS.length; i++) {
        const lap = lapOf(PLANETS[i]);
        if (lap !== lapsRef.current[i]) {
          if (soundOnRef.current) playNote(PLANET_NOTES[i]);
          lapsRef.current[i] = lap;
        }
      }
    }
  });

  return (
    <>
      <Sun elapsedRef={elapsedRef} onSelect={onSelectSun} texture={sunTexture} t={t} />
      <Belt inner={2.75} spread={0.8} count={1200} ySpread={0.22} size={0.045} color="#9a8878" opacity={0.75} seed={0x9e3779b9} />
      <Belt inner={12.4} spread={1.8} count={900} ySpread={0.5} size={0.05} color="#6a7a9a" opacity={0.4} seed={0x1b873593} />
      <TrojanSwarm elapsedRef={elapsedRef} />
      <Comet elapsedRef={elapsedRef} onSelect={onSelectComet} selected={cometSelected} />
      <Probe elapsedRef={elapsedRef} dir={VOYAGER_1_DIR} phase={2} speed={0.5} label="Voyager 1" />
      <Probe elapsedRef={elapsedRef} dir={VOYAGER_2_DIR} phase={11} speed={0.44} label="Voyager 2" />
      {PLANETS.map((p, i) => (
        <group key={p.nameKey}>
          <OrbitRing radius={p.orbit} highlighted={p.highlight} selected={selectedIndex === i} dwarf={p.dwarf} />
          <PlanetMesh
            planet={p}
            elapsedRef={elapsedRef}
            selected={selectedIndex === i}
            hovered={hoveredIndex === i}
            onSelect={() => onSelectPlanet(i)}
            onHover={(v) => onHoverPlanet(v ? i : null)}
            groupRef={planetRefs[i]}
            texture={textures[i]}
            heavy={heavy}
            t={t}
          />
        </group>
      ))}
      <FocusRig selectedIndex={selectedIndex} planetRefs={planetRefs} />
    </>
  );
}

/* ─── Focus camera : la cible des controles glisse en douceur vers la planete
   choisie (et la suit sur son orbite), puis revient au Soleil a la fermeture.
   Interpolation exponentielle independante du framerate. ─── */
function FocusRig({ selectedIndex, planetRefs }) {
  const targetVec = useMemo(() => new THREE.Vector3(), []);
  useFrame((state, delta) => {
    const controls = state.controls;
    if (!controls) return;
    const focused = selectedIndex !== null ? planetRefs[selectedIndex]?.current : null;
    if (focused) focused.getWorldPosition(targetVec);
    else targetVec.set(0, 0, 0);
    controls.target.lerp(targetVec, 1 - Math.exp(-3.5 * delta));
  });
  return null;
}

/* ─── Ligne d'info dans le panneau lateral ─── */
function InfoRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, py: 0.45, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: "'Rajdhani',sans-serif", flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-primary)', fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, textAlign: 'right' }}>{value}</Typography>
    </Box>
  );
}

/* ─── Panneau d'info lateral ─── */
function PlanetInfoPanel({ index, isSun, isComet, onPrev, onNext, onClose, t }) {
  if (index === null && !isSun && !isComet) return null;

  const planet = (isSun || isComet) ? null : PLANETS[index];
  const accent = isComet ? '#8fd8ff' : isSun ? '#ffaa00' : planet.highlight ? '#e05a2b' : planet.color;
  const name = isComet ? COMET.name : isSun ? t('solar.sun') : t(planet.nameKey);
  const typeKey = isComet ? 'solar.type.comet' : isSun ? 'solar.type.star' : planet.dwarf ? 'solar.type.dwarf' : `solar.type.${planet.type}`;
  const moonNames = planet && planet.sats.length
    ? planet.sats.map((m) => (m.labelKey ? t(m.labelKey) : m.label)).join(', ')
    : null;

  return (
    <Box sx={{
      position: 'absolute',
      right: 0, top: 0, bottom: 0,
      width: { xs: '100%', sm: 260 },
      background: 'var(--bg-surface)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderLeft: '1px solid rgba(56,189,248,0.15)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      px: 2.5, py: 2,
      zIndex: 10,
      overflowY: 'auto',
    }}>
      {/* Navigation haut */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <IconButton
          size="small"
          onClick={onPrev}
          aria-label={t('solar.prev')}
          sx={{ color: 'var(--text-secondary)', border: '1px solid var(--glass-border)', '&:hover': { color: '#38bdf8', borderColor: 'rgba(56,189,248,0.4)' } }}
        >
          <PrevIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.08em' }}>
          {isSun ? '☀' : isComet ? '☄' : `${index + 1} / ${PLANETS.length}`}
        </Typography>
        <IconButton
          size="small"
          onClick={onNext}
          aria-label={t('solar.next')}
          sx={{ color: 'var(--text-secondary)', border: '1px solid var(--glass-border)', '&:hover': { color: '#38bdf8', borderColor: 'rgba(56,189,248,0.4)' } }}
        >
          <NextIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Indicateur couleur + nom */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.5 }}>
        <Box sx={{
          width: 14, height: 14, borderRadius: '50%',
          backgroundColor: accent,
          boxShadow: `0 0 12px ${accent}`,
          flexShrink: 0,
        }} />
        <Typography sx={{
          fontFamily: "'Orbitron',sans-serif",
          fontSize: '1.05rem',
          fontWeight: 700,
          color: accent,
          letterSpacing: '0.02em',
        }}>
          {name}
        </Typography>
      </Box>

      {/* Type badge */}
      <Box sx={{ mb: 2 }}>
        <Typography component="span" sx={{
          display: 'inline-block',
          fontSize: '0.65rem',
          fontFamily: "'Rajdhani',sans-serif",
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: accent,
          backgroundColor: `${accent}18`,
          border: `1px solid ${accent}40`,
          borderRadius: 1,
          px: 1, py: 0.2,
        }}>
          {t(typeKey)}
        </Typography>
      </Box>

      {/* Donnees */}
      <Box sx={{ mb: 2 }}>
        {isComet ? (
          <>
            <InfoRow label={t('solar.designation')} value={COMET.designation} />
            <InfoRow label={t('solar.closestMars')} value="≈ 140 000 km" />
          </>
        ) : isSun ? (
          <>
            <InfoRow label={t('solar.diameter')} value="1 392 700 km" />
            <InfoRow label={t('solar.temp')} value="+5 500°C" />
            <InfoRow label={t('solar.gravity')} value="274 m/s²" />
            <InfoRow label={t('solar.mass')} value={`333 000 × ${t('solar.earth')}`} />
            <InfoRow label={t('solar.composition')} value="H, He" />
          </>
        ) : (
          <>
            <InfoRow label={t('solar.distance')} value={planet.dist} />
            <InfoRow
              label={t('solar.year')}
              value={planet.year >= 1000
                ? `${(planet.year / 365).toFixed(planet.year / 365 < 10 ? 1 : 0)} ${t('solar.earthYears')}`
                : `${planet.year.toLocaleString()} ${t('solar.days')}`}
            />
            <InfoRow label={t('solar.velocity')} value={`${planet.velocity} km/s`} />
            <InfoRow label={t('solar.gravity')} value={`${planet.gravity} m/s²`} />
            <InfoRow label={t('solar.temp')} value={planet.temp} />
            <InfoRow label={t('solar.diameter')} value={`${planet.diameter.toLocaleString()} km`} />
            <InfoRow label={t('solar.mass')} value={`${planet.massEarth} × ${t('solar.earth')}`} />
            <InfoRow label={t('solar.composition')} value={planet.composition} />
            <InfoRow label={t('solar.moons')} value={String(planet.moons)} />
            {moonNames && <InfoRow label={t('solar.majorMoons')} value={moonNames} />}
          </>
        )}
      </Box>

      {/* Comète : le récit de son frôlement de Mars en 2014 */}
      {isComet && (
        <Typography sx={{
          fontSize: '0.7rem', lineHeight: 1.5, color: 'var(--text-secondary)',
          fontFamily: "'Rajdhani',sans-serif", mb: 1.5,
          borderLeft: '2px solid rgba(143,216,255,0.5)', pl: 1,
        }}>
          {t('solar.cometNote')}
        </Typography>
      )}

      {/* Mars : le clin d'oeil BIRA-IASB + la passerelle vers l'outil */}
      {planet?.highlight && (
        <>
          <Typography sx={{
            fontSize: '0.7rem', lineHeight: 1.5, color: 'var(--text-secondary)',
            fontFamily: "'Rajdhani',sans-serif", mb: 1.5,
            borderLeft: '2px solid rgba(224,90,43,0.5)', pl: 1,
          }}>
            {t('solar.marsProbe')}
          </Typography>
          <Button
            component={Link}
            to="/explore"
            size="small"
            variant="outlined"
            fullWidth
            startIcon={<ExploreClimateIcon sx={{ fontSize: 16 }} />}
            sx={{
              mb: 1, textTransform: 'none', fontWeight: 600,
              borderColor: 'rgba(224, 90, 43, 0.5)', color: '#ff8a55',
              '&:hover': { borderColor: '#e05a2b', background: 'rgba(224, 90, 43, 0.12)' },
            }}
          >
            {t('solar.exploreClimate')}
          </Button>
        </>
      )}

      {/* Bouton fermer */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
        <IconButton
          size="small"
          onClick={onClose}
          aria-label={t('solar.close')}
          sx={{ color: 'var(--text-secondary)', '&:hover': { color: 'var(--text-primary)' } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}

/* ─── Export ─── */

/** Positions caméra : vue par défaut cadrée sur le système interne (Mars
 *  lisible dès l'arrivée), vue complète jusqu'à Pluton en option. */
const CAMERA_VIEWS = { inner: [0, 5.2, 6.6], full: [0, 11, 15] };
const MARS_INDEX = PLANETS.findIndex((p) => p.highlight);
const TIME_STEPS = [1, 5, 20];

export default function SolarSystem() {
  const { t } = useTranslation();
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [isSunSelected, setIsSunSelected] = useState(false);
  const [isCometSelected, setIsCometSelected] = useState(false);
  const [viewFull, setViewFull] = useState(false);
  const [timeStep, setTimeStep] = useState(0);
  const timeScaleRef = useRef(1);
  const [soundOn, setSoundOn] = useState(false);
  const soundOnRef = useRef(false);
  const containerRef = useRef(null);
  const controlsRef = useRef(null);
  /* Une ref par planete : FocusRig lit leur position monde a chaque frame */
  const planetRefs = useMemo(() => PLANETS.map(() => createRef()), []);

  /* Textures procedurales generees une fois (deterministes, hors-ligne). */
  const textures = useMemo(
    () => PLANETS.map((p, i) => (p.earth ? makeEarthTexture() : makePlanetTexture({ base: p.color, type: p.type, seed: i + 3 }))),
    [],
  );
  const sunTexture = useMemo(() => makeSunTexture(), []);

  /* Effets lourds (bloom + trainees) reserves aux ecrans confortables et
     desactives si l'utilisateur demande moins d'animations. */
  const heavy = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return !reduce && window.innerWidth >= 640;
  }, []);

  const hasSelection = selectedIndex !== null || isSunSelected || isCometSelected;

  /* Rendu suspendu quand la section est hors écran : le canvas ne consomme
     ni CPU ni GPU pendant que l'utilisateur lit le reste de la page. */
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '120px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const toggleView = useCallback(() => {
    setViewFull((v) => {
      const next = !v;
      const cam = controlsRef.current?.object;
      if (cam) {
        cam.position.set(...CAMERA_VIEWS[next ? 'full' : 'inner']);
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
      return next;
    });
  }, []);

  const cycleTimeStep = useCallback(() => {
    setTimeStep((s) => {
      const next = (s + 1) % TIME_STEPS.length;
      timeScaleRef.current = TIME_STEPS[next];
      return next;
    });
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((s) => {
      const next = !s;
      soundOnRef.current = next;
      if (next) ensureAudio();   // débloque le contexte audio (geste utilisateur requis)
      return next;
    });
  }, []);

  const handleSelectPlanet = useCallback((i) => {
    setSelectedIndex(i);
    setIsSunSelected(false);
    setIsCometSelected(false);
  }, []);

  const handleSelectSun = useCallback(() => {
    setIsSunSelected(true);
    setSelectedIndex(null);
    setIsCometSelected(false);
  }, []);

  const handleSelectComet = useCallback(() => {
    setIsCometSelected(true);
    setSelectedIndex(null);
    setIsSunSelected(false);
  }, []);

  const handleDeselect = useCallback(() => {
    setSelectedIndex(null);
    setIsSunSelected(false);
    setIsCometSelected(false);
  }, []);

  /* Cycle de navigation : Soleil → planètes/naines → comète → (retour) Soleil. */
  const handlePrev = useCallback(() => {
    if (isSunSelected) {
      setIsSunSelected(false);
      setIsCometSelected(true);
    } else if (isCometSelected) {
      setIsCometSelected(false);
      setSelectedIndex(PLANETS.length - 1);
    } else if (selectedIndex === 0) {
      setSelectedIndex(null);
      setIsSunSelected(true);
    } else if (selectedIndex !== null) {
      setSelectedIndex((i) => i - 1);
    }
  }, [isSunSelected, isCometSelected, selectedIndex]);

  const handleNext = useCallback(() => {
    if (isSunSelected) {
      setIsSunSelected(false);
      setSelectedIndex(0);
    } else if (isCometSelected) {
      setIsCometSelected(false);
      setIsSunSelected(true);
    } else if (selectedIndex === PLANETS.length - 1) {
      setSelectedIndex(null);
      setIsCometSelected(true);
    } else if (selectedIndex !== null) {
      setSelectedIndex((i) => i + 1);
    }
  }, [isSunSelected, isCometSelected, selectedIndex]);

  const handlePause = () => {
    isPausedRef.current = !isPausedRef.current;
    setIsPaused((p) => !p);
  };

  const handleFullscreen = () => {
    // Les deux API rendent une promesse qui REJETTE quand le navigateur
    // refuse (hors geste utilisateur, iframe sans allow="fullscreen", Safari
    // sur iPhone) : sans le `.catch`, le refus part en unhandled rejection
    // dans la console du visiteur. FullscreenButton le fait deja.
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  /* Navigation clavier */
  useEffect(() => {
    if (!hasSelection) return undefined;
    const handler = (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); handleNext(); }
      if (e.key === 'Escape') { e.preventDefault(); handleDeselect(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasSelection, handlePrev, handleNext, handleDeselect]);

  return (
    <Box
      ref={containerRef}
      sx={{
        height: { xs: 380, md: 520 },
        position: 'relative',
        borderRadius: isFullscreen ? 0 : 3,
        overflow: 'hidden',
        background: '#020818',
        cursor: 'grab',
        '&:active': { cursor: 'grabbing' },
        border: '1px solid rgba(56,189,248,0.12)',
        /* Controles discrets : reveles au survol ou au focus clavier,
           toujours visibles quand le survol n'existe pas (tactile) */
        '& .mcv-solar-controls': { opacity: 0, transition: 'opacity 0.25s ease' },
        '&:hover .mcv-solar-controls, &:focus-within .mcv-solar-controls': { opacity: 1 },
        '@media (hover: none)': { '& .mcv-solar-controls': { opacity: 1 } },
      }}
    >
      <Canvas
        camera={{ position: CAMERA_VIEWS.inner, fov: 52 }}
        gl={{ antialias: true }}
        dpr={[1, 1.5]}
        frameloop={inView ? 'always' : 'never'}
      >
        <ambientLight intensity={0.16} />
        <Stars radius={150} depth={70} count={7000} factor={2.4} saturation={0.15} fade speed={0.6} />
        <SolarSystemScene
          isPausedRef={isPausedRef}
          timeScaleRef={timeScaleRef}
          selectedIndex={selectedIndex}
          hoveredIndex={hoveredIndex}
          onSelectPlanet={handleSelectPlanet}
          onHoverPlanet={setHoveredIndex}
          onSelectSun={handleSelectSun}
          onSelectComet={handleSelectComet}
          cometSelected={isCometSelected}
          soundOnRef={soundOnRef}
          planetRefs={planetRefs}
          textures={textures}
          sunTexture={sunTexture}
          heavy={heavy}
          t={t}
        />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan={false} enableZoom
          minDistance={4} maxDistance={38}
          minPolarAngle={Math.PI / 12} maxPolarAngle={Math.PI / 2.05}
          autoRotate={!isPaused && !hasSelection} autoRotateSpeed={0.35}
        />
        {heavy && (
          <EffectComposer disableNormalPass>
            <Bloom intensity={0.22} luminanceThreshold={0.5} luminanceSmoothing={0.9} mipmapBlur radius={0.42} />
          </EffectComposer>
        )}
      </Canvas>

      {/* Panneau info lateral */}
      {hasSelection && (
        <PlanetInfoPanel
          index={selectedIndex}
          isSun={isSunSelected}
          isComet={isCometSelected}
          onPrev={handlePrev}
          onNext={handleNext}
          onClose={handleDeselect}
          t={t}
        />
      )}

      {/* Acces direct a Mars + hint (quand rien n'est selectionne) */}
      {!hasSelection && (
        <Box sx={{
          position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
          textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.7,
        }}>
          <Box
            component="button"
            onClick={() => handleSelectPlanet(MARS_INDEX)}
            sx={{
              all: 'unset', boxSizing: 'border-box', cursor: 'pointer',
              px: 1.6, py: 0.45, borderRadius: 100,
              border: '1px solid rgba(224, 90, 43, 0.5)',
              background: 'rgba(224, 90, 43, 0.12)', color: '#ff8a55',
              fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem',
              fontWeight: 600, letterSpacing: '0.07em',
              transition: 'background 0.15s, border-color 0.15s',
              '&:hover': { background: 'rgba(224, 90, 43, 0.24)', borderColor: '#e05a2b' },
              '&:focus-visible': { outline: '2px solid #38bdf8', outlineOffset: 1 },
            }}
          >
            {t('solar.goToMars')}
          </Box>
          <Typography sx={{
            /* 0,3 d'opacite donnait 2,05:1 sur le fond etoile (mesure au pixel) :
               c'est la seule phrase qui explique qu'une planete se clique, elle
               doit se lire. 0,55 la laisse discrete a environ 6:1. */
            fontSize: '0.68rem', color: 'rgba(255,255,255,0.55)',
            fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.04em', pointerEvents: 'none',
          }}>
            {t('solar.clickHint')}
          </Typography>
        </Box>
      )}

      {/* Boutons overlay */}
      <Box className="mcv-solar-controls" sx={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 0.5, zIndex: 11 }}>
        <Tooltip title={isPaused ? t('solar.resume') : t('solar.pause')} placement="right">
          <IconButton
            size="small"
            onClick={handlePause}
            aria-label={isPaused ? t('solar.resume') : t('solar.pause')}
            sx={{ backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8', '&:hover': { backgroundColor: 'rgba(56,189,248,0.15)' } }}
          >
            {isPaused ? <PlayIcon fontSize="small" /> : <PauseIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Tooltip title={`${t('solar.timeSpeed')} : ×${TIME_STEPS[timeStep]}`} placement="right">
          <IconButton
            size="small"
            onClick={cycleTimeStep}
            aria-label={`${t('solar.timeSpeed')} : ×${TIME_STEPS[timeStep]}`}
            sx={{
              backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8',
              minWidth: 34, gap: 0.2, '&:hover': { backgroundColor: 'rgba(56,189,248,0.15)' },
            }}
          >
            <SpeedIcon sx={{ fontSize: 15 }} />
            <Typography component="span" sx={{ fontSize: '0.6rem', fontWeight: 700, fontFamily: "'Rajdhani',sans-serif" }}>{TIME_STEPS[timeStep]}</Typography>
          </IconButton>
        </Tooltip>
        <Tooltip title={soundOn ? t('solar.soundOff') : t('solar.soundOn')} placement="right">
          <IconButton
            size="small"
            onClick={toggleSound}
            aria-label={soundOn ? t('solar.soundOff') : t('solar.soundOn')}
            aria-pressed={soundOn}
            sx={{ backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(56,189,248,0.2)', color: soundOn ? '#8fe9ff' : '#38bdf8', '&:hover': { backgroundColor: 'rgba(56,189,248,0.15)' } }}
          >
            {soundOn ? <SoundOnIcon fontSize="small" /> : <SoundOffIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Tooltip title={isFullscreen ? t('solar.exitFullscreen') : t('solar.fullscreen')} placement="right">
          <IconButton
            size="small"
            onClick={handleFullscreen}
            aria-label={isFullscreen ? t('solar.exitFullscreen') : t('solar.fullscreen')}
            sx={{ backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8', '&:hover': { backgroundColor: 'rgba(56,189,248,0.15)' } }}
          >
            {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Tooltip title={viewFull ? t('solar.viewInner') : t('solar.viewFull')} placement="right">
          <IconButton
            size="small"
            onClick={toggleView}
            aria-label={viewFull ? t('solar.viewInner') : t('solar.viewFull')}
            sx={{ backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8', '&:hover': { backgroundColor: 'rgba(56,189,248,0.15)' } }}
          >
            {viewFull ? <ViewInnerIcon fontSize="small" /> : <ViewFullIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
