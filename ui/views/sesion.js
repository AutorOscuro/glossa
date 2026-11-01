// @purpose: Vista de sesión (#/sesion/:id): cabecera con barra X/N y mascota, ítem a ítem con cronómetro, avance con «Continuar», salida con confirmación y resumen mínimo.
// Vista del ejecutor de sesión (subparte 2.1, tramo 3). Roadmap 2.1 y 17. Toda la lógica vive en core/sessionDriver.js; aquí solo se dibuja y se escucha.
//
//   Ruta: #/sesion/nueva arma una sesión (core/session.js), la guarda y reemplaza la ruta por #/sesion/<id>; #/sesion/<id> retoma la guardada.
//   Estados de pantalla: cargando · mensaje (sin material, sin base, sesión no encontrada: nunca culpa) · ejercicio · resumen.
//
//   Resumen (2.8-T2 punto 4): al terminar, `services.summarySource` (opcional; por defecto `createSummarySource({ study })`) lee la sesión con ventana y `describeSummary` + `createSummaryPanel` la dibujan.
//     Si la fuente no se puede crear o falla, se muestra el resumen mínimo de siempre: nunca se queda la pantalla vacía. «Repetir los que fallé» (2.8-T3): `startRetrySession` con las entradas fallidas y navega a la sesión nueva.
//   Ejercicios (los trae 2.1-T4, ui/exercises/index.js): `services.exercises.mount(slot, entry, ejCtx)` → manejador `{ destroy() }` (o una promesa de él).
//     entry   el ítem del plan { cardId, itemId, facet, topic, exerciseType, kind, why, topics }.
//     ejCtx   { index, total, submit(answer) }: `submit` es el ÚNICO camino para registrar la respuesta (formato en core/sessionDriver.js `submit`).
//             Devuelve { status: 'saved' | 'duplicate' | 'ignored' | 'error', … }. Un segundo toque devuelve 'ignored': nunca duplica el evento.
//     Si `services.exercises` no existe, o mount falla, se muestra «tipo no soportado todavía» con «Saltar por ahora» (sin evento y sin tocar la tarjeta).
//   Salir: la flecha de la cabecera pide confirmación; lo respondido ya está guardado y la sesión se retoma desde su dirección (caduca a las 12 h).
//     Con al menos una respuesta, «Salir» muestra el resumen PARCIAL (2.8-T2 punto 5; la sesión guardada NO se borra); sin respuestas va directo a Practicar.
//   Cronómetro: lo mide core/answerTimer.js (invisible a propósito, sin presión); arranca al mostrar el ejercicio y descuenta la pestaña oculta.
//   Ayudas (2.7-T1): si `services.examples` existe (app/examplesSource.js: `forEntry(entry, { excludeItemIds })`), debajo del ejercicio aparece la barra de ayudas con «Otros ejemplos».
//     La hoja va ENCIMA del ejercicio (que sigue montado y no se toca) y, mientras está abierta, el cronómetro la descuenta como tiempo fuera (core/pausableVisibility.js).
//   Preguntas IA (2.7-T3): si `services.aiHelp` existe (app/aiHelpSource.js: `status()` y `prepare(entry, { answer, message })`), la barra suma «Preguntas IA»; sin IA la hoja ofrece «Llevar al chat» (bloque de 8.14, copia o cuadro para copiar a mano). `services.clipboard` opcional (por defecto el del navegador).
//   Diccionario (2.7-T4): si `services.dictionary` existe (app/dictionarySource.js: `prepare()`, `search(q)`, `add(word)`), la barra suma «Diccionario»; búsqueda local tolerante y «Añadir» si la palabra no está.
//   Correcciones (2.7-T2): si `services.corrections` existe (app/correctionsSource.js: `forEntry(entry)` → { corrections, count }), la barra suma «Correcciones» con la cuenta exacta en la insignia; la hoja funciona igual que la de ejemplos.
//     Los ejemplos nunca salen de los ejercicios que la sesión aún no presentó. Sin `services.examples` no hay barra: no se ofrece lo que no puede funcionar.
import { h } from '../dom.js';
import { createView } from './_viewBase.js';
import { createButton, createProgressBar, createMascot, createModal, createSkeleton } from '../components/index.js';
import { createAnswerTimer } from '../../core/answerTimer.js';
import { createPausableVisibility } from '../../core/pausableVisibility.js';
import { createActionBar } from '../actionBar.js';
import { createExamplesSheet } from '../examplesSheet.js';
import { createCorrectionsSheet } from '../correctionsSheet.js';
import { createAiSheet } from '../aiSheet.js';
import { createDictionarySheet } from '../dictionarySheet.js';
import { createSummaryPanel } from '../summaryPanel.js';
import { createSummarySource } from '../../app/summarySource.js';
import { describeSummary } from '../../core/summaryText.js';
import { buildSummaryChatBlock } from '../../core/summaryChat.js';
import { copyForChat } from '../../app/chatCopy.js';
import { mascotStateFor, soundFor, soundForFinish, vibrationFor } from '../../core/feedbackCues.js';
import { createSoundEngine } from '../../app/soundEngine.js';
import { createVibration } from '../../app/vibration.js';
import { createDocumentVisibility } from '../../app/visibility.js';
import { transition, summarize } from '../../core/sessionRunner.js';
import { createSessionDriver, startSession, startRetrySession, resumeSession, NEW_SESSION_ID } from '../../core/sessionDriver.js';

