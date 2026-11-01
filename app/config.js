// @purpose: Constantes de la app (nombre, base de datos, prefijo de almacenamiento, idiomas y tema por defecto); sin claves.
// Constantes de la app. NO poner claves ni tokens aquí (contrato 8.16 / regla 4.2-8).
// El nombre de la app se cambia aquí y en manifest.webmanifest (0.6).
export const APP_NAME = 'Glossa';
export const APP_SHORT_NAME = 'Glossa';

// Almacenamiento: IndexedDB (8.13). El nombre 'sophia_ingles' es HISTÓRICO (la app se llamaba Sophia Inglés) y NO se cambia:
// renombrar la base dejaría vacía la de quien ya usa la app. El prefijo también evita choques con el otro proyecto Sophia (sophia_v7…).
export const DB_NAME = 'sophia_ingles';
export const STORAGE_PREFIX = 'sing_';

// Idiomas: contenido en inglés americano, explicaciones en español (8.1).
export const CONTENT_LOCALE = 'en-US';
export const UI_LOCALE = 'es';

export const DEFAULT_THEME = 'aurora';
