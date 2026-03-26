/**
 * Contenu textuel de la page d'accueil — version francaise.
 * Seuls les textes sont definis ici ; la structure (icones, routes,
 * couleurs, constantes numeriques) est dans home.structure.js.
 */
import {
  HERO_TITLE, WHY_REASON_ICONS, FEATURES_STRUCTURE,
  STATS_STRUCTURE, TIMELINE_STRUCTURE, BELGIUM_ITEMS_STRUCTURE,
} from './home.structure';

const WHY_REASONS_TEXT = [
  { title: "L\u2019histoire de l\u2019eau",  body: "Les donn\u00e9es atmosph\u00e9riques r\u00e9v\u00e8lent comment une plan\u00e8te autrefois humide a perdu ses oc\u00e9ans. Un miroir direct de l\u2019\u00e9volution climatique terrestre." },
  { title: "Exploration humaine",            body: "Comprendre les cycles thermiques et les temp\u00eates de poussi\u00e8re est essentiel pour concevoir les syst\u00e8mes de survie des futures bases habit\u00e9es." },
  { title: "Science comparative",            body: "\u00c9tudier une atmosph\u00e8re diff\u00e9rente permet de valider nos mod\u00e8les climatiques et de mieux comprendre les m\u00e9canismes du changement climatique terrestre." },
];

const FEATURES_TEXT = [
  { title: 'Slice 2D',          tag: 'Carte plan\u00e9taire',     body: "Distribution lat\u00d7lon d\u2019une variable atmosph\u00e9rique \u00e0 une altitude et un instant donn\u00e9s. Vue globale de Mars en un coup d\u2019\u0153il." },
  { title: 'Animation',         tag: 'Cycle diurne',              body: "\u00c9volution d\u2019une variable sur 48 pas de temps cons\u00e9cutifs \u2014 un sol martien complet anim\u00e9 en quelques secondes." },
  { title: 'S\u00e9rie temporelle', tag: 'Analyse locale',        body: "Cycle diurne complet en un point g\u00e9ographique et une altitude pr\u00e9cis. D\u00e9tectez les signatures locales et les extr\u00eames." },
  { title: 'Profil vertical',   tag: 'Structure verticale',       body: "Distribution d\u2019une variable sur les 103 niveaux d\u2019altitude. Structure thermique et dynamique compl\u00e8te de la colonne." },
  { title: 'Coupe verticale',   tag: 'Coupe méridionale',    body: "Vue en coupe de l\u2019atmosphère à longitude ou latitude fixée. La structure globale de l\u2019atmosphère en un regard." },
  { title: 'Hovmöller',         tag: 'Temps × espace',       body: "Évolution temporelle moyennée sur une dimension spatiale. Révèle la propagation des ondes diurnes et les structures planétaires." },
  { title: 'Moyenne zonale',    tag: 'Lat × altitude',       body: "Structure verticale moyennée en longitude. La vue classique pour étudier les cellules de Hadley, jets et contrastes thermiques." },
  { title: 'Rose des vents',   tag: 'Climatologie du vent', body: "Diagramme polaire de la distribution direction/vitesse du vent sur un cycle diurne complet. Révèle les régimes de vent dominants en un point donné." },
  { title: 'Profil temporel',  tag: 'Grille temps\u00d7altitude', body: "Visualisez l\u2019\u00e9volution d\u2019une variable sur le cycle diurne \u00e0 tous les niveaux d\u2019altitude. Id\u00e9al pour \u00e9tudier les mar\u00e9es thermiques et ondes atmosph\u00e9riques." },
  { title: 'Différence',       tag: 'Comparaison de datasets', body: "Soustrayez deux datasets pour révéler les anomalies et différences. Une palette divergente symétrique met en évidence les écarts positifs et négatifs." },
  { title: 'Explorer',          tag: 'Interface complète',   body: "Vue tout-en-un pour les utilisateurs avancés\u00a0: dataset, variable, type de visualisation et export dans un seul écran. La puissance de toutes les vues, sans navigation." },
];

