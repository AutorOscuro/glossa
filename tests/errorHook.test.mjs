// @purpose: Pruebas de la interfaz del hook de clasificación de errores (core/errorHook.js).
// Pruebas del cuarto 2 de la 1.6 (parte 3): interfaz del hook de clasificación (IA en 5.5, detector mecánico en el cuarto 3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createErrors, ErrorRecordError } from '../core/errors.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createErrorHook, cleanVerdict, reconcile, CLASSIFY_BATCH_MAX, MAX_ENTRIES } from '../core/errorHook.js';
import { createMemoryDb } from '../core/db.memory.js';
import { makeClock } from './_helpers.mjs';

const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
const TS = '2026-10-15T14:00:00.000Z';

async function setup({ classifier = null, onWrite = null } = {}) {
  const db = createMemoryDb({ onWrite });
  await db.open();
  const errors = createErrors({ db, catalog: CATALOG, clock: makeClock('2026-10-15T14:00:00.000Z') });
  const hook = createErrorHook({ errors, catalog: CATALOG, classifier });
  return { db, errors, hook };
}
// Un clasificador falso que anota lo que recibe y responde con `answer(entries, callNumber)`.
function fake(answer) {
  const calls = [];
  return { calls, classify: async (entries) => { calls.push(entries); return answer(entries, calls.length); } };
}
const rows = (db) => db.query('errors', {});

// ---------- construcción ----------
test('createErrorHook: exige errors y catalog, y un clasificador con classify()', async () => {
  const { errors } = await setup();
  assert.throws(() => createErrorHook(), /registro de errores/);
  assert.throws(() => createErrorHook({ errors: {}, catalog: CATALOG }), /registro de errores/);
  assert.throws(() => createErrorHook({ errors }), /catálogo/);
  assert.throws(() => createErrorHook({ errors, catalog: {} }), /catálogo/);
  assert.throws(() => createErrorHook({ errors, catalog: CATALOG, classifier: {} }), /classify/);
  assert.throws(() => createErrorHook({ errors, catalog: CATALOG, classifier: 'ia' }), /classify/);
  const h = createErrorHook({ errors, catalog: CATALOG });
  assert.equal(h.hasClassifier, false);
  assert.ok(Object.isFrozen(h));
  assert.equal(createErrorHook({ errors, catalog: CATALOG, classifier: fake(() => []) }).hasClassifier, true);
});

// ---------- sin clasificador: el modo «sin IA» no cambia nada ----------
test('sin clasificador: se anotan las entradas con código y las demás quedan «unclassified» sin tocar la base', async () => {
  const { db, hook } = await setup();
  const out = await hook.classifyAndRecord([
    { original: "I didn't can to send it", code: 'VRB.CAN_TO', ts: TS },
    { original: 'algo sin código', ts: TS },
    { original: 'I dont know nothing', code: 'NEG.DOUBLE', ts: TS },
  ]);
  assert.deepEqual(out.results.map((r) => [r.index, r.status]), [[0, 'recorded'], [1, 'unclassified'], [2, 'recorded']]);
  assert.equal(out.recorded, 2);
  assert.deepEqual(out.classifier, { used: false, ok: true, sent: 0, error: null });
  assert.equal(out.results[1].result, null);
  assert.match(out.results[1].error, /sin código/);
  assert.equal((await rows(db)).length, 2);
});

test('sin clasificador el resultado de una entrada con código es exactamente el de errors.record', async () => {
  const { errors, hook } = await setup();
  const direct = await errors.record({ original: 'frase', code: 'VRB.CAN_TO', ts: TS, impact: 'low' });
  const viaHook = await hook.classifyAndRecord([{ original: 'frase', code: 'VRB.CAN_TO', ts: TS, impact: 'low' }]);
  assert.deepEqual(viaHook.results[0].result, { ...direct, created: false, counted: false, replay: true }); // el mismo ts: es la misma ocurrencia
});

