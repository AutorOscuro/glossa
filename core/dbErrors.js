// Errores de la capa de almacenamiento (subparte 0.7). Los dos adaptadores (memoria e IndexedDB) lanzan SIEMPRE DbError,
// con el mismo `code`, para que la UI y las pruebas no dependan de cuál esté detrás.
// `message` es técnico-claro (para el registro); `friendly` es el texto amable en español para mostrar a la persona.

export const DB_CODES = Object.freeze([
  'UNAVAILABLE', 'NOT_OPEN', 'CLOSED', 'UNKNOWN_STORE', 'BAD_RECORD', 'BAD_KEY', 'BAD_QUERY', 'RESERVED_KEY',
  'TX_SCOPE', 'QUOTA', 'ABORTED', 'BAD_IMPORT', 'MIGRATION', 'NEWER_VERSION', 'BLOCKED', 'UNKNOWN',
]);

const FRIENDLY = {
  UNAVAILABLE: 'Este navegador no permite guardar datos aquí. La app funciona, pero lo que hagas no se conservará al cerrarla.',
  NOT_OPEN: 'El almacenamiento todavía no está listo. Inténtalo de nuevo en un momento.',
  CLOSED: 'El almacenamiento se cerró. Recarga la app para seguir.',
  UNKNOWN_STORE: 'Hubo un problema interno al guardar (almacén desconocido). Cuéntaselo al chat con el botón "Copiar detalle".',
  BAD_RECORD: 'Hubo un problema interno: unos datos no se pudieron guardar. No se perdió nada de lo anterior.',
  BAD_KEY: 'Hubo un problema interno: a unos datos les falta su identificador. No se perdió nada de lo anterior.',
  BAD_QUERY: 'Hubo un problema interno al buscar tus datos. No se perdió nada.',
  RESERVED_KEY: 'Ese dato es de uso interno de la app y no se puede cambiar.',
  TX_SCOPE: 'Hubo un problema interno al guardar varios datos juntos. No se guardó nada a medias.',
  QUOTA: 'No queda espacio en el dispositivo para guardar tu progreso. Libera espacio o exporta un respaldo; lo ya guardado sigue intacto.',
  ABORTED: 'No se pudo completar el guardado. No se guardó nada a medias; inténtalo otra vez.',
  BAD_IMPORT: 'El archivo de respaldo no es válido o está dañado. No se cambió nada.',
  MIGRATION: 'No se pudo actualizar tus datos a la versión nueva. Tus datos anteriores siguen intactos; cuéntaselo al chat.',
  NEWER_VERSION: 'Tus datos son de una versión más nueva de la app que esta. Actualiza la app antes de seguir.',
  BLOCKED: 'Hay otra ventana de la app abierta que impide actualizar los datos. Ciérrala y vuelve a intentarlo.',
  UNKNOWN: 'Algo falló al guardar o leer tus datos. Inténtalo otra vez; si se repite, copia el detalle y cuéntaselo al chat.',
};

export class DbError extends Error {
  constructor(code, message, { store, cause, problems, retryable } = {}) {
    super(message || FRIENDLY[code] || FRIENDLY.UNKNOWN);
    this.name = 'DbError';
    this.code = DB_CODES.includes(code) ? code : 'UNKNOWN';
    this.friendly = FRIENDLY[this.code];
    if (store !== undefined) this.store = store;
    if (cause !== undefined) this.cause = cause;
    if (problems !== undefined) this.problems = problems;
    this.retryable = retryable ?? ['QUOTA', 'ABORTED', 'BLOCKED', 'NOT_OPEN'].includes(this.code);
  }
}

export function friendlyMessage(code) {
  return FRIENDLY[code] ?? FRIENDLY.UNKNOWN;
}

// Convierte cualquier error crudo (DOMException de IndexedDB, error de la prueba…) en un DbError. Nunca lanza.
export function classifyError(e, ctx = {}) {
  if (e instanceof DbError) return e;
  const name = e && typeof e === 'object' ? String(e.name ?? '') : '';
  const msg = e && typeof e === 'object' ? String(e.message ?? '') : String(e ?? '');
  const opts = { ...ctx, cause: e };
  if (name === 'QuotaExceededError' || e?.code === 22 || /quota/i.test(msg)) return new DbError('QUOTA', `Cuota llena: ${msg}`, opts);
  if (name === 'DataCloneError') return new DbError('BAD_RECORD', `Dato no almacenable: ${msg}`, opts);
  if (name === 'VersionError') return new DbError('NEWER_VERSION', `Versión de base mayor que la del código: ${msg}`, opts);
  if (name === 'NotFoundError') return new DbError('UNKNOWN_STORE', `Almacén no encontrado: ${msg}`, opts);
  if (name === 'AbortError' || name === 'ConstraintError' || name === 'TransactionInactiveError') return new DbError('ABORTED', `Transacción abortada: ${msg}`, opts);
  if (name === 'InvalidStateError') return new DbError('CLOSED', `Conexión cerrada: ${msg}`, opts);
  if (name === 'SecurityError') return new DbError('UNAVAILABLE', `Almacenamiento bloqueado por el navegador: ${msg}`, opts);
  return new DbError('UNKNOWN', `Error inesperado: ${msg}`, opts);
}
