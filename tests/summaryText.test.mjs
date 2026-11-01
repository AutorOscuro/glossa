// @purpose: Pruebas de core/summaryText.js (2.8-T2, punto 2): mensaje final honesto, cifras, dominio siempre con su confianza, errores, repasos, acción de repetir y auditoría sin culpa.
// 2.8-T2. Los resúmenes se fabrican con buildSessionSummary (T1) para probar la cadena completa; las entradas absurdas se prueban con objetos a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeSummary, SUMMARY_TEXT, formatMinutes } from '../core/summaryText.js';
import { buildSessionSummary } from '../core/sessionSummary.js';
import { blameHits } from './_blameScan.mjs';
import { makeEvent } from './_helpers.mjs';

const SID = 'ses_x';
let k = 0;
const ev = (over = {}) => { k += 1; return makeEvent({ id: `evt_20261031T1000_${String(k).padStart(4, '0')}`, sessionId: SID, ts: new Date(Date.UTC(2026, 9, 31, 10, 0, k)).toISOString(), cardId: `c${k}#0`, itemId: `c${k}`, ms: 3000, ...over }); };
const run = (results, state, extra = {}) => describeSummary(buildSessionSummary({ events: results.map((r) => ev({ result: r })), sessionId: SID, state, ...extra }));
const finished = (n) => ({ v: 1, phase: 'summary', index: n - 1, total: n, answers: Array.from({ length: n }, (_, i) => ({ index: i, result: 'correct' })), ended: 'completed' });
const rep = (r, n) => Array(n).fill(r);

test('el tipo de pantalla y el título salen del resumen: vacío, parcial y completo', () => {
  assert.deepEqual([describeSummary(buildSessionSummary({})).kind, describeSummary(buildSessionSummary({})).title], ['empty', SUMMARY_TEXT.titleEmpty]);
  const partial = run(['correct', 'wrong'], { v: 1, phase: 'summary', index: 1, total: 6, answers: [{ index: 0, result: 'correct' }, { index: 1, result: 'wrong' }], ended: 'quit' });
  assert.deepEqual([partial.kind, partial.title], ['partial', SUMMARY_TEXT.titlePartial]);
  const full = run(rep('correct', 6), finished(6));
  assert.deepEqual([full.kind, full.title], ['full', SUMMARY_TEXT.titleFull]);
});

test('CA 2: el resumen parcial dice cuánto se hizo y cuánto quedó, y «x de y» en ejercicios', () => {
  const d = run(['correct', 'wrong'], { v: 1, phase: 'summary', index: 1, total: 6, answers: [{ index: 0, result: 'correct' }, { index: 1, result: 'wrong' }], ended: 'quit' });
  assert.match(d.message, /2 ejercicios/);
  assert.match(d.message, /Quedaron 4 sin ver/);
  assert.equal(d.stats.find((s) => s.id === 'answered').value, '2 de 6');
  const one = run(['correct'], { v: 1, phase: 'summary', index: 0, total: 3, answers: [{ index: 0, result: 'correct' }], ended: 'quit' });
  assert.match(one.message, /1 ejercicio\./);
});

test('parcial sin pendientes (cerró justo tras la última) no dice «Quedaron 0»', () => {
  const d = run(['correct', 'correct'], { v: 1, phase: 'summary', index: 1, total: 2, answers: [{ index: 0, result: 'correct' }, { index: 1, result: 'correct' }], ended: 'quit' });
  assert.equal(d.kind, 'partial');
  assert.doesNotMatch(d.message, /Quedaron 0/);
  assert.match(d.message, /antes de tiempo/);
});

