import {
  GridOn as GridOnIcon,
  ShowChart as ShowChartIcon,
  PlayCircleOutline as PlayCircleIcon,
  BarChart as BarChartIcon,
  Landscape as LandscapeIcon,
} from '@mui/icons-material';
export { COLORSCALE_OPTIONS, RDBU_VARIABLES } from '../../utils/colorscales';

export const VIZ_TYPES = [
  { value: 'slice', label: 'Slice 2D', icon: <GridOnIcon fontSize="small" /> },
  { value: 'timeseries', label: 'Serie temporelle', icon: <ShowChartIcon fontSize="small" /> },
  { value: 'animation', label: 'Animation diurne', icon: <PlayCircleIcon fontSize="small" /> },
  { value: 'profile', label: 'Profil vertical', icon: <BarChartIcon fontSize="small" /> },
  { value: 'crosssection', label: 'Coupe verticale', icon: <LandscapeIcon fontSize="small" /> },
];

export const MAX_TABS = 5;

/** Types qui affichent un heatmap lat/lon (POI, surface, tooltip) */
export const LATLON_HEATMAP_TYPES = ['slice', 'animation'];

/** Types qui supportent la palette de couleurs */
export const COLORSCALE_TYPES = ['slice', 'animation', 'crosssection'];

/** Types qui necessitent une variable atmospherique (4D) */
export const ALTITUDE_REQUIRED_TYPES = ['profile', 'crosssection'];
