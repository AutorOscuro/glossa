// @purpose: Comando «agregar paquete» (npm run add-pack): valida e instala paquetes de contenido; es la única forma de meter contenido al repo.
// Comando «agregar paquete» (subparte 1.3, cuarto 4, mitad 4B). Roadmap 1.3 y 8.10. Es la ÚNICA forma de meter contenido al repo.
// Uso:  npm run add-pack -- [opciones] <archivo.json | carpeta> […]
//   --dry-run   valida y muestra qué haría, sin escribir nada        --quiet, -q   solo lo que falla y el resumen
//   --root <carpeta>   raíz del repo (por defecto, la de este script)   --help, -h   esta ayuda
//   --force --reason "texto"   SOLO el Administrador: permite reemplazar con la misma versión (contenido distinto) o con una menor
// Código de salida: 0 todo en orden (incluso si no había nada que hacer) · 1 hay errores de contenido o de versión (no se escribió nada) · 2 uso incorrecto.
// Flujo: (1) valida TODOS los paquetes con el mismo código que `validate-content` (taxonomía, ids únicos contra los instalados, etc.);
// (2) si hay un solo error, no escribe nada; (3) copia cada paquete a content/packs/<pack_id>.json (JSON con sangría de 2 espacios y `\n` final);
// (4) regenera sus entradas de content/index.json, ordenadas por pack_id; todo con archivo temporal + renombrar y, si algo falla a mitad, se deshace.
// Seguridad: nunca escribe fuera de content/; el nombre del archivo sale del pack_id (solo [a-z][a-z0-9_]); no sigue enlaces simbólicos; no ejecuta nada del contenido.
// Lógica en funciones exportadas (planAddPack, applyPlan, addPack, formatAddPack); `main` es una capa fina.
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateIndex, packPath, INDEX_SCHEMA } from '../core/content.js';
import { validateContent, formatResult } from './validate-content.mjs';
import { UsageError, readJsonFile } from './contentFs.mjs';

export { UsageError };
const stable = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sizeKb = (text) => Math.max(1, Math.ceil(Buffer.byteLength(text, 'utf8') / 1024));
const lstat = (p) => { try { return fs.lstatSync(p); } catch { return null; } };

// El árbol de destino: content/ y content/packs/ deben ser carpetas reales (no enlaces) y estar dentro de la raíz.
function checkTarget(root) {
  for (const rel of ['content', 'content/packs']) {
    const st = lstat(path.join(root, rel));
    if (st && (st.isSymbolicLink() || !st.isDirectory())) throw new UsageError(`${rel} no es una carpeta normal (¿enlace simbólico?). No escribo ahí.`);
  }
}

