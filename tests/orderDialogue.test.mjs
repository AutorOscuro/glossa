// @purpose: Pruebas de la lectura y calificación de order_dialogue en core/orderBlocks.js (2.4-T1, punto 6): contrato data.lines, topes, accept sin hablante y compatibilidad con order_blocks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ORDER_LIMITS, DIALOGUE_LIMITS, readOrder, gradeOrder, createOrderState } from '../core/orderBlocks.js';
import { createRng } from '../core/rng.js';

const lines = (n) => Array.from({ length: n }, (_, i) => ({ speaker: i % 2 === 0 ? 'A' : 'Ana', text: `line ${i}` }));
const dlg = (data = {}, extra = {}) => ({ id: 'g.dlg.0001', type: 'order_dialogue', prompt_es: 'Ordena el diálogo.', data: { lines: lines(3), ...data }, ...extra });

test('DIALOGUE_LIMITS: de 2 a 8 líneas y hablante de 20 caracteres, congelado', () => {
  assert.deepEqual(DIALOGUE_LIMITS, { min: 2, max: 8, speakerLength: 20 });
  assert.ok(Object.isFrozen(DIALOGUE_LIMITS));
  assert.deepEqual(ORDER_LIMITS, { min: 2, max: 12, blockLength: 200, acceptLength: 600, history: 200 });
});

test('un diálogo válido se lee: texto sin hablante para comparar y «Hablante: texto» para mostrar', () => {
  const r = readOrder(dlg({ lines: [{ speaker: 'Ana', text: 'Hi!' }, { speaker: 'Ben', text: 'Hello, Ana.' }], shuffle: false }));
  assert.deepEqual(r, {
    ok: true, blocks: ['Hi!', 'Hello, Ana.'], solution: 'Hi! Hello, Ana.', accept: ['Hi! Hello, Ana.'], shuffle: false,
    labels: ['Ana: Hi!', 'Ben: Hello, Ana.'], speakers: ['Ana', 'Ben'],
  });
});

test('los espacios de los bordes se recortan en el texto y en el hablante', () => {
  const r = readOrder(dlg({ lines: [{ speaker: '  A ', text: '  Hi  ' }, { speaker: 'B', text: ' Yo ' }] }));
  assert.deepEqual(r.labels, ['A: Hi', 'B: Yo']);
  assert.deepEqual(r.speakers, ['A', 'B']);
  assert.equal(r.solution, 'Hi Yo');
});

test('de 2 a 8 líneas: fuera de eso es bad_lines', () => {
  for (const n of [0, 1, 9, 12]) assert.deepEqual(readOrder(dlg({ lines: lines(n) })), { ok: false, reason: 'bad_lines' }, String(n));
  for (const n of [2, 8]) assert.equal(readOrder(dlg({ lines: lines(n) })).ok, true, String(n));
});

test('hablante: hasta 20 caracteres, con contenido', () => {
  const ok = (speaker) => readOrder(dlg({ lines: [{ speaker, text: 'a' }, { speaker: 'B', text: 'b' }] })).ok;
  assert.equal(ok('x'.repeat(20)), true);
  for (const bad of ['x'.repeat(21), '', '   ', null, undefined, 5, {}]) assert.equal(ok(bad), false, JSON.stringify(bad));
});

test('texto de línea: hasta 200 caracteres, con contenido', () => {
  const ok = (text) => readOrder(dlg({ lines: [{ speaker: 'A', text }, { speaker: 'B', text: 'b' }] })).ok;
  assert.equal(ok('x'.repeat(200)), true);
  for (const bad of ['x'.repeat(201), '', '  ', null, undefined, 7, []]) assert.equal(ok(bad), false, JSON.stringify(bad));
});

test('líneas que no son objetos, o lines que no es lista, son bad_lines', () => {
  for (const l of ['texto', 5, null, [], [{ speaker: 'A', text: 'a' }, 'b'], [{ speaker: 'A', text: 'a' }, null], [{ speaker: 'A', text: 'a' }, ['B', 'b']]]) {
    assert.deepEqual(readOrder(dlg({ lines: l })), { ok: false, reason: 'bad_lines' }, JSON.stringify(l));
  }
});

