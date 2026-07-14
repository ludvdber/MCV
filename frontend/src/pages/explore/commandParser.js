/**
 * Parseur deterministe de la barre de commande (Ctrl+K).
 *
 * Transforme une phrase libre (« TT 50 km Ls 270 14h en coupe vers Jezero »)
 * en parametres MCV VALIDES contre le catalogue : variables GEM-Mars, plages
 * Ls des datasets, heures locales, lieux martiens connus, types de vue.
 *
 * Aucun LLM : contrairement aux assistants generatifs, ce parseur ne peut
 * pas inventer une valeur. Ce qu'il ne reconnait pas est simplement ignore,
 * et chaque element reconnu est montre a l'utilisateur sous forme de jeton
 * avant execution.
 */
import { VARIABLES } from '../../components/VariableSelector';
import { MARS_LOCATIONS } from '../../data/marsLocations';
import { MEAN_ONLY_TYPES } from './exploreConstants.jsx';
import { INDIVIDUAL_PREFIX } from '../../constants';

/** minuscules + accents retires, pour des comparaisons tolerantes */
function norm(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Heure locale (h) → pas de temps 0-47, inverse EXACT de formatTime
 *  (idx → idx/2 h, convention des fichiers : pas k = k*0,5 h, k=0 = minuit).
 *  Sans cette coherence, « 14h » viserait un pas etiquete differemment par le
 *  reste de l'app (decalage systematique de 30 min). */
function hoursToTimeIdx(hours) {
  return ((Math.round(hours * 2)) % 48 + 48) % 48;
}

/** Mots-cles → type de visualisation (FR + EN confondus). */
const VIZ_KEYWORDS = [
  [/\b(marees?|tides?)\b/, 'tides'],
  [/\b(coupe|section|cross)\b/, 'crosssection'],
  [/\b(hovm\w*)\b/, 'hovmoller'],
  [/\b(moyenne\s+zonale|zonal\s+mean|zonale?)\b/, 'zonalmean'],
  [/\b(rose)\b/, 'windrose'],
  [/\b(anim\w*)\b/, 'animation'],
  [/\b(serie|series|timeseries)\b/, 'timeseries'],
  [/\b(profil\s+temporel|temporal)\b/, 'temporalprofile'],
  [/\b(profil|profile)\b/, 'profile'],
  [/\b(difference|diff)\b/, 'difference'],
  [/\b(carte|map|slice)\b/, 'slice'],
];

/** Saisons (convention hemisphere nord) → Ls. */
const SEASONS = [
  [/\b(printemps|spring)\b/, 0],
  [/\b(ete|summer)\b/, 90],
  [/\b(automne|autumn|fall)\b/, 180],
  [/\b(hiver|winter)\b/, 270],
];

/** Extrait MY / plage Ls d'un objet dataset du catalogue (avec repli sur l'id). */
function datasetMeta(d) {
  const my = d.my ?? d.marsYear ?? Number(d.id?.match(/MY[_ ]?(\d+)/i)?.[1] ?? NaN);
  let lsStart = d.lsStart, lsEnd = d.lsEnd;
  if (lsStart == null || lsEnd == null) {
    const m = d.id?.match(/Ls[_ ]?(\d+)[_\-.](\d+)/i);
    if (m) { lsStart = Number(m[1]); lsEnd = Number(m[2]); }
  }
  return { my, lsStart, lsEnd };
}

/**
 * Résout une cible (Ls et/ou MY) vers un dataset réel du catalogue.
 * MEAN prioritaire ; repli sur le catalogue INDIVIDUAL. Partagé entre le
 * parseur ⌘K et les scénarios du panneau latéral.
 *
 * @returns {{ datasetId, meta?: {my,lsStart,lsEnd}, individual?: {my,ls} } | null}
 */
export function resolveDataset({ lsTarget = null, myTarget = null }, { datasets = [], individualYears = [] }) {
  const candidates = datasets.filter(d => {
    const { my, lsStart, lsEnd } = datasetMeta(d);
    if (myTarget != null && my !== myTarget) return false;
    if (lsTarget != null && !(lsStart != null && lsEnd != null
      && lsTarget >= lsStart && lsTarget < (lsEnd === 0 ? 360 : lsEnd))) return false;
    return true;
  });
  if (candidates.length > 0) {
    return { datasetId: candidates[0].id, meta: datasetMeta(candidates[0]) };
  }
  const year = individualYears.find(y =>
    (myTarget == null || y.marsYear === myTarget)
    && (lsTarget == null || (lsTarget >= y.lsMin && lsTarget <= y.lsMax)));
  if (year) {
    const ls = lsTarget != null
      ? Math.min(Math.max(lsTarget, year.lsMin), year.lsMax)
      : year.lsMin;
    return {
      datasetId: `${INDIVIDUAL_PREFIX}MY${year.marsYear}_LS${ls.toFixed(2)}`,
      individual: { my: year.marsYear, ls },
    };
  }
  return null;
}

/**
 * @param {string} query   — texte tape par l'utilisateur
 * @param {Object} ctx     — { datasets, individualYears, t } : catalogue MEAN,
 *                           catalogue INDIVIDUAL [{marsYear, lsMin, lsMax}], i18n
 * @returns {{ tokens: Array<{type:string,label:string}>, plan: Object }}
 */
export function parseCommand(query, ctx) {
  const { datasets = [], individualYears = [], t } = ctx;
  const q = norm(query);
  const tokens = [];
  const plan = {};

  /* ── Variable : code exact ou nom localise ─────────────────────────────── */
  for (const v of VARIABLES) {
    const codeRe = new RegExp(`(?:^|[^a-z0-9])${v.code.toLowerCase()}(?:$|[^a-z0-9])`);
    const name = norm(t(`variable.${v.code}`));
    if (codeRe.test(q) || (name.length > 3 && q.includes(name))) {
      plan.variable = v.code;
      tokens.push({ type: 'variable', label: `${v.code} · ${t(`variable.${v.code}`)}` });
      break;
    }
  }

  /* ── Altitude : « 50 km » ou « surface » ───────────────────────────────── */
  const altMatch = q.match(/(\d+(?:[.,]\d+)?)\s*km\b/);
  if (altMatch) {
    plan.altKm = parseFloat(altMatch[1].replace(',', '.'));
    tokens.push({ type: 'altitude', label: `${t('explore.cmdk.token.altitude')} · ${plan.altKm} km` });
  } else if (/\bsurface\b/.test(q)) {
    plan.altKm = 0;
    tokens.push({ type: 'altitude', label: `${t('explore.cmdk.token.altitude')} · surface` });
  }

  /* ── Heure locale : « 14h », « 6h30 », midi, minuit ────────────────────── */
  const timeMatch = q.match(/\b(\d{1,2})\s*h\s*(\d{2})?\b/);
  if (timeMatch) {
    const h = Math.min(23, parseInt(timeMatch[1], 10));
    const m = timeMatch[2] ? Math.min(59, parseInt(timeMatch[2], 10)) : 0;
    plan.timeIdx = hoursToTimeIdx(h + m / 60);
    tokens.push({ type: 'time', label: `${t('explore.cmdk.token.time')} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` });
  } else if (/\b(?:midi|noon)\b/.test(q)) {
    // \b des DEUX cotes : sinon « afternoon » (…noon) et « midnight » (midi…)
    // declenchaient a tort la branche midi.
    plan.timeIdx = hoursToTimeIdx(12);
    tokens.push({ type: 'time', label: `${t('explore.cmdk.token.time')} · 12:00` });
  } else if (/\b(?:minuit|midnight)\b/.test(q)) {
    plan.timeIdx = hoursToTimeIdx(0);
    tokens.push({ type: 'time', label: `${t('explore.cmdk.token.time')} · 00:00` });
  }

  /* ── Saison / Ls / MY → dataset du catalogue ───────────────────────────── */
  let lsTarget = null;
  const lsMatch = q.match(/\bls\s*(\d{1,3})\b/);
  if (lsMatch) lsTarget = Number(lsMatch[1]) % 360;
  else {
    for (const [re, ls] of SEASONS) {
      if (re.test(q)) { lsTarget = ls; break; }
    }
  }
  const myMatch = q.match(/\bmy\s*(\d{2})\b/);
  const myTarget = myMatch ? Number(myMatch[1]) : null;

  if (lsTarget != null || myTarget != null) {
    const resolved = resolveDataset({ lsTarget, myTarget }, { datasets, individualYears });
    if (resolved?.meta) {
      plan.datasetId = resolved.datasetId;
      const { my, lsStart, lsEnd } = resolved.meta;
      tokens.push({
        type: 'dataset',
        label: `${t('explore.cmdk.token.dataset')} · MY${my} Ls ${lsStart}-${lsEnd}`,
      });
    } else if (resolved?.individual) {
      plan.datasetId = resolved.datasetId;
      plan.individual = resolved.individual;
      tokens.push({
        type: 'dataset',
        label: `${t('explore.cmdk.token.dataset')} · MY${resolved.individual.my} · Ls ${resolved.individual.ls.toFixed(2)}° · ${t('explore.cmdk.individualTag')}`,
      });
    } else {
      tokens.push({ type: 'missing', label: t('explore.cmdk.noDataset') });
    }
  }

  /* ── Lieu martien connu → lat/lon ──────────────────────────────────────── */
  for (const loc of MARS_LOCATIONS) {
    const name = norm(loc.name);
    const short = name.split(' ')[0];
    if (q.includes(name) || (short.length > 4 && q.includes(short))) {
      plan.lat = Math.round(loc.lat);
      plan.lon = Math.round(loc.lon);
      tokens.push({ type: 'location', label: `${loc.name} · ${plan.lat}°, ${plan.lon}°` });
      break;
    }
  }

  /* ── Type de visualisation ─────────────────────────────────────────────── */
  for (const [re, viz] of VIZ_KEYWORDS) {
    if (re.test(q)) {
      plan.viz = viz;
      tokens.push({ type: 'viz', label: `${t('explore.cmdk.token.viz')} · ${t(`explore.viz.${viz}`)}` });
      break;
    }
  }

  /* ── Coherence : les vues MEAN-only n'existent pas sur un fichier individuel
     (pas de dimension temps) — message explicite plutot que plan invalide. */
  if (plan.viz && plan.datasetId?.startsWith(INDIVIDUAL_PREFIX)
    && MEAN_ONLY_TYPES.includes(plan.viz)) {
    plan.invalid = true;
    tokens.push({ type: 'missing', label: t('explore.cmdk.meanOnly') });
  }

  return { tokens, plan };
}
