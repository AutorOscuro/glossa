// @purpose: Pantalla base de la entrada de texto (2.5-T1): enunciado, máscara, pista, campo de ejercicio, «Comprobar» y «No sé», un solo envío, vacío no se envía, aviso ortográfico.
// Base común de los tipos de producción corta (roadmap 2.5, sección 17). Contrato del componente (sección 7):
//   createTextAnswer({ compare?, confusables?, answerLang?, log? }) → { mount(container, item, ctx) → { el, getResponse(), destroy() } }
//   mount lanza TypeError si el ítem no sirve (sin `accept`): el registro lo cuenta como «tipo no soportado todavía».
//   answerLang 'en' (por defecto) | 'es': idioma de la RESPUESTA. Pone `lang` en el campo y pasa `lang: 'es'` a compare (traducir palabra inverso).
//   prompt(item, { h, doc }) → Node | Node[] | null (opcional): pinta el enunciado en lugar del párrafo de `prompt_es` (2.5-T2: instrucción, frase con hueco y apoyo).
//       `null` o `[]` no pinta enunciado; si la función lanza, se avisa a `log` y se usa el párrafo de `prompt_es`.
//   Ayudas del gancho `prompt` (2.5-T3, punto 4): recibe también `insertText(texto)` (añade una palabra al campo con un espacio de por medio; no hace nada fuera de la fase de respuesta y respeta el tope de 200)
//       y `addControl(control)` (un botón de createButton que la pantalla bloquea, desbloquea y destruye junto con los demás).
//   detect / catalog (2.5-T5, opcionales; sin ninguno de los dos NO hay detector): `detect` función texto → hit[] (pruebas) y `catalog` el catálogo de errores o una función que lo devuelve (se lee al comprobar).
//       Con alguno, una respuesta `wrong` pasa por el detector mecánico de 1.6 (core/textErrors.js): `res.hints`/`res.hint` con la pista del primer aviso (`.ta__detect`, role note, solo si el tipo no pintó ya un aviso propio),
//       el código del aviso en `errorCodes` y, con catálogo válido, `errors` en el envío (entradas para errors.record; sin catálogo no se mandan: el commit rechazaría la respuesta entera).
//   grade(item, text, { compare, confusables, lang }) → igual que gradeText (opcional; por defecto gradeText). Puede añadir `trap`. Si lanza, se avisa a `log` y se usa gradeText.
//   notes(res, { h }) → Node | Node[] | null (opcional): avisos extra bajo el veredicto (p. ej. la trampa conocida). Si lanza, se avisa a `log` y se omite.
//   El ítem no trae el idioma de la respuesta: lo fija quien registra el tipo (2.5-T2), no el contenido.
// Datos que usa: item.prompt_es, item.situation, item.accept, item.data.hint, item.data.mask, item.explain_es, item.grammar_note_es, item.nuance_es.
// Lógica en core/textAnswer.js. El campo es createTextInput en modo `exercise` (sin autocorrección ni mayúscula forzada; Enter envía).
// Todo responseRaw pasa por toResponseRaw (TRAMPA-32). Una respuesta `almost` con errata crea la tarjeta de deletreo DESPUÉS de guardar (un fallo ahí no pierde la respuesta).
import { makeCtx } from '../components/_shared.js';
import { createButton } from '../components/button.js';
import { createTextInput } from '../components/textInput.js';
import { createWordDiff } from '../components/wordDiff.js';
import { createCardBar } from './cardBar.js';
import { feedbackNodes } from '../feedbackPanel.js';
import { reportFor } from '../reportMenu.js';
import { whyFor } from '../whyNote.js';
import { readText, maskHint, gradeText } from '../../core/textAnswer.js';
import { withDetection, errorEntries } from '../../core/textErrors.js';
import { createDetectSource, readCatalog } from './detectSource.js';
import { toResponseRaw } from '../../core/responseText.js';

const DIFF_MAX = 200;

