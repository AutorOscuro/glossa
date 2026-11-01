// @purpose: Armador de sesiones (T1-T4): repasos vencidos con modo rescate, tarjetas nuevas con tope diario y cupo de temas por área, energía, exclusiones, intercalado, progresión reconocimiento → producción, enfoques por tema y por errores, y un SessionPlan determinista.
// Armador de sesiones (subparte 1.8, tramos 1 a 4). Roadmap 1.8, 8.15 y 17. Función PURA: recibe los datos, no lee la base ni el reloj.
//   build({ now, cards, rng, items?, topics?, deprecatedItemIds?, size?, minutes?, energy?, newCap?, newToday?, areas?, reviewCap?, reviewsToday?, leechThreshold?, retrievability?, mastery?, topicFocus?, errorFocus?, errors? }) → SessionPlan (congelado)
//     now                 Date (core/clock.js). Obligatorio.
//     cards               lista de tarjetas (8.4). Obligatoria; puede estar vacía.
//     rng                 azar con semilla (core/rng.js: createRng). Obligatorio; solo desempata tarjetas con la misma urgencia.
//     items               OPCIONAL lista (o Map id→ítem) de ítems; da `exerciseType` a cada entrada del plan.
//     topics              OPCIONAL lista de temas { id, status, area?, priority? }; una tarjeta cuyos temas están TODOS `deprecated` no se ofrece. `area` y `priority` rigen las nuevas (T2).
//     deprecatedItemIds   OPCIONAL Set o lista de ids de ítems retirados (el que devuelve content.deprecatedItemIds(db)).
//     size                ítems pedidos (por defecto 20, entero 1–100).
//     minutes             OPCIONAL minutos disponibles (entero 1–600): la sesión no pasa de minutes × 2 ítems.
//     energy              'low' | 'mid' | 'high' (por defecto 'mid'; cualquier otro valor se ignora). 'low': mitad de ítems, mitad de nuevas y aplaza los ejercicios largos (writing, mediation, open_ai, speak). No es un modo especial.
//     newCap / newToday   tope diario de tarjetas nuevas (por defecto 10, entero ≥ 0) y las ya introducidas hoy (por defecto 0).
//     areas               OPCIONAL lista de áreas a las que se limitan las NUEVAS (los repasos no se filtran).
//     reviewCap           tope diario de repasos (por defecto 100). Con muchas vencidas (> 1,5 × tope) entra el modo rescate (cupo = 0,5 × tope).
//     reviewsToday        repasos ya hechos hoy (por defecto 0); se restan del cupo del día.
//     leechThreshold      fallos para tratar una tarjeta como sanguijuela aunque no esté marcada (por defecto 8).
//     retrievability      (card, now) → [0,1]; por defecto la de FSRS (core/srs.js). Quien use otro motor pasa `srs.retrievability`.
//     mastery             OPCIONAL (T4) dominio por tema: Map tema→pct, objeto {tema: pct} o lista de resultados de `createMastery(...).compute` ({ topicId, pct }). Sin él NO hay progresión.
//                         Con él, las tarjetas NUEVAS de cada tema mezclan reconocimiento y producción según su banda (config PROGRESSION): un tema nuevo o inicial solo recibe producción
//                         cuando se acaba el reconocimiento; «En progreso» 1 de cada 3, «Sólido» 1 de cada 2, «Dominado» 2 de cada 3. Un tema sin dato cuenta como 0. Solo ordena: nunca excluye.
//     topicFocus          OPCIONAL (T4) id de un tema para practicarlo: solo entran sus tarjetas. Orden: repasos vencidos, nuevas (el cupo de temas por área no aplica: el tema lo eligió la persona; el tope diario sí)
//                         y, si aún hay hueco, tarjetas aún no vencidas del tema (why 'practice', las de menor retrievabilidad, mezcladas con la progresión). Rescate y topes de repaso se calculan sobre ese tema.
//     errorFocus          OPCIONAL (T4) true = «detective de errores»: solo tarjetas YA empezadas de los ítems con errores propios (de más a menos puntuación; luego las de temas con errores sin ítem). Sin nuevas ni rescate.
//     errors              registros de core/errors.js; obligatorio si errorFocus es true. Se puede combinar con topicFocus.
//   SessionPlan = { version, generatedAt, requested, count, items[], reason|null, rescue{}, stats{} }
//     items[i] = { cardId, itemId, facet, topics, topic|null, exerciseType|null, production:true|false|null, kind:'review'|'new', why:'overdue'|'rescue'|'new'|'practice'|'error', r, daysOverdue, errorScore|null }
// Orden: primero los repasos (normal → la más atrasada; rescate → la de menor retrievabilidad), luego las nuevas.
// Nuevas (T2): solo si quedan huecos tras los repasos y NO hay rescate activo. Se llenan primero los temas ya en curso y después se abren temas
//   nuevos por prioridad (mayor primero), con un máximo de `maxNewTopicsPerArea` temas en curso por área. El tema de una tarjeta es su primer tema no retirado.
// Empates exactos: se ordenan por id, se mezclan con `rng` y se ordena de forma estable, así que no dependen del orden de entrada.
// Un plan vacío lleva SIEMPRE `reason` { code, message_es } (ver EMPTY_REASONS). Nunca hay rachas ni mensajes de culpa.
// Intercalado (T3, core/sessionInterleave.js): tras elegir los ítems se reordenan para no pasar de 2 seguidos del mismo tema ni tipo (si hay opciones); `stats.interleave` lo resume.
// Progresión y enfoques (T4): core/sessionProgression.js y core/sessionFocus.js. El intercalado corre siempre al final; con topicFocus solo vigila el tipo (el tema es el mismo).
import { toDate, toIso } from './clock.js';
import { retrievability as fsrsRetrievability } from './srs.js';
import { rescuePlan } from './srsRescue.js';
import { isLeech } from './srsLeech.js';
import { typeInfo } from './contentTypes.js';
import { interleave } from './sessionInterleave.js';
import { isProduction, masteryIndex, productionShare, orderByProgression } from './sessionProgression.js';
import { errorTargets } from './sessionFocus.js';
import { SESSION_CONFIG, EMPTY_REASONS, ENERGY_LEVELS, HEAVY_FAMILIES } from './session.config.js';

