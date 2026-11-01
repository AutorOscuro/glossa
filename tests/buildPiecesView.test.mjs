// @purpose: Pruebas del componente de construir con piezas (ui/exercises/buildPieces.js, 2.4-T3 punto 3) con DOM falso: toques, deshacer, reiniciar, envío, corrección, piezas de más, errores de envío y casos límite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBuildPieces, BP_TEXT } from '../ui/exercises/buildPieces.js';
import { createRng } from '../core/rng.js';
import { makeEnv } from './_fakeDom.mjs';

const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });
const off = (el) => el.getAttribute('disabled') !== null && el.getAttribute('disabled') !== undefined || el.getAttribute('aria-disabled') === 'true';
const has = (el, name) => el.getAttribute(name) !== null && el.getAttribute(name) !== undefined;

const word = (data = {}, extra = {}) => ({ id: 'g.unl.0001', type: 'unscramble_letters', prompt_es: 'Ordena las letras.', situation: 'Animales', data: { pieces: ['c', 'a', 't'], ...data }, ...extra });
const sent = (data = {}, extra = {}) => ({ id: 'g.bfk.0001', type: 'build_from_keywords', prompt_es: 'Construye la frase.', data: { pieces: ['I', 'have', 'eaten'], extra_pieces: ['has'], ...data }, ...extra });
const many = (n) => Array.from({ length: n }, (_, i) => `p${i}`);

function setup({ it = word(), factory = {}, submit } = {}) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  const logs = [];
  const sub = async (a) => { calls.push(a); return submit ? submit(a) : { status: 'saved' }; };
  const comp = createBuildPieces({ rng: createRng(7), log: (...a) => logs.push(a), ...factory }).mount(root, it, { doc: env.doc, submit: sub });
  const tray = () => root.querySelectorAll('.bp__tray .bp__piece');
  const pieceAt = (index) => tray().find((b) => b.dataset.index === String(index));
  const placed = () => root.querySelectorAll('.bp__line .bp__piece--placed');
  const placedTexts = () => placed().map((b) => b.textContent);
  const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.trim() === label);
  const put = (...idx) => { for (const i of idx) click(pieceAt(i)); };
  return { env, root, comp, calls, logs, tray, pieceAt, placed, placedTexts, btn, put };
}
const marks = (root) => root.querySelectorAll('.bp__piece--ok').length + root.querySelectorAll('.bp__piece--off').length;
const tick = () => new Promise((r) => setTimeout(r, 0));

test('monta con la situación, el enunciado, todas las piezas (también las de más) y «No sé» a la vista', () => {
  const s = setup({ it: sent() });
  assert.deepEqual(s.tray().map((b) => b.textContent).sort(), ['I', 'eaten', 'has', 'have']);
  assert.ok(s.btn(BP_TEXT.dontKnow));
  assert.ok(s.btn(BP_TEXT.check));
  assert.equal(s.root.querySelector('.bp__situation'), null);
  assert.equal(s.root.querySelector('.bp__prompt').textContent, 'Construye la frase.');
  assert.equal(s.root.querySelector('.bp__instruction').textContent, BP_TEXT.instructionWords);
  assert.equal(setup().root.querySelector('.bp__instruction').textContent, BP_TEXT.instructionLetters);
  assert.ok(setup().root.querySelector('.bp__situation').textContent.includes('Animales'));
});

test('sin situación no hay párrafo de situación', () => {
  const s = setup({ it: word({}, { situation: '   ' }) });
  assert.equal(s.root.querySelector('.bp__situation'), null);
});

test('la bandeja no queda en el orden del contenido', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const s = setup({ factory: { rng: createRng(seed) } });
    assert.notDeepEqual(s.tray().map((b) => b.textContent), ['c', 'a', 't'], `semilla ${seed}`);
  }
});

test('shuffle:false deja el orden del contenido', () => {
  const s = setup({ it: word({ shuffle: false }) });
  assert.deepEqual(s.tray().map((b) => b.textContent), ['c', 'a', 't']);
});

