/**
 * Mini-colorbar horizontale de cellule (design « Flux ») : min, degrade CSS
 * de la palette reellement affichee, max, unite. Remplace la colorbar
 * verticale Plotly (masquee en mode compact) sans cout de rendu.
 */
import { Box } from '@mui/material';
import { COLORSCALE_OPTIONS, swatchGradient } from '../../utils/colorscales';
import { VARIABLES_MAP } from '../../components/VariableSelector';

const fmt = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toPrecision(3));

export default function MiniColorbar({ colorscaleName, reverse = false, stats, variableCode }) {
  if (!stats || stats.min == null || stats.max == null) return null;
  // colorscaleName peut etre un NOM d'option ('Viridis', 'RdBu') OU directement
  // un tableau de stops Plotly : Batlow/Plasma/Inferno/Vik/Roma ne sont pas des
  // noms natifs, useResultColorscale renvoie alors leur tableau. Un find() par
  // value echouerait et masquerait silencieusement la colorbar en grille.
  const gradient = Array.isArray(colorscaleName)
    ? swatchGradient({ scale: colorscaleName, reverse })
    : (() => {
        const opt = COLORSCALE_OPTIONS.find(o => o.value === colorscaleName);
        return opt ? swatchGradient({ ...opt, reverse }) : null;
      })();
  if (!gradient) return null;
  const unit = VARIABLES_MAP.get(variableCode)?.unit || '';

  return (
    <Box className="mcv-cbar" aria-hidden>
      <span>{fmt(stats.min)}</span>
      <Box className="grad" sx={{ background: gradient }} />
      <span>{fmt(stats.max)}{unit ? ` ${unit}` : ''}</span>
    </Box>
  );
}
