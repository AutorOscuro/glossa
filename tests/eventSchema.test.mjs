// Pruebas de core/eventSchema.js (subparte 1.1, cuarto 1): validación, valores por defecto, día local e IDs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEvent, buildEvent, createIdGenerator, makeEventId, EventError,
  EVENT_TYPES, EVENT_FIELDS, REQUIRED_BY_TYPE, LIMITS,
} from '../core/eventSchema.js';
import { createRng } from '../core/rng.js';
import { makeEvent, makeClock } from './_helpers.mjs';

// Un evento "answer" válido tal como lo recibiría log() (sin id ni day).
const input = (over = {}) => {
  const { id, day, ...rest } = makeEvent();
  void id; void day;
  return { ...rest, ...over };
};
const without = (...keys) => { const o = input(); for (const k of keys) delete o[k]; return o; };
const paths = (r) => r.problems.map((p) => p.path);

test('un evento answer válido pasa y se devuelve una COPIA normalizada con todos los campos del contrato 8.6', () => {
  const src = input();
  const r = validateEvent(src);
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.value), EVENT_FIELDS.filter((k) => k !== 'id' && k !== 'day'));
  assert.deepEqual(r.value, src);
  assert.notEqual(r.value, src); assert.notEqual(r.value.topics, src.topics);
  r.value.topics.push('x'); assert.equal(src.topics.length, 1);
});

