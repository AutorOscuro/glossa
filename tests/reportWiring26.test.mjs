// @purpose: Cableado del menú «⋯» de reporte (2.6-T2, punto 3): opción `report` del panel, `reportFor`, `ctx.report` del registro, `lazyItemReport` y las pantallas reales (fallar y «No sé»).
// Usa DOM falso, core/itemReport.js real sobre base en memoria y los componentes reales; una guardia de código asegura que ninguna pantalla con feedback olvida el menú.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { h as domH } from '../ui/dom.js';
import { feedbackNodes } from '../ui/feedbackPanel.js';
import { reportFor } from '../ui/reportMenu.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';
import { registerChoiceTypes } from '../ui/exercises/choiceTypes.js';
import { createWordType } from '../ui/exercises/textTypes.js';
import { createPhraseCloze } from '../ui/exercises/phraseCloze.js';
import { createItemReport } from '../core/itemReport.js';
import { lazyItemReport } from '../app/itemReportLazy.js';
import { createMemoryDb } from '../core/db.memory.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createRng } from '../core/rng.js';
import { makeEnv } from './_fakeDom.mjs';
import { makeClock } from './_helpers.mjs';

const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
const ev = (type) => ({ type, preventDefault() {} });
const click = (el) => el.dispatchEvent(ev('click'));
const settle = async (env) => { for (let i = 0; i < 6; i += 1) await env.flush(); };

async function world() {
  const db = createMemoryDb(); await db.open();
  return { db, report: createItemReport({ db, clock: makeClock('2026-10-31T15:00:00.000Z') }) };
}

test('feedbackNodes: `report` va siempre el último, en cualquier estado; lo que no es nodo se ignora', () => {
  const env = makeEnv();
  const { h } = domH.with(env.doc);
  const menu = h('div', { class: 'fb__report' });
  for (const result of ['correct', 'almost', 'wrong', 'dont_know']) {
    const nodes = feedbackNodes({ h, result, item: { explain_es: 'E', nuance_es: 'Corto' }, answer: 'x', after: h('p', {}, 'después'), report: menu });
    assert.equal(nodes[nodes.length - 1], menu, result);
    assert.equal(nodes.filter((n) => n === menu).length, 1, result);
  }
  for (const bad of [undefined, null, 'texto', 5, {}, [], [menu], false]) {
    const nodes = feedbackNodes({ h, result: 'wrong', item: {}, report: bad });
    assert.ok(!nodes.includes(menu), `se ignora ${JSON.stringify(bad)}`);
    assert.equal(nodes.length, 1, 'solo el veredicto');
  }
});

test('reportFor: usa el id de la entrada, o el del ítem; sin report, sin id o con datos raros devuelve null y no lanza', async () => {
  const env = makeEnv();
  const { h } = domH.with(env.doc);
  const { db, report } = await world();
  const a = reportFor(h, { report, entry: { itemId: 'ent.1' } }, { id: 'item.1' });
  assert.ok(a, 'con report y entrada');
  const toggle = a.querySelector('.fb__report-toggle');
  assert.ok(toggle);
  await settle(env);
  click(toggle);
  click(a.querySelectorAll('.fb__report-option')[0]);
  await settle(env);
  assert.ok(await db.get('meta', 'report:ent.1'), 'se guarda con el id de la entrada');
  assert.ok(!(await db.get('meta', 'report:item.1')), 'con entrada, no usa item.id');
  const b = reportFor(h, { report }, { id: 'item.2' });
  click(b.querySelector('.fb__report-toggle')); await settle(env);
  click(b.querySelectorAll('.fb__report-option')[1]); await settle(env);
  assert.ok(await db.get('meta', 'report:item.2'), 'sin entrada, usa item.id');
  for (const [ctx, item] of [[{}, { id: 'x' }], [{ report: null }, { id: 'x' }], [{ report }, {}], [{ report }, null], [null, { id: 'x' }], [undefined, undefined], [{ report }, { id: 'con espacio' }], [{ report: {} }, { id: 'x' }], [{ report, entry: { itemId: 7 } }, { id: 7 }]]) {
    assert.equal(reportFor(h, ctx, item), null);
  }
  await settle(env);
});

test('registro: entrega ctx.report (objeto, función o null) y un fallo de la función no rompe el montaje', async () => {
  const seen = [];
  const comp = { mount: (_slot, _item, ctx) => { seen.push(ctx.report); return { destroy() {}, getResponse: () => null }; } };
  const rep = { stub: true };
  const slot = () => ({ replaceChildren() {} });
  const entry = { itemId: 'i1', exerciseType: 'fill_verb' };
  const mk = (extra, log = () => {}) => { const r = createExerciseRegistry({ resolveItem: () => ({ id: 'i1', type: 'fill_verb' }), log, ...extra }); r.register('fill_verb', comp); return r; };
  await mk({ report: rep }).mount(slot(), entry, { index: 0, total: 1, submit: async () => ({}) });
  await mk({ report: () => rep }).mount(slot(), entry, { index: 0, total: 1, submit: async () => ({}) });
  await mk({}).mount(slot(), entry, { index: 0, total: 1, submit: async () => ({}) });
  await mk({ report: () => null }).mount(slot(), entry, { index: 0, total: 1, submit: async () => ({}) });
  const logs = [];
  const h = await mk({ report: () => { throw new Error('boom'); } }, (...a) => logs.push(a)).mount(slot(), entry, { index: 0, total: 1, submit: async () => ({}) });
  assert.ok(h, 'el ejercicio se monta aunque el reporte falle');
  assert.deepEqual(seen, [rep, rep, null, null, null]);
  assert.equal(logs.length, 1);
});

