// @purpose: Botón «¿Por qué lo pensaste?» del panel de feedback (2.6-T2): campo opcional que guarda el evento `note`, solo en ítems de gramática, con avisos sin culpa.
// Nota de «por qué lo pensaste» (roadmap 2.6, tramo 2, punto 4). Sin estado global: cada llamada crea su propio bloque.
//
//   whyNote({ h, why, entry, item }) → Node | null
//     why  createWhyNote(...) de core/whyNote.js (usa `save`). Sin él devuelve null. Sin `h` función lanza TypeError (error de programación).
//   whyFor(h, ctx, item) → Node | null   lo que cada pantalla llama al pintar el feedback (como `reportFor`). null si no hay `ctx.why`, si no hay itemId
//     o si el ítem no es de gramática (algún tema que empiece por «gram.», en la entrada o en el ítem). Nunca lanza por datos raros.
//   El panel (`feedbackNodes`, opción `why`) solo lo muestra al fallar o con «No sé»; nunca es obligatorio ni bloquea «Continuar».
//   Estructura: <div class="fb__why"> botón (aria-expanded, aria-controls) · <div class="fb__why-body" hidden> con etiqueta, <textarea maxlength=2000> y botón «Guardar nota» · <p role="status" aria-live="polite">.
//   Guardar: con el botón ocupado (aria-disabled, no `disabled`, para no perder el foco) se ignoran las pulsaciones. Una nota ya guardada no se vuelve a guardar si el texto no cambió.
//   Si falla, el texto se conserva y el aviso dice que se puede reintentar. Los textos están en WN_TEXT para la auditoría de cadenas de T3.
import { WHY_MAX } from '../core/whyNote.js';

export const WN_TEXT = Object.freeze({
  toggle: '¿Por qué lo pensaste?',
  label: 'Cuéntalo con tus palabras (es opcional)',
  save: 'Guardar nota',
  saved: 'Anotado. Se guardó en este dispositivo.',
  same: 'Esa nota ya está guardada.',
  empty: 'Escribe algo para poder guardarlo.',
  failed: 'No se pudo guardar esta vez. Puedes intentarlo de nuevo.',
});

const isGrammar = (topics) => Array.isArray(topics) && topics.some((t) => typeof t === 'string' && t.startsWith('gram.'));
let seq = 0;

export function whyNote(options) {
  const o = options !== null && typeof options === 'object' ? options : {};
  const { h, why, entry, item } = o;
  if (typeof h !== 'function') throw new TypeError('whyNote: falta la función `h`');
  if (!why || typeof why.save !== 'function') return null;

  let open = false;
  let busy = false;
  let lastSaved = null;
  seq += 1;
  const bodyId = `fb-why-body-${seq}`;
  const fieldId = `fb-why-field-${seq}`;

  const status = h('p', { class: 'fb__why-status', role: 'status', 'aria-live': 'polite' });
  const toggle = h('button', { type: 'button', class: 'btn btn--ghost fb__why-toggle', 'aria-expanded': 'false', 'aria-controls': bodyId, onClick: () => { open = !open; paint(); } }, WN_TEXT.toggle);
  const field = h('textarea', { class: 'input fb__why-field', id: fieldId, rows: 3, maxlength: WHY_MAX });
  const saveBtn = h('button', { type: 'button', class: 'btn btn--secondary fb__why-save', 'aria-disabled': 'false', onClick: () => { save(); } }, WN_TEXT.save);
  const body = h('div', { class: 'fb__why-body', id: bodyId, hidden: true }, h('label', { for: fieldId, class: 'fb__why-label' }, WN_TEXT.label), field, saveBtn);
  const root = h('div', { class: 'fb__why' }, toggle, body, status);

  function paint() {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) body.removeAttribute('hidden'); else body.setAttribute('hidden', '');
    saveBtn.setAttribute('aria-disabled', busy ? 'true' : 'false');
  }

  async function save() {
    if (busy) return;
    const text = String(field.value ?? '');
    if (text.trim() === '') { status.textContent = WN_TEXT.empty; return; }
    if (lastSaved !== null && text === lastSaved) { status.textContent = WN_TEXT.same; return; }
    busy = true; status.textContent = ''; paint();
    let res = null;
    try { res = await why.save(entry, item, text); } catch { res = null; }
    busy = false;
    if (res && res.status === 'saved') { lastSaved = text; status.textContent = WN_TEXT.saved; } else if (res && res.status === 'empty') status.textContent = WN_TEXT.empty; else status.textContent = WN_TEXT.failed;
    paint();
  }

  paint();
  return root;
}

export function whyFor(h, ctx, item) {
  try {
    const c = ctx !== null && typeof ctx === 'object' ? ctx : {};
    const entry = c.entry !== null && typeof c.entry === 'object' ? c.entry : {};
    const id = typeof entry.itemId === 'string' && entry.itemId !== '' ? entry.itemId : item?.id;
    if (!c.why || typeof id !== 'string' || id === '') return null;
    if (!isGrammar(entry.topics) && !isGrammar(item?.topics)) return null;
    return whyNote({ h, why: c.why, entry: { ...entry, itemId: id }, item });
  } catch { return null; }
}