test('mínimo de un answer: los opcionales toman su valor por defecto', () => {
  const r = validateEvent({ type: 'answer', itemId: 'g.pp.0001', topics: ['gram.x'], exerciseType: 'fix_error', result: 'wrong', mode: 'mech', channel: 'keyboard' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, {
    ts: null, type: 'answer', sessionId: null, cardId: null, itemId: 'g.pp.0001', topics: ['gram.x'], exerciseType: 'fix_error',
    result: 'wrong', rating: null, ms: null, hint: false, dontKnow: false, responseRaw: null, errorCodes: [], mode: 'mech', channel: 'keyboard',
  });
});

test('los 9 tipos del contrato son válidos con sus campos mínimos', () => {
  const minimal = {
    answer: input(), session_start: { type: 'session_start', sessionId: 'ses_1' }, session_end: { type: 'session_end', sessionId: 'ses_1', ms: 600000 },
    tap_word: { type: 'tap_word', responseRaw: 'ceiling' }, ai_call: { type: 'ai_call', mode: 'ai' },
    exam_entry: { type: 'exam_entry', topics: ['gram.x'] }, exam_exit: { type: 'exam_exit', topics: ['gram.x'] },
    import: { type: 'import' }, note: { type: 'note', responseRaw: 'me confundí con for/since' },
  };
  assert.deepEqual(Object.keys(minimal).sort(), [...EVENT_TYPES].sort());
  for (const [t, ev] of Object.entries(minimal)) assert.equal(validateEvent(ev).ok, true, t);
});

test('los campos obligatorios por tipo son exactamente estos (literal independiente de la constante)', () => {
  assert.deepEqual({ ...REQUIRED_BY_TYPE }, {
    answer: ['itemId', 'topics', 'exerciseType', 'result', 'mode', 'channel'],
    session_start: ['sessionId'], session_end: ['sessionId'], tap_word: ['responseRaw'], ai_call: [],
    exam_entry: ['topics'], exam_exit: ['topics'], import: [], note: ['responseRaw'],
  });
});

test('cada campo obligatorio por tipo falta → error con la ruta del campo', () => {
  for (const [type, req] of Object.entries(REQUIRED_BY_TYPE)) {
    for (const k of req) {
      const base = { answer: input(), session_start: { type, sessionId: 's' }, session_end: { type, sessionId: 's' }, tap_word: { type, responseRaw: 'w' }, exam_entry: { type, topics: ['a.b'] }, exam_exit: { type, topics: ['a.b'] }, note: { type, responseRaw: 'n' } }[type];
      for (const bad of [undefined, null]) {
        const ev = { ...base }; if (bad === undefined) delete ev[k]; else ev[k] = null;
        const r = validateEvent(ev);
        assert.equal(r.ok, false, `${type}.${k}=${bad}`);
        assert.ok(paths(r).includes(k), `${type}.${k}: ${JSON.stringify(r.problems)}`);
      }
    }
  }
});

test('casos inválidos tabulados: cada uno se rechaza y señala el campo exacto', () => {
  const cases = [
    ['sin type', without('type'), 'type'],
    ['type desconocido', input({ type: 'respuesta' }), 'type'],
    ['type no es texto', input({ type: 5 }), 'type'],
    ['campo desconocido', input({ extra: 1 }), 'extra'],
    ['campo __proto__ propio', JSON.parse('{"__proto__": 1, "type": "note", "responseRaw": "x"}'), '__proto__'],
    ['id enviado', input({ id: 'evt_20261015T1400_abcd' }), 'id'],
    ['day enviado', input({ day: '2026-10-15' }), 'day'],
    ['ts sin Z', input({ ts: '2026-10-15T14:00:00.000' }), 'ts'],
    ['ts con offset', input({ ts: '2026-10-15T14:00:00.000+05:00' }), 'ts'],
    ['ts sin milisegundos', input({ ts: '2026-10-15T14:00:00Z' }), 'ts'],
    ['ts fecha imposible', input({ ts: '2026-02-31T14:00:00.000Z' }), 'ts'],
    ['ts mes 13', input({ ts: '2026-13-01T14:00:00.000Z' }), 'ts'],
    ['ts número', input({ ts: 1760536800000 }), 'ts'],
    ['ts Date', input({ ts: new Date() }), 'ts'],
    ['itemId con mayúsculas', input({ itemId: 'G.PP.0001', cardId: null }), 'itemId'],
    ['itemId con espacio', input({ itemId: 'g pp', cardId: null }), 'itemId'],
    ['itemId vacío', input({ itemId: '', cardId: null }), 'itemId'],
    ['itemId muy largo', input({ itemId: 'a'.repeat(101), cardId: null }), 'itemId'],
    ['cardId sin faceta', input({ cardId: 'g.pp.0001', itemId: 'g.pp.0001' }), 'cardId'],
    ['cardId de otro ítem', input({ cardId: 'g.pp.0002#0', itemId: 'g.pp.0001' }), 'cardId'],
    ['cardId número', input({ cardId: 7 }), 'cardId'],
    ['sessionId con espacio', input({ sessionId: 'ses 1' }), 'sessionId'],
    ['sessionId muy largo', input({ sessionId: 's'.repeat(81) }), 'sessionId'],
    ['topics no es lista', input({ topics: 'gram.x' }), 'topics'],
    ['topics null', input({ topics: null }), 'topics'],
    ['topics vacío en answer', input({ topics: [] }), 'topics'],
    ['topic inválido', input({ topics: ['gram.x', 'Gram X'] }), 'topics[1]'],
    ['topic no es texto', input({ topics: [3] }), 'topics[0]'],
    ['demasiados topics', input({ topics: Array.from({ length: 21 }, (_, i) => `t.${i}`) }), 'topics'],
    ['exerciseType con mayúscula', input({ exerciseType: 'Fix_Error' }), 'exerciseType'],
    ['exerciseType empieza con número', input({ exerciseType: '1x' }), 'exerciseType'],
    ['result desconocido', input({ result: 'bien' }), 'result'],
    ['result mayúsculas', input({ result: 'CORRECT' }), 'result'],
    ['rating 0', input({ rating: 0 }), 'rating'],
    ['rating 5', input({ rating: 5 }), 'rating'],
    ['rating decimal', input({ rating: 2.5 }), 'rating'],
    ['rating texto', input({ rating: '3' }), 'rating'],
    ['ms negativo', input({ ms: -1 }), 'ms'],
    ['ms NaN', input({ ms: NaN }), 'ms'],
    ['ms Infinity', input({ ms: Infinity }), 'ms'],
    ['ms mayor que un día', input({ ms: LIMITS.msMax + 1 }), 'ms'],
    ['ms texto', input({ ms: '5000' }), 'ms'],
    ['hint texto', input({ hint: 'sí' }), 'hint'],
    ['hint null', input({ hint: null }), 'hint'],
    ['dontKnow número', input({ dontKnow: 1 }), 'dontKnow'],
    ['dontKnow verdadero con result correct', input({ dontKnow: true, result: 'correct' }), 'dontKnow'],
    ['result dont_know con dontKnow falso', input({ result: 'dont_know', dontKnow: false }), 'dontKnow'],
    ['responseRaw número', input({ responseRaw: 42 }), 'responseRaw'],
    ['responseRaw demasiado largo', input({ responseRaw: 'a'.repeat(LIMITS.responseRaw + 1) }), 'responseRaw'],
    ['responseRaw con NUL', input({ responseRaw: 'hola\u0000' }), 'responseRaw'],
    ['responseRaw con escape ESC', input({ responseRaw: 'a\u001Bb' }), 'responseRaw'],
    ['errorCodes no es lista', input({ errorCodes: 'TNS.SINCE_FOR' }), 'errorCodes'],
    ['errorCodes null', input({ errorCodes: null }), 'errorCodes'],
    ['código en minúsculas', input({ errorCodes: ['tns.since_for'] }), 'errorCodes[0]'],
    ['código sin punto', input({ errorCodes: ['TNS'] }), 'errorCodes[0]'],
    ['demasiados códigos', input({ errorCodes: Array.from({ length: 21 }, (_, i) => `A.B${i}`) }), 'errorCodes'],
    ['mode desconocido', input({ mode: 'manual' }), 'mode'],
    ['channel desconocido', input({ channel: 'mouse' }), 'channel'],
  ];
  assert.ok(cases.length >= 55);
  for (const [name, ev, path] of cases) {
    const r = validateEvent(ev);
    assert.equal(r.ok, false, `debía rechazarse: ${name}`);
    assert.ok(paths(r).includes(path), `${name}: se esperaba la ruta "${path}", llegó ${JSON.stringify(paths(r))}`);
  }
});

test('entradas absurdas no lanzan excepción: devuelven ok:false con un mensaje', () => {
  const weird = [undefined, null, 0, 1, NaN, '', 'evento', true, [], [1, 2], () => 1, Symbol('x'), new Date(), new Map(), new (class A { constructor() { this.type = 'note'; } })()];
  for (const w of weird) {
    const r = validateEvent(w);
    assert.equal(r.ok, false);
    assert.equal(r.problems.length >= 1, true);
    assert.deepEqual(r.problems, [{ path: '', message: 'el evento debe ser un objeto' }], String(typeof w)); // por el motivo correcto, no por casualidad
  }
  assert.equal(validateEvent(Object.create(null, { type: { value: 'import', enumerable: true } })).ok, true);
});

test('permite texto con acentos, ñ, emoji, comillas curvas, saltos de línea, espacios y 2.000 caracteres; no recorta nada', () => {
  for (const raw of ['  I’ve lived aquí desde hace dos años 🙂 ', 'línea 1\nlínea 2\tcon tab\r\n', 'ñandú — “quoted”', 'a'.repeat(LIMITS.responseRaw), '']) {
    const r = validateEvent(input({ responseRaw: raw }));
    assert.equal(r.ok, true, JSON.stringify(raw.slice(0, 20)));
    assert.equal(r.value.responseRaw, raw);
  }
});

test('topics y errorCodes repetidos se reducen conservando el orden; ms se redondea', () => {
  const r = validateEvent(input({ topics: ['a.b', 'c.d', 'a.b'], errorCodes: ['PRON.-ED', 'TNS.PP_PS', 'PRON.-ED'], ms: 1234.6 }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.topics, ['a.b', 'c.d']);
  assert.deepEqual(r.value.errorCodes, ['PRON.-ED', 'TNS.PP_PS']);
  assert.equal(r.value.ms, 1235);
});

test('dontKnow se deduce de result "dont_know" cuando no se envía', () => {
  const r = validateEvent(input({ result: 'dont_know', rating: 1, dontKnow: undefined }));
  assert.equal(r.ok, true); assert.equal(r.value.dontKnow, true);
  assert.equal(validateEvent(input({ result: 'dont_know', dontKnow: true })).ok, true);
});

test('un evento con varios errores los informa todos (hasta el tope) y el mensaje de EventError es descriptivo', () => {
  const bad = input({ result: 'x', rating: 9, mode: 'y', topics: 'z' });
  const r = validateEvent(bad);
  assert.deepEqual(paths(r).sort(), ['mode', 'rating', 'result', 'topics']);
  const many = {}; for (let i = 0; i < 100; i += 1) many[`campo${i}`] = i;
  assert.ok(validateEvent(many).problems.length <= LIMITS.problems);
  const e = new EventError(r.problems);
  assert.equal(e.code, 'BAD_EVENT'); assert.match(e.message, /^Evento no válido: .*rating: debe ser un entero de 1 a 4/);
  assert.ok(e.friendly.length > 20); assert.equal(e.problems, r.problems);
  assert.match(new EventError(new Array(8).fill({ path: 'a', message: 'b' })).message, /y 3 más/);
});

test('el mensaje de error nunca incluye lo que la persona escribió', () => {
  const secret = 'texto-privado-de-la-persona';
  const r = validateEvent(input({ responseRaw: secret + '\u0000' }));
  assert.equal(r.ok, false);
  assert.equal(new EventError(r.problems).message.includes(secret), false);
});

test('validateEvent no modifica su entrada (ni congelada)', () => {
  const src = input({ topics: ['a.b'], errorCodes: ['A.B'] });
  Object.freeze(src.topics); Object.freeze(src.errorCodes); Object.freeze(src);
  assert.equal(validateEvent(src).ok, true);
});

test('fuzz: 3.000 objetos aleatorios no lanzan nunca, y todo lo que pasa vuelve a pasar como guardado', () => {
  const rng = createRng(7);
  const junk = [undefined, null, 0, -1, 1.5, NaN, '', 'x', 'evt_1', 'ñ', '🙂', true, false, [], [null], ['a.b'], {}, { a: 1 }, 'correct', 'answer', 'mech', 'keyboard', 3, 99999999999];
  const valid = input();
  let accepted = 0;
  for (let n = 0; n < 3000; n += 1) {
    const ev = {};
    for (const k of EVENT_FIELDS) {
      if (k === 'id' || k === 'day' || rng.next() < 0.08) continue;
      ev[k] = rng.next() < 0.93 ? structuredClone(valid[k]) : rng.pick(junk); // mezcla de valores buenos y basura
    }
    if (rng.next() < 0.5) ev.type = rng.pick(EVENT_TYPES);
    const r = validateEvent(ev);
    if (r.ok) {
      accepted += 1;
      const stored = { ...r.value, ts: r.value.ts ?? '2026-10-15T14:00:00.000Z', id: 'evt_20261015T1400_abcd', day: '2026-10-15' };
      assert.equal(validateEvent(stored, { stored: true }).ok, true, JSON.stringify(stored));
    }
  }
  assert.ok(accepted > 100 && accepted < 2900, `el fuzz debe aceptar y rechazar de ambos: aceptó ${accepted}`);
});

test('stored=true exige id, ts y day bien formados y acepta lo que construye buildEvent', () => {
  const idGen = createIdGenerator({ rng: createRng(1) });
  const ev = buildEvent(input(), { now: new Date('2026-10-15T14:00:00.000Z'), idGen });
  assert.equal(validateEvent(ev, { stored: true }).ok, true);
  assert.equal(validateEvent(ev).ok, false); // como entrada de log() no puede traer id/day
  for (const [k, v] of [['id', 'x'], ['id', null], ['day', '15/10/2026'], ['day', null], ['ts', null]]) {
    const r = validateEvent({ ...ev, [k]: v }, { stored: true });
    assert.equal(r.ok, false, `${k}=${v}`); assert.ok(paths(r).includes(k));
  }
  assert.equal(validateEvent({ ...ev, id: 'evt_20261015T1400_0001' }, { stored: true }).ok, true); // forma de la fábrica de pruebas
  assert.equal(validateEvent(makeEvent(), { stored: true }).ok, true);
});

// ---------- buildEvent: ts y día local ----------
const withTZ = (tz, fn) => {
  const prev = process.env.TZ;
  process.env.TZ = tz;
  try { return fn(); } finally { if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev; }
};
const dayIn = (tz, ts) => withTZ(tz, () => buildEvent(input({ ts }), { idGen: createIdGenerator({ rng: createRng(1) }) }).day);

test('buildEvent: sin ts toma el del reloj (Date) y asigna id y day; con ts lo respeta', () => {
  const clock = makeClock('2026-10-15T14:00:00.000Z');
  const idGen = createIdGenerator({ rng: createRng(3) });
  const a = buildEvent(without('ts'), { now: clock.now(), idGen });
  assert.equal(a.ts, '2026-10-15T14:00:00.000Z'); assert.match(a.id, /^evt_20261015T1400_[a-z0-9]{7}$/);
  assert.deepEqual(Object.keys(a), EVENT_FIELDS);
  const b = buildEvent(input({ ts: '2026-01-02T03:04:05.678Z' }), { now: clock.now(), idGen });
  assert.equal(b.ts, '2026-01-02T03:04:05.678Z'); assert.match(b.id, /^evt_20260102T0304_/);
});

test('buildEvent: lanza EventError si el evento no vale, y Error claro si falta idGen o el reloj', () => {
  const idGen = createIdGenerator({ rng: createRng(1) });
  assert.throws(() => buildEvent(input({ rating: 9 }), { now: new Date(), idGen }), (e) => e instanceof EventError && e.problems[0].path === 'rating');
  assert.throws(() => buildEvent(input(), { now: new Date() }), /falta idGen/);
  assert.throws(() => buildEvent(without('ts'), { idGen }), /toDate/);
  assert.throws(() => buildEvent(without('ts'), { now: new Date('x'), idGen }), /toDate/);
  assert.equal(idGen.peek(), 0, 'un evento inválido no gasta contador');
});

test('día local: medianoche en Bogotá (UTC−5): 04:59:59.999Z es el 15 y 05:00:00.000Z ya es el 16', () => {
  assert.equal(dayIn('America/Bogota', '2026-10-16T04:59:59.999Z'), '2026-10-15');
  assert.equal(dayIn('America/Bogota', '2026-10-16T05:00:00.000Z'), '2026-10-16');
  assert.equal(dayIn('America/Bogota', '2026-12-31T23:59:59.999Z'), '2026-12-31'); // en UTC ya sería casi el 1 de enero
  assert.equal(dayIn('America/Bogota', '2027-01-01T04:59:59.999Z'), '2026-12-31');
  assert.equal(dayIn('America/Bogota', '2027-01-01T05:00:00.000Z'), '2027-01-01'); // cambio de año
});

test('día local: cambio de zona del dispositivo (viaje) usa la zona vigente al registrar', () => {
  const ts = '2026-10-15T23:30:00.000Z';
  assert.equal(dayIn('America/Bogota', ts), '2026-10-15');
  assert.equal(dayIn('Europe/Madrid', ts), '2026-10-16'); // UTC+2
  assert.equal(dayIn('Asia/Kolkata', ts), '2026-10-16'); // UTC+5:30
  assert.equal(dayIn('Pacific/Auckland', ts), '2026-10-16'); // UTC+13 en verano austral
  assert.equal(dayIn('Pacific/Kiritimati', '2026-10-15T10:30:00.000Z'), '2026-10-16'); // UTC+14
  assert.equal(dayIn('Etc/GMT+12', '2026-10-16T11:59:59.999Z'), '2026-10-15'); // UTC−12
  assert.equal(dayIn('UTC', ts), '2026-10-15');
});

test('día local: cambios de hora (verano) no saltan ni repiten el día', () => {
  // Nueva York: 2026-03-08 adelanta (02:00 EST → 03:00 EDT) y 2026-11-01 atrasa (02:00 EDT → 01:00 EST).
  assert.equal(dayIn('America/New_York', '2026-03-08T06:59:59.999Z'), '2026-03-08');
  assert.equal(dayIn('America/New_York', '2026-03-08T07:00:00.000Z'), '2026-03-08');
  assert.equal(dayIn('America/New_York', '2026-11-01T05:30:00.000Z'), '2026-11-01'); // 01:30 EDT
  assert.equal(dayIn('America/New_York', '2026-11-01T06:30:00.000Z'), '2026-11-01'); // 01:30 EST (la hora repetida)
  assert.equal(dayIn('America/New_York', '2026-11-02T04:59:59.999Z'), '2026-11-01');
  assert.equal(dayIn('America/New_York', '2026-11-02T05:00:00.000Z'), '2026-11-02');
});

test('reloj del dispositivo raro: fechas muy pasadas o futuras no rompen el registro', () => {
  const idGen = createIdGenerator({ rng: createRng(1) });
  for (const iso of ['1970-01-01T00:00:00.000Z', '2000-02-29T12:00:00.000Z', '2099-12-31T23:59:59.999Z', '9999-12-31T23:59:59.999Z']) {
    const ev = buildEvent(without('ts'), { now: new Date(iso), idGen });
    assert.equal(ev.ts, iso); assert.match(ev.day, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.equal(validateEvent(input({ ts: '0000-01-01T00:00:00.000Z' })).ok, true);
});

// ---------- IDs ----------
test('IDs: formato del contrato 8.6 (evt_AAAAMMDDTHHMM_…), minúsculas y solo [a-z0-9_]', () => {
  const id = makeEventId('2026-10-15T14:00:00.000Z', 0, createRng(1));
  assert.match(id, /^evt_20261015T1400_0000[a-z0-9]{3}$/);
  assert.match(makeEventId('2026-10-15T14:00:59.999Z', 35, createRng(1)), /^evt_20261015T1400_000z/);
  assert.match(makeEventId('2026-10-15T14:00:00.000Z', 36 ** 4, createRng(1)), /^evt_20261015T1400_10000[a-z0-9]{3}$/); // pasa de 4 dígitos sin romperse
});

test('IDs: 10.000 llamadas en el mismo milisegundo, todas distintas', () => {
  const idGen = createIdGenerator({ rng: createRng(99) });
  const ts = '2026-10-15T14:00:00.000Z';
  const seen = new Set();
  for (let i = 0; i < 10000; i += 1) seen.add(idGen.next(ts));
  assert.equal(seen.size, 10000);
  assert.equal(idGen.peek(), 10000);
});

test('IDs: 10.000 eventos construidos con el mismo reloj congelado, todos únicos y todos válidos como guardados', () => {
  const idGen = createIdGenerator({ rng: createRng(5) });
  const now = new Date('2026-10-15T14:00:00.000Z');
  const ids = new Set();
  for (let i = 0; i < 10000; i += 1) {
    const ev = buildEvent(input({ responseRaw: `r${i}` }), { now, idGen });
    ids.add(ev.id);
    if (i % 500 === 0) assert.equal(validateEvent(ev, { stored: true }).ok, true);
  }
  assert.equal(ids.size, 10000);
});

test('IDs: deterministas con la misma semilla; instancias con semillas distintas se separan por la parte al azar', () => {
  const ts = '2026-10-15T14:00:00.000Z';
  const a = createIdGenerator({ rng: createRng(1) }); const b = createIdGenerator({ rng: createRng(1) }); const c = createIdGenerator({ rng: createRng(2) });
  const sa = Array.from({ length: 50 }, () => a.next(ts)); const sb = Array.from({ length: 50 }, () => b.next(ts)); const sc = Array.from({ length: 50 }, () => c.next(ts));
  assert.deepEqual(sa, sb);
  const clashes = sa.filter((x, i) => x === sc[i]).length;
  assert.ok(clashes < 5, `demasiados choques entre instancias: ${clashes}`);
});

test('IDs: entradas inválidas lanzan un error claro', () => {
  const rng = createRng(1);
  for (const ts of [undefined, null, 5, '2026-10-15', '2026-10-15T14:00:00Z', new Date()]) assert.throws(() => makeEventId(ts, 0, rng), /ts debe ser/);
  for (const n of [-1, 1.5, '1', NaN, undefined]) assert.throws(() => makeEventId('2026-10-15T14:00:00.000Z', n, rng), /contador/);
  assert.throws(() => makeEventId('2026-10-15T14:00:00.000Z', 0, {}), /rng/);
  assert.throws(() => createIdGenerator({ rng: {} }), /rng/);
});

test('rendimiento: validar y construir 10.000 eventos tarda poco (< 2 s)', () => {
  const idGen = createIdGenerator({ rng: createRng(1) });
  const now = new Date('2026-10-15T14:00:00.000Z');
  const t0 = Date.now();
  for (let i = 0; i < 10000; i += 1) buildEvent(input(), { now, idGen });
  assert.ok(Date.now() - t0 < 2000, `tardó ${Date.now() - t0} ms`);
});

// ---------- Hallazgos de la revisión final (primero la prueba que falla, luego el arreglo) ----------
test('validateEvent nunca lanza, tampoco con valores sin toString, getters que fallan o Proxy hostiles', () => {
  const hostile = [
    { type: Object.create(null) },
    { type: { toString() { throw new Error('boom'); } } },
    { type: Symbol('x') },
    { type: 'note', responseRaw: 'x', get itemId() { throw new Error('getter hostil'); } },
    new Proxy({ type: 'note' }, { ownKeys() { throw new Error('proxy hostil'); } }),
    new Proxy({}, { getPrototypeOf() { throw new Error('proxy hostil 2'); } }),
  ];
  for (const h of hostile) {
    let r;
    assert.doesNotThrow(() => { r = validateEvent(h); });
    assert.equal(r.ok, false);
    assert.ok(r.problems.length >= 1);
  }
});

test('buildEvent no fabrica un día que el propio validador rechazaría: fecha fuera de rango → EventError en ts', () => {
  const idGen = createIdGenerator({ rng: createRng(1) });
  const build = (tz, ts) => withTZ(tz, () => buildEvent(input({ ts }), { idGen }));
  assert.throws(() => build('Asia/Kolkata', '9999-12-31T23:59:59.999Z'), (e) => e instanceof EventError && e.problems[0].path === 'ts'); // el día local sería del año 10000
  assert.throws(() => build('America/Bogota', '0000-01-01T00:00:00.000Z'), (e) => e instanceof EventError && e.problems[0].path === 'ts'); // el día local sería del año −1
  assert.equal(idGen.peek(), 0, 'no gasta contador');
  // Lo plausible sí pasa en cualquier zona, incluido el "reloj en cero" (1970) de un teléfono sin batería de reloj.
  for (const tz of ['America/Bogota', 'UTC', 'Pacific/Kiritimati', 'Etc/GMT+12']) {
    for (const ts of ['1970-01-01T00:00:00.000Z', '2038-01-19T03:14:08.000Z', '2100-01-01T00:00:00.000Z']) {
      const ev = build(tz, ts);
      assert.equal(validateEvent(ev, { stored: true }).ok, true, `${tz} ${ts}`);
    }
  }
});

test('validateEvent lee la entrada UNA sola vez: un getter que falla en la segunda lectura no escapa', () => {
  let reads = 0;
  const ev = { type: 'note', get responseRaw() { reads += 1; if (reads > 1) throw new Error('segunda lectura'); return 'ok'; } };
  let r;
  assert.doesNotThrow(() => { r = validateEvent(ev); });
  assert.equal(r.ok, true); assert.equal(r.value.responseRaw, 'ok'); assert.equal(reads, 1);
});

test('el motivo del error de type distingue "no es texto" de "tipo desconocido" y recorta lo largo', () => {
  const msg = (v) => validateEvent({ type: v }).problems.find((p) => p.path === 'type').message;
  assert.equal(msg(5), 'debe ser texto'); assert.equal(msg({}), 'debe ser texto');
  assert.equal(msg(undefined), 'es obligatorio'); assert.equal(msg(null), 'es obligatorio');
  assert.equal(msg('respuesta'), 'tipo desconocido "respuesta"');
  assert.equal(msg('x'.repeat(500)), `tipo desconocido "${'x'.repeat(30)}"`);
});
