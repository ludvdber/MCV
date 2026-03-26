/**
 * Home page text content — English version.
 * Only texts are defined here; structure (icons, routes,
 * colors, numeric constants) is in home.structure.js.
 */
import {
  HERO_TITLE, WHY_REASON_ICONS, FEATURES_STRUCTURE,
  STATS_STRUCTURE, TIMELINE_STRUCTURE, BELGIUM_ITEMS_STRUCTURE,
} from './home.structure';

const WHY_REASONS_TEXT = [
  { title: "The history of water",  body: "Atmospheric data reveal how a once-wet planet lost its oceans. A direct mirror of Earth\u2019s climate evolution." },
  { title: "Human exploration",     body: "Understanding thermal cycles and dust storms is essential for designing the life-support systems of future inhabited bases." },
  { title: "Comparative science",   body: "Studying a different atmosphere allows us to validate our climate models and better understand the mechanisms of climate change on Earth." },
];

const FEATURES_TEXT = [
  { title: 'Slice 2D',          tag: 'Planetary map',           body: "Lat\u00d7lon distribution of an atmospheric variable at a given altitude and time step. A global view of Mars at a glance." },
  { title: 'Animation',         tag: 'Diurnal cycle',           body: "Evolution of a variable over 48 consecutive time steps \u2014 a full Martian sol animated in a few seconds." },
  { title: 'Time series',       tag: 'Local analysis',          body: "Complete diurnal cycle at a specific geographic point and altitude. Detect local signatures and extremes." },
  { title: 'Vertical profile',  tag: 'Vertical structure',      body: "Distribution of a variable across the 103 altitude levels. Complete thermal and dynamic structure of the column." },
  { title: 'Cross section',     tag: 'Meridional cross section', body: "Cross-sectional view of the atmosphere at a fixed longitude or latitude. The global structure of the atmosphere at a glance." },
  { title: 'Hovmöller',         tag: 'Time × space',             body: "Temporal evolution averaged over one spatial dimension. Reveals diurnal wave propagation and planetary-scale patterns." },
  { title: 'Zonal Mean',        tag: 'Lat × altitude',           body: "Longitude-averaged vertical structure. The classic view for studying Hadley cells, jets and thermal contrasts." },
  { title: 'Wind Rose',        tag: 'Wind climatology',         body: "Polar diagram of wind direction and speed distribution over a full diurnal cycle. Reveals dominant wind regimes at a given point." },
  { title: 'Temporal profile', tag: 'Time\u00d7altitude grid',   body: "Visualize how a variable evolves over the diurnal cycle at all altitude levels. Ideal for studying thermal tides and atmospheric waves." },
  { title: 'Difference',       tag: 'Dataset comparison',       body: "Subtract two datasets to reveal anomalies and differences. Symmetric diverging palette highlights positive and negative deviations." },
  { title: 'Explorer',          tag: 'Full interface',           body: "All-in-one view for advanced users\u00a0: dataset, variable, visualization type and export on a single screen. The power of all views, without navigation." },
];

const STATS_TEXT = [
  { label: "Martian year",            sub: "1.88 Earth years",                      earthLabel: '365\u2009d (Earth)'        },
  { label: "Atmospheric pressure",    sub: "0.6\u2009% of Earth (1\u202f013 mb)",   earthLabel: '1\u202f013\u2009mb (Earth)' },
  { label: "Average temperature",     sub: "Min. \u2212143\u00b0C \u00b7 Max. +35\u00b0C", earthLabel: '+15\u00b0C (Earth)'  },
  { label: "Oxygen (O\u2082)",        sub: "Unbreathable without a suit",           earthLabel: '21\u2009% (Earth)'          },
  { label: "Surface gravity",         sub: "38\u2009% of Earth\u2019s gravity",     earthLabel: '9.81\u2009m/s\u00b2 (Earth)' },
  { label: "Diameter",                sub: "53\u2009% of Earth\u2019s diameter",    earthLabel: '12\u202f742\u2009km (Earth)' },
  { label: "Moons",                   sub: "Phobos and Deimos",                     earthLabel: '1 moon (Earth)'             },
  { label: "Sol duration",            sub: "37 min longer than Earth",              earthLabel: '24h00 (Earth)'              },
];

