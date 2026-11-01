// @purpose: Pruebas del componente de huecos con banco (ui/exercises/clozeBank.js, 2.4-T2 punto 5b) con DOM falso: toques, deshacer, reiniciar, envío, corrección por hueco, errores de envío y casos límite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClozeBank, CB_TEXT } from '../ui/exercises/clozeBank.js';
import { createRng } from '../core/rng.js';
import { makeEnv } from './_fakeDom.mjs';

const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });
const has = (el, name) => el.getAttribute(name) !== null && el.getAttribute(name) !== undefined;

const item = (data = {}, extra = {}) => ({
  id: 'g.cb.0001', type: 'cloze_bank', prompt_es: 'Completa la frase.', situation: 'En el colegio',
  data: { text: 'I ___ to school ___ bus.', answers: [['go'], ['by']], bank: ['go', 'by', 'at', 'goes'], ...data },
  ...extra,
});

function setup({ it = item(), factory = {}, submit } = {}) {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const calls = [];
  const logs = [];
  const sub = async (a) => { calls.push(a); return submit ? submit(a) : { status: 'saved' }; };
  const comp = createClozeBank({ rng: createRng(7), log: (...a) => logs.push(a), ...factory }).mount(root, it, { doc: env.doc, submit: sub });
  const tray = () => root.querySelectorAll('.cb__tray .cb__word');
  const word = (t) => tray().find((b) => b.textContent === t);
  const gaps = () => root.querySelectorAll('.cb__gap');
  const gapTexts = () => gaps().map((g) => g.textContent);
  const btn = (label) => root.querySelectorAll('button').find((b) => b.textContent.trim() === label);
  const put = (...texts) => { for (const t of texts) click(word(t)); };
  return { env, root, comp, calls, logs, tray, word, gaps, gapTexts, btn, put };
}
const E = CB_TEXT.gapEmpty;

test('monta la frase con sus huecos, la bandeja con todas las palabras y «No sé» a la vista', () => {
  const s = setup();
  assert.equal(s.gaps().length, 2);
  assert.deepEqual(s.gapTexts(), [E, E]);
  assert.deepEqual(s.root.querySelectorAll('.cb__part').map((p) => p.textContent), ['I ', ' to school ', ' bus.']);
  assert.deepEqual(s.tray().map((b) => b.textContent).sort(), ['at', 'by', 'go', 'goes']);
  assert.ok(s.btn(CB_TEXT.dontKnow));
  assert.ok(s.btn(CB_TEXT.check));
  assert.ok(s.root.querySelector('.cb__situation').textContent.includes('En el colegio'));
  assert.equal(s.root.querySelector('.cb__prompt').textContent, 'Completa la frase.');
});

test('una frase que empieza o termina en hueco no deja trozos vacíos', () => {
  const s = setup({ it: item({ text: '___ I ___', answers: [['go'], ['by']] }) });
  assert.deepEqual(s.root.querySelectorAll('.cb__part').map((p) => p.textContent), [' I ']);
  assert.equal(s.gaps().length, 2);
});

test('la bandeja no queda en el orden del contenido', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const s = setup({ factory: { rng: createRng(seed) } });
    assert.notDeepEqual(s.tray().map((b) => b.textContent), ['go', 'by', 'at', 'goes'], `semilla ${seed}`);
  }
});

test('tocar una palabra la pone en el primer hueco libre; la bandeja no cambia de sitio', () => {
  const s = setup();
  const before = s.tray().map((b) => b.textContent);
  s.put('by');
  assert.deepEqual(s.gapTexts(), ['by', E]);
  assert.deepEqual(s.tray().map((b) => b.textContent), before);
  assert.equal(s.word('by').getAttribute('aria-disabled'), 'true');
  assert.ok(s.word('by').classList.contains('is-used'));
  assert.equal(s.word('by').getAttribute('aria-label'), CB_TEXT.usedName('by'));
  assert.equal(s.word('go').getAttribute('aria-label'), CB_TEXT.trayName('go'));
  assert.ok(s.gaps()[0].classList.contains('is-filled'));
  assert.ok(!s.gaps()[1].classList.contains('is-filled'));
});

