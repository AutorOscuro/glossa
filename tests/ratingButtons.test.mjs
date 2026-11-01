// @purpose: Pruebas de los 4 botones de calificación manual (ui/components/ratingButtons.js) y de su CSS.
// Pruebas de los 4 botones de calificación manual (subparte 1.5, cuarto 3, mitad B): ui/components/ratingButtons.js + su CSS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeEnv } from './_fakeDom.mjs';
import * as ui from '../ui/components/index.js';
import { createRatingButtons, normalizePreviews, RATING_KEYS } from '../ui/components/ratingButtons.js';
import { TEXT } from '../ui/components/_text.js';
import { createSrs } from '../core/srsEngine.js';
import { newCard } from '../core/srs.js';
import { parseCss } from '../tools/css-lite.mjs';

const ev = (type, extra = {}) => ({ type, preventDefault() { this.prevented = true; }, ...extra });
const tap = (el) => el.dispatchEvent(ev('click'));
const setup = (opts = {}) => { const env = makeEnv(); return { env, rb: createRatingButtons({ doc: env.doc, win: env.win, ...opts }) }; };
const btns = (rb) => rb.el.querySelectorAll('button');
const throwsEs = (fn, re) => assert.throws(fn, (e) => e instanceof TypeError && re.test(e.message));
const flush = () => new Promise((r) => setImmediate(r));

test('estructura: grupo con nombre, 4 <button> reales en orden Otra vez · Difícil · Bien · Fácil, con data-rating 1–4', () => {
  const { rb } = setup();
  assert.equal(rb.el.getAttribute('role'), 'group'); assert.equal(rb.el.getAttribute('aria-label'), '¿Cómo te salió?');
  const b = btns(rb);
  assert.equal(b.length, 4);
  assert.deepEqual(b.map((x) => x.querySelector('.rating-buttons__label').textContent), ['Otra vez', 'Difícil', 'Bien', 'Fácil']);
  assert.deepEqual(b.map((x) => x.getAttribute('data-rating')), ['1', '2', '3', '4']);
  for (const x of b) { assert.equal(x.tagName, 'BUTTON'); assert.equal(x.getAttribute('type'), 'button'); assert.equal(x.getAttribute('aria-pressed'), 'false'); }
  assert.deepEqual([...RATING_KEYS], ['again', 'hard', 'good', 'easy']);
  assert.equal(ui.createRatingButtons, createRatingButtons, 'exportado por el índice de componentes');
});

test('textos en español sin culpa: ninguna etiqueta por defecto es un reproche', () => {
  assert.deepEqual(Object.values(TEXT.rating), ['¿Cómo te salió?', 'Otra vez', 'Difícil', 'Bien', 'Fácil']);
  for (const t of Object.values(TEXT.rating)) assert.doesNotMatch(t, /mal|error|fall|incorrect|perd|terrible|no sab/i, t);
});

test('un toque llama a onRate(rating) UNA vez y bloquea los 4 botones (doble toque seguro)', () => {
  const calls = []; const { rb } = setup({ onRate: (r) => calls.push(r) });
  const b = btns(rb);
  tap(b[2]); tap(b[2]); tap(b[0]); tap(b[3]);
  assert.deepEqual(calls, [3], 'solo el primer toque califica');
  assert.equal(rb.isLocked(), true);
  assert.equal(b[2].getAttribute('aria-pressed'), 'true'); assert.equal(b[0].getAttribute('aria-pressed'), 'false');
  assert.ok(b[2].classList.contains('is-chosen')); assert.ok(b.every((x) => x.classList.contains('is-off')));
});

test('cada botón entrega su rating (1, 2, 3, 4) y reset() deja calificar la tarjeta siguiente', () => {
  const calls = []; const { rb } = setup({ onRate: (r, e) => { calls.push(r); assert.equal(e.type, 'click'); } });
  for (let i = 0; i < 4; i += 1) { tap(btns(rb)[i]); rb.reset(); assert.equal(rb.isLocked(), false); }
  assert.deepEqual(calls, [1, 2, 3, 4]);
  assert.ok(btns(rb).every((x) => x.getAttribute('aria-pressed') === 'false' && !x.classList.contains('is-chosen')));
});

test('sin onRate no falla: solo marca y bloquea', () => {
  const { rb } = setup(); tap(btns(rb)[1]);
  assert.equal(rb.isLocked(), true); assert.equal(btns(rb)[1].getAttribute('aria-pressed'), 'true');
});

