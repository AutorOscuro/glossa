// @purpose: Evidencia de los 4 criterios de aceptación de 2.8 (resumen de sesión) de punta a punta: vista de sesión real, fuente del resumen real y base en memoria.
// 2.8-T3 (cierre). CA 1 las cifras coinciden con los eventos (conteo aparte, leyendo la base) · CA 2 abandonar a mitad muestra el resumen parcial · CA 3 la mini-sesión de fallos funciona · CA 4 con 0 respuestas no hay NaN.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mk, openNew, fakeHost } from './_sesionHarness.mjs';
import { buildSessionSummary } from '../core/sessionSummary.js';
import { describeSummary } from '../core/summaryText.js';
import { createSummaryPanel } from '../ui/summaryPanel.js';
import { parseChatBlock } from '../core/syncChat.js';
import { makeEnv } from './_fakeDom.mjs';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });

// Respuestas por turno: correcta, fallada, correcta (el segundo ejercicio falla).
const host = (results) => {
  let n = 0;
  const base = fakeHost();
  const mount = base.mount.bind(base);
  return { ...base, mount: async (slot, entry, ctx) => { const r = results[n] ?? 'correct'; n += 1; return mount(slot, entry, { ...ctx, submit: (a) => ctx.submit({ ...a, result: r }) }); } };
};
const step = async (t) => { t.clock.advance(2000); t.click(t.btn('Comprobar')); await t.flush(); };
const next = async (t) => { t.click(t.btn('Continuar')); await t.flush(); };
const finish = async (t, n = 3) => { for (let i = 0; i < n; i += 1) { await step(t); await next(t); } };
const panel = (t) => t.q('.summary')[0]?.textContent ?? '';
const leave = async (t) => { t.click(t.q('button').find((b) => b.getAttribute('aria-label') === 'Salir de la sesión')); await t.flush(); t.click(t.dlgBtn('Salir')); await t.flush(); };
const BAD = /NaN|undefined|null|Infinity/;

test('CA 1 · las cifras del resumen coinciden con los eventos guardados (conteo aparte, leyendo la base)', async () => {
  const t = await mk({ host: host(['correct', 'wrong', 'correct']) }); await openNew(t); await finish(t);
  const events = (await t.events()).filter((e) => e.type === 'answer');
  const correct = events.filter((e) => e.result === 'correct').length;
  const wrong = events.filter((e) => e.result === 'wrong' || e.result === 'dont_know').length;
  const ms = events.reduce((a, e) => a + (Number.isFinite(e.ms) ? e.ms : 0), 0);
  assert.equal(events.length, 3);
  assert.equal(t.q('.summary__stat--answered dd')[0].textContent, String(events.length));
  assert.equal(t.q('.summary__stat--correct dd')[0].textContent, String(correct));
  assert.equal(t.q('.summary__stat--accuracy dd')[0].textContent, `${Math.round((correct / events.length) * 100)} %`);
  assert.match(panel(t), new RegExp(`Para repasar: ${wrong}`));
  const min = Math.round(ms / 60000);
  assert.match(t.q('.summary__stat--time dd')[0].textContent, min < 1 ? /menos de 1 min/ : new RegExp(`${min} min`));
  assert.doesNotMatch(panel(t), BAD);
});

test('CA 2 · abandonar a mitad muestra el resumen parcial con lo hecho, sin navegar solo y conservando la sesión', async () => {
  const t = await mk({ host: host(['correct', 'wrong', 'correct']) }); await openNew(t);
  await step(t); await next(t); await step(t);
  const navs = t.nav.length;
  await leave(t);
  assert.ok(t.q('.summary')[0].classList.contains('summary--partial'));
  assert.match(panel(t), /Sesión a medias/);
  assert.match(panel(t), /2 de 3/);
  assert.match(panel(t), /Quedaron 1 sin ver/);
  assert.equal(t.nav.length, navs);
  assert.equal((await t.events()).filter((e) => e.type === 'answer').length, 2);
  assert.equal((await t.study.session.load()).status, 'restored');
  assert.doesNotMatch(panel(t), BAD);
});

test('CA 3 · «Repetir los que fallé» guarda una sesión nueva con exactamente las tarjetas falladas y navega a ella', async () => {
  const t = await mk({ host: host(['wrong', 'correct', 'wrong']) }); await openNew(t); await finish(t);
  const failedCards = (await t.events()).filter((e) => e.type === 'answer' && e.result === 'wrong').map((e) => e.cardId).sort();
  assert.equal(failedCards.length, 2);
  const retry = t.q('button').find((b) => /^Repetir/.test(b.textContent));
  assert.equal(retry.textContent, 'Repetir los 2 que no me salieron');
  const original = t.nav.at(-1)[1].id;
  t.click(retry); await t.flush();
  const [name, params] = t.nav.at(-1);
  assert.equal(name, 'sesion');
  assert.notEqual(params.id, original);
  const saved = await t.study.session.load();
  assert.equal(saved.sessionId, params.id);
  assert.deepEqual(saved.items.map((e) => e.cardId).sort(), failedCards);
  assert.equal(saved.state.phase, 'presenting');
});

test('CA 4 · con 0 respuestas no aparece NaN, undefined ni null, y no se ofrece repetir ni llevar al chat', async () => {
  const empty = buildSessionSummary({ events: [], sessionId: 'ses_x' });
  const env = makeEnv(); globalThis.document = env.doc;
  const p = createSummaryPanel({ content: describeSummary(empty), onRetry: () => {}, onChat: async () => ({ status: 'copied' }), onBack: () => {}, doc: env.doc });
  env.doc.body.appendChild(p.el);
  assert.match(p.el.textContent, /Sesión sin ejercicios/);
  assert.match(p.el.textContent, /Todavía no respondiste ningún ejercicio/);
  assert.doesNotMatch(p.el.textContent, BAD);
  assert.equal(p.retryButton, null);
  assert.equal(p.chatButton, null);
  assert.ok(p.backButton);
  // También con cosas absurdas en lugar del resumen.
  for (const bad of [null, undefined, {}, { answered: NaN, counts: { correct: Infinity }, time: { ms: NaN } }, 'x']) {
    const q = createSummaryPanel({ content: describeSummary(bad), doc: env.doc });
    assert.doesNotMatch(q.el.textContent, BAD);
  }
});

test('CA 4 · en la vista, una fuente que devuelve el resumen vacío dibuja el panel sin NaN', async () => {
  const summarySource = { load: async () => buildSessionSummary({ events: [], sessionId: 'ses_x' }) };
  const t = await mk({ services: { summarySource } }); await openNew(t); await finish(t);
  assert.match(panel(t), /Sesión sin ejercicios/);
  assert.doesNotMatch(panel(t), BAD);
  assert.equal(t.q('button').find((b) => b.textContent === 'Llevar al chat'), undefined);
});

test('«Llevar al chat» desde un resumen real copia un bloque 8.14 que se lee de vuelta', async () => {
  const copied = [];
  const t = await mk({ host: host(['wrong', 'correct', 'correct']), services: { clipboard: { writeText: async (x) => { copied.push(x); } } } }); await openNew(t); await finish(t);
  t.click(t.q('button').find((b) => b.textContent === 'Llevar al chat')); await t.flush();
  const p = parseChatBlock(copied[0]);
  assert.equal(p.ok, true);
  assert.equal(p.kind, 'llevar_al_chat');
  assert.match(p.payload.item, /3 ejercicios, 2 aciertos \(67 %\)/);
});