// ---------- con clasificador ----------
test('el clasificador pone el código que falta y el resto de campos válidos', async () => {
  const c = fake(() => [{ code: 'VRB.CAN_TO', kind: 'systematic', origin: 'developmental', impact: 'low', topics: ['gram.modals.no_to'] }]);
  const { hook } = await setup({ classifier: c });
  const out = await hook.classifyAndRecord([{ original: "I didn't can to send it", ts: TS }]);
  const rec = out.results[0].result.record;
  assert.deepEqual([out.results[0].status, rec.code, rec.kind, rec.origin, rec.impact, rec.topics], ['recorded', 'VRB.CAN_TO', 'systematic', 'developmental', 'low', ['gram.modals.no_to']]);
  assert.deepEqual(out.classifier, { used: true, ok: true, sent: 1, error: null });
  assert.deepEqual(out.results[0].discarded, []);
});

test('EL CAMPO EXPLÍCITO GANA: lo que trae la entrada nunca lo pisa el clasificador; este solo rellena huecos', async () => {
  const c = fake(() => [{ code: 'NEG.DOUBLE', kind: 'systematic', origin: 'unknown_pure', impact: 'high', topics: ['gram.negation.double_negative'] }]);
  const { hook } = await setup({ classifier: c });
  const out = await hook.classifyAndRecord([{ original: 'frase', ts: TS, impact: 'low', origin: 'transfer_es', topics: ['gram.modals.no_to'] }]);
  const rec = out.results[0].result.record;
  assert.deepEqual([rec.code, rec.impact, rec.origin, rec.topics, rec.kind], ['NEG.DOUBLE', 'low', 'transfer_es', ['gram.modals.no_to'], 'systematic']);
});

test('con código explícito y modo por defecto NO se consulta (ahorra cupo); con { classify: "all" } sí, y el veredicto rellena huecos', async () => {
  const c = fake(() => [{ code: 'NEG.DOUBLE', impact: 'low', origin: 'developmental' }]);
  const { hook } = await setup({ classifier: c });
  const a = await hook.classifyAndRecord([{ original: 'uno', code: 'VRB.CAN_TO', ts: TS }]);
  assert.equal(c.calls.length, 0);
  assert.equal(a.classifier.used, false);
  const b = await hook.classifyAndRecord([{ original: 'dos', code: 'VRB.CAN_TO', ts: TS }], { classify: 'all' });
  assert.equal(c.calls.length, 1);
  const rec = b.results[0].result.record;
  assert.deepEqual([rec.code, rec.impact, rec.origin], ['VRB.CAN_TO', 'low', 'developmental']); // el código explícito gana; impact y origin eran huecos
});

test('al clasificador solo le llegan 4 textos por entrada (original, correction, context, itemId); nunca ts, código ni nada más', async () => {
  const c = fake((es) => es.map(() => null));
  const { hook } = await setup({ classifier: c });
  await hook.classifyAndRecord([
    { original: 'a', correction: 'b', context: 'c', itemId: 'it1', ts: TS, source: 'chat', impact: 'low', secreto: 'x' },
    { original: 5, correction: {}, context: [], itemId: 7 },
    { original: 'solo esto' },
  ]);
  assert.deepEqual(c.calls[0], [
    { original: 'a', correction: 'b', context: 'c', itemId: 'it1' },
    { original: null, correction: null, context: null, itemId: null },
    { original: 'solo esto', correction: null, context: null, itemId: null },
  ]);
});

test('lotes: 45 entradas sin código se consultan en 3 llamadas de ≤ 20 (CLASSIFY_BATCH_MAX) y cada veredicto vuelve a SU entrada', async () => {
  assert.equal(CLASSIFY_BATCH_MAX, 20);
  const c = fake((es) => es.map((e) => ({ code: e.original.endsWith('0') ? 'NEG.DOUBLE' : 'VRB.CAN_TO' })));
  const { db, hook } = await setup({ classifier: c });
  const entries = Array.from({ length: 45 }, (_, i) => ({ original: `frase ${i}`, ts: TS }));
  const out = await hook.classifyAndRecord(entries);
  assert.deepEqual(c.calls.map((x) => x.length), [20, 20, 5]);
  assert.equal(out.classifier.sent, 45);
  assert.equal(out.recorded, 45);
  out.results.forEach((r, i) => assert.equal(r.result.record.code, i % 10 === 0 ? 'NEG.DOUBLE' : 'VRB.CAN_TO', `entrada ${i}`));
  assert.equal((await rows(db)).length, 45);
});

