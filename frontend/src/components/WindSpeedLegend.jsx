import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '../context/ThemeContext';
import { windRamp } from '../utils/windStats';

/**
 * Legende de l'echelle de vitesse des particules de vent.
 *
 * Sans elle la coloration ne veut rien dire : la rampe est etiree entre le
 * minimum et le maximum du champ AFFICHE, donc les memes teintes ne recouvrent
 * pas les memes vitesses d'une slice a l'autre. Les deux bornes doivent donc
 * etre lues a cote du degrade.
 *
 * La barre reprend les couleurs exactes du rendu, alpha compris : l'extremite
 * lente y parait pale, comme les particules lentes le sont a l'ecran.
 *
 * En mode compact (cellule de la grille Explorer) le texte est raccourci mais
 * la MOYENNE reste affichee : c'est l'information qui manquait le plus, la
 * legende entiere disparaissant auparavant des que la vue passait en grille.
 *
 * @param {{min: number, max: number, mean: number}} stats — sortie de windSpeedStats
 * @param {boolean} compact
 */
export default function WindSpeedLegend({ stats, compact = false }) {
  const { t } = useTranslation();
  const { mode } = useThemeMode();
  if (!stats) return null;

  const gradient = `linear-gradient(to right, ${windRamp(mode).join(', ')})`;
  const valeurs = {
    min: stats.min.toFixed(0),
    max: stats.max.toFixed(0),
    mean: stats.mean.toFixed(0),
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
      <Box
        aria-hidden="true"
        sx={{
          width: compact ? 48 : 76,
          height: 6,
          flexShrink: 0,
          borderRadius: 3,
          background: gradient,
        }}
      />
      <Typography variant="caption" color="text.secondary" noWrap>
        {compact ? t('viz.windSpeedRange', valeurs) : t('viz.windParticlesCaption', valeurs)}
      </Typography>
    </Box>
  );
}
