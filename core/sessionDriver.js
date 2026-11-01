// @purpose: Conductor del ejecutor de sesión: arma o retoma una sesión y avanza ítem por ítem (cronómetro, calificación, guardado atómico, restauración) sin tocar el DOM.
// Conductor de sesión (subparte 2.1, tramo 3). Roadmap 2.1 y 17. Une lo que ya existe (T1 y T2) y NO dibuja nada: la vista (ui/views/sesion.js) lo usa.
// Sin DOM. El reloj es `study.clock` y el azar del identificador sale de `rng` (por defecto `systemRng` de core/rng.js).
//
//   NEW_SESSION_ID = 'nueva'    valor del parámetro de la ruta #/sesion/:id que pide una sesión nueva.
//   startSession({ study, options?, rng? }) → Promesa
//       { status: 'started', sessionId, state, items, plan }  | { status: 'empty', plan }  (plan vacío: `plan.reason.message_es` dice por qué)
//       Arma el plan con `study.plan(options)`, crea el estado (START) y lo guarda con `study.session.save` (la última sesión guardada gana).
//       Si guardar falla, rechaza: no se empieza una sesión que no se podría retomar. Con `study` sin base rechaza con un Error en español.
//   startRetrySession({ study, items, rng? }) → Promesa { status: 'started', sessionId, state, items } | { status: 'empty' }   (2.8-T3: «Repetir los que fallé»)
//       Mini-sesión con las entradas dadas (las de una sesión anterior), sin repetir tarjeta y hasta MAX_ITEMS, en el orden recibido. Las entradas sin `cardId` o `itemId` se descartan.
//       Sin ninguna válida → 'empty' y no escribe nada. Guarda igual que startSession: **la última sesión guardada gana**, así que reemplaza a la que hubiera.
//   resumeSession({ study, sessionId }) → Promesa { status: 'restored', sessionId, state, items } | { status: 'none' | 'expired' | 'invalid' | 'other' }
//       'other' = hay una sesión guardada pero es otra (no se borra). El resto lo decide `study.session.load` (caduca a las 12 h, descarta lo dañado).
//   createSessionDriver({ study, timer, sessionId, state, items, log? }) → objeto congelado
//       { getState(), getItems(), current(), idle(), prepare(), shown(), submit(answer), skipUnsupported(), next() }
//     timer    createAnswerTimer(...) (core/answerTimer.js): arranca en `shown()` y se detiene al responder.
//     idle() → Promesa que se cumple cuando terminan todas las operaciones en curso (la vista la espera antes de salir).
//     prepare() → Promesa: carga la mediana personal de tiempo por tipo (opcional; si falla se usan las constantes por tipo). Nunca rechaza.
//     shown()  presenting → answering y arranca el cronómetro. Devuelve true si cambió.
//     submit(answer) → Promesa
//         answer = { result, exerciseType?, hint?, dontKnow?, responseRaw?, errorCodes?, errors? }  (el tiempo lo pone el cronómetro, no el ejercicio)
//         { status: 'saved' | 'duplicate', result, rating, dueLabel, event, sessionSaved }  o  { status: 'ignored', reason }.
//         Orden fijo: tarjeta → gradeAnswer → `study.commit` (evento + tarjeta + errores en UNA transacción) → transición SUBMIT → `study.session.save`.
//         Idempotente: todo pasa por una cola, así que un segundo toque ve la fase `feedback` y se ignora; si la app se cerró entre el commit y el guardado,
//         `commit` detecta el duplicado por sesión y tarjeta. Si el commit falla rechaza y el estado NO cambia (se puede repetir; el tiempo medido se conserva).
//         Si solo falla guardar la sesión, la respuesta ya está guardada: devuelve sessionSaved false y avisa por `log`.
//     skipUnsupported() → Promesa: para un ejercicio que aún no existe. Salta SIN evento y SIN tocar la tarjeta (no se castiga lo que no se pudo mostrar).
//     next() → Promesa { status: 'advanced' | 'finished' | 'ignored', state, summary? , finish? }: feedback → next → siguiente ítem (o resumen).
//         Al terminar llama a `study.finish()` (borra la sesión guardada y toma la foto diaria); si eso falla se avisa por `log` y el resumen se muestra igual.
import { createState, transition, validateState, summarize, MAX_ITEMS } from './sessionRunner.js';
import { gradeAnswer } from './gradeAnswer.js';
import { loadBaselines } from './gradingBaseline.js';
import { toDate } from './clock.js';
import { systemRng } from './rng.js';

