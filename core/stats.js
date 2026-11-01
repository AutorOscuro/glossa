// @purpose: Estadísticas puras: actividad y precisión (T1); tarjetas por nivel, pronóstico, retención, mapa de calor y tendencias de dominio (T2); horas planeadas vs. hechas y XP/rango opcionales (T3).
// Consultas de estadísticas (subparte 1.9, tramo 1). Roadmap 1.9 y sección 17. Puro: recibe listas de eventos ya leídas; no toca la base, el reloj ni el DOM.
//
//   Entradas: `events` = lista de eventos guardados (los que devuelve `events.since`, `events.byTopic`…). Solo cuentan los de tipo `answer`;
//   un elemento ilegible se ignora. `range` = { from?, to? } con días «AAAA-MM-DD» reales, ambos INCLUSIVOS, sobre el campo `day` (día local).
//   Un rango mal formado o con from > to lanza Error en español (uso incorrecto); un rango sin datos devuelve [] (nunca lanza).
//
//   activityByDay(events, range?)          → [{ day, minutes, items, ms }]            por día con actividad, en orden cronológico
//   accuracyByType(events, range?)         → [{ key, attempts, correct, almost, wrong, dontKnow, accuracy }]   key = exerciseType
//   accuracyByTopic(events, range?)        → ídem, key = tema (un evento con varios temas cuenta en cada uno)
//   accuracyByArea(events, topics, range?) → ídem, key = área del tema (`topics` = lista de { id, area }, p. ej. topics.json); temas sin área conocida → 'unknown'
//   avgTimeByType(events, range?)          → [{ type, samples, avgMs }]               solo intentos con `ms` válido
//
//   Intento = evento `answer` con resultado correct | almost | wrong | dont_know (`skipped` no es un intento, como en la señal P del dominio).
//   accuracy = (correct + almost) / attempts, entre 0 y 1; `almost` vale 1 (igual que `SIGNAL_P.value`). Sin intentos no hay fila (nunca hay accuracy null).
//   minutes = suma de `ms` de los intentos del día / 60000, con 2 decimales; `ms` es la misma suma sin redondear. items = nº de intentos del día.
//   Un `ms` fuera de 0–86 400 000 (el límite del esquema de eventos) no suma, pero el intento cuenta como ítem.
//   Las filas salen ordenadas por `key` (texto ascendente); un área o tipo sin intentos no aparece.
import { SIGNAL_P } from './mastery.config.js';
import { levelOf, DEFAULT_RETENTION } from './srs.js';
import { aggregate } from './masteryAgg.js';
import { toDate, localDay } from './clock.js';
import { STATS_CONFIG } from './stats.config.js';
import { LIMITS } from './eventSchema.js';

