/**
 * Reponses d'API de reference pour les tests de composants.
 *
 * Les FORMES suivent exactement les records du backend
 * (src/main/java/com/mars/visualizer/dto/response/*.java) : un champ renomme
 * cote serveur casse donc ces tests, ce qui est l'interet.
 *
 * Les valeurs sont volontairement petites et LISIBLES : chaque cellule d'une
 * grille encode ses indices (`100*i + j`), si bien qu'une valeur affichee dit
 * d'ou elle vient et qu'une erreur d'indexation se lit dans le message d'echec.
 */

export const LATS = [-40, -20, 0, 20, 40];
export const LONS = [-180, -120, -60, 0, 60, 120];
export const ALTS = [0.5, 5.2, 12.4, 25.3, 48.9];
export const TIMES = Array.from({ length: 48 }, (_, k) => k * 0.5);

/** Grille [lat][lon] ou chaque cellule encode ses indices. */
export const grille = (nl = LATS.length, nc = LONS.length, base = 200) =>
  Array.from({ length: nl }, (_, i) => Array.from({ length: nc }, (_, j) => base + 100 * i + j));

export const stats = (min = 200, max = 604, mean = 402) =>
  ({ min, max, mean, stddev: 120.5, median: 402 });

export const CATALOGUE = [
  {
    id: 'mean_MY35_Ls0_30', filename: 'MY35_Ls000_030.nc', marsYear: 35, lsStart: 0, lsEnd: 30,
    variables: ['TT', 'UU', 'VV', 'MTSF'], dimensions: { time: 48, altitudeT: 103, lat: 5, lon: 6 },
  },
  {
    id: 'mean_MY35_Ls30_60', filename: 'MY35_Ls030_060.nc', marsYear: 35, lsStart: 30, lsEnd: 60,
    variables: ['TT', 'UU', 'VV', 'MTSF'], dimensions: { time: 48, altitudeT: 103, lat: 5, lon: 6 },
  },
];

export const CATALOGUE_INDIVIDUEL = [
  { marsYear: 34, lsMin: 0.5, lsMax: 10.2, directories: ['000960'] },
];

export const SLICE = {
  dataset: 'mean_MY35_Ls0_30', variable: 'TT', timeIndex: 24, altitudeIndex: 49,
  altitudeValue: 25.3, actualLs: 15.0,
  dimensions: { lat: 5, lon: 6 },
  data: grille(), latitudes: LATS, longitudes: LONS, stats: stats(),
};

export const TIMESERIES = {
  dataset: 'mean_MY35_Ls0_30', variable: 'TT',
  latitude: -38, longitude: 30, actualLat: -40, actualLon: 60,
  altitudeIndex: 49, altitudeValue: 25.3,
  values: TIMES.map((h) => 200 + h),
  stats: stats(200, 223.5, 211.75),
};

export const PROFILE = {
  dataset: 'mean_MY35_Ls0_30', variable: 'TT', timeIndex: 24,
  latitude: -40, longitude: 60, actualLs: 15.0,
  altitudes: ALTS, values: [210, 205, 198, 190, 185],
  stats: stats(185, 210, 197.6),
};

export const ANIMATION = {
  dataset: 'mean_MY35_Ls0_30', variable: 'TT', altitudeIndex: 49, altitudeValue: 25.3,
  frameCount: 4,
  frames: [grille(), grille(5, 6, 210), grille(5, 6, 220), grille(5, 6, 230)],
  latitudes: LATS, longitudes: LONS, stats: stats(),
};

export const CROSSSECTION = {
  dataset: 'mean_MY35_Ls0_30', variable: 'TT', timeIndex: 24, type: 'meridional',
  fixedCoordinate: 60, actualLs: 15.0,
  altitudes: ALTS, horizontalCoords: LATS,
  data: grille(ALTS.length, LATS.length), stats: stats(),
};

export const HOVMOLLER = {
  dataset: 'mean_MY35_Ls0_30', variable: 'TT', altitudeIndex: 49, altitudeValue: 25.3,
  type: 'latitude',
  times: TIMES, spatialCoords: LATS,
  data: Array.from({ length: TIMES.length }, (_, i) => LATS.map((_, j) => 200 + i + j)),
  stats: stats(),
};

