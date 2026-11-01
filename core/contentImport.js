// @purpose: Importa un paquete de contenido a la base: lo guarda, crea las tarjetas de sus ítems y lista los ítems obsoletos.
// Importación de paquetes a la base de datos (subparte 1.3, cuarto 4, mitad 4A, parte 2). Roadmap 8.4, 8.13, 8.15 y 1.3. Sin DOM ni red propia.
//   importPackToDb(db, pack, { now }) → { ok:true, pack_id, version, status, cardsCreated, cardsRetopiced, deprecated, reactivated } | { ok:false, error }
//   (importPacksToDb, que une loadIndex + loadPack + importPackToDb, vive en content.js y se reexporta allí: 8.15)
//   deprecatedItemIds(db) → Set de ids de ítems retirados (para el armador de sesiones, 1.8)
//   cardIdOf(itemId, facet) · initialCard(item, now)
// Idempotente: reimportar no duplica ni borra NADA; solo crea las tarjetas que faltan. Los ítems que una versión nueva ya no trae NO se borran
// (su tarjeta y su historial se conservan): se anotan en `deprecated` dentro de `content_cache`. El contrato 8.4 no tiene campo «deprecated» en la
// tarjeta y cambiarlo exige al Administrador; por eso la marca vive en el registro del paquete. Cada paquete se importa en UNA transacción:
// si algo falla no queda nada a medias. Ninguna función lanza.
import { toDate, toIso } from './clock.js';
import { classifyError } from './dbErrors.js';
import { ID_RE, isPlain } from './contentCommon.js';
import { PACK_ID_RE } from './contentPack.js';

export const CACHE_STORE = 'content_cache';
export const CARDS_STORE = 'cards';
const MAX_ITEMS = 5000 + 500 * 30; // ítems + preguntas de historias (los límites del validador de paquetes)

const fail = (code, message, detail) => ({ ok: false, error: detail === undefined ? { code, message } : { code, message, detail } });
export const cardIdOf = (itemId, facet) => `${itemId}#${facet ?? 0}`;

// Tarjeta nueva con los valores iniciales de 8.4. (La 1.4 traerá `srs.newCard`; hasta entonces este ayudante local es el único lugar que los fija.)
export function initialCard(item, now) {
  const iso = toIso(now);
  const facet = item.facet ?? 0;
  return {
    id: cardIdOf(item.id, facet), itemId: item.id, facet, topics: [...item.topics],
    state: 0, due: iso, stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null,
    suspended: false, leech: false, fav: false, created: iso,
  };
}

// Los ítems de un paquete: sueltos y preguntas de sus historias (comparten espacio de ids, como en el validador). Lanza si algo no es de fiar.
function collect(pack) {
  if (!isPlain(pack) || typeof pack.pack_id !== 'string' || !PACK_ID_RE.test(pack.pack_id)) throw new Error('falta un pack_id válido');
  if (!Number.isInteger(pack.version) || pack.version < 1) throw new Error('falta una versión válida');
  if (!Array.isArray(pack.items)) throw new Error('items debe ser una lista');
  const raw = [...pack.items];
  if (pack.stories !== undefined) {
    if (!Array.isArray(pack.stories)) throw new Error('stories debe ser una lista');
    for (const s of pack.stories) if (isPlain(s) && Array.isArray(s.questions)) raw.push(...s.questions);
  }
  if (raw.length > MAX_ITEMS) throw new Error('el paquete trae demasiados ítems');
  const seen = new Set();
  const out = [];
  raw.forEach((it, i) => {
    if (!isPlain(it) || typeof it.id !== 'string' || !ID_RE.test(it.id)) throw new Error(`el ítem ${i} no tiene un id válido`);
    const facet = it.facet ?? null;
    if (facet !== null && !(Number.isInteger(facet) && facet >= 0 && facet <= 2)) throw new Error(`${it.id}: facet debe ser null o 0, 1 o 2`);
    if (!Array.isArray(it.topics) || it.topics.length === 0 || it.topics.some((t) => typeof t !== 'string')) throw new Error(`${it.id}: topics no es válido`);
    if (seen.has(it.id)) throw new Error(`el id ${it.id} está repetido`);
    seen.add(it.id);
    out.push({ id: it.id, facet, topics: [...it.topics] });
  });
  return out;
}

