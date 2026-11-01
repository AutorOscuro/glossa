// @purpose: Fuzz de los 6 tipos de palabra y colocación (2.5-T2, punto 4): registro real y DOM falso, textos hostiles y toques al azar; un solo envío bueno, nunca vacío, responseRaw válido, hueco visible y sin fugas.
// Cada secuencia monta uno de los 7 casos (los 6 tipos y `translate_word` inverso) por `registerWordTypes` sobre `createExerciseRegistry`, como lo hace app/main.js, y hace pasos al azar:
// escribir (vacío, espacios, NBSP, ancho cero, controles, 5000 letras, emoji, árabe, respuestas buenas y erratas), «Comprobar», «No sé», «Ver pista», Enter y toques sobre botones deshabilitados.
// Después de CADA paso comprueba:
//   · ningún error llega a window; ninguna respuesta enviada es vacía; result ∈ RESULTS; responseRaw es texto de ≤ 2000 sin caracteres de control que el evento rechaza (TRAMPA-32); «No sé» no lleva responseRaw;
//   · como mucho UN envío guardado (status saved) y, si el primero falla, como mucho 2 envíos (las semillas múltiplo de 3 fallan el primero);
//   · un toque sobre un botón deshabilitado (TRAMPA-35: la guarda vive en button.js y en la fase de la pantalla) no envía nada;
//   · tras destroy() nada se envía, el nodo sale y los listeners vuelven a la cifra de antes de montar.
// En las semillas pares el envío es LENTO (queda pendiente mientras se sigue tocando).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../core/rng.js';
import { EVENT_CONTROL } from '../core/responseText.js';
import { isBlank } from '../core/textAnswer.js';
import { createExerciseRegistry, RESULTS } from '../ui/exercises/index.js';
import { registerWordTypes } from '../ui/exercises/textTypes.js';
import { makeEnv } from './_fakeDom.mjs';

const ev = (type, extra = {}) => ({ type, preventDefault() {}, ...extra });
const tick = () => new Promise((r) => setTimeout(r, 0));
const CONTROL = new RegExp(EVENT_CONTROL.source, '');

const ITEMS = {
  fill_verb: { id: 'fz.fill', type: 'fill_verb', prompt_es: 'Ella trabaja aquí.', prompt_en: 'She ___ here.', explain_es: 'Tercera persona.', grammar_note_es: 'She works.', nuance_es: 'Hecho estable.', accept: ['works', 'is working'], data: { hint: 'Verbo work' } },
  translate_word: { id: 'fz.tr', type: 'translate_word', prompt_en: 'house', accept: ['casa'], data: { mask: 'length' } },
  translate_inverse: { id: 'fz.tri', type: 'translate_word', prompt_es: 'casa', accept: ['house'] },
  first_letter: { id: 'fz.fl', type: 'first_letter', prompt_es: 'Un lugar para vivir.', accept: ['house'], data: { hint: 'Empieza por h' } },
  collocation_fill: { id: 'fz.col', type: 'collocation_fill', prompt_en: 'I ___ a decision.', prompt_es: 'Tomé una decisión.', accept: ['made', 'have made'] },
  def_to_word: { id: 'fz.def', type: 'def_to_word', prompt_en: 'A place where books are kept.', accept: ['library'] },
  derive_form: { id: 'fz.der', type: 'derive_form', prompt_en: 'happy → ___ (noun)', accept: ['happiness'] },
};
const CASE_KEYS = Object.keys(ITEMS);
const TEXTS = (rng) => [
  '', '   ', '\u00A0', '\u200B\u200C\uFEFF', 'works', ' Works ', 'is working', 'work', 'wrks', 'casa', 'cassa', 'x', '\u0001\u0002', 'wor\u0085ks', 'a\tb\nc',
  'a'.repeat(5000), 'w😀rks', 'عمل', '\u202Eworks', rng.shuffle(['it', 'is', 'working']).join(' '),
];