const STATS_TEXT = [
  { label: "Ann\u00e9e martienne",         sub: "1,88 ann\u00e9e terrestre",             earthLabel: '365\u2009j (Terre)'        },
  { label: "Pression atmosph\u00e9rique",  sub: "0,6\u2009% de la Terre (1\u202f013 mb)", earthLabel: '1\u202f013\u2009mb (Terre)' },
  { label: "Temp\u00e9rature moyenne",     sub: "Min. \u2212143\u00b0C \u00b7 Max. +35\u00b0C", earthLabel: '+15\u00b0C (Terre)'  },
  { label: "Oxyg\u00e8ne (O\u2082)",      sub: "Irrespirable sans combinaison",         earthLabel: '21\u2009% (Terre)'          },
  { label: "Gravit\u00e9 de surface",      sub: "38\u2009% de la gravit\u00e9 terrestre", earthLabel: '9,81\u2009m/s\u00b2 (Terre)' },
  { label: "Diam\u00e8tre",               sub: "53\u2009% du diam\u00e8tre terrestre",   earthLabel: '12\u202f742\u2009km (Terre)' },
  { label: "Lunes",                        sub: "Phobos et Deimos",                      earthLabel: '1 lune (Terre)'             },
  { label: "Dur\u00e9e du sol",            sub: "37 min de plus que la Terre",            earthLabel: '24h00 (Terre)'              },
];

const TIMELINE_TEXT = [
  { desc: "Premier survol r\u00e9ussi de Mars. 22 photos historiques transmises en 8 heures. D\u00e9couverte\u00a0: pas de champ magn\u00e9tique global, atmosph\u00e8re 100\u00d7 plus t\u00e9nue qu\u2019anticip\u00e9.",                         discovery: "Premi\u00e8re vue rapproch\u00e9e de Mars" },
  { desc: "Premiers atterrissages r\u00e9ussis sur Mars. Analyse chimique du sol. Recherche de signes de vie \u2014 r\u00e9sultats ambigus, encore d\u00e9battus aujourd\u2019hui.",                                                                  discovery: "Premiers atterrisseurs op\u00e9rationnels" },
  { desc: "Premier rover Sojourner (10\u2009kg, pr\u00e9vu 7 jours, actif 83 jours). Analyses g\u00e9ochimiques des roches. Confirme l\u2019ancienne pr\u00e9sence d\u2019eau liquide.",                                                            discovery: "Premier rover martien" },
  { desc: "Rovers MER pr\u00e9vus 90 jours. Spirit actif 6 ans, Opportunity 15 ans et 45\u2009km parcourus. Preuves irr\u00e9futables d\u2019eau pass\u00e9e.",                                                                                     discovery: "45 km parcourus sur Mars" },
  { desc: "Rover MSL toujours actif. D\u00e9tection de mol\u00e9cules organiques complexes et de m\u00e9thane saisonnier. Mesure de la radioactivit\u00e9 pour pr\u00e9parer les missions habit\u00e9es.",                                           discovery: "Mol\u00e9cules organiques d\u00e9tect\u00e9es" },
  { desc: "Orbiteur TGO de l\u2019ESA. L\u2019instrument NOMAD (PI belge, BIRA-IASB) analyse la chimie atmosph\u00e9rique en d\u00e9tail. GEM-Mars sert de mod\u00e8le de r\u00e9f\u00e9rence pour ses mesures.",                                   discovery: "NOMAD\u00a0: chimie atmosph\u00e9rique fine" },
  { desc: "Rover Perseverance produit de l\u2019O\u2082 via MOXIE. Ingenuity r\u00e9alise 72 vols motoris\u00e9s sur une autre plan\u00e8te. Pr\u00e9l\u00e8vements en vue d\u2019un retour sur Terre.",                                             discovery: "Premier vol motoris\u00e9 extraterrestre" },
];

