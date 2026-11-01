// @purpose: Pruebas de la lógica pura de cloze_bank (core/clozeBank.js, 2.4-T2 punto 5): lectura, calificación, estado de toques (poner, quitar, deshacer, reiniciar), secuencias al azar y entradas hostiles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOZE_BANK_LIMITS, readClozeBank, gradeClozeBank, createClozeState, placeWord, removeFill, undoLast, resetCloze, freeWords, isClozeComplete,
} from '../core/clozeBank.js';
import { createRng } from '../core/rng.js';

const item = (data = {}, extra = {}) => ({
  id: 'g.cb.0001', type: 'cloze_bank', prompt_es: 'Completa la frase.',
  data: { text: 'I ___ to school ___ bus.', answers: [['go'], ['by']], bank: ['go', 'by', 'at', 'goes'], ...data }, ...extra,
});
const bad = (reason) => ({ ok: false, reason });

test('límites congelados: 1 a 6 huecos, banco de hasta 20', () => {
  assert.deepEqual(CLOZE_BANK_LIMITS, { minGaps: 1, maxGaps: 6, bankMax: 20, textLength: 120, answersMax: 10, history: 200 });
  assert.ok(Object.isFrozen(CLOZE_BANK_LIMITS));
});

test('lee un ítem válido: trozos, huecos, respuestas y banco recortados', () => {
  const r = readClozeBank(item({ answers: [[' go '], ['by']], bank: [' go', 'by ', 'at', 'goes'] }));
  assert.deepEqual(r, { ok: true, parts: ['I ', ' to school ', ' bus.'], gaps: 2, answers: [['go'], ['by']], bank: ['go', 'by', 'at', 'goes'] });
});

test('1 y 6 huecos valen; 0 y 7 no', () => {
  const t = (n) => Array.from({ length: n }, (_, i) => `w${i} ___`).join(' ');
  const make = (n) => ({ text: t(n), answers: Array.from({ length: n }, (_, i) => [`a${i}`]), bank: Array.from({ length: n }, (_, i) => `a${i}`) });
  assert.equal(readClozeBank(item(make(1))).ok, true);
  assert.equal(readClozeBank(item(make(6))).ok, true);
  assert.deepEqual(readClozeBank(item({ ...make(1), text: 'sin hueco', })), bad('bad_text'));
  assert.deepEqual(readClozeBank(item(make(7))), bad('bad_text'));
});

test('motivos de rechazo', () => {
  assert.deepEqual(readClozeBank(null), bad('no_data'));
  assert.deepEqual(readClozeBank({}), bad('no_data'));
  assert.deepEqual(readClozeBank({ data: [] }), bad('no_data'));
  assert.deepEqual(readClozeBank(item({ text: 5 })), bad('bad_text'));
  for (const answers of [undefined, 'x', [['go']], [['go'], []], [['go'], ['']], [['go'], [3]], [['go'], ['by'], ['x']], [['go'], 'by'], [['go'], ['x'.repeat(121)]]]) {
    assert.deepEqual(readClozeBank(item({ answers })), bad('bad_answers'), JSON.stringify(answers));
  }
  for (const bank of [undefined, null, 'x', [], ['go'], ['go', ''], ['go', 3], ['go', 'by', 'x'.repeat(121)], Array.from({ length: 21 }, (_, i) => `go${i}`)]) {
    assert.deepEqual(readClozeBank(item({ bank })), bad('bad_bank'), JSON.stringify(bank)?.slice(0, 40));
  }
});

test('sin banco no se lee (aquí el banco es obligatorio)', () => {
  assert.deepEqual(readClozeBank(item({ bank: undefined })), bad('bad_bank'));
});

test('solucionable con fichas distintas: dos huecos que piden «the» y un solo «the» en el banco', () => {
  const d = { text: '___ cat and ___ dog', answers: [['the'], ['the']] };
  assert.deepEqual(readClozeBank(item({ ...d, bank: ['the', 'a'] })), bad('unsolvable'));
  assert.equal(readClozeBank(item({ ...d, bank: ['the', 'the', 'a'] })).ok, true);
});