export const SESSION_TEXT = {
  title: 'Sesión',
  back: 'Salir de la sesión',
  progress: 'Progreso de la sesión',
  leaveTitle: '¿Salir de la sesión?',
  leaveBody: 'Lo que ya respondiste está guardado. Puedes retomar esta sesión después.',
  leaveYes: 'Salir',
  leaveNo: 'Seguir',
  next: 'Continuar',
  skip: 'Saltar por ahora',
  loading: 'Preparando tu sesión…',
  summaryLoading: 'Preparando tu resumen…',
  retryFail: 'No pude preparar la repetición. Puedes volver a intentarlo.',
  unsupportedTitle: 'Este tipo de ejercicio todavía no está disponible',
  unsupportedBody: 'Llegará en una próxima versión. Puedes saltarlo: no cuenta como fallo.',
  noData: 'No pude abrir tus datos en este dispositivo, así que por ahora no se puede estudiar. Revisa Ajustes y vuelve a intentarlo.',
  notFound: 'No encontré esa sesión. Puede que ya terminó o que pasaron más de 12 horas. Puedes empezar una nueva.',
  startNew: 'Empezar una sesión nueva',
  back2: 'Volver a Practicar',
  saveFail: 'No pude guardar tu respuesta. Inténtalo otra vez.',
  startFail: 'No pude preparar la sesión. Inténtalo otra vez en un momento.',
  doneTitle: 'Sesión terminada',
};

const TEXT = SESSION_TEXT;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function summaryLines(s) {
  const lines = [`Respondiste ${plural(s.answered, 'ejercicio', 'ejercicios')} de ${s.total}.`];
  lines.push(`Aciertos: ${s.correct}.`);
  if (s.almost > 0) lines.push(`Casi: ${s.almost}.`);
  if (s.wrong + s.dontKnow > 0) lines.push(`Para repasar: ${s.wrong + s.dontKnow}.`);
  if (s.skipped > 0) lines.push(`Saltados: ${s.skipped}.`);
  return lines;
}

