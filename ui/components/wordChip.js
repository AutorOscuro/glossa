// Chip de palabra (subparte 0.5): ficha tocable tipo tecla, para bancos de palabras (cloze_bank, order_blocks,
// unscramble_letters…) y para marcar el estado de una palabra. Es un <button> de ≥ 44 px.
//
//   createWordChip({ word, state = 'default', knowledge?, onPress?(palabra, evento), doc?, … })
//     → { el, getWord(), setWord(t), setState(estado), setKnowledge(k|null), destroy() }
//   state:     default | selected | used | correct | wrong
//     · selected → aria-pressed="true" · used → deshabilitada (ya colocada) · correct/wrong → resultado con ✓ / ✗
//   knowledge: null | unknown | learning | known — marca de "tocar palabra" (forma + texto, no solo color).
//   El estado se dice también en texto para lector de pantalla (nunca solo con color).
import { makeCtx, str, oneOf, fn, setFlag } from './_shared.js';
import { TEXT } from './_text.js';

export const WORD_STATES = ['default', 'selected', 'used', 'correct', 'wrong'];
export const WORD_KNOWLEDGE = ['unknown', 'learning', 'known'];
const MARKS = { correct: '✓', wrong: '✗' };

export function createWordChip(opts = {}) {
  const c = makeCtx('wordChip', opts);
  const state = {
    word: str('wordChip', 'word', opts.word, { required: true, max: 120 }),
    value: oneOf('wordChip', 'state', opts.state, WORD_STATES, 'default'),
    knowledge: oneOf('wordChip', 'knowledge', opts.knowledge, WORD_KNOWLEDGE, null),
  };
  const onPress = fn('wordChip', 'onPress', opts.onPress);
  const { h } = c;

  const wordEl = h('span', { class: 'word-chip__word' });
  const markEl = h('span', { class: 'word-chip__mark', 'aria-hidden': 'true' });
  const kindEl = h('span', { class: 'word-chip__kind', 'aria-hidden': 'true' });
  const srEl = h('span', { class: 'sr-only' });
  const el = h('button', { type: 'button', class: 'word-chip' }, kindEl, wordEl, markEl, srEl);

  function paint() {
    wordEl.textContent = state.word;
    el.setAttribute('data-state', state.value);
    for (const s of WORD_STATES) setFlag(el, `word-chip--${s}`, s === state.value);
    if (state.value === 'selected') el.setAttribute('aria-pressed', 'true');
    else el.removeAttribute('aria-pressed');
    if (state.value === 'used') el.setAttribute('disabled', '');
    else el.removeAttribute('disabled');
    markEl.textContent = MARKS[state.value] ?? '';
    if (state.knowledge) el.setAttribute('data-knowledge', state.knowledge);
    else el.removeAttribute('data-knowledge');
    kindEl.textContent = state.knowledge ? { unknown: '○', learning: '◐', known: '●' }[state.knowledge] : '';
    const spoken = [];
    if (state.knowledge) spoken.push(TEXT.wordKnowledge[state.knowledge]);
    if (state.value !== 'default') spoken.push(TEXT.wordState[state.value]);
    srEl.textContent = spoken.length ? `, ${spoken.join(', ')}` : '';
  }
  paint();

  c.listen(el, 'click', (e) => {
    if (state.value === 'used') return;
    onPress?.(state.word, e);
  });

  let destroyed = false;
  return {
    el,
    getWord: () => state.word,
    setWord(text) {
      state.word = str('wordChip', 'word', text, { required: true, max: 120 });
      paint();
    },
    setState(next) {
      state.value = oneOf('wordChip', 'state', next, WORD_STATES, 'default');
      paint();
    },
    setKnowledge(next) {
      state.knowledge = oneOf('wordChip', 'knowledge', next, WORD_KNOWLEDGE, null);
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
