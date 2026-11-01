// @purpose: Recorrido determinista del repositorio, huellas sha1 por archivo y tree-hash del mapa; calcula creados, modificados y eliminados (0.9-T1).
// Sin análisis de código (eso es repoMapParse.mjs) ni escritura del mapa (eso es repo-map.mjs).
//
//   listFiles(root, { exclude? }) → [{ path, abs }]     rutas NFC con «/», ordenadas por unidad de código (nunca localeCompare)
//   snapshot(root, opts)         → [{ path, abs, buf, sha1, size }]
//   hashLines(entries)           → texto «ruta␠sha1\n» por archivo (contenido exacto de docs/REPO_MAP.hashes)
//   treeHash(entries | texto)    → sha256 hexadecimal del texto anterior
//   parseHashLines(texto)        → Map ruta → sha1 (corta por el último espacio, así que las rutas pueden llevar espacios)
//   diffTrees(guardado, entries) → { created, modified, deleted } ordenados
//
// Se excluyen: carpetas .git, node_modules, __pycache__ y __MACOSX; archivos .DS_Store, Thumbs.db y desktop.ini; cualquier
// *.zip y *.pyc (sin distinguir mayúsculas); enlaces simbólicos; y el mapa con su archivo de huellas (`exclude`).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const MAP_FILE = 'docs/REPO_MAP.md';
export const HASHES_FILE = 'docs/REPO_MAP.hashes';

const SKIP_NAMES = new Set(['.git', 'node_modules', '__pycache__', '__macosx', '.ds_store', 'thumbs.db', 'desktop.ini']);
const SKIP_EXT = /\.(?:zip|pyc)$/i;

const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sha = (algo, data) => crypto.createHash(algo).update(data).digest('hex');

/** Convierte una ruta del sistema a la forma del mapa: NFC y separador «/». */
export function toRepoPath(rel) {
  return rel.split(path.sep).join('/').normalize('NFC');
}

/**
 * Lista todos los archivos del repositorio con las exclusiones de arriba.
 * Lanza Error si una ruta contiene un salto de línea o si dos rutas distintas colisionan tras NFC.
 */
export function listFiles(root, { exclude = [MAP_FILE, HASHES_FILE] } = {}) {
  const skip = new Set(exclude);
  const found = new Map();
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isSymbolicLink() || SKIP_NAMES.has(e.name.toLowerCase())) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { walk(abs); continue; }
      if (!e.isFile() || SKIP_EXT.test(e.name)) continue;
      const rel = toRepoPath(path.relative(root, abs));
      if (/[\n\r]/.test(rel)) throw new Error(`La ruta contiene un salto de línea y no cabe en el mapa: ${JSON.stringify(rel)}`);
      if (skip.has(rel)) continue;
      if (found.has(rel)) throw new Error(`Dos archivos distintos tienen la misma ruta tras normalizar (NFC): ${JSON.stringify(rel)}`);
      found.set(rel, abs);
    }
  })(root);
  return [...found.keys()].sort(byCodeUnit).map((rel) => ({ path: rel, abs: found.get(rel) }));
}

/** Lee cada archivo una sola vez: contenido, sha1 y tamaño. */
export function snapshot(root, opts) {
  return listFiles(root, opts).map((f) => {
    const buf = fs.readFileSync(f.abs);
    return { path: f.path, abs: f.abs, buf, sha1: sha('sha1', buf), size: buf.length };
  });
}

export function hashLines(entries) {
  return entries.map((e) => `${e.path} ${e.sha1}\n`).join('');
}

/** sha256 del texto de huellas (acepta las entradas o el texto ya armado). */
export function treeHash(source) {
  return sha('sha256', typeof source === 'string' ? source : hashLines(source));
}

export function parseHashLines(text) {
  const map = new Map();
  for (const line of String(text).split('\n')) {
    const cut = line.lastIndexOf(' ');
    if (cut <= 0) continue;
    const sha1 = line.slice(cut + 1).trim();
    if (/^[0-9a-f]{40}$/.test(sha1)) map.set(line.slice(0, cut), sha1);
  }
  return map;
}

export function diffTrees(saved, entries) {
  const created = [];
  const modified = [];
  const seen = new Set();
  for (const e of entries) {
    seen.add(e.path);
    if (!saved.has(e.path)) created.push(e.path);
    else if (saved.get(e.path) !== e.sha1) modified.push(e.path);
  }
  const deleted = [...saved.keys()].filter((p) => !seen.has(p));
  return { created: created.sort(byCodeUnit), modified: modified.sort(byCodeUnit), deleted: deleted.sort(byCodeUnit) };
}
