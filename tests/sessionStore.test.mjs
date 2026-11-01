// @purpose: Pruebas de la restauración de sesión (core/sessionStore.js, 2.1-T2): guardar, cargar, normalizar fases, caducidad, datos dañados y fallos de la base.
// 2.1-T2. Base en memoria, máquina de estados real y reloj falso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionStore, SESSION_KEY, DEFAULT_MAX_AGE_MS } from '../core/sessionStore.js';
import { createMemoryDb } from '../core/db.memory.js';
import { createState, transition } from '../core/sessionRunner.js';
import { makeClock } from './_helpers.mjs';

const items = (n) => Array.from({ length: n }, (_, i) => ({ cardId: `t.i${i}#0`, itemId: `t.i${i}`, facet: 'f', topic: 't', exerciseType: 'fix_error', kind: 'review', why: 'overdue', topics: ['t'] }));
const run = (...actions) => actions.reduce((s, a) => transition(s, a).state, createState());
const S = {
  presenting: () => run({ type: 'START', total: 3 }),
  answering: () => run({ type: 'START', total: 3 }, 'SHOWN'),
  feedback: () => run({ type: 'START', total: 3 }, 'SHOWN', { type: 'SUBMIT', result: 'correct' }),
  next: () => run({ type: 'START', total: 3 }, 'SHOWN', { type: 'SUBMIT', result: 'wrong' }, 'CONTINUE'),
  summary: () => run({ type: 'START', total: 3 }, 'QUIT'),
};
async function world(extra = {}) {
  const clock = makeClock('2026-10-26T15:00:00.000Z');
  const db = createMemoryDb(); await db.open();
  const store = createSessionStore({ db, clock, ...extra });
  return { db, clock, store };
}

test('guarda y recupera una sesión a mitad con los ítems y el identificador', async () => {
  const w = await world();
  const r = await w.store.save({ sessionId: 's1', state: S.presenting(), items: items(3) });
  assert.deepEqual(r, { saved: true, cleared: false });
  const out = await w.store.load();
  assert.equal(out.status, 'restored'); assert.equal(out.sessionId, 's1');
  assert.deepEqual(out.state, S.presenting()); assert.deepEqual(out.items, items(3)); assert.equal(out.ageMs, 0);
  assert.equal((await w.db.get('meta', SESSION_KEY)).v, 1);
});

test('sin nada guardado devuelve none y no escribe', async () => {
  const w = await world();
  assert.deepEqual(await w.store.load(), { status: 'none' });
  assert.equal(await w.db.get('meta', SESSION_KEY), null);
});

test('answering vuelve a presenting y feedback pasa a next; presenting y next se quedan', async () => {
  for (const [from, to] of [['answering', 'presenting'], ['feedback', 'next'], ['presenting', 'presenting'], ['next', 'next']]) {
    const w = await world();
    await w.store.save({ sessionId: 's', state: S[from](), items: items(3) });
    const out = await w.store.load();
    assert.equal(out.state.phase, to, from);
    assert.equal(out.state.index, S[from]().index);
    assert.deepEqual(out.state.answers, S[from]().answers);
  }
});

test('el estado restaurado es válido para la máquina: se puede seguir con ella', async () => {
  const w = await world();
  await w.store.save({ sessionId: 's', state: S.feedback(), items: items(3) });
  const { state } = await w.store.load();
  const t = transition(state, 'ADVANCE');
  assert.equal(t.changed, true); assert.equal(t.state.phase, 'presenting'); assert.equal(t.state.index, 1);
  const a = await world();
  await a.store.save({ sessionId: 's', state: S.answering(), items: items(3) });
  const r = transition((await a.store.load()).state, 'SHOWN');
  assert.equal(r.state.phase, 'answering');
});

test('el estado restaurado está congelado en profundidad y no comparte objetos con la base', async () => {
  const w = await world();
  await w.store.save({ sessionId: 's', state: S.next(), items: items(3) });
  const { state } = await w.store.load();
  assert.ok(Object.isFrozen(state)); assert.ok(Object.isFrozen(state.answers)); assert.ok(Object.isFrozen(state.answers[0]));
});

