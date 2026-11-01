// @purpose: Cableado de los servicios de estudio (eventos, repaso, errores, dominio y armador de sesiones) sobre la base y los ajustes; tolera una base ausente.
// Servicios de estudio (subparte 2.1, tramo 1). Roadmap 2.1, 17 (punto de acople «Cableado de servicios») y mapa «Servicios».
//
//   createStudyServices({ db?, settings?, catalog?, topics?, clock?, rng?, log? }) → objeto CONGELADO
//     { available, missing, db, settings, clock, srs, events, errors, catalog, topics, mastery, board, plan(options), commit(…), session, snapshot, finish() }
//     · `db` puede ser null (la base no abrió): `srs` y `plan` siguen existiendo; `events`, `errors`, `mastery` y `board` quedan en null y `available` es false.
//     · Sin `catalog` (error_codes.json no cargó) tampoco hay `errors`, `mastery` ni `board`: `missing` lista qué falta ('db' | 'catalog').
//     · `events` es la versión de `board.wrapEvents`: SU `log` invalida la caché del dominio. Quien registre un evento debe usar este `log`, no otro.
//       Los errores no entran en la caché del dominio: quien los registre sin un `log` posterior llama a `board.invalidate(topicIds)`.
//     · plan(options) → Promesa del SessionPlan de core/session.js. Lee las tarjetas y los ítems retirados de la base, toma de los ajustes
//       `dailyNewCap`, `dailyReviewCap` y `leechThreshold`, y pasa `srs.retrievability`. `options` pisa esos valores (size, energy, areas, items,
//       topicFocus, errorFocus, mastery, newToday, reviewsToday…). Salvo lo que `options` ya traiga, los cuenta `core/dailyUsage.js` desde los eventos de hoy
//       (tarjetas distintas; si la lectura falla se avisa por log y valen 0). Sin base devuelve el plan vacío con su razón `no_material`. No guarda nada.
//     · commit({ grade, errors? }) → Promesa: guarda UNA respuesta (evento + tarjeta + errores) en una transacción, idempotente por sesión y tarjeta (core/answerCommit.js).
//       Con `db` en null es null. Sin catálogo guarda evento y tarjeta pero rechaza si se le piden errores.
//     · `srs` es createSrs con `withEarlyReview` (core/earlyReview.js): un fallo adelantado en menos de 24 h reinicia la tarjeta; lo demás no cambia.
//     · session → { save, load, clear } de core/sessionStore.js: guarda y restaura la sesión a mitad (null con `db` en null). Va DESPUÉS de `commit`.
//     · snapshot → { take, takeIfMissing, list } de core/masterySnapshot.js (foto diaria de dominio; null sin base, sin catálogo o sin temas).
//     · finish() → Promesa { cleared, snapshot, snapshotError }: al cerrar la sesión borra la sesión guardada y toma la foto diaria. NUNCA rechaza por la foto:
//       si falla avisa por log y devuelve snapshot null y snapshotError con el mensaje; si falla borrar la sesión guardada, esa base sí se rechaza. Null sin base.
//
//   startServices({ storageReady, settingsReady, services, fetchFn?, clock?, rng?, log? }) → Promesa del objeto anterior (NUNCA rechaza)
//     Espera la base y los ajustes, carga error_codes.json y topics.json con `fetchFn` (una falla se registra y se degrada, no se propaga),
//     arma los servicios y los deja en `services.study`. Las vistas esperan `services.studyReady` (esta promesa) y leen `services.study` al usarlo.
import { createEvents } from '../core/events.js';
import { createSessionStore } from '../core/sessionStore.js';
import { withEarlyReview } from '../core/earlyReview.js';
import { createMasterySnapshot } from '../core/masterySnapshot.js';
import { createErrors } from '../core/errors.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createMastery } from '../core/mastery.js';
import { createMasteryBoard } from '../core/masteryBoard.js';
import { createSrs } from '../core/srsEngine.js';
import { build } from '../core/session.js';
import { countToday } from '../core/dailyUsage.js';
import { createAnswerCommit } from '../core/answerCommit.js';
import { deprecatedItemIds } from '../core/contentImport.js';
import { systemClock } from '../core/clock.js';
import { systemRng } from '../core/rng.js';

export const CATALOG_URL = 'content/taxonomy/error_codes.json';
export const TOPICS_URL = 'content/taxonomy/topics.json';

const settingOf = (settings, key) => (settings && typeof settings.get === 'function' ? settings.get(key) : undefined);

