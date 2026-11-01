// @purpose: Compara versiones x.y.z y arma o interpreta nombres de caché (lógica pura que usan el build y el aviso de actualización).
// Comparación de versiones y nombres de caché (subparte 0.6). Lógica PURA, sin DOM ni red.
// La usan tools/build-manifest.mjs (escribe el nombre de la caché) y, en la segunda mitad de la 0.6, el aviso de
// actualización de la app. Formato de versión: "MAYOR.MENOR.PARCHE" (solo números), igual que core/version.js.
//
//   parseVersion('0.5.0') → { major, minor, patch }       (lanza TypeError si no es válida)
//   compareVersions(a, b) → -1 | 0 | 1
//   isNewerVersion(candidata, actual) → boolean
//   cacheVersionName('0.5.0', 'a1b2c3d4') → 'sophia-shell-0.5.0-a1b2c3d4'
//   parseCacheVersion(nombre) → { version, hash } | null  (null si no es una caché de la app)
//   updateKind(cacheActual, cacheNueva) → 'none' | 'content' | 'version' | 'downgrade' | 'unknown'
//       none = misma caché · content = misma versión pero archivos distintos · version = versión más nueva
//       downgrade = la nueva tiene versión MENOR (p. ej. se subió un zip viejo) · unknown = algún nombre no se entiende
export const CACHE_PREFIX = 'sophia-shell-';

const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const HASH_RE = /^[0-9a-f]{8}$/;
const CACHE_RE = /^sophia-shell-(\d+\.\d+\.\d+)-([0-9a-f]{8})$/;

export function parseVersion(value) {
  const m = typeof value === 'string' ? VERSION_RE.exec(value) : null;
  if (!m) throw new TypeError(`versión inválida: ${JSON.stringify(value)} (se espera MAYOR.MENOR.PARCHE, p. ej. 0.5.0)`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  for (const k of ['major', 'minor', 'patch']) {
    if (x[k] !== y[k]) return x[k] < y[k] ? -1 : 1;
  }
  return 0;
}

export const isNewerVersion = (candidate, current) => compareVersions(candidate, current) === 1;

export function cacheVersionName(version, hash) {
  parseVersion(version);
  if (typeof hash !== 'string' || !HASH_RE.test(hash)) throw new TypeError(`hash inválido: ${JSON.stringify(hash)} (8 caracteres hexadecimales en minúscula)`);
  return `${CACHE_PREFIX}${version}-${hash}`;
}

export function parseCacheVersion(name) {
  const m = typeof name === 'string' ? CACHE_RE.exec(name) : null;
  if (!m) return null;
  try {
    parseVersion(m[1]);
  } catch {
    return null;
  }
  return { version: m[1], hash: m[2] };
}

export function updateKind(currentCache, nextCache) {
  const a = parseCacheVersion(currentCache);
  const b = parseCacheVersion(nextCache);
  if (!a || !b) return 'unknown';
  if (a.version === b.version && a.hash === b.hash) return 'none';
  const order = compareVersions(b.version, a.version);
  if (order === 1) return 'version';
  if (order === -1) return 'downgrade';
  return 'content';
}
