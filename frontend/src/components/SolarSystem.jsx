/**
 * Systeme solaire interactif — R3F.
 * Fond opaque (#020818) pour masquer les etoiles CSS du site.
 * Toutes les 8 planetes + Soleil + ceinture d'asteroides.
 * Echelle radiale en racine carree pour que les planetes internes soient lisibles.
 * Clic sur une planete : panneau d'info lateral avec navigation par fleches.
 * Boutons : Play/Pause + Plein ecran.
 * OrbitControls : rotation + zoom, auto-rotation lente.
 */
import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import {
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

/**
 * Orbites en echelle racine carree par rapport aux distances reelles en UA.
 * scale(r) = sqrt(r / 30.1) * 11  (Neptune = 11)
 */
const PLANETS = [
  { nameKey: 'solar.mercury', color: '#a0998a', emissive: '#1a1a1a', size: 0.09, orbit: 1.25, speed: 0.87, angle0: 0.0, moons: 0,   dist: '0.39 AU', year: 88,    temp: '+167°C', diameter: 4879,  type: 'rocky' },
  { nameKey: 'solar.venus',   color: '#d4a96a', emissive: '#4a2800', size: 0.15, orbit: 1.71, speed: 0.54, angle0: 0.8, moons: 0,   dist: '0.72 AU', year: 225,   temp: '+464°C', diameter: 12104, type: 'rocky' },
  { nameKey: 'solar.earth',   color: '#2979ff', emissive: '#0a2060', size: 0.16, orbit: 2.01, speed: 0.35, angle0: 1.6, moons: 1,   dist: '1.0 AU',  year: 365,   temp: '+15°C',  diameter: 12742, type: 'rocky' },
  { nameKey: 'solar.mars',    color: '#e05a2b', emissive: '#8b2500', size: 0.13, orbit: 2.47, speed: 0.19, angle0: 2.4, moons: 2,   dist: '1.52 AU', year: 687,   temp: '−55°C',  diameter: 6779,  type: 'rocky', highlight: true },
  { nameKey: 'solar.jupiter', color: '#c4a24d', emissive: '#3a2800', size: 0.42, orbit: 4.57, speed: 0.04, angle0: 3.2, moons: 95,  dist: '5.2 AU',  year: 4333,  temp: '−110°C', diameter: 139820, type: 'gas' },
  { nameKey: 'solar.saturn',  color: '#dcc88a', emissive: '#4a3a10', size: 0.33, orbit: 6.18, speed: 0.025,angle0: 4.0, moons: 146, dist: '9.5 AU',  year: 10759, temp: '−140°C', diameter: 116460, type: 'gas', rings: true },
  { nameKey: 'solar.uranus',  color: '#7de8e8', emissive: '#103a3a', size: 0.22, orbit: 8.78, speed: 0.018,angle0: 4.8, moons: 27,  dist: '19.2 AU', year: 30687, temp: '−195°C', diameter: 50724,  type: 'ice' },
  { nameKey: 'solar.neptune', color: '#3355dd', emissive: '#0a1a6a', size: 0.21, orbit: 11.0, speed: 0.014,angle0: 5.6, moons: 14,  dist: '30.1 AU', year: 60190, temp: '−200°C', diameter: 49244,  type: 'ice' },
];

const LABEL_STYLE = {
  fontFamily: "'Rajdhani', sans-serif",
  fontSize: '10px',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  textShadow: '0 1px 6px rgba(0,0,0,0.95)',
  letterSpacing: '0.06em',
};

/* ─── Soleil ─── */
function Sun({ elapsedRef, onSelect }) {
  const ref = useRef();
  useFrame(() => { if (ref.current) ref.current.rotation.y = elapsedRef.current * 0.08; });
  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[0.72, 32, 32]} />
        <meshStandardMaterial color="#ffaa00" emissive="#ff6600" emissiveIntensity={2.5} roughness={1} />
      </mesh>
      {/* Zone de detection invisible */}
      <mesh onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <sphereGeometry args={[0.95, 8, 8]} />
        <meshStandardMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh><sphereGeometry args={[1.0, 16, 16]} /><meshStandardMaterial color="#ffdd00" transparent opacity={0.07} side={THREE.BackSide} /></mesh>
      <mesh><sphereGeometry args={[1.5, 16, 16]} /><meshStandardMaterial color="#ff8800" transparent opacity={0.03} side={THREE.BackSide} /></mesh>
      <pointLight color="#ffd080" intensity={6} distance={80} />
      <Html distanceFactor={22} center position={[0, 1.15, 0]}>
        <span style={{ ...LABEL_STYLE, color: '#ffaa00', fontFamily: "'Orbitron',sans-serif", fontSize: '12px', fontWeight: 700, textShadow: '0 0 14px rgba(255,170,0,0.9)' }}>☀</span>
      </Html>
    </group>
  );
}