test('una palabra ya puesta no se pone dos veces y con todos los huecos llenos no se pone ninguna', () => {
  const s = setup();
  s.put('go', 'go');
  assert.deepEqual(s.gapTexts(), ['go', E]);
  s.put('by', 'at');
  assert.deepEqual(s.gapTexts(), ['go', 'by']);
  assert.equal(s.word('at').getAttribute('aria-disabled'), null);
});

test('dos palabras iguales del banco son dos fichas distintas', () => {
  const s = setup({ it: item({ text: '___ the ___ idea.', answers: [['The', 'A'], ['the']], bank: ['the', 'the', 'a'] }) });
  const the = s.tray().filter((b) => b.textContent === 'the');
  assert.equal(the.length, 2);
  click(the[0]);
  assert.equal(the[0].getAttribute('aria-disabled'), 'true');
  assert.equal(the[1].getAttribute('aria-disabled'), null);
  click(the[1]);
  assert.deepEqual(s.gapTexts(), ['the', 'the']);
});

test('tocar un hueco lleno quita su palabra y queda libre; un hueco vacío no hace nada', () => {
  const s = setup();
  click(s.gaps()[1]);
  assert.deepEqual(s.gapTexts(), [E, E]);
  s.put('go', 'by');
  click(s.gaps()[0]);
  assert.deepEqual(s.gapTexts(), [E, 'by']);
  assert.equal(s.word('go').getAttribute('aria-disabled'), null);
  s.put('at');
  assert.deepEqual(s.gapTexts(), ['at', 'by']);
});

test('los huecos llevan nombre accesible: vacío o con su palabra y cómo quitarla', () => {
  const s = setup();
  assert.equal(s.gaps()[0].getAttribute('aria-label'), CB_TEXT.gapEmptyName(1));
  assert.equal(s.gaps()[0].getAttribute('aria-disabled'), 'true');
  s.put('go');
  assert.equal(s.gaps()[0].getAttribute('aria-label'), CB_TEXT.gapFilledName(1, 'go'));
  assert.equal(s.gaps()[0].getAttribute('aria-disabled'), null);
  assert.equal(s.gaps()[1].getAttribute('aria-label'), CB_TEXT.gapEmptyName(2));
});

test('deshacer vuelve un paso (también tras quitar) y empezar de nuevo vacía los huecos', () => {
  const s = setup();
  s.put('go', 'by');
  click(s.btn(CB_TEXT.undo));
  assert.deepEqual(s.gapTexts(), ['go', E]);
  click(s.gaps()[0]);
  assert.deepEqual(s.gapTexts(), [E, E]);
  click(s.btn(CB_TEXT.undo));
  assert.deepEqual(s.gapTexts(), ['go', E]);
  s.put('by');
  click(s.btn(CB_TEXT.reset));
  assert.deepEqual(s.gapTexts(), [E, E]);
  assert.equal(s.tray().filter((b) => b.getAttribute('aria-disabled')).length, 0);
});

test('deshacer y empezar de nuevo están desactivados sin nada que deshacer y se activan al poner', () => {
  const s = setup();
  assert.ok(has(s.btn(CB_TEXT.undo), 'disabled'));
  assert.ok(has(s.btn(CB_TEXT.reset), 'disabled'));
  s.put('go');
  assert.ok(!has(s.btn(CB_TEXT.undo), 'disabled'));
  assert.ok(!has(s.btn(CB_TEXT.reset), 'disabled'));
  click(s.btn(CB_TEXT.undo));
  assert.ok(has(s.btn(CB_TEXT.undo), 'disabled'));
  assert.ok(has(s.btn(CB_TEXT.reset), 'disabled'));
  s.put('go');
  click(s.gaps()[0]);
  assert.ok(!has(s.btn(CB_TEXT.undo), 'disabled'));
  assert.ok(has(s.btn(CB_TEXT.reset), 'disabled'));
});

test('el foco pasa a la siguiente palabra libre de la bandeja', () => {
  const s = setup();
  let focused = null;
  for (const b of s.tray()) b.focus = () => { focused = b; };
  const first = s.tray()[0];
  click(first);
  assert.ok(focused);
  assert.notEqual(focused, first);
  assert.equal(focused.getAttribute('aria-disabled'), null);
});