//
// Tramo 2 (tarjetas y pronósticos). Entradas: `cards` = lista de tarjetas (8.4); `topics` = lista de temas (topics.json) y `results` = resultados de `mastery.compute`.
//   cardsByLevel(cards) → [{ level: 1..5, count }]     las 5 filas (con ceros) si hay tarjetas; [] si no hay ninguna. Cuentan las tarjetas con state ≠ 0 (ya vistas) y no suspendidas;
//     el nivel es `levelOf` (estabilidad FSRS, no el dominio del tema).
//   forecastReviews(cards, now, { days = 14 }?) → [{ day, count, overdue }]   una fila por día LOCAL desde hoy; hoy incluye las ya vencidas (`overdue` = cuántas de ellas); [] sin tarjetas contables.
//   retentionReport(events, { target?, from?, to? }?) → { target, reviews, retained, actual, series: [{ day, reviews, retained, actual }] }
//     Repaso = intento (como en T1) con `rating` 1–4 que NO es el primero de su tarjeta (el primero es aprender, no repasar); retenido = rating ≥ 2. actual = retained / reviews (null sin repasos).
//     El «primero de su tarjeta» se decide con TODA la lista recibida y el rango se aplica después: pásale el historial completo. target por defecto = DEFAULT_RETENTION (0,9).
//   heatmap(topics, results, { config? }?) → { areas, levels, cells: [{ area, level, topics, seen, weight, avg, pct, band, label, symbol, confidence }] }   área × nivel CEFR, con la media de `aggregate`.
//   masteryTrend(snapshots, topics, { by = 'area' }?) → { by, days, series: [{ key, points: [{ day, pct, seen }] }] }   snapshots = [{ day, results }] (una foto de `compute` por día; si hay dos del mismo día vale la última).
//     OJO: hoy nada guarda esas fotos; las guardará quien pinte la tendencia (3.4/3.6). Aquí solo se agrupan.//
// Tramo 3 (informativos y XP opcional). Ambos son SOLO informativos: no hay deuda, atraso ni castigo en ningún campo (roadmap 7.3, 3.4 y 3.6).
//   plannedVsDone(events, plans, range?) → { days: [{ day, plannedMinutes, doneMinutes, differenceMinutes }], totals: { plannedDays, plannedMinutes, doneMinutes, differenceMinutes, unplannedMinutes, plannedHours, doneHours } }
//     plans = [{ day, minutes }] (lo planeado por día, 0–1440; lo guardará 3.4: aquí solo se compara; un plan fuera de ese rango es ilegible y se ignora). Si un día sale dos veces vale el último (replanear sustituye).
//     Hecho = minutos de intentos de ese día (misma suma que `activityByDay`). Un día con actividad y sin plan sale con plannedMinutes y differenceMinutes en null (no hay
//     nada con qué compararlo, y NO se toma como «0 planeado»). differenceMinutes = hecho − planeado (con signo). Totales: solo comparan los días CON plan;
//     lo hecho en días sin plan va aparte en `unplannedMinutes`. Horas = minutos / 60 con 2 decimales. Vacío → days [] y totales en 0.
//   xpSummary(events, { from?, to?, config?, enabled? }?) → null | { xp, attempts, byDay: [{ day, xp }], rank: { index, id, label, min }, next: null | { id, label, min, remaining }, progress }
//     Opcional: con `enabled: false` (o `config.enabled` en false) devuelve null y NO calcula nada. XP = suma de `config.perResult[resultado]` de cada intento; nunca resta.
//     rank = el peldaño más alto con min ≤ xp; progress = avance (0–1) hacia `next` (1 en el último peldaño). Para un rango de vida pasa el historial completo.
//     `config` sustituye el bloque `xp` de `stats.config.js` entero y se valida: XP por intento de 0 a 1000, `min` de 0 a 1 000 000 000; negativos, peldaños desordenados o repetidos lanzan Error en español.
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const AREA_UNKNOWN = 'unknown';
// Topes que evitan que valores «finitos» pero absurdos desborden a Infinity al sumar o redondear (hallado con el fuzz de 1.9-T3).
const MAX_PLAN_MINUTES = 1440; // un día entero
const MAX_XP_PER_ATTEMPT = 1000;
const MAX_RANK_MIN = 1e9;
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function realDay(v) {
  if (typeof v !== 'string' || !DAY_RE.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

function readRange(range) {
  if (range === undefined || range === null) return { from: null, to: null };
  if (typeof range !== 'object' || Array.isArray(range)) throw new Error('stats: el rango debe ser un objeto { from?, to? }');
  for (const k of Object.keys(range)) if (k !== 'from' && k !== 'to') throw new Error(`stats: límite de rango desconocido "${k}"`);
  const from = range.from === undefined ? null : range.from;
  const to = range.to === undefined ? null : range.to;
  if (from !== null && !realDay(from)) throw new Error('stats: "from" debe ser un día real AAAA-MM-DD');
  if (to !== null && !realDay(to)) throw new Error('stats: "to" debe ser un día real AAAA-MM-DD');
  if (from !== null && to !== null && from > to) throw new Error('stats: "from" no puede ser posterior a "to"');
  return { from, to };
}

// Comprobador de días con memoria LOCAL a una llamada (no hay estado global): 50.000 eventos traen unas decenas de días distintos y
// validar cada texto con `Date` era el 65 % del tiempo de las consultas (1.9-T3).
function dayChecker() {
  const seen = new Map();
  return (v) => {
    if (typeof v !== 'string') return false;
    let ok = seen.get(v);
    if (ok === undefined) { ok = realDay(v); seen.set(v, ok); }
    return ok;
  };
}

// Intentos válidos dentro del rango: { day, type, topics, result, ms } con ms = número ≥ 0 o null.
function attempts(events, range) {
  if (!Array.isArray(events)) throw new Error('stats: los eventos deben ser una lista');
  const { from, to } = readRange(range);
  const isDay = dayChecker();
  const out = [];
  for (const e of events) {
    if (e === null || typeof e !== 'object' || e.type !== 'answer') continue;
    if (typeof e.result !== 'string' || !has(SIGNAL_P.value, e.result)) continue;
    if (!isDay(e.day)) continue;
    if (from !== null && e.day < from) continue;
    if (to !== null && e.day > to) continue;
    out.push({
      day: e.day,
      type: typeof e.exerciseType === 'string' && e.exerciseType !== '' ? e.exerciseType : null,
      topics: Array.isArray(e.topics) ? e.topics.filter((t) => typeof t === 'string' && t !== '') : [],
      result: e.result,
      ms: Number.isFinite(e.ms) && e.ms >= 0 && e.ms <= LIMITS.msMax ? e.ms : null, // el mismo tope que el esquema de eventos (24 h): más allá la suma se desbordaría
    });
  }
  return out;
}

const byKey = (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

function tally(rows, keysOf) {
  const map = new Map();
  for (const a of rows) {
    for (const key of keysOf(a)) {
      let r = map.get(key);
      if (!r) { r = { key, attempts: 0, correct: 0, almost: 0, wrong: 0, dontKnow: 0, accuracy: 0 }; map.set(key, r); }
      r.attempts += 1;
      if (a.result === 'correct') r.correct += 1;
      else if (a.result === 'almost') r.almost += 1;
      else if (a.result === 'wrong') r.wrong += 1;
      else r.dontKnow += 1;
    }
  }
  const out = [...map.values()].sort(byKey);
  for (const r of out) r.accuracy = (r.correct * SIGNAL_P.value.correct + r.almost * SIGNAL_P.value.almost) / r.attempts;
  return out;
}

export function activityByDay(events, range) {
  const days = new Map();
  for (const a of attempts(events, range)) {
    let d = days.get(a.day);
    if (!d) { d = { day: a.day, minutes: 0, items: 0, ms: 0 }; days.set(a.day, d); }
    d.items += 1;
    if (a.ms !== null) d.ms += a.ms;
  }
  const out = [...days.values()].sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : 0));
  for (const d of out) d.minutes = Math.round((d.ms / 60000) * 100) / 100;
  return out;
}

export function accuracyByType(events, range) {
  return tally(attempts(events, range), (a) => (a.type === null ? [] : [a.type]));
}

export function accuracyByTopic(events, range) {
  return tally(attempts(events, range), (a) => [...new Set(a.topics)]);
}

export function accuracyByArea(events, topics, range) {
  if (!Array.isArray(topics)) throw new Error('stats: los temas deben ser una lista de { id, area }');
  const areaOf = new Map();
  for (const t of topics) {
    if (t !== null && typeof t === 'object' && typeof t.id === 'string' && typeof t.area === 'string' && t.area !== '' && !areaOf.has(t.id)) areaOf.set(t.id, t.area);
  }
  // Un evento cuenta una sola vez por área, aunque tenga varios temas de la misma área.
  return tally(attempts(events, range), (a) => [...new Set(a.topics.map((id) => areaOf.get(id) ?? AREA_UNKNOWN))]);
}

export function avgTimeByType(events, range) {
  const map = new Map();
  for (const a of attempts(events, range)) {
    if (a.type === null || a.ms === null) continue;
    let r = map.get(a.type);
    if (!r) { r = { type: a.type, samples: 0, total: 0 }; map.set(a.type, r); }
    r.samples += 1;
    r.total += a.ms;
  }
  return [...map.values()]
    .sort((x, y) => (x.type < y.type ? -1 : x.type > y.type ? 1 : 0))
    .map((r) => ({ type: r.type, samples: r.samples, avgMs: Math.round(r.total / r.samples) }));
}

// ---------- Tramo 2 ----------
const countable = (c) => c !== null && typeof c === 'object' && c.state !== 0 && c.suspended !== true;

export function cardsByLevel(cards) {
  if (!Array.isArray(cards)) throw new Error('stats: las tarjetas deben ser una lista');
  const rows = [1, 2, 3, 4, 5].map((level) => ({ level, count: 0 }));
  let any = false;
  for (const c of cards) {
    if (!countable(c)) continue;
    any = true;
    rows[levelOf(c) - 1].count += 1;
  }
  return any ? rows : [];
}

export function forecastReviews(cards, now, { days = 14 } = {}) {
  if (!Array.isArray(cards)) throw new Error('stats: las tarjetas deben ser una lista');
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error('stats: "days" debe ser un entero de 1 a 366');
  const t = toDate(now); // lanza si `now` no se puede leer
  const keys = [];
  for (let i = 0; i < days; i += 1) keys.push(localDay(new Date(t.getFullYear(), t.getMonth(), t.getDate() + i, 12)));
  const rows = keys.map((day) => ({ day, count: 0, overdue: 0 }));
  const at = new Map(keys.map((k, i) => [k, i]));
  let any = false;
  for (const c of cards) {
    if (!countable(c)) continue;
    let due;
    try { due = localDay(c.due); } catch { continue; }
    any = true;
    if (due < keys[0]) { rows[0].count += 1; rows[0].overdue += 1; } else if (at.has(due)) rows[at.get(due)].count += 1;
  }
  return any ? rows : [];
}

export function retentionReport(events, { target = DEFAULT_RETENTION, from, to } = {}) {
  if (typeof target !== 'number' || !(target > 0 && target < 1)) throw new Error('stats: "target" debe ser un número entre 0 y 1 (sin incluirlos)');
  if (!Array.isArray(events)) throw new Error('stats: los eventos deben ser una lista');
  const range = readRange({ from, to });
  const isDay = dayChecker();
  const tries = events.filter((e) => e !== null && typeof e === 'object' && e.type === 'answer' && has(SIGNAL_P.value, e.result) && Number.isInteger(e.rating) && e.rating >= 1 && e.rating <= 4 && isDay(e.day));
  tries.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const seenCard = new Set();
  const days = new Map();
  let reviews = 0; let retained = 0;
  for (const e of tries) {
    if (typeof e.cardId === 'string' && e.cardId !== '') {
      if (!seenCard.has(e.cardId)) { seenCard.add(e.cardId); continue; } // primer intento de la tarjeta: aprender, no repasar
    }
    if (range.from !== null && e.day < range.from) continue;
    if (range.to !== null && e.day > range.to) continue;
    let d = days.get(e.day);
    if (!d) { d = { day: e.day, reviews: 0, retained: 0, actual: null }; days.set(e.day, d); }
    d.reviews += 1; reviews += 1;
    if (e.rating >= 2) { d.retained += 1; retained += 1; }
  }
  const series = [...days.values()].sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : 0));
  for (const d of series) d.actual = d.retained / d.reviews;
  return { target, reviews, retained, actual: reviews === 0 ? null : retained / reviews, series };
}

