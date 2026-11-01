// @purpose: Dominio de un tema: combina las señales en un porcentaje y calcula su banda y su confianza.
// Dominio de un tema (subparte 1.7, tramo 2). Roadmap 7.5 y 8.7. Combina las señales de core/masterySignals.js.
//   createMastery({ db, events, errors, srs, clock?, config?, u? }) → { compute, bandOf, confidenceOf, combine } (objeto congelado)
//     db      motor de core/db.js (se lee `cards` por el índice `topics`).   events  createEvents(...).   errors  createErrors(...).
//     srs     createSrs(...): se usa `srs.retrievability`.   u  OPCIONAL `async (topicId, now) → 0..1 | null` (señal U; la conecta 5.10; sin ella U = null).
//   compute(topicId, now?) → Promise<{ topicId, pct, rawPct, band, label, symbol, confidence, signals: {R,P,U,E}, evidence, caps, detail }>
//     pct       entero 0..100. 0 SOLO si el tema no tiene respuestas (banda «unseen»); con respuestas es ≥ 1.
//     rawPct    el pct antes de aplicar topes. caps: [{ kind: 'consecutive_fails'|'recurrent_error', ... }] (los que están activos).
//     lowEvidence  true si el tema tiene menos de `evidence.minAnswers` respuestas o menos de `evidence.minItems` ítems distintos (FIX 2.9-T4): entonces
//                  pct ≤ máximo de la banda `evidence.maxBand` (59), la confianza es `low` y la interfaz dice «poca evidencia todavía». No entra en `caps`.
//     band      id de la banda (`unseen|initial|progress|solid|mastered`); label y symbol salen de BANDS.
//     evidence  número de eventos `answer` del tema.
//   R: una tarjeta cuyo último resultado calificado fue fallo aporta 0 hasta que acierte (`config.R.zeroAfterFail`, FIX 2.9-T4).
//   Funciones puras exportadas: bandOf(pct), confidenceOf(answers, uKnown), combine(signals), masteryToSophiaVal(pct).
import { toDate, localDay } from './clock.js';
import { classifyError } from './db.js';
import { signalR, signalP, signalE } from './masterySignals.js';
import { MASTERY_CONFIG, MS_PER_DAY } from './mastery.config.js';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const FAIL = new Set(['wrong', 'dont_know']);
const GRADED = new Set(['correct', 'almost', 'wrong', 'dont_know']);
const byTs = (a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function bandIndex(pct, config = MASTERY_CONFIG) {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) throw new Error('bandOf: pct debe ser un número');
  const p = clamp(Math.round(pct), 0, 100);
  return config.bands.findIndex((b) => p >= b.min && p <= b.max);
}
export function bandOf(pct, config = MASTERY_CONFIG) { return config.bands[bandIndex(pct, config)]; }

// Pesos de 8.7. Una señal null se quita y los demás pesos se reparten en proporción. E siempre existe (0 = sin reincidencia).
// Sin ninguna señal positiva (R, P y U nulas) no hay evidencia de dominio: devuelve null (el que llama decide el mínimo).
export function combine({ R, P, U, E }, config = MASTERY_CONFIG) {
  const w = config.weights;
  if (R === null && P === null && U === null) return null;
  const parts = [[w.R, R], [w.P, P], [w.U, U], [w.E, 1 - E]].filter(([, v]) => v !== null);
  const total = parts.reduce((s, [wt]) => s + wt, 0);
  return 100 * (parts.reduce((s, [wt, v]) => s + wt * v, 0) / total);
}

// Confianza (8.7). `answers` = eventos answer del tema. Sesiones: por sessionId; sin él, un día local cuenta como una sesión.
export function confidenceOf(answers, uKnown, config = MASTERY_CONFIG) {
  const n = answers.length;
  const sessions = new Set(answers.map((e) => (typeof e.sessionId === 'string' ? `s:${e.sessionId}` : `d:${localDay(e.ts)}`)));
  const times = answers.map((e) => Date.parse(e.ts)).filter(Number.isFinite);
  const span = times.length === 0 ? 0 : Math.max(...times) - Math.min(...times);
  const types = new Set(answers.map((e) => e.exerciseType));
  const c = config.confidence;
  let level = 0;
  if (n >= c.mid.events && sessions.size >= c.mid.sessions) level = 1;
  if (n >= c.high.events && sessions.size >= c.high.sessions && span >= c.high.spanDays * MS_PER_DAY && types.size >= c.high.exerciseTypes) level = 2;
  if (!uKnown) level = Math.max(0, level - 1);
  return ['low', 'mid', 'high'][level];
}

// 0–4 para una futura integración con Sophia (7.5): 0 % → 0, 100 % → 4.
export function masteryToSophiaVal(pct) {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) throw new Error('masteryToSophiaVal: pct debe ser un número');
  return clamp(Math.round(clamp(pct, 0, 100) / 25), 0, 4);
}

// Tope por evidencia (FIX 2.9-T4): pocas respuestas o pocos ítems distintos. Devuelve { low, answers, items, maxPct } (no lanza con datos raros).
export function evidenceOf(answers, config = MASTERY_CONFIG) {
  const rule = config.evidence;
  const items = new Set(answers.map((e) => e.itemId ?? e.cardId).filter((k) => typeof k === 'string')).size;
  const maxPct = config.bands.find((b) => b.id === rule.maxBand)?.max ?? 59;
  return { low: answers.length < rule.minAnswers || items < rule.minItems, answers: answers.length, items, maxPct };
}