test('comprobar con huecos vacíos no envía y avisa; el aviso se va al tocar algo', async () => {
  const s = setup();
  s.put('go');
  click(s.btn(CB_TEXT.check));
  await s.env.flush();
  assert.equal(s.calls.length, 0);
  assert.equal(s.root.querySelector('.cb__msg').textContent, CB_TEXT.incomplete);
  s.put('by');
  assert.equal(s.root.querySelector('.cb__msg').textContent, '');
});

test('comprobar bien envía correct con la frase armada y felicita', async () => {
  const s = setup();
  s.put('go', 'by');
  click(s.btn(CB_TEXT.check));
  await s.env.flush();
  assert.deepEqual(s.calls, [{ result: 'correct', hint: false, responseRaw: 'I go to school by bus.', errorCodes: [] }]);
  assert.equal(s.root.querySelector('.fb__verdict').textContent, CB_TEXT.correct);
  assert.ok(s.root.querySelector('.fb__verdict').classList.contains('fb__verdict--correct'));
  assert.equal(s.root.querySelector('.cb__correct'), null);
  assert.equal(s.root.querySelector('.cb__review'), null);
  assert.ok(has(s.root.querySelector('.cb__actions'), 'hidden'));
  assert.ok(!s.root.querySelector('.cb__gap--off'));
});

test('comprobar mal envía wrong, marca cada hueco con ✓ o ✗ y muestra la frase correcta', async () => {
  const s = setup();
  s.put('by', 'at');
  click(s.btn(CB_TEXT.check));
  await s.env.flush();
  assert.deepEqual(s.calls, [{ result: 'wrong', hint: false, responseRaw: 'I by to school at bus.', errorCodes: [] }]);
  const [g1, g2] = s.gaps();
  assert.equal(g1.textContent, 'by ✗');
  assert.equal(g2.textContent, 'at ✗');
  assert.ok(g1.classList.contains('cb__gap--off') && g2.classList.contains('cb__gap--off'));
  assert.equal(g1.getAttribute('aria-label'), CB_TEXT.gapDoneName(1, 'by', CB_TEXT.flagOff));
  assert.equal(s.root.querySelector('.fb__verdict').textContent, CB_TEXT.wrong);
  assert.equal(s.root.querySelector('.cb__correct').textContent, 'I go to school by bus.');
  assert.equal(s.root.querySelector('.cb__review').textContent, CB_TEXT.review('1, 2'));
});

test('con un solo hueco mal, el otro lleva ✓ y la revisión nombra solo el mal puesto', async () => {
  const s = setup();
  s.put('go', 'at');
  click(s.btn(CB_TEXT.check));
  await s.env.flush();
  const [g1, g2] = s.gaps();
  assert.equal(g1.textContent, 'go ✓');
  assert.ok(g1.classList.contains('cb__gap--ok') && !g1.classList.contains('cb__gap--off'));
  assert.equal(g1.getAttribute('aria-label'), CB_TEXT.gapDoneName(1, 'go', CB_TEXT.flagOk));
  assert.equal(g2.textContent, 'at ✗');
  assert.ok(g2.classList.contains('cb__gap--off') && !g2.classList.contains('cb__gap--ok'));
  assert.equal(s.root.querySelector('.cb__review').textContent, CB_TEXT.review('2'));
});

test('la corrección usa la primera respuesta válida de cada hueco y cualquiera de las válidas cuenta', async () => {
  const s = setup({ it: item({ text: 'She ___ tea ___ coffee.', answers: [['likes', 'loves'], ['and', 'or']], bank: ['loves', 'or', 'like', 'but'] }) });
  s.put('loves', 'or');
  click(s.btn(CB_TEXT.check));
  await s.env.flush();
  assert.equal(s.calls[0].result, 'correct');
  const w = setup({ it: item({ text: 'She ___ tea ___ coffee.', answers: [['likes', 'loves'], ['and', 'or']], bank: ['loves', 'or', 'like', 'but'] }) });
  w.put('like', 'but');
  click(w.btn(CB_TEXT.check));
  await w.env.flush();
  assert.equal(w.root.querySelector('.cb__correct').textContent, 'She likes tea and coffee.');
});