export function heatmap(topics, results, { config } = {}) {
  const opts = config === undefined ? {} : { config };
  const areas = aggregate(topics, results, { by: 'area', ...opts }).groups.map((g) => g.key);
  const levels = aggregate(topics, results, { by: 'level', ...opts }).groups.map((g) => g.key);
  const cells = [];
  for (const area of areas) {
    for (const level of levels) {
      const subset = topics.filter((t) => t.area === area && t.level === level);
      if (subset.length === 0) continue;
      const { key, ...rest } = aggregate(subset, results, { by: 'area', ...opts }).groups[0]; // eslint-disable-line no-unused-vars
      cells.push({ area, level, ...rest });
    }
  }
  return { areas, levels, cells };
}

export function masteryTrend(snapshots, topics, { by = 'area' } = {}) {
  if (!Array.isArray(snapshots)) throw new Error('stats: las fotos de dominio deben ser una lista');
  if (by !== 'area' && by !== 'level') throw new Error("stats: `by` debe ser 'area' o 'level'");
  const perDay = new Map();
  for (const sn of snapshots) {
    if (sn === null || typeof sn !== 'object' || !realDay(sn.day)) continue;
    if (!Array.isArray(sn.results) && !(sn.results instanceof Map)) continue;
    perDay.set(sn.day, sn.results); // la última del mismo día gana
  }
  const days = [...perDay.keys()].sort();
  const series = new Map();
  for (const day of days) {
    for (const g of aggregate(topics, perDay.get(day), { by }).groups) {
      if (!series.has(g.key)) series.set(g.key, { key: g.key, points: [] });
      series.get(g.key).points.push({ day, pct: g.pct, seen: g.seen });
    }
  }
  return { by, days, series: [...series.values()] };
}

