// @purpose: Pruebas de «¿por qué lo pensaste?» (2.6-T2, punto 4): core/whyNote.js (evento `note`), ui/whyNote.js, opción `why` del panel, ctx.why del registro, lazyWhyNote, pantallas reales y que las notas no cuenten como respuestas.
// DOM falso, core/events.js real sobre base en memoria y los componentes reales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { h as domH } from '../ui/dom.js';
import { feedbackNodes } from '../ui/feedbackPanel.js';
import { whyNote, whyFor, WN_TEXT } from '../ui/whyNote.js';
import { createWhyNote } from '../core/whyNote.js';
import { lazyWhyNote } from '../app/whyNoteLazy.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';
import { registerChoiceTypes } from '../ui/exercises/choiceTypes.js';
import { createWordType } from '../ui/exercises/textTypes.js';
import { createEvents } from '../core/events.js';
import { createMemoryDb } from '../core/db.memory.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createRng } from '../core/rng.js';
import { accuracyByType } from '../core/stats.js';
import { makeEnv } from './_fakeDom.mjs';
import { makeClock } from './_helpers.mjs';

const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
const ev = (type) => ({ type, preventDefault() {} });
const click = (el) => el.dispatchEvent(ev('click'));
const settle = async (env) => { for (let i = 0; i < 6; i += 1) await env.flush(); };
const ENTRY = { itemId: 'gram.past.x1', cardId: 'gram.past.x1#0', topics: ['gram.past_simple'], exerciseType: 'fill_verb' };

async function world() {
  const db = createMemoryDb(); await db.open();
  const events = createEvents({ db, clock: makeClock('2026-10-31T15:00:00.000Z') });
  return { db, events, why: createWhyNote({ events }) };
}
const notes = async (events) => (await events.since(0)).filter((e) => e.type === 'note');

test('core: guarda un evento note con itemId, tarjeta, temas y texto recortado', async () => {
  const { events, why } = await world();
  const r = await why.save(ENTRY, { id: 'otro', type: 'zzz' }, '  Creí que era presente.  ');
  assert.equal(r.status, 'saved');
  const [n] = await notes(events);
  assert.equal(n.itemId, 'gram.past.x1');
  assert.equal(n.cardId, 'gram.past.x1#0');
  assert.deepEqual(n.topics, ['gram.past_simple']);
  assert.equal(n.exerciseType, 'fill_verb');
  assert.equal(n.responseRaw, 'Creí que era presente.');
  assert.equal(n.type, 'note');
});

test('core: rellena desde el ítem lo que falta en la entrada y omite lo que no tiene forma válida', async () => {
  const { events, why } = await world();
  assert.equal((await why.save({}, { id: 'a.b', topics: ['gram.x', 'MAL TEMA', 5], type: 'choose_tense' }, 'hola')).status, 'saved');
  assert.equal((await why.save({ itemId: 'a.c', cardId: 'otra#0', exerciseType: 'Mal Tipo' }, {}, 'hola')).status, 'saved');
  const [a, b] = await notes(events);
  assert.deepEqual(a.topics, ['gram.x']); assert.equal(a.exerciseType, 'choose_tense');
  assert.equal(b.cardId, null); assert.equal(b.exerciseType, null); assert.deepEqual(b.topics, []);
});

test('core: vacío, solo espacios o solo controles → empty y no escribe; sin itemId válido → error', async () => {
  const { events, why } = await world();
  for (const t of ['', '   ', '\n\t ', '\u0000\u0007', undefined, null, 5, {}]) assert.equal((await why.save(ENTRY, {}, t)).status, 'empty', String(t));
  for (const e of [{}, null, { itemId: 'Con Espacio' }, { itemId: 7 }]) assert.equal((await why.save(e, {}, 'hola')).status, 'error');
  assert.equal((await notes(events)).length, 0);
});

test('core: quita controles, conserva saltos de línea y corta a 2000 caracteres', async () => {
  const { events, why } = await world();
  assert.equal((await why.save(ENTRY, {}, 'uno\u0000\ndos\u0007')).status, 'saved');
  assert.equal((await why.save(ENTRY, {}, 'x'.repeat(5000))).status, 'saved');
  const [a, b] = await notes(events);
  assert.equal(a.responseRaw, 'uno\ndos');
  assert.equal(b.responseRaw.length, 2000);
  assert.equal(why.MAX, 2000);
});

test('core: si la base falla devuelve error sin lanzar; sin events lanza', async () => {
  const bad = createWhyNote({ events: { log: async () => { throw new Error('boom'); } } });
  assert.equal((await bad.save(ENTRY, {}, 'hola')).status, 'error');
  assert.throws(() => createWhyNote({}), /eventos/);
  assert.throws(() => createWhyNote({ events: {} }), /eventos/);
});

test('las notas no cuentan como respuestas: las estadísticas no cambian', async () => {
  const { events, why } = await world();
  await events.log({ type: 'answer', itemId: 'a.b', topics: ['gram.x'], exerciseType: 'fill_verb', result: 'correct', mode: 'mech', channel: 'keyboard', rating: 3 });
  const before = accuracyByType(await events.since(0), {});
  await why.save({ itemId: 'a.b', topics: ['gram.x'], exerciseType: 'fill_verb' }, {}, 'por qué');
  assert.deepEqual(accuracyByType(await events.since(0), {}), before);
});