test('save con idle o summary borra lo guardado (la sesión terminó)', async () => {
  const w = await world();
  await w.store.save({ sessionId: 's', state: S.presenting(), items: items(3) });
  assert.deepEqual(await w.store.save({ sessionId: 's', state: S.summary(), items: items(3) }), { saved: false, cleared: true });
  assert.equal((await w.store.load()).status, 'none');
  assert.deepEqual(await w.store.save({ sessionId: 's', state: createState(), items: [] }), { saved: false, cleared: false });
});

test('la última sesión guardada gana', async () => {
  const w = await world();
  await w.store.save({ sessionId: 'a', state: S.presenting(), items: items(3) });
  await w.store.save({ sessionId: 'b', state: S.next(), items: items(3) });
  const out = await w.store.load();
  assert.equal(out.sessionId, 'b'); assert.equal(out.state.phase, 'next');
});

test('caduca pasadas 12 horas, justo en el borde sigue viva, y la caducada se borra', async () => {
  const w = await world();
  await w.store.save({ sessionId: 's', state: S.presenting(), items: items(3) });
  w.clock.advance(DEFAULT_MAX_AGE_MS);
  const edge = await w.store.load();
  assert.equal(edge.status, 'restored'); assert.equal(edge.ageMs, DEFAULT_MAX_AGE_MS);
  w.clock.advance(1);
  assert.deepEqual(await w.store.load(), { status: 'expired' });
  assert.equal(await w.db.get('meta', SESSION_KEY), null);
  assert.deepEqual(await w.store.load(), { status: 'none' });
});

test('maxAgeMs propio se respeta y se valida', async () => {
  const w = await world({ maxAgeMs: 1000 });
  await w.store.save({ sessionId: 's', state: S.presenting(), items: items(3) });
  w.clock.advance(1001);
  assert.equal((await w.store.load()).status, 'expired');
  for (const bad of [0, -5, NaN, Infinity, '10']) assert.throws(() => createSessionStore({ db: w.db, maxAgeMs: bad }), /maxAgeMs/);
});

test('un reloj que va hacia atrás no da edad negativa', async () => {
  const w = await world();
  await w.store.save({ sessionId: 's', state: S.presenting(), items: items(3) });
  w.clock.advance(-60000);
  assert.equal((await w.store.load()).ageMs, 0);
});

test('registros dañados se descartan como invalid y se borran', async () => {
  const good = async (w) => { await w.store.save({ sessionId: 's', state: S.next(), items: items(3) }); return w.db.get('meta', SESSION_KEY); };
  const cases = {
    'versión': (r) => ({ ...r, v: 2 }),
    'sin sessionId': (r) => ({ ...r, sessionId: '' }),
    'fecha ilegible': (r) => ({ ...r, savedAt: 'ayer' }),
    'fecha que no es texto': (r) => ({ ...r, savedAt: 12345 }),
    'estado incoherente': (r) => ({ ...r, state: { ...r.state, index: 9 } }),
    'estado que es texto': (r) => ({ ...r, state: 'x' }),
    'fase idle': (r) => ({ ...r, state: createState() }),
    'fase summary': (r) => ({ ...r, state: S.summary() }),
    'faltan ítems': (r) => ({ ...r, items: r.items.slice(1) }),
    'ítems no es lista': (r) => ({ ...r, items: null }),
    'ítem sin cardId': (r) => ({ ...r, items: r.items.map((it, i) => (i ? it : { ...it, cardId: '' })) }),
    'ítem que no es objeto': (r) => ({ ...r, items: r.items.map((it, i) => (i ? it : 7)) }),
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const w = await world();
    await w.db.put('meta', mutate(await good(w)));
    assert.deepEqual(await w.store.load(), { status: 'invalid' }, name);
    assert.equal(await w.db.get('meta', SESSION_KEY), null, name);
  }
});

test('un registro que no es un objeto se descarta', async () => {
  const w = await world();
  await w.db.put('meta', { key: SESSION_KEY });
  assert.deepEqual(await w.store.load(), { status: 'invalid' });
});

