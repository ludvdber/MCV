/**
 * Textinhalt der Startseite — Deutsche Version.
 * Nur Texte werden hier definiert; die Struktur (Icons, Routen,
 * Farben, numerische Konstanten) ist in home.structure.js.
 */
import {
  HERO_TITLE, WHY_REASON_ICONS, FEATURES_STRUCTURE,
  STATS_STRUCTURE, TIMELINE_STRUCTURE, BELGIUM_ITEMS_STRUCTURE,
} from './home.structure';

const WHY_REASONS_TEXT = [
  { title: "Die Geschichte des Wassers",  body: "Atmosphärische Daten zeigen, wie ein einst feuchter Planet seine Ozeane verlor. Ein direkter Spiegel der irdischen Klimaentwicklung." },
  { title: "Menschliche Erforschung",     body: "Das Verständnis thermischer Zyklen und Staubstürme ist entscheidend für die Entwicklung der Lebenserhaltungssysteme zukünftiger bewohnter Basen." },
  { title: "Vergleichende Wissenschaft",  body: "Die Untersuchung einer anderen Atmosphäre ermöglicht es, unsere Klimamodelle zu validieren und die Mechanismen des Klimawandels auf der Erde besser zu verstehen." },
];

const FEATURES_TEXT = [
  { title: '2D-Schnitt',            tag: 'Planetenkarte',           body: "Lat×Lon-Verteilung einer atmosphärischen Variablen bei gegebener Höhe und Zeitschritt. Globaler Überblick über den Mars auf einen Blick." },
  { title: 'Animation',             tag: 'Tageszyklus',             body: "Entwicklung einer Variablen über 48 aufeinanderfolgende Zeitschritte — ein vollständiger Mars-Sol in wenigen Sekunden animiert." },
  { title: 'Zeitreihe',             tag: 'Lokale Analyse',          body: "Vollständiger Tageszyklus an einem geographischen Punkt und einer präzisen Höhe. Erkennung lokaler Signaturen und Extremwerte." },
  { title: 'Vertikalprofil',        tag: 'Vertikale Struktur',      body: "Verteilung einer Variablen über die 103 Höhenstufen. Vollständige thermische und dynamische Struktur der Säule." },
  { title: 'Vertikalschnitt',       tag: 'Meridionaler Schnitt',    body: "Querschnitt der Atmosphäre bei festem Längen- oder Breitengrad. Die globale Struktur der Atmosphäre auf einen Blick." },
  { title: 'Hovmöller',             tag: 'Zeit × Raum',             body: "Zeitliche Entwicklung gemittelt über eine räumliche Dimension. Zeigt die Ausbreitung von Tageswellen und planetare Muster." },
  { title: 'Zonales Mittel',        tag: 'Lat × Höhe',              body: "Vertikale Struktur gemittelt über den Längengrad. Die klassische Ansicht für Hadley-Zellen, Jets und thermische Kontraste." },
  { title: 'Windrose',             tag: 'Windklimatologie',        body: "Polardiagramm der Windrichtungs- und Geschwindigkeitsverteilung über einen vollständigen Tageszyklus. Zeigt dominante Windregime an einem gegebenen Punkt." },
  { title: 'Temporales Profil',    tag: 'Zeit\u00d7H\u00f6he Raster', body: "Visualisieren Sie, wie sich eine Variable \u00fcber den Tageszyklus auf allen H\u00f6henstufen entwickelt. Ideal zur Untersuchung thermischer Gezeiten und atmosph\u00e4rischer Wellen." },
  { title: 'Differenz',            tag: 'Datensatzvergleich',      body: "Subtrahieren Sie zwei Datensätze, um Anomalien und Unterschiede aufzudecken. Eine symmetrisch divergierende Palette hebt positive und negative Abweichungen hervor." },
  { title: 'Erkunden',              tag: 'Vollständige Oberfläche', body: "Alles-in-einem-Ansicht für fortgeschrittene Benutzer\u00a0: Datensatz, Variable, Visualisierungstyp und Export auf einem Bildschirm. Die Leistung aller Ansichten, ohne Navigation." },
];

const STATS_TEXT = [
  { label: "Marsianisches Jahr",          sub: "1,88 Erdjahre",                            earthLabel: '365\u2009T. (Erde)'         },
  { label: "Atmosphärendruck",            sub: "0,6\u2009% der Erde (1\u202f013 mb)",      earthLabel: '1\u202f013\u2009mb (Erde)'   },
  { label: "Durchschnittstemperatur",     sub: "Min. \u2212143\u00b0C \u00b7 Max. +35\u00b0C", earthLabel: '+15\u00b0C (Erde)'    },
  { label: "Sauerstoff (O\u2082)",        sub: "Nicht atembar ohne Raumanzug",              earthLabel: '21\u2009% (Erde)'            },
  { label: "Oberflächengravitation",      sub: "38\u2009% der irdischen Gravitation",       earthLabel: '9,81\u2009m/s\u00b2 (Erde)' },
  { label: "Durchmesser",                sub: "53\u2009% des irdischen Durchmessers",      earthLabel: '12\u202f742\u2009km (Erde)'  },
  { label: "Monde",                       sub: "Phobos und Deimos",                         earthLabel: '1 Mond (Erde)'              },
  { label: "Dauer eines Sols",            sub: "37 Min. länger als auf der Erde",           earthLabel: '24h00 (Erde)'               },
];