async function run(seed) {
  const rng = createRng(seed * 104729 + 7);
  const key = CASE_KEYS[seed % CASE_KEYS.length];
  const type = ITEMS[key].type;
  const env = makeEnv();
  const errors = [];
  env.win.addEventListener('error', (e) => errors.push(e));
  const slot = env.doc.createElement('div');
  env.doc.body.appendChild(slot);
  slot.ownerDocument = env.doc;
  const logs = [];
  const reg = createExerciseRegistry({ resolveItem: (id) => Object.values(ITEMS).find((i) => i.id === id) ?? null, log: (...a) => logs.push(a) });
  registerWordTypes(reg, { log: (...a) => logs.push(a) });
  const calls = [];
  const results = [];
  const slow = seed % 2 === 0;
  const failFirst = seed % 3 === 0;
  const baseline = env.stats.live();
  const handle = await reg.mount(slot, { itemId: ITEMS[key].id, exerciseType: type }, { index: 0, total: 1, submit: async (a) => {
    calls.push(a);
    if (slow) { await tick(); await tick(); }
    const r = failFirst && calls.length === 1 ? { status: 'error', message: 'No se pudo guardar.' } : { status: 'saved' };
    results.push(r.status);
    return r;
  } });
  assert.ok(handle, `seed ${seed}: debe montar (${logs.map((l) => l[0]).join(' | ')})`);

  const texts = [...TEXTS(rng), ...ITEMS[key].accept];
  const hasGap = ITEMS[key].prompt_en?.includes('___') === true;
  assert.equal(slot.querySelectorAll('.ta__gap').length > 0, hasGap, `seed ${seed}: el hueco ${hasGap ? 'falta' : 'sobra'}`);
  assert.ok(slot.querySelectorAll('.ta__instruction').length === 1, `seed ${seed}: falta la instrucción`);
  const buttons = () => slot.querySelectorAll('button');
  const input = () => slot.querySelectorAll('input')[0];
  let destroyed = false;
  let offTaps = 0;
  let retries = 0;
  for (let step = 0; step < 80; step += 1) {
    const before = calls.length;
    const kind = rng.int(0, 6);
    if (kind <= 1 && input()) { const i = input(); i.value = rng.pick(texts); i.dispatchEvent(ev('input')); }
    else if (kind === 2 && input()) input().dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault() {} });
    else if (kind <= 5) {
      const list = buttons();
      if (list.length) {
        const b = rng.pick(list);
        const off = b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true';
        const n = rng.int(1, 3); // ráfaga sin esperar
        for (let k = 0; k < n; k += 1) b.dispatchEvent(ev('click'));
        if (off) { offTaps += 1; assert.equal(calls.length, before, `seed ${seed} paso ${step}: un botón deshabilitado envió`); }
      }
    } else await tick();
    if (!destroyed && step === 70 && rng.next() < 0.4) { handle.destroy(); handle.destroy(); destroyed = true; }
    if (destroyed) assert.equal(calls.length, before, `seed ${seed}: tras destroy no se envía`);
    await env.flush();
    assert.equal(errors.length, 0, `seed ${seed} paso ${step}: error en window ${errors[0]?.message ?? ''}`);
    for (const a of calls) {
      assert.ok(RESULTS.includes(a.result), `seed ${seed}: result ${a.result}`);
      if (a.result === 'dont_know') assert.equal(a.responseRaw, undefined);
      else {
        assert.equal(typeof a.responseRaw, 'string');
        assert.ok(a.responseRaw.length <= 2000 && !CONTROL.test(a.responseRaw), `seed ${seed}: responseRaw inválido`);
        assert.equal(isBlank(a.responseRaw), false, `seed ${seed}: se envió una respuesta vacía`);
      }
    }
    assert.ok(results.filter((s) => s === 'saved').length <= 1, `seed ${seed}: más de un envío guardado`);
    assert.ok(calls.length <= (failFirst ? 2 : 1), `seed ${seed}: demasiados envíos (${calls.length})`);
  }
  await tick(); await tick(); await env.flush();
  if (!destroyed && results.includes('saved')) {
    // Tras un envío guardado la pantalla queda cerrada: ni el campo ni los botones aceptan más.
    for (const el of [...buttons(), input()]) assert.ok(el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true', `seed ${seed}: queda un control activo tras guardar`);
  }
  if (!destroyed && failFirst && results.length === 1 && results[0] === 'error') {
    // Tras un fallo de guardado se puede reintentar: el campo y «Comprobar» siguen vivos.
    input().value = ITEMS[key].accept[0];
    input().dispatchEvent(ev('input'));
    buttons().find((b) => b.textContent.includes('Comprobar')).dispatchEvent(ev('click'));
    await tick(); await tick(); await env.flush();
    assert.equal(calls.length, 2, `seed ${seed}: no se pudo reintentar tras el fallo`);
    retries += 1;
  }
  if (failFirst && results[0] === 'error' && results[1] === 'saved') retries += 1; // el propio fuzz ya reintentó
  if (!destroyed) handle.destroy();
  handle.destroy();
  assert.equal(slot.querySelectorAll('.ta').length, 0, `seed ${seed}: el nodo sigue montado`);
  assert.equal(env.stats.live(), baseline, `seed ${seed}: fuga de listeners`);
  return { submits: calls.length, offTaps, retries };
}

test('fuzz de palabra y colocación: 84 secuencias (12 por caso), un solo envío bueno, nunca vacío, responseRaw válido y sin fugas', async () => {
  let submits = 0;
  let offTaps = 0;
  let retries = 0;
  for (let seed = 1; seed <= 84; seed += 1) {
    const r = await run(seed);
    submits += r.submits;
    offTaps += r.offTaps;
    retries += r.retries;
  }
  assert.ok(submits >= 20, `el fuzz debe llegar a enviar (envíos: ${submits})`);
  assert.ok(retries >= 3, `el fuzz debe probar reintentos (${retries})`);
  assert.ok(offTaps >= 20, `el fuzz debe tocar deshabilitados (toques: ${offTaps})`);
});
