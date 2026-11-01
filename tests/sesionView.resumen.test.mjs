// @purpose: Pruebas de la conexión del resumen completo en la vista de sesión (2.8-T2 punto 4): fuente por defecto, fuente inyectada, fallo con resumen mínimo, «Volver» y sesión vacía.
// 2.8-T2 punto 4. Usa el harness de la vista con servicios reales; el abandono a mitad (resumen parcial) y «Repetir los que fallé» son de los puntos siguientes.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mk, openNew, fakeHost } from './_sesionHarness.mjs';
import { parseChatBlock } from '../core/syncChat.js';

const realDocument = globalThis.document;
afterEach(() => { globalThis.document = realDocument; });

const finish = async (t) => {
  for (let i = 0; i < 3; i += 1) { t.clock.advance(2000); t.click(t.btn('Comprobar')); await t.flush(); t.click(t.btn('Continuar')); await t.flush(); }
};
const panelText = (t) => t.q('.summary')[0]?.textContent ?? '';

test('al terminar dibuja el panel con las cifras de los eventos y los nombres de los temas', async () => {
  const t = await mk(); await openNew(t); await finish(t);
  assert.equal(t.q('.summary').length, 1);
  assert.match(panelText(t), /Sesión terminada/);
  assert.match(panelText(t), /Ejercicios3/);
  assert.match(panelText(t), /Aciertos3/);
  assert.match(panelText(t), /Tu dominio por tema/);
  assert.doesNotMatch(panelText(t), /NaN|undefined|null/);
  assert.equal((await t.events()).length, 3);
  assert.equal(t.progressText(), '3/3');
});

test('«Volver a Practicar» sale del resumen hacia Practicar', async () => {
  const t = await mk(); await openNew(t); await finish(t);
  t.click(t.btn('Volver a Practicar')); await t.flush();
  assert.equal(t.nav.at(-1)?.[0], 'practicar');
});

test('una fuente inyectada (services.summarySource) se usa con el id y el estado de la sesión', async () => {
  const calls = [];
  const summarySource = { load: async (arg) => { calls.push(arg); return { empty: false, partial: false, answered: 3, planned: 3, pending: 0, counts: { correct: 3 }, accuracyPct: 100, time: { ms: 6000 }, mastery: { changes: [] }, errors: { fresh: [], recurrent: [] }, nextReviews: { groups: {}, unknown: 0 }, failed: [] }; } };
  const t = await mk({ services: { summarySource } }); await openNew(t); await finish(t);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sessionId, /^ses/);
  assert.equal(calls[0].state.phase, 'summary');
  assert.match(panelText(t), /Precisión100 %/);
});

test('si la fuente falla se muestra el resumen mínimo de siempre, con el motivo en el log y sin pantalla vacía', async () => {
  const summarySource = { load: async () => { throw new Error('base caída'); } };
  const errs = []; const orig = console.error; console.error = (...a) => errs.push(a);
  try {
    const t = await mk({ services: { summarySource } }); await openNew(t); await finish(t);
    assert.equal(t.q('.summary').length, 0);
    assert.match(t.root.textContent, /Sesión terminada/);
    assert.match(t.root.textContent, /Respondiste 3 ejercicios de 3\./);
    assert.ok(t.btn('Volver a Practicar'));
    assert.ok(errs.some((e) => /resumen/i.test(String(e[0]))));
  } finally { console.error = orig; }
});

test('mientras se lee el resumen se ve «Preparando tu resumen…» y después el panel', async () => {
  let release; const gate = new Promise((r) => { release = r; });
  const summarySource = { load: async () => { await gate; return { empty: true, partial: false, answered: 0, planned: 0, pending: 0, counts: {}, accuracyPct: null, time: { ms: 0 }, mastery: { changes: [] }, errors: { fresh: [], recurrent: [] }, nextReviews: { groups: {}, unknown: 0 }, failed: [] }; } };
  const t = await mk({ services: { summarySource } }); await openNew(t);
  for (let i = 0; i < 3; i += 1) { t.clock.advance(2000); t.click(t.btn('Comprobar')); await t.flush(); t.click(t.btn('Continuar')); await t.flush(); }
  assert.match(t.root.textContent, /Preparando tu resumen/);
  assert.equal(t.q('.summary').length, 0);
  release(); await t.flush();
  assert.equal(t.q('.summary').length, 1);
  assert.doesNotMatch(t.root.textContent, /Preparando tu resumen/);
});

