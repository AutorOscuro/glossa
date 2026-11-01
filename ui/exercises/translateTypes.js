// @purpose: Pantalla de trap_translate y translate_bank (2.5-T3, punto 4): traducir al inglés escribiendo, con aviso de la trampa conocida y banco de palabras que se insertan tocando.
// Envoltorios de la pantalla base `createTextAnswer` (ui/exercises/textAnswer.js) con la lógica de core/translateTypes.js (respuestas del Administrador a 2.5, preguntas 8 y 11):
//   la dirección es SIEMPRE español → inglés (`prompt_es` es la frase; se responde en inglés, lo que trae `accept`).
//   TR_TEXT = { bank, trapTyped, trapHint, trapGeneric }   textos propios (el resto sale de TA_TEXT)
//   createTranslateType(type, { compare?, confusables?, catalog?, log? }) → { mount(container, item, ctx) → { el, getResponse(), destroy() } }
//     type      'trap_translate' | 'translate_bank'; otro valor lanza Error en español.
//     mount     el tipo del envoltorio manda sobre el `type` del ítem. Un ítem sin `accept` lanza TypeError (el registro lo cuenta como «tipo no soportado todavía»).
//     catalog   catálogo de errores (`has` y `hint`) o una función que lo devuelve; se lee al comprobar, no al montar (los servicios de estudio llegan tras el arranque).
//   registerTranslateTypes(registry, { compare?, confusables?, catalog?, log? }) → lista de tipos registrados (un tipo ya registrado hace lanzar al registro).
// Trampa (trap_translate): si lo escrito es un distractor conocido, el veredicto es «Todavía no», el código va en errorCodes (lo hace gradeTranslation) y se muestra el aviso específico
//   («Ese es un error típico: escribiste «…»» + la pista del catálogo si existe). El aviso es TEXTO, no solo color (marca `.ta__trap`, con `role="note"`).
// Banco (translate_bank): `.ta__bank` (role group) con un botón por palabra; tocar una la añade al campo. Los botones se bloquean al enviar y no hacen nada con la pantalla bloqueada.
// Todo texto en español salvo las palabras del banco (`lang="en"`).
import { createTextAnswer } from './textAnswer.js';
import { createButton } from '../components/button.js';
import { promptPlan, gradeTranslation, isTranslateType } from '../../core/translateTypes.js';

export const TR_TEXT = Object.freeze({
  bank: 'Banco de palabras',
  trapTyped: 'Ese es un error típico: escribiste',
  trapHint: 'Pista:',
  trapGeneric: 'Revisa la corrección de abajo.',
});

function promptNodes(type, { h, doc, insertText, addControl }, item) {
  const plan = promptPlan(item, type);
  const nodes = [];
  if (plan.instruction !== '') nodes.push(h('p', { class: 'ta__instruction' }, plan.instruction));
  if (plan.main !== null) nodes.push(h('p', { class: 'ta__prompt', lang: plan.main.lang }, plan.main.text));
  if (plan.bank.length > 0) {
    const buttons = plan.bank.map((word) => {
      const b = createButton({ doc, label: word, variant: 'secondary', onClick: () => insertText(word) });
      addControl(b);
      return b.el;
    });
    nodes.push(h('div', { class: 'ta__bank', role: 'group', 'aria-label': TR_TEXT.bank, lang: 'en' }, ...buttons));
  }
  return nodes;
}

export function createTranslateType(type, { compare, confusables, catalog, detect, log } = {}) {
  if (!isTranslateType(type)) throw new Error(`createTranslateType: tipo desconocido (${String(type).slice(0, 40)})`);
  const catalogNow = () => {
    try { return (typeof catalog === 'function' ? catalog() : catalog) ?? null; } catch { return null; }
  };
  return Object.freeze({
    mount(container, item, ctx = {}) {
      const it = item?.type !== type ? { ...item, type } : item;
      const base = createTextAnswer({
        compare, confusables, log, answerLang: 'en', catalog, detect,
        prompt: (i, helpers) => promptNodes(type, helpers, i),
        grade: (i, text, o) => gradeTranslation(i, text, o),
        notes: (res, { h }) => {
          if (!res || !res.trap) return null;
          const cat = catalogNow();
          let hint = null;
          if (res.trap.code !== null && cat && typeof cat.has === 'function' && typeof cat.hint === 'function' && cat.has(res.trap.code)) hint = cat.hint(res.trap.code);
          return h('p', { class: 'ta__trap', role: 'note' }, `${TR_TEXT.trapTyped} «`, h('strong', {}, res.trap.text), `». ${typeof hint === 'string' && hint.trim() !== '' ? `${TR_TEXT.trapHint} ${hint.trim()}` : TR_TEXT.trapGeneric}`);
        },
      });
      return base.mount(container, it, ctx);
    },
  });
}

export function registerTranslateTypes(registry, { compare, confusables, catalog, detect, log } = {}) {
  if (registry === null || typeof registry !== 'object' || typeof registry.register !== 'function') {
    throw new Error('registerTranslateTypes: falta el registro de ejercicios (createExerciseRegistry)');
  }
  const done = [];
  for (const type of ['trap_translate', 'translate_bank']) {
    registry.register(type, createTranslateType(type, { compare, confusables, catalog, detect, log }));
    done.push(type);
  }
  return done;
}
