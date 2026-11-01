// @purpose: Validador de contenido por línea de comandos: revisa la taxonomía y los paquetes (npm run validate-content).
// Validador de contenido por línea de comandos (subparte 1.3, cuarto 3, mitad 3B). Roadmap 1.3 y 8.10.
// Uso:  node tools/validate-content.mjs [opciones] [ruta …]
//   Sin rutas: valida la taxonomía y todos los paquetes instalados (content/packs/).
//   Con rutas: valida la taxonomía y esos paquetes (archivos .json o carpetas; en una carpeta se ignora lo que no parece un paquete y se avisa).
//   --root <carpeta>   raíz del repo (por defecto, la de este script)      --quiet, -q   solo lo que falla y el resumen
//   --all              no recorta la lista de problemas por archivo        --help, -h    esta ayuda
// Código de salida: 0 todo en orden (los avisos no cuentan) · 1 hay errores de contenido · 2 uso incorrecto (ruta que no existe, opción desconocida).
// Como módulo (lo reutiliza `add-pack`, cuarto 4):  validateContent({ root, inputs, cwd }) → resultado   ·   formatResult(resultado, opciones) → líneas
// Solo LEE: nunca escribe en el disco. Toda la validación es de core/ (la misma para el cargador y para `add-pack`).
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import { validatePack } from '../core/contentPack.js';
import { summarizePack } from '../core/contentInstalled.js';
import { formatProblem } from '../core/contentRules.js';
import { UsageError, PACKS_DIR, collectCandidates, loadPackFiles, loadTaxonomy, loadInstalled, contextFor, fileReport, relativePosix } from './contentFs.mjs';

export { UsageError };
const MAX_SHOWN_ERRORS = 30;
const MAX_SHOWN_WARNINGS = 10;

const count = (v) => (Array.isArray(v) ? v.length : 0);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Nombre corto para mostrar: el del archivo; si dos del lote se llaman igual, la ruta relativa a `cwd`.
function displayNames(files, cwd) {
  const base = new Map();
  for (const f of files) base.set(path.basename(f), (base.get(path.basename(f)) || 0) + 1);
  return new Map(files.map((f) => [f, base.get(path.basename(f)) > 1 ? relativePosix(cwd, f) : path.basename(f)]));
}

// Suma un problema a un informe ya hecho (los de archivo y de lote que `validatePack` no conoce).
function addProblem(report, kind, problem) {
  const list = kind === 'error' ? report.errors : report.warnings;
  list.push(problem);
  if (kind === 'error') { report.errorTotal += 1; report.ok = false; } else report.warningTotal += 1;
}