const TIMELINE_TEXT = [
  { desc: "First successful flyby of Mars. 22 historic photos transmitted in 8 hours. Discovery\u00a0: no global magnetic field, atmosphere 100\u00d7 thinner than expected.",                         discovery: "First close-up view of Mars" },
  { desc: "First successful landings on Mars. Chemical analysis of the soil. Search for signs of life \u2014 ambiguous results, still debated today.",                                                  discovery: "First operational landers" },
  { desc: "First rover Sojourner (10\u2009kg, planned for 7 days, active for 83 days). Geochemical rock analyses. Confirmed the ancient presence of liquid water.",                                    discovery: "First Martian rover" },
  { desc: "MER rovers planned for 90 days. Spirit active for 6 years, Opportunity for 15 years and 45\u2009km traveled. Irrefutable evidence of past water.",                                         discovery: "45 km traveled on Mars" },
  { desc: "MSL rover still active. Detection of complex organic molecules and seasonal methane. Radiation measurements to prepare crewed missions.",                                                    discovery: "Organic molecules detected" },
  { desc: "ESA\u2019s TGO orbiter. The NOMAD instrument (Belgian PI, BIRA-IASB) analyzes atmospheric chemistry in detail. GEM-Mars serves as a reference model for its measurements.",                 discovery: "NOMAD\u00a0: detailed atmospheric chemistry" },
  { desc: "Perseverance rover produced O\u2082 via MOXIE. Ingenuity completed 72 powered flights on another planet. Samples collected for future return to Earth.",                                     discovery: "First extraterrestrial powered flight" },
];

const BELGIUM_TEXT = [
  { title: "GEM-Mars \u2014 the model",      body: "The General Environment Model for Mars (GEM-Mars) is developed and maintained at IASB-BIRA in Brussels. All data visualized here are derived from it.", detail: "Royal Belgian Institute for Space Aeronomy" },
  { title: "NOMAD on ExoMars",                body: "The NOMAD instrument aboard the TGO orbiter (ESA, 2016) is led by researcher Ann Carine Vandaele of IASB-BIRA. It analyzes the chemistry of the atmosphere.", detail: "Belgian Principal Investigator" },
  { title: "International network",           body: "IASB-BIRA collaborates with LMD (Paris), the Open University (Oxford) and ESA. Belgium is a key player in European Martian meteorology.", detail: "Collaborations LMD \u00b7 OU \u00b7 ESA" },
  { title: "Von Karman Institute",            body: "VKI (Rhode-Saint-Gen\u00e8se) studies fluid dynamics and atmospheric entry aerodynamics. Its work on heat shields is essential for Mars missions.", detail: "Rhode-Saint-Gen\u00e8se, Belgium" },
  { title: "Spacebel",                        body: "A Belgian company specializing in space flight software. Spacebel contributed to the onboard systems of ESA missions, including Mars Express, in orbit around Mars since 2003.", detail: "Li\u00e8ge \u00b7 ESA flight software" },
  { title: "Rosalind Franklin 2028",          body: "Belgian researchers from IASB-BIRA are involved in the ExoMars Rosalind Franklin rover, scheduled for launch in 2028. It will drill up to 2\u2009m deep to search for traces of life.", detail: "ExoMars 2028 \u00b7 ESA / Roscosmos" },
];

export const homeContent = {
  hero: {
    title: HERO_TITLE,
    subtitle: "Exploring Martian atmospheric data",
    description: "An interactive visualization platform based on the GEM-Mars climate model. Explore temperature, winds, dust and much more.",
    cta: "Start exploring",
  },
  why: {
    tag: "Scientific interest",
    title: "Why study Mars\u00a0?",
    quote: "Mars is the most accessible natural laboratory for understanding the evolution of rocky planets and the history of water in our solar system.",
    reasons: WHY_REASON_ICONS.map((icon, i) => ({ icon, ...WHY_REASONS_TEXT[i] })),
  },
  solarSystem: {
    tag: "Solar system",
    title: "Mars in the solar system",
    subtitle: "4\u1d49 planet from the Sun \u2014 between Earth and the asteroid belt. Hover over the planets to discover their characteristics.",
  },
  features: FEATURES_STRUCTURE.map((s, i) => ({ ...s, ...FEATURES_TEXT[i] })),
  stats:    STATS_STRUCTURE.map((s, i) => ({ ...s, ...STATS_TEXT[i] })),
  timeline: TIMELINE_STRUCTURE.map((s, i) => ({ ...s, ...TIMELINE_TEXT[i] })),
  belgium: {
    tag: "Made in Belgium",
    title: "Belgium and Mars",
    subtitle: "Behind every data point in Mars Climate Viewer lies a model developed in Brussels by IASB-BIRA.",
    items: BELGIUM_ITEMS_STRUCTURE.map((s, i) => ({ ...s, ...BELGIUM_TEXT[i] })),
  },
};
