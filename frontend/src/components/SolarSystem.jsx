/**
 * Systeme solaire interactif — R3F.
 * Fond opaque (#020818) pour masquer les etoiles CSS du site.
 * Toutes les 8 planetes + Soleil + ceinture d'asteroides.
 * Echelle radiale en racine carree pour que les planetes internes soient lisibles.
 * Hover : zones agrandies (sphere invisible 4x). Tooltip glassmorphism au survol.
 * Boutons : Play/Pause + Plein ecran.
 * OrbitControls : rotation + zoom, auto-rotation lente.
 */
import { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { Box, IconButton, Tooltip } from '@mui/material';
import {
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';

/**
 * Orbites en echelle racine carree par rapport aux distances reelles en UA.
 * scale(r) = sqrt(r / 30.1) * 11  (Neptune = 11)
 */
const PLANETS = [
  { name: 'Mercure', color: '#a0998a', emissive: '#1a1a1a', size: 0.09, orbit: 1.25, speed: 0.87, angle0: 0.0, moons: 0,   dist: '0,39 UA', year: 88,    temp: '+167\u00b0C' },
  { name: 'Venus',   color: '#d4a96a', emissive: '#4a2800', size: 0.15, orbit: 1.71, speed: 0.54, angle0: 0.8, moons: 0,   dist: '0,72 UA', year: 225,   temp: '+464\u00b0C' },
  { name: 'Terre',   color: '#2979ff', emissive: '#0a2060', size: 0.16, orbit: 2.01, speed: 0.35, angle0: 1.6, moons: 1,   dist: '1,0 UA',  year: 365,   temp: '+15\u00b0C'  },
  { name: 'Mars',    color: '#e05a2b', emissive: '#8b2500', size: 0.13, orbit: 2.47, speed: 0.19, angle0: 2.4, moons: 2,   dist: '1,52 UA', year: 687,   temp: '\u221255\u00b0C', highlight: true },
  { name: 'Jupiter', color: '#c4a24d', emissive: '#3a2800', size: 0.42, orbit: 4.57, speed: 0.04, angle0: 3.2, moons: 95,  dist: '5,2 UA',  year: 4333,  temp: '\u2212110\u00b0C' },
  { name: 'Saturne', color: '#dcc88a', emissive: '#4a3a10', size: 0.33, orbit: 6.18, speed: 0.025,angle0: 4.0, moons: 146, dist: '9,5 UA',  year: 10759, temp: '\u2212140\u00b0C', rings: true },
  { name: 'Uranus',  color: '#7de8e8', emissive: '#103a3a', size: 0.22, orbit: 8.78, speed: 0.018,angle0: 4.8, moons: 27,  dist: '19,2 UA', year: 30687, temp: '\u2212195\u00b0C' },
  { name: 'Neptune', color: '#3355dd', emissive: '#0a1a6a', size: 0.21, orbit: 11.0, speed: 0.014,angle0: 5.6, moons: 14,  dist: '30,1 UA', year: 60190, temp: '\u2212200\u00b0C' },
];

const LABEL_STYLE = {
  fontFamily: "'Rajdhani', sans-serif",
  fontSize: '10px',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  textShadow: '0 1px 6px rgba(0,0,0,0.95)',
  letterSpacing: '0.06em',
};

const TOOLTIP_BASE = {
  background: 'rgba(13, 27, 64, 0.97)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  borderRadius: '10px',
  padding: '10px 14px',
  minWidth: '148px',
  color: 'rgba(255,255,255,0.95)',
  fontFamily: "'Rajdhani', sans-serif",
  fontSize: '12px',
  pointerEvents: 'none',
  boxShadow: '0 6px 28px rgba(0,0,0,0.8)',
  lineHeight: 1.65,
};

/* ─── Soleil ─── */
function Sun({ elapsedRef }) {
  const ref = useRef();
  useFrame(() => { if (ref.current) ref.current.rotation.y = elapsedRef.current * 0.08; });
  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[0.72, 32, 32]} />
        <meshStandardMaterial color="#ffaa00" emissive="#ff6600" emissiveIntensity={2.5} roughness={1} />
      </mesh>
      <mesh><sphereGeometry args={[1.0, 16, 16]} /><meshStandardMaterial color="#ffdd00" transparent opacity={0.07} side={THREE.BackSide} /></mesh>
      <mesh><sphereGeometry args={[1.5, 16, 16]} /><meshStandardMaterial color="#ff8800" transparent opacity={0.03} side={THREE.BackSide} /></mesh>
      <pointLight color="#ffd080" intensity={6} distance={80} />
      <Html distanceFactor={22} center position={[0, 1.15, 0]}>
        <span style={{ ...LABEL_STYLE, color: '#ffaa00', fontFamily: "'Orbitron',sans-serif", fontSize: '12px', fontWeight: 700, textShadow: '0 0 14px rgba(255,170,0,0.9)' }}>Soleil</span>
      </Html>
    </group>
  );
}