// Un registro de content_cache dañado (sin listas) cuenta como «sin historial»: nunca rompe la importación.
const norm = (r) => (isPlain(r) && Number.isInteger(r.version) ? {
  ...r,
  items: Array.isArray(r.items) ? r.items.filter((i) => isPlain(i) && typeof i.id === 'string') : [],
  deprecated: Array.isArray(r.deprecated) ? r.deprecated.filter((x) => typeof x === 'string') : [],
} : null);
const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

export async function importPackToDb(db, pack, { now } = {}) {
  let when;
  try { when = toDate(now); } catch { return fail('BAD_ARGS', 'Falta la hora actual para importar el contenido.'); }
  if (!db || typeof db.tx !== 'function') return fail('BAD_ARGS', 'No hay base de datos donde guardar el contenido.');
  let items;
  try { items = collect(pack); } catch (e) { return fail('BAD_PACK', 'El paquete no se puede importar.', String(e && e.message)); }
  const iso = when.toISOString();
  try {
    return await db.tx([CACHE_STORE, CARDS_STORE], async (t) => {
      const prev = norm(await t.get(CACHE_STORE, pack.pack_id));
      const base = { ok: true, pack_id: pack.pack_id, version: pack.version, cardsCreated: 0, cardsRetopiced: 0, deprecated: [], reactivated: [] };
      if (prev && pack.version < prev.version) return { ...base, version: prev.version, status: 'older' }; // nunca se retrocede
      const now_ids = new Set(items.map((i) => i.id));
      const prevIds = prev ? prev.items.map((i) => i.id) : [];
      const prevDep = prev ? prev.deprecated : [];
      // ids que otro paquete instalado sigue trayendo no se retiran
      const others = (await t.query(CACHE_STORE, {})).map(norm).filter((r) => r && r.pack_id !== pack.pack_id);
      const elsewhere = new Set(others.flatMap((r) => r.items.map((i) => i.id)));
      const removed = prevIds.filter((id) => !now_ids.has(id) && !elsewhere.has(id));
      const deprecated = [...new Set([...prevDep.filter((id) => !now_ids.has(id)), ...removed])].sort();
      const reactivated = prevDep.filter((id) => now_ids.has(id)).sort();
      for (const it of items) {
        const card = await t.get(CARDS_STORE, cardIdOf(it.id, it.facet));
        if (!card) { await t.put(CARDS_STORE, initialCard(it, when)); base.cardsCreated += 1; } else if (!sameList(card.topics ?? [], it.topics)) {
          await t.put(CARDS_STORE, { ...card, topics: [...it.topics] }); // solo los temas: nada del progreso
          base.cardsRetopiced += 1;
        }
      }
      const record = { pack_id: pack.pack_id, version: pack.version, imported: prev ? prev.imported : iso, updated: iso, items: items.map(({ id, facet }) => ({ id, facet })), deprecated };
      const same = prev && prev.version === pack.version && sameList(prev.items.map((i) => `${i.id}#${i.facet ?? 0}`), record.items.map((i) => `${i.id}#${i.facet ?? 0}`))
        && sameList(prev.deprecated, deprecated);
      const changed = !same || base.cardsCreated > 0 || base.cardsRetopiced > 0;
      if (changed) await t.put(CACHE_STORE, same ? { ...prev, updated: iso } : record);
      const newlyDep = removed.filter((id) => !prevDep.includes(id)).sort();
      return { ...base, status: !prev ? 'new' : changed ? 'updated' : 'unchanged', deprecated: newlyDep, reactivated };
    });
  } catch (e) {
    const de = classifyError(e);
    return fail('DB', de.friendly, { code: de.code, message: de.message });
  }
}

// Ítems retirados de TODOS los paquetes (y que ningún paquete vigente trae). Para que el armador de sesiones no los ofrezca.
export async function deprecatedItemIds(db) {
  try {
    const rows = (await db.query(CACHE_STORE, {})).map(norm).filter(Boolean);
    const active = new Set(rows.flatMap((r) => r.items.map((i) => i.id)));
    return new Set(rows.flatMap((r) => r.deprecated).filter((id) => !active.has(id)));
  } catch { return new Set(); }
}