test('tocar una pieza la coloca al final; la bandeja no cambia de sitio y la pieza queda marcada', () => {
  const s = setup();
  const before = s.tray().map((b) => b.dataset.index);
  s.put(2, 0);
  assert.deepEqual(s.placedTexts(), ['t', 'c']);
  assert.deepEqual(s.tray().map((b) => b.dataset.index), before);
  assert.ok(s.pieceAt(2).classList.contains('is-used'));
  assert.equal(s.pieceAt(2).getAttribute('aria-disabled'), 'true');
  assert.equal(s.pieceAt(2).getAttribute('aria-label'), BP_TEXT.usedName('t'));
  assert.equal(s.pieceAt(1).getAttribute('aria-label'), 'a');
  assert.equal(has(s.pieceAt(1), 'aria-disabled'), false);
});

test('doble toque en la misma pieza no la duplica', () => {
  const s = setup();
  s.put(1);
  click(s.pieceAt(1));
  click(s.pieceAt(1));
  assert.deepEqual(s.placedTexts(), ['a']);
});

test('tocar una pieza colocada la quita y las siguientes se corren', () => {
  const s = setup();
  s.put(0, 1, 2);
  click(s.placed()[1]);
  assert.deepEqual(s.placedTexts(), ['c', 't']);
  assert.equal(has(s.pieceAt(1), 'aria-disabled'), false);
});

test('la pieza colocada tiene nombre con su posición', () => {
  const s = setup();
  s.put(0, 1);
  assert.equal(s.placed()[1].getAttribute('aria-label'), BP_TEXT.placedName(2, 'a'));
});

test('deshacer y empezar de nuevo', () => {
  const s = setup();
  assert.ok(off(s.btn(BP_TEXT.undo)));
  assert.ok(off(s.btn(BP_TEXT.reset)));
  s.put(0, 1);
  assert.ok(!off(s.btn(BP_TEXT.undo)));
  click(s.btn(BP_TEXT.undo));
  assert.deepEqual(s.placedTexts(), ['c']);
  click(s.btn(BP_TEXT.undo));
  assert.deepEqual(s.placedTexts(), []);
  assert.ok(off(s.btn(BP_TEXT.undo)));
  s.put(0, 1, 2);
  click(s.btn(BP_TEXT.reset));
  assert.deepEqual(s.placedTexts(), []);
  assert.ok(off(s.btn(BP_TEXT.reset)));
});

test('el texto de «aquí aparece» se oculta al colocar y vuelve al vaciar', () => {
  const s = setup();
  const empty = s.root.querySelector('.bp__empty');
  assert.equal(has(empty, 'hidden'), false);
  s.put(0);
  assert.equal(has(empty, 'hidden'), true);
  click(s.btn(BP_TEXT.reset));
  assert.equal(has(empty, 'hidden'), false);
});

test('«Comprobar» con menos piezas de las de la respuesta no envía y avisa; el aviso se quita al tocar', async () => {
  const s = setup();
  s.put(0, 1);
  click(s.btn(BP_TEXT.check));
  await tick();
  assert.equal(s.calls.length, 0);
  assert.equal(s.root.querySelector('.bp__msg').textContent, BP_TEXT.incomplete);
  s.put(2);
  assert.equal(s.root.querySelector('.bp__msg').textContent, '');
});

test('palabra correcta: envía un solo `correct` con la palabra y quita las acciones', async () => {
  const s = setup();
  s.put(0, 1, 2);
  click(s.btn(BP_TEXT.check));
  await tick();
  assert.deepEqual(s.calls, [{ result: 'correct', hint: false, responseRaw: 'cat', errorCodes: [] }]);
  assert.equal(s.root.querySelector('.fb__verdict').textContent, BP_TEXT.correct);
  assert.equal(s.root.querySelector('.bp__correct'), null);
  assert.equal(has(s.root.querySelector('.bp__actions'), 'hidden'), true);
  click(s.pieceAt(0));
  click(s.btn(BP_TEXT.check));
  await tick();
  assert.equal(s.calls.length, 1);
});