test('«No sé» envía dont_know, muestra la frase correcta y no marca huecos, aunque haya palabras puestas', async () => {
  const s = setup();
  s.put('at');
  click(s.btn(CB_TEXT.dontKnow));
  await s.env.flush();
  assert.deepEqual(s.calls, [{ result: 'dont_know', dontKnow: true, hint: false }]);
  assert.equal(s.root.querySelector('.fb__verdict').textContent, CB_TEXT.dont);
  assert.ok(s.root.querySelector('.fb__verdict').classList.contains('fb__verdict--dont'));
  assert.equal(s.root.querySelector('.cb__correct').textContent, 'I go to school by bus.');
  assert.equal(s.root.querySelector('.cb__review'), null);
  assert.deepEqual(s.gapTexts(), ['at', E]);
  assert.ok(!s.root.querySelector('.cb__gap--off') && !s.root.querySelector('.cb__gap--ok'));
});

test('un error de envío desbloquea, avisa y deja enviar otra vez con lo mismo', async () => {
  let n = 0;
  const s = setup({ submit: () => (++n === 1 ? { status: 'error' } : { status: 'saved' }) });
  s.put('go', 'by');
  click(s.btn(CB_TEXT.check));
  await s.env.flush();
  assert.equal(s.root.querySelector('.cb__msg').textContent, CB_TEXT.saveFail);
  assert.equal(s.root.querySelector('.cb__feedback').children.length, 0);
  assert.ok(!has(s.btn(CB_TEXT.check), 'disabled'));
  assert.deepEqual(s.gapTexts(), ['go', 'by']);
  click(s.btn(CB_TEXT.check));
  await s.env.flush();
  assert.equal(s.calls.length, 2);
  assert.deepEqual(s.calls[1], s.calls[0]);
  assert.equal(s.root.querySelector('.fb__verdict').textContent, CB_TEXT.correct);
  assert.equal(s.root.querySelector('.cb__msg').textContent, '');
});

test('un submit que lanza cuenta como error, y el aviso propio del envío manda sobre el genérico', async () => {
  const s = setup({ submit: () => { throw new Error('red'); } });
  s.put('go', 'by');
  click(s.btn(CB_TEXT.check));
  await s.env.flush();
  assert.equal(s.root.querySelector('.cb__msg').textContent, CB_TEXT.saveFail);
  const t = setup({ submit: () => ({ status: 'error', message: 'Sin conexión.' }) });
  t.put('go', 'by');
  click(t.btn(CB_TEXT.check));
  await t.env.flush();
  assert.equal(t.root.querySelector('.cb__msg').textContent, 'Sin conexión.');
});

test('un envío ignorado no pinta corrección y deja el ejercicio cerrado', async () => {
  const s = setup({ submit: () => ({ status: 'ignored' }) });
  s.put('go', 'by');
  click(s.btn(CB_TEXT.check));
  await s.env.flush();
  assert.equal(s.root.querySelector('.fb__verdict'), null);
  click(s.gaps()[0]);
  assert.deepEqual(s.gapTexts(), ['go', 'by']);
});

test('sin ctx.submit el ejercicio no falla y queda cerrado sin corrección', async () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  createClozeBank({ rng: createRng(1) }).mount(root, item(), { doc: env.doc });
  const put = (t) => click(root.querySelectorAll('.cb__tray .cb__word').find((b) => b.textContent === t));
  put('go'); put('by');
  click(root.querySelectorAll('button').find((b) => b.textContent.trim() === CB_TEXT.check));
  await env.flush();
  assert.equal(root.querySelector('.fb__verdict'), null);
});

test('mientras se envía no se toca nada y comprobar dos veces envía una sola', async () => {
  let release;
  const s = setup({ submit: () => new Promise((r) => { release = r; }) });
  s.put('go', 'by');
  click(s.btn(CB_TEXT.check));
  click(s.btn(CB_TEXT.check));
  click(s.btn(CB_TEXT.dontKnow));
  click(s.gaps()[0]);
  click(s.btn(CB_TEXT.undo));
  click(s.btn(CB_TEXT.reset));
  assert.equal(s.calls.length, 1);
  assert.deepEqual(s.gapTexts(), ['go', 'by']);
  assert.ok(s.root.querySelector('.cb').classList.contains('is-locked'));
  assert.ok(has(s.btn(CB_TEXT.check), 'disabled') && has(s.btn(CB_TEXT.dontKnow), 'disabled'));
  assert.ok(has(s.btn(CB_TEXT.undo), 'disabled') && has(s.btn(CB_TEXT.reset), 'disabled'));
  assert.ok(s.tray().every((b) => b.getAttribute('aria-disabled') === 'true'));
  assert.ok(s.gaps().every((g) => g.getAttribute('aria-disabled') === 'true'));
  release({ status: 'saved' });
  await s.env.flush();
  assert.ok(!s.root.querySelector('.cb').classList.contains('is-locked'));
  assert.equal(s.calls.length, 1);
});