/* ─── Anneau orbital ─── */
function OrbitRing({ radius, highlighted, selected }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, selected ? 0.018 : highlighted ? 0.012 : 0.007, 4, 256]} />
      <meshStandardMaterial
        color={selected ? '#ffffff' : highlighted ? '#e05a2b' : '#38bdf8'}
        transparent
        opacity={selected ? 0.6 : highlighted ? 0.45 : 0.12}
      />
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

/* ─── Planete ─── */
function PlanetMesh({ planet, elapsedRef, selected, onSelect, t }) {
  const groupRef = useRef();

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
      {/* Zone de detection invisible (large) — clic pour selectionner */}
      <mesh onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <sphereGeometry args={[hitRadius, 8, 8]} />
        <meshStandardMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Sphere principale (visuelle) */}
      <mesh>
        <sphereGeometry args={[planet.size, 32, 32]} />
        <meshStandardMaterial
          color={planet.color} emissive={planet.emissive}
          emissiveIntensity={selected ? 0.8 : planet.highlight ? 0.45 : 0.18}
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

      {/* Anneau de selection anime */}
      {selected && <SelectionRing radius={planet.size * 2.5} color={accent} />}

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
          color: selected ? '#ffffff' : accent,
          fontFamily: planet.highlight ? "'Orbitron',sans-serif" : "'Rajdhani',sans-serif",
          fontSize: planet.highlight ? '12px' : selected ? '11px' : '10px',
          fontWeight: planet.highlight || selected ? 700 : 400,
          textShadow: selected ? '0 0 12px rgba(255,255,255,0.8)' : planet.highlight ? '0 0 12px rgba(224,90,43,0.9)' : LABEL_STYLE.textShadow,
          cursor: 'pointer',
        }}>{t(planet.nameKey)}</span>
      </Html>
    </group>
  );
}

/* ─── Scene complete ─── */
function SolarSystemScene({ isPausedRef, selectedIndex, onSelectPlanet, onSelectSun, t }) {
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
      <Sun elapsedRef={elapsedRef} onSelect={onSelectSun} />
      <AsteroidBelt />
      {PLANETS.map((p, i) => (
        <group key={p.nameKey}>
          <OrbitRing radius={p.orbit} highlighted={p.highlight} selected={selectedIndex === i} />
          <PlanetMesh
            planet={p}
            elapsedRef={elapsedRef}
            selected={selectedIndex === i}
            onSelect={() => onSelectPlanet(i)}
            t={t}
          />
        </group>
      ))}
    </>
  );
}

/* ─── Ligne d'info dans le panneau lateral ─── */
function InfoRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontFamily: "'Rajdhani',sans-serif" }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.92)', fontFamily: "'Rajdhani',sans-serif", fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}