const TIMELINE_TEXT = [
  { desc: "Erster erfolgreicher Vorbeiflug am Mars. 22 historische Fotos in 8 Stunden übertragen. Entdeckung\u00a0: kein globales Magnetfeld, Atmosphäre 100× dünner als erwartet.",                                discovery: "Erste Nahaufnahme des Mars" },
  { desc: "Erste erfolgreiche Landungen auf dem Mars. Chemische Bodenanalyse. Suche nach Lebenszeichen — mehrdeutige Ergebnisse, bis heute diskutiert.",                                                              discovery: "Erste betriebsfähige Lander" },
  { desc: "Erster Rover Sojourner (10\u2009kg, geplant für 7 Tage, aktiv 83 Tage). Geochemische Gesteinsanalysen. Bestätigt die einstige Anwesenheit von flüssigem Wasser.",                                        discovery: "Erster Mars-Rover" },
  { desc: "MER-Rover für 90 Tage geplant. Spirit 6 Jahre aktiv, Opportunity 15 Jahre und 45\u2009km zurückgelegt. Unwiderlegbare Beweise für vergangenes Wasser.",                                                   discovery: "45 km auf dem Mars zurückgelegt" },
  { desc: "MSL-Rover noch aktiv. Nachweis komplexer organischer Moleküle und saisonalen Methans. Strahlungsmessungen zur Vorbereitung bemannter Missionen.",                                                         discovery: "Organische Moleküle nachgewiesen" },
  { desc: "ESA-Orbiter TGO. Das Instrument NOMAD (belgischer PI, BIRA-IASB) analysiert die atmosphärische Chemie im Detail. GEM-Mars dient als Referenzmodell für seine Messungen.",                                  discovery: "NOMAD\u00a0: detaillierte atmosphärische Chemie" },
  { desc: "Rover Perseverance erzeugt O\u2082 mit MOXIE. Ingenuity absolviert 72 motorisierte Flüge auf einem anderen Planeten. Probenentnahme für eine zukünftige Rückkehr zur Erde.",                               discovery: "Erster motorisierter außerirdischer Flug" },
];

const BELGIUM_TEXT = [
  { title: "GEM-Mars — das Modell",       body: "Das General Environment Model for Mars (GEM-Mars) wird am IASB-BIRA in Brüssel entwickelt und gepflegt. Alle hier visualisierten Daten stammen daraus.", detail: "Königlich Belgisches Institut für Weltraum-Aeronomie" },
  { title: "NOMAD auf ExoMars",            body: "Das Instrument NOMAD an Bord des TGO-Orbiters (ESA, 2016) wird von der Forscherin Ann Carine Vandaele des IASB-BIRA geleitet. Es analysiert die Chemie der Atmosphäre.", detail: "Belgische Principal Investigator" },
  { title: "Internationales Netzwerk",    body: "Das IASB-BIRA arbeitet mit dem LMD (Paris), der Open University (Oxford) und der ESA zusammen. Belgien ist ein Schlüsselakteur der europäischen Mars-Meteorologie.", detail: "Kooperationen LMD \u00b7 OU \u00b7 ESA" },
  { title: "Von Karman Institute",        body: "Das VKI (Rhode-Saint-Genèse) erforscht Strömungsdynamik und Aerodynamik des atmosphärischen Eintritts. Seine Forschung an Hitzeschilden ist für Marsmissionen unerlässlich.", detail: "Rhode-Saint-Genèse, Belgien" },
  { title: "Spacebel",                    body: "Ein belgisches Unternehmen, spezialisiert auf Raumfahrtsoftware. Spacebel hat zu den Bordsystemen von ESA-Missionen beigetragen, darunter Mars Express, seit 2003 im Marsorbit.", detail: "Lüttich \u00b7 ESA-Flugsoftware" },
  { title: "Rosalind Franklin 2028",      body: "Belgische Forscher des IASB-BIRA sind am ExoMars-Rover Rosalind Franklin beteiligt, dessen Start für 2028 geplant ist. Er soll bis zu 2\u2009m tief bohren, um Lebensspuren zu suchen.", detail: "ExoMars 2028 \u00b7 ESA / Roscosmos" },
];

export const homeContent = {
  hero: {
    title: HERO_TITLE,
    subtitle: "Erforschung marsianischer Atmosphärendaten",
    description: "Eine interaktive Visualisierungsplattform basierend auf dem Klimamodell GEM-Mars. Erkunde Temperatur, Winde, Staub und vieles mehr.",
    cta: "Erforschung starten",
  },
  why: {
    tag: "Wissenschaftliches Interesse",
    title: "Warum den Mars erforschen\u00a0?",
    quote: "Der Mars ist das zugänglichste natürliche Labor, um die Entwicklung von Gesteinsplaneten und die Geschichte des Wassers in unserem Sonnensystem zu verstehen.",
    reasons: WHY_REASON_ICONS.map((icon, i) => ({ icon, ...WHY_REASONS_TEXT[i] })),
  },
  solarSystem: {
    tag: "Sonnensystem",
    title: "Mars im Sonnensystem",
    subtitle: "4\u1d49 Planet von der Sonne — zwischen der Erde und dem Asteroidengürtel. Fahre über die Planeten, um ihre Eigenschaften zu entdecken.",
  },
  features: FEATURES_STRUCTURE.map((s, i) => ({ ...s, ...FEATURES_TEXT[i] })),
  stats:    STATS_STRUCTURE.map((s, i) => ({ ...s, ...STATS_TEXT[i] })),
  timeline: TIMELINE_STRUCTURE.map((s, i) => ({ ...s, ...TIMELINE_TEXT[i] })),
  belgium: {
    tag: "Made in Belgium",
    title: "Belgien und der Mars",
    subtitle: "Hinter jedem Datenpunkt von Mars Climate Viewer steht ein Modell, das in Brüssel vom IASB-BIRA entwickelt wurde.",
    items: BELGIUM_ITEMS_STRUCTURE.map((s, i) => ({ ...s, ...BELGIUM_TEXT[i] })),
  },
};