test('tras la corrección ya no se puede tocar nada', async () => {
  const s = setup();
  s.put('at', 'by');
  click(s.btn(CB_TEXT.check));
  await s.env.flush();
  const before = s.gapTexts();
  click(s.gaps()[0]);
  click(s.word('go'));
  click(s.btn(CB_TEXT.undo));
  click(s.btn(CB_TEXT.check));
  click(s.btn(CB_TEXT.dontKnow));
  assert.deepEqual(s.gapTexts(), before);
  assert.equal(s.calls.length, 1);
  assert.ok(s.tray().every((b) => b.getAttribute('aria-disabled') === 'true'));
});

test('getResponse: null sin nada, la frase a medias mientras se responde y lo enviado después', async () => {
  const s = setup();
  assert.equal(s.comp.getResponse(), null);
  s.put('go');
  assert.equal(s.comp.getResponse(), `I go to school ${E} bus.`);
  s.put('by');
  assert.equal(s.comp.getResponse(), 'I go to school by bus.');
  click(s.gaps()[0]);
  click(s.gaps()[1]);
  assert.equal(s.comp.getResponse(), null);
  s.put('at', 'by');
  click(s.btn(CB_TEXT.check));
  await s.env.flush();
  assert.equal(s.comp.getResponse(), 'I at to school by bus.');
  const d = setup();
  d.put('go');
  click(d.btn(CB_TEXT.dontKnow));
  await d.env.flush();
  assert.equal(d.comp.getResponse(), null);
});

test('el texto del contenido entra como texto, nunca como HTML', () => {
  const s = setup({ it: item({ text: 'Say ___ now.', answers: [['<b>hi</b>']], bank: ['<b>hi</b>', '<img src=x>'] }, { prompt_es: '<i>Completa</i>', situation: '<u>sit</u>' }) });
  assert.equal(s.root.querySelectorAll('b').length + s.root.querySelectorAll('img').length + s.root.querySelectorAll('i').length + s.root.querySelectorAll('u').length, 0);
  assert.equal(s.root.querySelector('.cb__prompt').textContent, '<i>Completa</i>');
  assert.ok(s.tray().some((b) => b.textContent === '<img src=x>'));
});

test('el responseRaw cambia los controles que el evento rechaza por espacios y no pasa de 2000', async () => {
  const s = setup({ it: item({ text: 'A ___ B', answers: [['x\u0085y']], bank: ['x\u0085y', 'z'] }) });
  s.put('x\u0085y');
  assert.equal(s.comp.getResponse(), 'A x y B');
  click(s.btn(CB_TEXT.check));
  await s.env.flush();
  assert.equal(s.calls[0].responseRaw, 'A x y B');
  const long = setup({ it: item({ text: `${'a'.repeat(2100)} ___`, answers: [['go']], bank: ['go', 'by'] }) });
  long.put('go');
  click(long.btn(CB_TEXT.check));
  await long.env.flush();
  assert.equal(long.calls[0].responseRaw.length, 2000);
});

test('un fallo al pintar la corrección se registra y la respuesta ya estaba enviada', async () => {
  const s = setup();
  s.put('go', 'by');
  s.root.querySelector('.cb__feedback').replaceChildren = () => { throw new Error('boom'); };
  click(s.btn(CB_TEXT.check));
  await s.env.flush();
  assert.equal(s.calls.length, 1);
  assert.equal(s.logs.length, 1);
});

test('destroy retira el componente, es idempotente y no responde tarde', async () => {
  let release;
  const s = setup({ submit: () => new Promise((r) => { release = r; }) });
  s.put('go', 'by');
  click(s.btn(CB_TEXT.check));
  s.comp.destroy();
  s.comp.destroy();
  release({ status: 'saved' });
  await s.env.flush();
  assert.equal(s.root.querySelector('.cb'), null);
  assert.equal(s.logs.length, 0);
});