test('una entrada con código y otras sin: solo se consultan las que faltan, y el orden de los resultados es el de entrada', async () => {
  const c = fake((es) => es.map(() => ({ code: 'PRON.TH' })));
  const { hook } = await setup({ classifier: c });
  const out = await hook.classifyAndRecord([{ original: 'a', ts: TS }, { original: 'b', code: 'NEG.DOUBLE', ts: TS }, { original: 'c', ts: TS }]);
  assert.deepEqual(c.calls[0].map((e) => e.original), ['a', 'c']);
  assert.deepEqual(out.results.map((r) => [r.index, r.result.record.code]), [[0, 'PRON.TH'], [1, 'NEG.DOUBLE'], [2, 'PRON.TH']]);
});

// ---------- veredictos que no valen ----------
test('veredicto con código inventado: se descarta (con registro del descarte) y la entrada queda «unclassified»', async () => {
  const c = fake(() => [{ code: 'INVENTADO.X', impact: 'high' }]);
  const { db, hook } = await setup({ classifier: c });
  const out = await hook.classifyAndRecord([{ original: 'frase', ts: TS }]);
  assert.equal(out.results[0].status, 'unclassified');
  assert.deepEqual(out.results[0].discarded, [{ field: 'code', reason: 'no está en el catálogo', value: 'INVENTADO.X' }]);
  assert.equal((await rows(db)).length, 0);
});

test('veredicto con campos sueltos inválidos: se tiran solo esos y se aprovecha el resto', async () => {
  const c = fake(() => [{ code: 'VRB.CAN_TO', kind: 'grave', origin: 5, impact: 'high', topics: ['gram.modals.no_to', 'no es id', 7, 'gram.modals.no_to'], extra: 1 }]);
  const { hook } = await setup({ classifier: c });
  const out = await hook.classifyAndRecord([{ original: 'frase', ts: TS }]);
  const rec = out.results[0].result.record;
  assert.deepEqual([rec.code, rec.impact, rec.kind, rec.origin, rec.topics], ['VRB.CAN_TO', 'high', 'slip', CATALOG.get('VRB.CAN_TO').origen_tipico, ['gram.modals.no_to']]);
  assert.deepEqual(out.results[0].discarded.map((d) => d.field).sort(), ['extra', 'kind', 'origin', 'topics', 'topics']);
});

test('cleanVerdict: casos sueltos (null, no objeto, lista, getter hostil, topics demasiados)', () => {
  assert.deepEqual(cleanVerdict(null, CATALOG), { clean: {}, discarded: [] });
  assert.deepEqual(cleanVerdict(undefined, CATALOG), { clean: {}, discarded: [] });
  for (const bad of ['VRB.CAN_TO', 5, true, [], [{ code: 'VRB.CAN_TO' }]]) {
    const r = cleanVerdict(bad, CATALOG);
    assert.deepEqual(r.clean, {});
    assert.equal(r.discarded[0].field, 'verdict');
  }
  const hostile = { get code() { throw new Error('boom'); } };
  const h = cleanVerdict(hostile, CATALOG);
  assert.deepEqual(h.clean, {});
  assert.match(h.discarded[0].reason, /boom/);
  const many = cleanVerdict({ topics: Array.from({ length: 12 }, (_, i) => `gram.t.n${i}`) }, CATALOG);
  assert.equal(many.clean.topics.length, 10);
  assert.equal(many.discarded.length, 2);
  assert.deepEqual(cleanVerdict({ topics: ['gram.a.b', 'gram.a.b', 'gram.c.d'] }, CATALOG), { clean: { topics: ['gram.a.b', 'gram.c.d'] }, discarded: [] }); // sin repetidos
  assert.deepEqual(cleanVerdict({ topics: [] }, CATALOG), { clean: {}, discarded: [] }); // lista vacía: nada que aplicar, no es un error
  assert.equal(cleanVerdict({ topics: 'gram.a.b' }, CATALOG).discarded[0].reason, 'debe ser una lista');
  assert.equal(cleanVerdict({ code: null, kind: null }, CATALOG).discarded.length, 0); // null = «sin dato»
  // el valor descartado se recorta y nunca es un objeto
  const long = cleanVerdict({ code: 'x'.repeat(500), impact: { a: 1 } }, CATALOG);
  assert.equal(long.discarded[0].value.length, 60);
  assert.equal(long.discarded[1].value, 'object');
});

