// @purpose: Dibuja la corrección palabra por palabra con estados de color y señales que no dependen solo del color.
// Corrección palabra por palabra (subparte 0.5, ampliada en 1.2 cuarto 4): pinta cada palabra en verde / ámbar / rojo / "falta" / "sobra".
// El color NUNCA es la única señal: cada estado tiene además un subrayado o borde distinto y texto para lector de pantalla.
//
//   createWordDiff({ words, label = 'Tu respuesta corregida', showLegend = false, doc?, … })
//     → { el, setWords(words), counts(), destroy() }
//   words: arreglo (máx. 500) de textos o de { text, status, expected? }. Acepta DIRECTAMENTE lo que devuelve `wordDiff` de
//     core/wordDiff.js (sin adaptador). status acepta (equivalentes):
//     correct|ok|green · almost|near|amber|close · wrong|bad|red|incorrect · missing|absent|gap · extra|surplus
//     Un texto sin estado cuenta como correct. Un estado desconocido se pinta como wrong (decisión del Administrador: no lanza).
//     extra = palabra que la persona escribió de más (rojo con texto tachado). missing = palabra que faltó (borde punteado).
//     expected (solo en wrong y close): la palabra correcta; la lee el lector de pantalla, no se dibuja.
//   counts() → { correct, almost, wrong, missing, extra }.
//   normalizeDiffWords(words) es pura y se exporta.
//   Rojo aquí significa "esta palabra no coincide", no un juicio sobre la persona (decisión de diseño 0.3: sin culpa).
import { makeCtx, str, flag, fail } from './_shared.js';
import { TEXT } from './_text.js';

const ALIASES = {
  correct: 'correct', ok: 'correct', green: 'correct',
  almost: 'almost', near: 'almost', amber: 'almost', close: 'almost',
  wrong: 'wrong', bad: 'wrong', red: 'wrong', incorrect: 'wrong',
  missing: 'missing', absent: 'missing', gap: 'missing',
  extra: 'extra', surplus: 'extra',
};
export const DIFF_STATUSES = ['correct', 'almost', 'wrong', 'missing', 'extra'];

export function normalizeDiffWords(words) {
  if (!Array.isArray(words)) fail('wordDiff', '"words" debe ser un arreglo');
  if (words.length > 500) fail('wordDiff', `demasiadas palabras (${words.length} > 500)`);
  return words.map((w, i) => {
    if (typeof w === 'string') {
      if (w === '') fail('wordDiff', `words[${i}] está vacía`);
      return { text: w, status: 'correct' };
    }
    if (w === null || typeof w !== 'object') fail('wordDiff', `words[${i}] debe ser texto u objeto { text, status }`);
    const text = str('wordDiff', `words[${i}].text`, w.text, { required: true, max: 200 });
    const raw = w.status === undefined || w.status === null ? 'correct' : String(w.status).toLowerCase();
    const status = Object.hasOwn(ALIASES, raw) ? ALIASES[raw] : 'wrong'; // desconocido → incorrecta, sin lanzar
    const expected = status === 'wrong' || status === 'almost' ? str('wordDiff', `words[${i}].expected`, w.expected, { max: 200 }) : undefined;
    return expected === undefined || expected === '' ? { text, status } : { text, status, expected };
  });
}

export function createWordDiff(opts = {}) {
  const c = makeCtx('wordDiff', opts);
  const label = str('wordDiff', 'label', opts.label, { max: 200 }) ?? 'Tu respuesta corregida';
  const showLegend = flag('wordDiff', 'showLegend', opts.showLegend);
  const { h } = c;
  let tokens = normalizeDiffWords(opts.words ?? []);

  const line = h('p', { class: 'word-diff' });
  const summary = h('span', { class: 'sr-only' });
  const legend = showLegend
    ? h('ul', { class: 'word-diff__legend' }, DIFF_STATUSES.map((s) => h('li', {},
      h('span', { class: `word-diff__word word-diff__word--${s}`, 'aria-hidden': 'true' }, s === 'missing' ? '…' : 'ab'),
      ` ${TEXT.wordStatus[s]}`)))
    : null;
  const el = h('div', { class: 'word-diff-wrap', role: 'group', 'aria-label': label }, summary, line, legend);

  const countOf = () => Object.fromEntries(DIFF_STATUSES.map((s) => [s, tokens.filter((t) => t.status === s).length]));

  function paint() {
    const nodes = [];
    tokens.forEach((t, i) => {
      if (i > 0) nodes.push(c.doc.createTextNode(' '));
      const hint = t.expected === undefined ? '' : `; ${TEXT.wordExpected}: ${t.expected}`;
      nodes.push(h('span', { class: `word-diff__word word-diff__word--${t.status}` },
        t.text, h('span', { class: 'sr-only' }, ` (${TEXT.wordStatus[t.status]}${hint})`)));
    });
    line.replaceChildren(...nodes);
    const n = countOf();
    summary.textContent = DIFF_STATUSES.filter((s) => n[s] > 0).map((s) => `${n[s]} ${TEXT.wordStatus[s]}`).join(', ');
  }
  paint();

  let destroyed = false;
  return {
    el,
    counts: countOf,
    setWords(words) {
      tokens = normalizeDiffWords(words);
      paint();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      c.dispose();
      el.remove();
    },
  };
}