export const TA_TEXT = Object.freeze({
  situation: 'Situación',
  field: 'Escribe tu respuesta',
  maskLabel: 'Ayuda visual',
  check: 'Comprobar',
  dontKnow: 'No sé',
  hint: 'Ver pista',
  hintUsed: 'Pista mostrada',
  empty: 'Escribe tu respuesta o toca «No sé».',
  saveFail: 'No se pudo guardar. Inténtalo otra vez.',
  correct: '¡Bien!',
  almost: 'Casi: revisa la ortografía de la palabra marcada.',
  wrong: 'Todavía no. Fíjate en la corrección:',
  dont: 'No pasa nada: así se dice.',
  answerIs: 'Respuesta:',
  diffLabel: 'Tu respuesta corregida',
  grammar: 'Gramática',
  nuance: 'Matiz',
  spellTyped: 'Ojo con la ortografía: escribiste',
  spellIs: 'y se escribe',
  spellCreated: 'La dejé como tarjeta de deletreo para que la repases.',
  spellExists: 'Ya la tienes entre tus tarjetas de deletreo.',
  spellFail: 'Ahora no pude crear la tarjeta de deletreo; tu respuesta sí quedó guardada.',
  detectHint: 'Pista:',
});

const isText = (v) => typeof v === 'string' && v.trim() !== '';

