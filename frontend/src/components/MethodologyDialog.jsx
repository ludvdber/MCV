import {
  Dialog, DialogTitle, DialogContent, IconButton, Box, Typography, Divider,
} from '@mui/material';
import { Close as CloseIcon, Science as ScienceIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

/**
 * « Méthodes & conventions » : référence scientifique de MCV.
 *
 * Explique, calcul par calcul, la méthode employée pour chaque produit, afin
 * qu'un utilisateur scientifique sache exactement ce qu'il regarde et puisse
 * le citer/reproduire. Les FORMULES sont volontairement neutres (symboles
 * mathématiques + termes CF standard), donc identiques dans toutes les langues ;
 * seuls le titre et une courte description sont localisés (clés method.*).
 */

// Chaque section : clé i18n (titre + desc) + formule/convention neutre.
const SECTIONS = [
  { key: 'localtime',  formula: 'LT(k) = k × 0,5 h ,  k = 0…47  (k = 0 → minuit)' },
  { key: 'altitude',   formula: 'z(niveau) = ⟨GZ⟩ₗₐₜ,ₗₒₙ   (hauteur géopotentielle moyennée lat/lon, km)' },
  { key: 'stats',      formula: 'x̄ = Σ wᵢⱼ·xᵢⱼ / Σ wᵢⱼ ,  wᵢ = cos(φᵢ)     |     min / max non pondérés' },
  { key: 'zonalmean',  formula: '⟨x⟩(φ, z) = (1/Nₗₒₙ) · Σ over lon  x(φ, λ, z)' },
  { key: 'anomaly',    formula: "x'(φ, λ) = x(φ, λ) − ⟨x⟩(φ)     (écart à la moyenne zonale)" },
  { key: 'difference', formula: 'Δ = A − B     (même pas horaire, même niveau)     palette divergente, ±max' },
  { key: 'tides',      formula: 'x(t) ≈ x̄ + Σₙ₌₁,₂ Aₙ·cos(2πn·t/24 − φₙ) ;  Aₙ = √(aₙ²+bₙ²) ;  phase = LT du max' },
  { key: 'diurnalamp', formula: 'Δ24h = maxₜ x − minₜ x     (amplitude crête-à-crête ≠ amplitude harmonique Aₙ)' },
  { key: 'transect',   formula: 'géodésique (slerp) ;  d = R·Δσ ,  R = 3389,5 km ;  échantillonnage = plus proche voisin' },
  { key: 'windspeed',  formula: '|V| = √(UU² + VV²)' },
  { key: 'interp',     formula: 'résolution native ≈ 4° ;  sur-échantillonnage 2°/1° bilinéaire = AFFICHAGE seulement' },
  { key: 'palettes',   formula: 'magnitude → séquentielle (Viridis/Batlow) ;  champ signé / anomalie → divergente centrée sur 0' },
  { key: 'units',      formula: 'unités CF du fichier ;  traceurs H2O/CO2/O3/CO/T9/DVM = rapport de mélange MASSIQUE (kg/kg)' },
];

function MethodologyDialog({ open, onClose }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}>
        <ScienceIcon fontSize="small" sx={{ color: 'var(--mars-orange)' }} />
        {t('method.title')}
        <IconButton onClick={onClose} aria-label={t('common.close')} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('method.intro')}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SECTIONS.map((s, i) => (
            <Box key={s.key}>
              {i > 0 && <Divider sx={{ mb: 2 }} />}
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {t(`method.${s.key}.title`)}
              </Typography>
              <Box
                component="pre"
                sx={{
                  m: '6px 0', p: 1, borderRadius: 1, overflowX: 'auto',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: '0.82rem', lineHeight: 1.5,
                  background: 'var(--bg-surface, rgba(148,163,184,0.12))',
                  border: '1px solid var(--glass-border, rgba(148,163,184,0.2))',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {s.formula}
              </Box>
              <Typography variant="body2" color="text.secondary">
                {t(`method.${s.key}.desc`)}
              </Typography>
            </Box>
          ))}
        </Box>
        <Divider sx={{ my: 2 }} />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {t('method.source')}
        </Typography>
      </DialogContent>
    </Dialog>
  );
}

export default MethodologyDialog;