export const NEW_SESSION_ID = 'nueva';
const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const need = (cond, message) => { if (!cond) throw new Error(`sesión: ${message}`); };

function newSessionId(study, rng) {
  const stamp = toDate(study.clock.now()).toISOString().replace(/[-:]/g, '').slice(0, 13);
  const source = rng && typeof rng.next === 'function' ? rng : systemRng;
  let tail = '';
  for (let i = 0; i < 4; i += 1) tail += ID_CHARS[Math.floor(source.next() * ID_CHARS.length)];
  return `ses_${stamp}_${tail}`;
}

const toEntry = (it) => ({
  cardId: it.cardId, itemId: it.itemId, facet: it.facet ?? null, topic: it.topic ?? null,
  exerciseType: it.exerciseType ?? null, kind: it.kind ?? null, why: it.why ?? null, topics: [...(it.topics ?? [])],
});

async function saveNewSession(study, items, rng) {
  const state = transition(createState(), { type: 'START', total: items.length }).state;
  const sessionId = newSessionId(study, rng);
  await study.session.save({ sessionId, state, items });
  return { sessionId, state };
}

export async function startSession({ study, options = {}, rng } = {}) {
  need(isObj(study) && typeof study.plan === 'function', 'faltan los servicios de estudio');
  need(study.session && typeof study.session.save === 'function', 'no hay dónde guardar la sesión (la base no abrió)');
  const plan = await study.plan(options);
  if (!plan || plan.count === 0) return { status: 'empty', plan };
  const items = plan.items.map(toEntry);
  const { sessionId, state } = await saveNewSession(study, items, rng);
  return { status: 'started', sessionId, state, items, plan };
}

export async function startRetrySession({ study, items, rng } = {}) {
  need(isObj(study) && study.session && typeof study.session.save === 'function' && study.clock, 'no hay dónde guardar la sesión (la base no abrió)');
  const seen = new Set();
  const entries = [];
  for (const it of Array.isArray(items) ? items : []) {
    if (!isObj(it) || typeof it.cardId !== 'string' || it.cardId === '' || typeof it.itemId !== 'string' || it.itemId === '' || seen.has(it.cardId)) continue;
    seen.add(it.cardId);
    entries.push(toEntry(it));
    if (entries.length === MAX_ITEMS) break;
  }
  if (entries.length === 0) return { status: 'empty' };
  const { sessionId, state } = await saveNewSession(study, entries, rng);
  return { status: 'started', sessionId, state, items: entries };
}

export async function resumeSession({ study, sessionId } = {}) {
  need(isObj(study) && study.session && typeof study.session.load === 'function', 'no hay dónde leer la sesión guardada (la base no abrió)');
  const loaded = await study.session.load(study.clock.now());
  if (loaded.status !== 'restored') return { status: loaded.status };
  if (loaded.sessionId !== sessionId) return { status: 'other' };
  return { status: 'restored', sessionId: loaded.sessionId, state: loaded.state, items: loaded.items };
}

