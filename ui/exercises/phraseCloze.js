// @purpose: Tarjeta phrase_cloze: turnos A/B, clave en verde en ES y EN, hueco, cajas de gramática y matiz, respuesta por teclado, insignias y aviso ortográfico con tarjeta de deletreo.
// Tarjeta phrase_cloze, parte de RENDER (2.2-T1). Contrato del componente (roadmap sección 7):
//   phraseCloze.mount(container, item, ctx) → { el, destroy(), getResponse() }
// T1 dibuja; T2 añade la respuesta: un campo por hueco (teclado de ejercicio), micrófono DESHABILITADO («disponible pronto», llega en 8.1),
// «Ver pista» progresiva (1 primera letra, 2 estructura; cualquier pista envía hint:true), «No sé» (dont_know) y «Comprobar»
// (compare → submit; la corrección con wordDiff se pinta en la tarjeta y la vista pone «Continuar»). Una respuesta vacía no se envía.
// T3 añade las INSIGNIAS y los EFECTOS: si el registro entrega ctx.cards (app/cardActions.js) y la entrada trae cardId, arriba van `Nivel N (?)`, `New`,
// `Repaso en …` y el corazón (ver ui/exercises/cardBar.js); al responder se actualizan con la etiqueta de la calificación. Si la respuesta es `almost`,
// la corrección muestra el aviso ortográfico y se crea la tarjeta `spell` (evento `note` + tarjeta; sin duplicados) DESPUÉS de guardar la respuesta: un fallo ahí
// nunca pierde la respuesta ni bloquea el «Continuar». Sin ctx.cards la tarjeta funciona igual, sin insignias ni tarjeta de deletreo.
// createPhraseCloze({ compare?, confusables? }) permite inyectar la comparación (pruebas) y los confusables.
//
// Datos que usa (ver docs/CONTRACTS.md, ficha «2.2-T1 (entrega 1)»):
//   item.prompt_es (obligatorio), item.situation, item.grammar_note_es, item.nuance_es,
//   item.data.text (réplica en inglés con hueco ___), item.data.answers, item.data.key_es, item.data.key_en, item.data.turns.
// Todo texto entra con h() como nodo de texto (nunca HTML). La clave se resalta con <strong class="pc__key"> (negrita + verde:
// el significado no depende solo del color). El hueco es <span class="pc__gap" role="img" aria-label="hueco">.
import { makeCtx } from '../components/_shared.js';
import { createButton } from '../components/button.js';
import { createTextInput } from '../components/textInput.js';
import { createWordDiff } from '../components/wordDiff.js';
import { createCardBar } from './cardBar.js';
import { feedbackNodes } from '../feedbackPanel.js';
import { reportFor } from '../reportMenu.js';
import { whyFor } from '../whyNote.js';
import { countGaps, hintFor, grade, acceptList } from '../../core/phraseCloze.js';
import { toResponseRaw } from '../../core/responseText.js';

export const PC_TEXT = Object.freeze({
  gap: 'hueco',
  situation: 'Situación',
  grammar: 'Gramática',
  nuance: 'Matiz',
  spanish: 'En español',
  english: 'En inglés',
  turnA: 'Persona A',
  turnB: 'Persona B',
  fieldOne: 'Escribe lo que va en el hueco',
  fieldN: (n) => `Hueco ${n}`,
  check: 'Comprobar',
  dontKnow: 'No sé',
  hint: 'Ver pista',
  hintMore: 'Otra pista',
  hintNone: 'Sin más pistas',
  mic: 'Decir la respuesta',
  micSoon: 'Micrófono: disponible pronto. Por ahora, escribe.',
  empty: 'Escribe tu respuesta o toca «No sé».',
  saveFail: 'No se pudo guardar. Inténtalo otra vez.',
  correct: '¡Bien!',
  almost: 'Casi: revisa la ortografía de la palabra marcada.',
  wrong: 'Todavía no. Fíjate en la corrección:',
  dont: 'No pasa nada: así se dice.',
  answerIs: 'Respuesta:',
  diffLabel: 'Tu respuesta corregida',
  spellTyped: 'Ojo con la ortografía: escribiste',
  spellIs: 'y se escribe',
  spellCreated: 'La dejé como tarjeta de deletreo para que la repases.',
  spellExists: 'Ya la tienes entre tus tarjetas de deletreo.',
  spellFail: 'Ahora no pude crear la tarjeta de deletreo; tu respuesta sí quedó guardada.',
});

