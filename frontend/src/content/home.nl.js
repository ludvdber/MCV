/**
 * Tekstinhoud van de startpagina — Nederlandse versie.
 * Alleen teksten worden hier gedefinieerd; structuur (iconen, routes,
 * kleuren, numerieke constanten) staat in home.structure.js.
 */
import {
  HERO_TITLE, WHY_REASON_ICONS, FEATURES_STRUCTURE,
  STATS_STRUCTURE, TIMELINE_STRUCTURE, BELGIUM_ITEMS_STRUCTURE,
} from './home.structure';

const WHY_REASONS_TEXT = [
  { title: "De geschiedenis van water",  body: "Atmosferische gegevens onthullen hoe een ooit natte planeet haar oce\u00e4nen verloor. Een directe spiegel van de klimaatverandering op Aarde." },
  { title: "Menselijke exploratie",      body: "Inzicht in thermische cycli en stofstormen is essentieel om de levensondersteunende systemen van toekomstige bewoonde bases te ontwerpen." },
  { title: "Vergelijkende wetenschap",   body: "Het bestuderen van een andere atmosfeer maakt het mogelijk onze klimaatmodellen te valideren en de mechanismen van klimaatverandering op Aarde beter te begrijpen." },
];

const FEATURES_TEXT = [
  { title: 'Slice 2D',              tag: 'Planetaire kaart',        body: "Lat\u00d7lon-verdeling van een atmosferische variabele op een gegeven hoogte en tijdstip. Globaal overzicht van Mars in \u00e9\u00e9n oogopslag." },
  { title: 'Animation',             tag: 'Dagcyclus',               body: "Evolutie van een variabele over 48 opeenvolgende tijdstappen \u2014 een volledige Martiaanse sol geanimeerd in enkele seconden." },
  { title: 'Tijdreeks',             tag: 'Lokale analyse',          body: "Volledige dagcyclus op een geografisch punt en een precieze hoogte. Detecteer lokale signaturen en extremen." },
  { title: 'Verticaal profiel',     tag: 'Verticale structuur',     body: "Verdeling van een variabele over de 103 hoogteniveaus. Volledige thermische en dynamische structuur van de kolom." },
  { title: 'Verticale doorsnede',   tag: 'Meridionale doorsnede',   body: "Dwarsdoorsnede van de atmosfeer bij een vaste lengte- of breedtegraad. De globale structuur van de atmosfeer in één blik." },
  { title: 'Hovmöller',             tag: 'Tijd × ruimte',           body: "Tijdsontwikkeling gemiddeld over één ruimtelijke dimensie. Onthult dagelijkse golfvoortplanting en planetaire patronen." },
  { title: 'Zonaal gemiddelde',     tag: 'Lat × hoogte',            body: "Verticale structuur gemiddeld over lengtegraad. De klassieke weergave voor Hadley-cellen, jets en thermische contrasten." },
  { title: 'Windroos',             tag: 'Windklimatologie',        body: "Polair diagram van windrichting en snelheidsverdeling over een volledige dagcyclus. Onthult dominante windregimes op een gegeven punt." },
  { title: 'Temporeel profiel',    tag: 'Tijd\u00d7hoogte raster',  body: "Visualiseer hoe een variabele evolueert over de dagcyclus op alle hoogteniveaus. Ideaal voor het bestuderen van thermische getijden en atmosferische golven." },
  { title: 'Verschil',             tag: 'Dataset vergelijking',    body: "Trek twee datasets van elkaar af om anomalieën en verschillen te onthullen. Een symmetrisch divergerend palet benadrukt positieve en negatieve afwijkingen." },
  { title: 'Verkennen',             tag: 'Volledige interface',     body: "Alles-in-één-weergave voor gevorderde gebruikers\u00a0: dataset, variabele, visualisatietype en export op één scherm. De kracht van alle weergaven, zonder navigatie." },
];

const STATS_TEXT = [
  { label: "Martiaans jaar",              sub: "1,88 aardse jaar",                        earthLabel: '365\u2009d (Aarde)'        },
  { label: "Atmosferische druk",           sub: "0,6\u2009% van de Aarde (1\u202f013 mb)", earthLabel: '1\u202f013\u2009mb (Aarde)' },
  { label: "Gemiddelde temperatuur",       sub: "Min. \u2212143\u00b0C \u00b7 Max. +35\u00b0C", earthLabel: '+15\u00b0C (Aarde)'  },
  { label: "Zuurstof (O\u2082)",           sub: "Niet adembaar zonder ruimtepak",          earthLabel: '21\u2009% (Aarde)'          },
  { label: "Oppervlaktezwaartekracht",     sub: "38\u2009% van de aardse zwaartekracht",   earthLabel: '9,81\u2009m/s\u00b2 (Aarde)' },
  { label: "Diameter",                     sub: "53\u2009% van de aardse diameter",        earthLabel: '12\u202f742\u2009km (Aarde)' },
  { label: "Manen",                        sub: "Phobos en Deimos",                        earthLabel: '1 maan (Aarde)'             },
  { label: "Duur van een sol",             sub: "37 min langer dan op Aarde",              earthLabel: '24h00 (Aarde)'              },
];