export default createView(async (ctx) => {
  const log = (...a) => console.error(...a);
  const services = () => ctx.services;
  const go = (name, params, options) => services().navigate?.(name, params, options);

  let driver = null;
  let timer = null;
  let handle = null; // manejador del ejercicio que está en pantalla
  let token = 0; // sube con cada ejercicio: una respuesta de uno anterior se ignora
  let bar = null;
  let mascot = null;
  let modal = null;
  let pausable = null; // visibilidad con pausa: la hoja de ayuda la activa y el cronómetro no cuenta ese rato
  let actionBar = null;
  let examples = null;
  let corrections = null;
  let aiAsk = null;
  let dictionary = null;
  let panel = null;
  let sessionIdNow = null;
  let summaryToken = 0;
  let retrying = false; // un solo toque en «Repetir»: mientras se arma la mini-sesión, los demás se ignoran
  let summaryShown = false; // con el resumen en pantalla, la flecha de la cabecera sale sin preguntar
  // Sonido (2.6-T3): el ajuste `sounds` se lee en el momento de sonar; nada de esto puede frenar «Continuar».
  const ownSound = !services().sound;
  const sound = services().sound ?? createSoundEngine();
  const soundsOn = () => { try { const st = services().settings; return typeof st?.get === 'function' ? st.get('sounds') === true : true; } catch (e) { return false; } };
  const cue = (name) => { if (name) { try { sound.play(name); } catch (e) { log('No se pudo sonar', e); } } };
  const unlockSound = () => { try { sound.unlock(); } catch (e) { log('No se pudo preparar el sonido', e); } };

  // Vibración (2.6-T3): un pulso corto solo al acertar y con `vibration` en true; nunca puede frenar «Continuar».
  const buzz = services().vibration ?? createVibration();
  const setting = (key) => { try { const st = services().settings; return typeof st?.get === 'function' ? st.get(key) === true : true; } catch (e) { return false; } };
  const pulse = (ms) => { if (ms) { try { buzz.pulse(ms); } catch (e) { log('No se pudo vibrar', e); } } };

  const slot = h('div', { class: 'session__slot' });
  const body = h('div', { class: 'session__body stack', 'aria-live': 'polite' });
  const nextBtn = createButton({
    label: TEXT.next, variant: 'primary', size: 'lg', block: true,
    onClick: () => advance(),
  });
  const foot = h('div', { class: 'session__foot', hidden: true }, nextBtn.el);
  const dock = h('div', { class: 'session__dock' }, foot); // «Continuar» y, si existe, la barra de ayudas
  const setFoot = (on) => { if (on) foot.removeAttribute('hidden'); else foot.setAttribute('hidden', ''); };
  const backBtn = createButton({ ariaLabel: TEXT.back, icon: '←', variant: 'ghost', onClick: () => askLeave() });
  const head = h('header', { class: 'session__head' }, backBtn.el);
  const sessionEl = h('section', { class: 'session view' }, head, body, dock);
  ctx.root.appendChild(sessionEl);
  for (const type of ['pointerdown', 'keydown']) { sessionEl.addEventListener(type, unlockSound); ctx.cleanup(() => sessionEl.removeEventListener(type, unlockSound)); }
  ctx.cleanup(() => { try { if (ownSound) sound.destroy?.(); } catch (e) { log('No se pudo cerrar el sonido', e); } });
  ctx.cleanup(() => {
    try { timer?.stop(); } catch (e) { log('No se pudo detener el cronómetro', e); }
    dropExercise();
    for (const part of [modal, nextBtn, backBtn, bar, mascot, examples, corrections, aiAsk, dictionary, actionBar, panel]) { try { part?.destroy(); } catch (e) { log('No se pudo limpiar la sesión', e); } }
  });

  function dropExercise() {
    const old = handle;
    handle = null;
    token += 1;
    if (old && typeof old.destroy === 'function') { try { old.destroy(); } catch (e) { log('No se pudo cerrar el ejercicio', e); } }
  }

  // Ayudas (2.7-T1). La barra solo existe si hay una fuente de ejemplos; se enseña mientras hay un ejercicio montado.
  const setBar = (on) => { if (!actionBar) return; if (on) actionBar.el.removeAttribute('hidden'); else actionBar.el.setAttribute('hidden', ''); };
  // Ítems que la sesión aún no presentó: sus frases no se enseñan antes de tiempo.
  const upcomingIds = () => { const s = driver.getState(); return driver.getItems().slice(s.index + 1).map((e) => e.itemId); };
  function openHelp(id) {
    if (!driver || !ctx.alive() || !driver.current()) return;
    if (id === 'examples') examples?.open();
    if (id === 'corrections') corrections?.open();
    if (id === 'ai') aiAsk?.open();
    if (id === 'dictionary') dictionary?.open();
  }
  // Insignia de «Correcciones»: la cuenta exacta de errores propios del ejercicio en pantalla. Si falla, la insignia se queda sin número y nada más cambia.
  function refreshBadge() {
    const source = services().corrections;
    if (!source || !actionBar?.has('corrections') || !driver) return;
    const entry = driver.current();
    const mine = token;
    actionBar.setBadge('corrections', null);
    Promise.resolve().then(() => source.forEntry(entry)).then((r) => {
      if (ctx.alive() && mine === token) actionBar.setBadge('corrections', Number.isInteger(r?.count) ? r.count : null);
    }).catch((e) => { log('No se pudo contar las correcciones', e); if (ctx.alive() && mine === token) actionBar.setBadge('corrections', null); });
  }
  function setupHelp() {
    const exSource = services().examples;
    const coSource = services().corrections;
    const hasEx = !!exSource && typeof exSource.forEntry === 'function';
    const hasCo = !!coSource && typeof coSource.forEntry === 'function';
    const aiSource = services().aiHelp;
    const hasAi = !!aiSource && typeof aiSource.status === 'function' && typeof aiSource.prepare === 'function';
    const diSource = services().dictionary;
    const hasDi = !!diSource && typeof diSource.prepare === 'function' && typeof diSource.search === 'function' && typeof diSource.add === 'function';
    if (!hasEx && !hasCo && !hasAi && !hasDi) return;
    const actions = [];
    if (hasEx) {
      actions.push('examples');
      examples = createExamplesSheet({
        load: () => exSource.forEntry(driver.current(), { excludeItemIds: upcomingIds() }),
        onOpen: () => pausable?.setPaused(true),
        onClose: () => pausable?.setPaused(false),
        log,
      });
    }
    if (hasCo) {
      actions.push('corrections');
      corrections = createCorrectionsSheet({
        load: async () => { const r = await coSource.forEntry(driver.current()); if (Number.isInteger(r?.count)) actionBar?.setBadge('corrections', r.count); return r; },
        onOpen: () => pausable?.setPaused(true),
        onClose: () => pausable?.setPaused(false),
        log,
      });
    }
    if (hasAi) {
      actions.push('ai');
      aiAsk = createAiSheet({
        source: aiSource,
        getEntry: () => driver.current(),
        getAnswer: () => handle?.getResponse?.() ?? null,
        clipboard: services().clipboard ?? globalThis.navigator?.clipboard,
        onOpen: () => pausable?.setPaused(true),
        onClose: () => pausable?.setPaused(false),
        log,
      });
    }
    if (hasDi) {
      actions.push('dictionary');
      dictionary = createDictionarySheet({
        source: diSource,
        onOpen: () => pausable?.setPaused(true),
        onClose: () => pausable?.setPaused(false),
        log,
      });
    }
    actionBar = createActionBar({ actions, onOpen: openHelp });
    setBar(false);
    dock.appendChild(actionBar.el);
  }

  const button = (label, onClick, variant = 'secondary') => createButton({ label, variant, size: 'lg', block: true, onClick });
  function showMessage(text, ...buttons) {
    setFoot(false);
    setBar(false);
    const btns = buttons.map((b) => { ctx.cleanup(() => b.destroy()); return b.el; });
    body.replaceChildren(h('div', { class: 'card stack' }, h('p', { class: 'card__title' }, text), ...btns));
  }
  const toBack = () => button(TEXT.back2, () => go('practicar'), 'primary');

  function paintProgress() {
    if (!bar || !driver) return;
    const s = driver.getState();
    bar.setSteps(s.answers.length, s.total);
  }

  async function askLeave() {
    const s = driver?.getState();
    if (!driver || !s || s.phase === 'summary' || s.phase === 'idle' || summaryShown) { go('practicar'); return; }
    if (modal?.isOpen()) return;
    modal?.destroy();
    modal = createModal({ title: TEXT.leaveTitle, message: TEXT.leaveBody, confirmLabel: TEXT.leaveYes, cancelLabel: TEXT.leaveNo });
    const yes = await modal.open();
    if (!yes || !ctx.alive()) return;
    await driver.idle(); // si una respuesta se está guardando, se espera a que termine
    if (!ctx.alive()) return;
    // Abandonar a mitad (2.8-T2 punto 5): con respuestas, resumen parcial; la sesión guardada se conserva y se puede retomar.
    const now = driver.getState();
    if (now.answers.length === 0) { go('practicar'); return; }
    try { timer?.stop(); } catch (e) { log('No se pudo detener el cronómetro', e); }
    const quit = transition(now, 'QUIT').state;
    await showSummary(summarize(quit), quit);
  }

  async function onSubmit(answer, mine) {
    if (mine !== token || !driver) return { status: 'ignored', reason: 'stale' };
    let r;
    try { r = await driver.submit(answer); } catch (e) {
      log('No se pudo guardar la respuesta', e);
      services().toast?.show?.(TEXT.saveFail);
      return { status: 'error', message: TEXT.saveFail };
    }
    if (!ctx.alive() || mine !== token) return r;
    if (r.status === 'saved' || r.status === 'duplicate') afterAnswer(r.result);
    return r;
  }

  function afterAnswer(result) {
    paintProgress();
    mascot?.setState(mascotStateFor(result));
    cue(soundFor(result, soundsOn()));
    pulse(vibrationFor(result, setting('vibration')));
    setFoot(true);
    nextBtn.focus();
  }

  async function skip() {
    if (!driver) return;
    const r = await driver.skipUnsupported();
    if (r.status === 'skipped' && ctx.alive()) afterAnswer('skipped');
  }

  async function present() {
    const entry = driver.current();
    setFoot(false);
    setBar(false);
    mascot?.setState('neutral');
    dropExercise();
    const mine = token;
    paintProgress();
    const s = driver.getState();
    slot.replaceChildren();
    body.replaceChildren(slot);
    let made = null;
    const host = services().exercises;
    if (host && typeof host.mount === 'function') {
      try { made = await host.mount(slot, entry, { index: s.index, total: s.total, submit: (a) => onSubmit(a, mine) }); } catch (e) {
        log('No se pudo mostrar el ejercicio', e);
        slot.replaceChildren();
      }
    }
    if (!ctx.alive() || mine !== token) {
      if (made && typeof made.destroy === 'function') { try { made.destroy(); } catch (e) { log('No se pudo cerrar el ejercicio', e); } }
      return;
    }
    if (made) { handle = made; setBar(true); refreshBadge(); } else {
      const unsupported = button(TEXT.skip, () => skip());
      ctx.cleanup(() => unsupported.destroy());
      slot.replaceChildren(h('div', { class: 'card stack' }, h('p', { class: 'card__title' }, TEXT.unsupportedTitle), h('p', { class: 'text-sm text-muted' }, TEXT.unsupportedBody), unsupported.el));
    }
    driver.shown(); // el cronómetro arranca cuando el ejercicio ya está a la vista
  }

  function showMinimalSummary(summary) {
    const back = toBack();
    ctx.cleanup(() => back.destroy());
    body.replaceChildren(h('div', { class: 'card stack' },
      h('h2', { class: 'card__title' }, TEXT.doneTitle),
      ...summaryLines(summary).map((t) => h('p', { class: 'text-sm' }, t)),
      back.el));
  }

  // Resumen completo (2.8-T2 punto 4): mientras se lee se ve «Preparando…»; si algo falla, el resumen mínimo.
  async function showSummary(summary, state = driver.getState()) {
    summaryShown = true;
    dropExercise();
    setFoot(false);
    setBar(false);
    paintProgress();
    if (state.ended !== 'quit') cue(soundForFinish(soundsOn())); // sin fanfarria al abandonar: no se celebra lo que no se terminó
    const mine = summaryToken + 1;
    summaryToken = mine;
    body.replaceChildren(h('div', { class: 'stack' }, h('p', { class: 'text-sm text-muted' }, TEXT.summaryLoading), createSkeleton({ lines: 3 }).el));
    let content = null;
    let failedIds = [];
    let names = new Map();
    let full = null;
    try {
      const study = services().study;
      const source = services().summarySource ?? createSummarySource({ study, log });
      full = await source.load({ sessionId: sessionIdNow, state });
      names = new Map((Array.isArray(study.topics) ? study.topics : []).map((t) => [t?.id, t?.title_es]));
      content = describeSummary(full, { topicName: (id) => names.get(id) });
      failedIds = (Array.isArray(full?.failed) ? full.failed : []).map((f) => f?.cardId).filter((c) => typeof c === 'string');
    } catch (e) { log('No se pudo preparar el resumen completo; se muestra el mínimo', e); }
    if (!ctx.alive() || mine !== summaryToken) return;
    if (!content) { showMinimalSummary(summary); return; }
    panel?.destroy();
    panel = createSummaryPanel({ content, onBack: () => go('practicar'), onChat: () => bringSummaryToChat(full, names), ...(failedIds.length > 0 ? { onRetry: () => retryFailed(failedIds) } : {}) });
    body.replaceChildren(panel.el);
  }

  // «Llevar al chat» (2.8-T3 punto 2): bloque de 8.14 con lo más importante del resumen; copia o, si el portapapeles falla, lo deja para copiar a mano.
  async function bringSummaryToChat(full, names) {
    const made = buildSummaryChatBlock(full, { topicName: (id) => names.get(id) });
    if (!made.ok) { log('«Llevar al chat»: no se pudo armar el bloque del resumen', made.error); return { status: 'failed' }; }
    return copyForChat(made.text, services().clipboard ?? globalThis.navigator?.clipboard, { log });
  }

  // «Repetir los que fallé» (2.8-T3): mini-sesión con las mismas entradas de los ejercicios fallados, en una sesión nueva guardada.
  async function retryFailed(cardIds) {
    if (retrying || !driver) return;
    retrying = true;
    try {
      const wanted = new Set(cardIds);
      const r = await startRetrySession({ study: services().study, items: driver.getItems().filter((e) => wanted.has(e.cardId)) });
      if (!ctx.alive()) return;
      if (r.status === 'started') { go('sesion', { id: r.sessionId }); return; }
      services().toast?.show?.(TEXT.retryFail);
    } catch (e) {
      log('No se pudo preparar la mini-sesión', e);
      if (ctx.alive()) services().toast?.show?.(TEXT.retryFail);
    } finally { retrying = false; }
  }

  async function advance() {
    if (!driver) return;
    const r = await driver.next();
    if (!ctx.alive()) return;
    if (r.status === 'advanced') await present();
    else if (r.status === 'finished') await showSummary(r.summary);
  }

  async function run({ sessionId, state, items }) {
    sessionIdNow = sessionId;
    pausable = createPausableVisibility(services().visibility ?? createDocumentVisibility());
    timer = createAnswerTimer({ clock: services().study.clock, visibility: pausable });
    driver = createSessionDriver({ study: services().study, timer, sessionId, state, items, log });
    await driver.prepare();
    if (!ctx.alive()) return;
    mascot = createMascot({ size: 'sm' });
    bar = createProgressBar({ label: TEXT.progress, current: 0, total: state.total, showText: true, mascot: mascot.el });
    head.appendChild(bar.el);
    setupHelp();
    if (state.phase === 'next') await advance(); // sesión retomada con la respuesta ya guardada: se pasa al siguiente
    else await present();
  }

  async function begin() {
    body.replaceChildren(h('div', { class: 'stack' }, h('p', { class: 'text-sm text-muted' }, TEXT.loading), createSkeleton({ lines: 3 }).el));
    await Promise.resolve(); // TRAMPA-05: los servicios se completan tras startApp
    try { await services().studyReady; } catch (e) { log('Los servicios de estudio no estuvieron listos', e); }
    if (!ctx.alive()) return;
    const study = services().study;
    if (!study || !study.db || !study.session || typeof study.commit !== 'function') { showMessage(TEXT.noData, toBack()); return; }
    const id = ctx.params.id;
    if (id === NEW_SESSION_ID) {
      const r = await startSession({ study });
      if (!ctx.alive()) return;
      if (r.status === 'empty') { showMessage(r.plan?.reason?.message_es ?? TEXT.notFound, toBack()); return; }
      if (typeof services().navigate === 'function') { go('sesion', { id: r.sessionId }, { replace: true }); return; }
      await run(r);
      return;
    }
    const r = await resumeSession({ study, sessionId: id });
    if (!ctx.alive()) return;
    if (r.status !== 'restored') { showMessage(TEXT.notFound, button(TEXT.startNew, () => go('sesion', { id: NEW_SESSION_ID }, { replace: true }), 'primary'), toBack()); return; }
    await run(r);
  }

  try { await begin(); } catch (e) {
    log('No se pudo preparar la sesión', e);
    if (ctx.alive()) showMessage(TEXT.startFail, toBack());
  }
});