const GAP_RE = /_{2,}/;

// Parte `text` en trozos { text, key } resaltando la PRIMERA aparición de `key` (sin distinguir mayúsculas ni acentos de caso).
export function splitKey(text, key) {
  const t = typeof text === 'string' ? text : '';
  const k = typeof key === 'string' ? key.trim() : '';
  if (!t) return [];
  if (!k) return [{ text: t, key: false }];
  const at = t.toLowerCase().indexOf(k.toLowerCase());
  // toLowerCase puede cambiar la longitud con algún carácter raro: si no coincide el tamaño, no resaltar (seguro).
  if (at < 0 || t.toLowerCase().length !== t.length) return [{ text: t, key: false }];
  const out = [];
  if (at > 0) out.push({ text: t.slice(0, at), key: false });
  out.push({ text: t.slice(at, at + k.length), key: true });
  if (at + k.length < t.length) out.push({ text: t.slice(at + k.length), key: false });
  return out;
}

export function createPhraseCloze(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  return Object.freeze({
    mount(container, item, ctx = {}) {
      if (!container || typeof container.appendChild !== 'function') throw new TypeError('phraseCloze: falta el contenedor');
      if (!item || typeof item !== 'object' || item.type !== 'phrase_cloze') throw new TypeError('phraseCloze: el ítem no es phrase_cloze');
      const data = item.data && typeof item.data === 'object' ? item.data : {};
      if (typeof item.prompt_es !== 'string' || !item.prompt_es.trim()) throw new TypeError('phraseCloze: falta prompt_es');

      const c = makeCtx('phraseCloze', { doc: container.ownerDocument ?? ctx.doc, win: ctx.win });
      const { h } = c;
      const keyEs = typeof data.key_es === 'string' ? data.key_es : '';
      const first = Array.isArray(data.answers) && Array.isArray(data.answers[0]) ? data.answers[0][0] : '';
      const keyEn = typeof data.key_en === 'string' && data.key_en ? data.key_en : (typeof first === 'string' ? first : '');
      const turns = Array.isArray(data.turns) ? data.turns : null;

      const keyed = (text, key) => splitKey(text, key).map((p) => (p.key ? h('strong', { class: 'pc__key' }, p.text) : p.text));
      // Inglés: el hueco se dibuja como elemento; el resto lleva la clave en verde si aparece.
      const english = (text) => {
        const s = typeof text === 'string' ? text : '';
        const m = s.match(GAP_RE);
        if (!m) return keyed(s, keyEn);
        const at = m.index;
        return [
          ...keyed(s.slice(0, at), keyEn),
          h('span', { class: 'pc__gap', role: 'img', 'aria-label': PC_TEXT.gap }, h('span', { 'aria-hidden': 'true' }, '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0')),
          ...keyed(s.slice(at + m[0].length), keyEn),
        ];
      };
      const row = (who, body) => h('li', { class: ['pc__turn', `pc__turn--${who.toLowerCase()}`] },
        h('span', { class: 'pc__who', 'aria-label': who === 'A' ? PC_TEXT.turnA : PC_TEXT.turnB }, who),
        h('span', { class: 'pc__line' }, body));

      const esLines = turns
        ? h('ul', { class: 'pc__turns', 'aria-label': PC_TEXT.spanish }, turns.map((t) => row(t.who, keyed(t.es, keyEs))))
        : h('p', { class: 'pc__line pc__line--es', lang: 'es' }, keyed(item.prompt_es, keyEs));

      let enLines;
      const turnsHaveEn = turns && turns.some((t) => typeof t.en === 'string' && t.en);
      const turnsHaveGap = turnsHaveEn && turns.some((t) => typeof t.en === 'string' && GAP_RE.test(t.en));
      if (turnsHaveEn) {
        const lis = turns.filter((t) => typeof t.en === 'string' && t.en).map((t) => row(t.who, english(t.en)));
        enLines = [h('ul', { class: 'pc__turns', lang: 'en', 'aria-label': PC_TEXT.english }, lis)];
        if (!turnsHaveGap) enLines.push(h('p', { class: 'pc__line pc__line--en', lang: 'en' }, english(data.text)));
      } else {
        enLines = [h('p', { class: 'pc__line pc__line--en', lang: 'en', 'aria-label': PC_TEXT.english }, english(data.text))];
      }

      const box = (cls, label, text) => (typeof text === 'string' && text.trim()
        ? h('div', { class: cls }, h('p', { class: 'pc__box-label' }, label), h('p', { class: 'pc__box-text' }, text))
        : null);

      const bar = ctx.cards && typeof ctx.entry?.cardId === 'string' && ctx.entry.cardId
        ? createCardBar({ cards: ctx.cards, cardId: ctx.entry.cardId, doc: c.doc, win: ctx.win }) : null;
      const el = h('article', { class: 'pc', dataset: { type: 'phrase_cloze' } },
        bar ? bar.el : null,
        typeof item.situation === 'string' && item.situation.trim()
          ? h('p', { class: 'pc__situation' }, `${PC_TEXT.situation}: ${item.situation}`) : null,
        h('section', { class: 'pc__es' }, esLines),
        h('section', { class: 'pc__en' }, enLines),
        box('pc__grammar callout', PC_TEXT.grammar, item.grammar_note_es),
        box('pc__nuance', PC_TEXT.nuance, item.nuance_es));
      // ---- Respuesta (2.2-T2): teclado, pista progresiva, «No sé», corrección con wordDiff ----
      const gaps = Math.max(1, countGaps(data.text));
      const fields = [];
      for (let i = 0; i < gaps; i += 1) {
        fields.push(createTextInput({
          doc: c.doc, mode: 'exercise', lang: 'en', maxLength: 200,
          ariaLabel: gaps === 1 ? PC_TEXT.fieldOne : `${PC_TEXT.fieldOne}: ${PC_TEXT.fieldN(i + 1)}`,
          onSubmit: () => check(),
        }));
      }
      const hintLine = h('p', { class: 'pc__hint', 'aria-live': 'polite' });
      const msg = h('p', { class: 'pc__msg', role: 'status', 'aria-live': 'polite' });
      const feedback = h('div', { class: 'pc__feedback', 'aria-live': 'polite' });
      const mic = createButton({ doc: c.doc, label: PC_TEXT.mic, icon: '🎤', variant: 'secondary', disabled: true });
      const micNote = h('p', { class: 'pc__mic-note' }, PC_TEXT.micSoon);
      const checkBtn = createButton({ doc: c.doc, label: PC_TEXT.check, variant: 'primary', size: 'lg', block: true, onClick: () => check() });
      const hintBtn = createButton({ doc: c.doc, label: PC_TEXT.hint, variant: 'ghost', onClick: () => showHint() });
      const dontBtn = createButton({ doc: c.doc, label: PC_TEXT.dontKnow, variant: 'ghost', onClick: () => dontKnow() });
      const controls = [...fields, mic, checkBtn, hintBtn, dontBtn];
      const answerBox = h('div', { class: 'pc__answer' },
        ...fields.map((f) => f.el), mic.el, micNote, msg, hintLine,
        h('div', { class: 'pc__actions' }, checkBtn.el, h('div', { class: 'pc__row' }, hintBtn.el, dontBtn.el)));
      el.appendChild(answerBox);
      el.appendChild(feedback);
      container.appendChild(el);

      let hintLevel = 0;
      let phase = 'answering'; // answering → sending → done
      const hintUsed = () => hintLevel > 0;
      const values = () => fields.map((f) => f.getValue());
      const lock = (on) => { for (const b of [fields[0], ...fields.slice(1), checkBtn, hintBtn, dontBtn]) b.setDisabled(on); };

      function showHint() {
        if (phase !== 'answering' || hintLevel >= 2) return;
        hintLevel += 1;
        hintLine.textContent = hintFor(item, hintLevel) ?? '';
        if (hintLevel >= 2) { hintBtn.setLabel(PC_TEXT.hintNone); hintBtn.setDisabled(true); } else hintBtn.setLabel(PC_TEXT.hintMore);
      }

      function paintFeedback(res, correctText, spell) {
        const dont = res.result === 'dont_know';
        const verdict = dont ? PC_TEXT.dont : PC_TEXT[res.result] ?? PC_TEXT.wrong;
        // Antes de la solución: diferencia de palabras y aviso de ortografía (propios de este tipo).
        const before = [];
        if (res.diff && res.diff.length && !dont) {
          const wd = createWordDiff({ doc: c.doc, label: PC_TEXT.diffLabel, words: res.diff.map((d) => ({ text: d.text, status: d.status, expected: d.expected })) });
          before.push(wd.el);
          disposers.push(() => wd.destroy());
        }
        if (spell) before.push(spellNote(spell));
        const answer = res.result !== 'correct' && correctText ? h('p', { class: 'pc__correct' }, `${PC_TEXT.answerIs} `, h('strong', {}, correctText)) : null;
        // Veredicto, solución y notas: panel común (2.6-T1). Puede dar «casi» (texto escrito con errata). Gramática y matiz ya están a la vista
        // en el recuadro del ítem antes de contestar: al panel solo se le pasa `explain_es` para no repetirlos.
        feedback.replaceChildren(...feedbackNodes({ h, result: res.result, item: { explain_es: item.explain_es }, verdict, before, answer, why: whyFor(h, ctx, item), report: reportFor(h, ctx, item) }));
      }
      const disposers = [];

      function spellNote({ flag, status }) {
        const tail = status === 'created' ? PC_TEXT.spellCreated : status === 'exists' ? PC_TEXT.spellExists : status === 'error' ? PC_TEXT.spellFail : '';
        return h('p', { class: 'pc__spell' }, `${PC_TEXT.spellTyped} «`, h('strong', {}, flag.word), `» ${PC_TEXT.spellIs} «`, h('strong', {}, flag.expected), tail ? `». ${tail}` : '».');
      }

      // `almost` con errata: crea la tarjeta de deletreo sin que un fallo toque la respuesta ya guardada.
      async function spellEffect(res) {
        const flag = res.result === 'almost' && Array.isArray(res.spellingFlags) ? res.spellingFlags.find((f) => f && typeof f.expected === 'string' && typeof f.word === 'string') : null;
        if (!flag) return null;
        let status = 'none';
        if (ctx.cards && typeof ctx.cards.ensureSpell === 'function') {
          try { status = (await ctx.cards.ensureSpell(flag))?.status ?? 'error'; } catch { status = 'error'; }
        }
        return { flag, status };
      }

      async function send(answer, res, correctText) {
        if (phase !== 'answering') return;
        phase = 'sending';
        lock(true);
        let r;
        try { r = ctx.submit ? await ctx.submit(answer) : { status: 'ignored' }; } catch { r = { status: 'error' }; }
        // La tarjeta de deletreo se pide aunque la persona ya haya pasado de ejercicio: lo que se pinta depende de `destroyed`, lo que se guarda no.
        const saved = Boolean(r) && (r.status === 'saved' || r.status === 'duplicate');
        const spell = saved ? await spellEffect(res) : null;
        if (destroyed) return;
        if (r && r.status === 'error') {
          phase = 'answering';
          lock(false);
          if (hintLevel >= 2) hintBtn.setDisabled(true);
          msg.textContent = typeof r.message === 'string' && r.message ? r.message : PC_TEXT.saveFail;
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
        const g = grade(item, values(), { compare: opts.compare, confusables: opts.confusables });
        if (g.empty) { msg.textContent = PC_TEXT.empty; fields[0].focus(); return; }
        msg.textContent = '';
        lastResponse = g.typed;
        // FIX 2.4-T1 (punto 9): el evento rechaza los caracteres de control y se perdía la respuesta; toResponseRaw los cambia por espacio (TRAMPA-32).
        const answer = { result: g.result, hint: hintUsed(), responseRaw: toResponseRaw(g.typed), errorCodes: g.errorCodes };
        send(answer, g, g.matched ?? acceptList(item)[0] ?? null);
      }

      function dontKnow() {
        if (phase !== 'answering') return;
        msg.textContent = '';
        const list = acceptList(item);
        lastResponse = null;
        send({ result: 'dont_know', dontKnow: true, hint: hintUsed() }, { result: 'dont_know', diff: [] }, list[0] ?? null);
      }

      let lastResponse = null;
      let destroyed = false;
      return {
        el,
        getResponse: () => (phase === 'answering' ? values().join(' ').trim() || null : lastResponse),
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

export default createPhraseCloze;
