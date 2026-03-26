/**
 * MarsPhotoCarousel — galerie de photos martiennes via NASA Image & Video Library.
 *
 * Source : https://images-api.nasa.gov (aucune clé API requise, domaine public NASA).
 * Trois requêtes en parallèle pour varier les types :
 *   1. HiRISE orbital  — vues aériennes haute-résolution de la caméra HiRISE (MRO)
 *   2. Perseverance panorama — panoramas de surface du rover
 *   3. Mars globe      — vues plein-disque de la planète
 *
 * Images : on demande d'abord ~large.jpg, fallback ~medium.jpg, puis ~thumb.jpg.
 * Cache localStorage 6h pour éviter les appels répétés au dev.
 * Attribution : NASA / JPL-Caltech.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, IconButton, Skeleton, Chip, Tooltip,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';

const NASA_IMAGES_API  = 'https://images-api.nasa.gov/search';
const CACHE_KEY        = 'mars_gallery_v4';
const CACHE_TTL        = 6 * 60 * 60 * 1000; // 6 heures
const MAX_PHOTOS       = 16;
const SLIDE_INTERVAL_MS = 5200;

/** Trois requêtes pour avoir des images variées et belles. */
const QUERIES = [
  { q: 'mars HiRISE orbital',        tagKey: 'carousel.tag.orbital', n: 8  },
  { q: 'mars perseverance panorama', tagKey: 'carousel.tag.surface', n: 10 },
  { q: 'mars planet globe',          tagKey: 'carousel.tag.planet',  n: 6  },
];

/* ─── Cache localStorage ─── */
function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, photos } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(CACHE_KEY); return null; }
    return photos;
  } catch { return null; }
}
function writeCache(photos) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), photos })); } catch { /* quota */ }
}

/* ─── Parse résultats NASA Image Library ─── */
function parseItems(data, tagKey) {
  return (data.collection?.items ?? [])
    .map(item => {
      const d     = item.data?.[0];
      const thumb = item.links?.find(l => l.rel === 'preview')?.href;
      if (!thumb || !d) return null;
      /* Construire URLs depuis l'URL du thumbnail.
       * ~medium.jpg is more reliable than ~large.jpg (NASA blocks some large images with 403). */
      const base   = thumb.replace(/~thumb\.(jpg|jpeg|png)$/i, '');
      const medium = `${base}~medium.jpg`;
      return {
        url:       medium,
        fallback1: thumb,
        fallback2: thumb,
        title:     d.title ?? '',
        date:      (d.date_created ?? '').slice(0, 10),
        nasaId:    d.nasa_id ?? '',
        center:    d.center ?? 'NASA',
        tagKey,
      };
    })
    .filter(Boolean);
}

/* ─── Déduplication par nasaId + troncature ─── */
function dedupe(all) {
  const seen = new Set();
  return all.filter(p => {
    if (seen.has(p.nasaId)) return false;
    seen.add(p.nasaId);
    return true;
  }).slice(0, MAX_PHOTOS);
}