test('ui: botón cerrado, abrir lo muestra, guardar escribe y avisa; repetir el mismo texto no duplica', async () => {
  const env = makeEnv(); const { h } = domH.with(env.doc);
  const { events, why } = await world();
  const root = whyNote({ h, why, entry: ENTRY, item: {} });
  const toggle = root.querySelector('.fb__why-toggle');
  assert.equal(toggle.textContent, WN_TEXT.toggle);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle.getAttribute('aria-controls'), root.querySelector('.fb__why-body').getAttribute('id'));
  click(toggle);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  const field = root.querySelector('.fb__why-field');
  assert.equal(field.getAttribute('maxlength'), '2000');
  const save = root.querySelector('.fb__why-save');
  click(save); assert.equal(root.querySelector('.fb__why-status').textContent, WN_TEXT.empty);
  field.value = 'Pensé que era presente';
  click(save); await settle(env);
  assert.equal(root.querySelector('.fb__why-status').textContent, WN_TEXT.saved);
  click(save); await settle(env);
  assert.equal(root.querySelector('.fb__why-status').textContent, WN_TEXT.same);
  assert.equal((await notes(events)).length, 1);
  field.value = 'Y además dudé del verbo';
  click(save); await settle(env);
  assert.equal((await notes(events)).length, 2);
});

test('ui: si guardar falla, conserva el texto, avisa sin culpa y se puede reintentar; doble pulsación guarda una vez', async () => {
  const env = makeEnv(); const { h } = domH.with(env.doc);
  let calls = 0; let fail = true;
  const why = { save: async () => { calls += 1; await Promise.resolve(); return fail ? { status: 'error' } : { status: 'saved' }; } };
  const root = whyNote({ h, why, entry: ENTRY, item: {} });
  const field = root.querySelector('.fb__why-field'); const save = root.querySelector('.fb__why-save');
  field.value = 'texto';
  click(save); click(save); await settle(env);
  assert.equal(calls, 1);
  assert.equal(root.querySelector('.fb__why-status').textContent, WN_TEXT.failed);
  assert.equal(field.value, 'texto');
  assert.equal(save.getAttribute('aria-disabled'), 'false');
  fail = false; click(save); await settle(env);
  assert.equal(root.querySelector('.fb__why-status').textContent, WN_TEXT.saved);
  assert.ok(!/culp|error|mal /i.test(Object.values(WN_TEXT).join(' ')), 'textos sin culpa');
});

test('ui: whyFor solo en gramática, con ctx.why e id; datos raros dan null sin lanzar', () => {
  const env = makeEnv(); const { h } = domH.with(env.doc);
  const why = { save: async () => ({ status: 'saved' }) };
  assert.ok(whyFor(h, { why, entry: { itemId: 'a', topics: ['gram.x'] } }, {}));
  assert.ok(whyFor(h, { why }, { id: 'a', topics: ['gram.x'] }), 'temas del ítem');
  for (const [ctx, item] of [[{ why }, { id: 'a', topics: ['vocab.food'] }], [{ why }, { id: 'a' }], [{}, { id: 'a', topics: ['gram.x'] }], [{ why: null }, { id: 'a', topics: ['gram.x'] }],
    [{ why }, { topics: ['gram.x'] }], [null, null], [undefined, undefined], [{ why: {} }, { id: 'a', topics: ['gram.x'] }], [{ why, entry: { itemId: 5 } }, { id: 7, topics: ['gram.x'] }]]) {
    assert.equal(whyFor(h, ctx, item), null);
  }
});

test('panel: `why` solo con «wrong» y «dont», antes de `report`; nunca al acertar ni en «casi»', () => {
  const env = makeEnv(); const { h } = domH.with(env.doc);
  const why = h('div', { class: 'fb__why' }); const report = h('div', { class: 'fb__report' });
  for (const [result, shown] of [['wrong', true], ['dont_know', true], ['correct', false], ['almost', false]]) {
    const nodes = feedbackNodes({ h, result, item: {}, answer: 'x', why, report });
    assert.equal(nodes.includes(why), shown, result);
    assert.equal(nodes[nodes.length - 1], report, result);
    if (shown) assert.equal(nodes[nodes.length - 2], why, result);
  }
  assert.ok(!feedbackNodes({ h, result: 'wrong', item: {}, why: 'texto' }).some((n) => n === 'texto'));
});

test('registro: entrega ctx.why (objeto, función o null) y si la función lanza se monta sin botón', async () => {
  const seen = []; const logs = [];
  const comp = { mount: (_s, _i, ctx) => { seen.push(ctx.why); return { destroy() {}, getResponse: () => null }; } };
  const w = { save() {} };
  const mk = (extra) => { const r = createExerciseRegistry({ resolveItem: () => ({ id: 'i1', type: 'fill_verb' }), log: (...a) => logs.push(a), ...extra }); r.register('fill_verb', comp); return r; };
  const go = (r) => r.mount({ replaceChildren() {} }, { itemId: 'i1', exerciseType: 'fill_verb' }, { index: 0, total: 1, submit: async () => ({}) });
  await go(mk({ why: w })); await go(mk({ why: () => w })); await go(mk({})); await go(mk({ why: () => null }));
  assert.ok(await go(mk({ why: () => { throw new Error('boom'); } })));
  assert.deepEqual(seen, [w, w, null, null, null]);
  assert.equal(logs.length, 1);
});