test('mensaje final por tramos de precisión, con los límites exactos', () => {
  const T = SUMMARY_TEXT;
  const mix = (ok, total) => [...rep('correct', ok), ...rep('wrong', total - ok)];
  assert.equal(run(mix(2, 2), finished(2)).message, T.msgShort);        // menos de 3: pronto para concluir, aunque sea 100 %
  assert.equal(run(mix(4, 4), finished(4)).message, T.msgSteady);       // 100 % pero solo 4: no se celebra como sólido
  assert.equal(run(mix(5, 5), finished(5)).message, T.msgStrong);
  assert.equal(run(mix(17, 20), finished(20)).message, T.msgStrong);    // 85 %
  assert.equal(run(mix(8, 10), finished(10)).message, T.msgSteady);     // 80 %
  assert.equal(run(mix(5, 10), finished(10)).message, T.msgSteady);     // 50 %
  assert.equal(run(mix(4, 10), finished(10)).message, T.msgHard);       // 40 %
  assert.equal(run(mix(0, 8), finished(8)).message, T.msgHard);         // 0 %
});

test('honestidad: con poca precisión no hay elogio ni lenguaje de éxito; con éxito no hay consuelo', () => {
  const hard = SUMMARY_TEXT.msgHard.toLowerCase();
  for (const w of ['excelente', 'genial', 'felicidades', 'sólida', 'perfecto', '¡bien', 'increíble']) assert.ok(!hard.includes(w), w);
  assert.ok(!SUMMARY_TEXT.msgStrong.toLowerCase().includes('costó'));
  assert.ok(!SUMMARY_TEXT.msgShort.toLowerCase().includes('sólid'));
});

test('cifras: precisión solo con respuestas; el «casi» y el «para repasar» (fallo + no sé) salen aparte', () => {
  const none = describeSummary(buildSessionSummary({}));
  assert.deepEqual(none.stats.map((s) => s.id), ['answered', 'correct']);
  const d = run(['correct', 'almost', 'wrong', 'dont_know', 'skipped'], finished(5));
  assert.deepEqual(d.stats.map((s) => s.id), ['answered', 'correct', 'accuracy', 'time']);
  assert.equal(d.stats.find((s) => s.id === 'accuracy').value, '20 %');
  assert.deepEqual(d.breakdown, [{ id: 'almost', text: 'Casi: 1' }, { id: 'review', text: 'Para repasar: 2' }, { id: 'skipped', text: 'Saltados: 1' }]);
  assert.deepEqual(run(rep('correct', 3), finished(3)).breakdown, []);
});

test('tiempo legible: menos de 1 min, minutos, horas; valores raros no dan NaN', () => {
  assert.deepEqual([0, 59999, 60000, 89999, 90000, 3600000, 3900000, 7200000].map(formatMinutes),
    ['menos de 1 min', 'menos de 1 min', '1 min', '1 min', '2 min', '1 h', '1 h 05 min', '2 h']);
  for (const bad of [NaN, -5, Infinity, null, undefined, 'x']) assert.equal(formatMinutes(bad), bad === Infinity ? 'menos de 1 min' : 'menos de 1 min');
});

const mastery = (rows) => rows.map(([topicId, before, after, confidence, direction]) => ({ topicId, before, after, delta: before === null ? null : after - before, direction, band: 'progress', confidence }));
const withMastery = (rows) => describeSummary({ ...buildSessionSummary({ events: [ev()], sessionId: SID }), mastery: { changes: mastery(rows) } }, { topicName: (id) => `Tema ${id}` });

test('dominio: cada porcentaje lleva siempre su confianza; 100 % con confianza baja no se presenta como logro', () => {
  const d = withMastery([['a', null, 100, 'low', 'new'], ['b', 40, 53, 'mid', 'up'], ['c', 60, 60, 'high', 'same'], ['d', 90, 70, null, 'down']]);
  assert.deepEqual(d.mastery.lines.map((l) => l.text), [
    'Tema a: primer dato, 100 % (todavía es pronto para fiarse)',
    'Tema b: subió de 40 % a 53 % (va tomando forma)',
    'Tema c: se mantiene en 60 % (dato firme)',
    'Tema d: bajó de 90 % a 70 % (sin confianza medida)',
  ]);
  assert.ok(d.mastery.lines.every((l) => /\(.+\)$/.test(l.text)));
  assert.ok(!d.mastery.lines.some((l) => /domin|logr|maestr/i.test(l.text)));
});