export function validateContent({ root, inputs = [], cwd = process.cwd() } = {}) {
  if (typeof root !== 'string' || root === '') throw new UsageError('Falta la carpeta raíz del repo.');
  const rootFull = path.resolve(cwd, root);
  let isDir = false;
  try { isDir = fs.statSync(rootFull).isDirectory(); } catch { isDir = false; }
  if (!isDir) throw new UsageError(`La carpeta raíz no existe: ${root}`);

  const installedMode = inputs.length === 0; // sin rutas: se validan los instalados
  const packsDir = path.join(rootFull, PACKS_DIR);
  const found = collectCandidates(installedMode ? (fs.existsSync(packsDir) ? [packsDir] : []) : inputs, cwd);
  if (!installedMode && found.candidates.length === 0) throw new UsageError('No encontré ningún archivo .json en las rutas indicadas.');

  const taxonomy = loadTaxonomy(rootFull);
  const result = {
    root: rootFull, installedMode, taxonomy: taxonomy.files.map((f) => ({ file: f.file, display: f.file, ...f.report, summary: f.summary })),
    stoppedByTaxonomy: !taxonomy.ok, installedProblems: [], files: [], skipped: [], errorTotal: 0, warningTotal: 0, exitCode: 0,
  };
  const tally = (r) => { result.errorTotal += r.errorTotal; result.warningTotal += r.warningTotal; };
  result.taxonomy.forEach(tally);
  if (!taxonomy.ok) { result.exitCode = 1; return result; }

  const loaded = loadPackFiles(found.candidates);
  result.skipped = [...found.skipped, ...loaded.skipped].map((s) => ({ file: s.file, display: path.basename(s.file), reason: s.reason }));
  const names = displayNames(loaded.entries.map((e) => e.file), cwd);

  if (!installedMode && loaded.entries.length === 0) throw new UsageError(`No encontré ningún paquete en las rutas indicadas (se omitieron ${loaded.skipped.length + found.skipped.length} archivo(s) que no lo parecen).`);
  const batchFiles = new Set(loaded.entries.map((e) => e.file));
  const installed = installedMode ? { entries: [], problems: [] } : loadInstalled(rootFull, batchFiles);
  for (const p of installed.problems) {
    const rep = fileReport(p.rule, p.message);
    result.installedProblems.push({ file: p.file, display: relativePosix(rootFull, p.file), ...rep });
    tally(rep);
  }

  const summaries = loaded.entries.map((e) => (e.value === undefined ? null : summarizePack(e.value)));
  const installedSummaries = installed.entries.map((e) => e.summary);
  const firstOfId = new Map();
  loaded.entries.forEach((e, i) => {
    const display = names.get(e.file);
    const entry = { file: e.file, display, packId: null, version: null, counts: { items: 0, lexicon: 0, stories: 0 }, pack: null };
    if (e.value === undefined) {
      Object.assign(entry, fileReport(e.problem.rule, e.problem.message));
    } else {
      const v = e.value;
      const packId = summaries[i] ? summaries[i].pack_id : null;
      Object.assign(entry, {
        pack: v, packId, version: v && Number.isInteger(v.version) ? v.version : null,
        counts: { items: count(v && v.items), lexicon: count(v && v.lexicon), stories: count(v && v.stories) },
      }, validatePack(v, contextFor(taxonomy.ctx, installedSummaries, summaries, i)));
      if (typeof packId === 'string') {
        if (firstOfId.has(packId)) addProblem(entry, 'error', { path: 'pack_id', rule: 'DUPLICATE_PACK_ID', message: `el pack_id ${packId} ya lo usa ${firstOfId.get(packId)} en este mismo lote` });
        else firstOfId.set(packId, display);
        const expected = `${packId}.json`;
        if (path.basename(e.file) !== expected && /^[a-z][a-z0-9_]{2,59}$/.test(packId)) {
          const inside = path.dirname(e.file) === packsDir;
          addProblem(entry, inside ? 'error' : 'warning', {
            path: 'pack_id', rule: 'FILE_NAME',
            message: inside ? `el archivo debe llamarse ${expected} para que la app lo encuentre` : `el archivo se llama ${path.basename(e.file)}; add-pack lo guardará como ${expected}`,
          });
        }
      }
    }
    tally(entry);
    result.files.push(entry);
  });
  result.exitCode = result.errorTotal > 0 ? 1 : 0;
  return result;
}

// ---------- presentación ----------
function problemLines(display, report, o) {
  const lines = [];
  const show = (list, total, max, label) => {
    const cap = o.all ? list.length : Math.min(list.length, max);
    for (const p of list.slice(0, cap)) lines.push(`    ${label} ${formatProblem(p, display)} [${p.rule}]`);
    if (total > cap) lines.push(`    … y ${total - cap} ${label === '✘' ? 'error(es)' : 'aviso(s)'} más (usa --all para verlos todos)`);
  };
  show(report.errors, report.errorTotal, MAX_SHOWN_ERRORS, '✘');
  if (!o.quiet) show(report.warnings, report.warningTotal, MAX_SHOWN_WARNINGS, '⚠');
  return lines;
}

function statusLine(mark, display, text) { return `  ${mark} ${display} — ${text}`; }

