/**
 * Contenido textual de la página de inicio — versión española.
 * Solo los textos se definen aquí; la estructura (iconos, rutas,
 * colores, constantes numéricas) está en home.structure.js.
 */
import {
  HERO_TITLE, WHY_REASON_ICONS, FEATURES_STRUCTURE,
  STATS_STRUCTURE, TIMELINE_STRUCTURE, BELGIUM_ITEMS_STRUCTURE,
} from './home.structure';

const WHY_REASONS_TEXT = [
  { title: "La historia del agua",  body: "Los datos atmosféricos revelan cómo un planeta antes húmedo perdió sus océanos. Un espejo directo de la evolución climática terrestre." },
  { title: "Exploración humana",    body: "Comprender los ciclos térmicos y las tormentas de polvo es esencial para diseñar los sistemas de soporte vital de las futuras bases habitadas." },
  { title: "Ciencia comparativa",   body: "Estudiar una atmósfera diferente permite validar nuestros modelos climáticos y comprender mejor los mecanismos del cambio climático en la Tierra." },
];

const FEATURES_TEXT = [
  { title: 'Corte 2D',            tag: 'Mapa planetario',          body: "Distribución lat×lon de una variable atmosférica a una altitud y un instante dados. Vista global de Marte de un vistazo." },
  { title: 'Animación',           tag: 'Ciclo diurno',             body: "Evolución de una variable en 48 pasos de tiempo consecutivos — un sol marciano completo animado en pocos segundos." },
  { title: 'Serie temporal',      tag: 'Análisis local',           body: "Ciclo diurno completo en un punto geográfico y una altitud precisa. Detecta signaturas locales y valores extremos." },
  { title: 'Perfil vertical',     tag: 'Estructura vertical',      body: "Distribución de una variable en los 103 niveles de altitud. Estructura térmica y dinámica completa de la columna." },
  { title: 'Sección vertical',    tag: 'Sección meridional',       body: "Vista en corte de la atmósfera a longitud o latitud fija. La estructura global de la atmósfera de un vistazo." },
  { title: 'Hovmöller',           tag: 'Tiempo × espacio',         body: "Evolución temporal promediada sobre una dimensión espacial. Revela la propagación de ondas diurnas y patrones planetarios." },
  { title: 'Media zonal',         tag: 'Lat × altitud',            body: "Estructura vertical promediada en longitud. La vista clásica para estudiar las celdas de Hadley, jets y contrastes térmicos." },
  { title: 'Rosa de vientos',   tag: 'Climatología del viento',  body: "Diagrama polar de distribución de dirección y velocidad del viento en un ciclo diurno completo. Revela los regímenes de viento dominantes en un punto dado." },
  { title: 'Perfil temporal',   tag: 'Grilla tiempo\u00d7altitud', body: "Visualice cómo evoluciona una variable durante el ciclo diurno en todos los niveles de altitud. Ideal para estudiar mareas térmicas y ondas atmosféricas." },
  { title: 'Diferencia',        tag: 'Comparación de datasets',  body: "Reste dos datasets para revelar anomalías y diferencias. Una paleta divergente simétrica resalta las desviaciones positivas y negativas." },
  { title: 'Explorar',            tag: 'Interfaz completa',        body: "Vista todo-en-uno para usuarios avanzados\u00a0: dataset, variable, tipo de visualización y exportación en una sola pantalla. El poder de todas las vistas, sin navegación." },
];

const STATS_TEXT = [
  { label: "Año marciano",              sub: "1,88 años terrestres",                      earthLabel: '365\u2009d (Tierra)'        },
  { label: "Presión atmosférica",       sub: "0,6\u2009% de la Tierra (1\u202f013 mb)",   earthLabel: '1\u202f013\u2009mb (Tierra)' },
  { label: "Temperatura media",         sub: "Mín. \u2212143\u00b0C \u00b7 Máx. +35\u00b0C", earthLabel: '+15\u00b0C (Tierra)'  },
  { label: "Oxígeno (O\u2082)",         sub: "Irrespirable sin traje espacial",            earthLabel: '21\u2009% (Tierra)'          },
  { label: "Gravedad superficial",      sub: "38\u2009% de la gravedad terrestre",         earthLabel: '9,81\u2009m/s\u00b2 (Tierra)' },
  { label: "Diámetro",                  sub: "53\u2009% del diámetro terrestre",           earthLabel: '12\u202f742\u2009km (Tierra)' },
  { label: "Lunas",                     sub: "Fobos y Deimos",                             earthLabel: '1 luna (Tierra)'             },
  { label: "Duración del sol",          sub: "37 min más que la Tierra",                   earthLabel: '24h00 (Tierra)'              },
];