test('palabra incorrecta: `wrong`, marca las piezas fuera de lugar con texto y muestra la palabra correcta', async () => {
  const s = setup();
  s.put(2, 1, 0);
  click(s.btn(BP_TEXT.check));
  await tick();
  assert.equal(s.calls[0].result, 'wrong');
  assert.equal(s.calls[0].responseRaw, 'tac');
  assert.equal(s.root.querySelector('.fb__verdict').textContent, BP_TEXT.wrongLetters);
  assert.equal(s.root.querySelector('.bp__correct').textContent, 'cat');
  const p = s.placed();
  assert.ok(p[0].classList.contains('bp__piece--off'));
  assert.ok(p[1].classList.contains('bp__piece--ok'));
  assert.ok(p[2].classList.contains('bp__piece--off'));
  assert.ok(p[0].getAttribute('aria-label').endsWith(BP_TEXT.flagOff));
  assert.ok(p[1].getAttribute('aria-label').endsWith(BP_TEXT.flagOk));
  assert.equal(s.root.querySelector('.bp__misplaced').textContent, BP_TEXT.misplaced('1, 3'));
});

test('frase: se une con espacios; un orden válido de accept es correcto', async () => {
  const s = setup({ it: sent({}, { accept: ['have I eaten'] }) });
  const idx = (t) => s.tray().find((b) => b.textContent === t).dataset.index;
  s.put(idx('have'), idx('I'), idx('eaten'));
  click(s.btn(BP_TEXT.check));
  await tick();
  assert.deepEqual(s.calls, [{ result: 'correct', hint: false, responseRaw: 'have I eaten', errorCodes: [] }]);
});

test('usar una pieza de más: `wrong`, la marca con «Sobra» y lista cuál sobra', async () => {
  const s = setup({ it: sent() });
  const idx = (t) => s.tray().find((b) => b.textContent === t).dataset.index;
  s.put(idx('I'), idx('has'), idx('eaten'));
  click(s.btn(BP_TEXT.check));
  await tick();
  assert.equal(s.calls[0].result, 'wrong');
  assert.equal(s.root.querySelector('.bp__correct').textContent, 'I have eaten');
  assert.ok(s.placed()[1].classList.contains('bp__piece--off'));
  assert.ok(s.placed()[1].getAttribute('aria-label').endsWith(BP_TEXT.flagExtra));
  assert.equal(s.root.querySelector('.bp__misplaced').textContent, BP_TEXT.extraUsed('has'));
  assert.equal(s.root.querySelectorAll('.bp__piece--ok').length, 0);
});

test('«No sé»: envía `dont_know`, muestra la respuesta y no marca piezas', async () => {
  const s = setup();
  s.put(2, 1);
  click(s.btn(BP_TEXT.dontKnow));
  await tick();
  assert.deepEqual(s.calls, [{ result: 'dont_know', dontKnow: true, hint: false }]);
  assert.equal(s.root.querySelector('.fb__verdict').textContent, BP_TEXT.dontLetters);
  assert.equal(s.root.querySelector('.bp__correct').textContent, 'cat');
  assert.equal(s.root.querySelectorAll('.bp__piece--off').length, 0);
  assert.equal(s.root.querySelector('.bp__misplaced'), null);
  assert.equal(s.comp.getResponse(), null);
});

test('«No sé» en una frase usa el texto de frase', async () => {
  const s = setup({ it: sent() });
  click(s.btn(BP_TEXT.dontKnow));
  await tick();
  assert.equal(s.root.querySelector('.fb__verdict').textContent, BP_TEXT.dontWords);
});