// ---------- Tramo 3 ----------
const round2 = (x) => Math.round(x * 100) / 100;
const byDayAsc = (a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0);

export function plannedVsDone(events, plans, range) {
  if (!Array.isArray(plans)) throw new Error('stats: los planes deben ser una lista de { day, minutes }');
  const { from, to } = readRange(range);
  const planned = new Map();
  for (const p of plans) {
    if (p === null || typeof p !== 'object' || !realDay(p.day)) continue;
    if (!Number.isFinite(p.minutes) || p.minutes < 0 || p.minutes > MAX_PLAN_MINUTES) continue;
    if (from !== null && p.day < from) continue;
    if (to !== null && p.day > to) continue;
    planned.set(p.day, p.minutes); // el último plan del día sustituye a los anteriores
  }
  const doneMs = new Map(activityByDay(events, range).map((d) => [d.day, d.ms]));
  const keys = [...new Set([...planned.keys(), ...doneMs.keys()])].sort();
  const days = [];
  const totals = { plannedDays: 0, plannedMinutes: 0, doneMinutes: 0, differenceMinutes: 0, unplannedMinutes: 0, plannedHours: 0, doneHours: 0 };
  for (const day of keys) {
    const done = (doneMs.get(day) ?? 0) / 60000;
    if (planned.has(day)) {
      const plan = planned.get(day);
      days.push({ day, plannedMinutes: round2(plan), doneMinutes: round2(done), differenceMinutes: round2(done - plan) });
      totals.plannedDays += 1; totals.plannedMinutes += plan; totals.doneMinutes += done;
    } else {
      days.push({ day, plannedMinutes: null, doneMinutes: round2(done), differenceMinutes: null });
      totals.unplannedMinutes += done;
    }
  }
  totals.differenceMinutes = round2(totals.doneMinutes - totals.plannedMinutes);
  totals.plannedHours = round2(totals.plannedMinutes / 60);
  totals.doneHours = round2(totals.doneMinutes / 60);
  totals.plannedMinutes = round2(totals.plannedMinutes);
  totals.doneMinutes = round2(totals.doneMinutes);
  totals.unplannedMinutes = round2(totals.unplannedMinutes);
  return { days, totals };
}

