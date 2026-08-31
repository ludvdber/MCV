/**
 * Page d'accueil — Mars Climate Viewer.
 *
 * Sections :
 * 1. Hero       — titre, sous-titre, description, 2 CTA, globe 3D saisissable
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
  Box, Container, Typography, Button, Paper,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  KeyboardArrowDown as ChevronIcon,
  RocketLaunch as RocketIcon,
  FormatQuote as QuoteIcon,
  WaterDrop as WaterIcon,
  Explore as ExploreIcon,
  Science as ScienceIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { homeContent as homeContentFr } from '../content/home.fr';
import { homeContent as homeContentEn } from '../content/home.en';
import { homeContent as homeContentNl } from '../content/home.nl';
import { homeContent as homeContentEs } from '../content/home.es';
import { homeContent as homeContentDe } from '../content/home.de';

/** Mappe la langue courante au fichier de contenu correspondant */
const HOME_CONTENT = { fr: homeContentFr, en: homeContentEn, nl: homeContentNl, es: homeContentEs, de: homeContentDe };
import { useMars } from '../context/MarsContext';
import { useReveal } from '../hooks/useReveal';
import SolarSystem from '../components/SolarSystem';
import MarsPhotoCarousel from '../components/MarsPhotoCarousel';
import SectionHeader from '../components/home/SectionHeader';
import FeatureCard from '../components/home/FeatureCard';
import StatCard from '../components/home/StatCard';
import TimelineItem from '../components/home/TimelineItem';
import BelgiumCard from '../components/home/BelgiumCard';

/* Le contenu est selectionne dynamiquement dans le composant via useTranslation */

/* ═══ Icons maps ═══ */
const WHY_ICONS  = { water: WaterIcon, explore: ExploreIcon, science: ScienceIcon };
/* FEAT_ICONS moved into FeatureCard component */

/* ═══ Mars 3D — Hero ═══ */
/** Globe du hero : rotation lente continue + saisie a la souris avec inertie.
 *  La saisie tourne le globe lui-meme (camera fixe) : la composition en
 *  horizon bas reste intacte quoi que fasse l'utilisateur. */
