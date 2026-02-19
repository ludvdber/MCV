/**
 * Page d'accueil — Mars Climate Viewer.
 *
 * Sections :
 * 1. Hero       — titre gradient, DatasetSelector, Mars 3D, 2 CTA
 * 2. Pourquoi ? — pull-quote + 3 raisons scientifiques
 * 3. Systeme solaire — R3F interactif (SolarSystem.jsx)
 * 4. Feature Showcase — 5 cartes d'acces direct aux vues
 * 5. Stats animees — 4 compteurs (countUp au scroll)
 * 6. Timeline — histoire de l'exploration martienne
 * 7. CTA final
 */
import { useRef, useMemo, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  Box, Container, Typography, Button, Paper, Chip,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { alpha } from '@mui/material/styles';
import {
  KeyboardArrowDown as ChevronIcon,
  RocketLaunch as RocketIcon,
  FormatQuote as QuoteIcon,
  WaterDrop as WaterIcon,
  Explore as ExploreIcon,
  Science as ScienceIcon,
  GridOn as SliceIcon,
  PlayCircleOutline as AnimationIcon,
  ShowChart as TimeSeriesIcon,
  AlignVerticalBottom as ProfileIcon,
  CropFree as CrossSectionIcon,
  ArrowForward as ArrowIcon,
  OpenInFull as ExploreAllIcon,
} from '@mui/icons-material';
import { homeContent } from '../content/home.fr';
import { useMars } from '../context/MarsContext';
import { useReveal } from '../hooks/useReveal';
import DatasetSelector from '../components/DatasetSelector';
import SolarSystem from '../components/SolarSystem';
import MarsPhotoCarousel from '../components/MarsPhotoCarousel';
import SectionHeader from '../components/home/SectionHeader';
import FeatureCard from '../components/home/FeatureCard';
import StatCard from '../components/home/StatCard';
import TimelineItem from '../components/home/TimelineItem';
import BelgiumCard from '../components/home/BelgiumCard';

const { hero, why, solarSystem, features, stats, timeline, belgium } = homeContent;

/* ═══ Icons maps ═══ */
const WHY_ICONS  = { water: WaterIcon, explore: ExploreIcon, science: ScienceIcon };
const FEAT_ICONS = { slice: SliceIcon, animation: AnimationIcon, timeseries: TimeSeriesIcon, profile: ProfileIcon, crosssection: CrossSectionIcon, explore: ExploreAllIcon };

/* ═══ Mars 3D — Hero ═══ */
function RotatingMars() {
  const groupRef = useRef();
  const { scene } = useGLTF('/mars.glb');
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse(child => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        if (child.material.metalness !== undefined) child.material.metalness = Math.min(child.material.metalness, 0.3);
        if (child.material.roughness !== undefined) child.material.roughness = Math.max(child.material.roughness, 0.6);
        child.material.needsUpdate = true;
      }
    });
    const box = new THREE.Box3().setFromObject(c);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) c.scale.multiplyScalar(2 / maxDim);
    const newBox = new THREE.Box3().setFromObject(c);
    c.position.sub(newBox.getCenter(new THREE.Vector3()));
    return c;
  }, [scene]);
  useFrame(({ clock }) => { if (groupRef.current) groupRef.current.rotation.y = clock.getElapsedTime() * 0.15; });
  return <group ref={groupRef}><primitive object={clone} /></group>;
}
function MarsFallback() {
  const ref = useRef();
  useFrame(({ clock }) => { if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.15; });
  return <mesh ref={ref}><sphereGeometry args={[1, 64, 64]} /><meshStandardMaterial color="#c1440e" roughness={0.9} /></mesh>;
}

