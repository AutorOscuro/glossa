// Herramientas de datos para Ajustes (subparte 0.8, cuarto 3A): borrar claves y borrar todo. Sin DOM; se prueba con Node.
//
//   createDataTools({ db?, settings }) → {
//     clearKeys()  → Promesa. Borra las claves secretas (IA y Azure) del dispositivo; el resto de ajustes queda igual.
//     wipeAll()    → Promesa. Borra todo: tarjetas, eventos, errores, notas, ajustes y claves. Queda como recién instalada.
//                    Atómico: una sola transacción; si falla, no se borra nada y se lanza el error (con `friendly`).
//                    Luego recarga los ajustes (valores por defecto) para que la pantalla y la apariencia se actualicen en vivo.
//                    Solo se conserva lo reservado del motor (versión del esquema).
//     afterRestore() → Promesa. Recarga los ajustes desde la base tras importar un respaldo.
//   }
//   Sin `db` (solo memoria) wipeAll solo restablece los ajustes en memoria.
import { STORES, isReserved } from '../core/db.js';

export function createDataTools({ db = null, settings } = {}) {
  if (!settings) throw new TypeError('createDataTools necesita settings');
  const names = Object.keys(STORES);
  return {
    async clearKeys() {
      await settings.clearSecrets();
    },
    async wipeAll() {
      if (db) {
        await db.tx(names, async (t) => {
          for (const name of names) {
            const keyPath = STORES[name].keyPath;
            for (const rec of await t.query(name)) {
              const key = rec[keyPath];
              if (!isReserved(name, key)) await t.delete(name, key);
            }
          }
        });
      } else {
        await settings.clearSecrets();
      }
      await settings.load();
    },
    async afterRestore() {
      await settings.load();
    },
  };
}