export function formatResult(result, options = {}) {
  const o = { quiet: options.quiet === true, all: options.all === true };
  const out = [];
  const err = [];
  const section = (title) => { if (!o.quiet) out.push(title); };

  section('Taxonomía');
  for (const f of result.taxonomy) {
    if (f.ok) { if (!o.quiet) out.push(statusLine('✔', f.display, `${f.summary}${f.warningTotal ? `, ${plural(f.warningTotal, 'aviso', 'avisos')}` : ''}`)); } else out.push(statusLine('✘', f.display, plural(f.errorTotal, 'error', 'errores')));
    out.push(...problemLines(f.display, f, o));
  }
  if (result.stoppedByTaxonomy) {
    err.push('✘ La taxonomía tiene errores, así que no se validaron los paquetes. Corrígela primero (los paquetes se comprueban contra ella).');
    return { out, err };
  }

  for (const p of result.installedProblems) { out.push(statusLine('✘', p.display, 'paquete instalado ilegible')); out.push(...problemLines(p.display, p, o)); }

  if (result.files.length === 0) {
    section(result.installedMode ? 'Paquetes instalados' : 'Paquetes');
    if (!o.quiet) out.push(result.installedMode ? '  (no hay paquetes instalados todavía en content/packs/)' : '  (ninguno)');
  } else {
    section(result.installedMode ? 'Paquetes instalados' : 'Paquetes');
    for (const f of result.files) {
      const what = [plural(f.counts.items, 'ítem', 'ítems'), plural(f.counts.lexicon, 'palabra', 'palabras'), plural(f.counts.stories, 'historia', 'historias')].join(', ');
      if (f.ok) { if (!o.quiet) out.push(statusLine('✔', f.display, `válido (${what}${f.warningTotal ? `; ${plural(f.warningTotal, 'aviso', 'avisos')}` : ''})`)); } else out.push(statusLine('✘', f.display, `${plural(f.errorTotal, 'error', 'errores')}${f.warningTotal && !o.quiet ? ` y ${plural(f.warningTotal, 'aviso', 'avisos')}` : ''}`));
      out.push(...problemLines(f.display, f, o));
    }
  }
  if (!o.quiet) for (const s of result.skipped) out.push(`  – omitido ${s.display}: ${s.reason}`);

  const bad = result.files.filter((f) => !f.ok).length + result.installedProblems.length;
  if (result.exitCode === 0) {
    const n = result.files.length;
    const packs = result.installedMode ? plural(n, 'paquete instalado', 'paquetes instalados') : plural(n, 'paquete validado', 'paquetes validados');
    out.push(`✔ Todo en orden: ${packs}, ${plural(result.warningTotal, 'aviso', 'avisos')}.`);
  } else {
    err.push(`✘ ${plural(result.errorTotal, 'error', 'errores')} en ${plural(bad + result.taxonomy.filter((f) => !f.ok).length, 'archivo', 'archivos')}. Corrígelos y vuelve a ejecutar el comando.`);
  }
  return { out, err };
}

const HELP = [
  'Uso: node tools/validate-content.mjs [opciones] [ruta …]',
  '  Sin rutas valida la taxonomía y los paquetes instalados (content/packs/).',
  '  Con rutas valida la taxonomía y esos paquetes (archivos .json o carpetas).',
  'Opciones:',
  '  --root <carpeta>   raíz del repo (por defecto, la de este script)',
  '  --quiet, -q        solo lo que falla y el resumen',
  '  --all              muestra todos los problemas (por defecto se recortan por archivo)',
  '  --help, -h         esta ayuda',
  'Código de salida: 0 todo en orden · 1 hay errores de contenido · 2 uso incorrecto.',
];

export function parseArgs(argv) {
  const opts = { help: false, quiet: false, all: false, root: null, inputs: [] };
  const args = Array.isArray(argv) ? argv : [];
  let rest = false;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (rest || !a.startsWith('-') || a === '-') { opts.inputs.push(a); continue; }
    if (a === '--') rest = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--quiet' || a === '-q') opts.quiet = true;
    else if (a === '--all') opts.all = true;
    else if (a === '--root' || a.startsWith('--root=')) {
      const v = a === '--root' ? args[(i += 1)] : a.slice('--root='.length);
      if (typeof v !== 'string' || v === '') throw new UsageError('La opción --root necesita una carpeta.');
      opts.root = v;
    } else throw new UsageError(`Opción desconocida: ${a}`);
  }
  return opts;
}

const defaultRoot = () => path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultIo = () => ({ out: (s) => process.stdout.write(`${s}\n`), err: (s) => process.stderr.write(`${s}\n`) });

// Si quien lee la salida la cierra antes de tiempo (`| head`, `less`), no es un fallo del validador: se sale con el código que ya se calculó.
let pendingExit = 0;
function quietOnClosedPipe() {
  for (const stream of [process.stdout, process.stderr]) {
    stream.on('error', (e) => { if (e && e.code === 'EPIPE') process.exit(pendingExit); throw e; });
  }
}

export function main(argv = process.argv.slice(2), io = defaultIo(), cwd = process.cwd()) {
  try {
    const opts = parseArgs(argv);
    if (opts.help) { HELP.forEach((l) => io.out(l)); return 0; }
    const result = validateContent({ root: opts.root ?? defaultRoot(), inputs: opts.inputs, cwd });
    const text = formatResult(result, opts);
    pendingExit = result.exitCode;
    text.out.forEach((l) => io.out(l));
    text.err.forEach((l) => io.err(l));
    return result.exitCode;
  } catch (e) {
    if (e instanceof UsageError) { io.err(`✘ ${e.message}`); io.err('Ayuda: node tools/validate-content.mjs --help'); return 2; }
    io.err(`✘ Error inesperado del validador: ${e && e.message ? e.message : String(e)}`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  quietOnClosedPipe();
  process.exitCode = main();
}