test('reconcile: el campo explícito gana; null, undefined, "" (código) y [] (topics) cuentan como hueco', () => {
  const clean = { code: 'NEG.DOUBLE', kind: 'systematic', origin: 'developmental', impact: 'low', topics: ['gram.a.b'] };
  assert.deepEqual(reconcile({ original: 'x', code: 'VRB.CAN_TO', kind: 'slip', origin: 'transfer_es', impact: 'high', topics: ['gram.c.d'] }, clean),
    { original: 'x', code: 'VRB.CAN_TO', kind: 'slip', origin: 'transfer_es', impact: 'high', topics: ['gram.c.d'] });
  assert.deepEqual(reconcile({ original: 'x', code: '', kind: null, topics: [] }, clean), { original: 'x', code: 'NEG.DOUBLE', kind: 'systematic', origin: 'developmental', impact: 'low', topics: ['gram.a.b'] });
  assert.deepEqual(reconcile({ original: 'x' }, {}), { original: 'x' });
  const entry = { original: 'x' };
  reconcile(entry, clean);
  assert.deepEqual(entry, { original: 'x' }); // no modifica la entrada
});

// ---------- clasificador roto ----------
for (const [name, make] of [
  ['lanza', () => ({ classify: async () => { throw new Error('429 sin cupo'); } })],
  ['lanza síncrono', () => ({ classify: () => { throw new Error('se cayó'); } })],
  ['devuelve algo que no es lista', () => ({ classify: async () => ({ code: 'VRB.CAN_TO' }) })],
  ['devuelve una lista de otro tamaño', () => ({ classify: async () => [{ code: 'VRB.CAN_TO' }, { code: 'VRB.CAN_TO' }, { code: 'VRB.CAN_TO' }] })],
  ['devuelve undefined', () => ({ classify: async () => undefined })],
]) {
  test(`clasificador que ${name}: se anotan las entradas con código, las demás quedan «unclassified» y se informa del fallo`, async () => {
    const { db, hook } = await setup({ classifier: make() });
    const out = await hook.classifyAndRecord([{ original: 'sin código', ts: TS }, { original: 'con código', code: 'NEG.DOUBLE', ts: TS }]);
    assert.deepEqual(out.results.map((r) => r.status), ['unclassified', 'recorded']);
    assert.equal(out.classifier.used, true);
    assert.equal(out.classifier.ok, false);
    assert.equal(typeof out.classifier.error, 'string');
    assert.ok(out.classifier.error.length > 0 && out.classifier.error.length <= 200);
    assert.equal((await rows(db)).length, 1);
  });
}

test('si falla solo un lote, los demás se aprovechan', async () => {
  const c = fake((es, n) => { if (n === 2) throw new Error('timeout'); return es.map(() => ({ code: 'NEG.DOUBLE' })); });
  const { hook } = await setup({ classifier: c });
  const out = await hook.classifyAndRecord(Array.from({ length: 45 }, (_, i) => ({ original: `f${i}`, ts: TS })));
  assert.deepEqual(c.calls.map((x) => x.length), [20, 20, 5]);
  assert.equal(out.classifier.ok, false);
  assert.match(out.classifier.error, /timeout/);
  assert.equal(out.recorded, 25); // lotes 1 y 3
  assert.deepEqual(out.results.map((r) => r.status === 'recorded'), Array.from({ length: 45 }, (_, i) => i < 20 || i >= 40));
});

test('si fallan varios lotes, se informa del PRIMER fallo y el mensaje se recorta a 200 caracteres', async () => {
  const c = fake((es, n) => { throw new Error(n === 1 ? `primero ${'x'.repeat(1000)}` : 'segundo'); });
  const { hook } = await setup({ classifier: c });
  const out = await hook.classifyAndRecord(Array.from({ length: 25 }, (_, i) => ({ original: `f${i}`, ts: TS })));
  assert.equal(c.calls.length, 2);
  assert.ok(out.classifier.error.startsWith('primero '));
  assert.equal(out.classifier.error.length, 200);
  assert.equal(out.classifier.sent, 25);
  assert.equal(out.recorded, 0);
});

test('una respuesta que parece lista pero no lo es (objeto con length) se descarta entera', async () => {
  const c = { classify: async () => ({ length: 1, 0: { code: 'NEG.DOUBLE' } }) };
  const { hook } = await setup({ classifier: c });
  const out = await hook.classifyAndRecord([{ original: 'a', ts: TS }]);
  assert.equal(out.classifier.ok, false);
  assert.equal(out.results[0].status, 'unclassified');
});

