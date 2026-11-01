// @purpose: Genera asset-manifest.json y escribe la versión de caché en sw.js (npm run build).
// Genera asset-manifest.json y escribe la versión de caché en sw.js (subparte 0.6).
//
//   node tools/build-manifest.mjs           → escribe asset-manifest.json y actualiza la línea CACHE_VERSION de sw.js
//   node tools/build-manifest.mjs --check   → no escribe; sale con código 1 si algo está desactualizado
//   npm run build  (= el primero)
//
// DETERMINISTA: misma entrada → misma salida (sin fechas, orden fijo, solo hashes del contenido). Cualquier cambio en
// un archivo precacheado (o en core/version.js) cambia `cacheVersion`; el navegador ve un sw.js distinto, instala la
// caché nueva y la app ofrece "Actualizar". Si olvidas ejecutarlo, el test "asset-manifest al día" falla.
// Se precachea el shell: index.html, manifest, app/, core/, ui/, vendor/, icons/ y content/ (índice, taxonomía y paquetes).
// Un paquete nuevo o cambiado cambia `cacheVersion` (decisión del Administrador, 2.9-T3 punto 2; sustituye al SWR de paquetes mientras content/ pese < 15 MB).
// NO se precachea (va por su propia estrategia en sw.js): audio/. Tampoco tests, tools, docs, content/drafts ni la galería.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cacheVersionName, parseVersion } from '../app/versionCompare.js';

export const SCHEMA = 1;
export const INCLUDE_DIRS = ['app', 'core', 'ui', 'vendor', 'icons', 'content/taxonomy', 'content/packs'];
export const INCLUDE_FILES = ['index.html', 'manifest.webmanifest', 'content/index.json'];
export const MANIFEST_FILE = 'asset-manifest.json';
export const SW_FILE = 'sw.js';
const SW_LINE = /^const CACHE_VERSION = '[^']*'; \/\/ build-manifest:cache-version$/m;

const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');

// ¿Se precachea este archivo? (ruta relativa con "/")
export function isPrecached(rel) {
  const base = rel.split('/').pop();
  if (base.startsWith('.')) return false; // .gitkeep y similares
  if (/\.(md|py)$/.test(base)) return false;
  if (/^ui\/styles\/demo[.-]/.test(rel)) return false; // galería de desarrollo
  return INCLUDE_FILES.includes(rel) || INCLUDE_DIRS.some((d) => rel.startsWith(`${d}/`));
}

function walk(dir, root, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, root, out);
    else if (entry.isFile()) out.push(path.relative(root, full).split(path.sep).join('/'));
  }
}

export function collectFiles(root) {
  const all = [];
  for (const d of INCLUDE_DIRS) walk(path.join(root, d), root, all);
  for (const f of INCLUDE_FILES) if (fs.existsSync(path.join(root, f))) all.push(f);
  return all.filter(isPrecached).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)); // orden por código, no por idioma
}

export function readVersion(root) {
  const text = fs.readFileSync(path.join(root, 'core/version.js'), 'utf8');
  const m = /VERSION\s*=\s*'([^']*)'/.exec(text);
  if (!m) throw new Error('core/version.js: no encuentro VERSION = \'x.y.z\'');
  parseVersion(m[1]);
  return m[1];
}

export function buildAssetManifest(root) {
  const version = readVersion(root);
  const files = collectFiles(root).map((rel) => {
    const data = fs.readFileSync(path.join(root, rel));
    return { path: rel, hash: sha(data).slice(0, 16), size: data.length };
  });
  if (!files.some((f) => f.path === 'index.html')) throw new Error('falta index.html: sin él no hay shell que precachear');
  const digest = sha(files.map((f) => `${f.path}:${f.hash}`).join('\n')).slice(0, 8);
  return { schema: SCHEMA, version, cacheVersion: cacheVersionName(version, digest), files };
}

export const serialize = (manifest) => `${JSON.stringify(manifest, null, 2)}\n`;

export function renderSw(swText, cacheVersion) {
  const hits = swText.match(new RegExp(SW_LINE.source, 'gm')) ?? [];
  if (hits.length !== 1) throw new Error(`sw.js debe tener exactamente una línea "const CACHE_VERSION = '…'; // build-manifest:cache-version" (hay ${hits.length})`);
  return swText.replace(SW_LINE, `const CACHE_VERSION = '${cacheVersion}'; // build-manifest:cache-version`);
}

function expected(root) {
  const manifest = buildAssetManifest(root);
  const swPath = path.join(root, SW_FILE);
  return { manifest, manifestText: serialize(manifest), swText: renderSw(fs.readFileSync(swPath, 'utf8'), manifest.cacheVersion) };
}

export function writeBuild(root) {
  const { manifest, manifestText, swText } = expected(root);
  const changed = [];
  const put = (name, text) => {
    const p = path.join(root, name);
    if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== text) {
      fs.writeFileSync(p, text);
      changed.push(name);
    }
  };
  put(MANIFEST_FILE, manifestText);
  put(SW_FILE, swText);
  return { manifest, changed };
}

export function checkBuild(root) {
  const problems = [];
  const { manifest, manifestText, swText } = expected(root);
  const read = (name) => (fs.existsSync(path.join(root, name)) ? fs.readFileSync(path.join(root, name), 'utf8') : null);
  if (read(MANIFEST_FILE) !== manifestText) problems.push(`${MANIFEST_FILE} está desactualizado o falta (ejecuta: npm run build)`);
  if (read(SW_FILE) !== swText) problems.push(`la CACHE_VERSION de ${SW_FILE} no coincide con ${manifest.cacheVersion} (ejecuta: npm run build)`);
  return { ok: problems.length === 0, problems, manifest };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    if (process.argv.includes('--check')) {
      const r = checkBuild(root);
      if (!r.ok) {
        for (const p of r.problems) console.error(`✘ ${p}`);
        process.exit(1);
      }
      process.stdout.write(`✔ asset-manifest al día (${r.manifest.cacheVersion}, ${r.manifest.files.length} archivos)\n`);
    } else {
      const { manifest, changed } = writeBuild(root);
      const what = changed.length ? `actualizado: ${changed.join(', ')}` : 'sin cambios';
      process.stdout.write(`✔ ${manifest.cacheVersion} · ${manifest.files.length} archivos · ${what}\n`);
    }
  } catch (e) {
    console.error(`✘ build-manifest: ${e.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
