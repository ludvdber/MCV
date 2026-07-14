/**
 * Visite guidee maison (sans dependance externe, compatible CSP).
 *
 * Met en avant une suite d'elements de la page reperes par un attribut
 * `data-tour="..."` : un « spotlight » (trou clair sur fond assombri) plus une
 * carte explicative positionnee a cote. Pilotee par un tableau d'etapes
 * { selector, titleKey, bodyKey }. Les chaines passent par i18n (5 locales).
 *
 * Choix « invente » plutot que driver.js / react-joyride : zero dependance a
 * remettre a l'IASB, theme Mars natif, et le rendu reste self-contained (le
 * spotlight est un simple box-shadow, pas de canvas ni d'asset distant).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Paper, Typography, Button, Portal, useMediaQuery } from '@mui/material';
import { useTranslation } from 'react-i18next';

const PAD = 6;        // marge du spotlight autour de la cible
const CARD_W = 320;   // largeur de la carte (px)

export default function GuidedTour({ open, steps, onClose, onStepChange }) {
  const { t } = useTranslation();
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null);
  const rafRef = useRef(0);
  const toRef = useRef(0);

  const step = open ? (steps[idx] ?? null) : null;

  /* La remise a zero de l'etape se fait par REMONTAGE (le parent change la `key`
     a chaque ouverture) : pas de setState synchrone dans un effet. */

  /* Notifie le parent (ex : epingler le panneau de parametres pendant la visite). */
  useEffect(() => {
    if (open && steps[idx]) onStepChange?.(idx, steps[idx]);
  }, [open, idx, steps, onStepChange]);

  const measure = useCallback(() => {
    const s = steps[idx];
    if (!s) return;
    const el = document.querySelector(s.selector);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [steps, idx]);

  /* Mesure a chaque etape, avec un second passage apres l'animation d'ouverture
     du panneau (le panneau glisse ~260 ms : sans retard la cible interne serait
     mesuree hors ecran). */
  useEffect(() => {
    if (!open || !steps[idx]) return undefined;
    const el = document.querySelector(steps[idx].selector);
    if (el && !reduce) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(measure);
    clearTimeout(toRef.current);
    toRef.current = setTimeout(measure, 340);
    return () => { cancelAnimationFrame(rafRef.current); clearTimeout(toRef.current); };
  }, [open, idx, steps, measure, reduce]);

  /* Recalcul sur redimensionnement / defilement. */
  useEffect(() => {
    if (!open) return undefined;
    const onMove = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, measure]);

  const last = idx >= steps.length - 1;
  const next = useCallback(() => {
    if (idx >= steps.length - 1) onClose?.();
    else setIdx(i => i + 1);
  }, [idx, steps.length, onClose]);
  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);

  /* Clavier : Echap ferme, fleches / Entree naviguent. */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, next, prev, onClose]);

  if (!open || !step) return null;

  /* Position de la carte : sous la cible si la place le permet, sinon au-dessus ;
     centree en dernier recours (cible introuvable). Bornage dans le viewport. */
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let cardStyle;
  if (rect) {
    const below = rect.top + rect.height + 230 < vh || rect.top < vh / 2;
    const top = below
      ? Math.min(rect.top + rect.height + 14, vh - 210)
      : Math.max(12, rect.top - 214);
    let left = rect.left + rect.width / 2 - CARD_W / 2;
    left = Math.min(Math.max(12, left), vw - CARD_W - 12);
    cardStyle = { top, left };
  } else {
    cardStyle = { top: vh / 2 - 100, left: Math.max(12, vw / 2 - CARD_W / 2) };
  }

  return (
    <Portal>
      {/* Fond capteur de clics : parcours en lecture seule, la page n'est pas
          manipulable pendant la visite. */}
      <Box aria-hidden sx={{ position: 'fixed', inset: 0, zIndex: 1600 }} />

      {/* Spotlight : cadre clair + reste assombri via un box-shadow tres etale. */}
      {rect && (
        <Box aria-hidden sx={{
          position: 'fixed',
          top: rect.top - PAD,
          left: rect.left - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
          borderRadius: 2,
          zIndex: 1601,
          pointerEvents: 'none',
          border: '2px solid var(--mars-orange)',
          boxShadow: '0 0 0 9999px rgba(6, 10, 20, 0.62)',
          transition: reduce ? 'none' : 'top .28s cubic-bezier(.4,0,.2,1), left .28s cubic-bezier(.4,0,.2,1), width .28s, height .28s',
        }} />
      )}

      {/* Carte explicative. */}
      <Paper
        elevation={8}
        role="dialog"
        aria-label={t(step.titleKey)}
        sx={{
          position: 'fixed', ...cardStyle, width: CARD_W, zIndex: 1602,
          p: 2, borderRadius: 2,
          border: '1px solid var(--glass-border)',
          background: 'var(--bg-surface, #0e1524)',
        }}
      >
        <Typography sx={{
          fontFamily: 'var(--font-display)', color: 'var(--mars-orange)',
          fontWeight: 700, fontSize: '1rem', mb: 0.75,
        }}>
          {t(step.titleKey)}
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 1.5 }}>
          {t(step.bodyKey)}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
            {t('explore.tour.stepOf', { current: idx + 1, total: steps.length })}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={onClose} sx={{ color: 'var(--text-secondary)', minWidth: 0 }}>
            {t('explore.tour.skip')}
          </Button>
          {idx > 0 && (
            <Button size="small" variant="text" onClick={prev} sx={{ minWidth: 0 }}>
              {t('explore.tour.prev')}
            </Button>
          )}
          <Button size="small" variant="contained" onClick={next}>
            {last ? t('explore.tour.done') : t('explore.tour.next')}
          </Button>
        </Box>
      </Paper>
    </Portal>
  );
}
