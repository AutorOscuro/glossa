// @purpose: Pruebas de la validación de order_blocks y order_dialogue en core/contentData.js (2.4-T1, ampliación 1.3-2A) y del paquete de muestra.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DATA_SPECS } from '../core/contentData.js';
import { validateItem } from '../core/contentItem.js';
import { validatePack } from '../core/contentPack.js';
import { LIMITS } from '../core/contentRules.js';
import { ORDER_LIMITS, DIALOGUE_LIMITS, readOrder, gradeOrder } from '../core/orderBlocks.js';
import { loadSample } from './_samplePack.mjs';

const item = (type, data, extra = {}) => ({
  id: 'gram.pp.0001', type, topics: ['gram.present_perfect.form'], level: 'A2', prompt_es: 'x', data,
  explain_es: 'x', source: 'original', version: 1, ...extra,
});
const run = (type, data, extra) => validateItem(item(type, data, extra), { dataSpecs: DATA_SPECS });
const at = (r) => r.errors.map((e) => `${e.path}:${e.rule}`);
const blocks = (n) => Array.from({ length: n }, (_, i) => `w${i}`);
const lines = (n) => Array.from({ length: n }, (_, i) => ({ speaker: i % 2 ? 'Leo' : 'Ana', text: `Line ${i}` }));
const k = (n) => 'a'.repeat(n);

test('los topes del validador son los del núcleo (sin duplicar números)', () => {
  assert.equal(ORDER_LIMITS.acceptLength, LIMITS.text, 'accept ≤ 600 lo impone el Item común: deben coincidir');
});

// ---- order_blocks ----
test('order_blocks válido: 2 y 12 bloques; 1 y 13 no', () => {
  assert.equal(run('order_blocks', { blocks: blocks(ORDER_LIMITS.min) }).ok, true);
  assert.equal(run('order_blocks', { blocks: blocks(ORDER_LIMITS.max) }).ok, true);
  assert.deepEqual(at(run('order_blocks', { blocks: blocks(ORDER_LIMITS.min - 1) })), ['data.blocks:LIST_SIZE']);
  assert.deepEqual(at(run('order_blocks', { blocks: blocks(ORDER_LIMITS.max + 1) })), ['data.blocks:LIST_SIZE']);
});
test('order_blocks: bloque de 200 sí y de 201 no; vacío o de otro tipo no', () => {
  assert.equal(run('order_blocks', { blocks: [k(ORDER_LIMITS.blockLength), 'b'] }).ok, true);
  assert.deepEqual(at(run('order_blocks', { blocks: ['a', k(ORDER_LIMITS.blockLength + 1)] })), ['data.blocks[1]:TEXT_TOO_LONG']);
  assert.deepEqual(at(run('order_blocks', { blocks: ['a', ''] })), ['data.blocks[1]:TEXT_EMPTY']);
  assert.deepEqual(at(run('order_blocks', { blocks: ['a', '   '] })), ['data.blocks[1]:TEXT_EMPTY']);
  assert.deepEqual(at(run('order_blocks', { blocks: ['a', 5] })), ['data.blocks[1]:TYPE']);
  assert.deepEqual(at(run('order_blocks', { blocks: 'a b' })), ['data.blocks:TYPE']);
});
test('order_blocks admite bloques repetidos y shuffle booleano', () => {
  assert.equal(run('order_blocks', { blocks: ['very', 'very', 'good'], shuffle: false }).ok, true);
  assert.deepEqual(at(run('order_blocks', { blocks: ['a', 'b'], shuffle: 'si' })), ['data.shuffle:TYPE']);
});
test('order_blocks: accept opcional; 600 sí y 601 no; debe ser lista de textos', () => {
  assert.equal(run('order_blocks', { blocks: blocks(3) }, { accept: [k(ORDER_LIMITS.acceptLength)] }).ok, true);
  assert.equal(run('order_blocks', { blocks: blocks(3) }, { accept: null }).ok, true);
  assert.deepEqual(at(run('order_blocks', { blocks: blocks(3) }, { accept: [k(ORDER_LIMITS.acceptLength + 1)] })), ['accept[0]:TEXT_TOO_LONG']);
  assert.deepEqual(at(run('order_blocks', { blocks: blocks(3) }, { accept: [''] })), ['accept[0]:TEXT_EMPTY']);
  assert.deepEqual(at(run('order_blocks', { blocks: blocks(3) }, { accept: 'a b c' })), ['accept:TYPE']);
});
test('order_blocks sin blocks, o con campos de otro tipo, se rechaza con mensaje claro', () => {
  assert.deepEqual(at(run('order_blocks', {})), ['data.blocks:DATA_FIELD_REQUIRED']);
  assert.deepEqual(at(run('order_blocks', { lines: lines(2) })).sort(), ['data.blocks:DATA_FIELD_REQUIRED', 'data.lines:ORDER_ONLY']);
  assert.deepEqual(at(run('order_blocks', { blocks: blocks(2), pieces: ['a', 'b'] })), ['data.pieces:ORDER_ONLY']);
  assert.deepEqual(at(run('order_blocks', { blocks: blocks(2), extra_pieces: ['z'] })), ['data.extra_pieces:ORDER_ONLY']);
  assert.deepEqual(at(run('order_blocks', { blocks: blocks(2), lines: lines(2) })), ['data.lines:ORDER_ONLY']);
  const only = run('order_blocks', { blocks: blocks(2), pieces: ['a', 'b'] }).errors[0].message;
  assert.match(only, /data\.pieces no se usa en el tipo order_blocks: este tipo usa data\.blocks/);
  const plain = run('build_from_keywords', { pieces: ['a', 'b'], blocks: ['a', 'b'] }).errors[0].message;
  assert.match(plain, /^data\.blocks no se usa en el tipo build_from_keywords$/);
  const msg = run('order_blocks', { pieces: ['a', 'b'] }).errors.map((e) => e.message).join(' | ');
  assert.match(msg, /order_blocks/);
  assert.match(msg, /data\.blocks/);
});