test('un destroy a mitad de un envío con error no desbloquea ni escribe aviso', async () => {
  let release;
  const s = setup({ submit: () => new Promise((r) => { release = r; }) });
  s.put('go', 'by');
  const msg = s.root.querySelector('.cb__msg');
  click(s.btn(CB_TEXT.check));
  s.comp.destroy();
  release({ status: 'error' });
  await s.env.flush();
  assert.equal(msg.textContent, '');
});

test('opciones y datos inválidos lanzan en español', () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  const mount = (it, f) => createClozeBank({ rng: createRng(1), ...f }).mount(root, it, { doc: env.doc });
  assert.throws(() => mount(item({ bank: undefined })), /bad_bank/);
  assert.throws(() => mount(item({ bank: ['go', 'at', 'goes'], answers: [['go'], ['by']] })), /unsolvable/);
  assert.throws(() => mount(item({ text: 'sin hueco' })), /bad_text/);
  assert.throws(() => mount({ ...item(), data: null }), /no_data/);
  assert.throws(() => mount(item({}, { prompt_es: '' })), /prompt_es/);
  assert.throws(() => mount(item({}, { prompt_es: '  ' })), /prompt_es/);
  assert.throws(() => mount({ prompt_es: 'x', data: item().data }), /tipo/);
  assert.throws(() => createClozeBank({ rng: {} }), /rng/);
  assert.throws(() => createClozeBank({ rng: null }), /rng/);
  assert.throws(() => createClozeBank({ lang: 'inglés' }), /lang/);
  assert.throws(() => createClozeBank().mount(null, item()), /contenedor/);
  assert.doesNotThrow(() => createClozeBank(null));
  assert.doesNotThrow(() => createClozeBank([]));
  assert.doesNotThrow(() => createClozeBank({ lang: 'es' }));
});

test('la frase y las palabras llevan el idioma elegido (por defecto en) y el enunciado va en es', () => {
  const s = setup();
  assert.ok(s.gaps().every((g) => g.getAttribute('lang') === 'en'));
  assert.ok(s.tray().every((b) => b.getAttribute('lang') === 'en'));
  assert.ok(s.root.querySelectorAll('.cb__part').every((p) => p.getAttribute('lang') === 'en'));
  assert.equal(s.root.querySelector('.cb__prompt').getAttribute('lang'), 'es');
  const t = setup({ factory: { lang: 'fr' } });
  assert.ok(t.tray().every((b) => b.getAttribute('lang') === 'fr'));
});

test('sin situación no se pinta el párrafo de situación', () => {
  const it = item();
  delete it.situation;
  assert.equal(setup({ it }).root.querySelector('.cb__situation'), null);
  assert.equal(setup({ it: item({}, { situation: '  ' }) }).root.querySelector('.cb__situation'), null);
});

test('1 hueco y 6 huecos con 20 palabras funcionan', async () => {
  const one = setup({ it: item({ text: 'Say ___.', answers: [['hi']], bank: ['hi'] }) });
  one.put('hi');
  click(one.btn(CB_TEXT.check));
  await one.env.flush();
  assert.equal(one.calls[0].result, 'correct');
  const words = Array.from({ length: 20 }, (_, i) => `w${i}`);
  const big = setup({ it: item({ text: '___ ___ ___ ___ ___ ___', answers: words.slice(0, 6).map((w) => [w]), bank: words }) });
  assert.equal(big.tray().length, 20);
  big.put(...words.slice(0, 6));
  click(big.btn(CB_TEXT.check));
  await big.env.flush();
  assert.equal(big.calls[0].result, 'correct');
  assert.equal(big.calls[0].responseRaw, 'w0 w1 w2 w3 w4 w5');
});