test('save rechaza entradas malas sin escribir nada', async () => {
  const w = await world();
  const ok = { sessionId: 's', state: S.presenting(), items: items(3) };
  const bad = [
    { ...ok, sessionId: '' }, { ...ok, sessionId: 5 }, { ...ok, sessionId: 'x'.repeat(201) },
    { ...ok, state: { ...S.presenting(), index: 9 } }, { ...ok, state: null },
    { ...ok, items: items(2) }, { ...ok, items: items(4) }, { ...ok, items: null },
    { ...ok, items: [...items(2), { itemId: 'x' }] }, { ...ok, items: [...items(2), { cardId: 'x' }] },
    { ...ok, items: [...items(2), { cardId: 'a', itemId: 'b', why: 7 }] },
    { ...ok, items: [...items(2), { cardId: 'a', itemId: 'b', topics: 'x' }] },
    { ...ok, items: [...items(2), { cardId: 'a', itemId: 'b', topics: Array(11).fill('t') }] },
    { ...ok, items: [...items(2), { cardId: 'a', itemId: 'b', topics: [3] }] },
    { ...ok, items: [...items(2), { cardId: 'a', itemId: 'b'.repeat(201) }] },
  ];
  for (const b of bad) await assert.rejects(() => w.store.save(b), Error);
  assert.equal(await w.db.get('meta', SESSION_KEY), null);
});

test('save descarta campos extra de los ítems y completa los que faltan con null y lista vacía', async () => {
  const w = await world();
  await w.store.save({ sessionId: 's', state: run({ type: 'START', total: 1 }), items: [{ cardId: 'c#0', itemId: 'c', secreto: 'x', prompt: 'texto largo' }] });
  const out = await w.store.load();
  assert.deepEqual(out.items, [{ cardId: 'c#0', itemId: 'c', facet: null, topic: null, exerciseType: null, kind: null, why: null, topics: [] }]);
});

test('clear borra y avisa si había algo; sin nada devuelve cleared false', async () => {
  const w = await world();
  assert.deepEqual(await w.store.clear(), { cleared: false });
  await w.store.save({ sessionId: 's', state: S.presenting(), items: items(3) });
  assert.deepEqual(await w.store.clear(), { cleared: true });
  assert.deepEqual(await w.store.clear(), { cleared: false });
});

test('si la base falla, save, load y clear se rechazan sin inventar un resultado', async () => {
  const boom = new Error('cuota llena');
  const w = await world();
  await w.store.save({ sessionId: 's', state: S.presenting(), items: items(3) });
  const broken = (m) => createSessionStore({ db: { ...w.db, get: w.db.get, put: w.db.put, delete: w.db.delete, [m]: async () => { throw boom; } }, clock: w.clock });
  await assert.rejects(() => broken('put').save({ sessionId: 's', state: S.presenting(), items: items(3) }), /cuota llena/);
  await assert.rejects(() => broken('get').load(), /cuota llena/);
  await assert.rejects(() => broken('delete').clear(), /cuota llena/);
  await assert.rejects(() => broken('delete').save({ sessionId: 's', state: S.summary(), items: items(3) }), /cuota llena/);
});

test('crear sin base lanza error', () => {
  assert.throws(() => createSessionStore({}), /base de datos/);
  assert.throws(() => createSessionStore(), /base de datos/);
  assert.throws(() => createSessionStore({ db: { get() {}, put() {} } }), /base de datos/);
});

test('recorrido completo: cerrar a mitad y reabrir continúa donde estaba', async () => {
  const w = await world();
  let s = run({ type: 'START', total: 3 }, 'SHOWN', { type: 'SUBMIT', result: 'correct' }, 'CONTINUE', 'ADVANCE', 'SHOWN');
  await w.store.save({ sessionId: 'dia', state: s, items: items(3) });
  const reopened = createSessionStore({ db: w.db, clock: w.clock });
  const out = await reopened.load();
  assert.equal(out.state.index, 1); assert.equal(out.state.phase, 'presenting'); assert.equal(out.state.answers.length, 1);
  s = transition(out.state, 'SHOWN').state;
  s = transition(s, { type: 'SUBMIT', result: 'wrong' }).state;
  assert.deepEqual(s.answers.map((a) => a.result), ['correct', 'wrong']);
});