const TIMELINE_TEXT = [
  { desc: "Primer sobrevuelo exitoso de Marte. 22 fotos históricas transmitidas en 8 horas. Descubrimiento\u00a0: sin campo magnético global, atmósfera 100× más tenue de lo esperado.",                           discovery: "Primera vista cercana de Marte" },
  { desc: "Primeros aterrizajes exitosos en Marte. Análisis químico del suelo. Búsqueda de signos de vida — resultados ambiguos, aún debatidos hoy.",                                                                discovery: "Primeros módulos de aterrizaje operativos" },
  { desc: "Primer rover Sojourner (10\u2009kg, previsto 7 días, activo 83 días). Análisis geoquímicos de rocas. Confirma la antigua presencia de agua líquida.",                                                     discovery: "Primer rover marciano" },
  { desc: "Rovers MER previstos para 90 días. Spirit activo 6 años, Opportunity 15 años y 45\u2009km recorridos. Pruebas irrefutables de agua pasada.",                                                              discovery: "45 km recorridos en Marte" },
  { desc: "Rover MSL aún activo. Detección de moléculas orgánicas complejas y metano estacional. Mediciones de radiación para preparar misiones tripuladas.",                                                         discovery: "Moléculas orgánicas detectadas" },
  { desc: "Orbitador TGO de la ESA. El instrumento NOMAD (PI belga, BIRA-IASB) analiza la química atmosférica en detalle. GEM-Mars sirve como modelo de referencia para sus mediciones.",                             discovery: "NOMAD\u00a0: química atmosférica detallada" },
  { desc: "El rover Perseverance produce O\u2082 con MOXIE. Ingenuity completa 72 vuelos motorizados en otro planeta. Muestras recogidas para un futuro retorno a la Tierra.",                                        discovery: "Primer vuelo motorizado extraterrestre" },
];

const BELGIUM_TEXT = [
  { title: "GEM-Mars — el modelo",       body: "El General Environment Model for Mars (GEM-Mars) es desarrollado y mantenido en el IASB-BIRA de Bruselas. Todos los datos visualizados aquí provienen de él.", detail: "Instituto Real Belga de Aeronomía Espacial" },
  { title: "NOMAD en ExoMars",            body: "El instrumento NOMAD a bordo del orbitador TGO (ESA, 2016) está dirigido por la investigadora Ann Carine Vandaele del IASB-BIRA. Analiza la química de la atmósfera.", detail: "Investigadora Principal belga" },
  { title: "Red internacional",           body: "El IASB-BIRA colabora con el LMD (París), la Open University (Oxford) y la ESA. Bélgica es un actor clave en la meteorología marciana europea.", detail: "Colaboraciones LMD \u00b7 OU \u00b7 ESA" },
  { title: "Von Karman Institute",        body: "El VKI (Rhode-Saint-Genèse) estudia la dinámica de fluidos y la aerodinámica de entrada atmosférica. Su investigación sobre escudos térmicos es esencial para las misiones a Marte.", detail: "Rhode-Saint-Genèse, Bélgica" },
  { title: "Spacebel",                    body: "Empresa belga especializada en software de vuelo espacial. Spacebel contribuyó a los sistemas embarcados de misiones ESA, incluida Mars Express, en órbita alrededor de Marte desde 2003.", detail: "Lieja \u00b7 Software de vuelo ESA" },
  { title: "Rosalind Franklin 2028",      body: "Investigadores belgas del IASB-BIRA participan en el rover ExoMars Rosalind Franklin, cuyo lanzamiento está previsto para 2028. Perforará hasta 2\u2009m de profundidad para buscar rastros de vida.", detail: "ExoMars 2028 \u00b7 ESA / Roscosmos" },
];

export const homeContent = {
  hero: {
    title: HERO_TITLE,
    subtitle: "Exploración de datos atmosféricos marcianos",
    description: "Una plataforma de visualización interactiva basada en el modelo climático GEM-Mars. Explora temperatura, vientos, polvo y mucho más.",
    cta: "Comenzar la exploración",
  },
  why: {
    tag: "Interés científico",
    title: "¿Por qué estudiar Marte\u00a0?",
    quote: "Marte es el laboratorio natural más accesible para comprender la evolución de los planetas rocosos y la historia del agua en nuestro sistema solar.",
    reasons: WHY_REASON_ICONS.map((icon, i) => ({ icon, ...WHY_REASONS_TEXT[i] })),
  },
  solarSystem: {
    tag: "Sistema solar",
    title: "Marte en el sistema solar",
    subtitle: "4\u1d49 planeta desde el Sol — entre la Tierra y el cinturón de asteroides. Pasa el cursor sobre los planetas para descubrir sus características.",
  },
  features: FEATURES_STRUCTURE.map((s, i) => ({ ...s, ...FEATURES_TEXT[i] })),
  stats:    STATS_STRUCTURE.map((s, i) => ({ ...s, ...STATS_TEXT[i] })),
  timeline: TIMELINE_STRUCTURE.map((s, i) => ({ ...s, ...TIMELINE_TEXT[i] })),
  belgium: {
    tag: "Hecho en Bélgica",
    title: "Bélgica y Marte",
    subtitle: "Detrás de cada dato de Mars Climate Viewer se encuentra un modelo desarrollado en Bruselas por el IASB-BIRA.",
    items: BELGIUM_ITEMS_STRUCTURE.map((s, i) => ({ ...s, ...BELGIUM_TEXT[i] })),
  },
};