/* ─── Anneau orbital ─── */
function OrbitRing({ radius, highlighted }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, highlighted ? 0.012 : 0.007, 4, 256]} />
      <meshStandardMaterial color={highlighted ? '#e05a2b' : '#38bdf8'} transparent opacity={highlighted ? 0.45 : 0.12} />
    </mesh>
  );
}

/* ─── Ceinture d'asteroides ─── */
function AsteroidBelt() {
  const positions = useMemo(() => {
    const pts = new Float32Array(1200 * 3);
    for (let i = 0; i < 1200; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 3.15 + (Math.random() - 0.5) * 0.8;
      pts[i * 3]     = Math.cos(angle) * r;
      pts[i * 3 + 1] = (Math.random() - 0.5) * 0.22;
      pts[i * 3 + 2] = Math.sin(angle) * r;
    }
    return pts;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.045} color="#9a8878" sizeAttenuation transparent opacity={0.75} />
    </points>
  );
}

/* ─── Planete ─── */
function PlanetMesh({ planet, elapsedRef }) {
  const groupRef = useRef();
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (!groupRef.current) return;
    const angle = planet.angle0 + elapsedRef.current * planet.speed;
    groupRef.current.position.x = Math.cos(angle) * planet.orbit;
    groupRef.current.position.z = Math.sin(angle) * planet.orbit;
  });

  const accent = planet.highlight ? '#e05a2b' : planet.color;
  const hitRadius = Math.max(planet.size * 3.5, 0.32);

  return (
    <group ref={groupRef}>
      {/* Zone de detection invisible (large) */}
      <mesh onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        <sphereGeometry args={[hitRadius, 8, 8]} />
        <meshStandardMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Sphere principale (visuelle) */}
      <mesh>
        <sphereGeometry args={[planet.size, 32, 32]} />
        <meshStandardMaterial
          color={planet.color} emissive={planet.emissive}
          emissiveIntensity={hovered ? 0.7 : planet.highlight ? 0.45 : 0.18}
          roughness={0.8}
        />
      </mesh>

      {/* Glow Mars */}
      {planet.highlight && (
        <>
          <mesh><sphereGeometry args={[planet.size * 2.2, 16, 16]} /><meshStandardMaterial color="#e05a2b" transparent opacity={0.08} side={THREE.BackSide} /></mesh>
          <mesh><sphereGeometry args={[planet.size * 3.6, 16, 16]} /><meshStandardMaterial color="#ff4400" transparent opacity={0.03} side={THREE.BackSide} /></mesh>
          <pointLight color="#e05a2b" intensity={0.8} distance={2.0} />
        </>
      )}

      {/* Anneaux Saturne */}
      {planet.rings && (
        <>
          <mesh rotation={[Math.PI / 3.2, 0, 0]}>
            <torusGeometry args={[planet.size * 1.75, planet.size * 0.28, 4, 64]} />
            <meshStandardMaterial color="#d4c070" transparent opacity={0.65} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[Math.PI / 3.2, 0, 0]}>
            <torusGeometry args={[planet.size * 2.2, planet.size * 0.1, 4, 64]} />
            <meshStandardMaterial color="#b8a848" transparent opacity={0.35} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}

      {/* Label */}
      <Html distanceFactor={22} center position={[0, planet.size + 0.22, 0]}>
        <span style={{
          ...LABEL_STYLE,
          color: accent,
          fontFamily: planet.highlight ? "'Orbitron',sans-serif" : "'Rajdhani',sans-serif",
          fontSize: planet.highlight ? '12px' : '10px',
          fontWeight: planet.highlight ? 700 : 400,
          textShadow: planet.highlight ? '0 0 12px rgba(224,90,43,0.9)' : LABEL_STYLE.textShadow,
        }}>{planet.name}</span>
      </Html>

      {/* Tooltip */}
      {hovered && (
        <Html distanceFactor={22} center position={[0, planet.size + 1.0, 0]}>
          <div style={{ ...TOOLTIP_BASE, border: `1px solid ${planet.highlight ? 'rgba(224,90,43,0.6)' : 'rgba(56,189,248,0.4)'}` }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: '11px', fontWeight: 700, color: accent, marginBottom: 6 }}>{planet.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>Distance  &middot; {planet.dist}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>Ann&eacute;e    &middot; {planet.year}&thinsp;j.</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>Lunes     &middot; {planet.moons}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>Temp.     &middot; {planet.temp}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

/* ─── Scene complete ─── */
function SolarSystemScene({ isPausedRef }) {
  const elapsedRef = useRef(0);
  const prevClockRef = useRef(null);

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    if (!isPausedRef.current) {
      if (prevClockRef.current !== null) elapsedRef.current += now - prevClockRef.current;
    }
    prevClockRef.current = now;
  });

  return (
    <>
      <Sun elapsedRef={elapsedRef} />
      <AsteroidBelt />
      {PLANETS.map(p => (
        <group key={p.name}>
          <OrbitRing radius={p.orbit} highlighted={p.highlight} />
          <PlanetMesh planet={p} elapsedRef={elapsedRef} />
        </group>
      ))}
    </>
  );
}

