// @purpose: Fuzz de pantalla de la familia 2.4 (2.4-T4, punto 2): los 6 tipos montados con el registro real y DOM falso, toques al azar (también sobre botones deshabilitados y ocultos), sin excepciones, con un solo envío y sin fugas.
// Cada secuencia monta un ejercicio por `createExerciseRegistry` (como app/main.js), toca elementos al azar y comprueba después de CADA toque:
//   · ningún error llega a window ('error') y ninguna promesa queda rechazada;
//   · un toque sobre un elemento deshabilitado (atributo disabled o aria-disabled) NO cambia la pantalla ni envía nada (condición 3b del Administrador);
//   · como mucho UN envío por ejercicio (con submit que guarda), con result válido y responseRaw de texto (TRAMPA-32);
//   · tras responder, seguir tocando no envía más; tras destroy() tampoco, y los listeners vuelven a la cifra de antes de montar;
//   · en las semillas pares el envío es LENTO (queda pendiente mientras se sigue tocando) y mientras está pendiente la pantalla no cambia con ningún toque;
//   · ráfagas de 2 a 3 toques SIN esperar entre ellos (doble toque con el envío aún pendiente): sigue habiendo un solo envío;
//   · tras responder, todo botón de acción (.btn) queda deshabilitado o dentro de una zona oculta; y en las semillas múltiplo de 3 el primer envío falla (status error) y el ejercicio sigue siendo contestable (hasta 2 envíos).
// Los topes del contrato mandan: ordenar y construir llegan a 12 bloques; el diálogo a 8 líneas, emparejar a 10 parejas y el banco a 6 huecos (CA 5 de 2.4: «2 y 12 bloques» donde el tipo lo permite).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../core/rng.js';
import { createExerciseRegistry, RESULTS } from '../ui/exercises/index.js';
import { registerOrderTypes } from '../ui/exercises/orderTypes.js';
import { registerBuildTypes } from '../ui/exercises/buildTypes.js';
import { createMatchPairs } from '../ui/exercises/matchPairs.js';
import { createClozeBank } from '../ui/exercises/clozeBank.js';
import { makeEnv } from './_fakeDom.mjs';

const range = (n) => Array.from({ length: n }, (_, i) => i);
const tick = () => new Promise((r) => setTimeout(r, 0));

const ITEMS = {
  order_blocks: (n) => ({ type: 'order_blocks', prompt_es: 'Ordena la frase.', situation: 'Prueba', data: { blocks: range(n).map((i) => `bloque ${i}`) } }),
  order_dialogue: (n) => ({ type: 'order_dialogue', prompt_es: 'Ordena el diálogo.', data: { lines: range(n).map((i) => ({ speaker: i % 2 ? 'Ana' : 'Ben', text: `línea ${i}` })) } }),
  match_pairs: (n) => ({ type: 'match_pairs', prompt_es: 'Une cada palabra.', data: { pairs: range(n).map((i) => ({ left: `izq${i}`, right: `der${i}` })), extra_right: ['sobra1', 'sobra2'] } }),
  cloze_bank: (n) => ({ type: 'cloze_bank', prompt_es: 'Completa la frase.', data: { text: `${range(n).map((i) => `w${i} ___`).join(' ')} fin.`, answers: range(n).map((i) => [`a${i}`]), bank: [...range(n).map((i) => `a${i}`), 'x1', 'x2'] } }),
  unscramble_letters: (n) => ({ type: 'unscramble_letters', prompt_es: 'Forma la palabra.', data: { pieces: range(n).map((i) => String.fromCharCode(97 + i)), extra_pieces: n === 12 ? ['z', 'y', 'w', 'v'] : ['z'] } }),
  build_from_keywords: (n) => ({ type: 'build_from_keywords', prompt_es: 'Construye la frase.', data: { pieces: range(n).map((i) => `pal${i}`), extra_pieces: n === 12 ? ['x1', 'x2', 'x3', 'x4'] : ['x1'] } }),
};
const COUNTS = { order_blocks: [2, 12], order_dialogue: [2, 8], match_pairs: [2, 10], cloze_bank: [2, 6], unscramble_letters: [2, 12], build_from_keywords: [2, 12] };

function makeRegistry(rng, logs, item) {
  const reg = createExerciseRegistry({ resolveItem: async () => item, log: (...a) => logs.push(a) });
  registerOrderTypes(reg, { rng, log: (...a) => logs.push(a) });
  reg.register('match_pairs', createMatchPairs({ rng, log: (...a) => logs.push(a) }));
  reg.register('cloze_bank', createClozeBank({ rng, log: (...a) => logs.push(a) }));
  registerBuildTypes(reg, { rng, log: (...a) => logs.push(a) });
  return reg;
}

const hiddenUp = (el) => { for (let n = el; n; n = n.parentNode) if (n.hasAttribute?.('hidden')) return true; return false; };
const isOff = (el) => el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';

