// @purpose: Pruebas del panel del resumen (ui/summaryPanel.js, 2.8-T2 punto 3): dibuja lo que dice describeSummary, secciones solo con contenido, botones solo si funcionan, sin NaN y con limpieza.
// 2.8-T2 punto 3 con DOM falso. Los resúmenes se fabrican con buildSessionSummary y describeSummary (cadena completa); lo absurdo, con objetos a mano.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv } from './_fakeDom.mjs';
import { makeEvent } from './_helpers.mjs';
import { createSummaryPanel, SP_TEXT } from '../ui/summaryPanel.js';
import { describeSummary, SUMMARY_TEXT } from '../core/summaryText.js';
import { buildSessionSummary } from '../core/sessionSummary.js';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });

const SID = 'ses_p';
let k = 0;
const ev = (over = {}) => { k += 1; return makeEvent({ id: `evt_20261031T1000_${String(k).padStart(4, '0')}`, sessionId: SID, ts: new Date(Date.UTC(2026, 9, 31, 10, 0, k)).toISOString(), cardId: `c${k}#0`, itemId: `c${k}`, ms: 3000, ...over }); };
const finished = (n) => ({ v: 1, phase: 'summary', index: n - 1, total: n, answers: Array.from({ length: n }, (_, i) => ({ index: i, result: 'correct' })), ended: 'completed' });
const full = (results, extra = {}) => describeSummary(buildSessionSummary({ events: results.map((r) => ev({ result: r })), sessionId: SID, state: finished(results.length), ...extra }), { topicName: (id) => `Tema ${id}` });
const errRec = (id, over = {}) => ({ id, code: 'TNS.SINCE_FOR', title: 'since / for', hint: 'for con duración, since con punto de partida.', original: 'since two years', correction: 'for two years', topics: ['t.a'], kind: 'slip', times: 1, priorCount: 0, count: 1, itemId: 'i', ...over });
const rich = (fresh, recurrent, mastery = []) => describeSummary({ ...buildSessionSummary({ events: [ev()], sessionId: SID }), errors: { fresh, recurrent, total: fresh.length + recurrent.length }, mastery: { changes: mastery } }, { topicName: (id) => `Tema ${id}` });
const change = (topicId, before, after, confidence, direction) => ({ topicId, before, after, delta: before === null ? null : after - before, direction, band: 'progress', confidence });

function setup(content, opts = {}) {
  const env = makeEnv(); globalThis.document = env.doc;
  const panel = createSummaryPanel({ content, doc: env.doc, ...opts });
  env.doc.body.appendChild(panel.el);
  const all = (sel) => panel.el.querySelectorAll(sel);
  return { env, panel, all, text: () => panel.el.textContent, click: (btn) => btn.el.dispatchEvent({ type: 'click', preventDefault() {} }) };
}

test('dibuja título, mensaje y cifras tal como los decidió describeSummary', () => {
  const c = full(['correct', 'correct', 'wrong', 'correct', 'correct']);
  const t = setup(c);
  assert.equal(t.all('h2')[0].textContent, SUMMARY_TEXT.titleFull);
  assert.equal(t.all('.summary__message')[0].textContent, c.message);
  assert.deepEqual(t.all('.summary__stat').map((s) => [s.querySelectorAll('dt')[0].textContent, s.querySelectorAll('dd')[0].textContent]),
    c.stats.map((s) => [s.label, s.value]));
  assert.ok(t.panel.el.classList.contains('summary--full'));
});

test('parcial y vacío: el tipo sale en la clase y el texto es el del resumen', () => {
  const partial = describeSummary(buildSessionSummary({ events: [ev({ result: 'correct' })], sessionId: SID, state: { v: 1, phase: 'summary', index: 0, total: 4, answers: [{ index: 0, result: 'correct' }], ended: 'quit' } }));
  const p = setup(partial);
  assert.ok(p.panel.el.classList.contains('summary--partial'));
  assert.match(p.text(), /Quedaron 3 sin ver/);
  assert.equal(p.all('.summary__stat--answered')[0].querySelectorAll('dd')[0].textContent, '1 de 4');
  const e = setup(describeSummary(buildSessionSummary({})));
  assert.ok(e.panel.el.classList.contains('summary--empty'));
  assert.match(e.text(), /Todavía no respondiste/);
});

