// @purpose: Pruebas del registro de ejercicios (ui/exercises/index.js, 2.1-T4): selección por tipo, ítem resuelto, tipo no soportado, envoltorio de submit y limpieza.
// 2.1-T4. Sin DOM: el espacio del ejercicio es un objeto con replaceChildren y los componentes son dobles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExerciseRegistry, RESULTS, BAD_ANSWER } from '../ui/exercises/index.js';

const ITEM = { id: 'it1', type: 'fix_error', topics: ['gram.be.present_forms'] };
const ENTRY = { cardId: 'it1#0', itemId: 'it1', facet: 0, topic: 'gram.be.present_forms', exerciseType: null, kind: 'new', why: 'new', topics: ['gram.be.present_forms'] };
const slot = () => ({ cleared: 0, replaceChildren() { this.cleared += 1; } });
const logs = () => { const l = []; const fn = (...a) => l.push(a); fn.list = l; return fn; };
const hostCtx = () => { const sent = []; return { index: 2, total: 5, sent, submit: async (a) => { sent.push(a); return { status: 'saved', result: a.result }; } }; };
function comp({ failMount = false, handle = 'ok' } = {}) {
  const seen = { mounts: [], destroyed: 0, ctxs: [] };
  return {
    seen,
    async mount(container, item, ctx) {
      if (failMount) throw new Error('roto');
      seen.mounts.push({ container, item }); seen.ctxs.push(ctx);
      if (handle === 'none') return undefined;
      if (handle === 'nodestroy') return { getResponse: () => 1 };
      return { destroy() { seen.destroyed += 1; }, getResponse: () => ({ text: 'hola' }) };
    },
  };
}
const make = (over = {}) => {
  const c = comp();
  const log = logs();
  const reg = createExerciseRegistry({ resolveItem: async (id) => (id === 'it1' ? ITEM : null), components: { fix_error: c }, log, ...over });
  return { reg, c, log };
};

test('monta el componente del tipo del ítem con (contenedor, ítem, ctx) y devuelve destroy y getResponse', async () => {
  const { reg, c } = make();
  const s = slot(); const h = hostCtx();
  const made = await reg.mount(s, ENTRY, h);
  assert.ok(made && typeof made.destroy === 'function' && typeof made.getResponse === 'function');
  assert.equal(c.seen.mounts.length, 1);
  assert.equal(c.seen.mounts[0].container, s);
  assert.deepEqual(c.seen.mounts[0].item, ITEM);
  const ctx = c.seen.ctxs[0];
  assert.deepEqual([ctx.index, ctx.total, ctx.type, ctx.entry, ctx.item], [2, 5, 'fix_error', ENTRY, ITEM]);
  assert.deepEqual(made.getResponse(), { text: 'hola' });
});

test('el tipo del plan manda; si el plan no trae tipo se usa el del ítem', async () => {
  const a = comp(); const b = comp();
  const reg = createExerciseRegistry({ resolveItem: async () => ({ id: 'it1', type: 'fix_error' }), components: { fix_error: a, choose_correct: b }, log: logs() });
  await reg.mount(slot(), { ...ENTRY, exerciseType: null }, hostCtx());
  assert.equal(a.seen.mounts.length, 1);
  const lg = logs();
  const reg2 = createExerciseRegistry({ resolveItem: async () => ({ id: 'it1', type: 'fix_error' }), components: { fix_error: a, choose_correct: b }, log: lg });
  assert.equal(await reg2.mount(slot(), { ...ENTRY, exerciseType: 'choose_correct' }, hostCtx()), null, 'plan e ítem no coinciden: no se adivina');
  assert.equal(b.seen.mounts.length, 0);
  assert.equal(lg.list.length, 1);
});

test('tipo sin componente: devuelve null sin ruido y sin tocar el espacio (la vista pinta «no soportado todavía»)', async () => {
  const { reg, log } = make({ resolveItem: async () => ({ id: 'it1', type: 'listen_future' }) });
  const s = slot();
  assert.equal(await reg.mount(s, ENTRY, hostCtx()), null);
  assert.equal(log.list.length, 0, 'un tipo futuro es lo esperado, no un error');
  assert.equal(s.cleared, 0);
});