test('si se sale de la vista mientras se lee el resumen no se dibuja nada ni se rompe', async () => {
  let release; const gate = new Promise((r) => { release = r; });
  const summarySource = { load: async () => { await gate; return {}; } };
  const t = await mk({ services: { summarySource } }); await openNew(t);
  for (let i = 0; i < 3; i += 1) { t.clock.advance(2000); t.click(t.btn('Comprobar')); await t.flush(); t.click(t.btn('Continuar')); await t.flush(); }
  t.view2.destroy();
  const before = t.env.stats.live();
  release(); await t.flush();
  assert.equal(t.q('.summary').length, 0);
  assert.equal(t.env.stats.live(), before, 'no se crea un panel (con sus botones y listeners) en una vista ya cerrada');
});

// ---------- 2.8-T2 punto 5: abandonar a mitad = resumen parcial (CA 2) ----------
const backBtn = (t) => t.q('button').find((b) => b.getAttribute('aria-label') === 'Salir de la sesión');
const leave = async (t) => { t.click(backBtn(t)); await t.flush(); t.click(t.dlgBtn('Salir')); await t.flush(); };

test('CA 2 · salir tras 1 de 3 muestra el resumen parcial con lo hecho y lo que quedó, y conserva la sesión', async () => {
  const t = await mk(); await openNew(t);
  t.clock.advance(2000); t.click(t.btn('Comprobar')); await t.flush();
  const navs = t.nav.length;
  await leave(t);
  assert.equal(t.q('.summary').length, 1);
  assert.ok(t.q('.summary')[0].classList.contains('summary--partial'));
  assert.match(panelText(t), /Sesión a medias/);
  assert.match(panelText(t), /1 de 3/);
  assert.match(panelText(t), /Quedaron 2 sin ver/);
  assert.doesNotMatch(panelText(t), /NaN|undefined|null/);
  assert.equal(t.nav.length, navs, 'no navega solo');
  assert.equal((await t.events()).length, 1);
  assert.equal((await t.study.session.load()).status, 'restored', 'se puede retomar');
});

test('el resumen parcial se pide a la fuente con el estado «quit» y sin tocar el estado del driver', async () => {
  const calls = [];
  const summarySource = { load: async (arg) => { calls.push(arg); return { empty: false, partial: true, answered: 1, planned: 3, pending: 2, counts: { correct: 1 }, accuracyPct: 100, time: { ms: 2000 }, mastery: { changes: [] }, errors: { fresh: [], recurrent: [] }, nextReviews: { groups: {}, unknown: 0 }, failed: [] }; } };
  const t = await mk({ services: { summarySource } }); await openNew(t);
  t.clock.advance(2000); t.click(t.btn('Comprobar')); await t.flush();
  await leave(t);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].state.ended, 'quit');
  assert.equal(calls[0].state.answers.length, 1);
  assert.equal((await t.study.session.load()).state.phase, 'next', 'lo guardado sigue en su fase: retomar funciona');
});

test('sin ninguna respuesta, salir va directo a Practicar (no hay nada que resumir)', async () => {
  const t = await mk(); await openNew(t);
  await leave(t);
  assert.equal(t.q('.summary').length, 0);
  assert.equal(t.nav.at(-1)?.[0], 'practicar');
});

test('con el resumen parcial en pantalla, la flecha sale sin volver a preguntar', async () => {
  const t = await mk(); await openNew(t);
  t.clock.advance(2000); t.click(t.btn('Comprobar')); await t.flush();
  await leave(t);
  const dialogs = () => t.env.doc.body.querySelectorAll('[role="alertdialog"]').length;
  const before = dialogs();
  const navs = t.nav.length;
  t.click(backBtn(t)); await t.flush();
  assert.equal(dialogs(), before, 'no se abre otra confirmación');
  assert.equal(t.nav.length, navs + 1);
  assert.equal(t.nav.at(-1)?.[0], 'practicar');
});