// Decide qué haría con cada paquete. No escribe nada. Devuelve { ok, validation, actions, index, writes, errors }.
export function planAddPack({ root, inputs = [], cwd = process.cwd(), force = false } = {}) {
  if (!Array.isArray(inputs) || inputs.length === 0) throw new UsageError('Indica al menos un archivo .json o una carpeta con paquetes.');
  const validation = validateContent({ root, inputs, cwd });
  const rootFull = validation.root;
  checkTarget(rootFull);
  const plan = { ok: false, validation, actions: [], index: { action: 'unchanged' }, writes: [], errors: [] };
  if (validation.exitCode !== 0) return plan; // un solo error y no se escribe nada
  const packsDir = path.join(rootFull, 'content', 'packs');
  const indexFile = path.join(rootFull, 'content', 'index.json');
  const entries = new Map();
  for (const f of validation.files) {
    const target = path.join(packsDir, `${f.packId}.json`);
    const content = stable(f.pack);
    const act = { packId: f.packId, version: f.version, display: f.display, target, content, action: 'add' };
    const st = lstat(target);
    if (st && (st.isSymbolicLink() || !st.isFile())) { act.action = 'error'; act.code = 'TARGET'; act.message = `content/packs/${f.packId}.json existe y no es un archivo normal.`; } else if (st) {
      const old = readJsonFile(target);
      if (!old.ok) { act.action = 'error'; act.code = 'INSTALLED_UNREADABLE'; act.message = `el paquete instalado ${f.packId}.json no se puede leer (${old.message}).`; } else if (!old.value || !Number.isInteger(old.value.version)) { act.action = 'error'; act.code = 'INSTALLED_UNREADABLE'; act.message = `el paquete instalado ${f.packId}.json no tiene versión.`; } else if (f.version > old.value.version) { act.action = 'replace'; act.from = old.value.version; } else if (f.version === old.value.version && isDeepStrictEqual(old.value, f.pack)) { act.action = 'unchanged'; act.from = old.value.version; } else if (force) { act.action = 'replace'; act.from = old.value.version; act.forced = true; } else if (f.version === old.value.version) {
        act.action = 'error'; act.code = 'VERSION_SAME_DIFFERENT';
        act.message = `ya está instalado ${f.packId} en la versión ${f.version} con contenido distinto. Si cambiaste el contenido, sube la versión del paquete.`;
      } else { act.action = 'error'; act.code = 'VERSION_LOWER'; act.message = `ya está instalado ${f.packId} en la versión ${old.value.version}, más nueva que la ${f.version}. No se pisa.`; }
    }
    if (act.action === 'error') plan.errors.push(act);
    else {
      entries.set(f.packId, { pack_id: f.packId, version: f.version, path: packPath(f.packId), topics: [...f.pack.topics], items_count: f.pack.items.length, size_kb: sizeKb(content) });
      if (act.action !== 'unchanged') plan.writes.push({ file: target, content });
    }
    plan.actions.push(act);
  }
  if (plan.errors.length) return plan;
  // índice: se leen las entradas actuales, se ponen/actualizan las de este lote y se ordena por pack_id
  let index = { schema: INDEX_SCHEMA, packs: [] };
  const had = lstat(indexFile);
  if (had) {
    const cur = had.isSymbolicLink() ? { ok: false, message: 'es un enlace simbólico' } : readJsonFile(indexFile);
    if (!cur.ok) throw new UsageError(`content/index.json no se puede leer (${cur.message}). Arréglalo o bórralo antes de seguir.`);
    const v = validateIndex(cur.value);
    if (!v.ok) throw new UsageError(`content/index.json no es válido (${v.errors[0].path || 'raíz'}: ${v.errors[0].message}). Arréglalo o bórralo antes de seguir.`);
    index = cur.value;
  }
  const merged = new Map(index.packs.map((e) => [e.pack_id, e]));
  for (const [id, e] of entries) merged.set(id, e);
  const next = { schema: INDEX_SCHEMA, packs: [...merged.values()].sort((a, b) => (a.pack_id < b.pack_id ? -1 : a.pack_id > b.pack_id ? 1 : 0)) };
  if (!had) plan.index = { action: 'create' };
  else if (!isDeepStrictEqual(index, next)) plan.index = { action: 'update' };
  if (plan.index.action !== 'unchanged') plan.writes.push({ file: indexFile, content: stable(next) });
  plan.ok = true;
  return plan;
}

function mkdirs(dir, made) {
  if (fs.existsSync(dir)) return;
  mkdirs(path.dirname(dir), made);
  fs.mkdirSync(dir);
  made.push(dir);
}

// Escribe todo con archivos temporales y renombra al final; si algo falla, deja el repo como estaba. `rename` es inyectable (pruebas).
export function applyPlan(plan, { rename = fs.renameSync } = {}) {
  const temps = [];
  const done = [];
  const before = new Map(plan.writes.map((w) => [w.file, fs.existsSync(w.file) ? fs.readFileSync(w.file) : null]));
  const madeDirs = [];
  try {
    for (const w of plan.writes) {
      const dir = path.dirname(w.file);
      mkdirs(dir, madeDirs);
      const tmp = path.join(dir, `.${path.basename(w.file)}.tmp-${process.pid}-${temps.length}`);
      fs.writeFileSync(tmp, w.content, { flag: 'wx' });
      temps.push(tmp);
    }
    plan.writes.forEach((w, i) => { rename(temps[i], w.file); done.push(w.file); });
    return { written: done };
  } catch (e) {
    for (const f of done) { const old = before.get(f); try { if (old === null) fs.rmSync(f, { force: true }); else fs.writeFileSync(f, old); } catch { /* se informa abajo */ } }
    for (const t of temps) fs.rmSync(t, { force: true });
    for (const d of madeDirs.reverse()) { try { fs.rmdirSync(d); } catch { /* no estaba vacía */ } }
    const err = new Error(`No se pudo escribir (${e && e.message}). Se deshizo todo: el repo quedó como estaba.`);
    err.code = 'WRITE_FAILED';
    throw err;
  }
}

// Plan + (si no es --dry-run) escritura. Devuelve el plan con `exitCode` y `written`.
export function addPack(opts = {}) {
  if (opts.force && !(typeof opts.reason === 'string' && opts.reason.trim())) throw new UsageError('--force exige --reason "por qué" (solo el Administrador; anótalo luego en DECISIONS.md).');
  const plan = planAddPack(opts);
  plan.exitCode = plan.ok ? 0 : 1;
  plan.dryRun = opts.dryRun === true;
  plan.written = [];
  if (plan.ok && !plan.dryRun && plan.writes.length) {
    try { plan.written = applyPlan(plan, opts.io).written; } catch (e) { plan.ok = false; plan.exitCode = 1; plan.writeError = e.message; }
  }
  return plan;
}