// ---- order_dialogue ----
test('order_dialogue válido: 2 y 8 líneas; 1 y 9 no', () => {
  assert.equal(run('order_dialogue', { lines: lines(DIALOGUE_LIMITS.min) }).ok, true);
  assert.equal(run('order_dialogue', { lines: lines(DIALOGUE_LIMITS.max) }).ok, true);
  assert.deepEqual(at(run('order_dialogue', { lines: lines(DIALOGUE_LIMITS.min - 1) })), ['data.lines:LIST_SIZE']);
  assert.deepEqual(at(run('order_dialogue', { lines: lines(DIALOGUE_LIMITS.max + 1) })), ['data.lines:LIST_SIZE']);
});
test('order_dialogue: hablante de 20 sí y 21 no; texto de 200 sí y 201 no', () => {
  const one = (o) => [{ speaker: 'A', text: 'x', ...o }, { speaker: 'B', text: 'y' }];
  assert.equal(run('order_dialogue', { lines: one({ speaker: k(DIALOGUE_LIMITS.speakerLength) }) }).ok, true);
  assert.deepEqual(at(run('order_dialogue', { lines: one({ speaker: k(DIALOGUE_LIMITS.speakerLength + 1) }) })), ['data.lines[0].speaker:TEXT_TOO_LONG']);
  assert.equal(run('order_dialogue', { lines: one({ text: k(ORDER_LIMITS.blockLength) }) }).ok, true);
  assert.deepEqual(at(run('order_dialogue', { lines: one({ text: k(ORDER_LIMITS.blockLength + 1) }) })), ['data.lines[0].text:TEXT_TOO_LONG']);
});
test('order_dialogue: hablante o texto vacíos, ausentes o de otro tipo; línea que no es objeto o con campo extra', () => {
  const one = (o) => [{ speaker: 'A', text: 'x', ...o }, { speaker: 'B', text: 'y' }];
  assert.deepEqual(at(run('order_dialogue', { lines: one({ speaker: '' }) })), ['data.lines[0].speaker:TEXT_EMPTY']);
  assert.deepEqual(at(run('order_dialogue', { lines: one({ text: ' ' }) })), ['data.lines[0].text:TEXT_EMPTY']);
  assert.deepEqual(at(run('order_dialogue', { lines: one({ speaker: 7 }) })), ['data.lines[0].speaker:TYPE']);
  assert.deepEqual(at(run('order_dialogue', { lines: [{ text: 'x' }, { speaker: 'B', text: 'y' }] })), ['data.lines[0].speaker:REQUIRED']);
  assert.deepEqual(at(run('order_dialogue', { lines: ['A: hola', 'B: hi'] })).length, 2);
  assert.deepEqual(at(run('order_dialogue', { lines: one({ audio: 'x.mp3' }) })), ['data.lines[0].audio:UNKNOWN_FIELD']);
});
test('order_dialogue admite turnos seguidos del mismo hablante, shuffle y accept', () => {
  const same = [{ speaker: 'Ana', text: 'Hi.' }, { speaker: 'Ana', text: 'How are you?' }, { speaker: 'Leo', text: 'Fine.' }];
  assert.equal(run('order_dialogue', { lines: same, shuffle: false }, { accept: ['How are you? Hi. Fine.'] }).ok, true);
  assert.deepEqual(at(run('order_dialogue', { lines: same }, { accept: [k(ORDER_LIMITS.acceptLength + 1)] })), ['accept[0]:TEXT_TOO_LONG']);
});
test('order_dialogue sin lines, o con blocks o pieces, se rechaza', () => {
  assert.deepEqual(at(run('order_dialogue', {})), ['data.lines:DATA_FIELD_REQUIRED']);
  assert.deepEqual(at(run('order_dialogue', { blocks: blocks(2) })).sort(), ['data.blocks:ORDER_ONLY', 'data.lines:DATA_FIELD_REQUIRED']);
  assert.deepEqual(at(run('order_dialogue', { lines: lines(2), blocks: blocks(2) })), ['data.blocks:ORDER_ONLY']);
  assert.deepEqual(at(run('order_dialogue', { lines: lines(2), pieces: ['a', 'b'] })), ['data.pieces:ORDER_ONLY']);
});

