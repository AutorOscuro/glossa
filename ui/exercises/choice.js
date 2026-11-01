// @purpose: Componente base de la familia de elección (2.3-T1): opciones barajadas, «No sé» siempre a la vista, selección múltiple opcional y objetivos táctiles de 44 px.
// Componente base `choice` (subparte 2.3, tramo 1). Contrato del componente (roadmap 8.9 y ficha «2.1-T4» de docs/CONTRACTS.md):
//   createChoice(opciones).mount(container, item, ctx) → { el, destroy(), getResponse() }
//
// Un solo componente para los 9 tipos de la familia: cada tipo será un envoltorio que lo registra con sus opciones (2.3-T3).
// T1 NO registra ningún tipo en app/main.js. Opciones de createChoice (todas opcionales):
//   rng          azar con shuffle (core/rng.js); por defecto el del sistema. Las opciones se barajan en CADA montaje (no hay semilla por ítem:
//                si no, la persona memorizaría la posición en vez del contenido). `item.data.shuffle === false` mantiene el orden del contenido.
//   multiple     false. Con true se eligen varias y hay que acertar el conjunto exacto (extensión del componente; el contrato de contenido sigue con un `correct` entero).
//   confirm      true. Con false, tocar una opción responde al instante (solo sin multiple); con true hay que tocar «Comprobar».
//   optionsLang  'en'. Idioma de las opciones (lang), para el lector de pantalla: los tipos de vocabulario ES→EN o EN→ES lo cambian.
//   stemLang     'en'. Idioma de item.prompt_en, el enunciado en inglés.
//   catalog      null. Catálogo de errores (core/errorCatalog.js: `has` y `hint`), o una función que lo devuelve (se llama al comprobar, no al montar, porque los servicios
//                de estudio se completan tras el arranque: el registro de tipos de 2.3-T3 pasará `() => services.study?.catalog`). Con catálogo, un distractor con `code`
//                conocido muestra su `pista_corta_es` y se envía como `errors` (2.3-T2) para que el conductor lo registre; sin él, no hay pista ni registro de errores.
//   log          console.error. Recibe los fallos al pintar la corrección (la respuesta ya quedó guardada).
//
// Datos que usa: item.prompt_es (obligatorio), item.prompt_en, item.situation, item.data.{options, correct, shuffle}, item.distractors (solo para los códigos de error).
// «No sé» y «Comprobar» van en un bloque fijo abajo mientras se responde (roadmap 2.3: «No sé» siempre visible); al pintar la corrección el bloque se oculta.
// Envío: ctx.submit({ result, hint: false, responseRaw, errorCodes, errors? }) con «Comprobar» (`errors` solo si hay catálogo y un distractor con code conocido; lo arma
// core/choiceFeedback.js); ctx.submit({ result: 'dont_know', dontKnow: true }) con «No sé» (nunca registra errores: no eligió nada).
// Una elección vacía NO se envía. Si submit devuelve error, el ejercicio se desbloquea y avisa. Tras responder pinta el veredicto, la respuesta correcta, las marcas de las
// opciones y, si falló con un distractor de code conocido, su pista (2.3-T2); el panel común de retroalimentación es de 2.6.
// Todo texto entra con h() como nodo de texto (nunca HTML). Las marcas ✓ y ✗ llevan texto: el significado no depende solo del color.
import { makeCtx, rovingKeys, uid, setAttr, setFlag } from '../components/_shared.js';
import { createButton } from '../components/button.js';
import { readChoice, arrange, gradeChoice } from '../../core/choice.js';
import { explainChoice } from '../../core/choiceFeedback.js';
import { systemRng } from '../../core/rng.js';
import { feedbackNodes } from '../feedbackPanel.js';
import { reportFor } from '../reportMenu.js';
import { whyFor } from '../whyNote.js';