test('error de envío: se desbloquea, avisa y se puede reintentar sin perder lo puesto', async () => {
  let n = 0;
  const s = setup({ submit: () => (n++ === 0 ? { status: 'error' } : { status: 'saved' }) });
  s.put(0, 1, 2);
  click(s.btn(BP_TEXT.check));
  await tick();
  assert.equal(s.root.querySelector('.bp__msg').textContent, BP_TEXT.saveFail);
  assert.deepEqual(s.placedTexts(), ['c', 'a', 't']);
  assert.ok(!off(s.btn(BP_TEXT.check)));
  click(s.btn(BP_TEXT.check));
  await tick();
  assert.equal(s.calls.length, 2);
  assert.equal(s.root.querySelector('.fb__verdict').textContent, BP_TEXT.correct);
  assert.equal(s.root.querySelector('.bp__msg').textContent, '');
});

test('un mensaje de error del envío se muestra tal cual', async () => {
  const s = setup({ submit: () => ({ status: 'error', message: 'Sin espacio' }) });
  click(s.btn(BP_TEXT.dontKnow));
  await tick();
  assert.equal(s.root.querySelector('.bp__msg').textContent, 'Sin espacio');
  for (const message of [7, '', null, {}]) {
    const t = setup({ submit: () => ({ status: 'error', message }) });
    click(t.btn(BP_TEXT.dontKnow));
    await tick();
    assert.equal(t.root.querySelector('.bp__msg').textContent, BP_TEXT.saveFail);
  }
});

test('si submit lanza, cuenta como error de envío', async () => {
  const s = setup({ submit: () => { throw new Error('x'); } });
  click(s.btn(BP_TEXT.dontKnow));
  await tick();
  assert.equal(s.root.querySelector('.bp__msg').textContent, BP_TEXT.saveFail);
});

test('mientras se envía no se toca nada y no se envía dos veces', async () => {
  let release;
  const s = setup({ submit: () => new Promise((r) => { release = r; }) });
  s.put(0, 1, 2);
  click(s.btn(BP_TEXT.check));
  click(s.btn(BP_TEXT.check));
  click(s.btn(BP_TEXT.dontKnow));
  click(s.pieceAt(0));
  click(s.placed()[0]);
  click(s.btn(BP_TEXT.undo));
  click(s.btn(BP_TEXT.reset));
  assert.equal(s.calls.length, 1);
  assert.equal(s.placed().length, 3);
  assert.equal(s.root.querySelector('.bp').classList.contains('is-locked'), true);
  release({ status: 'saved' });
  await tick();
  assert.equal(s.root.querySelector('.fb__verdict') !== null, true);
});

test('con `ignored` no pinta corrección', async () => {
  const s = setup({ submit: () => ({ status: 'ignored' }) });
  click(s.btn(BP_TEXT.dontKnow));
  await tick();
  assert.equal(s.root.querySelector('.fb__verdict'), null);
});

test('sin ctx.submit no lanza y no pinta corrección', async () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const comp = createBuildPieces({ rng: createRng(1) }).mount(root, word(), { doc: env.doc });
  click(root.querySelectorAll('button').find((b) => b.textContent.trim() === BP_TEXT.dontKnow));
  await tick();
  assert.equal(root.querySelector('.fb__verdict'), null);
  comp.destroy();
});

test('destruir a mitad de un envío no pinta nada ni lanza', async () => {
  let release;
  const s = setup({ submit: () => new Promise((r) => { release = r; }) });
  click(s.btn(BP_TEXT.dontKnow));
  s.comp.destroy();
  release({ status: 'saved' });
  await tick();
  assert.equal(s.logs.length, 0);
  s.comp.destroy();
});

test('destruir quita el elemento y deja de escuchar', () => {
  const s = setup();
  const piece = s.pieceAt(0);
  s.comp.destroy();
  assert.equal(s.root.querySelector('.bp'), null);
  click(piece);
  assert.equal(s.placed().length, 0);
});

test('getResponse: la palabra a medias mientras se responde; null si no hay nada; lo enviado después', async () => {
  const s = setup();
  assert.equal(s.comp.getResponse(), null);
  s.put(0, 1);
  assert.equal(s.comp.getResponse(), 'ca');
  s.put(2);
  click(s.btn(BP_TEXT.check));
  await tick();
  assert.equal(s.comp.getResponse(), 'cat');
});

