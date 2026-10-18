// Elige el motor de almacenamiento (subparte 0.7, B2a). Puro y probable con Node: todo lo del entorno se inyecta.
//   · Hay IndexedDB y abre bien → motor real, mode 'indexeddb', persistent true.
//   · No hay IndexedDB (o el navegador la bloquea: UNAVAILABLE) → motor en memoria, mode 'memory', persistent false
//     y `warning` con el texto amable para el aviso visible (la UI lo muestra; los datos no se conservarán).
//   · Cualquier OTRO fallo (NEWER_VERSION, MIGRATION, BLOCKED, QUOTA…) NO cae a memoria en silencio: se propaga,
//     porque caer a memoria escondería datos reales guardados que la persona aún tiene.
import { DbError, friendlyMessage } from './dbErrors.js';
import { createIdbDb } from './db.idb.js';
import { createMemoryDb } from './db.memory.js';

export async function openDatabase({ name, factory = globalThis.indexedDB, clock, createIdb = createIdbDb, createMemory = createMemoryDb } = {}) {
  if (typeof name !== 'string' || name === '') throw new Error('openDatabase: name es obligatorio');
  const opts = clock ? { clock } : {};
  if (factory) {
    const db = createIdb({ name, factory, ...opts });
    try {
      const info = await db.open();
      return { db, mode: 'indexeddb', persistent: info.persistent, info, warning: null };
    } catch (e) {
      if (!(e instanceof DbError) || e.code !== 'UNAVAILABLE') throw e;
      try { await db.close(); } catch { /* nada que cerrar */ }
    }
  }
  const db = createMemory(opts);
  const info = await db.open();
  return {
    db, mode: 'memory', persistent: false, info,
    warning: { code: 'UNAVAILABLE', title: 'Modo solo memoria', message: friendlyMessage('UNAVAILABLE') },
  };
}