test('a un clasificador no le llegan las entradas que no son objetos, y un getter hostil en `original` no tumba el lote', async () => {
  const c = fake((es) => es.map(() => ({ code: 'NEG.DOUBLE' })));
  const { hook } = await setup({ classifier: c });
  const hostile = { get original() { throw new Error('boom'); } };
  const out = await hook.classifyAndRecord([null, 'texto', 7, hostile, { original: 'buena', ts: TS }]);
  assert.equal(c.calls.length, 1);
  assert.deepEqual(c.calls[0], [
    { original: null, correction: null, context: null, itemId: null }, // el hostil: se lee como vacío
    { original: 'buena', correction: null, context: null, itemId: null },
  ]);
  assert.equal(out.classifier.ok, true);
  assert.deepEqual(out.results.map((r) => r.status), ['rejected', 'rejected', 'rejected', 'rejected', 'recorded']);
});

test('code null o "" en la entrada cuenta como «sin código»: sin clasificador queda unclassified, no rechazada', async () => {
  const { hook } = await setup();
  const out = await hook.classifyAndRecord([{ original: 'a', code: null, ts: TS }, { original: 'b', code: '', ts: TS }]);
  assert.deepEqual(out.results.map((r) => r.status), ['unclassified', 'unclassified']);
});

test('cleanVerdict: ids de tema que no son texto (lista anidada, número) o de más de 100 caracteres se descartan', () => {
  const long = `gram.${'a'.repeat(120)}.x`;
  const r = cleanVerdict({ topics: [['gram.a.b'], 5, long, 'gram.ok.uno'] }, CATALOG);
  assert.deepEqual(r.clean.topics, ['gram.ok.uno']);
  assert.equal(r.discarded.length, 3);
  assert.equal(r.discarded[0].value, 'lista');
  assert.equal(cleanVerdict({ code: ['VRB.CAN_TO'] }, CATALOG).discarded[0].value, 'lista');
  assert.equal(cleanVerdict(['x'], CATALOG).discarded[0].value, 'lista');
  assert.equal(cleanVerdict({ impact: ['low'] }, CATALOG).discarded[0].field, 'impact');
});

test('un veredicto null para una entrada = sin veredicto (no es un fallo del clasificador)', async () => {
  const c = fake(() => [null, { code: 'NEG.DOUBLE' }]);
  const { hook } = await setup({ classifier: c });
  const out = await hook.classifyAndRecord([{ original: 'a', ts: TS }, { original: 'b', ts: TS }]);
  assert.deepEqual(out.results.map((r) => r.status), ['unclassified', 'recorded']);
  assert.equal(out.classifier.ok, true);
  assert.deepEqual(out.results[0].discarded, []);
});

test('un veredicto hostil (getter que lanza) o que no es objeto no tumba a los demás', async () => {
  const c = fake(() => [{ get code() { throw new Error('boom'); } }, 'texto', { code: 'NEG.DOUBLE' }]);
  const { hook } = await setup({ classifier: c });
  const out = await hook.classifyAndRecord([{ original: 'a', ts: TS }, { original: 'b', ts: TS }, { original: 'c', ts: TS }]);
  assert.deepEqual(out.results.map((r) => r.status), ['unclassified', 'unclassified', 'recorded']);
  assert.equal(out.results[0].discarded[0].field, 'verdict');
  assert.equal(out.results[1].discarded[0].field, 'verdict');
});

// ---------- entradas malas ----------
test('una entrada mala no impide anotar las demás: queda «rejected» con el motivo', async () => {
  const { db, hook } = await setup();
  const out = await hook.classifyAndRecord([
    { original: '', code: 'NEG.DOUBLE', ts: TS }, // original vacío
    null,
    'texto',
    { original: 'x', code: 'NO.EXISTE', ts: TS },
    { original: 'x', code: 7, ts: TS },
    { original: 'x', code: 'NEG.DOUBLE', raro: 1, ts: TS },
    { original: 'buena', code: 'NEG.DOUBLE', ts: TS },
  ]);
  assert.deepEqual(out.results.map((r) => r.status), ['rejected', 'rejected', 'rejected', 'rejected', 'rejected', 'rejected', 'recorded']);
  assert.equal(out.recorded, 1);
  assert.match(out.results[0].error, /original/);
  assert.match(out.results[3].error, /catálogo/);
  assert.equal((await rows(db)).length, 1);
});