test('lazyWhyNote: null sin servicios o sin eventos; reutiliza mientras `study` no cambie', async () => {
  const { events } = await world();
  assert.equal(lazyWhyNote(() => null)(), null);
  assert.equal(lazyWhyNote(() => ({ events: null }))(), null);
  assert.equal(lazyWhyNote(() => ({ events: {} }))(), null);
  assert.equal(lazyWhyNote(undefined)(), null);
  let study = { events };
  const get = lazyWhyNote(() => study);
  const a = get(); assert.equal(typeof a.save, 'function'); assert.equal(get(), a);
  study = { events }; assert.notEqual(get(), a);
});

function mountScreen(kind) {
  const env = makeEnv(); const root = env.doc.createElement('div'); env.doc.body.appendChild(root);
  const base = { id: 'gram.past.x1', prompt_es: 'Texto.', prompt_en: 'Text.', topics: ['gram.past_simple'], explain_es: 'E', accept: ['left'] };
  if (kind === 'choice') {
    const table = new Map(); registerChoiceTypes({ register: (t, c) => table.set(t, c) }, { catalog: CATALOG, rng: createRng(7) });
    return { env, root, comp: table.get('mcq_en_es'), item: { ...base, type: 'mcq_en_es', data: { options: ['alfa', 'beta', 'gamma'], correct: 1, shuffle: false } } };
  }
  return { env, root, comp: createWordType('fill_verb', { catalog: CATALOG, rng: createRng(7) }), item: { ...base, type: 'fill_verb' } };
}
const btn = (root, label) => root.querySelectorAll('button').find((b) => b.textContent.trim() === label);

for (const kind of ['choice', 'text']) {
  test(`${kind}: al fallar sale «¿Por qué lo pensaste?» y la nota se guarda; al acertar no sale`, async () => {
    const { events, why } = await world();
    const m = mountScreen(kind);
    const ctx = { doc: m.env.doc, why, entry: { itemId: m.item.id, cardId: `${m.item.id}#0`, topics: m.item.topics }, submit: async () => ({ status: 'saved' }) };
    m.comp.mount(m.root, m.item, ctx);
    assert.equal(m.root.querySelectorAll('.fb__why').length, 0);
    if (kind === 'choice') { click(m.root.querySelectorAll('.ch__option').find((o) => o.querySelector('.ch__text').textContent === 'alfa')); click(btn(m.root, 'Comprobar')); } else {
      const i = m.root.querySelectorAll('input')[0]; i.value = 'zzz'; i.dispatchEvent(ev('input')); click(btn(m.root, 'Comprobar'));
    }
    await settle(m.env);
    const blocks = m.root.querySelectorAll('.fb__why');
    assert.equal(blocks.length, 1);
    click(blocks[0].querySelector('.fb__why-toggle'));
    blocks[0].querySelector('.fb__why-field').value = 'Me confundí con el tiempo';
    click(blocks[0].querySelector('.fb__why-save')); await settle(m.env);
    const [n] = await notes(events);
    assert.equal(n.responseRaw, 'Me confundí con el tiempo');
    assert.equal(n.itemId, m.item.id);
  });
  test(`${kind}: con ítem que no es de gramática o sin ctx.why no hay botón y el feedback sale igual`, async () => {
    const { why } = await world();
    for (const [ctxWhy, topics] of [[why, ['vocab.food']], [null, ['gram.past_simple']]]) {
      const m = mountScreen(kind); m.item.topics = topics;
      m.comp.mount(m.root, m.item, { doc: m.env.doc, why: ctxWhy, entry: { itemId: m.item.id, topics }, submit: async () => ({ status: 'saved' }) });
      click(btn(m.root, 'No sé')); await settle(m.env);
      assert.equal(m.root.querySelectorAll('.fb__why').length, 0);
      assert.equal(m.root.querySelectorAll('.fb__verdict').length, 1);
    }
  });
}

test('guardia: toda pantalla con feedbackNodes también pide whyFor', () => {
  const dir = new URL('../ui/exercises/', import.meta.url);
  const using = fs.readdirSync(dir).filter((f) => f.endsWith('.js') && /feedbackNodes\(\{/.test(fs.readFileSync(new URL(f, dir), 'utf8')));
  assert.ok(using.length >= 8);
  for (const f of using) {
    const src = fs.readFileSync(new URL(f, dir), 'utf8');
    assert.match(src, /feedbackNodes\(\{[^\n]*why: whyFor\(h, ctx, item\)/, `${f}: no pasa why`);
    assert.match(src, /import \{ whyFor \} from '\.\.\/whyNote\.js'/, `${f}: falta el import`);
  }
});