const BELGIUM_TEXT = [
  { title: "GEM-Mars \u2014 le mod\u00e8le",     body: "Le General Environment Model for Mars (GEM-Mars) est d\u00e9velopp\u00e9 et maintenu \u00e0 l\u2019IASB-BIRA de Bruxelles. Toutes les donn\u00e9es visualis\u00e9es ici en sont issues.", detail: "Institut royal d\u2019A\u00e9ronomie Spatiale de Belgique" },
  { title: "NOMAD sur ExoMars",                   body: "L\u2019instrument NOMAD \u00e0 bord de l\u2019orbiteur TGO (ESA, 2016) est dirig\u00e9 par la chercheuse Ann Carine Vandaele de l\u2019IASB-BIRA. Il analyse la chimie de l\u2019atmosph\u00e8re.", detail: "Principal Investigator belge" },
  { title: "R\u00e9seau international",            body: "L\u2019IASB-BIRA collabore avec le LMD (Paris), l\u2019Open University (Oxford) et l\u2019ESA. La Belgique est un acteur cl\u00e9 de la m\u00e9t\u00e9orologie martienne europ\u00e9enne.", detail: "Collaborations LMD \u00b7 OU \u00b7 ESA" },
  { title: "Von Karman Institute",                 body: "Le VKI (Rhode-Saint-Gen\u00e8se) \u00e9tudie la dynamique des fluides et l\u2019a\u00e9rodynamique d\u2019entr\u00e9e atmosph\u00e9rique. Ses travaux sur les boucliers thermiques sont essentiels pour les missions Mars.", detail: "Rhode-Saint-Gen\u00e8se, Belgique" },
  { title: "Spacebel",                             body: "Soci\u00e9t\u00e9 belge sp\u00e9cialis\u00e9e dans les logiciels de vol spatiaux. Spacebel a contribu\u00e9 aux syst\u00e8mes embarqu\u00e9s de missions ESA, dont Mars Express, en orbit autour de Mars depuis 2003.", detail: "Li\u00e8ge \u00b7 Logiciels de vol ESA" },
  { title: "Rosalind Franklin 2028",               body: "Des chercheurs belges de l\u2019IASB-BIRA sont impliqu\u00e9s dans le rover ExoMars Rosalind Franklin, dont le lancement est pr\u00e9vu en 2028. Il devra forer jusqu\u2019\u00e0 2\u2009m de profondeur pour chercher des traces de vie.", detail: "ExoMars 2028 \u00b7 ESA / Roscosmos" },
];

export const homeContent = {
  hero: {
    title: HERO_TITLE,
    subtitle: "Exploration des donn\u00e9es atmosph\u00e9riques martiennes",
    description: "Une plateforme de visualisation interactive bas\u00e9e sur le mod\u00e8le climatique GEM-Mars. Explorez la temp\u00e9rature, les vents, la poussi\u00e8re et bien plus encore.",
    cta: "D\u00e9marrer l\u2019exploration",
  },
  why: {
    tag: "Int\u00e9r\u00eat scientifique",
    title: "Pourquoi \u00e9tudier Mars\u00a0?",
    quote: "Mars est le laboratoire naturel le plus accessible pour comprendre l\u2019\u00e9volution des plan\u00e8tes rocheuses et l\u2019histoire de l\u2019eau dans notre syst\u00e8me solaire.",
    reasons: WHY_REASON_ICONS.map((icon, i) => ({ icon, ...WHY_REASONS_TEXT[i] })),
  },
  solarSystem: {
    tag: "Syst\u00e8me solaire",
    title: "Mars dans le syst\u00e8me solaire",
    subtitle: "4\u1d49 plan\u00e8te depuis le Soleil \u2014 entre la Terre et la ceinture d\u2019ast\u00e9ro\u00efdes. Survolez les plan\u00e8tes pour d\u00e9couvrir leurs caract\u00e9ristiques.",
  },
  features: FEATURES_STRUCTURE.map((s, i) => ({ ...s, ...FEATURES_TEXT[i] })),
  stats:    STATS_STRUCTURE.map((s, i) => ({ ...s, ...STATS_TEXT[i] })),
  timeline: TIMELINE_STRUCTURE.map((s, i) => ({ ...s, ...TIMELINE_TEXT[i] })),
  belgium: {
    tag: "Fait en Belgique",
    title: "La Belgique et Mars",
    subtitle: "Derri\u00e8re chaque donn\u00e9e de Mars Climate Viewer se trouve un mod\u00e8le d\u00e9velopp\u00e9 \u00e0 Bruxelles par l\u2019IASB-BIRA.",
    items: BELGIUM_ITEMS_STRUCTURE.map((s, i) => ({ ...s, ...BELGIUM_TEXT[i] })),
  },
};