test('150 secuencias de toques al azar no lanzan y nunca dejan una palabra en dos huecos', () => {
  const rng = createRng(2026);
  for (let n = 0; n < 150; n += 1) {
    const s = setup({ factory: { rng: createRng(n + 1) } });
    for (let step = 0; step < 25; step += 1) {
      const pick = rng.next();
      if (pick < 0.5) click(s.tray()[Math.floor(rng.next() * s.tray().length)]);
      else if (pick < 0.75) click(s.gaps()[Math.floor(rng.next() * s.gaps().length)]);
      else if (pick < 0.9) click(s.btn(CB_TEXT.undo));
      else click(s.btn(CB_TEXT.reset));
      const filled = s.gapTexts().filter((t) => t !== E);
      assert.equal(new Set(filled).size, filled.length);
      const usedCount = s.tray().filter((b) => b.getAttribute('aria-disabled') === 'true').length;
      assert.equal(usedCount, filled.length);
    }
  }
});

// ---- huecos que dejaron vivas las roturas (2.4-T2, punto 5b-bis) ----
const stubRng = (out) => ({ shuffle: () => out });

test('usa el rng que se le da: la bandeja sale en el orden que ese rng devuelve', () => {
  const s = setup({ factory: { rng: stubRng([3, 2, 1, 0]) } });
  assert.deepEqual(s.tray().map((b) => b.textContent), ['goes', 'at', 'by', 'go']);
});

test('sin `log` propio, un fallo al pintar la corrección va a console.error', async () => {
  const saved = console.error;
  const seen = [];
  console.error = (...a) => seen.push(a);
  try {
    const s = setup({ factory: { log: undefined } });
    s.put('go', 'by');
    s.root.querySelector('.cb__feedback').replaceChildren = () => { throw new Error('boom'); };
    click(s.btn(CB_TEXT.check));
    await s.env.flush();
    assert.equal(seen.length, 1);
  } finally { console.error = saved; }
});

test('las opciones raras se ignoran: una lista con propiedades no cuenta como opciones, y el código de idioma es de 2 o 3 letras', () => {
  assert.doesNotThrow(() => createClozeBank(Object.assign([], { lang: 'inglés', rng: {} })));
  for (const lang of ['e', 'engl', 'english', 'EN', 'e1', '']) assert.throws(() => createClozeBank({ lang }), /lang/, lang);
  for (const lang of ['en', 'es', 'fil']) assert.doesNotThrow(() => createClozeBank({ lang }), lang);
});

test('un ítem con tipo vacío no se monta', () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  assert.throws(() => createClozeBank({ rng: createRng(1) }).mount(root, { ...item(), type: '' }, { doc: env.doc }), /tipo/);
});

test('sin documento disponible el error lleva el nombre del tipo', () => {
  assert.throws(() => createClozeBank({ rng: createRng(1) }).mount({ appendChild() {} }, item(), {}), /cloze_bank/);
});

test('la situación se muestra con su rótulo, tal cual', () => {
  assert.equal(setup().root.querySelector('.cb__situation').textContent, `${CB_TEXT.situation}: En el colegio`);
});

test('un toque que no cambia nada no borra el aviso ni mueve el foco', async () => {
  const s = setup();
  s.put('go');
  click(s.btn(CB_TEXT.check));
  assert.equal(s.root.querySelector('.cb__msg').textContent, CB_TEXT.incomplete);
  let moved = 0;
  for (const b of s.tray()) b.focus = () => { moved += 1; };
  click(s.gaps()[1]);
  click(s.word('go'));
  assert.equal(s.root.querySelector('.cb__msg').textContent, CB_TEXT.incomplete);
  assert.equal(moved, 0);
});

test('poner una palabra funciona aunque la palabra siguiente no tenga focus()', () => {
  const s = setup();
  const errors = [];
  s.env.win.addEventListener('error', (e) => errors.push(e));
  for (const b of s.tray()) b.focus = undefined;
  s.put('go');
  assert.deepEqual(s.gapTexts(), ['go', E]);
  assert.equal(errors.length, 0);
});

test('acertar no pone marcas en los huecos', async () => {
  const s = setup();
  s.put('go', 'by');
  click(s.btn(CB_TEXT.check));
  await s.env.flush();
  assert.deepEqual(s.gapTexts(), ['go', 'by']);
  assert.ok(!s.root.querySelector('.cb__gap--ok') && !s.root.querySelector('.cb__gap--off'));
});

