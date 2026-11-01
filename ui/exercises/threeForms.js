// @purpose: Pantalla de three_forms (2.5-T3, punto 2): tres campos (presente, pasado, participio), «Comprobar» exige las tres, corrección por forma y un solo envío por tarjeta.
// Contrato del componente (sección 7):
//   createThreeForms({ compare?, confusables?, catalog?, detect?, log? }) → { mount(container, item, ctx) → { el, getResponse(), destroy() } }
//   mount lanza TypeError si el ítem no trae las tres formas (data.forms; core/threeForms.js): el registro lo cuenta como «tipo no soportado todavía».
// Datos que usa: item.prompt_es (el verbo en español), item.situation, item.data.forms, item.data.hint, item.explain_es, item.grammar_note_es, item.nuance_es.
// Envío (pregunta 10, provisional): la sesión trae UNA tarjeta por faceta (ctx.entry.facet: 0 presente, 1 pasado, 2 participio), así que se guarda UNA respuesta cuyo `result`
//   es el de la forma de esa faceta; las otras dos se enseñan corregidas pero no cambian ese resultado (CA 4). Sin faceta válida el `result` es el global de las tres.
//   «Comprobar» → ctx.submit({ result, hint, responseRaw, errorCodes }) con `responseRaw` por toResponseRaw (TRAMPA-32) sobre «sing / sang / sung»; «No sé» → ctx.submit({ result: 'dont_know', dontKnow: true, hint }).
//   Una forma vacía NO se envía (avisa y deja los campos libres). Un solo envío bueno; si `submit` devuelve `error` o lanza, se desbloquea y se puede reintentar; `ignored` no pinta nada.
// Detector (2.5-T5, opcional; sin `catalog` ni `detect` no hay detector): cada forma `wrong` pasa por el detector mecánico de 1.6 («leaved», «eated»…). La pista del primer aviso sale en `.ta__detect`
//   (role note) y, con catálogo válido, el envío lleva `errors` (entradas para errors.record; core/textErrors.js) de la forma de la faceta (o de todas las incorrectas si la tarjeta no trae faceta). `errorCodes` suma el código del aviso.
// Marcado: `.tf` con `.ta__*` de la pantalla base donde coincide; una fila `.tf__form` por forma con `data-form` (present|past|participle).
// Sin tarjeta de deletreo todavía (límite conocido). Todo texto en español.
import { makeCtx } from '../components/_shared.js';
import { createButton } from '../components/button.js';
import { createTextInput } from '../components/textInput.js';
import { createCardBar } from './cardBar.js';
import { feedbackNodes } from '../feedbackPanel.js';
import { reportFor } from '../reportMenu.js';
import { whyFor } from '../whyNote.js';
import { readForms, gradeForms } from '../../core/threeForms.js';
import { toResponseRaw } from '../../core/responseText.js';
import { withDetection, errorEntries, MAX_TEXT_ERRORS } from '../../core/textErrors.js';
import { createDetectSource, readCatalog } from './detectSource.js';

export const TF_TEXT = Object.freeze({
  situation: 'Situación',
  instruction: 'Escribe las tres formas del verbo.',
  labels: Object.freeze({ present: 'Presente', past: 'Pasado', participle: 'Participio' }),
  check: 'Comprobar',
  dontKnow: 'No sé',
  hint: 'Ver pista',
  hintUsed: 'Pista mostrada',
  empty: 'Escribe las tres formas o toca «No sé».',
  saveFail: 'No se pudo guardar. Inténtalo otra vez.',
  correct: '¡Bien!',
  almost: 'Casi: revisa la ortografía.',
  wrong: 'Todavía no. Fíjate en cada forma:',
  dont: 'No pasa nada: son estas.',
  formCorrect: 'Bien',
  formAlmost: 'Casi',
  formWrong: 'Todavía no',
  answerIs: 'Se dice',
  swapped: 'Esa es la forma del',
  swappedNames: Object.freeze({ present: 'presente', past: 'pasado', participle: 'participio' }),
  grammar: 'Gramática',
  nuance: 'Matiz',
  detectHint: 'Pista:',
});

const isText = (v) => typeof v === 'string' && v.trim() !== '';
const VERDICT = { correct: 'correct', almost: 'almost', wrong: 'wrong' };