test('valores fijos del contrato: clave session_active y vida de 12 horas exactas', async () => {
  assert.equal(SESSION_KEY, 'session_active'); assert.equal(DEFAULT_MAX_AGE_MS, 43200000);
  const w = await world();
  await w.store.save({ sessionId: 's', state: S.presenting(), items: items(3) });
  assert.equal((await w.db.get('meta', 'session_active')).sessionId, 's');
  assert.equal(w.store.KEY, 'session_active');
  w.clock.advance(43200000);
  assert.equal((await w.store.load()).status, 'restored');
  w.clock.advance(1);
  assert.equal((await w.store.load()).status, 'expired');
});

test('un ítem null o que no es objeto se rechaza con mensaje claro', async () => {
  const w = await world();
  for (const bad of [null, 7, 'x', []]) {
    await assert.rejects(() => w.store.save({ sessionId: 's', state: run({ type: 'START', total: 1 }), items: [bad] }), /no es un objeto/);
  }
});

test('topics null o ausente se guarda como lista vacía', async () => {
  const w = await world();
  await w.store.save({ sessionId: 's', state: run({ type: 'START', total: 2 }), items: [{ cardId: 'a#0', itemId: 'a', topics: null }, { cardId: 'b#0', itemId: 'b' }] });
  assert.deepEqual((await w.store.load()).items.map((i) => i.topics), [[], []]);
});

test('del estado solo se guardan los campos conocidos y lo guardado no comparte objetos con quien llamó', async () => {
  const w = await world();
  const dirty = { ...S.next(), secreto: 'x', answers: S.next().answers.map((a) => ({ ...a, extra: 1 })) };
  await w.store.save({ sessionId: 's', state: dirty, items: items(3) });
  const rec = await w.db.get('meta', SESSION_KEY);
  assert.deepEqual(Object.keys(rec.state).sort(), ['answers', 'ended', 'index', 'phase', 'total', 'v']);
  assert.deepEqual(Object.keys(rec.state.answers[0]).sort(), ['index', 'result']);
  const out = await w.store.load();
  assert.deepEqual(out.state, S.next());
  assert.notEqual(rec.state, dirty);
});

test('un registro guardado con campos de más en el estado se limpia al cargar', async () => {
  const w = await world();
  await w.store.save({ sessionId: 's', state: S.next(), items: items(3) });
  const rec = await w.db.get('meta', SESSION_KEY);
  await w.db.put('meta', { ...rec, state: { ...rec.state, intruso: 1, answers: rec.state.answers.map((a) => ({ ...a, intruso: 1 })) } });
  const out = await w.store.load();
  assert.equal(out.status, 'restored');
  assert.deepEqual(out.state, S.next()); assert.equal(Object.hasOwn(out.state, 'intruso'), false); assert.equal(Object.hasOwn(out.state.answers[0], 'intruso'), false);
});

// FIX 2.1-T3: el armador de sesiones (core/session.js) entrega `facet` como entero (0, 1, …), no como texto.
test('save acepta la faceta como entero, que es lo que entrega el armador, y la devuelve igual', async () => {
  const w = await world();
  const entry = { cardId: 'c#0', itemId: 'c', facet: 0, topic: 't', exerciseType: 'fix_error', kind: 'review', why: 'overdue', topics: ['t'] };
  await w.store.save({ sessionId: 's', state: run({ type: 'START', total: 2 }), items: [entry, { ...entry, cardId: 'c#12', facet: 12 }] });
  const out = await w.store.load();
  assert.equal(out.items[0].facet, 0);
  assert.equal(out.items[1].facet, 12);
});

test('save rechaza una faceta entera fuera de rango, negativa o con decimales', async () => {
  const w = await world();
  for (const facet of [-1, 1000, 1.5, Number.NaN, Infinity, true, {}]) {
    await assert.rejects(() => w.store.save({ sessionId: 's', state: run({ type: 'START', total: 1 }), items: [{ cardId: 'c#0', itemId: 'c', facet }] }), Error, String(facet));
  }
});
