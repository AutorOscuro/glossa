// @purpose: Componente de emparejar por toques (2.4-T2, punto 3): dos columnas, feedback inmediato por pareja, envío al completar y «No sé» siempre a la vista.
// Componente `match_pairs` (subparte 2.4, tramo 2). Contrato del componente (roadmap 8.9 y ficha «2.1-T4» de docs/CONTRACTS.md):
//   createMatchPairs(opciones).mount(container, item, ctx) → { el, destroy(), getResponse() }
//
// Este punto NO registra el tipo en app/main.js y NO trae CSS (eso es el punto 4); sin CSS la pantalla funciona pero se ve cruda.
// Opciones de createMatchPairs (todas opcionales):
//   rng        azar con shuffle (core/rng.js); por defecto el del sistema. La columna derecha se baraja en CADA montaje.
//   leftLang   'en'. Idioma de la columna izquierda, para el lector de pantalla.   rightLang  'es'. Idioma de la derecha.
//   log        console.error. Recibe los fallos al pintar el cierre (la respuesta ya quedó guardada).
//
// Datos que usa: item.prompt_es (obligatorio), item.situation, item.data.{pairs, extra_right} (contrato en core/matchPairs.js).
// Interacción solo por toques, en cualquier orden: un toque elige una tarjeta de un lado y otro toque en el lado contrario resuelve la pareja al instante.
// Acierto: las dos tarjetas quedan bloqueadas con el mismo número y la marca «✓». Fallo: las dos se marcan «✗» hasta el siguiente toque y nada queda resuelto.
// Sin «deshacer» ni «empezar de nuevo»: el feedback por pareja es definitivo (decisión provisional, DECISIONS.md, 2.4-T2 punto 2).
// Al resolver la última pareja se envía solo, sin botón «Comprobar»; «No sé» está siempre a la vista mientras se responde.
// Envío: ctx.submit({ result, hint: false, responseRaw, errorCodes: [] }) al completar; ctx.submit({ result: 'dont_know', dontKnow: true, hint: false }) con «No sé».
// Si submit devuelve error, las tarjetas siguen bloqueadas, aparece «Enviar otra vez» y el aviso; no se pierde nada. Todo texto entra con h() como nodo de texto (nunca HTML).
// Las marcas ✓ y ✗ llevan texto y el número de pareja: el significado no depende solo del color.
import { makeCtx, uid, setAttr, setFlag } from '../components/_shared.js';
import { createButton } from '../components/button.js';
import { readMatch, gradeMatch, createMatchState, pickMatch, isMatchComplete } from '../../core/matchPairs.js';
import { systemRng } from '../../core/rng.js';
import { feedbackNodes } from '../feedbackPanel.js';
import { reportFor } from '../reportMenu.js';
import { whyFor } from '../whyNote.js';
import { toResponseRaw } from '../../core/responseText.js';

export const MA_TEXT = Object.freeze({
  situation: 'Situación',
  instruction: 'Toca una tarjeta de cada columna para unirlas.',
  leftLabel: 'Columna izquierda',
  rightLabel: 'Columna derecha',
  dontKnow: 'No sé',
  retry: 'Enviar otra vez',
  saveFail: 'No se pudo guardar. Inténtalo otra vez.',
  hit: '✓ Pareja correcta.',
  miss: (a, b) => `✗ «${a}» no va con «${b}». Prueba otra vez.`,
  progress: (done, total) => `${done} de ${total} parejas`,
  correct: '¡Bien! Todas las parejas, sin fallos.',
  withMistakes: (n) => `Completado, con ${n} ${n === 1 ? 'fallo' : 'fallos'}. Así van las parejas:`,
  dont: 'No pasa nada: así van las parejas:',
  selectedName: (t) => `${t} (elegido)`,
  doneName: (t, n) => `${t} (pareja ${n}, emparejado)`,
  missName: (t) => `${t} (✗ no coincide)`,
  pairLine: (a, b) => `${a} = ${b}`,
});

function need(cond, message) {
  if (!cond) throw new TypeError(`match_pairs: ${message}`);
}
const goodLang = (v) => typeof v === 'string' && /^[a-z]{2,3}$/.test(v);