test('lazyItemReport: null sin servicios o sin base; reutiliza el objeto mientras `study` no cambie', async () => {
  const { db } = await world();
  const clock = makeClock('2026-10-31T15:00:00.000Z');
  assert.equal(lazyItemReport(() => null)(), null);
  assert.equal(lazyItemReport(() => ({ db: null }))(), null);
  assert.equal(lazyItemReport(undefined)(), null);
  let study = { db, clock };
  const get = lazyItemReport(() => study);
  const r1 = get();
  assert.equal(typeof r1.mark, 'function');
  assert.equal(get(), r1);
  study = { db, clock };
  assert.notEqual(get(), r1, 'servicios nuevos, reporte nuevo');
});

// Pantallas reales: tras fallar y tras «No sé» el menú está, es el último hijo del feedback y guarda en `meta`.
function mountScreen(kind, { withReport }) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const base = { id: `x.${kind}`, prompt_es: 'Texto de prueba.', prompt_en: 'Test sentence.', topics: ['gram.past_simple'], explain_es: 'EXPLICA-26', accept: ['left'] };
  let comp; let item;
  if (kind === 'choice') {
    const table = new Map();
    registerChoiceTypes({ register: (t, c) => table.set(t, c) }, { catalog: CATALOG, rng: createRng(7) });
    comp = table.get('mcq_en_es');
    item = { ...base, type: 'mcq_en_es', data: { options: ['alfa', 'beta', 'gamma'], correct: 1, shuffle: false } };
  } else if (kind === 'phrase_cloze') {
    comp = createPhraseCloze();
    item = { ...base, type: 'phrase_cloze', accept: ['No, I couldn\'t send it.'], data: { text: 'No, I ___ send it.', answers: [['couldn\'t']] } };
  } else {
    comp = createWordType('fill_verb', { catalog: CATALOG, rng: createRng(7) });
    item = { ...base, type: 'fill_verb' };
  }
  return { env, root, comp, item, withReport };
}
const btn = (root, label) => root.querySelectorAll('button').find((b) => b.textContent.trim() === label);
const fail = (kind, root, env) => {
  if (kind === 'choice') { click(root.querySelectorAll('.ch__option').find((o) => o.querySelector('.ch__text').textContent === 'alfa')); click(btn(root, 'Comprobar')); } else {
    const input = root.querySelectorAll('input')[0]; input.value = 'zzz'; input.dispatchEvent(ev('input')); click(btn(root, 'Comprobar'));
  }
  return env;
};

for (const kind of ['choice', 'phrase_cloze', 'text']) {
  for (const how of ['fallar', 'No sé']) {
    test(`${kind}: al ${how} el menú «⋯» es el último del feedback y guarda en meta`, async () => {
      const { db, report } = await world();
      const m = mountScreen(kind, { withReport: true });
      m.comp.mount(m.root, m.item, { doc: m.env.doc, report, entry: { itemId: m.item.id }, submit: async () => ({ status: 'saved' }) });
      assert.equal(m.root.querySelectorAll('.fb__report').length, 0, 'antes de responder no hay menú');
      if (how === 'fallar') fail(kind, m.root, m.env); else click(btn(m.root, 'No sé'));
      await settle(m.env);
      const menus = m.root.querySelectorAll('.fb__report');
      assert.equal(menus.length, 1);
      const parent = menus[0].parentNode;
      assert.equal(parent.childNodes[parent.childNodes.length - 1], menus[0], 'va al final del feedback');
      assert.equal(m.root.querySelectorAll('.fb__verdict').length, 1);
      click(menus[0].querySelector('.fb__report-toggle'));
      click(menus[0].querySelectorAll('.fb__report-option')[0]);
      await settle(m.env);
      assert.ok(await db.get('meta', `report:${m.item.id}`), 'quedó guardado en meta');
    });
  }
  test(`${kind}: sin ctx.report el feedback sale igual y sin menú`, async () => {
    const m = mountScreen(kind, { withReport: false });
    m.comp.mount(m.root, m.item, { doc: m.env.doc, entry: { itemId: m.item.id }, submit: async () => ({ status: 'saved' }) });
    click(btn(m.root, 'No sé'));
    await settle(m.env);
    assert.equal(m.root.querySelectorAll('.fb__report').length, 0);
    assert.equal(m.root.querySelectorAll('.fb__verdict').length, 1);
  });
}

test('guardia: toda pantalla de ui/exercises que pinta con feedbackNodes también pide el menú con reportFor', () => {
  const dir = new URL('../ui/exercises/', import.meta.url);
  const using = fs.readdirSync(dir).filter((f) => f.endsWith('.js') && /feedbackNodes\(\{/.test(fs.readFileSync(new URL(f, dir), 'utf8')));
  assert.ok(using.length >= 8, `se esperaban al menos 8 pantallas, hay ${using.length}`);
  for (const f of using) {
    const src = fs.readFileSync(new URL(f, dir), 'utf8');
    assert.match(src, /feedbackNodes\(\{[^\n]*report: reportFor\(h, ctx, item\)/, `${f}: la llamada a feedbackNodes no pasa report`);
    assert.match(src, /import \{ reportFor \} from '\.\.\/reportMenu\.js'/, `${f}: falta el import`);
  }
});