test('una entrada con getter hostil se rechaza sin tumbar el lote ni al clasificador', async () => {
  const c = fake((es) => es.map(() => ({ code: 'NEG.DOUBLE' })));
  const { hook } = await setup({ classifier: c });
  const hostile = { get code() { throw new Error('boom'); }, original: 'x' };
  const out = await hook.classifyAndRecord([hostile, { original: 'b', ts: TS }]);
  assert.deepEqual(out.results.map((r) => r.status), ['rejected', 'recorded']);
  assert.equal(out.classifier.ok, true);
});

test('si la base falla al anotar: «failed» con el motivo y el resto se intenta', async () => {
  let fail = false;
  const { hook } = await setup({ onWrite: () => { if (fail) { const e = new Error('lleno'); e.name = 'QuotaExceededError'; throw e; } } });
  const ok = await hook.classifyAndRecord([{ original: 'a', code: 'NEG.DOUBLE', ts: TS }]);
  assert.equal(ok.results[0].status, 'recorded');
  fail = true;
  const out = await hook.classifyAndRecord([{ original: 'b', code: 'NEG.DOUBLE', ts: TS }, { original: 'c', code: 'NEG.DOUBLE', ts: TS }]);
  assert.deepEqual(out.results.map((r) => r.status), ['failed', 'failed']);
  assert.equal(typeof out.results[0].error, 'string');
  fail = false;
  assert.equal((await hook.classifyAndRecord([{ original: 'b', code: 'NEG.DOUBLE', ts: TS }])).results[0].status, 'recorded'); // y se recupera
});

// ---------- argumentos absurdos y idempotencia ----------
test('argumentos absurdos lanzan ErrorRecordError: lista vacía o enorme, no lista, opciones mal formadas', async () => {
  const { hook } = await setup();
  for (const bad of [undefined, null, 'x', {}, [], Array.from({ length: MAX_ENTRIES + 1 }, () => ({ original: 'x', code: 'NEG.DOUBLE' }))]) {
    await assert.rejects(() => hook.classifyAndRecord(bad), (e) => e instanceof ErrorRecordError && e.code === 'BAD_ERROR_RECORD');
  }
  for (const bad of ['x', 5, [], { classify: 'todo' }, { classify: 5 }, { raro: 1 }]) {
    await assert.rejects(() => hook.classifyAndRecord([{ original: 'x', code: 'NEG.DOUBLE' }], bad), ErrorRecordError, JSON.stringify(bad));
  }
  assert.equal((await hook.classifyAndRecord([{ original: 'x', code: 'NEG.DOUBLE', ts: TS }], null)).recorded, 1);
  assert.equal((await hook.classifyAndRecord(Array.from({ length: MAX_ENTRIES }, (_, i) => ({ original: `f${i}`, code: 'NEG.DOUBLE', ts: TS }))).then((o) => o.recorded)), MAX_ENTRIES);
});

test('idempotencia: reenviar el mismo lote (mismos ts) no infla ningún contador', async () => {
  const c = fake((es) => es.map(() => ({ code: 'VRB.CAN_TO' })));
  const { db, hook } = await setup({ classifier: c });
  const batch = () => [{ original: 'frase uno', ts: TS }, { original: 'frase dos', code: 'NEG.DOUBLE', ts: TS }];
  const first = await hook.classifyAndRecord(batch());
  const again = await hook.classifyAndRecord(batch());
  assert.deepEqual(first.results.map((r) => r.result.created), [true, true]);
  assert.deepEqual(again.results.map((r) => [r.result.replay, r.result.counted]), [[true, false], [true, false]]);
  assert.deepEqual((await rows(db)).map((r) => r.count), [1, 1]);
});

test('una entrada con el mismo error en otro ts cuenta como repetición y se acumula en el mismo registro', async () => {
  const { db, hook } = await setup();
  await hook.classifyAndRecord([{ original: 'frase', code: 'NEG.DOUBLE', ts: '2026-10-14T10:00:00.000Z' }]);
  const r = await hook.classifyAndRecord([{ original: 'frase', code: 'NEG.DOUBLE', ts: '2026-10-15T10:00:00.000Z' }]);
  assert.equal(r.results[0].result.record.count, 2);
  assert.equal((await rows(db)).length, 1);
});
