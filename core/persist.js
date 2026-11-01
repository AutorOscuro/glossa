// @purpose: Pide almacenamiento persistente al navegador una sola vez, tras la primera sesión real.
// Almacenamiento persistente (subparte 0.7, B2a): pide navigator.storage.persist() UNA vez, tras la primera sesión real.
// Puro: `storage` (navigator.storage) y `db` se inyectan. El resultado se guarda en meta.persistRequest para no insistir.
//   requestPersistence({ db, storage, now, sessionDone }) → { status, granted }
//   status: 'unsupported' (el navegador no ofrece persist) · 'not-yet' (aún no hay sesión real) · 'already' (ya estaba concedido)
//           'granted' · 'denied' (se pidió y no se concedió) · 'skipped' (ya se había pedido antes y no se insiste)
//           'error' (falló al pedir; se podrá reintentar)
export const PERSIST_KEY = 'persistRequest';

export async function requestPersistence({ db, storage, now, sessionDone } = {}) {
  if (!storage || typeof storage.persist !== 'function') return { status: 'unsupported', granted: false };
  if (sessionDone !== true) return { status: 'not-yet', granted: false };
  try {
    if (typeof storage.persisted === 'function' && (await storage.persisted()) === true) {
      await save(db, now, true);
      return { status: 'already', granted: true };
    }
    const prev = await db.get('meta', PERSIST_KEY);
    if (prev && prev.asked === true) return { status: 'skipped', granted: prev.granted === true };
    const granted = (await storage.persist()) === true;
    await save(db, now, granted);
    return { status: granted ? 'granted' : 'denied', granted };
  } catch {
    return { status: 'error', granted: false };
  }
}

async function save(db, now, granted) {
  await db.put('meta', { key: PERSIST_KEY, asked: true, granted, at: (now instanceof Date ? now : new Date()).toISOString() });
}