// El DOM falso no devuelve lo que devuelve un listener; se llama al listener registrado directamente (igual que en la prueba del botón de 0.5).
const clickHandler = (el) => el._l.get('click').values().next().value;

test('onRate asíncrono: sigue bloqueado mientras dura; si rechaza, se desbloquea para reintentar y el error se propaga', async () => {
  let settle; const calls = [];
  const { rb } = setup({ onRate: (r) => { calls.push(r); return new Promise((res, rej) => { settle = { res, rej }; }); } });
  const out = clickHandler(btns(rb)[0])(ev('click'));
  assert.equal(rb.isLocked(), true);
  tap(btns(rb)[1]); assert.deepEqual(calls, [1], 'mientras dura, otros toques se ignoran');
  settle.rej(new Error('no se guardó'));
  await assert.rejects(out, /no se guardó/); // el rechazo SE PROPAGA (no se traga)
  assert.equal(rb.isLocked(), false); assert.ok(btns(rb).every((x) => x.getAttribute('aria-pressed') === 'false'));
  const out2 = clickHandler(btns(rb)[1])(ev('click')); settle.res(); await out2;
  assert.deepEqual(calls, [1, 2]); assert.equal(rb.isLocked(), true, 'tras el éxito sigue bloqueado hasta reset()');
  rb.reset(); assert.equal(rb.isLocked(), false);
});

test('onRate que lanza al instante: se desbloquea y el error sigue su camino (no se traga)', () => {
  const { env, rb } = setup({ onRate: () => { throw new Error('boom'); } });
  const errors = []; env.win.addEventListener('error', (e) => errors.push(e.message));
  tap(btns(rb)[0]);
  assert.deepEqual(errors, ['boom'], 'el error llega al manejador global');
  assert.equal(rb.isLocked(), false); assert.equal(btns(rb)[0].getAttribute('aria-pressed'), 'false');
  assert.throws(() => clickHandler(btns(rb)[1])(ev('click')), /boom/);
});

test('setDisabled deshabilita de verdad (atributo disabled) y no califica; al volver, califica', () => {
  const calls = []; const { rb } = setup({ onRate: (r) => calls.push(r), disabled: true });
  assert.ok(btns(rb).every((x) => x.hasAttribute('disabled')));
  tap(btns(rb)[0]); assert.deepEqual(calls, []); assert.equal(rb.isLocked(), false, 'un toque ignorado no bloquea');
  rb.setDisabled(false); assert.ok(btns(rb).every((x) => !x.hasAttribute('disabled')));
  tap(btns(rb)[3]); assert.deepEqual(calls, [4]);
  throwsEs(() => rb.setDisabled('sí'), /"disabled" debe ser verdadero o falso/);
});

test('fechas de repaso bajo cada botón: acepta textos o lo que devuelve srs.previewIntervals; null las quita', () => {
  const srs = createSrs(); const now = new Date('2026-10-20T10:00:00Z');
  let card = newCard('a.1', 0, now, ['t.a']); card = srs.review(card, 3, now);
  const preview = srs.previewIntervals(card, new Date(now.getTime() + 3 * 86400000));
  const { rb } = setup({ previews: preview });
  const when = () => btns(rb).map((x) => x.querySelector('.rating-buttons__when'));
  assert.deepEqual(when().map((w) => w.textContent), ['again', 'hard', 'good', 'easy'].map((k) => preview[k].label));
  assert.ok(when().every((w) => !w.classList.contains('is-empty')));
  rb.setPreviews({ good: 'Repaso en 4 d' });
  assert.deepEqual(when().map((w) => w.textContent), ['', '', 'Repaso en 4 d', '']);
  assert.ok(when()[0].classList.contains('is-empty'));
  rb.setPreviews(null); assert.ok(when().every((w) => w.textContent === '' && w.classList.contains('is-empty')));
  assert.deepEqual(normalizePreviews({ again: '  ', hard: 5, good: { label: ' 2 d ' }, easy: { due: 'x' }, otra: 'x' }), { good: '2 d' });
  throwsEs(() => rb.setPreviews([1]), /"previews" debe ser un objeto/); throwsEs(() => normalizePreviews('x'), /"previews"/);
});

