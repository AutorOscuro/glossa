// @purpose: Menú «⋯» del panel de feedback (2.6-T2): «Marcar como difícil» y «No me convence esta frase» sobre core/itemReport.js, con estado marcado, guardado y aviso de error sin culpa.
// Menú de reporte local (roadmap 2.6, tramo 2). Sin estado global: cada llamada crea su propio menú. Las pantallas lo piden con `reportFor` (al final del archivo).
//
//   reportMenu({ h, itemId, report, onChange? }) → Node | null
//     h        función de ui/dom.js (o la de la pantalla; en pruebas, h ligado al DOM falso). Si no es función lanza TypeError (error de programación).
//     itemId   id del ítem (el mismo con el que se guarda `report:<itemId>`).
//     report   createItemReport(...) de core/itemReport.js (usa `get`, `mark` y `clear`).
//     onChange (kind, marked) se llama DESPUÉS de guardar con éxito (kind 'hard' | 'doubt'); si lanza, se ignora.
//     Sin `report` válido o con un `itemId` que el almacén rechazaría, devuelve null (no hay nada que pintar) y no lanza.
//   Estructura: <div class="fb__report"> botón «⋯» (aria-expanded, aria-controls) · <div class="fb__report-list" hidden> con dos botones aria-pressed ·
//     <p class="fb__report-status" role="status" aria-live="polite">. Los botones se actualizan EN SU SITIO (el foco no se pierde al pulsar).
//   Carga: al crearse lee el estado con `report.get`; hasta que termine, y mientras guarda, las opciones llevan aria-disabled="true" (no `disabled`, para no perder el foco) y se ignoran las pulsaciones. Si la lectura falla, se muestran sin marcar.
//   Guardar: marcar → `report.mark`, desmarcar → `report.clear`. Si falla, el estado NO cambia y el aviso dice que no se pudo guardar y que se puede reintentar.
//   Los textos están en RM_TEXT para poder auditarlos (2.6-T3, cadenas sin culpa).
export const RM_TEXT = Object.freeze({
  toggle: '⋯',
  toggleLabel: 'Más opciones de este ejercicio',
  hard: 'Marcar como difícil',
  hardOn: 'Quitar la marca de difícil',
  doubt: 'No me convence esta frase',
  doubtOn: 'Quitar «No me convence esta frase»',
  savedHard: 'Marcado como difícil. Se guardó en este dispositivo.',
  savedDoubt: 'Anotado: no te convence esta frase. Se guardó en este dispositivo.',
  clearedHard: 'Quitaste la marca de difícil.',
  clearedDoubt: 'Quitaste la nota de que no te convence.',
  failed: 'No se pudo guardar esta vez. Puedes intentarlo de nuevo.',
});

const KINDS = [['hard', 'hard', 'hardOn', 'savedHard', 'clearedHard'], ['doubt', 'doubt', 'doubtOn', 'savedDoubt', 'clearedDoubt']];
let seq = 0;

export function reportMenu(options) {
  const o = options !== null && typeof options === 'object' ? options : {};
  const { h, itemId, report, onChange } = o;
  if (typeof h !== 'function') throw new TypeError('reportMenu: falta la función `h`');
  if (!report || typeof report.get !== 'function' || typeof report.mark !== 'function' || typeof report.clear !== 'function' || typeof report.keyOf !== 'function') return null;
  try { report.keyOf(itemId); } catch { return null; }

  const marked = { hard: false, doubt: false };
  let ready = false;
  let busy = false;
  let open = false;
  seq += 1;
  const listId = `fb-report-list-${seq}`;

  const status = h('p', { class: 'fb__report-status', role: 'status', 'aria-live': 'polite' });
  const toggle = h('button', { type: 'button', class: 'btn btn--ghost fb__report-toggle', 'aria-label': RM_TEXT.toggleLabel, 'aria-expanded': 'false', 'aria-controls': listId, onClick: () => { open = !open; paint(); } }, RM_TEXT.toggle);
  const buttons = {};
  const list = h('div', { class: 'fb__report-list', id: listId, hidden: true },
    ...KINDS.map(([kind]) => {
      buttons[kind] = h('button', { type: 'button', class: 'btn btn--secondary fb__report-option', 'aria-pressed': 'false', onClick: () => flip(kind) });
      return buttons[kind];
    }));
  const root = h('div', { class: 'fb__report' }, toggle, list, status);

  function paint() {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) list.removeAttribute('hidden'); else list.setAttribute('hidden', '');
    for (const [kind, off, on] of KINDS) {
      const b = buttons[kind];
      b.textContent = marked[kind] ? RM_TEXT[on] : RM_TEXT[off];
      b.setAttribute('aria-pressed', marked[kind] ? 'true' : 'false');
      // aria-disabled y no `disabled`: un botón desactivado pierde el foco y quien navega con teclado o lector de pantalla perdería su sitio al pulsar.
      b.setAttribute('aria-disabled', !ready || busy ? 'true' : 'false');
    }
  }

  async function flip(kind) {
    if (!ready || busy) return;
    const [, , , saved, cleared] = KINDS.find((k) => k[0] === kind);
    const next = !marked[kind];
    busy = true; status.textContent = ''; paint();
    let ok = true;
    try { if (next) await report.mark(itemId, kind); else await report.clear(itemId, kind); } catch { ok = false; }
    busy = false;
    if (ok) {
      marked[kind] = next;
      status.textContent = RM_TEXT[next ? saved : cleared];
    } else {
      status.textContent = RM_TEXT.failed;
    }
    paint();
    if (ok && typeof onChange === 'function') { try { onChange(kind, next); } catch { /* el aviso del menú no depende de quien escucha */ } }
  }

  paint();
  Promise.resolve().then(() => report.get(itemId)).then((r) => {
    if (r && typeof r === 'object') { marked.hard = typeof r.hard === 'string'; marked.doubt = typeof r.doubt === 'string'; }
  }, () => {}).then(() => { ready = true; paint(); });
  return root;
}

// Punto 3 de 2.6-T2: lo que cada pantalla llama al pintar el feedback. `ctx.report` lo pone el registro de ejercicios (createItemReport o null).
//   reportFor(h, ctx, item) → Node | null. Sin `ctx.report` (sin base de datos) o sin id de ítem usable devuelve null y el feedback sale igual, sin menú. Nunca lanza por datos raros.
export function reportFor(h, ctx, item) {
  try {
    const c = ctx !== null && typeof ctx === 'object' ? ctx : {};
    const id = typeof c.entry?.itemId === 'string' && c.entry.itemId !== '' ? c.entry.itemId : item?.id;
    if (!c.report || typeof id !== 'string') return null;
    return reportMenu({ h, itemId: id, report: c.report });
  } catch { return null; }
}
