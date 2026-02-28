import {
  GridOn as GridOnIcon,
  ShowChart as ShowChartIcon,
  PlayCircleOutline as PlayCircleIcon,
  BarChart as BarChartIcon,
  Landscape as LandscapeIcon,
} from '@mui/icons-material';
export { COLORSCALE_OPTIONS, RDBU_VARIABLES } from '../../utils/colorscales';

export const VIZ_TYPES = [
  { value: 'slice', labelKey: 'explore.viz.slice', icon: <GridOnIcon fontSize="small" /> },
  { value: 'timeseries', labelKey: 'explore.viz.timeseries', icon: <ShowChartIcon fontSize="small" /> },
  { value: 'animation', labelKey: 'explore.viz.animation', icon: <PlayCircleIcon fontSize="small" /> },
  { value: 'profile', labelKey: 'explore.viz.profile', icon: <BarChartIcon fontSize="small" /> },
  { value: 'crosssection', labelKey: 'explore.viz.crosssection', icon: <LandscapeIcon fontSize="small" /> },
];

export const MAX_TABS = 5;

/** Types qui affichent un heatmap lat/lon (POI, surface, tooltip) */
export const LATLON_HEATMAP_TYPES = ['slice', 'animation'];

/** Types qui supportent la palette de couleurs */
export const COLORSCALE_TYPES = ['slice', 'animation', 'crosssection'];

/** Types qui necessitent une variable atmospherique (4D) */
export const ALTITUDE_REQUIRED_TYPES = ['profile', 'crosssection'];
