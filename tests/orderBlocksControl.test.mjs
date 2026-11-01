// @purpose: Prueba del FIX de order_blocks (2.4-T1, cierre): responseRaw nunca trae un carácter de control que el evento rechace (barrido 0–0x9F).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOrderBlocks } from '../ui/exercises/orderBlocks.js';
import { validateEvent } from '../core/eventSchema.js';
import { makeEvent } from './_helpers.mjs';
import { makeEnv } from './_fakeDom.mjs';

const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });

async function answerWith(middle) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  const it = { id: 'x', type: 'order_blocks', prompt_es: 'Ordena.', data: { blocks: ['I', middle, 'go'], shuffle: false } };
  const comp = createOrderBlocks({ log: () => {} }).mount(root, it, { doc: env.doc, submit: async (a) => { calls.push(a); return { status: 'saved' }; } });
  for (const b of root.querySelectorAll('.ob__tray .ob__block')) click(b);
  const before = comp.getResponse();
  click(root.querySelectorAll('button').find((b) => b.textContent.trim() === 'Comprobar'));
  await env.flush();
  return { calls, before, comp };
}
// id y day los asigna events.log(): no se envían (TRAMPA-28).
const asEvent = (a) => { const e = makeEvent({ responseRaw: a.responseRaw, result: a.result, rating: 1 }); delete e.id; delete e.day; return e; };

test('responseRaw nunca trae un carácter que el evento rechace (se barren los códigos 0 a 0x9F)', async () => {
  for (let code = 0; code <= 0x9f; code += 1) {
    const { calls } = await answerWith(`a${String.fromCharCode(code)}b`);
    assert.equal(calls.length, 1, `U+${code.toString(16)}: debe haber un envío`);
    const v = validateEvent(asEvent(calls[0]));
    assert.equal(v.ok, true, `U+${code.toString(16).padStart(4, '0')} deja responseRaw inválido: ${JSON.stringify(v.problems)}`);
  }
});

test('getResponse (antes y después de comprobar) tampoco trae caracteres que el evento rechace', async () => {
  for (const code of [0x07, 0x7f, 0x80, 0x85, 0x9f]) {
    const { before, comp } = await answerWith(`a${String.fromCharCode(code)}b`);
    for (const r of [before, comp.getResponse()]) {
      assert.equal(validateEvent(asEvent({ responseRaw: r, result: 'correct' })).ok, true, `U+${code.toString(16)}`);
    }
  }
});

test('un control se cambia por espacio; un texto normal pasa sin cambios', async () => {
  assert.equal((await answerWith('a\u0085b')).calls[0].responseRaw, 'I a b go');
  assert.equal((await answerWith('want to')).calls[0].responseRaw, 'I want to go');
});