const LABEL = { add: 'nuevo', replace: 'reemplaza', unchanged: 'sin cambios' };
export function formatAddPack(plan, { quiet = false } = {}) {
  const out = [];
  const err = [];
  const v = formatResult(plan.validation, { quiet });
  out.push(...v.out);
  err.push(...v.err);
  if (plan.validation.exitCode !== 0) { err.push('✘ No se escribió nada: hay errores en el contenido. Corrige los problemas de arriba y vuelve a ejecutar.'); return { out, err }; }
  for (const a of plan.errors) err.push(`✘ ${a.display} — ${a.message} [${a.code}]`);
  if (plan.errors.length) { err.push('✘ No se escribió nada.'); return { out, err }; }
  if (plan.writeError) { err.push(`✘ ${plan.writeError}`); return { out, err }; }
  const dry = plan.dryRun ? ' (simulación: no se escribió nada)' : '';
  for (const a of plan.actions) {
    const extra = a.action === 'replace' ? ` (v${a.from} → v${a.version}${a.forced ? ', FORZADO' : ''}; los ítems retirados quedarán «deprecated» al importar)` : a.action === 'add' ? ` (v${a.version})` : '';
    if (!quiet || a.action !== 'unchanged') out.push(`  ${a.action === 'unchanged' ? '=' : '✔'} ${a.packId} — ${LABEL[a.action]}${extra}`);
  }
  const idx = { create: 'creado', update: 'actualizado', unchanged: 'sin cambios' }[plan.index.action];
  out.push(`content/index.json: ${idx}${dry}`);
  const changed = plan.writes.length > 0;
  if (!changed) out.push('✔ No había nada que hacer: todo ya estaba instalado tal cual.');
  else if (!plan.dryRun) {
    out.push('Siguientes pasos:', '  1. Sube el número en core/version.js (y package.json).', '  2. Ejecuta: npm run build', '  3. Sube los cambios a GitHub (guía: docs/DEPLOY.md).');
  }
  return { out, err };
}

const HELP = [
  'Uso: npm run add-pack -- [opciones] <archivo.json | carpeta> […]',
  '  Valida los paquetes y los instala en content/packs/, actualizando content/index.json. Si hay un solo error, no escribe nada.',
  '  --dry-run          valida y muestra qué haría, sin escribir',
  '  --quiet, -q        solo lo que falla y el resumen',
  '  --root <carpeta>   raíz del repo (por defecto, la de este script)',
  '  --force --reason "texto"   solo el Administrador: permite misma versión con contenido distinto o versión menor',
  '  --help, -h         esta ayuda',
  'Código de salida: 0 bien · 1 errores de contenido o de versión · 2 uso incorrecto. Guía: docs/ADD_PACK.md',
];

export function parseArgs(argv) {
  const o = { inputs: [], dryRun: false, quiet: false, force: false, reason: undefined, root: undefined, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') o.dryRun = true;
    else if (a === '--quiet' || a === '-q') o.quiet = true;
    else if (a === '--force') o.force = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--root' || a === '--reason') {
      if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new UsageError(`${a} necesita un valor.`);
      o[a === '--root' ? 'root' : 'reason'] = argv[i += 1];
    } else if (a.startsWith('-')) throw new UsageError(`Opción desconocida: ${a}`);
    else o.inputs.push(a);
  }
  return o;
}

const defaultRoot = () => path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultIo = () => ({ out: (l) => process.stdout.write(`${l}\n`), err: (l) => process.stderr.write(`${l}\n`) });

export function main(argv = process.argv.slice(2), io = defaultIo(), cwd = process.cwd()) {
  try {
    const opts = parseArgs(argv);
    if (opts.help) { HELP.forEach((l) => io.out(l)); return 0; }
    const plan = addPack({ ...opts, root: opts.root ?? defaultRoot(), cwd });
    const text = formatAddPack(plan, opts);
    text.out.forEach((l) => io.out(l));
    text.err.forEach((l) => io.err(l));
    return plan.exitCode;
  } catch (e) {
    if (e instanceof UsageError) { io.err(`✘ ${e.message}`); io.err('Ayuda: npm run add-pack -- --help'); return 2; }
    io.err(`✘ Error inesperado: ${e && e.message ? e.message : String(e)}`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = main();