// Último resultado calificado por tarjeta (o por ítem si el evento no trae tarjeta). `answers` ya viene ordenado por tiempo.
function lastResults(answers) {
  const last = new Map();
  for (const e of answers) {
    if (!GRADED.has(e.result)) continue;
    const key = e.cardId ?? e.itemId;
    if (typeof key === 'string') last.set(key, e.result);
  }
  return last;
}

// Descenso 1: los dos ÚLTIMOS intentos calificados de una misma tarjeta (o ítem) fueron fallos. Un acierto posterior lo levanta.
function consecutiveFails(answers, config) {
  const groups = new Map();
  for (const e of answers) {
    if (!GRADED.has(e.result)) continue;
    const key = e.cardId ?? e.itemId;
    if (typeof key !== 'string') continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  const need = config.drops.consecutiveFails;
  const out = [];
  for (const [key, list] of groups) {
    if (list.length >= need && list.slice(-need).every((e) => FAIL.has(e.result))) out.push({ kind: 'consecutive_fails', key });
  }
  return out;
}

// Descenso 2: un código recurrente (3 veces en 14 días, errors.recurrent). Un acierto del tema posterior a su última aparición lo levanta.
function recurrentCaps(rows, answers) {
  const out = [];
  for (const row of rows) {
    const last = Date.parse(row.last);
    const fixed = Number.isFinite(last) && answers.some((e) => (e.result === 'correct' || e.result === 'almost') && Date.parse(e.ts) > last);
    if (!fixed) out.push({ kind: 'recurrent_error', code: row.code, inWindow: row.inWindow });
  }
  return out;
}

export function createMastery({ db, events, errors, srs, clock, config = MASTERY_CONFIG, u } = {}) {
  if (!db || typeof db.query !== 'function') throw new Error('createMastery: falta la base de datos (db.query)');
  if (!events || typeof events.byTopic !== 'function') throw new Error('createMastery: faltan los eventos (events.byTopic)');
  if (!errors || typeof errors.recurrent !== 'function') throw new Error('createMastery: falta el registro de errores (errors.recurrent)');
  if (!srs || typeof srs.retrievability !== 'function') throw new Error('createMastery: falta el motor SRS (srs.retrievability)');
  if (u !== undefined && typeof u !== 'function') throw new Error('createMastery: `u` debe ser una función');
  if (clock !== undefined && (!clock || typeof clock.now !== 'function')) throw new Error('createMastery: reloj no válido');

  async function compute(topicId, now) {
    if (typeof topicId !== 'string' || topicId === '') throw new Error('mastery.compute: topicId debe ser un texto no vacío');
    let at;
    try { at = toDate(now === undefined ? (clock ? clock.now() : new Date()) : now); } catch { throw new Error('mastery.compute: now debe ser una fecha (Date, milisegundos o texto ISO)'); }
    try {
      const cards = await db.query('cards', { index: 'topics', value: topicId });
      const topicEvents = (await events.byTopic(topicId)).slice().sort(byTs);
      const answers = topicEvents.filter((e) => e.type === 'answer');
      const rows = await errors.recurrent({ by: 'code', topic: topicId, now: at });
      const uRaw = u ? await u(topicId, at) : null;
      const U = typeof uRaw === 'number' && Number.isFinite(uRaw) ? clamp(uRaw, 0, 1) : null;

      const last = lastResults(answers);
      const r = signalR(cards, at, { retrievability: srs.retrievability, lastResult: (card) => last.get(card.id), config });
      const p = signalP(answers, topicId, at, { config });
      const e = signalE(rows, { config });
      const signals = { R: r.value, P: p.value, U, E: e.value };
      const detail = { R: { cards: r.cards, ignored: r.ignored, failed: r.failed }, P: { attempts: p.attempts, ignored: p.ignored }, E: { codes: e.codes } };
      const base = { topicId, signals, evidence: answers.length, detail };

      if (answers.length === 0) {
        return { ...base, pct: 0, rawPct: 0, band: config.bands[0].id, label: config.bands[0].label, symbol: config.bands[0].symbol, confidence: 'low', caps: [], lowEvidence: false };
      }
      const combined = combine(signals, config);
      const rawPct = combined === null ? 1 : clamp(Math.round(combined), 1, 100);
      const caps = [...consecutiveFails(answers, config), ...recurrentCaps(rows, answers)];
      let pct = rawPct;
      const k = bandIndex(rawPct, config);
      if (caps.length > 0 && k >= 2) pct = Math.min(rawPct, config.bands[k - 1].max); // tope: el máximo de la banda inferior (nunca baja de «Inicial»)
      const ev = evidenceOf(answers, config);
      if (ev.low) pct = Math.min(pct, ev.maxPct); // tope por evidencia: poca práctica no puede mostrarse como «Sólido» ni «Dominado»
      const band = bandOf(pct, config);
      const confidence = ev.low ? 'low' : confidenceOf(answers, U !== null, config);
      return { ...base, pct, rawPct, band: band.id, label: band.label, symbol: band.symbol, confidence, caps, lowEvidence: ev.low };
    } catch (err) {
      throw classifyError(err, { store: 'mastery' });
    }
  }

  return Object.freeze({ compute, bandOf: (pct) => bandOf(pct, config), confidenceOf: (a, uKnown) => confidenceOf(a, uKnown, config), combine: (s) => combine(s, config) });
}
