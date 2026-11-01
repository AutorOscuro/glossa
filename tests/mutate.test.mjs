// @purpose: Pruebas de tools/mutate.mjs: variantes muertas, vivas e inválidas, restauración del archivo en todos los casos, tiempo agotado y uso por línea de comandos.
// 1.7-T3: la herramienta compartida de roturas (4.R.6). Se prueba sobre un proyecto de juguete en una carpeta temporal, con pruebas reales de `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mutate, formatTable } from '../tools/mutate.mjs';

const TOOL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../tools/mutate.mjs');
const SRC = "export const add = (a, b) => a + b;\nexport const isBig = (n) => n > 10;\nexport const price = (n) => `$${n}`;\n";
const TEST = "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add, isBig, price } from './src.mjs';\n"
  + "test('suma', () => assert.equal(add(2, 3), 5));\ntest('grande', () => assert.equal(isBig(50), true));\ntest('precio', () => assert.equal(price(7), '$7'));\n";

function project(src = SRC, test = TEST) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sing-mut-'));
  fs.writeFileSync(path.join(dir, 'src.mjs'), src);
  fs.writeFileSync(path.join(dir, 'x.test.mjs'), test);
  return dir;
}
const read = (dir) => fs.readFileSync(path.join(dir, 'src.mjs'), 'utf8');
const names = (rows) => rows.map((r) => [r.name, r.status]);

test('mata, deja vivas e invalida; el archivo queda idéntico (pruebas reales)', async () => {
  const dir = project();
  const rows = await mutate({
    root: dir, file: 'src.mjs', tests: ['x.test.mjs'],
    mutants: [['suma→resta', 'a + b', 'a - b'], ['> → >=', 'n > 10', 'n >= 10'], ['no existe', 'zzz', 'y'], ['dos veces', 'n', 'm'], ['sin cambio', 'a + b', 'a + b'], ['vacío', '', 'x']],
  });
  assert.deepEqual(names(rows), [['suma→resta', 'killed'], ['> → >=', 'survived'], ['no existe', 'invalid'], ['dos veces', 'invalid'], ['sin cambio', 'invalid'], ['vacío', 'invalid']]);
  assert.equal(read(dir), SRC);
  assert.ok(rows[0].ms >= 0 && rows[2].ms === 0);
});

test('el texto nuevo se usa tal cual (los patrones de reemplazo no se interpretan)', async () => {
  const dir = project();
  const seen = [];
  const run = () => { seen.push(read(dir)); return { ok: seen.length === 1 }; };
  await mutate({ root: dir, file: 'src.mjs', tests: ['x.test.mjs'], mutants: [['dólares', '`$${n}`', '`$&$$${n}`']], run });
  assert.ok(seen[1].includes('`$&$$${n}`'));
  assert.equal(read(dir), SRC);
});

test('restaura el archivo aunque `run` lance a mitad de camino y el error se propaga', async () => {
  const dir = project();
  let calls = 0;
  const run = () => { calls += 1; if (calls === 3) throw new Error('boom'); return { ok: calls === 1 }; };
  await assert.rejects(() => mutate({ root: dir, file: 'src.mjs', tests: ['x'], mutants: [['a', 'a + b', 'a - b'], ['b', 'n > 10', 'n < 10'], ['c', 'n > 10', 'n >= 10']], run }), /boom/);
  assert.equal(read(dir), SRC);
});

test('si las pruebas no pasan con el archivo intacto, lanza y no toca nada', async () => {
  const dir = project(SRC, TEST.replace('add(2, 3), 5', 'add(2, 3), 6'));
  await assert.rejects(() => mutate({ root: dir, file: 'src.mjs', tests: ['x.test.mjs'], mutants: [['m', 'a + b', 'a - b']] }), /no pasan con el archivo intacto/);
  assert.equal(read(dir), SRC);
});

test('tiempo agotado cuenta como muerta y queda marcada', async () => {
  const dir = project();
  let calls = 0;
  const run = () => { calls += 1; return calls === 1 ? { ok: true } : { ok: false, timedOut: true }; };
  const rows = await mutate({ root: dir, file: 'src.mjs', tests: ['x'], mutants: [['bucle', 'a + b', 'a - b']], run });
  assert.deepEqual([rows[0].status, rows[0].timedOut], ['killed', true]);
  assert.match(formatTable(rows), /\(tiempo agotado\)/);
});

test('sin variantes solo comprueba la base; con `run` asíncrono también funciona', async () => {
  const dir = project();
  assert.deepEqual(await mutate({ root: dir, file: 'src.mjs', tests: ['x'], mutants: [], run: async () => ({ ok: true }) }), []);
});