export function createTextAnswer(options = {}) {
  const opts = options !== null && typeof options === 'object' ? options : {};
  const answerLang = opts.answerLang === 'es' ? 'es' : 'en';
  const log = typeof opts.log === 'function' ? opts.log : () => {};
  const detecting = typeof opts.detect === 'function' || opts.catalog !== undefined;
  const detectNow = detecting ? createDetectSource({ catalog: opts.catalog, detect: opts.detect, log }) : null;
  return Object.freeze({
    mount(container, item, ctx = {}) {
      if (!container || typeof container.appendChild !== 'function') throw new TypeError('textAnswer: falta el contenedor');
      const parsed = readText(item);
      if (!parsed.ok) throw new TypeError('textAnswer: el ítem no tiene respuestas aceptadas (accept)');
      const c = makeCtx('textAnswer', { doc: container.ownerDocument ?? ctx.doc, win: ctx.win });
      const { h } = c;
      const mask = maskHint(item);
      const entry = ctx.entry !== null && typeof ctx.entry === 'object' ? ctx.entry : {};
      const bar = ctx.cards && isText(entry.cardId) ? createCardBar({ cards: ctx.cards, cardId: entry.cardId, doc: c.doc, win: ctx.win }) : null;

      const field = createTextInput({
        doc: c.doc, mode: 'exercise', lang: answerLang, maxLength: 200, ariaLabel: TA_TEXT.field,
        onSubmit: () => check(),
      });
      const msg = h('p', { class: 'ta__msg', role: 'status', 'aria-live': 'polite' });
      const hintLine = h('p', { class: 'ta__hint', 'aria-live': 'polite' });
      const feedback = h('div', { class: 'ta__feedback', 'aria-live': 'polite' });
      const checkBtn = createButton({ doc: c.doc, label: TA_TEXT.check, variant: 'primary', size: 'lg', block: true, onClick: () => check() });
      const hintBtn = parsed.hint ? createButton({ doc: c.doc, label: TA_TEXT.hint, variant: 'ghost', onClick: () => showHint() }) : null;
      const dontBtn = createButton({ doc: c.doc, label: TA_TEXT.dontKnow, variant: 'ghost', onClick: () => dontKnow() });
      const controls = [field, checkBtn, dontBtn, ...(hintBtn ? [hintBtn] : [])];

      const insertText = (word) => {
        if (phase !== 'answering' || destroyed || !isText(word)) return;
        const cur = field.getValue().replace(/\s+$/, '');
        field.setValue(`${cur === '' ? '' : `${cur} `}${word.trim()}`.slice(0, 200));
        msg.textContent = '';
        field.focus();
      };
      const addControl = (control) => { if (control && typeof control.setDisabled === 'function') controls.push(control); };
      const defaultPrompt = () => (isText(item.prompt_es) ? h('p', { class: 'ta__prompt', lang: 'es' }, item.prompt_es) : null);
      let promptEl;
      if (typeof opts.prompt === 'function') {
        try { promptEl = opts.prompt(item, { h, doc: c.doc, insertText, addControl }); } catch (e) { log('textAnswer: no se pudo pintar el enunciado', e); promptEl = defaultPrompt(); }
      } else {
        promptEl = defaultPrompt();
      }
      const el = h('article', { class: 'ta', dataset: { type: parsed.type || 'text_input' } },
        bar ? bar.el : null,
        isText(item.situation) ? h('p', { class: 'ta__situation' }, `${TA_TEXT.situation}: ${item.situation}`) : null,
        promptEl,
        mask ? h('p', { class: 'ta__mask', 'aria-label': `${TA_TEXT.maskLabel}: ${mask.replace(/\s+/g, ' ')}` }, h('span', { 'aria-hidden': 'true' }, mask)) : null,
        h('div', { class: 'ta__answer' }, field.el, msg, hintLine,
          h('div', { class: 'ta__actions' }, checkBtn.el, h('div', { class: 'ta__row' }, ...(hintBtn ? [hintBtn.el] : []), dontBtn.el))),
        feedback);
      container.appendChild(el);

      let phase = 'answering'; // answering → sending → done (un solo envío)
      let hintShown = false;
      let lastResponse = null;
      let destroyed = false;
      const disposers = [];
      const lock = (on) => { for (const x of controls) x.setDisabled(on); };

      function showHint() {
        if (phase !== 'answering' || hintShown || !parsed.hint) return;
        hintShown = true;
        hintLine.textContent = parsed.hint;
        hintBtn.setLabel(TA_TEXT.hintUsed);
        hintBtn.setDisabled(true);
      }

      function spellNote({ flag, status }) {
        const tail = status === 'created' ? TA_TEXT.spellCreated : status === 'exists' ? TA_TEXT.spellExists : status === 'error' ? TA_TEXT.spellFail : '';
        return h('p', { class: 'ta__spell' }, `${TA_TEXT.spellTyped} «`, h('strong', {}, flag.word), `» ${TA_TEXT.spellIs} «`, h('strong', {}, flag.expected), tail ? `». ${tail}` : '».');
      }

      async function spellEffect(res) {
        const flag = res.result === 'almost' && Array.isArray(res.spellingFlags)
          ? res.spellingFlags.find((f) => f && typeof f.expected === 'string' && typeof f.word === 'string') : null;
        if (!flag) return null;
        let status = 'none';
        if (ctx.cards && typeof ctx.cards.ensureSpell === 'function') {
          try { status = (await ctx.cards.ensureSpell(flag))?.status ?? 'error'; } catch { status = 'error'; }
        }
        return { flag, status };
      }

      function paintFeedback(res, correctText, spell) {
        const before = [];
        if (res.result !== 'dont_know' && res.diff && res.diff.length) {
          // Una palabra muy larga (respuesta hostil de miles de letras) no cabe en `wordDiff` (máx. 200): se recorta para no perder la corrección.
          const clip = (t) => (typeof t === 'string' && t.length > DIFF_MAX ? `${t.slice(0, DIFF_MAX - 1)}…` : t);
          try {
            const wd = createWordDiff({ doc: c.doc, label: TA_TEXT.diffLabel, words: res.diff.map((d) => ({ text: clip(d.text), status: d.status, expected: clip(d.expected) })) });
            before.push(wd.el);
            disposers.push(() => wd.destroy());
          } catch (e) { log('textAnswer: no se pudo pintar la diferencia', e); }
        }
        let noted = false;
        if (typeof opts.notes === 'function') {
          try { const extra = opts.notes(res, { h }); const list = (Array.isArray(extra) ? extra : [extra]).filter(Boolean); noted = list.length > 0; before.push(...list); } catch (e) { log('textAnswer: no se pudo pintar el aviso', e); }
        }
        if (!noted && res.result === 'wrong' && isText(res.hint)) before.push(h('p', { class: 'ta__detect', role: 'note' }, `${TA_TEXT.detectHint} ${res.hint.trim()}`));
        if (spell) before.push(spellNote(spell));
        // Veredicto, respuesta correcta y notas del ítem: panel común (2.6-T1). Tipos de texto: «almost» existe (no binario).
        const tail = res.result === 'wrong' ? 'Fíjate en la corrección:' : res.result === 'dont_know' ? 'así se dice.' : '';
        feedback.replaceChildren(...feedbackNodes({ h, result: res.result, item, tail, before: before.filter(Boolean), answer: correctText || null, why: whyFor(h, ctx, item), report: reportFor(h, ctx, item) }));
      }

      async function send(answer, res, correctText) {
        if (phase !== 'answering') return;
        phase = 'sending';
        lock(true);
        let r;
        try { r = ctx.submit ? await ctx.submit(answer) : { status: 'ignored' }; } catch (e) { log('textAnswer: no se pudo enviar', e); r = { status: 'error' }; }
        const saved = Boolean(r) && (r.status === 'saved' || r.status === 'duplicate');
        const spell = saved ? await spellEffect(res) : null;
        if (destroyed) return;
        if (r && r.status === 'error') {
          phase = 'answering';
          lock(false);
          if (hintShown && hintBtn) hintBtn.setDisabled(true);
          msg.textContent = isText(r.message) ? r.message : TA_TEXT.saveFail;
          return;
        }
        phase = 'done';
        msg.textContent = '';
        if (r && r.status === 'ignored') return;
        paintFeedback(res, correctText, spell);
        if (bar) bar.refresh({ dueLabel: r?.dueLabel }).catch(() => {});
      }

      function check() {
        if (phase !== 'answering') return;
        const gopts = { compare: opts.compare, confusables: opts.confusables, lang: answerLang };
        let g;
        if (typeof opts.grade === 'function') {
          try { g = opts.grade(item, field.getValue(), gopts); } catch (e) { log('textAnswer: falló la calificación propia; se usa la base', e); }
        }
        if (g === undefined || g === null || typeof g !== 'object') g = gradeText(item, field.getValue(), gopts);
        if (g.empty) { msg.textContent = TA_TEXT.empty; field.focus(); return; }
        msg.textContent = '';
        lastResponse = g.typed;
        if (detectNow !== null) g = withDetection(g, { detect: detectNow });
        const errors = detectNow !== null ? errorEntries(item, g, { catalog: readCatalog(opts.catalog) }) : [];
        send({ result: g.result, hint: hintShown, responseRaw: toResponseRaw(g.typed), errorCodes: g.errorCodes, ...(errors.length > 0 ? { errors } : {}) }, g, g.matched ?? parsed.accept[0]);
      }

      function dontKnow() {
        if (phase !== 'answering') return;
        msg.textContent = '';
        lastResponse = null;
        send({ result: 'dont_know', dontKnow: true, hint: hintShown }, { result: 'dont_know', diff: [] }, parsed.accept[0]);
      }

      return {
        el,
        getResponse: () => (phase === 'answering' ? (field.getValue().trim() || null) : lastResponse),
        destroy() {
          if (destroyed) return;
          destroyed = true;
          for (const d of disposers) { try { d(); } catch { /* limpieza */ } }
          for (const x of controls) { try { x.destroy(); } catch { /* limpieza */ } }
          if (bar) bar.destroy();
          c.dispose();
          if (typeof el.remove === 'function') el.remove();
        },
      };
    },
  });
}

export default createTextAnswer;
