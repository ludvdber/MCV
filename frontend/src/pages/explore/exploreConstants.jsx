import {
  GridOn as GridOnIcon,
  ShowChart as ShowChartIcon,
  PlayCircleOutline as PlayCircleIcon,
  BarChart as BarChartIcon,
  Landscape as LandscapeIcon,
  ViewTimeline as HovmollerIcon,
  Equalizer as ZonalMeanIcon,
  DonutLarge as WindRoseIcon,
  CompareArrows as DifferenceIcon,
  Thermostat as TemporalProfileIcon,
} from '@mui/icons-material';

export const VIZ_TYPES = [
  { value: 'slice', labelKey: 'explore.viz.slice', icon: <GridOnIcon fontSize="small" /> },
  { value: 'timeseries', labelKey: 'explore.viz.timeseries', icon: <ShowChartIcon fontSize="small" /> },
  { value: 'animation', labelKey: 'explore.viz.animation', icon: <PlayCircleIcon fontSize="small" /> },
  { value: 'profile', labelKey: 'explore.viz.profile', icon: <BarChartIcon fontSize="small" /> },
  { value: 'crosssection', labelKey: 'explore.viz.crosssection', icon: <LandscapeIcon fontSize="small" /> },
  { value: 'hovmoller', labelKey: 'explore.viz.hovmoller', icon: <HovmollerIcon fontSize="small" /> },
  { value: 'zonalmean', labelKey: 'explore.viz.zonalmean', icon: <ZonalMeanIcon fontSize="small" /> },
  { value: 'windrose', labelKey: 'explore.viz.windrose', icon: <WindRoseIcon fontSize="small" /> },
  { value: 'difference', labelKey: 'explore.viz.difference', icon: <DifferenceIcon fontSize="small" /> },
  { value: 'temporalprofile', labelKey: 'explore.viz.temporalprofile', icon: <TemporalProfileIcon fontSize="small" /> },
];

export const MAX_TABS = 5;

/** Types qui affichent un heatmap lat/lon (POI, surface, tooltip) */
export const LATLON_HEATMAP_TYPES = ['slice', 'animation'];

/** Types qui supportent la palette de couleurs */
export const COLORSCALE_TYPES = ['slice', 'animation', 'crosssection', 'hovmoller', 'zonalmean', 'difference', 'temporalprofile'];

/** Types qui necessitent une variable atmospherique (4D) */
export const ALTITUDE_REQUIRED_TYPES = ['profile', 'crosssection', 'zonalmean'];

/** Types incompatibles avec les datasets INDIVIDUAL (pas de dimension temps) */
export const MEAN_ONLY_TYPES = ['timeseries', 'animation', 'hovmoller', 'windrose', 'temporalprofile'];