test('dominio (FIX 2.9-T4): con poca evidencia el resumen dice «poca evidencia todavía» en vez de la confianza', () => {
  const rows = mastery([['a', null, 59, 'low', 'new'], ['b', 40, 59, 'low', 'up']]).map((r, i) => (i === 0 ? { ...r, lowEvidence: true } : r));
  const d = describeSummary({ ...buildSessionSummary({ events: [ev()], sessionId: SID }), mastery: { changes: rows } }, { topicName: (id) => `Tema ${id}` });
  assert.deepEqual(d.mastery.lines.map((l) => l.text), ['Tema a: primer dato, 59 % (poca evidencia todavía)', 'Tema b: subió de 40 % a 59 % (todavía es pronto para fiarse)']);
  assert.deepEqual(blameHits(d.mastery.lines.map((l) => l.text).join(' ')), []);
});

test('dominio: muestra 6 temas y cuenta los demás', () => {
  const rows = Array.from({ length: 9 }, (_, i) => [`t${i}`, 10, 20 + i, 'mid', 'up']);
  const d = withMastery(rows);
  assert.equal(d.mastery.lines.length, 6);
  assert.equal(d.mastery.more, 3);
  assert.equal(SUMMARY_TEXT.moreTopics(1), 'y 1 tema más');
  assert.equal(SUMMARY_TEXT.moreTopics(3), 'y 3 temas más');
});

const errRec = (id, over = {}) => ({ id, code: 'TNS.SINCE_FOR', title: 'since / for', hint: 'for con duración, since con punto de partida.', original: 'since two years', correction: 'for two years', topics: ['t.a'], kind: 'slip', times: 1, priorCount: 0, count: 1, itemId: 'i', ...over });
const withErrors = (fresh, recurrent) => describeSummary({ ...buildSessionSummary({ events: [ev()], sessionId: SID }), errors: { fresh, recurrent, total: fresh.length + recurrent.length } }, { topicName: (id) => `Tema ${id}` });

test('errores: texto «mal → bien», microexplicación, y la nota según lo ocurrido', () => {
  const d = withErrors([errRec('n1'), errRec('n2', { times: 2 }), errRec('n3', { times: 4, correction: null })], [errRec('r1', { priorCount: 2, count: 3, kind: 'systematic' }), errRec('r2', { priorCount: 1, count: 2 })]);
  assert.equal(d.errors.recurrent[0].note, 'Ya había aparecido 2 veces antes. Conviene practicarlo con calma.');
  assert.equal(d.errors.recurrent[1].note, 'Ya había aparecido 1 vez antes.');
  assert.equal(d.errors.fresh[0].text, '«since two years» → «for two years»');
  assert.equal(d.errors.fresh[0].hint, 'for con duración, since con punto de partida.');
  assert.equal(d.errors.fresh[0].note, null);
  assert.equal(d.errors.fresh[1].note, 'Apareció dos veces hoy.');
  assert.equal(d.errors.fresh[2].text, '«since two years»');
  assert.equal(d.errors.fresh[2].note, 'Apareció 4 veces hoy.');
  assert.deepEqual(d.errors.fresh[0].topics, ['Tema t.a']);
});

test('errores: máximo 5 en pantalla, los recurrentes primero, y se cuenta el resto', () => {
  const many = (p, n, extra = {}) => Array.from({ length: n }, (_, i) => errRec(`${p}${i}`, extra));
  const d = withErrors(many('n', 4), many('r', 3, { priorCount: 1, count: 2 }));
  assert.equal(d.errors.recurrent.length, 3);
  assert.equal(d.errors.fresh.length, 2);
  assert.equal(d.errors.more, 2);
  const only = withErrors(many('n', 8), []);
  assert.equal(only.errors.fresh.length, 5);
  assert.equal(only.errors.more, 3);
});