const DAY_MS = 86400000;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const intIn = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

function idSet(value, who) {
  if (value === undefined || value === null) return new Set();
  if (value instanceof Set) return new Set([...value].filter((x) => typeof x === 'string'));
  if (Array.isArray(value)) return new Set(value.filter((x) => typeof x === 'string'));
  throw new Error(`${who}: debe ser un Set o una lista de ids`);
}

function itemTypes(items) {
  if (items === undefined || items === null) return new Map();
  const list = items instanceof Map ? [...items.values()] : items;
  if (!Array.isArray(list)) throw new Error('session.build: items debe ser una lista o un Map');
  const out = new Map();
  for (const it of list) if (isObj(it) && typeof it.id === 'string' && typeof it.type === 'string') out.set(it.id, it.type);
  return out;
}

function deprecatedTopics(topics) {
  if (topics === undefined || topics === null) return new Set();
  if (!Array.isArray(topics)) throw new Error('session.build: topics debe ser una lista');
  return new Set(topics.filter((t) => isObj(t) && typeof t.id === 'string' && t.status === 'deprecated').map((t) => t.id));
}

function topicIndex(topics) {
  const out = new Map();
  if (!Array.isArray(topics)) return out;
  for (const t of topics) if (isObj(t) && typeof t.id === 'string') out.set(t.id, { area: typeof t.area === 'string' ? t.area : null, priority: Number.isFinite(t.priority) ? t.priority : 0 });
  return out;
}

const isHeavy = (type) => type !== null && type !== undefined && HEAVY_FAMILIES.includes(typeInfo(type)?.family);