test('getResponse de una frase une con espacios', () => {
  const s = setup({ it: sent({ shuffle: false }) });
  s.put(0, 1);
  assert.equal(s.comp.getResponse(), 'I have');
});

test('el responseRaw no lleva controles que el evento rechaza (TRAMPA-32)', async () => {
  const s = setup({ it: sent({ pieces: ['a\u0085b', 'c\u0090d'], extra_pieces: [] }) });
  s.put(0, 1);
  click(s.btn(BP_TEXT.dontKnow));
  const t = setup({ it: sent({ pieces: ['a\u0085b', 'c\u0090d'], extra_pieces: [] }) });
  t.put(0, 1);
  assert.equal(/[\u0080-\u009F]/.test(t.comp.getResponse()), false);
  click(t.btn(BP_TEXT.check));
  await tick();
  assert.equal(/[\u0080-\u009F]/.test(t.calls[0].responseRaw), false);
});

test('el texto de las piezas entra como texto, nunca como HTML', () => {
  const s = setup({ it: sent({ pieces: ['<b>x</b>', '<i>y</i>'], extra_pieces: [] }) });
  assert.equal(s.root.querySelectorAll('b').length, 0);
  assert.ok(s.tray().some((b) => b.textContent === '<b>x</b>'));
});

test('2 piezas y 16 (12 + 4 de más) montan y se pueden colocar todas', () => {
  const small = setup({ it: sent({ pieces: ['yes', 'no'], extra_pieces: [] }) });
  small.put(0, 1);
  assert.equal(small.placed().length, 2);
  const big = setup({ it: sent({ pieces: many(12), extra_pieces: many(4).map((x) => `${x}x`) }) });
  assert.equal(big.tray().length, 16);
  big.put(...Array.from({ length: 16 }, (_, i) => i));
  assert.equal(big.placed().length, 16);
});

test('dos piezas con el mismo texto se tratan por separado', async () => {
  const s = setup({ it: word({ pieces: ['a', 'b', 'a'], shuffle: false }) });
  s.put(2, 1, 0);
  click(s.btn(BP_TEXT.check));
  await tick();
  assert.equal(s.calls[0].result, 'correct');
});

test('un ítem inválido o mal montado lanza TypeError en español', () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  const mk = (it, c = root) => () => createBuildPieces({ rng: createRng(1) }).mount(c, it, { doc: env.doc });
  assert.throws(mk(null), /build_pieces: el ítem no tiene tipo/);
  assert.throws(mk(word({ pieces: ['a'] })), /bad_pieces/);
  assert.throws(mk(word({}, { prompt_es: ' ' })), /falta prompt_es/);
  assert.throws(mk(word(), null), /falta el contenedor/);
  assert.throws(mk({ ...word(), type: 'order_blocks' }), /bad_type/);
});

test('opciones inválidas lanzan TypeError', () => {
  assert.throws(() => createBuildPieces({ rng: {} }), /rng debe tener/);
  assert.throws(() => createBuildPieces({ lang: 'ingles' }), /lang debe ser/);
  assert.doesNotThrow(() => createBuildPieces(null));
  assert.doesNotThrow(() => createBuildPieces([]));
});

test('lang se aplica a las piezas y a la respuesta correcta', async () => {
  const s = setup({ factory: { lang: 'fr' } });
  assert.equal(s.pieceAt(0).getAttribute('lang'), 'fr');
  click(s.btn(BP_TEXT.dontKnow));
  await tick();
  assert.equal(s.root.querySelector('.bp__correct strong').getAttribute('lang'), 'fr');
});

test('si pintar la corrección falla, se registra y la respuesta ya estaba guardada', async () => {
  const s = setup();
  s.put(0, 1, 2);
  const line = s.root.querySelector('.bp__feedback');
  line.replaceChildren = () => { throw new Error('boom'); };
  click(s.btn(BP_TEXT.check));
  await tick();
  assert.equal(s.calls.length, 1);
  assert.equal(s.logs.length, 1);
});