async function run({ type, count, seed, steps = 120 }) {
  const rng = createRng(seed * 7919 + count);
  const env = makeEnv();
  const errors = [];
  env.win.addEventListener('error', (e) => errors.push(e));
  const slot = env.doc.createElement('div');
  env.doc.body.appendChild(slot);
  slot.ownerDocument = env.doc; // el DOM falso no lo define (el navegador sí) y el registro no pasa `doc`
  const calls = [];
  const logs = [];
  const failFirst = seed % 3 === 0;
  const slow = seed % 2 === 0;
  const pending = { now: false };
  const item = { id: `fz.${type}.${count}`, ...ITEMS[type](count) };
  const reg = makeRegistry(createRng(seed), logs, item);
  const baseline = env.stats.live();
  const handle = await reg.mount(slot, { itemId: item.id, exerciseType: type }, { index: 0, total: 1, submit: async (a) => {
    calls.push(a);
    pending.now = true;
    if (slow) { await tick(); await tick(); }
    pending.now = false;
    return failFirst && calls.length === 1 ? { status: 'error', message: 'No se pudo guardar.' } : { status: 'saved' };
  } });
  assert.ok(handle, `${type}/${count}: debe montar (${logs.map((l) => l[0]).join(' | ')})`);
  const cov = { offTaps: 0, taps: 0, submits: 0, pendingTaps: 0 };

  const tap = async (el) => {
    const off = isOff(el);
    const before = slot.outerHTML;
    const n = calls.length;
    const burst = !off && rng.next() < 0.3 ? 2 + Math.floor(rng.next() * 2) : 1; // doble o triple toque sin esperar entre ellos
    const wasPending = pending.now;
    for (let k = 0; k < burst; k += 1) el.dispatchEvent({ type: 'click', preventDefault() {} });
    if (slow) await Promise.resolve(); else await tick();
    cov.taps += 1;
    if (wasPending && pending.now) {
      assert.equal(slot.outerHTML, before, `${type}/${count}/${seed}: la pantalla cambió con el envío pendiente`);
      assert.equal(calls.length, n, `${type}/${count}/${seed}: otro envío con el primero pendiente`);
      cov.pendingTaps = (cov.pendingTaps ?? 0) + 1;
    }
    if (off) {
      cov.offTaps += 1;
      assert.equal(slot.outerHTML, before, `${type}/${count}/${seed}: un toque en un elemento deshabilitado cambió la pantalla`);
      assert.equal(calls.length, n, `${type}/${count}/${seed}: un toque en un elemento deshabilitado envió una respuesta`);
    }
    assert.deepEqual(errors, [], `${type}/${count}/${seed}: error en la pantalla`);
    assert.ok(calls.length <= (failFirst ? 2 : 1), `${type}/${count}/${seed}: más envíos de los posibles (${calls.length})`);
  };

  for (let i = 0; i < steps; i += 1) {
    const els = slot.querySelectorAll('button');
    if (els.length === 0) break;
    await tap(els[Math.floor(rng.next() * els.length)]);
  }
  // Rematar: tocar todo lo que se pueda poner y luego los botones primarios (Comprobar), para llegar al envío.
  for (let round = 0; round < 3 && calls.length === 0; round += 1) {
    for (const el of slot.querySelectorAll('button')) if (!isOff(el) && el.hasAttribute('data-index')) await tap(el);
    for (const el of slot.querySelectorAll('.btn--primary')) await tap(el);
  }
  for (const el of slot.querySelectorAll('button')) await tap(el);
  for (let k = 0; k < 5; k += 1) await tick();

  const settled = calls.length > 0 && calls[calls.length - 1] && !(failFirst && calls.length === 1);
  if (settled) {
    for (const b of slot.querySelectorAll('.btn')) assert.ok(isOff(b) || hiddenUp(b), `${type}/${count}/${seed}: tras responder queda activo el botón «${b.textContent}»`);
  }
  if (calls.length >= 1) {
    cov.submits = 1;
    const a = calls[calls.length - 1];
    assert.ok(RESULTS.includes(a.result), `${type}/${count}: result inválido ${a.result}`);
    if (a.result !== 'dont_know' && a.result !== 'skipped') assert.equal(typeof a.responseRaw, 'string', `${type}/${count}: responseRaw debe ser texto`);
  }
  const resp = handle.getResponse();
  assert.ok(resp === null || typeof resp === 'string' || typeof resp === 'object', `${type}/${count}: getResponse`);

  // Cerrar y seguir tocando: nada se envía y no quedan listeners.
  const sent = calls.length;
  handle.destroy();
  handle.destroy();
  for (const el of slot.querySelectorAll('button')) el.dispatchEvent({ type: 'click', preventDefault() {} });
  await tick();
  assert.equal(calls.length, sent, `${type}/${count}/${seed}: se envió tras destroy`);
  assert.deepEqual(errors, [], `${type}/${count}/${seed}: error tras destroy`);
  assert.ok(env.stats.live() <= baseline, `${type}/${count}/${seed}: fuga de listeners (${env.stats.live()} > ${baseline})`);
  assert.equal(handle.getResponse(), null, `${type}/${count}: getResponse tras destroy`);
  return cov;
}

// FUZZ_TYPES=cloze_bank,match_pairs (opcional) limita los tipos: solo para romper por lotes (tools/mutate.mjs); sin ella corren los 6.
const ONLY = process.env.FUZZ_TYPES ? process.env.FUZZ_TYPES.split(',') : null;
for (const [type, counts] of Object.entries(COUNTS)) {
  if (ONLY && !ONLY.includes(type)) continue;
  for (const count of counts) {
    test(`fuzz de pantalla: ${type} con ${count} elementos, 25 semillas, sin excepciones, un solo envío y toques en deshabilitados sin efecto`, async () => {
      const total = { offTaps: 0, taps: 0, submits: 0, pendingTaps: 0 };
      for (let seed = 1; seed <= 25; seed += 1) {
        const cov = await run({ type, count, seed });
        for (const k of Object.keys(total)) total[k] += cov[k];
      }
      assert.ok(total.offTaps > 0, `${type}/${count}: el fuzz nunca tocó un elemento deshabilitado (cobertura vacía)`);
      assert.ok(total.pendingTaps > 0, `${type}/${count}: el fuzz nunca tocó con un envío pendiente (cobertura vacía)`);
      assert.ok(total.submits > 0, `${type}/${count}: el fuzz nunca llegó a un envío (cobertura vacía)`);
    });
  }
}