test('la frase correcta lleva el idioma de las palabras', async () => {
  const s = setup({ factory: { lang: 'fr' } });
  click(s.btn(CB_TEXT.dontKnow));
  await s.env.flush();
  assert.equal(s.root.querySelector('.cb__correct strong').getAttribute('lang'), 'fr');
});

test('sin ctx.submit queda cerrado sin aviso de error', async () => {
  const env = makeEnv();
  const root = env.doc.createElement('div');
  env.doc.body.appendChild(root);
  const comp = createClozeBank({ rng: createRng(1) }).mount(root, item(), { doc: env.doc });
  const put = (t) => click(root.querySelectorAll('.cb__tray .cb__word').find((b) => b.textContent === t));
  put('go'); put('by');
  click(root.querySelectorAll('button').find((b) => b.textContent.trim() === CB_TEXT.check));
  await env.flush();
  assert.equal(root.querySelector('.cb__msg').textContent, '');
  assert.equal(comp.getResponse(), 'I go to school by bus.');
  put('at');
  assert.equal(comp.getResponse(), 'I go to school by bus.');
});

test('un mensaje de error que no es texto se cambia por el genérico', async () => {
  for (const message of [42, { a: 1 }, '', null]) {
    const s = setup({ submit: () => ({ status: 'error', message }) });
    s.put('go', 'by');
    click(s.btn(CB_TEXT.check));
    await s.env.flush();
    assert.equal(s.root.querySelector('.cb__msg').textContent, CB_TEXT.saveFail, String(message));
  }
});

test('al reintentar tras un error el aviso se quita mientras se envía, también con «No sé»', async () => {
  for (const which of [CB_TEXT.check, CB_TEXT.dontKnow]) {
    let n = 0;
    let release;
    const s = setup({ submit: () => (++n === 1 ? { status: 'error' } : new Promise((r) => { release = r; })) });
    s.put('go', 'by');
    click(s.btn(CB_TEXT.check));
    await s.env.flush();
    assert.equal(s.root.querySelector('.cb__msg').textContent, CB_TEXT.saveFail);
    click(s.btn(which));
    assert.equal(s.root.querySelector('.cb__msg').textContent, '', which);
    release({ status: 'saved' });
    await s.env.flush();
  }
});

test('«No sé» después de un envío fallido deja la respuesta en null, no la frase del intento anterior', async () => {
  let n = 0;
  const s = setup({ submit: () => (++n === 1 ? { status: 'error' } : { status: 'saved' }) });
  s.put('go', 'by');
  click(s.btn(CB_TEXT.check));
  await s.env.flush();
  click(s.btn(CB_TEXT.dontKnow));
  await s.env.flush();
  assert.equal(s.comp.getResponse(), null);
});

test('«No sé» o «Comprobar» tras cerrar no borran ni cambian lo ya enviado', async () => {
  const s = setup();
  s.put('go', 'by');
  click(s.btn(CB_TEXT.check));
  await s.env.flush();
  click(s.btn(CB_TEXT.dontKnow));
  await s.env.flush();
  assert.equal(s.comp.getResponse(), 'I go to school by bus.');
  assert.equal(s.calls.length, 1);
});

test('destroy deja de escuchar: tocar una palabra, un hueco o «Comprobar» retirados no cambia nada ni envía', async () => {
  const s = setup();
  s.put('go');
  const byWord = s.word('by');
  const gap = s.gaps()[0];
  const check = s.btn(CB_TEXT.check);
  s.comp.destroy();
  const before = s.comp.getResponse();
  assert.equal(before, `I go to school ${E} bus.`);
  click(byWord);
  assert.equal(s.comp.getResponse(), before);
  click(gap);
  assert.equal(s.comp.getResponse(), before);
  click(check);
  await s.env.flush();
  assert.equal(s.calls.length, 0);
});

test('destroy deja de escuchar también con la frase completa: «Comprobar» retirado no envía', async () => {
  const s = setup();
  s.put('go', 'by');
  const check = s.btn(CB_TEXT.check);
  const dont = s.btn(CB_TEXT.dontKnow);
  const undo = s.btn(CB_TEXT.undo);
  s.comp.destroy();
  click(check);
  click(dont);
  click(undo);
  await s.env.flush();
  assert.equal(s.calls.length, 0);
  assert.equal(s.comp.getResponse(), 'I go to school by bus.');
});