test('ítem que no se encuentra o que no se puede leer: null y aviso; si el resolvedor lanza, no rechaza', async () => {
  const { reg, log } = make();
  assert.equal(await reg.mount(slot(), { ...ENTRY, itemId: 'otro', exerciseType: 'fix_error' }, hostCtx()), null);
  assert.equal(log.list.length, 1, 'tipo soportado pero sin ítem: aviso');
  assert.equal(await reg.mount(slot(), { ...ENTRY, itemId: 'otro' }, hostCtx()), null, 'sin ítem y sin tipo en el plan: no se sabe qué es, sin ruido');
  assert.equal(log.list.length, 1);
  const lg = logs();
  const boom = createExerciseRegistry({ resolveItem: async () => { throw new Error('base caída'); }, components: { fix_error: comp() }, log: lg });
  assert.equal(await boom.mount(slot(), { ...ENTRY, exerciseType: 'fix_error' }, hostCtx()), null);
  assert.equal(lg.list.some((a) => /leer el ítem/.test(a[0])), true, 'avisa por qué no hay ejercicio');
  const nothing = createExerciseRegistry({ components: { fix_error: comp() }, log: logs() });
  assert.equal(await nothing.mount(slot(), ENTRY, hostCtx()), null, 'sin resolvedor no hay ítems');
});

test('entradas basura: null, sin romper', async () => {
  const { reg } = make();
  for (const bad of [[null, ENTRY, hostCtx()], [{}, ENTRY, hostCtx()], [slot(), null, hostCtx()], [slot(), [], hostCtx()], [slot(), ENTRY, null], [slot(), ENTRY, {}], [slot(), { itemId: 5 }, hostCtx()]]) {
    assert.equal(await reg.mount(...bad), null);
  }
});

test('submit: completa exerciseType, respeta el que trae y reenvía el resultado de la vista tal cual', async () => {
  const { reg, c } = make();
  const h = hostCtx();
  await reg.mount(slot(), ENTRY, h);
  const r1 = await c.seen.ctxs[0].submit({ result: 'correct', responseRaw: 'is' });
  assert.deepEqual(r1, { status: 'saved', result: 'correct' });
  await c.seen.ctxs[0].submit({ result: 'wrong', exerciseType: 'otro' });
  assert.deepEqual(h.sent.map((a) => a.exerciseType), ['fix_error', 'otro']);
  assert.equal(h.sent[0].responseRaw, 'is');
});

test('submit con respuesta mal formada devuelve error amable y NO llega a la vista', async () => {
  const { reg, c, log } = make();
  const h = hostCtx();
  await reg.mount(slot(), ENTRY, h);
  for (const bad of [null, undefined, 'correct', [], {}, { result: 'bien' }, { result: 7 }]) {
    assert.deepEqual(await c.seen.ctxs[0].submit(bad), { status: 'error', message: BAD_ANSWER });
  }
  assert.equal(h.sent.length, 0);
  assert.equal(log.list.length, 7);
});

test('submit: si la vista lanza, devuelve error sin propagar; los 5 resultados válidos pasan', async () => {
  const { reg, c } = make();
  await reg.mount(slot(), ENTRY, { index: 0, total: 1, submit: async () => { throw new Error('commit'); } });
  assert.deepEqual(await c.seen.ctxs[0].submit({ result: 'correct' }), { status: 'error', message: BAD_ANSWER });
  assert.deepEqual([...RESULTS], ['correct', 'almost', 'wrong', 'skipped', 'dont_know']);
  const h = hostCtx();
  const m = make();
  await m.reg.mount(slot(), ENTRY, h);
  for (const r of RESULTS) await m.c.seen.ctxs[0].submit({ result: r });
  assert.equal(h.sent.length, 5);
});

test('destroy es idempotente, llama una sola vez al del componente y deja el submit como «viejo»', async () => {
  const { reg, c } = make();
  const h = hostCtx();
  const made = await reg.mount(slot(), ENTRY, h);
  made.destroy(); made.destroy(); made.destroy();
  assert.equal(c.seen.destroyed, 1);
  assert.deepEqual(await c.seen.ctxs[0].submit({ result: 'correct' }), { status: 'ignored', reason: 'stale' });
  assert.equal(h.sent.length, 0);
  assert.equal(made.getResponse(), null);
});

test('un destroy del componente que lanza no se propaga', async () => {
  const lg = logs();
  const bad = { async mount() { return { destroy() { throw new Error('x'); } }; } };
  const reg = createExerciseRegistry({ resolveItem: async () => ITEM, components: { fix_error: bad }, log: lg });
  const made = await reg.mount(slot(), ENTRY, hostCtx());
  assert.doesNotThrow(() => made.destroy());
  assert.equal(lg.list.length, 1);
});

test('componente que lanza al montar o no devuelve un manejador válido: null, espacio limpio y submit inerte', async () => {
  for (const opts of [{ failMount: true }, { handle: 'none' }, { handle: 'nodestroy' }]) {
    const c = comp(opts);
    const lg = logs();
    const reg = createExerciseRegistry({ resolveItem: async () => ITEM, components: { fix_error: c }, log: lg });
    const s = slot(); const h = hostCtx();
    assert.equal(await reg.mount(s, ENTRY, h), null, JSON.stringify(opts));
    assert.equal(s.cleared, 1);
    assert.equal(lg.list.length, 1);
    if (c.seen.ctxs[0]) assert.deepEqual(await c.seen.ctxs[0].submit({ result: 'correct' }), { status: 'ignored', reason: 'stale' });
    assert.equal(h.sent.length, 0);
  }
});

