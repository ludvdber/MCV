/**
 * Points d'interet martiens pour affichage sur les heatmaps.
 *
 * Coordonnees en convention -180/+180 (est positif).
 * buildLocationTrace() gere la conversion si les donnees
 * du backend utilisent la convention 0-360.
 */

export const MARS_LOCATIONS = [
  { name: 'Olympus Mons',      lat: 18.4,  lon: -133.9, type: 'volcano' },
  { name: 'Valles Marineris',  lat: -13.9, lon: -59.2,  type: 'canyon'  },
  { name: 'Hellas Planitia',   lat: -42.7, lon: 70.0,   type: 'basin'   },
  { name: 'Tharsis Plateau',   lat: 1.4,   lon: -101.0, type: 'volcano' },
  { name: 'Argyre Planitia',   lat: -49.7, lon: -43.4,  type: 'basin'   },
  { name: 'Syrtis Major',      lat: 8.4,   lon: 69.5,   type: 'region'  },
  { name: 'Gale Crater',       lat: -5.4,  lon: 137.8,  type: 'crater'  },
  { name: 'Jezero Crater',     lat: 18.4,  lon: 77.4,   type: 'crater'  },
  { name: 'Elysium Mons',      lat: 25.0,  lon: 147.2,  type: 'volcano' },
  { name: 'Pavonis Mons',      lat: 0.0,   lon: -113.4, type: 'volcano' },
  { name: 'Arsia Mons',        lat: -8.4,  lon: -120.5, type: 'volcano' },
  { name: 'Ascraeus Mons',     lat: 11.9,  lon: -104.5, type: 'volcano' },
  { name: 'Acidalia Planitia', lat: 46.7,  lon: -26.0,  type: 'region'  },
  { name: 'Arabia Terra',      lat: 21.0,  lon: 6.0,    type: 'region'  },
];

export const LOCATION_COLORS = {
  volcano: '#ff6b35',
  canyon:  '#ffd166',
  basin:   '#38bdf8',
  crater:  '#a78bfa',
  region:  '#6ee7b7',
};

/** Symboles Plotly par type (pour distinguer visuellement sur la carte) */
export const LOCATION_SYMBOLS = {
  volcano: 'triangle-up',
  canyon:  'hexagon',
  basin:   'circle',
  crater:  'circle-open',
  region:  'diamond',
};

/** Cles i18n pour la legende (utilise par LocationsLegend et ExploreResultsPanel) */
export const LOCATION_TYPE_KEYS = {
  volcano: 'location.type.volcano',
  canyon:  'location.type.canyon',
  basin:   'location.type.basin',
  crater:  'location.type.crater',
  region:  'location.type.region',
};

/**
 * Construit une trace Plotly scatter pour les points d'interet.
 *
 * @param {number[]} dataLongitudes - longitudes du dataset (pour detecter la convention 0-360)
 * @returns {Object} trace Plotly prete a ajouter au tableau de traces
 */
export function buildLocationTrace(dataLongitudes) {
  const dataIs0to360 = dataLongitudes.some(l => l > 180);

  return {
    type: 'scatter',
    mode: 'markers+text',
    x: MARS_LOCATIONS.map(l => (dataIs0to360 && l.lon < 0 ? l.lon + 360 : l.lon)),
    y: MARS_LOCATIONS.map(l => l.lat),
    text: MARS_LOCATIONS.map(l => l.name),
    textposition: 'top center',
    textfont: { size: 9, color: 'white', family: 'Rajdhani' },
    marker: {
      size: 9,
      color: MARS_LOCATIONS.map(l => LOCATION_COLORS[l.type]),
      symbol: MARS_LOCATIONS.map(l => LOCATION_SYMBOLS[l.type]),
      line: { color: 'white', width: 1 },
    },
    hovertemplate: '<b>%{text}</b><br>Lat: %{y}° | Lon: %{x}°<extra></extra>',
    name: "Points d'interet",
    showlegend: false,
  };
}
