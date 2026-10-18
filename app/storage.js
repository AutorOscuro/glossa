// Arranque del almacenamiento (subparte 0.7, B2b): abre la base, muestra el aviso de "solo memoria" y gestiona persist().
//
//   startStorage({ name, notice, win?, clock?, open?, persist? }) → Promesa de
//     { db|null, mode: 'indexeddb'|'memory'|'none', persistent, error|null, markSessionDone(), persistence() }
//   · Nunca lanza: si la base no se puede abrir, `db` es null, `mode` 'none' y se muestra un aviso con el texto amable del DbError.
//   · mode 'memory' → aviso persistente (se quita con "Entendido"; vuelve a salir en el siguiente arranque): los datos NO se conservarán.
//   · "Primera sesión real" = la primera vez que alguien llama a markSessionDone() (lo hará el ejecutor de sesión, subparte 2.1,
//     al terminar una sesión de estudio). Se guarda en meta.firstSession; desde entonces, cada arranque (y esa misma llamada)
//     intenta requestPersistence, que pregunta al navegador una sola vez.
//   · `persist()` solo se intenta con IndexedDB real; en memoria no tiene sentido.
import { openDatabase } from '../core/dbOpen.js';
import { requestPersistence } from '../core/persist.js';
import { friendlyMessage } from '../core/dbErrors.js';

export const FIRST_SESSION_KEY = 'firstSession';
export const ACK_LABEL = 'Entendido';

export async function startStorage({ name, notice, win = globalThis, clock, open = openDatabase, persist = requestPersistence } = {}) {
  const nowDate = () => (clock ? clock.now() : new Date());
  const warn = (message) => { try { notice?.show({ message, actionLabel: ACK_LABEL, onAction: () => notice.hide() }); } catch { /* el aviso es un extra */ } };
  let res;
  try {
    res = await open({ name, factory: win.indexedDB, ...(clock ? { clock } : {}) });
  } catch (e) {
    warn(e?.friendly ?? friendlyMessage('UNKNOWN'));
    return { db: null, mode: 'none', persistent: false, error: e, markSessionDone: async () => ({ status: 'unsupported', granted: false }), persistence: async () => ({ status: 'unsupported', granted: false }) };
  }
  const { db, mode, persistent } = res;
  if (res.warning) warn(res.warning.message);

  const askBrowser = async (sessionDone) => {
    if (mode !== 'indexeddb') return { status: 'unsupported', granted: false };
    return persist({ db, storage: win.navigator?.storage, now: nowDate(), sessionDone });
  };
  const persistence = async () => askBrowser((await db.get('meta', FIRST_SESSION_KEY).catch(() => null)) !== null);
  const markSessionDone = async () => {
    try {
      if ((await db.get('meta', FIRST_SESSION_KEY)) === null) await db.put('meta', { key: FIRST_SESSION_KEY, at: nowDate().toISOString() });
    } catch { return { status: 'error', granted: false }; }
    return askBrowser(true);
  };
  persistence().catch(() => undefined); // si ya hubo una primera sesión, se intenta de una vez (no bloquea el arranque)
  return { db, mode, persistent, error: null, markSessionDone, persistence };
}
