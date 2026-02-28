/**
 * Structure non traduisible de la page d'accueil.
 * Icones, URLs, constantes numeriques, couleurs, metadata missions.
 * Les fichiers home.XX.js importent ces constantes et n'ajoutent que les textes.
 */

export const HERO_TITLE = 'MARS CLIMATE VIEWER';

export const WHY_REASON_ICONS = ['water', 'explore', 'science'];

export const FEATURES_STRUCTURE = [
  { id: 'slice',        route: '/slice',        color: '#e05a2b' },
  { id: 'animation',    route: '/animation',    color: '#ff7043' },
  { id: 'timeseries',   route: '/timeseries',   color: '#38bdf8' },
  { id: 'profile',      route: '/profile',      color: '#38bdf8' },
  { id: 'crosssection', route: '/crosssection', color: '#38bdf8' },
  { id: 'explore',      route: '/explore',      color: '#a855f7', featured: true },
];

export const STATS_STRUCTURE = [
  { numeric: 687,  decimals: 0, prefix: '',       suffix: '\u2009d',           ratio: 687 / 687   },
  { numeric: 6.1,  decimals: 1, prefix: '',       suffix: '\u2009mb',          ratio: 6.1 / 1013  },
  { numeric: 55,   decimals: 0, prefix: '\u2212', suffix: '\u00b0C',           ratio: null         },
  { numeric: 0.13, decimals: 2, prefix: '',       suffix: '\u2009%',           ratio: 0.13 / 21   },
  { numeric: 3.72, decimals: 2, prefix: '',       suffix: '\u2009m/s\u00b2',   ratio: 3.72 / 9.81 },
  { numeric: 6779, decimals: 0, prefix: '',       suffix: '\u2009km',          ratio: 6779 / 12742 },
  { numeric: 2,    decimals: 0, prefix: '',       suffix: '',                  ratio: null         },
  { numeric: 24,   decimals: 0, prefix: '',       suffix: 'h37',              ratio: null         },
];

export const TIMELINE_STRUCTURE = [
  { year: '1965', name: 'Mariner 4',           agency: 'NASA' },
  { year: '1976', name: 'Viking 1 & 2',        agency: 'NASA' },
  { year: '1997', name: 'Pathfinder',           agency: 'NASA' },
  { year: '2004', name: 'Spirit & Opportunity', agency: 'NASA' },
  { year: '2012', name: 'Curiosity',            agency: 'NASA' },
  { year: '2016', name: 'ExoMars TGO',          agency: 'ESA'  },
  { year: '2021', name: 'Perseverance',          agency: 'NASA' },
];

export const BELGIUM_ITEMS_STRUCTURE = [
  { icon: 'model',    color: '#e05a2b' },
  { icon: 'nomad',    color: '#38bdf8' },
  { icon: 'collab',   color: '#a855f7' },
  { icon: 'vki',      color: '#38bdf8' },
  { icon: 'spacebel', color: '#e05a2b' },
  { icon: 'rosalind', color: '#a855f7' },
];