test('CA 4: con 0 respuestas no aparece NaN, undefined ni null, ni secciones vacías', () => {
  for (const content of [describeSummary(buildSessionSummary({})), describeSummary(null), null, undefined, {}, 'x', 7, { kind: 'full' }]) {
    const t = setup(content);
    assert.doesNotMatch(t.text(), /NaN|undefined|null|\[object/);
    assert.equal(t.all('.summary__section').length, 0);
    assert.equal(t.all('h2')[0].textContent, SUMMARY_TEXT.titleEmpty);
  }
  // Un objeto vacío que sí pasa por describeSummary (sin la marca `empty`) tampoco deja NaN ni «undefined».
  assert.doesNotMatch(setup(describeSummary({})).text(), /NaN|undefined|null|\[object/);
});

test('sin dominio, errores ni repasos no dibuja sus secciones; con ellos sí, y en orden', () => {
  const bare = setup(full(['correct', 'correct', 'correct']));
  assert.equal(bare.all('.summary__mastery').length + bare.all('.summary__errsection').length, 0);
  const t = setup(rich([errRec('n1')], [errRec('r1', { priorCount: 2 })], [change('a', null, 100, 'low', 'new')]));
  const heads = t.all('.summary__section').map((s) => s.querySelectorAll('h3')[0].textContent);
  assert.deepEqual(heads.slice(0, 2), [SP_TEXT.masteryTitle, SP_TEXT.errorsTitle]);
  assert.ok(heads.length === 2 || (heads.length === 3 && heads[2] === SP_TEXT.reviewsTitle));
});

test('dominio: cada línea con su confianza y el «y N temas más» cuando hay más de 6', () => {
  const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => change(id, 40, 50, 'mid', 'up'));
  const t = setup(rich([], [], rows));
  const items = t.all('.summary__mastery .summary__item');
  assert.equal(items.length, 6);
  assert.ok(items.every((i) => /\(.+\)$/.test(i.textContent)));
  assert.match(t.all('.summary__mastery .summary__more')[0].textContent, /y 2 temas más/);
  const one = setup(rich([], [], [change('a', null, 100, 'low', 'new')]));
  assert.match(one.text(), /primer dato, 100 % \(todavía es pronto para fiarse\)/);
  assert.equal(one.all('.summary__mastery .summary__more').length, 0);
});

test('errores: «mal → bien» en inglés, pista en español, nota, temas; recurrentes antes que nuevos', () => {
  const t = setup(rich([errRec('n1')], [errRec('r1', { priorCount: 2, count: 3, kind: 'systematic' })]));
  assert.deepEqual(t.all('.summary__subheading').map((x) => x.textContent), [SP_TEXT.recurrentTitle, SP_TEXT.freshTitle]);
  const first = t.all('.summary__error')[0];
  assert.equal(first.querySelectorAll('.summary__error-title')[0].textContent, 'since / for');
  assert.equal(first.querySelectorAll('.summary__error-text')[0].textContent, '«since two years» → «for two years»');
  assert.equal(first.querySelectorAll('.summary__error-text')[0].getAttribute('lang'), 'en');
  assert.equal(first.querySelectorAll('.summary__error-hint')[0].getAttribute('lang'), 'es');
  assert.match(first.querySelectorAll('.summary__error-note')[0].textContent, /Ya había aparecido 2 veces antes\. Conviene practicarlo con calma\./);
  assert.match(first.querySelectorAll('.summary__error-topics')[0].textContent, /Temas: Tema t\.a/);
  const bare = setup(rich([errRec('n2', { title: null, hint: null, correction: null, topics: [] })], []));
  assert.equal(bare.all('.summary__error-title').length + bare.all('.summary__error-hint').length + bare.all('.summary__error-note').length + bare.all('.summary__error-topics').length, 0);
  assert.equal(bare.all('.summary__error-text')[0].textContent, '«since two years»');
});

test('si hay más errores de los que caben, dice cuántos quedaron fuera', () => {
  const many = Array.from({ length: 8 }, (_, i) => errRec(`n${i}`));
  const t = setup(rich(many, []));
  assert.equal(t.all('.summary__error').length, 5);
  assert.match(t.all('.summary__errsection .summary__more')[0].textContent, /y 3 más/);
});

test('próximos repasos: las líneas y, si hay, «sin fecha»', () => {
  const c = describeSummary({ ...buildSessionSummary({ events: [ev()], sessionId: SID }), nextReviews: { groups: { today: 2, tomorrow: 1, week: 0, later: 3 }, unknown: 1 } });
  const t = setup(c);
  assert.deepEqual(t.all('.summary__reviews .summary__item').map((i) => i.textContent), ['Hoy o antes: 2', 'Mañana: 1', 'Más adelante: 3', 'Sin fecha de repaso todavía: 1']);
  assert.equal(t.all('.summary__reviews h3')[0].textContent, SP_TEXT.reviewsTitle);
});

test('«Repetir los que fallé» solo existe si hay fallos Y se pasó onRetry; «Volver» solo si se pasó onBack', () => {
  const failing = full(['correct', 'wrong', 'dont_know'], { cards: [], errors: [] });
  const calls = [];
  const both = setup(failing, { onRetry: (n) => calls.push(['retry', n]), onBack: () => calls.push(['back']) });
  assert.ok(both.panel.retryButton && both.panel.backButton);
  assert.deepEqual(both.all('.summary__actions button').map((b) => b.querySelectorAll('.btn__label')[0].textContent), [failing.actions.retry.label, SP_TEXT.back]);
  both.click(both.panel.retryButton); both.click(both.panel.backButton);
  assert.deepEqual(calls, [['retry', failing.actions.retry.count], ['back']]);
  const noHandler = setup(failing, { onBack: () => {} });
  assert.equal(noHandler.panel.retryButton, null);
  assert.equal(noHandler.all('.summary__actions button').length, 1);
  const noFails = setup(full(['correct', 'correct', 'correct']), { onRetry: () => {}, onBack: () => {} });
  assert.equal(noFails.panel.retryButton, null);
  const none = setup(failing);
  assert.equal(none.all('.summary__actions').length, 0);
});

test('una acción que lanza se anota y el panel sigue vivo', () => {
  const failing = full(['wrong', 'wrong', 'correct']);
  const errs = []; const orig = console.error; console.error = (...a) => errs.push(a);
  try {
    const t = setup(failing, { onRetry: () => { throw new Error('boom'); }, onBack: () => { throw new Error('boom2'); } });
    t.click(t.panel.retryButton); t.click(t.panel.backButton);
    assert.equal(errs.length, 2);
    assert.match(t.text(), new RegExp(SUMMARY_TEXT.titleFull));
  } finally { console.error = orig; }
});

test('argumentos mal formados lanzan TypeError en español', () => {
  assert.throws(() => createSummaryPanel({ content: null, onRetry: 'x' }), /onRetry/);
  assert.throws(() => createSummaryPanel({ content: null, onBack: 3 }), /onBack/);
});

test('el texto entra como texto: una etiqueta en lo que escribió la persona no se convierte en HTML', () => {
  const t = setup(rich([errRec('n1', { original: '<img src=x onerror=alert(1)>', correction: null })], []));
  assert.equal(t.all('img').length, 0);
  assert.match(t.all('.summary__error-text')[0].textContent, /<img src=x/);
});

test('destroy es idempotente, quita el panel y no deja listeners', () => {
  const t = setup(full(['wrong', 'correct', 'correct']), { onRetry: () => {}, onBack: () => {} });
  t.panel.destroy(); t.panel.destroy();
  assert.equal(t.env.doc.body.querySelectorAll('.summary').length, 0);
  assert.equal(t.env.stats.live(), 0);
});

// ---------- 2.8-T3 punto 2: «Llevar al chat» ----------
const withChat = () => rich([errRec('e1')], []);
const chatBtnOf = (t) => t.panel.chatButton;
const flush = () => new Promise((r) => setImmediate(r));

test('«Llevar al chat» solo existe si hay algo que llevar Y se pasó onChat', () => {
  assert.equal(setup(withChat(), { onChat: async () => ({ status: 'copied' }) }).panel.chatButton?.el.textContent, 'Llevar al chat');
  assert.equal(setup(withChat()).panel.chatButton, null);
  assert.equal(setup(full(['correct', 'correct', 'correct']), { onChat: async () => ({ status: 'copied' }) }).panel.chatButton, null);
  assert.throws(() => createSummaryPanel({ content: withChat(), onChat: 'x' }), TypeError);
});

test('el botón primario es «Repetir»; «Llevar al chat» y «Volver» son secundarios', () => {
  const t = setup(describeSummary({ ...buildSessionSummary({ events: [ev({ result: 'wrong' })], sessionId: SID }), failed: [{ cardId: 'c', itemId: 'i', result: 'wrong' }], errors: { fresh: [errRec('e1')], recurrent: [], total: 1 } }), { onRetry: () => {}, onChat: async () => ({ status: 'copied' }), onBack: () => {} });
  assert.ok(t.panel.retryButton && t.panel.chatButton && t.panel.backButton);
  assert.ok(t.panel.retryButton.el.classList.contains('btn--primary'));
  assert.ok(!t.panel.chatButton.el.classList.contains('btn--primary'));
  assert.ok(!t.panel.backButton.el.classList.contains('btn--primary'));
});

test('dice «Copiado», muestra el bloque a mano si hace falta y avisa sin culpa si falla', async () => {
  for (const [r, re] of [[{ status: 'copied' }, /Copiado\. Pégalo en el chat\./], [{ status: 'manual', text: 'BLOQUE' }, /No se pudo copiar solo/], [{ status: 'failed' }, /No pude preparar el bloque/], [null, /No pude preparar el bloque/]]) {
    const t = setup(withChat(), { onChat: async () => r });
    t.click(chatBtnOf(t)); await flush();
    assert.match(t.all('.summary__chat-status')[0].textContent, re);
    assert.equal(t.all('.summary__chat-block').length, r?.status === 'manual' ? 1 : 0);
  }
});

test('si onChat lanza se anota, se avisa y el botón sigue vivo; un segundo toque en curso se ignora', async () => {
  const errs = []; const orig = console.error; console.error = (...a) => errs.push(a);
  try {
    let calls = 0;
    const t = setup(withChat(), { onChat: async () => { calls += 1; throw new Error('roto'); } });
    t.click(chatBtnOf(t)); t.click(chatBtnOf(t)); await flush();
    assert.equal(calls, 1);
    assert.match(t.all('.summary__chat-status')[0].textContent, /No pude preparar el bloque/);
    t.click(chatBtnOf(t)); await flush();
    assert.equal(calls, 2);
    assert.ok(errs.length >= 2);
  } finally { console.error = orig; }
});

test('destruir el panel mientras se prepara no dibuja nada después', async () => {
  let release; const gate = new Promise((r) => { release = r; });
  const t = setup(withChat(), { onChat: async () => { await gate; return { status: 'manual', text: 'X' }; } });
  t.click(chatBtnOf(t)); t.panel.destroy(); release(); await flush();
  assert.equal(t.all('.summary__chat-block').length, 0);
});