function checkInput(input) {
  if (!isObj(input)) throw new Error('session.build: se necesita un objeto de entrada');
  const { now, cards, rng, size, minutes, newCap, newToday, areas, reviewCap, reviewsToday, leechThreshold, retrievability, topicFocus, errorFocus, errors, mastery } = input;
  if (now === undefined) throw new Error('session.build: falta now');
  if (!Array.isArray(cards)) throw new Error('session.build: cards debe ser una lista de tarjetas');
  if (!isObj(rng) || typeof rng.shuffle !== 'function') throw new Error('session.build: falta rng con semilla (core/rng.js createRng)');
  if (size !== undefined && !intIn(size, 1, SESSION_CONFIG.maxSize)) throw new Error(`session.build: size debe ser un entero entre 1 y ${SESSION_CONFIG.maxSize}`);
  if (minutes !== undefined && !intIn(minutes, 1, SESSION_CONFIG.maxMinutes)) throw new Error(`session.build: minutes debe ser un entero entre 1 y ${SESSION_CONFIG.maxMinutes}`);
  if (newCap !== undefined && !intIn(newCap, 0, Number.MAX_SAFE_INTEGER)) throw new Error('session.build: newCap debe ser un entero ≥ 0');
  if (newToday !== undefined && !intIn(newToday, 0, Number.MAX_SAFE_INTEGER)) throw new Error('session.build: newToday debe ser un entero ≥ 0');
  if (areas !== undefined && (!Array.isArray(areas) || areas.some((a) => typeof a !== 'string'))) throw new Error('session.build: areas debe ser una lista de textos');
  if (reviewCap !== undefined && !intIn(reviewCap, 1, Number.MAX_SAFE_INTEGER)) throw new Error('session.build: reviewCap debe ser un entero ≥ 1');
  if (reviewsToday !== undefined && !intIn(reviewsToday, 0, Number.MAX_SAFE_INTEGER)) throw new Error('session.build: reviewsToday debe ser un entero ≥ 0');
  if (leechThreshold !== undefined && !intIn(leechThreshold, 1, Number.MAX_SAFE_INTEGER)) throw new Error('session.build: leechThreshold debe ser un entero ≥ 1');
  if (retrievability !== undefined && typeof retrievability !== 'function') throw new Error('session.build: retrievability debe ser una función (card, now)');
  if (topicFocus !== undefined && (typeof topicFocus !== 'string' || topicFocus === '')) throw new Error('session.build: topicFocus debe ser un texto no vacío (id de tema)');
  if (errorFocus !== undefined && typeof errorFocus !== 'boolean') throw new Error('session.build: errorFocus debe ser true o false');
  if (errorFocus === true && errors === undefined) throw new Error('session.build: errorFocus necesita errors (los registros de core/errors.js)');
  if (errors !== undefined && !Array.isArray(errors)) throw new Error('session.build: errors debe ser una lista de registros de errores');
}