test('si la fuente falla al abandonar, se ve el resumen mínimo con lo respondido', async () => {
  const summarySource = { load: async () => { throw new Error('base caída'); } };
  const errs = []; const orig = console.error; console.error = (...a) => errs.push(a);
  try {
    const t = await mk({ services: { summarySource } }); await openNew(t);
    t.clock.advance(2000); t.click(t.btn('Comprobar')); await t.flush();
    await leave(t);
    assert.equal(t.q('.summary').length, 0);
    assert.match(t.root.textContent, /Respondiste 1 ejercicio de 3\./);
    assert.ok(t.btn('Volver a Practicar'));
  } finally { console.error = orig; }
});

test('sin fanfarria al abandonar: el sonido de «sesión terminada» suena al completar, no al salir a mitad', async () => {
  const mkSound = () => { const played = []; return { played, play: (n) => played.push(n), unlock() {}, destroy() {} }; };
  const done = mkSound();
  const a = await mk({ services: { sound: done, settings: { get: () => true } } }); await openNew(a); await finish(a);
  const half = mkSound();
  const b = await mk({ services: { sound: half, settings: { get: () => true } } }); await openNew(b);
  b.clock.advance(2000); b.click(b.btn('Comprobar')); await b.flush();
  await leave(b);
  assert.ok(done.played.includes('finish'), 'al completar suena el tono de cierre');
  assert.ok(!half.played.includes('finish'), 'al salir a mitad no suena el tono de cierre');
});

// ---------- 2.8-T3 punto 1: «Repetir los que fallé» ----------
const wrongHost = () => fakeHost({ answer: { result: 'wrong', exerciseType: 'fix_error' } });
const retryBtn = (t) => t.q('button').find((b) => /^Repetir/.test(b.textContent));

test('con fallos el panel ofrece «Repetir los 3 que no me salieron»; sin fallos no hay botón', async () => {
  const bad = await mk({ host: wrongHost() }); await openNew(bad); await finish(bad);
  assert.equal(retryBtn(bad)?.textContent, 'Repetir los 3 que no me salieron');
  const good = await mk(); await openNew(good); await finish(good);
  assert.equal(retryBtn(good), undefined);
});

test('tocar «Repetir» guarda una sesión nueva con exactamente las tarjetas falladas y navega a ella', async () => {
  const t = await mk({ host: wrongHost() }); await openNew(t); await finish(t);
  const original = t.nav.at(-1)[1].id;
  const navs = t.nav.length;
  t.click(retryBtn(t)); await t.flush();
  assert.equal(t.nav.length, navs + 1);
  const [name, params] = t.nav.at(-1);
  assert.equal(name, 'sesion');
  assert.match(params.id, /^ses_/);
  assert.notEqual(params.id, original);
  const saved = await t.study.session.load();
  assert.equal(saved.status, 'restored');
  assert.equal(saved.sessionId, params.id);
  assert.equal(saved.items.length, 3);
  assert.equal(saved.state.phase, 'presenting');
});

test('solo se repiten las falladas: lo acertado se queda fuera', async () => {
  let n = 0;
  const host = fakeHost();
  const mount = host.mount.bind(host);
  const t = await mk({ host: { ...host, mount: async (slot, entry, ctx) => { n += 1; const bad = n === 2; return mount(slot, entry, { ...ctx, submit: (a) => ctx.submit({ ...a, result: bad ? 'wrong' : 'correct' }) }); } } });
  await openNew(t); await finish(t);
  if (!retryBtn(t)) return assert.fail('no apareció «Repetir»: ' + t.root.textContent);
  assert.equal(retryBtn(t).textContent, 'Repetir el que no me salió');
  t.click(retryBtn(t)); await t.flush();
  const saved = await t.study.session.load();
  assert.equal(saved.items.length, 1);
});

test('un segundo toque mientras se arma la mini-sesión se ignora', async () => {
  const t = await mk({ host: wrongHost() }); await openNew(t); await finish(t);
  const navs = t.nav.length;
  const b = retryBtn(t);
  t.click(b); t.click(b); await t.flush();
  assert.equal(t.nav.length, navs + 1);
});