test('solucionable exige emparejar de verdad, no solo mirar cada hueco', () => {
  // hueco 0 acepta a o b; hueco 1 solo a; banco con una sola «a» y una «b»: se resuelve (0→b, 1→a)
  assert.equal(readClozeBank(item({ text: '___ ___', answers: [['a', 'b'], ['a']], bank: ['a', 'b'] })).ok, true);
  // ambos huecos solo aceptan a o b, y un tercero también: tres huecos, dos fichas posibles → el banco es corto
  assert.deepEqual(readClozeBank(item({ text: '___ ___ ___', answers: [['a', 'b'], ['a', 'b'], ['a', 'b']], bank: ['a', 'b', 'c'] })), bad('unsolvable'));
});

test('las respuestas se comparan sin mayúsculas ni apóstrofo tipográfico', () => {
  const d = { text: 'I ___ know.', answers: [['don\'t']], bank: ['Don’t', 'do'] };
  assert.equal(readClozeBank(item(d)).ok, true);
  assert.equal(gradeClozeBank(item(d), [0]).result, 'correct');
});

test('califica: todo bien, un hueco mal, incompleto y vacío', () => {
  const it = item();
  assert.deepEqual(gradeClozeBank(it, [0, 1]), { result: 'correct', fills: [0, 1], filled: 2, complete: true, empty: false, wrongGaps: [], sentence: 'I go to school by bus.' });
  const w = gradeClozeBank(it, [1, 0]);
  assert.equal(w.result, 'wrong');
  assert.deepEqual(w.wrongGaps, [0, 1]);
  assert.equal(w.sentence, 'I by to school go bus.');
  const one = gradeClozeBank(it, [0, 2]);
  assert.deepEqual(one.wrongGaps, [1]);
  const part = gradeClozeBank(it, [0, null]);
  assert.deepEqual({ r: part.result, f: part.filled, c: part.complete, e: part.empty, w: part.wrongGaps, s: part.sentence }, { r: 'wrong', f: 1, c: false, e: false, w: [], s: 'I go to school ___ bus.' });
  const none = gradeClozeBank(it, []);
  assert.deepEqual({ r: none.result, e: none.empty, s: none.sentence }, { r: 'wrong', e: true, s: 'I ___ to school ___ bus.' });
});

test('varias respuestas por hueco: cualquiera vale; el distractor «goes» no', () => {
  const it = item({ answers: [['go', 'travel'], ['by']], bank: ['travel', 'by', 'goes'] });
  assert.equal(gradeClozeBank(it, [0, 1]).result, 'correct');
  assert.equal(gradeClozeBank(it, [2, 1]).result, 'wrong');
});

test('fichas repetidas en el banco son fichas distintas', () => {
  const it = item({ text: '___ cat and ___ dog', answers: [['the'], ['the']], bank: ['the', 'the', 'a'] });
  assert.equal(gradeClozeBank(it, [0, 1]).result, 'correct');
  assert.equal(gradeClozeBank(it, [1, 0]).result, 'correct');
  assert.equal(gradeClozeBank(it, [0, 0]).filled, 1, 'la misma ficha dos veces cuenta una');
});

test('calificar nunca lanza por `fills` hostil; solo por un ítem inválido', () => {
  const it = item();
  for (const f of [undefined, null, 'x', 5, {}, [NaN], [-1, 99], [1.5, '0'], [Infinity, -0], [0, 0], [[0], [1]], [null, null, 0, 1]]) {
    const g = gradeClozeBank(it, f);
    assert.equal(g.fills.length, 2);
    assert.ok(['correct', 'wrong'].includes(g.result));
  }
  assert.throws(() => gradeClozeBank(item({ bank: ['x'] }), [0]), /cloze_bank válido \(bad_bank\)/);
  assert.throws(() => gradeClozeBank(null, []), /no_data/);
});

test('-0 cuenta como el índice 0', () => {
  assert.equal(gradeClozeBank(item(), [-0, 1]).result, 'correct');
});

test('estado: crea una bandeja barajada que es permutación, con semilla estable', () => {
  const a = createClozeState(2, 6, { rng: createRng(5) });
  const b = createClozeState(2, 6, { rng: createRng(5) });
  assert.deepEqual([...a.tray], [...b.tray]);
  assert.deepEqual([...a.tray].sort(), [0, 1, 2, 3, 4, 5]);
  assert.notDeepEqual([...a.tray], [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([...a.fills], [null, null]);
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.tray) && Object.isFrozen(a.fills) && Object.isFrozen(a.history));
});