test('turnos seguidos del mismo hablante y textos repetidos están permitidos', () => {
  const r = readOrder(dlg({ lines: [{ speaker: 'A', text: 'Yes.' }, { speaker: 'A', text: 'Yes.' }, { speaker: 'A', text: 'Sure.' }] }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.speakers, ['A', 'A', 'A']);
});

test('con tipo order_dialogue, data.blocks no se lee; con otro tipo, data.lines no se lee', () => {
  assert.deepEqual(readOrder({ type: 'order_dialogue', data: { blocks: ['a', 'b'] } }), { ok: false, reason: 'bad_lines' });
  assert.deepEqual(readOrder({ type: 'order_blocks', data: { lines: lines(3) } }), { ok: false, reason: 'bad_blocks' });
  assert.deepEqual(readOrder({ data: { lines: lines(3) } }), { ok: false, reason: 'bad_blocks' });
});

test('un order_blocks sigue leyéndose igual y sin labels ni speakers', () => {
  const r = readOrder({ type: 'order_blocks', data: { blocks: ['a', 'b'] } });
  assert.deepEqual(Object.keys(r).sort(), ['accept', 'blocks', 'ok', 'shuffle', 'solution']);
});

test('sin data o con data que no es objeto, order_dialogue da no_data', () => {
  for (const it of [{ type: 'order_dialogue' }, { type: 'order_dialogue', data: null }, { type: 'order_dialogue', data: [] }, { type: 'order_dialogue', data: 'x' }]) {
    assert.deepEqual(readOrder(it), { ok: false, reason: 'no_data' }, JSON.stringify(it));
  }
});

test('accept se escribe con el texto de las líneas, sin hablante, y vale como orden alternativo', () => {
  const it = dlg({ lines: [{ speaker: 'A', text: 'Hi.' }, { speaker: 'B', text: 'Hello.' }, { speaker: 'A', text: 'Bye.' }] }, { accept: ['Hello. Hi. Bye.'] });
  const r = readOrder(it);
  assert.deepEqual(r.accept, ['Hi. Hello. Bye.', 'Hello. Hi. Bye.']);
  assert.equal(gradeOrder(it, [0, 1, 2]).result, 'correct');
  const alt = gradeOrder(it, [1, 0, 2]);
  assert.equal(alt.result, 'correct');
  assert.equal(alt.matched, 'Hello. Hi. Bye.');
  assert.equal(gradeOrder(it, [2, 1, 0]).result, 'wrong');
});

test('accept con el hablante escrito dentro NO vale (se escribe sin hablante)', () => {
  const it = dlg({ lines: [{ speaker: 'A', text: 'Hi.' }, { speaker: 'B', text: 'Hello.' }] }, { accept: ['B: Hello. A: Hi.'] });
  assert.equal(gradeOrder(it, [1, 0]).result, 'wrong');
});

test('accept inválido es bad_accept también en order_dialogue', () => {
  for (const accept of ['texto', 5, [''], [3], ['x'.repeat(601)]]) assert.deepEqual(readOrder(dlg({}, { accept })), { ok: false, reason: 'bad_accept' }, JSON.stringify(accept));
});

test('calificar: correcto, incorrecto con posiciones fuera de lugar, y respuestas incompletas', () => {
  const it = dlg({ lines: lines(4) });
  assert.equal(gradeOrder(it, [0, 1, 2, 3]).result, 'correct');
  const bad = gradeOrder(it, [1, 0, 2, 3]);
  assert.equal(bad.result, 'wrong');
  assert.deepEqual(bad.misplaced, [0, 1]);
  assert.equal(bad.text, 'line 1 line 0 line 2 line 3');
  const part = gradeOrder(it, [0, 1]);
  assert.equal(part.result, 'wrong');
  assert.equal(part.complete, false);
  assert.deepEqual(part.misplaced, []);
});

test('el hablante no cuenta al calificar: dos diálogos con distintos hablantes y el mismo texto califican igual', () => {
  const a = dlg({ lines: [{ speaker: 'A', text: 'one' }, { speaker: 'B', text: 'two' }] });
  const b = dlg({ lines: [{ speaker: 'Zed', text: 'one' }, { speaker: 'Zed', text: 'two' }] });
  assert.deepEqual(gradeOrder(a, [0, 1]), gradeOrder(b, [0, 1]));
});

test('gradeOrder lanza en español con un diálogo inválido', () => {
  assert.throws(() => gradeOrder(dlg({ lines: lines(1) }), [0]), /bad_lines/);
});

test('el estado de toques funciona con 2 y con 8 líneas (mismo estado que order_blocks)', () => {
  for (const n of [2, 8]) {
    const r = readOrder(dlg({ lines: lines(n) }));
    const st = createOrderState(r.blocks.length, { rng: createRng(3) });
    assert.equal(st.count, n);
    assert.notDeepEqual([...st.tray], Array.from({ length: n }, (_, i) => i));
  }
});