export function createSessionDriver({ study, timer, sessionId, state, items, log = console.error } = {}) {
  need(isObj(study) && typeof study.commit === 'function' && study.db && study.srs && study.clock, 'faltan los servicios de estudio (base, repaso, reloj y commit)');
  need(timer && typeof timer.start === 'function' && typeof timer.stop === 'function', 'falta el cronómetro');
  need(typeof sessionId === 'string' && sessionId !== '', 'falta el identificador de la sesión');
  need(Array.isArray(items), 'los ítems deben ser una lista');
  let current = validateState(state);
  need(items.length === current.total, 'la lista de ítems no coincide con el total de la sesión');
  let baselines = null;
  let queue = Promise.resolve();
  // Cola: una operación a la vez, en el orden en que llegaron. Un fallo de una no frena a las siguientes.
  const enqueue = (fn) => { const run = queue.then(fn); queue = run.then(() => {}, () => {}); return run; };

  const saveSession = async (s) => {
    try { await study.session.save({ sessionId, state: s, items }); return true; } catch (e) {
      log('No se pudo guardar el avance de la sesión (la respuesta sí quedó guardada)', e);
      return false;
    }
  };

  const driver = {
    getState: () => current,
    getItems: () => items,
    current() {
      const live = current.phase === 'presenting' || current.phase === 'answering' || current.phase === 'feedback' || current.phase === 'next';
      return live ? items[current.index] ?? null : null;
    },

    idle: () => queue,

    async prepare() {
      try { baselines = await loadBaselines({ events: study.events, now: study.clock.now() }); } catch (e) {
        log('No se pudo leer la mediana personal de tiempo; se usan las constantes por tipo', e);
        baselines = null;
      }
    },

    shown() {
      const r = transition(current, 'SHOWN');
      if (!r.changed) return false;
      current = r.state;
      timer.start();
      return true;
    },

    submit(answer) {
      return enqueue(async () => {
        if (current.phase !== 'answering') return { status: 'ignored', reason: current.phase };
        need(isObj(answer), 'la respuesta debe ser un objeto');
        const entry = items[current.index];
        const exerciseType = answer.exerciseType ?? entry.exerciseType;
        const t = timer.stop(); // idempotente: tras un fallo y un reintento devuelve la misma medición
        const card = await study.db.get('cards', entry.cardId);
        need(isObj(card), 'la tarjeta de este ejercicio ya no existe');
        const grade = gradeAnswer({
          answer: { result: answer.result, hint: answer.hint, dontKnow: answer.dontKnow, responseRaw: answer.responseRaw, errorCodes: answer.errorCodes, ms: t.ms, interrupted: t.interrupted },
          card, srs: study.srs, now: study.clock.now(), exerciseType, sessionId, ...(baselines ? { baselines } : {}),
        });
        const saved = await study.commit({ grade, errors: answer.errors ?? [] });
        current = transition(current, { type: 'SUBMIT', result: saved.event.result }).state;
        const sessionSaved = await saveSession(current);
        return { status: saved.duplicate ? 'duplicate' : 'saved', result: saved.event.result, rating: saved.event.rating, dueLabel: grade.dueLabel, event: saved.event, sessionSaved };
      });
    },

    skipUnsupported() {
      return enqueue(async () => {
        if (current.phase !== 'answering') return { status: 'ignored', reason: current.phase };
        timer.stop();
        current = transition(current, { type: 'SUBMIT', result: 'skipped' }).state;
        const sessionSaved = await saveSession(current);
        return { status: 'skipped', sessionSaved };
      });
    },

    next() {
      return enqueue(async () => {
        let s = current;
        if (s.phase === 'feedback') s = transition(s, 'CONTINUE').state;
        if (s.phase !== 'next') return { status: 'ignored', reason: current.phase, state: current };
        s = transition(s, 'ADVANCE').state;
        current = s;
        if (s.phase !== 'summary') {
          await saveSession(s);
          return { status: 'advanced', state: s };
        }
        let finish = null;
        try { finish = await study.finish(); } catch (e) { log('No se pudo cerrar la sesión guardada; se reintentará al reabrir', e); }
        return { status: 'finished', state: s, summary: summarize(s), finish };
      });
    },
  };
  return Object.freeze(driver);
}