test('estado: shuffle false conserva el orden; con 1 ficha no se gira', () => {
  assert.deepEqual([...createClozeState(2, 4, { shuffle: false }).tray], [0, 1, 2, 3]);
  assert.deepEqual([...createClozeState(1, 1, { rng: createRng(1) }).tray], [0]);
});

test('estado: nunca queda en el orden original aunque el rng devuelva siempre el original', () => {
  const rng = { shuffle: (l) => [...l] };
  assert.deepEqual([...createClozeState(2, 3, { rng }).tray], [1, 2, 0]);
});

test('estado: argumentos inválidos lanzan en español', () => {
  for (const [g, b] of [[0, 3], [7, 8], [2, 1], [2, 21], [1.5, 3], ['2', 3], [2, NaN]]) assert.throws(() => createClozeState(g, b, { shuffle: false }), /createClozeState/, `${g},${b}`);
  assert.throws(() => createClozeState(2, 3), /falta un rng/);
  assert.throws(() => createClozeState(2, 3, { rng: { shuffle: () => [0, 0, 1] } }), /permutación/);
});

test('poner: al primer hueco vacío, o a uno elegido; una ficha no se pone dos veces', () => {
  let s = createClozeState(3, 4, { shuffle: false });
  s = placeWord(s, 2);
  assert.deepEqual([...s.fills], [2, null, null]);
  s = placeWord(s, 0, 2);
  assert.deepEqual([...s.fills], [2, null, 0]);
  const same = placeWord(s, 2);
  assert.equal(same, s, 'ficha ya puesta: mismo estado');
  s = placeWord(s, 1);
  assert.deepEqual([...s.fills], [2, 1, 0]);
  assert.equal(isClozeComplete(s), true);
  assert.equal(placeWord(s, 3), s, 'sin hueco libre: mismo estado');
  assert.deepEqual(freeWords(s), [3]);
});

test('poner: índices hostiles y huecos ocupados no cambian nada', () => {
  const s = placeWord(createClozeState(2, 3, { shuffle: false }), 0);
  for (const [w, g] of [[-1], [3], [1.5], ['1'], [NaN], [null], [1, 0], [1, 5], [1, -1], [1, '1'], [1, 0.5]]) assert.equal(placeWord(s, w, g), s, `${w},${g}`);
});

test('quitar: vacía el hueco y la ficha vuelve; huecos vacíos o inválidos no hacen nada', () => {
  let s = placeWord(placeWord(createClozeState(2, 3, { shuffle: false }), 1), 0);
  s = removeFill(s, 0);
  assert.deepEqual([...s.fills], [null, 0]);
  assert.deepEqual(freeWords(s), [1, 2]);
  for (const g of [0, 5, -1, 1.5, '1', NaN, undefined]) assert.equal(removeFill(s, g), s, String(g));
});

test('la bandeja no se mueve al poner o quitar', () => {
  const s0 = createClozeState(2, 5, { rng: createRng(9) });
  let s = s0;
  for (const w of [3, 1]) s = placeWord(s, w);
  s = removeFill(s, 0);
  assert.deepEqual([...s.tray], [...s0.tray]);
});

test('deshacer: vuelve paso a paso, también tras quitar (CA 3 de 2.4)', () => {
  const s0 = createClozeState(3, 4, { shuffle: false });
  const s1 = placeWord(s0, 0);
  const s2 = placeWord(s1, 2);
  const s3 = removeFill(s2, 0);
  const s4 = placeWord(s3, 3);
  let s = undoLast(s4); assert.deepEqual([...s.fills], [...s3.fills]);
  s = undoLast(s); assert.deepEqual([...s.fills], [...s2.fills]);
  s = undoLast(s); assert.deepEqual([...s.fills], [...s1.fills]);
  s = undoLast(s); assert.deepEqual([...s.fills], [...s0.fills]);
  assert.equal(undoLast(s), s, 'sin historial no hace nada');
});