const TIMELINE_TEXT = [
  { desc: "Eerste geslaagde scheervlucht langs Mars. 22 historische foto\u2019s verzonden in 8 uur. Ontdekking\u00a0: geen globaal magnetisch veld, atmosfeer 100\u00d7 dunner dan verwacht.",          discovery: "Eerste close-upbeeld van Mars" },
  { desc: "Eerste geslaagde landingen op Mars. Chemische analyse van de bodem. Zoektocht naar tekenen van leven \u2014 dubbelzinnige resultaten, tot op vandaag bediscussieerd.",                        discovery: "Eerste operationele landers" },
  { desc: "Eerste rover Sojourner (10\u2009kg, gepland 7 dagen, actief 83 dagen). Geochemische analyses van rotsen. Bevestigt de vroegere aanwezigheid van vloeibaar water.",                          discovery: "Eerste Marsrover" },
  { desc: "MER-rovers gepland voor 90 dagen. Spirit 6 jaar actief, Opportunity 15 jaar en 45\u2009km afgelegd. Onweerlegbaar bewijs van water in het verleden.",                                       discovery: "45 km afgelegd op Mars" },
  { desc: "MSL-rover nog steeds actief. Detectie van complexe organische moleculen en seizoensgebonden methaan. Meting van straling ter voorbereiding van bemande missies.",                            discovery: "Organische moleculen gedetecteerd" },
  { desc: "TGO-orbiter van de ESA. Het instrument NOMAD (Belgische PI, BIRA-IASB) analyseert de atmosferische chemie in detail. GEM-Mars dient als referentiemodel voor zijn metingen.",               discovery: "NOMAD\u00a0: gedetailleerde atmosferische chemie" },
  { desc: "Rover Perseverance produceert O\u2082 via MOXIE. Ingenuity voert 72 gemotoriseerde vluchten uit op een andere planeet. Staalnames met het oog op terugkeer naar de Aarde.",                  discovery: "Eerste gemotoriseerde buitenaardse vlucht" },
];

const BELGIUM_TEXT = [
  { title: "GEM-Mars \u2014 het model",       body: "Het General Environment Model for Mars (GEM-Mars) wordt ontwikkeld en onderhouden aan het IASB-BIRA in Brussel. Alle hier gevisualiseerde gegevens zijn ervan afkomstig.", detail: "Koninklijk Belgisch Instituut voor Ruimte-A\u00ebronomie" },
  { title: "NOMAD op ExoMars",                 body: "Het instrument NOMAD aan boord van de TGO-orbiter (ESA, 2016) wordt geleid door onderzoekster Ann Carine Vandaele van het IASB-BIRA. Het analyseert de chemie van de atmosfeer.", detail: "Belgische Principal Investigator" },
  { title: "Internationaal netwerk",           body: "Het IASB-BIRA werkt samen met het LMD (Parijs), de Open University (Oxford) en de ESA. Belgi\u00eb is een sleutelspeler in de Europese Martiaanse meteorologie.", detail: "Samenwerkingen LMD \u00b7 OU \u00b7 ESA" },
  { title: "Von Karman Institute",             body: "Het VKI (Sint-Genesius-Rode) bestudeert de vloeistofdynamica en de a\u00ebrodynamica van atmosferische intrede. Zijn onderzoek naar hitteschilden is essentieel voor Marsmissies.", detail: "Sint-Genesius-Rode, Belgi\u00eb" },
  { title: "Spacebel",                         body: "Belgisch bedrijf gespecialiseerd in ruimtevaartsoftware. Spacebel heeft bijgedragen aan de boordcomputers van ESA-missies, waaronder Mars Express, in een baan rond Mars sinds 2003.", detail: "Luik \u00b7 ESA-vluchtsoftware" },
  { title: "Rosalind Franklin 2028",           body: "Belgische onderzoekers van het IASB-BIRA zijn betrokken bij de ExoMars-rover Rosalind Franklin, waarvan de lancering gepland is voor 2028. Hij moet tot 2\u2009m diep boren om sporen van leven te zoeken.", detail: "ExoMars 2028 \u00b7 ESA / Roscosmos" },
];

export const homeContent = {
  hero: {
    title: HERO_TITLE,
    subtitle: "Verkenning van atmosferische gegevens van Mars",
    description: "Een interactief visualisatieplatform gebaseerd op het klimaatmodel GEM-Mars. Verken temperatuur, wind, stof en nog veel meer.",
    cta: "Start de verkenning",
  },
  why: {
    tag: "Wetenschappelijk belang",
    title: "Waarom Mars bestuderen\u00a0?",
    quote: "Mars is het meest toegankelijke natuurlijke laboratorium om de evolutie van rotsachtige planeten en de geschiedenis van water in ons zonnestelsel te begrijpen.",
    reasons: WHY_REASON_ICONS.map((icon, i) => ({ icon, ...WHY_REASONS_TEXT[i] })),
  },
  solarSystem: {
    tag: "Zonnestelsel",
    title: "Mars in het zonnestelsel",
    subtitle: "4\u1d49 planeet vanaf de Zon \u2014 tussen de Aarde en de asteroïdengordel. Beweeg over de planeten om hun kenmerken te ontdekken.",
  },
  features: FEATURES_STRUCTURE.map((s, i) => ({ ...s, ...FEATURES_TEXT[i] })),
  stats:    STATS_STRUCTURE.map((s, i) => ({ ...s, ...STATS_TEXT[i] })),
  timeline: TIMELINE_STRUCTURE.map((s, i) => ({ ...s, ...TIMELINE_TEXT[i] })),
  belgium: {
    tag: "Gemaakt in Belgi\u00eb",
    title: "Belgi\u00eb en Mars",
    subtitle: "Achter elk gegeven van Mars Climate Viewer schuilt een model ontwikkeld in Brussel door het IASB-BIRA.",
    items: BELGIUM_ITEMS_STRUCTURE.map((s, i) => ({ ...s, ...BELGIUM_TEXT[i] })),
  },
};
