// @purpose: Registro de ejercicios: elige el componente por tipo, resuelve el ítem de contenido y entrega a la vista de sesión un manejador con destroy y getResponse.
// Registro de ejercicios (subparte 2.1, tramo 4). Roadmap 2.1, 7 y 17. Sin DOM propio: solo reparte; cada tipo dibuja lo suyo (2.2 a 2.5).
//
//   createExerciseRegistry({ resolveItem?, components?, cards?, log? }) → objeto congelado { register, has, types, mount }
//     cards (2.2-T3): acciones de tarjeta para las insignias y los efectos (app/cardActions.js): un objeto, o una función que lo devuelve (se llama al montar cada ejercicio,
//     porque los servicios de estudio se completan tras el arranque) o null. Llega al componente como ctx.cards; sin él, el ejercicio funciona sin insignias.
//     resolveItem(itemId) → ítem de contenido | null (puede ser una promesa). En la app lo entrega app/itemResolver.js (2.9-T3, punto 4: lee el índice y los paquetes, también sin conexión); las pruebas inyectan ítems propios.
//     register(type, component)  component = { mount(container, item, ctx) → { destroy(), getResponse?() } (o una promesa) }. Lanza Error si el tipo ya existe.
//     mount(slot, entry, ctx) → Promesa del manejador { destroy(), getResponse() } o null.
//       entry es la entrada del plan { cardId, itemId, facet, topic, exerciseType, kind, why, topics }; ctx es { index, total, submit } de la vista.
//       null = «tipo no soportado todavía»: no hay componente, el ítem no se pudo leer, el tipo del plan no coincide con el del ítem o el componente falló.
//       La vista de sesión responde con su pantalla amable y «Saltar por ahora» (sin evento y sin tocar la tarjeta). mount nunca rechaza.
//     report (2.6-T2): createItemReport (core/itemReport.js), o función que lo devuelve (se llama al montar) o null. Llega como ctx.report; sin él el feedback sale sin menú «⋯».
//     why (2.6-T2, punto 4): createWhyNote (core/whyNote.js), o función que lo devuelve (se llama al montar) o null. Llega como ctx.why; sin él no hay botón «¿Por qué lo pensaste?».
//   El componente recibe ctx = { index, total, entry, item, type, cards, report, why, submit(answer) } (cards puede ser null). submit pone exerciseType si falta, rechaza respuestas mal formadas
//   con { status: 'error', message } sin llamar a la vista, y tras destroy() devuelve { status: 'ignored', reason: 'stale' }. Nunca lanza.
export const RESULTS = Object.freeze(['correct', 'almost', 'wrong', 'skipped', 'dont_know']);
export const BAD_ANSWER = 'No se pudo guardar tu respuesta. Inténtalo de nuevo.';

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';

export function createExerciseRegistry({ resolveItem, components, cards, report, why, log = console.error } = {}) {
  if (resolveItem !== undefined && typeof resolveItem !== 'function') throw new Error('createExerciseRegistry: resolveItem debe ser una función');
  if (typeof log !== 'function') throw new Error('createExerciseRegistry: log debe ser una función');
  if (cards !== undefined && cards !== null && typeof cards !== 'function' && !isPlain(cards)) throw new Error('createExerciseRegistry: cards debe ser un objeto o una función');
  const table = new Map();

  function whyNow() {
    try { const w = typeof why === 'function' ? why() : why; return w ?? null; } catch (e) { log('No se pudo preparar la nota de «por qué lo pensaste»', e); return null; }
  }

  function reportNow() {
    try { const r = typeof report === 'function' ? report() : report; return r ?? null; } catch (e) { log('No se pudo preparar el reporte de ítems', e); return null; }
  }

  function cardsNow() {
    try {
      const c = typeof cards === 'function' ? cards() : cards;
      return isPlain(c) ? c : null;
    } catch (e) {
      log('No se pudieron preparar las acciones de tarjeta', e);
      return null;
    }
  }

  function register(type, component) {
    if (!isText(type)) throw new Error('register: el tipo de ejercicio debe ser un texto no vacío');
    if (!isPlain(component) || typeof component.mount !== 'function') throw new Error(`register: el componente de "${type}" necesita una función mount`);
    if (table.has(type)) throw new Error(`register: el tipo "${type}" ya está registrado`);
    table.set(type, component);
  }
  if (components !== undefined) {
    if (!isPlain(components)) throw new Error('createExerciseRegistry: components debe ser un objeto { tipo: componente }');
    for (const [type, component] of Object.entries(components)) register(type, component);
  }

  const has = (type) => table.has(type);
  const types = () => [...table.keys()].sort();

  async function readItem(itemId) {
    if (typeof resolveItem !== 'function' || !isText(itemId)) return null;
    try {
      const item = await resolveItem(itemId);
      return isPlain(item) ? item : null;
    } catch (e) {
      log('No se pudo leer el ítem del ejercicio', e);
      return null;
    }
  }

  function clear(slot) {
    try { slot.replaceChildren(); } catch (e) { log('No se pudo limpiar el espacio del ejercicio', e); }
  }

  async function mount(slot, entry, ctx) {
    if (!slot || typeof slot.replaceChildren !== 'function' || !isPlain(entry) || !isPlain(ctx) || typeof ctx.submit !== 'function') return null;
    const item = await readItem(entry.itemId);
    const wanted = isText(entry.exerciseType) ? entry.exerciseType : (isText(item?.type) ? item.type : null);
    if (wanted === null || !table.has(wanted)) return null;
    if (item === null) { log(`El ejercicio "${wanted}" no se pudo mostrar: falta el ítem de contenido`); return null; }
    if (isText(item.type) && item.type !== wanted) { log(`El plan pide "${wanted}" pero el ítem es "${item.type}"`); return null; }

    let dead = false;
    let handle = null;
    const submit = async (answer) => {
      if (dead) return { status: 'ignored', reason: 'stale' };
      if (!isPlain(answer) || !RESULTS.includes(answer.result)) {
        log('El ejercicio entregó una respuesta con formato inválido');
        return { status: 'error', message: BAD_ANSWER };
      }
      try { return await ctx.submit({ ...answer, exerciseType: isText(answer.exerciseType) ? answer.exerciseType : wanted }); } catch (e) {
        log('No se pudo registrar la respuesta del ejercicio', e);
        return { status: 'error', message: BAD_ANSWER };
      }
    };
    const stop = () => {
      if (dead) return;
      dead = true;
      if (handle && typeof handle.destroy === 'function') { try { handle.destroy(); } catch (e) { log('No se pudo cerrar el ejercicio', e); } }
    };

    try {
      handle = await table.get(wanted).mount(slot, item, { index: ctx.index, total: ctx.total, entry, item, type: wanted, cards: cardsNow(), report: reportNow(), why: whyNow(), submit });
    } catch (e) {
      log(`El ejercicio "${wanted}" falló al mostrarse`, e);
      dead = true;
      clear(slot);
      return null;
    }
    if (!isPlain(handle) || typeof handle.destroy !== 'function') {
      log(`El ejercicio "${wanted}" no devolvió un manejador con destroy`);
      dead = true;
      clear(slot);
      return null;
    }
    const getResponse = () => {
      if (dead || typeof handle.getResponse !== 'function') return null;
      try { return handle.getResponse(); } catch (e) { log('No se pudo leer la respuesta del ejercicio', e); return null; }
    };
    return Object.freeze({ destroy: stop, getResponse });
  }

  return Object.freeze({ register, has, types, mount });
}