test('reiniciar vacía todo y no vuelve a barajar; ya vacío devuelve el mismo estado', () => {
  const s0 = createClozeState(2, 4, { rng: createRng(3) });
  assert.equal(resetCloze(s0), s0);
  const s = resetCloze(placeWord(placeWord(s0, 1), 2));
  assert.deepEqual([...s.fills], [null, null]);
  assert.deepEqual([...s.history], []);
  assert.deepEqual([...s.tray], [...s0.tray]);
});

test('el historial guarda como mucho 200 acciones', () => {
  let s = createClozeState(1, 2, { shuffle: false });
  for (let i = 0; i < 300; i += 1) s = i % 2 === 0 ? placeWord(s, 0) : removeFill(s, 0);
  assert.equal(s.history.length, CLOZE_BANK_LIMITS.history);
});

test('los estados no se mutan: el anterior queda igual', () => {
  const s0 = createClozeState(2, 3, { shuffle: false });
  const snap = JSON.stringify(s0);
  placeWord(s0, 0); removeFill(placeWord(s0, 1), 0); undoLast(placeWord(s0, 2)); resetCloze(placeWord(s0, 0));
  assert.equal(JSON.stringify(s0), snap);
  assert.throws(() => { s0.fills[0] = 1; }, TypeError);
});

test('CA 4 de 2.4: secuencias de toques al azar nunca dejan un estado imposible ni lanzan', () => {
  for (let seed = 1; seed <= 150; seed += 1) {
    const rng = createRng(seed);
    const gaps = 1 + (seed % 6);
    const bank = gaps + (seed % (CLOZE_BANK_LIMITS.bankMax - gaps + 1));
    let s = createClozeState(gaps, bank, { rng });
    for (let step = 0; step < 60; step += 1) {
      const roll = Math.floor(rng.next() * 100);
      const w = Math.floor(rng.next() * (bank + 2)) - 1;
      const g = Math.floor(rng.next() * (gaps + 2)) - 1;
      if (roll < 40) s = placeWord(s, w);
      else if (roll < 55) s = placeWord(s, w, g);
      else if (roll < 75) s = removeFill(s, g);
      else if (roll < 92) s = undoLast(s);
      else s = resetCloze(s);
      const used = s.fills.filter((x) => x !== null);
      assert.equal(new Set(used).size, used.length, `ficha repetida (semilla ${seed})`);
      assert.ok(used.every((x) => Number.isInteger(x) && x >= 0 && x < bank));
      assert.equal(s.fills.length, gaps);
      assert.equal(freeWords(s).length + used.length, bank);
    }
  }
});

test('CA 5: funciona con 1 hueco y con 6 huecos y 20 fichas', () => {
  const data = {
    text: Array.from({ length: 6 }, (_, i) => `x${i} ___`).join(' '),
    answers: Array.from({ length: 6 }, (_, i) => [`a${i}`]),
    bank: [...Array.from({ length: 6 }, (_, i) => `a${i}`), ...Array.from({ length: 14 }, (_, i) => `d${i}`)],
  };
  const it = item(data);
  assert.equal(readClozeBank(it).ok, true);
  let s = createClozeState(6, 20, { rng: createRng(2) });
  for (let g = 0; g < 6; g += 1) s = placeWord(s, g);
  assert.equal(gradeClozeBank(it, s.fills).result, 'correct');
});

test('límites exactos: 10 respuestas por hueco valen y 11 no; un texto de 120 caracteres vale y uno de 121 no', () => {
  const ten = ['go', ...Array.from({ length: 9 }, (_, i) => `go${i}`)];
  assert.equal(readClozeBank(item({ answers: [ten, ['by']] })).ok, true);
  assert.deepEqual(readClozeBank(item({ answers: [[...ten, 'go9'], ['by']] })), bad('bad_answers'));
  const w120 = 'x'.repeat(120);
  assert.equal(readClozeBank(item({ answers: [[w120], ['by']], bank: [w120, 'by', 'at', 'goes'] })).ok, true);
  assert.deepEqual(readClozeBank(item({ answers: [['x'.repeat(121)], ['by']] })), bad('bad_answers'));
  assert.deepEqual(readClozeBank(item({ bank: ['go', 'by', 'x'.repeat(121)] })), bad('bad_bank'));
});