export function build(input) {
  checkInput(input);
  const { cards, rng, items, topics, deprecatedItemIds } = input;
  const t = toDate(input.now);
  const energyKey = Object.prototype.hasOwnProperty.call(ENERGY_LEVELS, input.energy) ? input.energy : SESSION_CONFIG.defaultEnergy;
  const energy = ENERGY_LEVELS[energyKey];
  const baseSize = Math.min(input.size ?? SESSION_CONFIG.size, input.minutes === undefined ? Infinity : input.minutes * SESSION_CONFIG.itemsPerMinute);
  const size = Math.max(1, Math.floor(baseSize * energy.sizeFactor));
  const newCap = input.newCap ?? SESSION_CONFIG.newCap;
  const newToday = input.newToday ?? 0;
  const areaFilter = input.areas === undefined ? null : new Set(input.areas);
  const topicInfo = topicIndex(topics);
  const reviewCap = input.reviewCap ?? SESSION_CONFIG.reviewCap;
  const reviewsToday = input.reviewsToday ?? 0;
  const leechThreshold = input.leechThreshold ?? SESSION_CONFIG.leechThreshold;
  const retr = input.retrievability ?? fsrsRetrievability;
  const typeOf = itemTypes(items);
  const depItems = idSet(deprecatedItemIds, 'session.build: deprecatedItemIds');
  const depTopics = deprecatedTopics(topics);
  const focus = input.topicFocus;
  const errorMode = input.errorFocus === true;
  const progression = input.mastery === undefined ? null : masteryIndex(input.mastery);
  const targets = errorMode ? errorTargets(input.errors) : null;
  const pctOf = (k) => progression.map.get(k) ?? 0;

  const stats = { overdue: 0, selected: 0, left: 0, notStarted: 0, notDue: 0, invalid: 0, duplicates: 0, newSelected: 0, deferredHeavy: 0, outOfFocus: 0, practice: 0, newSkipped: { cap: 0, area: 0, area_filter: 0, rescue: 0, heavy: 0, no_room: 0 }, excluded: { suspended: 0, leech: 0, deprecated_item: 0, deprecated_topic: 0 } };
  const seen = new Set();
  const fresh = []; // tarjetas nuevas (state 0) ofrecibles
  const startedTopics = new Set(); // temas con alguna tarjeta ya empezada (aunque esté pausada)
  const eligible = []; // tarjetas ofrecibles ya empezadas (state ≠ 0) y con fecha legible
  let valid = 0;
  for (const c of cards) {
    if (!isObj(c) || typeof c.id !== 'string' || c.id === '') { stats.invalid += 1; continue; }
    if (seen.has(c.id)) { stats.duplicates += 1; continue; }
    seen.add(c.id);
    if (focus !== undefined && !(Array.isArray(c.topics) && c.topics.includes(focus) && !depTopics.has(focus))) { stats.outOfFocus += 1; continue; }
    valid += 1;
    if (c.state !== 0 && Array.isArray(c.topics)) for (const x of c.topics) if (typeof x === 'string') startedTopics.add(x);
    // Una sola causa por tarjeta, en este orden (la primera que aplique).
    if (c.suspended === true) { stats.excluded.suspended += 1; continue; }
    if (c.leech === true || isLeech(c, leechThreshold)) { stats.excluded.leech += 1; continue; }
    if (depItems.has(c.itemId)) { stats.excluded.deprecated_item += 1; continue; }
    if (Array.isArray(c.topics) && c.topics.length > 0 && c.topics.every((x) => depTopics.has(x))) { stats.excluded.deprecated_topic += 1; continue; }
    if (c.state === 0) { stats.notStarted += 1; fresh.push(c); continue; }
    if (!Number.isFinite(new Date(c.due).getTime())) { stats.invalid += 1; continue; }
    eligible.push(c);
  }
  const excludedTotal = Object.values(stats.excluded).reduce((s, n) => s + n, 0);

  const overdue = eligible.filter((c) => new Date(c.due).getTime() <= t.getTime());
  stats.overdue = overdue.length;
  stats.notDue = eligible.length - overdue.length;

  // Rescate: decide el modo y el cupo del día. El orden lo fijo yo (con desempate semillado), no rescuePlan.
  const rescueRaw = rescuePlan(overdue, t, { dailyCap: reviewCap, retrievability: retr });
  const rescue = errorMode ? { ...rescueRaw, active: false, message_es: null } : rescueRaw; // el detective de errores no es un día de rescate
  const rOf = (c) => { const v = retr(c, t); return Number.isFinite(v) ? v : 0; }; // ilegible = lo más urgente
  const keyed = rng.shuffle([...overdue].sort((a, b) => cmp(a.id, b.id))).map((c) => ({ c, r: rescue.active ? rOf(c) : 0, due: new Date(c.due).getTime() }));
  keyed.sort((a, b) => (rescue.active ? a.r - b.r : 0) || a.due - b.due);

  const primaryTopic = (c) => (Array.isArray(c.topics) ? c.topics.find((x) => typeof x === 'string' && !depTopics.has(x)) ?? null : null);
  const areaOf = (c) => { const tp = primaryTopic(c); return tp === null ? null : topicInfo.get(tp)?.area ?? null; };
  const heavyOf = (c) => energy.light && isHeavy(typeOf.get(c.itemId));
  const pool = keyed.filter(({ c }) => !heavyOf(c));
  stats.deferredHeavy = keyed.length - pool.length;

  const entry = (c, kind, why, over = {}) => Object.freeze({
    cardId: c.id, itemId: c.itemId ?? null, facet: Number.isInteger(c.facet) ? c.facet : 0,
    topics: Object.freeze(Array.isArray(c.topics) ? [...c.topics] : []),
    topic: primaryTopic(c), exerciseType: typeOf.get(c.itemId) ?? null, production: isProduction(typeOf.get(c.itemId)),
    kind, why, r: kind === 'new' ? null : Math.round(rOf(c) * 10000) / 10000,
    daysOverdue: kind === 'new' ? 0 : Math.max(0, Math.floor((t.getTime() - new Date(c.due).getTime()) / DAY_MS)), errorScore: null, ...over,
  });

  const dayLimit = rescue.active ? rescue.quota : reviewCap;
  const remaining = Math.max(0, dayLimit - reviewsToday);
  const take = errorMode ? 0 : Math.min(size, remaining, pool.length);
  const why = rescue.active ? 'rescue' : 'overdue';
  const planItems = pool.slice(0, take).map(({ c }) => entry(c, 'review', why));
  stats.selected = planItems.length;
  stats.left = errorMode ? 0 : overdue.length - planItems.length;

  // Detective de errores (T4): solo tarjetas ya empezadas de los ítems con errores propios; sin nuevas ni rescate.
  if (errorMode) {
    const cands = [];
    for (const c of eligible) {
      const direct = typeof c.itemId === 'string' ? targets.byItem.get(c.itemId) : undefined;
      if (direct !== undefined) { cands.push({ c, tier: 0, score: direct }); continue; }
      let best = 0;
      if (Array.isArray(c.topics)) for (const x of c.topics) best = Math.max(best, targets.byTopic.get(x) ?? 0);
      if (best > 0) cands.push({ c, tier: 1, score: best });
    }
    const usable = cands.filter(({ c }) => !heavyOf(c));
    stats.deferredHeavy = cands.length - usable.length;
    const ranked = rng.shuffle(usable.sort((a, b) => cmp(a.c.id, b.c.id))).sort((a, b) => a.tier - b.tier || b.score - a.score || rOf(a.c) - rOf(b.c));
    for (const { c, score } of ranked.slice(0, size)) planItems.push(entry(c, 'review', 'error', { errorScore: score }));
    stats.selected = planItems.length;
  }
  stats.errorFocus = Object.freeze(errorMode ? { used: targets.used, ignored: targets.ignored, candidates: stats.selected } : { used: 0, ignored: 0, candidates: 0 });

  // Nuevas (T2): tras los repasos, con el hueco que quede, sin rescate, dentro del tope diario y del cupo de temas por área.
  const newBudget = Math.max(0, Math.min(size - planItems.length, Math.floor(newCap * energy.newFactor) - newToday));
  const newCards = [];
  if (fresh.length > 0 && !errorMode) {
    const candidates = [];
    for (const c of fresh) {
      if (areaFilter !== null && !areaFilter.has(areaOf(c))) { stats.newSkipped.area_filter += 1; continue; }
      if (energy.light && isHeavy(typeOf.get(c.itemId))) { stats.newSkipped.heavy += 1; continue; }
      candidates.push(c);
    }
    if (rescue.active) stats.newSkipped.rescue = candidates.length;
    else if (newBudget === 0) stats.newSkipped[size - planItems.length <= 0 ? 'no_room' : 'cap'] = candidates.length;
    else {
      const byTopic = new Map(); // tema → nuevas ordenadas por ítem y faceta
      for (const c of candidates) { const k = primaryTopic(c) ?? ''; if (!byTopic.has(k)) byTopic.set(k, []); byTopic.get(k).push(c); }
      const faceOf = (c) => (Number.isInteger(c.facet) ? c.facet : 0);
      for (const list of byTopic.values()) list.sort((a, b) => cmp(a.itemId ?? '', b.itemId ?? '') || faceOf(a) - faceOf(b) || cmp(a.id, b.id));
      if (progression !== null) for (const [k, list] of byTopic) byTopic.set(k, orderByProgression(list, (c) => isProduction(typeOf.get(c.itemId)), productionShare(pctOf(k))));
      const prio = (k) => topicInfo.get(k)?.priority ?? 0;
      const order = [...byTopic.keys()].sort((a, b) => (startedTopics.has(b) ? 1 : 0) - (startedTopics.has(a) ? 1 : 0) || prio(b) - prio(a) || cmp(a, b));
      const inProgress = new Map(); // área → nº de temas en curso (empezados y con nuevas pendientes)
      const areaKey = (k) => (k === '' ? null : topicInfo.get(k)?.area ?? null);
      for (const k of order) if (startedTopics.has(k) && areaKey(k) !== null) inProgress.set(areaKey(k), (inProgress.get(areaKey(k)) ?? 0) + 1);
      for (const k of order) {
        const list = byTopic.get(k);
        const area = areaKey(k);
        if (!startedTopics.has(k) && area !== null && focus === undefined) {
          if ((inProgress.get(area) ?? 0) >= SESSION_CONFIG.maxNewTopicsPerArea) { stats.newSkipped.area += list.length; continue; }
          inProgress.set(area, (inProgress.get(area) ?? 0) + 1);
        }
        for (const c of list) {
          if (newCards.length >= newBudget) { stats.newSkipped.cap += 1; continue; }
          newCards.push(c);
        }
      }
    }
  }
  for (const c of newCards) planItems.push(entry(c, 'new', 'new'));
  stats.newSelected = newCards.length;
  stats.selected = planItems.length;

  // Práctica de un tema (T4): si tras repasos y nuevas queda hueco, tarjetas del tema aún no vencidas (las que menos se recuerdan primero, mezclando reconocimiento y producción).
  if (focus !== undefined && !errorMode && !rescue.active && planItems.length < size) {
    const dueIds = new Set(overdue.map((c) => c.id));
    const cand = eligible.filter((c) => !dueIds.has(c.id) && !heavyOf(c));
    let ordered = rng.shuffle(cand.sort((a, b) => cmp(a.id, b.id))).sort((a, b) => rOf(a) - rOf(b));
    if (progression !== null) ordered = orderByProgression(ordered, (c) => isProduction(typeOf.get(c.itemId)), productionShare(pctOf(focus)));
    for (const c of ordered.slice(0, size - planItems.length)) planItems.push(entry(c, 'review', 'practice'));
    stats.practice = planItems.length - stats.selected;
    stats.selected = planItems.length;
  }
  stats.progression = Object.freeze({ enabled: progression !== null, ignored: progression === null ? 0 : progression.ignored, newProduction: planItems.filter((i) => i.kind === 'new' && i.production === true).length, newRecognition: planItems.filter((i) => i.kind === 'new' && i.production !== true).length });

  // Intercalado (T3): no cambia QUÉ ítems entran, solo el orden (nunca > 2 seguidos del mismo tema ni tipo, si hay opciones).
  // Con topicFocus todos son del mismo tema: se intercala solo por tipo (con el tema nulo) y se devuelven los ítems originales.
  const forMix = focus === undefined ? planItems : planItems.map((it) => ({ ...it, topic: null, ref: it }));
  const mixed0 = interleave(forMix, { maxRun: SESSION_CONFIG.maxRun, windows: SESSION_CONFIG.interleaveWindows, budget: SESSION_CONFIG.interleaveBudget });
  const mixed = focus === undefined ? mixed0 : { ...mixed0, items: mixed0.items.map((it) => it.ref) };
  stats.interleave = Object.freeze({ moved: mixed.moved, window: mixed.window, maxRun: mixed.maxRun, violations: Object.freeze({ ...mixed.violations }) });

  let reason = null;
  if (planItems.length === 0) {
    const code = valid === 0 ? (stats.outOfFocus > 0 ? 'topic_empty' : 'no_material')
      : excludedTotal === valid ? 'only_excluded'
      : errorMode ? (targets.used === 0 ? 'no_errors' : stats.deferredHeavy > 0 ? 'energy_deferred' : 'errors_no_cards')
      : overdue.length > 0 && remaining === 0 ? 'daily_cap_reached'
      : stats.deferredHeavy > 0 ? 'energy_deferred'
      : stats.notStarted > 0 && newBudget === 0 && !rescue.active && newToday > 0 ? 'new_cap_reached'
      : 'nothing_due';
    reason = Object.freeze({ code, message_es: EMPTY_REASONS[code] });
  }

  return Object.freeze({
    version: 1, generatedAt: toIso(t), requested: size, energy: energyKey, newBudget, count: planItems.length,
    items: Object.freeze(mixed.items), reason,
    rescue: Object.freeze({ active: rescue.active, overdueCount: rescue.overdueCount, threshold: rescue.threshold, quota: rescue.quota, message_es: rescue.message_es }),
    stats: Object.freeze({ ...stats, excluded: Object.freeze({ ...stats.excluded }), newSkipped: Object.freeze({ ...stats.newSkipped }) }),
  });
}