test('getResponse: si el componente lanza o no lo tiene devuelve null', async () => {
  const lg = logs();
  const thrower = { async mount() { return { destroy() {}, getResponse() { throw new Error('x'); } }; } };
  const none = { async mount() { return { destroy() {} }; } };
  const a = createExerciseRegistry({ resolveItem: async () => ITEM, components: { fix_error: thrower }, log: lg });
  const b = createExerciseRegistry({ resolveItem: async () => ITEM, components: { fix_error: none }, log: lg });
  assert.equal((await a.mount(slot(), ENTRY, hostCtx())).getResponse(), null);
  assert.equal((await b.mount(slot(), ENTRY, hostCtx())).getResponse(), null);
});

test('register: valida tipo y componente, rechaza duplicados; has y types listan ordenado', () => {
  const reg = createExerciseRegistry({ log: logs() });
  assert.deepEqual(reg.types(), []);
  reg.register('b_tipo', comp()); reg.register('a_tipo', comp());
  assert.deepEqual(reg.types(), ['a_tipo', 'b_tipo']);
  assert.equal(reg.has('a_tipo'), true);
  assert.equal(reg.has('z'), false);
  assert.throws(() => reg.register('a_tipo', comp()), /ya está registrado/);
  for (const t of ['', '  ', null, 5, undefined]) assert.throws(() => reg.register(t, comp()), /tipo de ejercicio/);
  for (const c of [null, {}, { mount: 1 }, [], 'x']) assert.throws(() => reg.register('c_tipo', c), /función mount/);
  assert.equal(reg.has('c_tipo'), false);
});

test('createExerciseRegistry: opciones inválidas lanzan en español; el objeto está congelado', () => {
  assert.throws(() => createExerciseRegistry({ resolveItem: 5 }), /resolveItem/);
  assert.throws(() => createExerciseRegistry({ log: 'x' }), /log/);
  assert.throws(() => createExerciseRegistry({ components: [] }), /components/);
  assert.throws(() => createExerciseRegistry({ components: { a: {} } }), /función mount/);
  const reg = createExerciseRegistry();
  assert.equal(Object.isFrozen(reg), true);
});

test('el resolvedor solo se llama con un id de texto y solo se acepta un objeto como ítem', async () => {
  const asked = [];
  const reg = createExerciseRegistry({ resolveItem: async (id) => { asked.push(id); return 'no soy un ítem'; }, components: { fix_error: comp() }, log: logs() });
  assert.equal(await reg.mount(slot(), { ...ENTRY, itemId: 5, exerciseType: 'fix_error' }, hostCtx()), null);
  assert.equal(await reg.mount(slot(), { ...ENTRY, itemId: '  ', exerciseType: 'fix_error' }, hostCtx()), null);
  assert.deepEqual(asked, [], 'un id que no es texto no llega al resolvedor');
  assert.equal(await reg.mount(slot(), { ...ENTRY, exerciseType: 'fix_error' }, hostCtx()), null);
  assert.deepEqual(asked, ['it1']);
  const arr = createExerciseRegistry({ resolveItem: async () => [1, 2], components: { fix_error: comp() }, log: logs() });
  assert.equal(await arr.mount(slot(), { ...ENTRY, exerciseType: 'fix_error' }, hostCtx()), null, 'una lista no es un ítem');
});

test('si el componente lanza DESPUÉS de recibir su ctx, ese submit queda inerte', async () => {
  const seen = [];
  const late = { async mount(container, item, ctx) { seen.push(ctx); throw new Error('a medias'); } };
  const reg = createExerciseRegistry({ resolveItem: async () => ITEM, components: { fix_error: late }, log: logs() });
  const h = hostCtx();
  assert.equal(await reg.mount(slot(), ENTRY, h), null);
  assert.deepEqual(await seen[0].submit({ result: 'correct' }), { status: 'ignored', reason: 'stale' });
  assert.equal(h.sent.length, 0);
});

test('el manejador está congelado y getResponse avisa por el registro si el componente lanza', async () => {
  const lg = logs();
  const thrower = { async mount() { return { destroy() {}, getResponse() { throw new Error('x'); } }; } };
  const reg = createExerciseRegistry({ resolveItem: async () => ITEM, components: { fix_error: thrower }, log: lg });
  const made = await reg.mount(slot(), ENTRY, hostCtx());
  assert.equal(Object.isFrozen(made), true);
  made.getResponse();
  assert.equal(lg.list.length, 1);
});

test('el mensaje de error de una respuesta que no se pudo guardar es amable y no culpa', () => {
  assert.match(BAD_ANSWER, /^No se pudo guardar tu respuesta\. Inténtalo de nuevo\.$/);
});
