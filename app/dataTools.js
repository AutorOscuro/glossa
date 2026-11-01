// @purpose: Herramientas de datos de Ajustes: borrar claves guardadas y borrar todo (sin DOM).
// Herramientas de datos para Ajustes (subparte 0.8, cuarto 3A): borrar claves y borrar todo. Sin DOM; se prueba con Node.
//
//   createDataTools({ db?, settings }) → {
//     clearKeys()  → Promesa. Borra las claves secretas (IA y Azure) del dispositivo; el resto de ajustes queda igual.
//     wipeAll()    → Promesa. Borra todo: tarjetas, eventos, errores, notas, ajustes y claves. Queda como recién instalada.
//                    Atómico: una sola transacción; si falla, no se borra nada y se lanza el error (con `friendly`).
//                    Luego recarga los ajustes (valores por defecto) para que la pantalla y la apariencia se actualicen en vivo.
//                    Solo se conserva lo reservado del motor (versión del esquema). Vacía cada almacén con t.clear (1.12-T1), no fila a fila.
//     afterRestore() → Promesa. Recarga los ajustes desde la base tras importar un respaldo.
//   `afterChange` (opcional, 2.9-T3 punto 3): función que se llama tras «Borrar todo» y tras importar (la app la usa para volver a importar el contenido,
//   porque ambos pueden dejar la base sin tarjetas). Si falla o lanza, se anota en `log` y NO rompe la operación.
//   }
//   Sin `db` (solo memoria) wipeAll solo restablece los ajustes en memoria.
import { STORES } from '../core/db.js';

export function createDataTools({ db = null, settings, afterChange = null, log = console.error } = {}) {
  if (!settings) throw new TypeError('createDataTools necesita settings');
  const names = Object.keys(STORES);
  const changed = async () => {
    if (typeof afterChange !== 'function') return;
    try { await afterChange(); } catch (e) { log('No se pudo preparar el contenido tras cambiar los datos', e); }
  };
  return {
    async clearKeys() {
      await settings.clearSecrets();
    },
    async wipeAll() {
      if (db) {
        await db.tx(names, async (t) => {
          for (const name of names) await t.clear(name);
        });
      } else {
        await settings.clearSecrets();
      }
      await settings.load();
      await changed();
    },
    async afterRestore() {
      await settings.load();
      await changed();
    },
  };
}