test('calificar ignora el índice -1 y el índice igual a la longitud del banco', () => {
  const it = item();
  const a = gradeClozeBank(it, [-1, 1]);
  assert.deepEqual(a.fills, [null, 1]);
  assert.equal(a.filled, 1);
  assert.equal(a.result, 'wrong');
  const b = gradeClozeBank(it, [4, 1]);
  assert.deepEqual(b.fills, [null, 1]);
  assert.equal(b.filled, 1);
  assert.equal(b.sentence, 'I ___ to school by bus.');
  const c = gradeClozeBank(it, [0, 4]);
  assert.deepEqual(c.fills, [0, null]);
  assert.equal(c.complete, false);
});

// rng de mentira: devuelve, en cada llamada a shuffle, lo que le toque de la lista `outs`.
const stubRng = (outs) => { const calls = []; return { calls, shuffle: (a) => { calls.push([...a]); return outs[Math.min(calls.length - 1, outs.length - 1)]; } }; };

test('estado: un rng que devuelve una lista corta o que no es lista lanza el error en español', () => {
  assert.throws(() => createClozeState(2, 3, { rng: stubRng([[0, 1]]) }), /permutación/);
  assert.throws(() => createClozeState(2, 3, { rng: stubRng([[0, 1, 2, 2]]) }), /permutación/);
  assert.throws(() => createClozeState(2, 3, { rng: stubRng([null]) }), /permutación/);
  assert.throws(() => createClozeState(2, 3, { rng: stubRng([undefined]) }), /permutación/);
  assert.throws(() => createClozeState(2, 3, { rng: stubRng([{ length: 3 }]) }), /permutación/);
});

test('estado: reintenta hasta 10 veces si el rng devuelve el orden original, y se detiene en la primera que cambia', () => {
  const id = [0, 1, 2, 3];
  const rev = [3, 2, 1, 0];
  const rng = stubRng([id, id, id, rev, [1, 0, 3, 2]]);
  const s = createClozeState(2, 4, { rng });
  assert.deepEqual([...s.tray], rev);
  assert.equal(rng.calls.length, 4);
  const rng2 = stubRng([rev, [1, 0, 3, 2]]);
  assert.deepEqual([...createClozeState(2, 4, { rng: rng2 }).tray], rev);
  assert.equal(rng2.calls.length, 1);
  const rng3 = stubRng([id]);
  assert.deepEqual([...createClozeState(2, 4, { rng: rng3 }).tray], [1, 2, 3, 0]);
  assert.equal(rng3.calls.length, 10);
});

test('estado: el historial y cada una de sus entradas están congelados, y guarda la ficha y el hueco de cada acción', () => {
  let s = createClozeState(3, 5, { shuffle: false });
  s = placeWord(s, 3);
  s = placeWord(s, 1, 2);
  s = removeFill(s, 0);
  assert.ok(Object.isFrozen(s.history));
  assert.ok(s.history.every((h) => Object.isFrozen(h)));
  assert.deepEqual(s.history.map((h) => ({ ...h })), [
    { type: 'place', word: 3, gap: 0 }, { type: 'place', word: 1, gap: 2 }, { type: 'remove', word: 3, gap: 0 },
  ]);
});

test('freeWords sigue el orden de la bandeja; isClozeComplete es falso hasta llenar el último hueco', () => {
  const rng = stubRng([[3, 0, 4, 1, 2]]);
  let s = createClozeState(3, 5, { rng });
  assert.deepEqual(freeWords(s), [3, 0, 4, 1, 2]);
  s = placeWord(s, 0);
  assert.deepEqual(freeWords(s), [3, 4, 1, 2]);
  assert.equal(isClozeComplete(s), false);
  s = placeWord(s, 4);
  assert.equal(isClozeComplete(s), false);
  s = placeWord(s, 2);
  assert.equal(isClozeComplete(s), true);
  assert.deepEqual(freeWords(s), [3, 1]);
});

test('reiniciar limpia el historial aunque los huecos ya estén vacíos (poner y quitar)', () => {
  let s = createClozeState(2, 3, { shuffle: false });
  s = removeFill(placeWord(s, 1), 0);
  assert.deepEqual([...s.fills], [null, null]);
  assert.equal(s.history.length, 2);
  const r = resetCloze(s);
  assert.notEqual(r, s);
  assert.equal(r.history.length, 0);
  assert.deepEqual([...r.fills], [null, null]);
});