test('fuzz: 150 secuencias de toques al azar sin excepciones, sin repetidos y con la bandeja fija', async () => {
  for (let seed = 1; seed <= 150; seed += 1) {
    const r = createRng(seed);
    const n = r.int(2, 12);
    const e = r.int(0, 4);
    const s = setup({ it: sent({ pieces: many(n), extra_pieces: many(e).map((x) => `${x}x`) }), factory: { rng: createRng(seed) } });
    const tray = s.tray().map((b) => b.dataset.index);
    for (let step = 0; step < 40; step += 1) {
      const roll = r.int(0, 5);
      if (roll === 0) click(s.pieceAt(r.int(0, n + e - 1)));
      else if (roll === 1 && s.placed().length) click(s.placed()[r.int(0, s.placed().length - 1)]);
      else if (roll === 2) click(s.btn(BP_TEXT.undo));
      else if (roll === 3) click(s.btn(BP_TEXT.reset));
      else click(s.pieceAt(r.int(0, n + e - 1)));
      const ids = s.placed().map((b) => b.dataset.index);
      assert.equal(new Set(ids).size, ids.length);
      assert.deepEqual(s.tray().map((b) => b.dataset.index), tray);
    }
    click(s.btn(BP_TEXT.dontKnow));
    await tick();
    assert.equal(s.calls.length, 1);
  }
});

// ---- rondas de roturas (2.4-T3 punto 3) ----
test('por defecto las piezas llevan lang «en»', () => {
  assert.equal(setup().pieceAt(0).getAttribute('lang'), 'en');
});

test('el rng de las opciones manda en el barajado (misma semilla, misma bandeja)', async () => {
  const { createBuildState } = await import('../core/buildPieces.js');
  const it = word({ pieces: many(8) });
  const expected = [...createBuildState(it, { rng: createRng(33) }).tray].map(String);
  const s = setup({ it, factory: { rng: createRng(33) } });
  assert.deepEqual(s.tray().map((b) => b.dataset.index), expected);
});

test('sin rng usa el del sistema y monta', () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const comp = createBuildPieces().mount(root, word(), { doc: env.doc });
  assert.equal(root.querySelectorAll('.bp__tray .bp__piece').length, 3);
  comp.destroy();
});

test('los errores de montaje son TypeError con el prefijo del componente', () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  const mk = (it) => () => createBuildPieces({ rng: createRng(1) }).mount(root, it, { doc: env.doc });
  assert.throws(mk({ ...word(), type: '' }), (e) => e instanceof TypeError && /build_pieces: el ítem no tiene tipo/.test(e.message));
  assert.throws(mk({ ...word(), type: 7 }), /el ítem no tiene tipo/);
  assert.throws(mk(word({ pieces: ['a'] })), (e) => e instanceof TypeError && /build_pieces: el ítem de construir no es válido \(bad_pieces\)/.test(e.message));
  assert.throws(mk({ ...word(), prompt_es: 5 }), /falta prompt_es/);
});

test('las piezas se muestran recortadas y la situación lleva su etiqueta', () => {
  const s = setup({ it: sent({ pieces: ['  I ', ' have'], extra_pieces: [] }) });
  assert.deepEqual(s.tray().map((b) => b.textContent).sort(), ['I', 'have']);
  s.put(0);
  assert.equal(s.placed()[0].textContent, 'I');
  assert.equal(setup().root.querySelector('.bp__situation').textContent, `${BP_TEXT.situation}: Animales`);
});

test('la pieza colocada lleva el lang del componente', () => {
  const s = setup({ factory: { lang: 'fr' } });
  s.put(0);
  assert.equal(s.placed()[0].getAttribute('lang'), 'fr');
});

test('el texto «aquí aparece» lleva la marca is-hidden al colocar', () => {
  const s = setup();
  const empty = s.root.querySelector('.bp__empty');
  assert.equal(empty.classList.contains('is-hidden'), false);
  s.put(0);
  assert.equal(empty.classList.contains('is-hidden'), true);
});