export function createMatchPairs(options = {}) {
  const opts = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
  if (opts.rng !== undefined) need(opts.rng && typeof opts.rng.shuffle === 'function', 'rng debe tener una función shuffle (core/rng.js)');
  for (const k of ['leftLang', 'rightLang']) need(opts[k] === undefined || goodLang(opts[k]), `${k} debe ser un código de idioma como "en" o "es"`);
  const rng = opts.rng ?? systemRng;
  const leftLang = opts.leftLang ?? 'en';
  const rightLang = opts.rightLang ?? 'es';
  const log = typeof opts.log === 'function' ? opts.log : console.error;

  return Object.freeze({
    mount(container, item, ctx = {}) {
      need(container && typeof container.appendChild === 'function', 'falta el contenedor');
      need(item && typeof item === 'object' && typeof item.type === 'string' && item.type !== '', 'el ítem no tiene tipo');
      need(typeof item.prompt_es === 'string' && item.prompt_es.trim() !== '', 'falta prompt_es');
      const read = readMatch(item);
      need(read.ok, `el ítem de emparejar no es válido (${read.reason})`);

      const c = makeCtx('match_pairs', { doc: container.ownerDocument ?? ctx.doc, win: ctx.win });
      const { h } = c;
      const n = read.pairs.length;
      const cards = [...read.rights, ...read.extra]; // índice de tarjeta de la derecha: < n es la pareja de ese `left`
      let state = createMatchState(n, read.extra.length, { rng });

      const promptId = uid('ma-prompt');
      const msg = h('p', { class: 'ma__msg', role: 'status', 'aria-live': 'polite' });
      const progressEl = h('p', { class: 'ma__progress' });
      const leftEls = read.lefts.map((t, i) => h('button', { type: 'button', class: 'ma__card ma__card--left', lang: leftLang, dataset: { side: 'left', index: i } }, t));
      // La columna derecha se pinta UNA vez, en su orden fijo (las tarjetas no se mueven al emparejar).
      const rightEls = state.tray.map((k) => h('button', { type: 'button', class: 'ma__card ma__card--right', lang: rightLang, dataset: { side: 'right', index: k } }, cards[k]));
      const leftCol = h('div', { class: 'ma__col', role: 'group', 'aria-label': MA_TEXT.leftLabel }, leftEls);
      const rightCol = h('div', { class: 'ma__col', role: 'group', 'aria-label': MA_TEXT.rightLabel }, rightEls);
      const dontBtn = createButton({ doc: c.doc, label: MA_TEXT.dontKnow, variant: 'ghost', size: 'lg', onClick: () => dontKnow() });
      const retryBtn = createButton({ doc: c.doc, label: MA_TEXT.retry, variant: 'primary', size: 'lg', onClick: () => submitDone() });
      retryBtn.el.setAttribute('hidden', '');
      const actions = h('div', { class: 'ma__actions' }, msg, h('div', { class: 'ma__buttons' }, retryBtn.el, dontBtn.el));
      const feedback = h('div', { class: 'ma__feedback', 'aria-live': 'polite' });
      const el = h('article', { class: 'ma', dataset: { type: item.type } },
        typeof item.situation === 'string' && item.situation.trim() ? h('p', { class: 'ma__situation' }, `${MA_TEXT.situation}: ${item.situation}`) : null,
        h('p', { class: 'ma__prompt', id: promptId, lang: 'es' }, item.prompt_es),
        h('p', { class: 'ma__instruction' }, MA_TEXT.instruction),
        progressEl,
        h('div', { class: 'ma__cols' }, leftCol, rightCol),
        actions, feedback);
      container.appendChild(el);

      let phase = 'answering'; // answering → sending → done
      let lastResponse = null;
      let destroyed = false;
      const all = [...leftEls, ...rightEls];
      const textOf = (b) => (b.dataset.side === 'left' ? read.lefts[Number(b.dataset.index)] : cards[Number(b.dataset.index)]);

      function render() {
        const sel = state.selected;
        const miss = state.last !== null && !state.last.ok && sel === null ? state.last : null;
        for (const b of all) {
          const side = b.dataset.side;
          const i = Number(b.dataset.index);
          const pos = i < n ? state.solved.indexOf(i) : -1;
          const done = pos >= 0;
          const picked = sel !== null && sel.side === side && sel.index === i;
          const off = miss !== null && ((side === 'left' && miss.left === i) || (side === 'right' && miss.right === i));
          setFlag(b, 'is-done', done);
          setFlag(b, 'is-selected', picked);
          setFlag(b, 'is-miss', off);
          setAttr(b, 'aria-disabled', done || phase !== 'answering' ? 'true' : null);
          setAttr(b, 'aria-pressed', done ? null : picked ? 'true' : 'false');
          b.setAttribute('aria-label', done ? MA_TEXT.doneName(textOf(b), pos + 1) : picked ? MA_TEXT.selectedName(textOf(b)) : off ? MA_TEXT.missName(textOf(b)) : textOf(b));
          const tag = b.querySelector('.ma__tag');
          if (done && !tag) b.appendChild(h('span', { class: 'ma__tag', 'aria-hidden': 'true' }, `✓ ${pos + 1}`));
          if (!done && tag) tag.remove();
        }
        progressEl.textContent = MA_TEXT.progress(state.solved.length, n);
      }

      function pick(side, index) {
        if (phase !== 'answering') return;
        const next = pickMatch(state, side, index);
        if (next === state) return;
        state = next;
        const last = state.last;
        const fresh = last !== null && state.attempts.length > 0 && state.selected === null;
        msg.textContent = fresh ? (last.ok ? MA_TEXT.hit : MA_TEXT.miss(read.lefts[last.left], cards[last.right])) : '';
        render();
        if (isMatchComplete(state)) submitDone();
      }
      for (const b of all) c.listen(b, 'click', () => pick(b.dataset.side, Number(b.dataset.index)));

      function lock(on) {
        for (const b of all) setAttr(b, 'aria-disabled', on || state.solved.includes(Number(b.dataset.index)) && b.dataset.index < n ? 'true' : null);
        setFlag(el, 'is-locked', on);
        dontBtn.setDisabled(on);
        retryBtn.setDisabled(on);
      }

      function paintFeedback(g, dont) {
        actions.setAttribute('hidden', '');
        // Veredicto, pares correctos y notas del ítem: panel común (2.6-T1). Emparejar es binario: nunca «casi».
        const verdict = dont ? MA_TEXT.dont : g.result === 'correct' ? MA_TEXT.correct : MA_TEXT.withMistakes(g.mistakes);
        const answer = !dont && g.result === 'correct' ? null
          : h('p', { class: 'ma__correct' }, read.pairs.flatMap((p, i) => [i > 0 ? h('br') : null, h('strong', {}, MA_TEXT.pairLine(p.left, p.right))]));
        feedback.replaceChildren(...feedbackNodes({ h, result: dont ? 'dont_know' : g.result, item, binary: true, verdict, answer, why: whyFor(h, ctx, item), report: reportFor(h, ctx, item) }));
      }

      async function send(answer, g, dont) {
        if (phase === 'sending' || phase === 'done') return;
        phase = 'sending';
        lock(true);
        let r;
        try { r = ctx.submit ? await ctx.submit(answer) : { status: 'ignored' }; } catch { r = { status: 'error' }; }
        if (destroyed) return;
        if (r && r.status === 'error') {
          phase = 'answering';
          lock(false);
          if (isMatchComplete(state)) retryBtn.el.removeAttribute('hidden');
          msg.textContent = typeof r.message === 'string' && r.message ? r.message : MA_TEXT.saveFail;
          return;
        }
        phase = 'done';
        msg.textContent = '';
        render();
        if (r && r.status === 'ignored') return;
        try { paintFeedback(g, dont); } catch (e) { log('No se pudo mostrar el cierre del ejercicio de emparejar', e); }
      }

      function submitDone() {
        if (phase !== 'answering' || !isMatchComplete(state)) return;
        const g = gradeMatch(item, state.attempts);
        lastResponse = toResponseRaw(g.text); // TRAMPA-32: todo responseRaw pasa por toResponseRaw
        send({ result: g.result, hint: false, responseRaw: lastResponse, errorCodes: [] }, g, false);
      }

      function dontKnow() {
        if (phase !== 'answering') return;
        msg.textContent = '';
        lastResponse = null;
        send({ result: 'dont_know', dontKnow: true, hint: false }, { result: 'wrong', mistakes: 0 }, true);
      }

      render();
      return {
        el,
        getResponse: () => (phase === 'answering'
          ? (toResponseRaw(gradeMatch(item, state.attempts).text) || null)
          : lastResponse),
        destroy() {
          if (destroyed) return;
          destroyed = true;
          for (const b of [dontBtn, retryBtn]) { try { b.destroy(); } catch { /* limpieza */ } }
          c.dispose();
          if (typeof el.remove === 'function') el.remove();
        },
      };
    },
  });
}

export default createMatchPairs;