// ---- compatibilidad: los demás tipos de la familia siguen con pieces ----
test('unscramble_letters, build_from_keywords y order_paragraphs siguen válidos con pieces', () => {
  for (const t of ['unscramble_letters', 'build_from_keywords', 'order_paragraphs']) {
    assert.equal(run(t, { pieces: ['a', 'b', 'c'], extra_pieces: ['z'] }, { accept: ['a b c'] }).ok, true, t);
    assert.deepEqual(at(run(t, {}, { accept: ['a'] })), ['data.pieces:DATA_FIELD_REQUIRED'], t);
    assert.deepEqual(at(run(t, { pieces: ['a', 'b'], blocks: ['a', 'b'] })), ['data.blocks:ORDER_ONLY'], t);
    assert.deepEqual(at(run(t, { pieces: ['a', 'b'], lines: lines(2) })), ['data.lines:ORDER_ONLY'], t);
    assert.deepEqual(at(run(t, { pieces: ['a', 'b'], shuffle: true })), ['data.shuffle:ORDER_ONLY'], t);
  }
});
test('los límites de pieces no cambiaron (2 a 12, ≤ 120)', () => {
  assert.deepEqual(at(run('build_from_keywords', { pieces: ['a'] })), ['data.pieces:LIST_SIZE']);
  assert.deepEqual(at(run('build_from_keywords', { pieces: blocks(13) })), ['data.pieces:LIST_SIZE']);
  assert.deepEqual(at(run('build_from_keywords', { pieces: ['a', k(121)] })), ['data.pieces[1]:TEXT_TOO_LONG']);
});
test('un ítem con data dañada no apila el error cruzado', () => {
  assert.deepEqual(at(run('order_blocks', { blocks: 5 })), ['data.blocks:TYPE']);
  assert.deepEqual(at(run('order_blocks', 'texto')), ['data:TYPE']);
});

// ---- coherencia con el núcleo ----
test('lo que el validador acepta es lo que readOrder lee (y al revés), con 300 ítems al azar', () => {
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  let valid = 0;
  let invalid = 0;
  for (let i = 0; i < 300; i += 1) {
    const dialogue = rnd() < 0.5;
    const n = rnd() < 0.8 ? 2 + Math.floor(rnd() * 11) : Math.floor(rnd() * 15); // casi siempre dentro de los topes de cantidad
    const some = (good, bad) => (rnd() < 0.97 ? pick(good) : pick(bad)); // casi siempre texto bueno
    const data = dialogue
      ? { lines: Array.from({ length: Math.min(n, 9) }, () => ({ speaker: some(['A', 'Ana', k(20)], ['', k(21)]), text: some(['hi', k(200)], ['', k(201)]) })) }
      : { blocks: Array.from({ length: n }, () => some(['a', 'b', k(200)], ['', k(201)])) };
    const extra = rnd() < 0.5 ? { accept: [pick(['a b', 'ok', k(600), k(601)])] } : {};
    const it = item(dialogue ? 'order_dialogue' : 'order_blocks', data, extra);
    const v = validateItem(it, { dataSpecs: DATA_SPECS }).ok;
    const c = readOrder(it).ok;
    assert.equal(v, c, JSON.stringify(it.data).slice(0, 120) + JSON.stringify(extra).slice(0, 40));
    if (v) valid += 1; else invalid += 1;
  }
  assert.ok(valid >= 20 && invalid >= 20, `muestra desequilibrada: ${valid} válidos, ${invalid} inválidos`);
});

// ---- paquete de muestra ----
test('el paquete de muestra pasa validatePack y trae order_blocks y order_dialogue legibles', () => {
  const pack = loadSample();
  const ids = pack.items.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
  const orders = pack.items.filter((x) => x.type === 'order_blocks' || x.type === 'order_dialogue');
  assert.deepEqual(orders.map((x) => x.type).sort(), ['order_blocks', 'order_blocks', 'order_dialogue']);
  for (const o of orders) {
    const r = readOrder(o);
    assert.equal(r.ok, true, o.id);
    const all = r.blocks.map((_, i) => i);
    assert.equal(gradeOrder(o, all).result, 'correct', `${o.id}: el orden dado es correcto`);
  }
  const alt = orders.filter((x) => Array.isArray(x.accept) && x.accept.length > 0);
  assert.equal(alt.length, 3, 'los tres llevan accept');
  const ctx = {};
  const res = validatePack(pack, ctx);
  assert.deepEqual(res.errors.filter((e) => /order|blocks|lines|pieces/.test(`${e.path}${e.rule}`)), []);
});

test('con una especificación propia de ordering (ctx.dataSpecs) no se aplican las reglas cruzadas oficiales', () => {
  const own = { ...DATA_SPECS, ordering: { kind: 'custom', fn: () => {} } };
  assert.equal(validateItem(item('order_blocks', {}), { dataSpecs: own }).ok, true);
  assert.deepEqual(at(validateItem(item('order_blocks', {}), { dataSpecs: DATA_SPECS })), ['data.blocks:DATA_FIELD_REQUIRED']);
});