test('etiquetas y nombre del grupo personalizables; las inválidas se rechazan en voz alta', () => {
  const { rb } = setup({ label: 'Tu autoevaluación', labels: { good: 'Bien, lo supe' } });
  assert.equal(rb.el.getAttribute('aria-label'), 'Tu autoevaluación');
  assert.deepEqual(btns(rb).map((x) => x.querySelector('.rating-buttons__label').textContent), ['Otra vez', 'Difícil', 'Bien, lo supe', 'Fácil']);
  throwsEs(() => setup({ labels: { medio: 'x' } }), /"labels.medio" no existe/);
  throwsEs(() => setup({ labels: { good: '' } }), /"labels.good" no puede estar vacío/);
  throwsEs(() => setup({ labels: ['a'] }), /"labels" debe ser un objeto/);
  throwsEs(() => setup({ labels: { good: 'x'.repeat(41) } }), /demasiado largo/);
  throwsEs(() => setup({ onRate: 'x' }), /"onRate" debe ser una función/);
  throwsEs(() => setup({ disabled: 1 }), /"disabled"/);
  throwsEs(() => createRatingButtons({ doc: null }), /no hay documento/);
});

test('texto con < & " y emoji se escribe como TEXTO, no como HTML', () => {
  const evil = '<img src=x onerror=alert(1)> & "hola" 🙂';
  const { rb } = setup({ labels: { good: evil }, previews: { good: evil } });
  assert.equal(rb.el.querySelectorAll('img').length, 0);
  assert.equal(btns(rb)[2].querySelector('.rating-buttons__label').textContent, evil);
  assert.equal(btns(rb)[2].querySelector('.rating-buttons__when').textContent, evil);
});

test('destroy: quita el nodo y TODOS los listeners; es idempotente y después ya no califica', () => {
  const env = makeEnv(); const before = env.stats.live(); const calls = [];
  const rb = createRatingButtons({ doc: env.doc, win: env.win, onRate: (r) => calls.push(r) });
  const host = env.doc.createElement('div'); host.appendChild(rb.el);
  assert.ok(env.stats.live() > before);
  const first = btns(rb)[0];
  rb.destroy(); rb.destroy();
  assert.equal(env.stats.live(), before, 'sin fugas'); assert.equal(host.children.length, 0);
  tap(first); assert.deepEqual(calls, []);
});

test('integración con el puente: el rating del botón se convierte en tarjeta y evento (gradeManual)', async () => {
  const { gradeManual } = await import('../core/gradeAnswer.js');
  const srs = createSrs(); const now = new Date('2026-10-20T10:00:00Z'); const card = newCard('a.1', 0, now, ['t.a']);
  const results = [];
  const { rb } = setup({ onRate: (r) => results.push(gradeManual({ rating: r, card, srs, now, exerciseType: 'def_to_word' })) });
  tap(btns(rb)[3]);
  assert.equal(results.length, 1); assert.equal(results[0].event.rating, 4); assert.equal(results[0].card.reps, 1);
});

// ---------- CSS ----------
const css = fs.readFileSync(new URL('../ui/styles/widgets.css', import.meta.url), 'utf8');
const rules = parseCss(css).filter((r) => r.selector.includes('rating-buttons'));
const rule = (sel) => rules.find((r) => r.selector === sel && !r.at);
const declOf = (sel, prop) => rule(sel)?.decls.find((d) => d.prop === prop)?.value;

test('CSS: objetivo táctil ≥ 44 px, la palabra nunca se parte y el botón entero baja de línea', () => {
  assert.equal(declOf('.rating-buttons__btn', 'min-height'), 'var(--touch-min)');
  assert.equal(declOf('.rating-buttons', 'flex-wrap'), 'wrap');
  assert.equal(declOf('.rating-buttons__btn', 'min-width'), 'min-content');
  assert.equal(declOf('.rating-buttons__btn', 'word-break'), 'normal');
  assert.equal(declOf('.rating-buttons__btn', 'hyphens'), 'none');
});

test('CSS: ningún botón usa rojo (sin culpa), cada uno se distingue también por su borde y hay foco visible', () => {
  const text = rules.map((r) => r.decls.map((d) => `${r.selector} ${d.prop}: ${d.value}`).join('\n')).join('\n');
  assert.doesNotMatch(text, /danger/);
  const edges = ['again', 'hard', 'good', 'easy'].map((k) => declOf(`.rating-buttons__btn--${k}`, 'border-bottom-color'));
  assert.equal(new Set(edges).size, 4, edges.join(', '));
  assert.ok(rules.some((r) => r.selector.includes('.rating-buttons__btn:focus-visible')), 'foco visible');
  for (const r of rules.filter((x) => x.selector.includes(':hover'))) assert.match(r.at ?? '', /\(hover:\s*hover\)/);
});
