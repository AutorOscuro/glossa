// @purpose: Garantía de 2.4-T4 (respuesta 5 del Administrador): en ordenar, emparejar, banco y construir el estado «bien/mal» nunca depende solo del color: toda marca lleva ✓ o ✗ en su nombre accesible o en su texto, y hay una línea de texto que lo dice.
// Monta cada componente con el registro real y DOM falso, provoca un orden mezclado (las dos últimas piezas cambiadas) y mira TODOS los elementos marcados (--ok, --off, is-done, is-miss).
// Los colores y bordes de las marcas se miden en Chromium (tools/build-check.py y los otros *-check.py); aquí se comprueba el texto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../core/rng.js';
import { createExerciseRegistry } from '../ui/exercises/index.js';
import { registerOrderTypes } from '../ui/exercises/orderTypes.js';
import { registerBuildTypes } from '../ui/exercises/buildTypes.js';
import { createMatchPairs } from '../ui/exercises/matchPairs.js';
import { createClozeBank } from '../ui/exercises/clozeBank.js';
import { makeEnv } from './_fakeDom.mjs';

const tick = () => new Promise((r) => setTimeout(r, 0));
const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });
const range = (n) => Array.from({ length: n }, (_, i) => i);
const has = (el, cls) => el.classList.contains(cls);
const nameOf = (el) => `${el.getAttribute('aria-label') ?? ''} ${el.textContent ?? ''}`;

const ITEMS = {
  order_blocks: { type: 'order_blocks', prompt_es: 'Ordena.', data: { blocks: range(5).map((i) => `bloque ${i}`) } },
  order_dialogue: { type: 'order_dialogue', prompt_es: 'Ordena.', data: { lines: range(4).map((i) => ({ speaker: i % 2 ? 'Ana' : 'Ben', text: `línea ${i}` })) } },
  build_from_keywords: { type: 'build_from_keywords', prompt_es: 'Construye.', data: { pieces: range(5).map((i) => `pal${i}`), extra_pieces: ['x1'] } },
  unscramble_letters: { type: 'unscramble_letters', prompt_es: 'Forma.', data: { pieces: ['a', 'b', 'c', 'd', 'e'], extra_pieces: ['z'] } },
  cloze_bank: { type: 'cloze_bank', prompt_es: 'Completa.', data: { text: 'uno ___ dos ___ tres ___ cuatro ___ fin.', answers: [['r0'], ['r1'], ['r2'], ['r3']], bank: ['r0', 'r1', 'r2', 'r3', 'x1'] } },
  match_pairs: { type: 'match_pairs', prompt_es: 'Une.', data: { pairs: range(4).map((i) => ({ left: `izq${i}`, right: `der${i}` })), extra_right: ['sobra'] } },
};
// Texto de cada pieza en el orden correcto, y el selector de la bandeja.
const ORDER = {
  order_blocks: { words: range(5).map((i) => `bloque ${i}`), tray: '.ob__tray button' },
  order_dialogue: { words: range(4).map((i) => `línea ${i}`), tray: '.ob__tray button', contains: true },
  build_from_keywords: { words: range(5).map((i) => `pal${i}`), tray: '.bp__tray button' },
  unscramble_letters: { words: ['a', 'b', 'c', 'd', 'e'], tray: '.bp__tray button' },
  cloze_bank: { words: ['r0', 'r1', 'r2', 'r3'], tray: '.cb__tray button' },
};

async function mount(type) {
  const env = makeEnv();
  const slot = env.doc.createElement('div');
  env.doc.body.appendChild(slot);
  slot.ownerDocument = env.doc;
  const calls = [];
  const item = { id: `nc.${type}`, ...ITEMS[type] };
  const reg = createExerciseRegistry({ resolveItem: async () => item, log: () => {} });
  const rng = createRng(11);
  registerOrderTypes(reg, { rng });
  reg.register('match_pairs', createMatchPairs({ rng }));
  reg.register('cloze_bank', createClozeBank({ rng }));
  registerBuildTypes(reg, { rng });
  const handle = await reg.mount(slot, { itemId: item.id, exerciseType: type }, { index: 0, total: 1, submit: async (a) => { calls.push(a); return { status: 'saved' }; } });
  assert.ok(handle, `${type}: debe montar`);
  return { slot, calls, handle };
}

