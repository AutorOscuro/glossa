// @purpose: Roturas intencionales (4.R.6): cambia un archivo de uno en uno, corre solo las pruebas indicadas, lo restaura siempre e imprime una tabla.
// Uso:  node tools/mutate.mjs <spec.json|spec.mjs> [--root <carpeta>]      (sale con 0 si todas mueren, 1 si alguna sobrevive, 2 si hay inválidas o un error)
//   spec = { file, tests: ['tests/x.test.mjs'], mutants: [[nombre, texto original, texto nuevo], …], timeoutMs? }   (.mjs: `export default spec`)
// Como módulo:  import { mutate, formatTable } from './mutate.mjs'
//   mutate({ root, file, tests, mutants, timeoutMs, run }) → Promise<[{ name, status, ms, timedOut? }]>
//     status: killed (alguna prueba falla o se agota el tiempo) · survived (todas pasan: razónala o escribe una prueba) · invalid (el texto original no aparece EXACTAMENTE una vez, o no cambia nada)
//     run(root, tests, timeoutMs) → { ok, timedOut? }: por defecto `node --test <tests>` en `root`. La base debe pasar antes de romper (si no, lanza).
// Respaldo: el original se copia a una carpeta temporal y se restaura en `finally`, al salir y ante SIGINT/SIGTERM; al terminar se comprueba byte a byte.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DEFAULT_TIMEOUT_MS = 120000;

// `node --test` lanza un proceso por archivo de prueba: matar solo al padre dejaba al hijo (p. ej. un bucle infinito) gastando CPU para siempre.
// Por eso el hijo corre en su propio grupo de procesos (detached) y al agotarse el tiempo, o al salir nosotros, se mata el grupo entero.
const live = new Set();
function killGroup(child) {
  try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* ya terminó */ } }
}
const killAll = () => { for (const c of live) killGroup(c); live.clear(); };

function defaultRun(root, tests, timeoutMs) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT; // si nos lanza `node --test`, el hijo debe correr como una ejecución normal
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--test', ...tests], { cwd: root, env, stdio: 'ignore', detached: process.platform !== 'win32' });
    live.add(child);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; killGroup(child); }, timeoutMs);
    const done = (ok) => { clearTimeout(timer); live.delete(child); resolve({ ok: ok && !timedOut, timedOut }); };
    child.on('error', () => done(false));
    child.on('close', (code) => done(code === 0));
  });
}

function check({ file, tests, mutants }) {
  if (typeof file !== 'string' || file === '') throw new Error('mutate: `file` debe ser un texto no vacío');
  if (!Array.isArray(tests) || tests.length === 0 || !tests.every((t) => typeof t === 'string' && t !== '')) throw new Error('mutate: `tests` debe ser una lista no vacía de rutas');
  if (!Array.isArray(mutants) || !mutants.every((m) => Array.isArray(m) && m.length === 3 && typeof m[0] === 'string' && m[0] !== '' && typeof m[1] === 'string' && typeof m[2] === 'string')) {
    throw new Error('mutate: cada variante debe ser [nombre, texto original, texto nuevo]');
  }
}

export async function mutate({ root = process.cwd(), file, tests, mutants, timeoutMs = DEFAULT_TIMEOUT_MS, run = defaultRun } = {}) {
  check({ file, tests, mutants });
  const base = path.resolve(root);
  const target = path.resolve(base, file);
  if (!target.startsWith(base + path.sep)) throw new Error('mutate: `file` debe estar dentro de la raíz');
  const original = fs.readFileSync(target, 'utf8');
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mutate-'));
  fs.writeFileSync(path.join(backupDir, path.basename(target)), original);
  const restore = () => fs.writeFileSync(target, original);
  const onSignal = () => { killAll(); restore(); process.exit(130); };
  process.on('exit', killAll);
  process.on('exit', restore);
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  const rows = [];
  try {
    if (!(await run(base, tests, timeoutMs)).ok) throw new Error('mutate: las pruebas no pasan con el archivo intacto; arréglalas antes de romper nada');
    for (const [name, from, to] of mutants) {
      const times = from === '' ? 0 : original.split(from).length - 1;
      if (times !== 1 || from === to) { rows.push({ name, status: 'invalid', ms: 0 }); continue; }
      const t0 = Date.now();
      try {
        fs.writeFileSync(target, original.replace(from, () => to));
        const r = await run(base, tests, timeoutMs);
        rows.push({ name, status: r.ok ? 'survived' : 'killed', ms: Date.now() - t0, ...(r.timedOut ? { timedOut: true } : {}) });
      } finally { restore(); }
    }
  } finally {
    restore();
    process.removeListener('exit', killAll);
    process.removeListener('exit', restore);
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    if (fs.readFileSync(target, 'utf8') !== original) throw new Error(`mutate: no se pudo restaurar ${file}; el respaldo está en ${backupDir}`);
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
  return rows;
}

export function formatTable(rows) {
  const count = (s) => rows.filter((r) => r.status === s).length;
  const killed = count('killed');
  const valid = killed + count('survived');
  const lines = rows.map((r, i) => `${String(i + 1).padStart(3)}  ${r.status.padEnd(8)}  ${String(r.ms).padStart(6)} ms  ${r.name}${r.timedOut ? ' (tiempo agotado)' : ''}`);
  const pct = valid === 0 ? 0 : Math.round((100 * killed) / valid);
  lines.push(`Total ${rows.length} · muertas ${killed} (${pct} %) · vivas ${count('survived')} · inválidas ${count('invalid')}`);
  return `${lines.join('\n')}\n`;
}

async function main(argv) {
  const rootAt = argv.indexOf('--root');
  const root = rootAt === -1 ? process.cwd() : argv[rootAt + 1];
  const specPath = argv.find((a, i) => !a.startsWith('--') && (rootAt === -1 || i !== rootAt + 1));
  if (!specPath || (rootAt !== -1 && !root)) throw new Error('Uso: node tools/mutate.mjs <spec.json|spec.mjs> [--root <carpeta>]');
  const abs = path.resolve(specPath);
  const spec = abs.endsWith('.json') ? JSON.parse(fs.readFileSync(abs, 'utf8')) : (await import(pathToFileURL(abs).href)).default;
  const rows = await mutate({ root, ...spec });
  process.stdout.write(formatTable(rows));
  return rows.some((r) => r.status === 'invalid') ? 2 : rows.some((r) => r.status === 'survived') ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { process.stderr.write(`${e.message}\n`); process.exit(2); });
}