function readXpConfig(config) {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) throw new Error('stats: `config` debe ser un objeto { enabled, perResult, ranks }');
  const { perResult, ranks } = config;
  if (perResult === null || typeof perResult !== 'object') throw new Error('stats: `config.perResult` debe ser un objeto con un valor por resultado');
  for (const k of Object.keys(SIGNAL_P.value)) {
    if (!Number.isFinite(perResult[k]) || perResult[k] < 0 || perResult[k] > MAX_XP_PER_ATTEMPT) throw new Error(`stats: el XP de \"${k}\" debe ser un número entre 0 y ${MAX_XP_PER_ATTEMPT} (la gamificación no resta)`);
  }
  if (!Array.isArray(ranks) || ranks.length === 0) throw new Error('stats: `config.ranks` debe ser una lista con al menos un rango');
  const ids = new Set();
  ranks.forEach((r, i) => {
    if (r === null || typeof r !== 'object' || typeof r.id !== 'string' || r.id === '' || typeof r.label !== 'string' || !Number.isFinite(r.min) || r.min < 0 || r.min > MAX_RANK_MIN) {
      throw new Error(`stats: cada rango debe ser { id, label, min } con min entre 0 y ${MAX_RANK_MIN}`);
    }
    if (ids.has(r.id)) throw new Error(`stats: rango repetido \"${r.id}\"`);
    ids.add(r.id);
    if (i === 0 && r.min !== 0) throw new Error('stats: el primer rango debe empezar en 0 XP');
    if (i > 0 && r.min <= ranks[i - 1].min) throw new Error('stats: los rangos deben ir en orden ascendente de `min`, sin repetir');
  });
  return { perResult, ranks };
}

export function xpSummary(events, { from, to, config = STATS_CONFIG.xp, enabled } = {}) {
  if (enabled !== undefined && typeof enabled !== 'boolean') throw new Error('stats: `enabled` debe ser verdadero o falso');
  const on = enabled === undefined ? config?.enabled !== false : enabled;
  if (!on) return null; // desactivada: no se toca nada
  const { perResult, ranks } = readXpConfig(config);
  const days = new Map();
  let xp = 0;
  const tries = attempts(events, { from, to });
  for (const a of tries) {
    const v = perResult[a.result];
    xp += v;
    days.set(a.day, (days.get(a.day) ?? 0) + v);
  }
  const byDay = [...days].map(([day, v]) => ({ day, xp: round2(v) })).sort(byDayAsc);
  xp = round2(xp);
  let index = 0;
  while (index + 1 < ranks.length && ranks[index + 1].min <= xp) index += 1;
  const cur = ranks[index];
  const nxt = ranks[index + 1] ?? null;
  return {
    xp,
    attempts: tries.length,
    byDay,
    rank: { index, id: cur.id, label: cur.label, min: cur.min },
    next: nxt === null ? null : { id: nxt.id, label: nxt.label, min: nxt.min, remaining: round2(nxt.min - xp) },
    progress: nxt === null ? 1 : (xp - cur.min) / (nxt.min - cur.min),
  };
}
