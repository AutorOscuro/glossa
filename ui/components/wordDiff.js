// Corrección palabra por palabra (subparte 0.5): pinta cada palabra en verde / ámbar / rojo (o "falta").
// El color NUNCA es la única señal: cada estado tiene además un subrayado distinto y texto para lector de pantalla.
//
//   createWordDiff({ words, label = 'Tu respuesta corregida', showLegend = false, doc?, … })
//     → { el, setWords(words), counts(), destroy() }
//   words: arreglo (máx. 500) de textos o de { text, status }. status acepta (equivalentes):
//     correct|ok|green · almost|near|amber|close · wrong|bad|red|incorrect · missing|absent|gap
//     Un texto sin estado cuenta como correct. Estado desconocido → error claro (no se pinta a ciegas).
//   normalizeDiffWords(words) es pura y se exporta: la usarán 1.2 (normalize.wordDiff) y 2.2+ como adaptador.
//   Rojo aquí significa "esta palabra no coincide", no un juicio sobre la persona (decisión de diseño 0.3: sin culpa).
import { makeCtx, str, flag, fail } from './_shared.js';
import { TEXT } from './_text.js';

const ALIASES = {
  correct: 'correct', ok: 'correct', green: 'correct',
  almost: 'almost', near: 'almost', amber: 'almost', close: 'almost',
  wrong: 'wrong', bad: 'wrong', red: 'wrong', incorrect: 'wrong',
  missing: 'missing', absent: 'missing', gap: 'missing',
};
export const DIFF_STATUSES = ['correct', 'almost', 'wrong', 'missing'];

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
    const status = ALIASES[raw];
    if (!status) fail('wordDiff', `words[${i}].status "${w.status}" no es válido (usa: ${DIFF_STATUSES.join(', ')})`);
    return { text, status };
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
      nodes.push(h('span', { class: `word-diff__word word-diff__word--${t.status}` },
        t.text, h('span', { class: 'sr-only' }, ` (${TEXT.wordStatus[t.status]})`)));
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