test('un toque que no cambia nada no borra el aviso', () => {
  const s = setup();
  s.put(0);
  click(s.btn(BP_TEXT.check));
  assert.equal(s.root.querySelector('.bp__msg').textContent, BP_TEXT.incomplete);
  click(s.pieceAt(0));
  assert.equal(s.root.querySelector('.bp__msg').textContent, BP_TEXT.incomplete);
  click(s.btn(BP_TEXT.undo));
  assert.equal(s.root.querySelector('.bp__msg').textContent, '');
});

test('tras colocar, el foco pasa a la siguiente pieza libre; un toque inútil no mueve el foco', () => {
  const s = setup();
  let focused = null;
  for (const b of s.tray()) b.focus = () => { focused = b; };
  click(s.pieceAt(0));
  assert.ok(focused);
  assert.notEqual(focused, s.pieceAt(0));
  assert.equal(focused.getAttribute('aria-disabled'), null);
  focused = null;
  click(s.pieceAt(0));
  assert.equal(focused, null);
});

test('mientras se envía todo queda bloqueado: piezas, deshacer, reiniciar, «Comprobar» y «No sé»', async () => {
  let release;
  const s = setup({ it: word({ shuffle: false }), submit: () => new Promise((r) => { release = r; }) });
  s.put(0, 1, 2);
  click(s.btn(BP_TEXT.check));
  for (const b of [...s.tray(), ...s.placed()]) assert.equal(b.getAttribute('aria-disabled'), 'true');
  for (const l of [BP_TEXT.undo, BP_TEXT.reset, BP_TEXT.check, BP_TEXT.dontKnow]) assert.ok(off(s.btn(l)), l);
  release({ status: 'saved' });
  await tick();
});

test('tras un error de envío se desbloquea todo: piezas libres, deshacer y reiniciar', async () => {
  const s = setup({ it: word({ shuffle: false }), submit: () => ({ status: 'error' }) });
  s.put(0);
  click(s.btn(BP_TEXT.dontKnow));
  await tick();
  assert.equal(s.root.querySelector('.bp').classList.contains('is-locked'), false);
  assert.equal(s.pieceAt(0).getAttribute('aria-disabled'), 'true'); // sigue usada
  assert.equal(s.pieceAt(1).getAttribute('aria-disabled'), null);
  assert.equal(s.placed()[0].getAttribute('aria-disabled'), null);
  for (const l of [BP_TEXT.undo, BP_TEXT.reset, BP_TEXT.check, BP_TEXT.dontKnow]) assert.ok(!off(s.btn(l)), l);
});

test('el aviso de error se quita al volver a enviar, antes de la respuesta', async () => {
  let n = 0;
  let release;
  const s = setup({ submit: () => (n++ === 0 ? { status: 'error' } : new Promise((r) => { release = r; })) });
  s.put(0, 1, 2);
  click(s.btn(BP_TEXT.check));
  await tick();
  assert.equal(s.root.querySelector('.bp__msg').textContent, BP_TEXT.saveFail);
  click(s.btn(BP_TEXT.check));
  assert.equal(s.root.querySelector('.bp__msg').textContent, '');
  release({ status: 'saved' });
  await tick();
  n = 0;
  const t = setup({ submit: () => (n++ === 0 ? { status: 'error' } : new Promise((r) => { release = r; })) });
  click(t.btn(BP_TEXT.dontKnow));
  await tick();
  assert.equal(t.root.querySelector('.bp__msg').textContent, BP_TEXT.saveFail);
  click(t.btn(BP_TEXT.dontKnow));
  assert.equal(t.root.querySelector('.bp__msg').textContent, '');
  release({ status: 'saved' });
  await tick();
});

