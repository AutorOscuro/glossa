// Respaldo exportar/importar (subparte 0.8, cuarto 3A). ESQUEMA PROVISIONAL: la subparte 1.12 amplía este archivo con el puente con el chat
// (makeChatBlock / parseChatBlock, formato SOPHIA-EN-SYNC v1) y conserva estos nombres. Hasta entonces solo cubre el respaldo de la base.
//
//   createSync({ db, clock? }) → {
//     exportBackup({ includeSecrets? = false }) → Promesa de { json, filename, counts }
//         json = texto JSON del respaldo (db.exportAll). Sin includeSecrets las claves NO van en el archivo.
//     importBackup(text, { mode? = 'replace', keepSecrets? = true }) → Promesa de { stores, migratedFrom, total }
//         Valida antes de tocar nada; si el texto no es un respaldo válido lanza DbError('BAD_IMPORT') y no cambia nada.
//         Por defecto reemplaza y CONSERVA las claves que ya hay en este dispositivo (el respaldo normal no las trae).
//   }
//   backupFilename(date) → "sophia-respaldo-AAAA-MM-DD.json" (día local).
import { DbError } from './dbErrors.js';
import { localDay } from './clock.js';

export const MAX_BACKUP_CHARS = 50_000_000;

export function backupFilename(date) {
  return `sophia-respaldo-${localDay(date)}.json`;
}

export function createSync({ db, clock } = {}) {
  const need = () => {
    if (!db) throw new DbError('UNAVAILABLE');
    return db;
  };
  const nowDate = () => (clock ? clock.now() : new Date());
  return {
    async exportBackup({ includeSecrets = false } = {}) {
      const data = await need().exportAll({ includeSecrets: includeSecrets === true });
      const counts = Object.fromEntries(Object.entries(data.stores).map(([k, rows]) => [k, rows.length]));
      return { json: JSON.stringify(data), filename: backupFilename(nowDate()), counts };
    },
    async importBackup(text, { mode = 'replace', keepSecrets = true } = {}) {
      const d = need();
      if (typeof text !== 'string' || text.trim() === '') throw new DbError('BAD_IMPORT', 'El respaldo está vacío');
      if (text.length > MAX_BACKUP_CHARS) throw new DbError('BAD_IMPORT', 'El respaldo es demasiado grande');
      let data;
      try { data = JSON.parse(text); } catch (e) { throw new DbError('BAD_IMPORT', 'El respaldo no es un JSON válido', { cause: e }); }
      const res = await d.importAll(data, { mode, keepSecrets });
      return { ...res, total: Object.values(res.stores).reduce((a, n) => a + n, 0) };
    },
  };
}