test('no deja escuchas colgadas tras terminar (ni con error)', async () => {
  const dir = project();
  const before = ['exit', 'SIGINT', 'SIGTERM'].map((e) => process.listenerCount(e));
  await mutate({ root: dir, file: 'src.mjs', tests: ['x'], mutants: [['a', 'a + b', 'a - b']], run: () => ({ ok: false }) }).catch(() => {});
  await mutate({ root: dir, file: 'src.mjs', tests: ['x'], mutants: [['a', 'a + b', 'a - b']], run: () => ({ ok: true }) });
  assert.deepEqual(['exit', 'SIGINT', 'SIGTERM'].map((e) => process.listenerCount(e)), before);
});

test('entradas inválidas', async () => {
  const dir = project();
  const ok = { root: dir, file: 'src.mjs', tests: ['x'], mutants: [['a', 'a + b', 'a - b']], run: () => ({ ok: true }) };
  await assert.rejects(() => mutate({ ...ok, file: '' }), /`file`/);
  await assert.rejects(() => mutate({ ...ok, file: undefined }), /`file`/);
  await assert.rejects(() => mutate({ ...ok, tests: [] }), /`tests`/);
  await assert.rejects(() => mutate({ ...ok, tests: [3] }), /`tests`/);
  await assert.rejects(() => mutate({ ...ok, mutants: 'x' }), /variante/);
  await assert.rejects(() => mutate({ ...ok, mutants: [['solo', 'dos']] }), /variante/);
  await assert.rejects(() => mutate({ ...ok, mutants: [['', 'a', 'b']] }), /variante/);
  await assert.rejects(() => mutate({ ...ok, mutants: [['n', 1, 2]] }), /variante/);
  await assert.rejects(() => mutate({ ...ok, file: '../fuera.mjs' }), /dentro de la raíz/);
  await assert.rejects(() => mutate({ ...ok, file: 'no-existe.mjs' }), /ENOENT/);
  await assert.rejects(() => mutate(), /`file`/);
});

test('tiempo agotado real: una variante que se cuelga muere y el archivo se restaura', async () => {
  const dir = project();
  const rows = await mutate({ root: dir, file: 'src.mjs', tests: ['x.test.mjs'], timeoutMs: 2500, mutants: [['bucle infinito', 'n > 10', '(() => { for (;;); })()']] });
  assert.deepEqual([rows[0].status, rows[0].timedOut], ['killed', true]);
  assert.equal(read(dir), SRC);
});

// Una ejecución completa de la suite dejaba un `node x.test.mjs` al 90 % de CPU por cada vez que corría esta prueba (el padre moría, el hijo no).
const alive = (pid) => {
  try { process.kill(pid, 0); } catch { return false; }
  try { return fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1][0] !== 'Z'; } catch { return true; } // zombi = ya muerto
};

test('tiempo agotado: no deja ningún proceso huérfano (el hijo que corre las pruebas muere con el grupo)', async () => {
  const dir = project();
  const spin = "(() => { process.getBuiltinModule('node:fs').writeFileSync(new URL('./pid.txt', import.meta.url), String(process.pid)); for (;;); })()";
  const rows = await mutate({ root: dir, file: 'src.mjs', tests: ['x.test.mjs'], timeoutMs: 2500, mutants: [['bucle infinito', 'n > 10', spin]] });
  assert.equal(rows[0].timedOut, true);
  const pid = Number(fs.readFileSync(path.join(dir, 'pid.txt'), 'utf8'));
  assert.ok(pid > 0 && pid !== process.pid, 'el bucle escribió su pid');
  const until = Date.now() + 3000;
  while (alive(pid) && Date.now() < until) await new Promise((r) => setTimeout(r, 50));
  if (alive(pid)) process.kill(pid, 'SIGKILL'); // que un fallo no deje la CPU saturada
  assert.equal(alive(pid), false, `el proceso ${pid} sigue vivo después del tiempo agotado`);
});

test('deja un respaldo en una carpeta temporal mientras corre y lo borra al terminar', async () => {
  const dir = project();
  const tmp = () => new Set(fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith('mutate-')));
  const before = tmp();
  let backup = null;
  const run = () => {
    const mine = [...tmp()].filter((f) => !before.has(f));
    if (mine.length === 1) backup = fs.readFileSync(path.join(os.tmpdir(), mine[0], 'src.mjs'), 'utf8');
    return { ok: true };
  };
  await mutate({ root: dir, file: 'src.mjs', tests: ['x'], mutants: [], run });
  assert.equal(backup, SRC);
  assert.deepEqual([...tmp()].filter((f) => !before.has(f)), []);
});