/* ─── Image avec fallback progressif (large → medium → thumb) ─── */
function SmartImage({ photo, onLoad }) {
  const [src, setSrc] = useState(photo.url);

  useEffect(() => { setSrc(photo.url); }, [photo.url]);

  const handleError = () => {
    if (src === photo.url)       { setSrc(photo.fallback1); return; }
    if (src === photo.fallback1) { setSrc(photo.fallback2); return; }
  };

  return (
    <Box
      component="img"
      src={src}
      alt={photo.title || 'Mars photograph'}
      onLoad={onLoad}
      onError={handleError}
      sx={{
        width: '100%', height: '100%',
        objectFit: 'cover', objectPosition: 'center',
        display: 'block',
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   Composant principal
═══════════════════════════════════════════════════════════════ */
export default function MarsPhotoCarousel() {
  const { t } = useTranslation();
  const [photos,   setPhotos]   = useState([]);
  const [current,  setCurrent]  = useState(0);
  const [loaded,   setLoaded]   = useState(false);
  const [paused,   setPaused]   = useState(false);
  const [imgReady, setImgReady] = useState(false);
  const timerRef = useRef(null);

  /* ── Fetch avec cache 6h + AbortController pour cleanup ── */
  useEffect(() => {
    const cached = readCache();
    if (cached?.length) { setPhotos(cached); setLoaded(true); return; }

    const controller = new AbortController();

    (async () => {
      try {
        const results = await Promise.allSettled(
          QUERIES.map(({ q, tagKey, n }) =>
            fetch(`${NASA_IMAGES_API}?q=${encodeURIComponent(q)}&media_type=image&page_size=${n}`, { signal: controller.signal })
              .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
              .then(data => parseItems(data, tagKey))
          )
        );

        if (controller.signal.aborted) return;

        const byQuery = results
          .filter(r => r.status === 'fulfilled')
          .map(r => r.value);

        if (!byQuery.flat().length) { setLoaded(true); return; }

        /* Interleave : un de chaque requête à tour de rôle pour diversifier */
        const interleaved = [];
        const maxLen = Math.max(...byQuery.map(q => q.length));
        for (let i = 0; i < maxLen; i++) {
          for (const q of byQuery) { if (q[i]) interleaved.push(q[i]); }
        }

        const final = dedupe(interleaved);
        setPhotos(final);
        writeCache(final);
        setLoaded(true);
      } catch {
        if (!controller.signal.aborted) setLoaded(true);
      }
    })();

    return () => controller.abort();
  }, []);

  /* ── Auto-slide ── */
  const next = useCallback(() => {
    setCurrent(c => (c + 1) % (photos.length || 1));
    setImgReady(false);
  }, [photos.length]);

  const prev = useCallback(() => {
    setCurrent(c => (c - 1 + (photos.length || 1)) % (photos.length || 1));
    setImgReady(false);
  }, [photos.length]);

  useEffect(() => {
    if (paused || photos.length < 2) return;
    timerRef.current = setInterval(next, SLIDE_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [paused, photos.length, next]);

  /* ── Invisible si aucune photo disponible ── */
  if (loaded && photos.length === 0) return null;

  const photo   = photos[current];
  const nasaUrl = photo ? `https://images.nasa.gov/details/${photo.nasaId}` : '';

  return (
    <Box
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      sx={{
        position: 'relative',
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid rgba(56,189,248,0.12)',
        background: 'var(--bg-space)',
        aspectRatio: { xs: '4/3', md: '16/7' },
        cursor: 'pointer',
      }}
    >
      {/* Image */}
      {!loaded || !photo ? (
        <Skeleton variant="rectangular" width="100%" height="100%"
          sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
      ) : (
        <Box sx={{
          width: '100%', height: '100%',
          opacity: imgReady ? 1 : 0,
          transition: 'opacity 0.6s ease',
        }}>
          <SmartImage photo={photo} onLoad={() => setImgReady(true)} />
        </Box>
      )}

      {/* Overlay gradient bas */}
      <Box sx={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '60%',
        background: 'linear-gradient(to top, rgba(2,8,24,0.95) 0%, rgba(2,8,24,0.6) 38%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Légende */}
      {photo && (
        <Box sx={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          p: { xs: 1.5, md: 2.5 },
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1,
        }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', gap: 0.8, mb: 0.8, flexWrap: 'wrap' }}>
              <Chip label={t(photo.tagKey)} size="small" sx={{
                height: 20, fontSize: '0.7rem',
                fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, letterSpacing: '0.02em',
                backgroundColor: 'rgba(56,189,248,0.18)', color: '#38bdf8',
                border: '1px solid rgba(56,189,248,0.3)',
              }} />
              <Chip label={photo.center} size="small" sx={{
                height: 20, fontSize: '0.7rem',
                fontFamily: "'Rajdhani', sans-serif", fontWeight: 600,
                backgroundColor: 'rgba(224,90,43,0.15)', color: '#e05a2b',
                border: '1px solid rgba(224,90,43,0.3)',
              }} />
            </Box>
            <Typography sx={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: { xs: '0.88rem', md: '1.02rem' },
              color: 'var(--text-primary)',
              fontWeight: 600, lineHeight: 1.35,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}>
              {photo.title}
            </Typography>
            {photo.date && (
              <Typography sx={{
                fontSize: '0.72rem', color: 'var(--text-secondary)',
                fontFamily: "'Rajdhani', sans-serif", mt: 0.3,
              }}>
                {photo.date}
              </Typography>
            )}
          </Box>

          <Tooltip title={t('carousel.viewOnNasa')}>
            <IconButton
              size="small"
              component="a"
              href={nasaUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              sx={{
                color: 'rgba(255,255,255,0.4)',
                flexShrink: 0,
                '&:hover': { color: '#38bdf8' },
              }}
            >
              <OpenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Boutons Prev/Next */}
      {photos.length > 1 && (
        <>
          <IconButton
            onClick={(e) => { e.stopPropagation(); prev(); }}
            size="small"
            aria-label="Previous photo"
            sx={{
              position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
              backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(56,189,248,0.2)',
              color: '#38bdf8',
              '&:hover': { backgroundColor: 'rgba(56,189,248,0.15)' },
            }}
          >
            <PrevIcon />
          </IconButton>
          <IconButton
            onClick={(e) => { e.stopPropagation(); next(); }}
            size="small"
            aria-label="Next photo"
            sx={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(56,189,248,0.2)',
              color: '#38bdf8',
              '&:hover': { backgroundColor: 'rgba(56,189,248,0.15)' },
            }}
          >
            <NextIcon />
          </IconButton>
        </>
      )}

      {/* Dots */}
      {photos.length > 1 && (
        <Box sx={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 0.7,
        }}>
          {photos.map((_, i) => (
            <Box
              key={i}
              role="button"
              tabIndex={0}
              aria-label={`Photo ${i + 1}`}
              onClick={() => { setCurrent(i); setImgReady(false); }}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrent(i); setImgReady(false); } }}
              sx={{
                width: i === current ? 18 : 6, height: 6,
                borderRadius: 3,
                backgroundColor: i === current ? '#38bdf8' : 'rgba(255,255,255,0.22)',
                transition: 'width 0.3s ease, background-color 0.3s ease',
                cursor: 'pointer',
                boxShadow: i === current ? '0 0 8px rgba(56,189,248,0.7)' : 'none',
              }}
            />
          ))}
        </Box>
      )}

      {/* Attribution NASA */}
      <Typography sx={{
        position: 'absolute', top: 12, right: 12,
        fontSize: '0.62rem', color: 'rgba(255,255,255,0.28)',
        fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em',
        pointerEvents: 'none',
      }}>
        NASA / JPL-Caltech
      </Typography>
    </Box>
  );
}