/* ─── Export ─── */
export default function SolarSystem() {
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  const handlePause = () => {
    isPausedRef.current = !isPausedRef.current;
    setIsPaused(p => !p);
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

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
      }}
    >
      <Canvas camera={{ position: [0, 10, 14], fov: 52 }} gl={{ antialias: true }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.03} />
        <Stars radius={150} depth={70} count={6000} factor={2} saturation={0} />
        <SolarSystemScene isPausedRef={isPausedRef} />
        <OrbitControls
          enablePan={false} enableZoom
          minDistance={4} maxDistance={35}
          minPolarAngle={Math.PI / 12} maxPolarAngle={Math.PI / 2.05}
          autoRotate={!isPaused} autoRotateSpeed={0.35}
        />
      </Canvas>

      {/* Boutons overlay */}
      <Box sx={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 0.5 }}>
        <Tooltip title={isPaused ? 'Reprendre' : 'Pause'} placement="left">
          <IconButton size="small" onClick={handlePause} sx={{ backgroundColor: 'rgba(13,27,64,0.85)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8', '&:hover': { backgroundColor: 'rgba(56,189,248,0.15)' } }}>
            {isPaused ? <PlayIcon fontSize="small" /> : <PauseIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Tooltip title={isFullscreen ? 'Quitter le plein ecran' : 'Plein ecran'} placement="left">
          <IconButton size="small" onClick={handleFullscreen} sx={{ backgroundColor: 'rgba(13,27,64,0.85)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8', '&:hover': { backgroundColor: 'rgba(56,189,248,0.15)' } }}>
            {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