test('si el proceso termina a mitad de una variante, el archivo se restaura al salir', () => {
  const dir = project();
  const code = `import { mutate } from ${JSON.stringify(new URL('../tools/mutate.mjs', import.meta.url).href)};\n`
    + `let n = 0;\nawait mutate({ root: ${JSON.stringify(dir)}, file: 'src.mjs', tests: ['x'], mutants: [['m', 'a + b', 'a - b']], run: () => { n += 1; if (n === 2) process.exit(3); return { ok: true }; } });\n`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
  assert.equal(r.status, 3);
  assert.equal(read(dir), SRC);
});

test('si no se puede restaurar, lo dice y señala el respaldo', async () => {
  const dir = project();
  const target = path.join(dir, 'src.mjs');
  const real = fs.writeFileSync;
  let mutated = false;
  fs.writeFileSync = (file, data, ...rest) => {
    if (file === target && mutated) return undefined; // simula un disco que ignora la restauración
    if (file === target) mutated = true;
    return real(file, data, ...rest);
  };
  try {
    await assert.rejects(() => mutate({ root: dir, file: 'src.mjs', tests: ['x'], mutants: [['m', 'a + b', 'a - b']], run: () => ({ ok: true }) }), /no se pudo restaurar src\.mjs; el respaldo está en /);
  } finally {
    fs.writeFileSync = real;
  }
  real(target, SRC);
});

test('formatTable: filas y resumen (las inválidas no cuentan en el porcentaje)', () => {
  const out = formatTable([{ name: 'uno', status: 'killed', ms: 12 }, { name: 'dos', status: 'survived', ms: 5 }, { name: 'tres', status: 'killed', ms: 7 }, { name: 'cuatro', status: 'invalid', ms: 0 }]);
  assert.match(out, /^ {2}1 {2}killed {4}\s+12 ms {2}uno$/m);
  assert.match(out, /survived/);
  assert.match(out, /Total 4 · muertas 2 \(67 %\) · vivas 1 · inválidas 1\n$/);
  assert.match(formatTable([]), /^Total 0 · muertas 0 \(0 %\) · vivas 0 · inválidas 0\n$/);
});

function cli(dir, spec, extra = []) {
  const file = path.join(dir, 'spec.json');
  fs.writeFileSync(file, JSON.stringify(spec));
  return spawnSync(process.execPath, [TOOL, file, '--root', dir, ...extra], { encoding: 'utf8' });
}

test('línea de comandos: 0 si todas mueren, 1 si alguna sobrevive, 2 si hay inválidas; siempre restaura', () => {
  const dir = project();
  const base = { file: 'src.mjs', tests: ['x.test.mjs'] };
  let r = cli(dir, { ...base, mutants: [['suma', 'a + b', 'a - b']] });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /killed/);
  r = cli(dir, { ...base, mutants: [['suma', 'a + b', 'a - b'], ['borde', 'n > 10', 'n >= 10']] });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Total 2 · muertas 1 \(50 %\) · vivas 1/);
  r = cli(dir, { ...base, mutants: [['nada', 'zzz', 'y']] });
  assert.equal(r.status, 2);
  assert.equal(read(dir), SRC);
});

test('línea de comandos: sin --root usa la carpeta actual y --root puede ir antes de la especificación', () => {
  const dir = project();
  const file = path.join(dir, 'spec.json');
  fs.writeFileSync(file, JSON.stringify({ file: 'src.mjs', tests: ['x.test.mjs'], mutants: [['suma', 'a + b', 'a - b']] }));
  assert.equal(spawnSync(process.execPath, [TOOL, file], { cwd: dir, encoding: 'utf8' }).status, 0);
  assert.equal(spawnSync(process.execPath, [TOOL, '--root', dir, file], { encoding: 'utf8' }).status, 0);
  const noRoot = spawnSync(process.execPath, [TOOL, file, '--root'], { encoding: 'utf8' });
  assert.equal(noRoot.status, 2);
  assert.match(noRoot.stderr, /Uso:/);
  assert.equal(read(dir), SRC);
});

test('línea de comandos: spec .mjs, falta de argumentos y errores salen con 2 y mensaje', () => {
  const dir = project();
  fs.writeFileSync(path.join(dir, 'spec.mjs'), "export default { file: 'src.mjs', tests: ['x.test.mjs'], mutants: [['suma', 'a + b', 'a - b']] };\n");
  assert.equal(spawnSync(process.execPath, [TOOL, path.join(dir, 'spec.mjs'), '--root', dir], { encoding: 'utf8' }).status, 0);
  const none = spawnSync(process.execPath, [TOOL], { encoding: 'utf8' });
  assert.equal(none.status, 2);
  assert.match(none.stderr, /Uso:/);
  const bad = cli(dir, { file: 'src.mjs', tests: [], mutants: [] });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /`tests`/);
  assert.equal(read(dir), SRC);
});