function HeroMars({ finePointer, reducedMotion }) {
  const groupRef = useRef();
  const dragXRef = useRef(null);
  const velRef = useRef(0);
  const { scene } = useGLTF('/mars.glb', false, true);
  useMemo(() => {
    scene.traverse(child => {
      if (child.isMesh && child.material) {
        if (child.material.metalness !== undefined) child.material.metalness = Math.min(child.material.metalness, 0.3);
        if (child.material.roughness !== undefined) child.material.roughness = Math.max(child.material.roughness, 0.6);
        child.material.needsUpdate = true;
      }
    });
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) scene.scale.multiplyScalar(2 / maxDim);
    const newBox = new THREE.Box3().setFromObject(scene);
    scene.position.sub(newBox.getCenter(new THREE.Vector3()));
  }, [scene]);
  /* Apparition en douceur : le composant ne monte qu'une fois le GLB chargé
     (textures comprises, elles sont embarquées dans le .glb) — léger zoom
     0.92 → 1 au lieu d'un pop sec. Remplace l'ancienne sphère orange de
     repli, illisible sur connexion lente. */
  const appearRef = useRef(0);
  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    if (appearRef.current < 1) {
      appearRef.current = reducedMotion ? 1 : Math.min(1, appearRef.current + delta * 2.4);
      const e = 1 - (1 - appearRef.current) ** 3;
      g.scale.setScalar(0.92 + 0.08 * e);
    }
    if (dragXRef.current !== null) return;
    g.rotation.y += (reducedMotion ? 0 : 0.11 * delta) + velRef.current;
    velRef.current *= Math.exp(-3.2 * delta);
  });
  const onDown = (e) => {
    if (!finePointer) return;
    e.stopPropagation();
    e.target.setPointerCapture?.(e.pointerId);
    dragXRef.current = e.clientX;
    velRef.current = 0;
    document.body.style.cursor = 'grabbing';
  };
  const onMove = (e) => {
    if (dragXRef.current === null || !groupRef.current) return;
    const dx = e.clientX - dragXRef.current;
    groupRef.current.rotation.y += dx * 0.005;
    velRef.current = dx * 0.0012;
    dragXRef.current = e.clientX;
  };
  const endDrag = () => {
    dragXRef.current = null;
    document.body.style.cursor = '';
  };
  return (
    <group ref={groupRef}>
      <primitive object={scene} />
      {/* Zone de saisie invisible, legerement plus large que le globe */}
      <mesh
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerOver={() => { if (finePointer && dragXRef.current === null) document.body.style.cursor = 'grab'; }}
        onPointerOut={() => { if (dragXRef.current === null) document.body.style.cursor = ''; }}
      >
        <sphereGeometry args={[1.05, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ═══ Carte « raison » — composant dédié pour que useReveal soit appelé au
   sommet d'un composant (et non dans un .map, ce qui violait rules-of-hooks) ═══ */
function ReasonCard({ reason, delay }) {
  const Icon = WHY_ICONS[reason.icon] || ScienceIcon;
  return (
    <Box {...useReveal(delay)} sx={{ width: '100%' }}>
      <Paper sx={{ p: 3.5, height: '100%', borderTop: '2px solid rgba(224,90,43,0.4)', transition: 'transform 0.22s', '&:hover': { transform: 'translateY(-5px)' } }}>
        <Box sx={{ width: 48, height: 48, borderRadius: '14px', backgroundColor: 'rgba(224,90,43,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
          <Icon sx={{ color: 'var(--mars-orange)', fontSize: 26 }} />
        </Box>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.1rem', mb: 1.5 }}>{reason.title}</Typography>
        <Typography color="text.secondary" sx={{ lineHeight: 1.75, fontSize: '0.95rem' }}>{reason.body}</Typography>
      </Paper>
    </Box>
  );
}

/* ═══ Composant principal ═══ */
function Home() {
  const { catalogError } = useMars();
  const { t, i18n } = useTranslation();
  const lang = i18n.language.split('-')[0];
  const { hero, why, solarSystem, features, stats, timeline, belgium } = HOME_CONTENT[lang] || HOME_CONTENT.en;
  const sectionsRef = useRef(null);
  const scrollToSections = () => sectionsRef.current?.scrollIntoView({ behavior: 'smooth' });

  /* Le globe n'est saisissable qu'a la souris : au doigt, la rotation
     confisquerait le defilement de la page. */
  const finePointer = useMemo(
    () => window.matchMedia('(pointer: fine)').matches,
    [],
  );
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  return (
    <Box>

      {/* ══════════════════════════════════════════════════════════
          1. HERO — titre, sous-titre, description, deux boutons, globe entier
      ══════════════════════════════════════════════════════════ */}
      <Container maxWidth="lg" className="mcv-hero" component="section" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', py: 8 }}>
        <Grid container spacing={4} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Box {...useReveal(0)}>
              {/* Titre en MAJUSCULES dégradé orange : c'est la version historique
                  du site (Orbitron en minuscules perdait toute son identité, et la
                  fin bleue du dégradé jurait avec la planète). */}
              <Typography variant="h3" component="h1" sx={{
                fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: { xs: '2rem', md: '3.5rem' },
                textTransform: 'uppercase',
                background: 'linear-gradient(135deg, #e05a2b 0%, #ff7043 55%, #ffc9b0 100%)',
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
            <Box {...useReveal(0.5)} sx={{ mt: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button variant="contained" size="large" component={Link} to="/explore" startIcon={<RocketIcon />} sx={{ px: 4, py: 1.2 }}>
                {hero.cta}
              </Button>
              <Button variant="outlined" color="secondary" size="large" onClick={scrollToSections} endIcon={<ChevronIcon />} sx={{ px: 3, py: 1.2 }}>
                {t('home.learnMore')}
              </Button>
            </Box>
            {catalogError && (
              <Typography color="error" variant="caption" sx={{ mt: 2, display: 'block' }}>
                {t('home.backendError')} {catalogError}
              </Typography>
            )}
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            {/* Globe entier, saisissable a la souris (rotation avec inertie) */}
            <Box aria-hidden sx={{ height: { xs: 300, md: 450 } }}>
              <Canvas camera={{ position: [0, 0, 3], fov: 45 }} dpr={[1, 1.75]}>
                <ambientLight intensity={0.8} />
                <hemisphereLight args={['#ffd4a0', '#1a1a4a', 0.6]} />
                <directionalLight position={[5, 2, 5]} intensity={2.5} color="#ffd4a0" />
                <pointLight position={[-4, -2, -3]} intensity={0.5} color="#4488ff" />
                {/* Pendant le chargement du GLB : rien (le champ d'étoiles suffit).
                    Mars n'apparaît que complète — l'ancienne sphère orange unie
                    faisait « brouillon » sur connexion lente. */}
                <Suspense fallback={null}>
                  <HeroMars finePointer={finePointer} reducedMotion={reducedMotion} />
                </Suspense>
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
        borderTop: '1px solid var(--glass-border)',
        borderBottom: '1px solid var(--glass-border)',
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
              <QuoteIcon sx={{ fontSize: 36, color: 'var(--mars-orange)', mb: 1 }} />
              <Typography sx={{
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: { xs: '1.1rem', md: '1.4rem' },
                fontWeight: 500,
                lineHeight: 1.75,
                color: 'var(--text-primary)',
                letterSpacing: '0.01em',
              }}>
                {why.quote}
              </Typography>
            </Paper>
          </Box>

          {/* 3 raisons */}
          <Grid container spacing={3} sx={{ alignItems: 'stretch' }}>
            {why.reasons.map((reason, i) => (
              <Grid key={reason.icon} size={{ xs: 12, md: 4 }} sx={{ display: 'flex' }}>
                <ReasonCard reason={reason} delay={i * 0.12} />
              </Grid>
            ))}
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
              <Box sx={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--glass-border)', borderRadius: 3 }}>
                <Typography color="text.secondary">{t('home.solarLoading')}</Typography>
              </Box>
            }>
              <SolarSystem />
            </Suspense>
          </Box>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════
          4. FEATURE SHOWCASE — Bento grid
      ══════════════════════════════════════════════════════════ */}
      <Box sx={{ py: { xs: 8, md: 12 }, borderTop: '1px solid var(--glass-border)', borderBottom: '1px solid var(--glass-border)' }}>
        <Container maxWidth="lg">
          <SectionHeader tag={t('home.featuresTag')} title={t('home.featuresTitle')} subtitle={t('home.featuresSubtitle')} color="secondary" />

          {/* Hero row — 2 primary views */}
          <Grid container spacing={2.5}>
            {features.filter(f => !f.featured).slice(0, 2).map((feature, i) => (
              <Grid key={feature.id} size={{ xs: 12, md: 6 }}>
                <FeatureCard feature={feature} delay={i * 0.08} hero />
              </Grid>
            ))}
          </Grid>

          {/* Compact grid — remaining views, 4 columns */}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {features.filter(f => !f.featured).slice(2).map((feature, i) => (
              <Grid key={feature.id} size={{ xs: 12, sm: 6, md: 3 }}>
                <FeatureCard feature={feature} delay={0.16 + i * 0.06} />
              </Grid>
            ))}
          </Grid>

          {/* Explorer — full-width hero CTA */}
          {features.filter(f => f.featured).map(feature => (
            <Box key={feature.id} sx={{ mt: 2.5 }}>
              <FeatureCard feature={feature} delay={0.5} hero />
            </Box>
          ))}
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════
          4b. CAROUSEL PHOTOS MARS (NASA)
      ══════════════════════════════════════════════════════════ */}
      <Box sx={{ py: { xs: 8, md: 10 }, background: 'radial-gradient(ellipse at 50% 100%, rgba(224,90,43,0.05) 0%, transparent 65%)' }}>
        <Container maxWidth="lg">
          <SectionHeader tag={t('home.carouselTag')} title={t('home.carouselTitle')} subtitle={t('home.carouselSubtitle')} color="primary" />
          <Box {...useReveal(0.1)}>
            <Suspense fallback={null}>
              <MarsPhotoCarousel />
            </Suspense>
          </Box>
          <Box {...useReveal(0.2)} sx={{ mt: 1.5, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {t('home.carouselSource')}
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════
          5. STATS ANIMEES
      ══════════════════════════════════════════════════════════ */}
      <Box sx={{ py: { xs: 8, md: 12 }, background: 'radial-gradient(ellipse at 50% 50%, rgba(224,90,43,0.06) 0%, transparent 60%)' }}>
        <Container maxWidth="lg">
          <SectionHeader tag={t('home.statsTag')} title={t('home.statsTitle')} subtitle={t('home.statsSubtitle')} color="primary" />
          <Grid container spacing={3} sx={{ alignItems: 'stretch' }}>
            {stats.map((stat, i) => (
              <Grid key={stat.label} size={{ xs: 6, md: 3 }} sx={{ display: 'flex' }}>
                <StatCard stat={stat} delay={i * 0.08} />
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════════════════════
          6. TIMELINE MISSIONS — verticale alternée
      ══════════════════════════════════════════════════════════ */}
      <Box sx={{ py: { xs: 8, md: 12 }, borderTop: '1px solid var(--glass-border)' }}>
        <Container maxWidth="md">
          <SectionHeader tag={t('home.timelineTag')} title={t('home.timelineTitle')} subtitle={t('home.timelineSubtitle')} color="secondary" />

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
      <Box sx={{ py: { xs: 8, md: 12 }, background: 'radial-gradient(ellipse at 50% 50%, rgba(168,85,247,0.05) 0%, transparent 65%)', borderTop: '1px solid var(--glass-border)', borderBottom: '1px solid var(--glass-border)' }}>
        <Container maxWidth="lg">
          <SectionHeader tag={belgium.tag} title={belgium.title} subtitle={belgium.subtitle} color="secondary" />
          <Grid container spacing={3} sx={{ alignItems: 'stretch' }}>
            {belgium.items.map((item, i) => (
              <Grid key={item.icon} size={{ xs: 12, sm: 6, md: 4 }} sx={{ display: 'flex' }}>
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
              {t('home.ctaTitle')}
            </Typography>
            <Button variant="contained" size="large" component={Link} to="/explore" startIcon={<RocketIcon />} sx={{ px: 5, py: 1.5 }}>
              {t('home.ctaButton')}
            </Button>
          </Box>
        </Container>
      </Box>

    </Box>
  );
}

export default Home;