export const ZONALMEAN = {
  dataset: 'mean_MY35_Ls0_30', variable: 'TT', timeIndex: 24, actualLs: 15.0,
  latitudes: LATS, altitudes: ALTS,
  data: grille(ALTS.length, LATS.length), stats: stats(),
};

export const TEMPORALPROFILE = {
  dataset: 'mean_MY35_Ls0_30', variable: 'TT', latitude: -40, longitude: 60, actualLs: 15.0,
  altitudes: ALTS, times: TIMES,
  data: Array.from({ length: ALTS.length }, (_, i) => TIMES.map((_, j) => 200 + i + j * 0.1)),
  stats: stats(),
};

export const DIFFERENCE = {
  datasetA: 'mean_MY35_Ls0_30', datasetB: 'mean_MY35_Ls30_60', variable: 'TT',
  timeIndex: 24, altitudeIndex: 49, altitudeValue: 25.3,
  data: LATS.map((_, i) => LONS.map((_, j) => (i - 2) * 3 + (j - 3))),
  latitudes: LATS, longitudes: LONS, stats: stats(-9, 8, -0.5),
};

export const WIND = {
  lats: [-40, 0, 40, -40, 0, 40],
  lons: [-120, -120, -120, 60, 60, 60],
  u: [10, -5, 20, 8, -12, 3],
  v: [2, 7, -4, 1, 6, -9],
};

export const WINDROSE = {
  dataset: 'mean_MY35_Ls0_30', latitude: -38, longitude: 30,
  altitudeIndex: 49, altitudeValue: 25.3,
  uu: TIMES.map((h) => Math.cos(h / 24 * 2 * Math.PI) * 10),
  vv: TIMES.map((h) => Math.sin(h / 24 * 2 * Math.PI) * 10),
  actualLat: -40, actualLon: 60,
};

export const TIDES = {
  dataset: 'mean_MY35_Ls0_30', variable: 'TT', altitudeIndex: 49, altitudeValue: 25.3,
  latitudes: LATS, longitudes: LONS,
  mean: grille(),
  amplitudeDiurnal: grille(5, 6, 10),
  phaseDiurnal: LATS.map((_, i) => LONS.map((_, j) => (i * 6 + j) % 24)),
  amplitudeSemidiurnal: grille(5, 6, 2),
  phaseSemidiurnal: LATS.map((_, i) => LONS.map((_, j) => (i * 3 + j) % 12)),
  statsDiurnal: stats(10, 34, 22),
  statsSemidiurnal: stats(2, 26, 14),
};

export const TRANSECT = {
  dataset: 'mean_MY35_Ls0_30', variable: 'TT', timeIndex: 24, actualLs: 15.0,
  lat1: -40, lon1: -120, lat2: 40, lon2: 120,
  altitudes: ALTS, distances: [0, 1000, 2000, 3000, 4000],
  lats: [-40, -20, 0, 20, 40], lons: [-120, -60, 0, 60, 120],
  data: grille(ALTS.length, 5), stats: stats(),
};

export const ALTITUDES = { surface: false, altitudes: ALTS };

/** Table URL -> corps de reponse, utilisee par `installApiFixtures`. */
export const PAR_URL = {
  '/catalog': CATALOGUE,
  '/catalog/individual': CATALOGUE_INDIVIDUEL,
  '/data/slice': SLICE,
  '/data/timeseries': TIMESERIES,
  '/data/animation': ANIMATION,
  '/data/profile': PROFILE,
  '/data/crosssection': CROSSSECTION,
  '/data/hovmoller': HOVMOLLER,
  '/data/zonalmean': ZONALMEAN,
  '/data/temporal-profile': TEMPORALPROFILE,
  '/data/difference': DIFFERENCE,
  '/data/wind': WIND,
  '/data/windrose': WINDROSE,
  '/data/tides': TIDES,
  '/data/transect': TRANSECT,
  '/data/altitudes': ALTITUDES,
};
