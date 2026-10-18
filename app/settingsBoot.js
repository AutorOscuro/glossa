// Arranque de los ajustes (subparte 0.8, cuarto 2): crea `settings` sobre la base, los carga y aplica la apariencia.
//
//   startSettings({ storageReady, doc, win, log? }) → Promesa de { settings, appearance }   (NUNCA rechaza)
//     · Espera a `storageReady` (app/storage.js). Si la base no abrió (db null) o falla la lectura, los ajustes
//       quedan con sus valores por defecto SOLO en memoria (createSettings() sin db) y se registra el motivo.
//     · Aplica tema y tamaño de texto apenas cargan y los mantiene en vivo (app/appearance.js).
//   Las vistas usan `services.settingsReady` (esta promesa) y de ahí `services.settings`.
import { createSettings } from '../core/settings.js';
import { createAppearance } from './appearance.js';

export async function startSettings({ storageReady, doc, win, log = console.error } = {}) {
  let db = null;
  try {
    db = (await storageReady)?.db ?? null;
  } catch (e) {
    log('No se pudo esperar al almacenamiento; los ajustes quedan solo en memoria', e);
  }
  let settings = createSettings({ db });
  try {
    await settings.load();
  } catch (e) {
    log('No se pudieron leer los ajustes guardados; se usan los valores por defecto', e);
    settings = createSettings();
    await settings.load();
  }
  const appearance = createAppearance({ doc, win, settings, log });
  appearance.apply();
  return { settings, appearance };
}