test('al corregir: el veredicto de «No sé» lleva su propia clase y los aciertos no llevan marcas', async () => {
  const s = setup();
  s.put(0);
  click(s.btn(BP_TEXT.dontKnow));
  await tick();
  assert.ok(s.root.querySelector('.fb__verdict').classList.contains('fb__verdict--dont'));
  assert.equal(marks(s.root), 0);
  const t = setup();
  t.put(0, 1, 2);
  click(t.btn(BP_TEXT.check));
  await tick();
  assert.ok(t.root.querySelector('.fb__verdict').classList.contains('fb__verdict--correct'));
  assert.equal(marks(t.root), 0);
  assert.ok(t.placed()[0].getAttribute('aria-label').startsWith('Posición 1'));
  assert.ok(!t.placed()[0].getAttribute('aria-label').includes('✓'));
});

test('con todas las piezas de la respuesta y una de más: solo la de más se marca; nada va «en su lugar»', async () => {
  const s = setup({ it: sent({ shuffle: false }) });
  s.put(0, 3, 1, 2); // I, has, have, eaten
  click(s.btn(BP_TEXT.check));
  await tick();
  assert.equal(s.calls[0].result, 'wrong');
  assert.deepEqual(s.placed().map((b) => b.classList.contains('bp__piece--off')), [false, true, false, false]);
  assert.equal(s.root.querySelectorAll('.bp__piece--ok').length, 0);
  assert.equal(s.root.querySelector('.bp__misplaced').textContent, BP_TEXT.extraUsed('has'));
  assert.equal(s.root.querySelectorAll('.bp__misplaced').length, 1);
});

test('un orden válido de accept que usa una pieza de más cuenta como correcto y no marca nada', async () => {
  const s = setup({ it: sent({ shuffle: false }, { accept: ['I has eaten'] }) });
  s.put(0, 3, 2);
  click(s.btn(BP_TEXT.check));
  await tick();
  assert.equal(s.calls[0].result, 'correct');
  assert.equal(marks(s.root), 0);
  assert.equal(s.root.querySelector('.bp__misplaced'), null);
});

test('sin ctx.submit no hay aviso de error ni corrección', async () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  createBuildPieces({ rng: createRng(1) }).mount(root, word(), { doc: env.doc });
  click(root.querySelectorAll('button').find((b) => b.textContent.trim() === BP_TEXT.dontKnow));
  await tick();
  assert.equal(root.querySelector('.bp__msg').textContent, '');
});

test('destruir a mitad de un envío que luego falla no deja avisos en el elemento viejo', async () => {
  let release;
  const s = setup({ submit: () => new Promise((r) => { release = r; }) });
  click(s.btn(BP_TEXT.dontKnow));
  const el = s.comp.el;
  s.comp.destroy();
  release({ status: 'error' });
  await tick();
  assert.equal(el.querySelector('.bp__msg').textContent, '');
  assert.equal(el.classList.contains('is-locked'), true);
});

test('«No sé» tras un envío fallido de «Comprobar»: la respuesta guardada queda en null', async () => {
  let n = 0;
  const s = setup({ submit: () => (n++ === 0 ? { status: 'error' } : { status: 'saved' }) });
  s.put(2, 1, 0);
  click(s.btn(BP_TEXT.check));
  await tick();
  assert.equal(s.comp.getResponse(), 'tac'); // vuelve a responder: se lee lo puesto
  click(s.btn(BP_TEXT.dontKnow));
  await tick();
  assert.equal(s.comp.getResponse(), null);
});

test('destruir deja de escuchar las piezas y los botones', () => {
  const s = setup({ it: word({ shuffle: false }) });
  const el = s.comp.el;
  const piece = s.pieceAt(0);
  const buttons = el.querySelectorAll('button').filter((b) => !b.classList.contains('bp__piece'));
  s.put(0, 1, 2);
  const line = el.querySelectorAll('.bp__piece--placed');
  s.comp.destroy();
  click(piece);
  click(line[0]);
  for (const b of buttons) click(b);
  assert.equal(s.calls.length, 0);
  assert.equal(el.querySelectorAll('.bp__piece--placed').length, 3);
});