test('repasos: líneas solo de lo que hay, y lo que no tiene fecha se dice sin inventar', () => {
  const now = new Date(2026, 9, 31, 12, 0, 0);
  const at = (d) => new Date(2026, 9, 31 + d, 9, 0, 0).toISOString();
  const events = ['a', 'b', 'c', 'd', 'e'].map((id) => ev({ cardId: `${id}#0`, itemId: id }));
  const cards = [{ id: 'a#0', due: at(0) }, { id: 'b#0', due: at(1) }, { id: 'c#0', due: at(5) }, { id: 'd#0', due: at(30) }];
  const d = describeSummary(buildSessionSummary({ events, sessionId: SID, cards, now }));
  assert.deepEqual(d.reviews.lines, ['Hoy o antes: 1', 'Mañana: 1', 'En los próximos 7 días: 1', 'Más adelante: 1']);
  assert.equal(d.reviews.unknown, 'Sin fecha de repaso todavía: 1');
  const none = describeSummary(buildSessionSummary({ events: [ev()], sessionId: SID, now }));
  assert.deepEqual(none.reviews.lines, []);
});

test('acción «Repetir»: solo con tarjetas fallidas, con singular y plural', () => {
  assert.equal(run(rep('correct', 3), finished(3)).actions.retry, null);
  assert.deepEqual(run(['correct', 'wrong', 'correct'], finished(3)).actions.retry, { count: 1, label: 'Repetir el que no me salió' });
  assert.deepEqual(run(['wrong', 'dont_know', 'correct'], finished(3)).actions.retry, { count: 2, label: 'Repetir los 2 que no me salieron' });
  assert.equal(run(['almost', 'almost', 'almost'], finished(3)).actions.retry, null); // «casi» no es fallo
});

const walkStrings = (v, out = []) => { if (typeof v === 'string') out.push(v); else if (v && typeof v === 'object') Object.values(v).forEach((x) => walkStrings(x, out)); return out; };

test('auditoría sin culpa: todo SUMMARY_TEXT (también las funciones) y todo lo que sale de 300 resúmenes generados', () => {
  const texts = [];
  for (const v of Object.values(SUMMARY_TEXT)) {
    if (typeof v === 'string') texts.push(v);
    else for (const args of [[0], [1], [2, 3], [5, 'x'], [1, 40, 60], ['T', 40, 60]]) { try { const r = v(...args); if (typeof r === 'string') texts.push(r); } catch { /* aridad distinta */ } }
  }
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const kinds = ['correct', 'almost', 'wrong', 'dont_know', 'skipped'];
  for (let i = 0; i < 300; i += 1) {
    const n = Math.floor(rnd() * 12);
    const results = Array.from({ length: n }, () => kinds[Math.floor(rnd() * 5)]);
    const quit = rnd() < 0.3;
    const state = n === 0 ? undefined : { v: 1, phase: 'summary', index: n - 1, total: quit ? n + 3 : n, answers: results.map((r, j) => ({ index: j, result: r })), ended: quit ? 'quit' : 'completed' };
    texts.push(...walkStrings(run(results, state)));
  }
  assert.ok(texts.length > 600, String(texts.length));
  for (const t of texts) { assert.deepEqual(blameHits(t), [], `«${t}»`); assert.doesNotMatch(t, /NaN|undefined|null|Infinity|\[object/); }
});

test('entradas absurdas: nunca lanza, nunca escribe NaN o undefined y devuelve algo congelado', () => {
  const nameThrows = { topicName: () => { throw new Error('x'); } };
  for (const bad of [undefined, null, 'x', 7, [], {}, { empty: false, answered: NaN, planned: Infinity, counts: { correct: NaN }, accuracyPct: NaN, time: { ms: NaN }, mastery: { changes: 'x' }, errors: { fresh: 5, recurrent: null }, nextReviews: { groups: { today: -3 }, unknown: NaN }, failed: 'x' },
    { empty: false, answered: 2, mastery: { changes: [{ topicId: 7, direction: '??', after: NaN, confidence: 3 }] }, errors: { fresh: [{ id: 'x', original: 'a' }], recurrent: [] } }]) {
    const d = describeSummary(bad, nameThrows);
    assert.ok(Object.isFrozen(d));
    for (const t of walkStrings(d)) assert.doesNotMatch(t, /NaN|undefined|Infinity|\[object/, t);
  }
  const hostile = { get empty() { throw new Error('boom'); } };
  assert.equal(describeSummary(hostile).kind, 'empty');
  assert.equal(describeSummary(buildSessionSummary({}), { topicName: () => 42 }).kind, 'empty');
});