export function createThreeForms(options = {}) {
  const opts = options !== null && typeof options === 'object' ? options : {};
  const log = typeof opts.log === 'function' ? opts.log : () => {};
  const detectNow = typeof opts.detect === 'function' || opts.catalog !== undefined ? createDetectSource({ catalog: opts.catalog, detect: opts.detect, log }) : null;
  return Object.freeze({
    mount(container, item, ctx = {}) {
      if (!container || typeof container.appendChild !== 'function') throw new TypeError('threeForms: falta el contenedor');
      const parsed = readForms(item);
      if (!parsed.ok) throw new TypeError('threeForms: el ítem no tiene las tres formas (data.forms)');
      const c = makeCtx('threeForms', { doc: container.ownerDocument ?? ctx.doc, win: ctx.win });
      const { h } = c;
      const entry = ctx.entry !== null && typeof ctx.entry === 'object' ? ctx.entry : {};
      const bar = ctx.cards && isText(entry.cardId) ? createCardBar({ cards: ctx.cards, cardId: entry.cardId, doc: c.doc, win: ctx.win }) : null;
      const hintText = typeof item.data?.hint === 'string' && item.data.hint.trim() !== '' ? item.data.hint.trim() : null;

      const fields = parsed.forms.map((f) => createTextInput({
        doc: c.doc, mode: 'exercise', lang: 'en', maxLength: 200, label: TF_TEXT.labels[f.key], onSubmit: () => check(),
      }));
      const msg = h('p', { class: 'ta__msg', role: 'status', 'aria-live': 'polite' });
      const hintLine = h('p', { class: 'ta__hint', 'aria-live': 'polite' });
      const feedback = h('div', { class: 'ta__feedback', 'aria-live': 'polite' });
      const checkBtn = createButton({ doc: c.doc, label: TF_TEXT.check, variant: 'primary', size: 'lg', block: true, onClick: () => check() });
      const hintBtn = hintText ? createButton({ doc: c.doc, label: TF_TEXT.hint, variant: 'ghost', onClick: () => showHint() }) : null;
      const dontBtn = createButton({ doc: c.doc, label: TF_TEXT.dontKnow, variant: 'ghost', onClick: () => dontKnow() });
      const controls = [...fields, checkBtn, dontBtn, ...(hintBtn ? [hintBtn] : [])];

      const el = h('article', { class: 'tf ta', dataset: { type: 'three_forms' } },
        bar ? bar.el : null,
        isText(item.situation) ? h('p', { class: 'ta__situation' }, `${TF_TEXT.situation}: ${item.situation}`) : null,
        h('p', { class: 'ta__instruction' }, TF_TEXT.instruction),
        isText(item.prompt_es) ? h('p', { class: 'ta__prompt', lang: 'es' }, item.prompt_es) : null,
        h('div', { class: 'ta__answer' }, ...fields.map((f) => f.el), msg, hintLine,
          h('div', { class: 'ta__actions' }, checkBtn.el, h('div', { class: 'ta__row' }, ...(hintBtn ? [hintBtn.el] : []), dontBtn.el))),
        feedback);
      container.appendChild(el);

      let phase = 'answering'; // answering → sending → done (un solo envío)
      let hintShown = false;
      let lastResponse = null;
      let destroyed = false;
      const lock = (on) => { for (const x of controls) x.setDisabled(on); };
      const values = () => fields.map((f) => f.getValue());
      const facetOf = () => (Number.isInteger(entry.facet) && entry.facet >= 0 && entry.facet < parsed.forms.length ? entry.facet : null);

      function showHint() {
        if (phase !== 'answering' || hintShown || !hintText) return;
        hintShown = true;
        hintLine.textContent = hintText;
        hintBtn.setLabel(TF_TEXT.hintUsed);
        hintBtn.setDisabled(true);
      }

      function formRow(f, g) {
        const verdict = g ? (VERDICT[g.result] ?? 'wrong') : null;
        const mark = verdict === 'correct' ? TF_TEXT.formCorrect : verdict === 'almost' ? TF_TEXT.formAlmost : verdict === 'wrong' ? TF_TEXT.formWrong : '';
        const accepted = f.accept.join(' / ');
        const parts = [h('strong', {}, `${TF_TEXT.labels[f.key]}: `)];
        if (g) parts.push(g.typed, ` — ${mark}`);
        else parts.push(accepted);
        if (g && verdict !== 'correct') parts.push(`. ${TF_TEXT.answerIs}: `, h('strong', {}, accepted));
        if (g && g.swappedWith) parts.push(`. ${TF_TEXT.swapped} ${TF_TEXT.swappedNames[g.swappedWith]}.`);
        return h('p', { class: ['tf__form', verdict ? `tf__form--${verdict}` : ''], dataset: { form: f.key } }, ...parts);
      }

      // Detector sobre las formas incorrectas que cuentan: la de la faceta, o todas si la tarjeta no trae faceta. → { errors, hint, codes }
      function detectForms(g, facet) {
        const out = { errors: [], hint: null, codes: [] };
        if (detectNow === null) return out;
        const catalog = readCatalog(opts.catalog);
        const pool = facet === null ? g.forms : [g.forms[facet]];
        for (const f of pool) {
          if (f.result !== 'wrong' || f.empty) continue;
          const d = withDetection({ result: 'wrong', typed: f.typed, empty: false, errorCodes: [] }, { detect: detectNow });
          if (out.hint === null && typeof d.hint === 'string') out.hint = d.hint;
          out.codes.push(...d.errorCodes.filter((x) => !out.codes.includes(x)));
          const accept = parsed.forms.find((p) => p.key === f.key)?.accept ?? [];
          out.errors.push(...errorEntries({ accept, situation: item.situation, topics: item.topics }, { ...d, matched: null }, { catalog, max: MAX_TEXT_ERRORS }));
        }
        // El mismo error escrito en dos formas («leaved» en pasado y participio) cuenta una vez por respuesta.
        out.errors = out.errors.filter((e, i, list) => list.findIndex((x) => x.code === e.code && x.original === e.original) === i).slice(0, MAX_TEXT_ERRORS);
        return out;
      }

      let detectHintText = null;

      function paintFeedback(overall, graded) {
        // Las filas de formas son la corrección (se ven también al acertar): van como extra; veredicto y notas, del panel común (2.6-T1).
        const before = parsed.forms.map((f) => formRow(f, graded ? graded.forms.find((x) => x.key === f.key) : null));
        if (overall === 'wrong' && isText(detectHintText)) before.push(h('p', { class: 'ta__detect', role: 'note' }, `${TF_TEXT.detectHint} ${detectHintText.trim()}`));
        const tail = overall === 'wrong' ? 'Fíjate en cada forma:' : overall === 'dont_know' ? 'son estas.' : '';
        const verdict = overall === 'almost' ? TF_TEXT.almost : null;
        feedback.replaceChildren(...feedbackNodes({ h, result: overall, item, tail, verdict, before: before.filter(Boolean), why: whyFor(h, ctx, item), report: reportFor(h, ctx, item) }));
      }

      async function send(answer, overall, graded) {
        if (phase !== 'answering') return;
        phase = 'sending';
        lock(true);
        let r;
        try { r = ctx.submit ? await ctx.submit(answer) : { status: 'ignored' }; } catch (e) { log('threeForms: no se pudo enviar', e); r = { status: 'error' }; }
        if (destroyed) return;
        if (r && r.status === 'error') {
          phase = 'answering';
          lock(false);
          if (hintShown && hintBtn) hintBtn.setDisabled(true);
          msg.textContent = isText(r.message) ? r.message : TF_TEXT.saveFail;
          return;
        }
        phase = 'done';
        msg.textContent = '';
        if (r && r.status === 'ignored') return;
        paintFeedback(overall, graded);
        if (bar) bar.refresh({ dueLabel: r?.dueLabel }).catch(() => {});
      }

      function check() {
        if (phase !== 'answering') return;
        const g = gradeForms(item, values(), { compare: opts.compare, confusables: opts.confusables });
        if (g.anyEmpty) { msg.textContent = TF_TEXT.empty; const first = fields.find((f, i) => g.forms[i].empty); if (first) first.focus(); return; }
        msg.textContent = '';
        const facet = facetOf();
        const own = facet === null ? g : g.forms[facet];
        lastResponse = g.forms.map((f) => f.typed).join(' / ');
        const det = detectForms(g, facet);
        detectHintText = det.hint;
        const base = facet === null ? g.forms.flatMap((f) => f.errorCodes) : own.errorCodes;
        const codes = det.codes.reduce((acc, x) => (acc.includes(x) ? acc : [...acc, x]), base);
        send({ result: own.result, hint: hintShown, responseRaw: toResponseRaw(lastResponse), errorCodes: codes, ...(det.errors.length > 0 ? { errors: det.errors } : {}) }, own.result, g);
      }

      function dontKnow() {
        if (phase !== 'answering') return;
        msg.textContent = '';
        lastResponse = null;
        send({ result: 'dont_know', dontKnow: true, hint: hintShown }, 'dont_know', null);
      }

      return {
        el,
        getResponse: () => {
          if (phase !== 'answering') return lastResponse;
          const typed = values().map((v) => (typeof v === 'string' ? v.trim() : ''));
          return typed.some((v) => v !== '') ? typed.join(' / ') : null;
        },
        destroy() {
          if (destroyed) return;
          destroyed = true;
          for (const x of controls) { try { x.destroy(); } catch { /* limpieza */ } }
          if (bar) bar.destroy();
          c.dispose();
          if (typeof el.remove === 'function') el.remove();
        },
      };
    },
  });
}

export default createThreeForms;