test('si no se puede guardar la mini-sesión: aviso amable, motivo al log y la pantalla sigue', async () => {
  const errs = []; const orig = console.error; console.error = (...a) => errs.push(a);
  try {
    let broken = false;
    const wrapStudy = (study) => ({ ...study, session: { ...study.session, save: async (...a) => { if (broken) throw new Error('disco lleno'); return study.session.save(...a); } } });
    const t = await mk({ host: wrongHost(), wrapStudy }); await openNew(t); await finish(t);
    broken = true;
    const navs = t.nav.length;
    t.click(retryBtn(t)); await t.flush();
    broken = false;
    assert.equal(t.nav.length, navs, 'no navega');
    assert.equal(t.toasts.at(-1), 'No pude preparar la repetición. Puedes volver a intentarlo.');
    assert.equal(t.q('.summary').length, 1);
    assert.ok(errs.some((e) => /mini-sesión/.test(String(e[0]))));
    t.click(retryBtn(t)); await t.flush();
    assert.equal(t.nav.length, navs + 1, 'el botón sigue sirviendo para reintentar');
  } finally { console.error = orig; }
});

test('también se ofrece en el resumen parcial (lo fallado hasta ahí)', async () => {
  const t = await mk({ host: wrongHost() }); await openNew(t);
  t.clock.advance(2000); t.click(t.btn('Comprobar')); await t.flush();
  await leave(t);
  assert.equal(retryBtn(t)?.textContent, 'Repetir el que no me salió');
});

// ---------- 2.8-T3 punto 2: «Llevar al chat» ----------
const chatBtn = (t) => t.q('button').find((b) => b.textContent === 'Llevar al chat');
const chatStatus = (t) => t.q('.summary__chat-status')[0]?.textContent ?? '';

test('con fallos el panel ofrece «Llevar al chat»; sin nada que llevar no hay botón', async () => {
  const bad = await mk({ host: wrongHost() }); await openNew(bad); await finish(bad);
  assert.ok(chatBtn(bad));
  const good = await mk(); await openNew(good); await finish(good);
  assert.equal(chatBtn(good), undefined);
});

test('tocar «Llevar al chat» copia un bloque 8.14 válido con el tema y las cifras de la sesión', async () => {
  const copied = [];
  const t = await mk({ host: wrongHost(), services: { clipboard: { writeText: async (x) => { copied.push(x); } } } }); await openNew(t); await finish(t);
  t.click(chatBtn(t)); await t.flush();
  assert.equal(copied.length, 1);
  const p = parseChatBlock(copied[0]);
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.equal(p.kind, 'llevar_al_chat');
  assert.match(p.payload.item, /3 ejercicios, 0 aciertos/);
  assert.match(chatStatus(t), /Copiado\. Pégalo en el chat\./);
  assert.equal(t.q('.summary__chat-block').length, 0);
});

test('si el portapapeles falla muestra el bloque seleccionable, avisa y anota el motivo; el botón sigue sirviendo', async () => {
  const t = await mk({ host: wrongHost(), services: { clipboard: { writeText: async () => { throw new Error('denegado'); } } } }); await openNew(t); await finish(t);
  const errs = []; const orig = console.error; console.error = (...a) => errs.push(a);
  try { t.click(chatBtn(t)); await t.flush(); } finally { console.error = orig; }
  const box = t.q('.summary__chat-block')[0];
  assert.ok(box, 'aparece el cuadro con el bloque');
  assert.equal(parseChatBlock(box.value).ok, true);
  assert.match(chatStatus(t), /No se pudo copiar solo/);
  assert.ok(errs.some((e) => /copiar el bloque/.test(String(e[0]))));
  assert.ok(chatBtn(t));
});

test('también sale en el resumen parcial, con el mensaje de sesión a medias', async () => {
  const copied = [];
  const t = await mk({ host: wrongHost(), services: { clipboard: { writeText: async (x) => { copied.push(x); } } } }); await openNew(t);
  t.clock.advance(2000); t.click(t.btn('Comprobar')); await t.flush();
  await leave(t);
  t.click(chatBtn(t)); await t.flush();
  const p = parseChatBlock(copied[0]);
  assert.match(p.payload.item, /^Sesión a medias/);
});

test('un segundo toque mientras se prepara no copia dos veces', async () => {
  let release; const gate = new Promise((r) => { release = r; }); const copied = [];
  const t = await mk({ host: wrongHost(), services: { clipboard: { writeText: async (x) => { await gate; copied.push(x); } } } }); await openNew(t); await finish(t);
  t.click(chatBtn(t)); t.click(chatBtn(t)); await t.flush();
  release(); await t.flush();
  assert.equal(copied.length, 1);
});