export function createStudyServices({ db = null, settings = null, catalog = null, topics = [], clock = systemClock, rng = systemRng, log = console.error } = {}) {
  const srs = withEarlyReview(createSrs({ settings }));
  const missing = [];
  let events = null; let errors = null; let mastery = null; let board = null; let commit = null; let session = null; let snapshot = null;
  if (!db) missing.push('db');
  if (!catalog) missing.push('catalog');
  if (db) {
    const rawEvents = createEvents({ db, clock, rng });
    events = rawEvents;
    if (catalog) {
      errors = createErrors({ db, catalog, clock });
      mastery = createMastery({ db, events: rawEvents, errors, srs, clock });
      board = createMasteryBoard({ mastery, db, clock });
      events = board.wrapEvents(rawEvents);
    }
    if (board && Array.isArray(topics) && topics.length) snapshot = createMasterySnapshot({ db, board, topics, clock });
    commit = createAnswerCommit({ db, events, errors, board }).commit;
    session = createSessionStore({ db, clock });
  }
  const topicList = Array.isArray(topics) ? topics : [];

  async function finish() {
    if (!session) return null;
    const { cleared } = await session.clear();
    if (!snapshot) return { cleared, snapshot: null, snapshotError: null };
    try { return { cleared, snapshot: await snapshot.take(), snapshotError: null }; } catch (e) {
      log('No se pudo guardar la foto diaria de dominio', e);
      return { cleared, snapshot: null, snapshotError: String(e?.message ?? e) };
    }
  }

  async function plan(options = {}) {
    const cards = db ? await db.query('cards', {}) : [];
    const deprecated = db ? await deprecatedItemIds(db) : new Set();
    const defaults = { now: clock.now(), cards, rng, topics: topicList, deprecatedItemIds: deprecated, retrievability: srs.retrievability };
    const newCap = settingOf(settings, 'dailyNewCap');
    const reviewCap = settingOf(settings, 'dailyReviewCap');
    const leech = settingOf(settings, 'leechThreshold');
    if (Number.isInteger(newCap)) defaults.newCap = newCap;
    if (Number.isInteger(reviewCap)) defaults.reviewCap = reviewCap;
    if (Number.isInteger(leech)) defaults.leechThreshold = leech;
    if (events) {
      try {
        const used = await countToday({ events, now: defaults.now });
        defaults.newToday = used.newToday;
        defaults.reviewsToday = used.reviewsToday;
      } catch (e) {
        log('No se pudo contar lo estudiado hoy; el plan usa 0', e);
      }
    }
    try {
      return build({ ...defaults, ...options });
    } catch (e) {
      log('No se pudo armar la sesión', e);
      throw e;
    }
  }

  return Object.freeze({ available: missing.length === 0, missing: Object.freeze(missing), db, settings, clock, srs, events, errors, catalog, topics: topicList, mastery, board, plan, commit, session, snapshot, finish });
}

async function loadJson(fetchFn, url) {
  const res = await fetchFn(url);
  if (!res || !res.ok) throw new Error(`No se pudo leer ${url}`);
  return res.json();
}

export async function startServices({ storageReady, settingsReady, services, fetchFn = globalThis.fetch?.bind(globalThis), clock, rng, log = console.error } = {}) {
  let db = null;
  let settings = null;
  try { db = (await storageReady)?.db ?? null; } catch (e) { log('Los servicios de estudio no pudieron esperar al almacenamiento', e); }
  try { settings = (await settingsReady)?.settings ?? null; } catch (e) { log('Los servicios de estudio no pudieron esperar a los ajustes', e); }
  let catalog = null;
  let topics = [];
  if (typeof fetchFn !== 'function') {
    log('Sin fetch: los servicios de estudio quedan sin catálogo de errores ni temas');
  } else {
    try { catalog = createErrorCatalog(await loadJson(fetchFn, CATALOG_URL)); } catch (e) { log('No se pudo cargar el catálogo de errores', e); }
    try { const t = await loadJson(fetchFn, TOPICS_URL); topics = Array.isArray(t?.topics) ? t.topics : []; } catch (e) { log('No se pudo cargar la lista de temas', e); }
  }
  let study;
  try {
    study = createStudyServices({ db, settings, catalog, topics, ...(clock ? { clock } : {}), ...(rng ? { rng } : {}), log });
  } catch (e) {
    log('No se pudieron armar los servicios de estudio; se arma una versión mínima', e);
    study = createStudyServices({ db: null, settings, catalog: null, topics: [], log });
  }
  if (services && typeof services === 'object') services.study = study;
  // Primer arranque del día: la foto se toma sin bloquear el arranque; `services.snapshotReady` nunca rechaza.
  const snapshotReady = (async () => {
    if (!study.snapshot) return null;
    try { return await study.snapshot.takeIfMissing(); } catch (e) { log('No se pudo tomar la foto diaria de dominio al arrancar', e); return null; }
  })();
  if (services && typeof services === 'object') services.snapshotReady = snapshotReady;
  return study;
}