export const CH_TEXT = Object.freeze({
  gap: 'hueco',
  situation: 'Situación',
  pickOne: 'Elige una opción.',
  pickMany: 'Elige todas las que correspondan.',
  check: 'Comprobar',
  dontKnow: 'No sé',
  emptyOne: 'Elige una opción o toca «No sé».',
  emptyMany: 'Elige al menos una opción o toca «No sé».',
  saveFail: 'No se pudo guardar. Inténtalo otra vez.',
  correct: '¡Bien!',
  wrong: 'Todavía no. La respuesta correcta está marcada.',
  dont: 'No pasa nada: esta es la respuesta.',
  answerIs: 'Respuesta:',
  answersAre: 'Respuestas:',
  hintLabel: 'Pista:',
  flagRight: '✓ Correcta',
  flagYours: '✗ Tu elección',
  flagMissed: '✓ Faltó esta',
  optionName: (n) => `Opción ${n}`,
});

const GAP_RE = /(_{2,})/;
const LETTERS = 'ABCDEFGH';

function need(cond, message) {
  if (!cond) throw new TypeError(`choice: ${message}`);
}

export function createChoice(options = {}) {
  const opts = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
  if (opts.rng !== undefined) need(opts.rng && typeof opts.rng.shuffle === 'function', 'rng debe tener una función shuffle (core/rng.js)');
  need(opts.catalog === undefined || opts.catalog === null || typeof opts.catalog === 'function'
    || (typeof opts.catalog === 'object' && !Array.isArray(opts.catalog) && typeof opts.catalog.has === 'function' && typeof opts.catalog.hint === 'function'),
  'catalog debe ser un catálogo de errores (con has y hint), una función que lo devuelva o null');
  for (const k of ['multiple', 'confirm']) need(opts[k] === undefined || typeof opts[k] === 'boolean', `${k} debe ser verdadero o falso`);
  for (const k of ['optionsLang', 'stemLang']) need(opts[k] === undefined || (typeof opts[k] === 'string' && /^[a-z]{2,3}$/.test(opts[k])), `${k} debe ser un código de idioma como "en" o "es"`);
  const multiple = opts.multiple === true;
  const autoSubmit = opts.confirm === false && !multiple;
  const rng = opts.rng ?? systemRng;
  const optionsLang = opts.optionsLang ?? 'en';
  const stemLang = opts.stemLang ?? 'en';
  const log = typeof opts.log === 'function' ? opts.log : console.error;
  // El catálogo se lee al comprobar, no al montar: los servicios de estudio se completan tras el arranque (TRAMPA-05).
  function catalogNow() {
    try { return (typeof opts.catalog === 'function' ? opts.catalog() : opts.catalog) ?? null; } catch (e) {
      log('No se pudo leer el catálogo de errores del ejercicio de elección', e);
      return null;
    }
  }

  return Object.freeze({
    mount(container, item, ctx = {}) {
      need(container && typeof container.appendChild === 'function', 'falta el contenedor');
      need(item && typeof item === 'object' && typeof item.type === 'string' && item.type !== '', 'el ítem no tiene tipo');
      need(typeof item.prompt_es === 'string' && item.prompt_es.trim() !== '', 'falta prompt_es');
      const read = readChoice(item, { multiple });
      need(read.ok, `el ítem de elección no es válido (${read.reason})`);

      const c = makeCtx('choice', { doc: container.ownerDocument ?? ctx.doc, win: ctx.win });
      const { h } = c;
      const order = arrange(read.options.length, { rng, shuffle: read.shuffle });
      const promptId = uid('ch-prompt');

      // El hueco se dibuja como elemento con nombre accesible; el resto del texto va como nodo de texto.
      const withGaps = (text) => String(text).split(GAP_RE).map((part) => (GAP_RE.test(part)
        ? h('span', { class: 'ch__gap', role: 'img', 'aria-label': CH_TEXT.gap }, h('span', { 'aria-hidden': 'true' }, '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'))
        : part));

      const optionEls = order.map((original, pos) => h('button', {
        type: 'button',
        class: 'ch__option',
        role: multiple ? 'checkbox' : 'radio',
        'aria-checked': 'false',
        tabindex: multiple || pos === 0 ? '0' : '-1',
        dataset: { index: original },
      },
      h('span', { class: 'ch__mark', 'aria-hidden': 'true' }, LETTERS[pos] ?? String(pos + 1)),
      h('span', { class: 'ch__body' },
        h('span', { class: 'ch__text', lang: optionsLang }, read.options[original]),
        h('span', { class: 'ch__flag' }))));

      const group = h('div', {
        class: 'ch__options', role: multiple ? 'group' : 'radiogroup', 'aria-labelledby': promptId,
      }, optionEls);
      const msg = h('p', { class: 'ch__msg', role: 'status', 'aria-live': 'polite' });
      const feedback = h('div', { class: 'ch__feedback', 'aria-live': 'polite' });
      const checkBtn = autoSubmit ? null : createButton({ doc: c.doc, label: CH_TEXT.check, variant: 'primary', size: 'lg', onClick: () => check() });
      const dontBtn = createButton({ doc: c.doc, label: CH_TEXT.dontKnow, variant: 'ghost', size: 'lg', onClick: () => dontKnow() });
      const buttons = [checkBtn, dontBtn].filter(Boolean);
      // Las acciones van fijas abajo mientras se responde (CSS sticky): «No sé» queda siempre a la vista aunque haya 8 opciones largas o texto grande.
      const actions = h('div', { class: 'ch__actions' }, msg, h('div', { class: 'ch__buttons' }, checkBtn ? checkBtn.el : null, dontBtn.el));

      const el = h('article', { class: 'ch', dataset: { type: item.type } },
        typeof item.situation === 'string' && item.situation.trim() ? h('p', { class: 'ch__situation' }, `${CH_TEXT.situation}: ${item.situation}`) : null,
        h('p', { class: 'ch__prompt', id: promptId, lang: 'es' }, withGaps(item.prompt_es)),
        typeof item.prompt_en === 'string' && item.prompt_en.trim() ? h('p', { class: 'ch__stem', lang: stemLang }, withGaps(item.prompt_en)) : null,
        h('p', { class: 'ch__instruction' }, multiple ? CH_TEXT.pickMany : CH_TEXT.pickOne),
        group, actions, feedback);
      container.appendChild(el);

      const selected = new Set(); // índices ORIGINALES
      let phase = 'answering'; // answering → sending → done
      let lastResponse = null;
      let destroyed = false;
      const originalOf = (btn) => Number(btn.dataset.index);

      function refresh() {
        for (const b of optionEls) {
          const on = selected.has(originalOf(b));
          setAttr(b, 'aria-checked', on ? 'true' : 'false');
          setFlag(b, 'is-on', on);
        }
        // Roving tabindex (solo una opción): la elegida, o la primera si no hay ninguna.
        if (!multiple) {
          const focusAt = optionEls.find((b) => selected.has(originalOf(b))) ?? optionEls[0];
          for (const b of optionEls) b.setAttribute('tabindex', b === focusAt ? '0' : '-1');
        }
      }

      function lock(on) {
        for (const b of optionEls) setAttr(b, 'aria-disabled', on ? 'true' : null);
        setFlag(group, 'is-locked', on);
        for (const b of buttons) b.setDisabled(on);
      }

      function pick(btn) {
        if (phase !== 'answering') return;
        const i = originalOf(btn);
        if (multiple) {
          if (selected.has(i)) selected.delete(i); else selected.add(i);
        } else {
          selected.clear();
          selected.add(i);
        }
        msg.textContent = '';
        refresh();
        if (autoSubmit) check();
      }

      for (const b of optionEls) c.listen(b, 'click', () => pick(b));
      if (!multiple) {
        // Con «tocar = responder» las flechas solo mueven el foco: responder es tocar o pulsar Enter/Espacio.
        rovingKeys(c, group, () => optionEls, (b) => { if (!autoSubmit) pick(b); if (typeof b.focus === 'function') b.focus(); }, { horizontal: false });
      }

      function flagOptions(res) {
        const mine = new Set(res.picked);
        for (const b of optionEls) {
          const i = originalOf(b);
          const flag = b.querySelector('.ch__flag');
          const right = res.correct.includes(i);
          const yours = mine.has(i);
          // Solo se marca lo que enseña algo: lo correcto, y lo elegido que no lo era (con «No sé» no hay elección).
          setFlag(b, 'ch__option--right', right);
          setFlag(b, 'ch__option--wrong', !right && yours);
          flag.textContent = right ? (yours || !multiple || res.dont ? CH_TEXT.flagRight : CH_TEXT.flagMissed) : (yours ? CH_TEXT.flagYours : '');
        }
      }

      // Pista del catálogo para el distractor elegido (solo si la persona eligió algo y tiene code conocido). Si las pistas son todas la misma se muestra una vez.
      function whyNodes(res) {
        const list = res.dont ? [] : (res.hints ?? []).filter((x) => typeof x.hint === 'string' && x.hint !== '');
        if (list.length === 0) return [];
        const distinct = [...new Set(list.map((x) => x.hint))];
        if (distinct.length === 1) return [h('p', { class: 'ch__why', lang: 'es' }, h('strong', {}, `${CH_TEXT.hintLabel} `), distinct[0])];
        return list.map((x) => h('p', { class: 'ch__why', lang: 'es' }, h('span', { class: 'ch__why-opt', lang: optionsLang }, `«${x.text}»`), `: ${x.hint}`));
      }

      function paintFeedback(res) {
        // Ya respondió: las acciones se van para no tapar el «Continuar» de la sesión, que ocupa ese mismo sitio.
        actions.setAttribute('hidden', '');
        flagOptions(res);
        // Veredicto, respuesta correcta y notas del ítem: panel común (2.6-T1). Elegir es binario: nunca «casi».
        const verdict = res.dont ? CH_TEXT.dont : res.result === 'correct' ? CH_TEXT.correct : CH_TEXT.wrong;
        const texts = res.result === 'correct' ? [] : res.correct.map((i) => read.options[i]);
        const answer = texts.length === 0 ? null : h('p', { class: 'ch__correct' }, `${texts.length > 1 ? CH_TEXT.answersAre : CH_TEXT.answerIs} `,
          h('strong', { lang: optionsLang }, texts.join(' · ')));
        feedback.replaceChildren(...feedbackNodes({ h, result: res.dont ? 'dont_know' : res.result, item, binary: true, verdict, before: res.result === 'correct' ? null : whyNodes(res), answer, why: whyFor(h, ctx, item), report: reportFor(h, ctx, item) }));
      }

      async function send(answer, res) {
        if (phase !== 'answering') return;
        phase = 'sending';
        lock(true);
        let r;
        try { r = ctx.submit ? await ctx.submit(answer) : { status: 'ignored' }; } catch { r = { status: 'error' }; }
        if (destroyed) return;
        if (r && r.status === 'error') {
          phase = 'answering';
          lock(false);
          msg.textContent = typeof r.message === 'string' && r.message ? r.message : CH_TEXT.saveFail;
          return;
        }
        phase = 'done';
        msg.textContent = '';
        if (r && r.status === 'ignored') return;
        try { paintFeedback(res); } catch (e) { log('No se pudo mostrar la corrección del ejercicio de elección', e); }
      }

      function check() {
        if (phase !== 'answering') return;
        const g = gradeChoice(item, [...selected], { multiple });
        if (g.empty) {
          msg.textContent = multiple ? CH_TEXT.emptyMany : CH_TEXT.emptyOne;
          if (typeof optionEls[0].focus === 'function') optionEls[0].focus();
          return;
        }
        msg.textContent = '';
        lastResponse = g.typed;
        // Si explicar falla, la respuesta se envía igual (sin errores ni pista): nunca se pierde por un fallo de la explicación.
        let why = { hints: [], errors: [] };
        try { why = explainChoice(item, g, { catalog: catalogNow() }); } catch (e) { log('No se pudo preparar la explicación del error', e); }
        send({ result: g.result, hint: false, responseRaw: g.typed, errorCodes: g.errorCodes, ...(why.errors.length > 0 ? { errors: why.errors } : {}) },
          { ...g, dont: false, hints: why.hints });
      }

      function dontKnow() {
        if (phase !== 'answering') return;
        msg.textContent = '';
        lastResponse = null;
        send({ result: 'dont_know', dontKnow: true, hint: false }, { result: 'wrong', picked: [], correct: read.correct, dont: true });
      }

      return {
        el,
        getResponse: () => (phase === 'answering'
          ? ([...selected].sort((a, b) => a - b).map((i) => read.options[i]).join(' | ') || null)
          : lastResponse),
        destroy() {
          if (destroyed) return;
          destroyed = true;
          for (const b of buttons) { try { b.destroy(); } catch { /* limpieza */ } }
          c.dispose();
          if (typeof el.remove === 'function') el.remove();
        },
      };
    },
  });
}

export default createChoice;