/* ─── Panneau d'info lateral ─── */
function PlanetInfoPanel({ index, isSun, onPrev, onNext, onClose, t }) {
  if (index === null && !isSun) return null;

  const planet = isSun ? null : PLANETS[index];
  const accent = isSun ? '#ffaa00' : planet.highlight ? '#e05a2b' : planet.color;
  const name = isSun ? t('solar.sun') : t(planet.nameKey);

  return (
    <Box sx={{
      position: 'absolute',
      right: 0, top: 0, bottom: 0,
      width: { xs: '100%', sm: 250 },
      background: 'rgba(2, 8, 24, 0.92)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderLeft: '1px solid rgba(56,189,248,0.15)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      px: 2.5, py: 2,
      zIndex: 10,
    }}>
      {/* Navigation haut */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <IconButton
          size="small"
          onClick={onPrev}
          aria-label={t('solar.prev')}
          sx={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)', '&:hover': { color: '#38bdf8', borderColor: 'rgba(56,189,248,0.4)' } }}
        >
          <PrevIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.08em' }}>
          {isSun ? '☀' : `${index + 1} / ${PLANETS.length}`}
        </Typography>
        <IconButton
          size="small"
          onClick={onNext}
          aria-label={t('solar.next')}
          sx={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)', '&:hover': { color: '#38bdf8', borderColor: 'rgba(56,189,248,0.4)' } }}
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
          {isSun ? t('solar.type.star') : t(`solar.type.${planet.type}`)}
        </Typography>
      </Box>

      {/* Donnees */}
      <Box sx={{ mb: 2 }}>
        {isSun ? (
          <>
            <InfoRow label={t('solar.diameter')} value="1 392 700 km" />
            <InfoRow label={t('solar.temp')} value="+5 500°C" />
            <InfoRow label={t('solar.mass')} value={`333 000 × ${t('solar.earth')}`} />
          </>
        ) : (
          <>
            <InfoRow label={t('solar.distance')} value={planet.dist} />
            <InfoRow label={t('solar.year')} value={`${planet.year.toLocaleString()} ${t('solar.days')}`} />
            <InfoRow label={t('solar.moons')} value={String(planet.moons)} />
            <InfoRow label={t('solar.temp')} value={planet.temp} />
            <InfoRow label={t('solar.diameter')} value={`${planet.diameter.toLocaleString()} km`} />
          </>
        )}
      </Box>

      {/* Bouton fermer */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
        <IconButton
          size="small"
          onClick={onClose}
          aria-label={t('solar.close')}
          sx={{ color: 'rgba(255,255,255,0.35)', '&:hover': { color: 'rgba(255,255,255,0.7)' } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}

/* ─── Export ─── */
export default function SolarSystem() {
  const { t } = useTranslation();
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [isSunSelected, setIsSunSelected] = useState(false);
  const containerRef = useRef(null);

  const hasSelection = selectedIndex !== null || isSunSelected;

  const handleSelectPlanet = useCallback((i) => {
    setSelectedIndex(i);
    setIsSunSelected(false);
  }, []);

  const handleSelectSun = useCallback(() => {
    setIsSunSelected(true);
    setSelectedIndex(null);
  }, []);

  const handleDeselect = useCallback(() => {
    setSelectedIndex(null);
    setIsSunSelected(false);
  }, []);

  const handlePrev = useCallback(() => {
    if (isSunSelected) {
      setIsSunSelected(false);
      setSelectedIndex(PLANETS.length - 1);
    } else if (selectedIndex === 0) {
      setSelectedIndex(null);
      setIsSunSelected(true);
    } else if (selectedIndex !== null) {
      setSelectedIndex(i => i - 1);
    }
  }, [isSunSelected, selectedIndex]);

  const handleNext = useCallback(() => {
    if (isSunSelected) {
      setIsSunSelected(false);
      setSelectedIndex(0);
    } else if (selectedIndex === PLANETS.length - 1) {
      setSelectedIndex(null);
      setIsSunSelected(true);
    } else if (selectedIndex !== null) {
      setSelectedIndex(i => i + 1);
    }
  }, [isSunSelected, selectedIndex]);

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

  /* Navigation clavier */
  useEffect(() => {
    if (!hasSelection) return;
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
      }}
    >
      <Canvas camera={{ position: [0, 10, 14], fov: 52 }} gl={{ antialias: true }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.03} />
        <Stars radius={150} depth={70} count={6000} factor={2} saturation={0} />
        <SolarSystemScene
          isPausedRef={isPausedRef}
          selectedIndex={selectedIndex}
          onSelectPlanet={handleSelectPlanet}
          onSelectSun={handleSelectSun}
          t={t}
        />
        <OrbitControls
          enablePan={false} enableZoom
          minDistance={4} maxDistance={35}
          minPolarAngle={Math.PI / 12} maxPolarAngle={Math.PI / 2.05}
          autoRotate={!isPaused} autoRotateSpeed={0.35}
        />
      </Canvas>

      {/* Panneau info lateral */}
      {hasSelection && (
        <PlanetInfoPanel
          index={selectedIndex}
          isSun={isSunSelected}
          onPrev={handlePrev}
          onNext={handleNext}
          onClose={handleDeselect}
          t={t}
        />
      )}

      {/* Hint cliquable (quand rien n'est selectionne) */}
      {!hasSelection && (
        <Box sx={{
          position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
          pointerEvents: 'none', textAlign: 'center',
        }}>
          <Typography sx={{
            fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)',
            fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.04em',
          }}>
            {t('solar.clickHint')}
          </Typography>
        </Box>
      )}

      {/* Boutons overlay */}
      <Box sx={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 0.5, zIndex: 11 }}>
        <Tooltip title={isPaused ? t('solar.resume') : t('solar.pause')} placement="right">
          <IconButton
            size="small"
            onClick={handlePause}
            aria-label={isPaused ? t('solar.resume') : t('solar.pause')}
            sx={{ backgroundColor: 'rgba(13,27,64,0.85)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8', '&:hover': { backgroundColor: 'rgba(56,189,248,0.15)' } }}
          >
            {isPaused ? <PlayIcon fontSize="small" /> : <PauseIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Tooltip title={isFullscreen ? t('solar.exitFullscreen') : t('solar.fullscreen')} placement="right">
          <IconButton
            size="small"
            onClick={handleFullscreen}
            aria-label={isFullscreen ? t('solar.exitFullscreen') : t('solar.fullscreen')}
            sx={{ backgroundColor: 'rgba(13,27,64,0.85)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8', '&:hover': { backgroundColor: 'rgba(56,189,248,0.15)' } }}
          >
            {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
