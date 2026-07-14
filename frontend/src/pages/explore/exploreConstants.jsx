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
  GraphicEq as TidesIcon,
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
  { value: 'tides', labelKey: 'explore.viz.tides', icon: <TidesIcon fontSize="small" /> },
];

/** Nombre maximum de vues ouvertes par session (= la grille pleine). */
export const MAX_TABS = 4;

/** Types qui affichent un heatmap lat/lon (POI, surface, tooltip) */
export const LATLON_HEATMAP_TYPES = ['slice', 'animation'];

/** Types qui supportent la palette de couleurs */
export const COLORSCALE_TYPES = ['slice', 'animation', 'crosssection', 'hovmoller', 'zonalmean', 'difference', 'temporalprofile', 'transect'];

/** Types heatmap qui supportent le toggle de lissage (zsmooth) — pas la moyenne zonale (contour) */
export const SMOOTH_TYPES = ['slice', 'animation', 'crosssection', 'hovmoller', 'difference', 'temporalprofile', 'transect'];

/** Types lat/lon qui supportent l'interpolation d'affichage (natif 4 deg / 2 deg / 1 deg) */
export const INTERP_TYPES = ['slice', 'animation', 'difference'];

/** Types qui necessitent une variable atmospherique (4D) */
export const ALTITUDE_REQUIRED_TYPES = ['profile', 'crosssection', 'zonalmean'];

/** Types incompatibles avec les datasets INDIVIDUAL (pas de dimension temps) */
export const MEAN_ONLY_TYPES = ['timeseries', 'animation', 'hovmoller', 'windrose', 'temporalprofile', 'tides'];

/** Dispositions de la console multi-vues : 1 vue ou grille de 4.
 *  La disposition 2 n'apportait rien : autant afficher la grille de 4
 *  partiellement remplie (retour utilisateur). */
export const LAYOUTS = [1, 4];