/* ═══ Composant principal ═══ */
function Home() {
  const { datasets, catalogLoading, catalogError, selectedDataset, setSelectedDataset } = useMars();
  const sectionsRef = useRef(null);
  const scrollToSections = () => sectionsRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <Box>

      {/* ══════════════════════════════════════════════════════════
          1. HERO
      ══════════════════════════════════════════════════════════ */}
      <Container maxWidth="lg" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', py: 8 }}>
        <Grid container spacing={4} alignItems="center">
          <Grid size={{ xs: 12, md: 7 }}>
            <Box {...useReveal(0)}>
              <Typography variant="h3" sx={{
                fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: { xs: '2rem', md: '3.5rem' },
                background: 'linear-gradient(135deg, #e05a2b, #ff7043, #38bdf8)',
                backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1,
              }}>
                {hero.title}
              </Typography>
            </Box>
            <Box {...useReveal(0.2)} sx={{ mt: 2 }}>
              <Typography variant="h6" sx={{ fontFamily: 'var(--font-body)', fontSize: { xs: '1.1rem', md: '1.3rem' }, color: 'var(--text-secondary)' }}>
                {hero.subtitle}
              </Typography>
            </Box>
            <Box {...useReveal(0.35)} sx={{ mt: 3 }}>
              <Typography sx={{ color: 'var(--text-secondary)', maxWidth: 550, lineHeight: 1.75 }}>
                {hero.description}
              </Typography>
            </Box>
            <Box {...useReveal(0.5)} sx={{ mt: 4, maxWidth: 500 }}>
              <DatasetSelector datasets={datasets} value={selectedDataset} onChange={setSelectedDataset} disabled={catalogLoading} />
              {catalogError && <Typography color="error" variant="caption" sx={{ mt: 1 }}>Erreur backend : {catalogError}</Typography>}
            </Box>
            <Box {...useReveal(0.6)} sx={{ mt: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button variant="contained" size="large" component={Link} to="/explore" startIcon={<RocketIcon />} sx={{ px: 4, py: 1.2 }}>
                {hero.cta}
              </Button>
              <Button variant="outlined" color="secondary" size="large" onClick={scrollToSections} endIcon={<ChevronIcon />} sx={{ px: 3, py: 1.2 }}>
                En savoir plus
              </Button>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Box {...useReveal(0.3)} sx={{ height: { xs: 300, md: 450 } }}>
              <Canvas camera={{ position: [0, 0, 3], fov: 45 }}>
                <ambientLight intensity={0.8} />
                <hemisphereLight args={['#ffd4a0', '#1a1a4a', 0.6]} />
                <directionalLight position={[5, 2, 5]} intensity={2.5} color="#ffd4a0" />
                <pointLight position={[-4, -2, -3]} intensity={0.5} color="#4488ff" />
                <Suspense fallback={<MarsFallback />}><RotatingMars /></Suspense>
              </Canvas>
            </Box>
          </Grid>
        </Grid>
      </Container>

      {/* ══════════════════════════════════════════════════════════
          SCROLL TARGET
      ══════════════════════════════════════════════════════════ */}
      <Box ref={sectionsRef} />

      {/* ══════════════════════════════════════════════════════════
          2. POURQUOI MARS ?
      ══════════════════════════════════════════════════════════ */}
      <Box sx={{
        py: { xs: 8, md: 12 },
        background: 'radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.05) 0%, transparent 65%)',
        borderTop: '1px solid rgba(56,189,248,0.07)',
        borderBottom: '1px solid rgba(56,189,248,0.07)',
      }}>
        <Container maxWidth="lg">
          <SectionHeader tag={why.tag} title={why.title} color="primary" />

          {/* Pull-quote */}
          <Box {...useReveal(0.1)} sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
            <Paper sx={{
              p: { xs: 3, md: 5 },
              maxWidth: 780, mx: 'auto',
              border: '1px solid rgba(224,90,43,0.2)',
              boxShadow: 'inset 0 0 60px rgba(224,90,43,0.05)',
            }}>
              <QuoteIcon sx={{ fontSize: 36, color: 'rgba(224,90,43,0.3)', mb: 1 }} />
              <Typography sx={{
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: { xs: '1.1rem', md: '1.4rem' },
                fontWeight: 500,
                lineHeight: 1.75,
                color: 'rgba(255,255,255,0.9)',
                letterSpacing: '0.01em',
              }}>
                {why.quote}
              </Typography>
            </Paper>
          </Box>

          {/* 3 raisons */}
          <Grid container spacing={3} alignItems="stretch">
            {why.reasons.map((reason, i) => {
              const Icon = WHY_ICONS[reason.icon] || ScienceIcon;
              return (
                <Grid key={i} size={{ xs: 12, md: 4 }} sx={{ display: 'flex' }}>
                  <Box {...useReveal(i * 0.12)} sx={{ width: '100%' }}>
                    <Paper sx={{ p: 3.5, height: '100%', borderTop: '2px solid rgba(224,90,43,0.4)', transition: 'transform 0.22s', '&:hover': { transform: 'translateY(-5px)' } }}>
                      <Box sx={{ width: 48, height: 48, borderRadius: '14px', backgroundColor: 'rgba(224,90,43,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                        <Icon sx={{ color: 'var(--mars-orange)', fontSize: 26 }} />
                      </Box>
                      <Typography sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.1rem', mb: 1.5 }}>{reason.title}</Typography>
                      <Typography color="text.secondary" sx={{ lineHeight: 1.75, fontSize: '0.95rem' }}>{reason.body}</Typography>
                    </Paper>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════
          3. SYSTEME SOLAIRE
      ══════════════════════════════════════════════════════════ */}
      <Box sx={{ py: { xs: 8, md: 12 }, background: 'radial-gradient(ellipse at 50% 50%, rgba(56,189,248,0.04) 0%, transparent 70%)' }}>
        <Container maxWidth="lg">
          <SectionHeader tag={solarSystem.tag} title={solarSystem.title} subtitle={solarSystem.subtitle} color="secondary" />
          <Box {...useReveal(0.1)}>
            <Suspense fallback={
              <Box sx={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 3 }}>
                <Typography color="text.secondary">Chargement du systeme solaire…</Typography>
              </Box>
            }>
              <SolarSystem />
            </Suspense>
          </Box>
          <Box {...useReveal(0.2)} sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              Vitesses proportionnelles aux periodes orbitales reelles · Survolez une planete pour ses caracteristiques · Clic + glisse pour pivoter · Molette pour zoomer
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════
          4. FEATURE SHOWCASE
      ══════════════════════════════════════════════════════════ */}
      <Box sx={{ py: { xs: 8, md: 12 }, borderTop: '1px solid rgba(56,189,248,0.06)', borderBottom: '1px solid rgba(56,189,248,0.06)' }}>
        <Container maxWidth="lg">
          <SectionHeader tag="Outils d'exploration" title="Les vues disponibles" subtitle="Six modalités de visualisation complémentaires pour explorer chaque dimension de l'atmosphère martienne." color="secondary" />
          {/* Vues spécifiques (5 cartes) */}
          <Grid container spacing={3}>
            {features.filter(f => !f.featured).map((feature, i) => (
              <Grid key={feature.id} size={{ xs: 12, sm: 6, md: i < 2 ? 6 : 4 }}>
                <FeatureCard feature={feature} delay={i * 0.09} />
              </Grid>
            ))}
          </Grid>
          {/* Carte Explorer — pleine largeur, style spécial */}
          {features.filter(f => f.featured).map(feature => {
            const Icon = FEAT_ICONS[feature.id] || ExploreAllIcon;
            return (
              <Box key={feature.id} {...useReveal(0.5)} sx={{ mt: 3 }}>
                <Paper
                  component={Link} to={feature.route}
                  sx={{
                    p: { xs: 3, md: 4 }, textDecoration: 'none', display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' }, alignItems: { md: 'center' }, gap: 3,
                    border: `1px solid ${alpha(feature.color, 0.35)}`,
                    background: `linear-gradient(135deg, ${alpha(feature.color, 0.07)} 0%, transparent 60%)`,
                    transition: 'transform 0.25s, box-shadow 0.25s',
                    '&:hover': { transform: 'translateY(-5px)', boxShadow: `0 16px 48px ${alpha(feature.color, 0.22)}` },
                  }}
                >
                  <Box sx={{ width: 56, height: 56, borderRadius: '16px', backgroundColor: alpha(feature.color, 0.15), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon sx={{ color: feature.color, fontSize: 28 }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.8, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: feature.color }}>{feature.title}</Typography>
                      <Chip label={feature.tag} size="small" sx={{ height: 22, fontSize: '0.78rem', fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, backgroundColor: alpha(feature.color, 0.15), color: feature.color, border: `1px solid ${alpha(feature.color, 0.35)}` }} />
                      <Chip label="Avancé" size="small" variant="outlined" sx={{ height: 22, fontSize: '0.72rem', fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.2)' }} />
                    </Box>
                    <Typography color="text.secondary" sx={{ fontSize: '0.95rem', lineHeight: 1.7, maxWidth: 680 }}>{feature.body}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: feature.color, fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
                    Accéder <ArrowIcon sx={{ fontSize: 18 }} />
                  </Box>
                </Paper>
              </Box>
            );
          })}
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════
          4b. CAROUSEL PHOTOS MARS (NASA)
      ══════════════════════════════════════════════════════════ */}
      <Box sx={{ py: { xs: 8, md: 10 }, background: 'radial-gradient(ellipse at 50% 100%, rgba(224,90,43,0.05) 0%, transparent 65%)' }}>
        <Container maxWidth="lg">
          <SectionHeader tag="Vues de Mars" title="Mars en images" subtitle="Vues orbitales HiRISE, panoramas de surface et planète entière — galerie curratée depuis la bibliothèque d'images de la NASA." color="primary" />
          <Box {...useReveal(0.1)}>
            <Suspense fallback={null}>
              <MarsPhotoCarousel />
            </Suspense>
          </Box>
          <Box {...useReveal(0.2)} sx={{ mt: 1.5, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              Source : NASA Image & Video Library · Vues orbitales HiRISE, surface Perseverance, globe · Domaine public NASA
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════
          5. STATS ANIMEES
      ══════════════════════════════════════════════════════════ */}
      <Box sx={{ py: { xs: 8, md: 12 }, background: 'radial-gradient(ellipse at 50% 50%, rgba(224,90,43,0.06) 0%, transparent 60%)' }}>
        <Container maxWidth="lg">
          <SectionHeader tag="En chiffres" title="Mars vs Terre" subtitle="L'atmosphère martienne en perspective — pour chaque donnée, sa valeur sur Terre." color="primary" />
          <Grid container spacing={3} alignItems="stretch">
            {stats.map((stat, i) => (
              <Grid key={i} size={{ xs: 6, md: 3 }} sx={{ display: 'flex' }}>
                <StatCard stat={stat} delay={i * 0.08} />
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════
          6. TIMELINE MISSIONS — verticale alternée
      ══════════════════════════════════════════════════════════ */}
      <Box sx={{ py: { xs: 8, md: 12 }, borderTop: '1px solid rgba(56,189,248,0.06)' }}>
        <Container maxWidth="md">
          <SectionHeader tag="Histoire spatiale" title="L'exploration de Mars" subtitle="De Mariner 4 à Perseverance — plus de 60 ans d'exploration robotique de la planète rouge." color="secondary" />

          {/* Ligne verticale absolue (desktop) */}
          <Box sx={{ position: 'relative' }}>
            <Box sx={{
              display: { xs: 'none', md: 'block' },
              position: 'absolute',
              left: 'calc(50% - 1px)',
              top: 8, bottom: 8,
              width: 2,
              background: 'linear-gradient(to bottom, transparent 0%, rgba(56,189,248,0.25) 8%, rgba(56,189,248,0.35) 35%, rgba(224,90,43,0.35) 65%, rgba(56,189,248,0.25) 92%, transparent 100%)',
              zIndex: 0,
            }} />
            {timeline.map((item, i) => (
              <TimelineItem key={item.year} item={item} index={i} />
            ))}
          </Box>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════
          7. BELGIQUE ET MARS
      ══════════════════════════════════════════════════════════ */}
      <Box sx={{ py: { xs: 8, md: 12 }, background: 'radial-gradient(ellipse at 50% 50%, rgba(168,85,247,0.05) 0%, transparent 65%)', borderTop: '1px solid rgba(168,85,247,0.08)', borderBottom: '1px solid rgba(168,85,247,0.08)' }}>
        <Container maxWidth="lg">
          <SectionHeader tag={belgium.tag} title={belgium.title} subtitle={belgium.subtitle} color="secondary" />
          <Grid container spacing={3} alignItems="stretch">
            {belgium.items.map((item, i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }} sx={{ display: 'flex' }}>
                <BelgiumCard item={item} delay={i * 0.08} />
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════
          8. CTA FINAL
      ══════════════════════════════════════════════════════════ */}
      <Box sx={{ py: 10, textAlign: 'center', background: 'radial-gradient(ellipse at center, rgba(224,90,43,0.09) 0%, transparent 65%)' }}>
        <Container maxWidth="sm">
          <Box {...useReveal(0)}>
            <Typography variant="h5" sx={{ fontFamily: 'var(--font-display)', mb: 3, fontSize: { xs: '1.3rem', md: '1.6rem' } }}>
              Prêt à explorer l'atmosphère de Mars ?
            </Typography>
            <Button variant="contained" size="large" component={Link} to="/explore" startIcon={<RocketIcon />} sx={{ px: 5, py: 1.5 }}>
              Commencer
            </Button>
          </Box>
        </Container>
      </Box>

    </Box>
  );
}

useGLTF.preload('/mars.glb');
export default Home;