const trayButton = (slot, sel, word, contains) => [...slot.querySelectorAll(sel)].find((b) => !(b.getAttribute('aria-disabled') === 'true') && (contains ? (b.textContent ?? '').includes(word) : (b.textContent ?? '').trim() === word));

// Marcas de todo el árbol: [elemento, clase] → el texto que debe llevar.
function marked(slot) {
  const out = [];
  const walk = (el) => {
    const cls = String(el.getAttribute?.('class') ?? '').split(/\s+/);
    if (cls.some((c) => c.endsWith('--ok')) || cls.includes('is-done')) out.push({ el, want: '✓', kind: 'ok' });
    if (cls.some((c) => c.endsWith('--off')) || cls.includes('is-miss')) out.push({ el, want: '✗', kind: 'off' });
    for (const k of el.children) walk(k);
  };
  walk(slot);
  return out;
}

for (const type of Object.keys(ORDER)) {
  test(`${type}: con el orden mezclado, cada marca ✓/✗ lleva texto (no solo color) y hay una línea de texto con el resumen`, async () => {
    const { slot, calls } = await mount(type);
    const { words, tray, contains } = ORDER[type];
    const seq = [...words.slice(0, -2), words[words.length - 1], words[words.length - 2]]; // las dos últimas cambiadas
    for (const w of seq) {
      const b = trayButton(slot, tray, w, contains);
      assert.ok(b, `${type}: no encuentro «${w}» en la bandeja`);
      click(b);
    }
    click([...slot.querySelectorAll('.btn--primary')].find((b) => /Comprobar/.test(b.textContent)));
    await tick(); await tick();
    assert.equal(calls.length, 1, `${type}: debía enviarse una respuesta`);
    assert.equal(calls[0].result, 'wrong', `${type}: el orden mezclado debe ser wrong`);
    const marks = marked(slot);
    assert.ok(marks.some((m) => m.kind === 'ok'), `${type}: debe haber marcas de acierto (cobertura vacía)`);
    assert.ok(marks.some((m) => m.kind === 'off'), `${type}: debe haber marcas de fallo (cobertura vacía)`);
    for (const m of marks) assert.ok(nameOf(m.el).includes(m.want), `${type}: una marca ${m.kind} no lleva «${m.want}» en su texto ni en su nombre accesible: «${nameOf(m.el).trim()}»`);
    const text = slot.textContent ?? '';
    assert.ok(/✗|Fuera de lugar|No encaja|Sobra/.test(text), `${type}: ninguna línea de texto dice qué quedó mal`);
  });
}

test('match_pairs: pareja resuelta lleva «✓» y pareja fallida «✗» en su nombre accesible, y el aviso de texto lo dice', async () => {
  const { slot } = await mount('match_pairs');
  const card = (side, text) => [...slot.querySelectorAll('.ma__card--' + side)].find((b) => (b.textContent ?? '').trim().startsWith(text));
  click(card('left', 'izq0')); click(card('right', 'der0'));      // acierto
  click(card('left', 'izq1')); click(card('right', 'der2'));      // fallo
  const marks = marked(slot);
  assert.ok(marks.some((m) => m.kind === 'ok'), 'debe haber una pareja resuelta');
  assert.ok(marks.some((m) => m.kind === 'off'), 'debe haber una pareja fallida');
  for (const m of marks) assert.ok(nameOf(m.el).includes(m.want), `marca ${m.kind} sin «${m.want}»: «${nameOf(m.el).trim()}»`);
  assert.ok((slot.textContent ?? '').includes('✗'), 'el aviso de texto de la pareja fallida debe llevar ✗');
});
