// @purpose: Pruebas de tools/validate-content.mjs y tools/contentFs.mjs: lectura de archivos, taxonomía, paquetes instalados, lotes y salida.
// Pruebas de tools/validate-content.mjs y tools/contentFs.mjs (subparte 1.3, cuarto 3, mitad 3B): lectura de archivos, taxonomía,
// paquetes instalados, lotes, opciones, salida, seguridad y rendimiento (CA-5: 2.000 ítems < 1 s).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { validateContent, formatResult, parseArgs, main, UsageError } from '../tools/validate-content.mjs';
import { readJsonFile, lineColumn, collectCandidates, MAX_FILE_BYTES } from '../tools/contentFs.mjs';
import { makeRepo, loadSample, loadTaxonomyFixtures, bigPack, treeHash, REPO } from './_samplePack.mjs';

const CLI = path.join(REPO, 'tools', 'validate-content.mjs');
const A = 'gram.present_perfect.for_since';
const withRepo = (fn) => { const repo = makeRepo(); try { return fn(repo); } finally { repo.cleanup(); } };
const rules = (f) => f.errors.map((e) => `${e.path}:${e.rule}`);
const capture = () => { const out = []; const err = []; return { out, err, io: { out: (s) => out.push(s), err: (s) => err.push(s) } }; };

// ---------- caso feliz y rendimiento ----------
test('CA-1: el paquete de muestra pasa limpio y se cuentan sus ítems, palabras e historias', () => withRepo((repo) => {
  const file = repo.write('inbox/sample_pack_v1.json', loadSample());
  const res = validateContent({ root: repo.root, inputs: [file] });
  assert.deepEqual([res.exitCode, res.errorTotal, res.warningTotal, res.stoppedByTaxonomy], [0, 0, 0, false]);
  assert.deepEqual(res.files[0].counts, { items: 21, lexicon: 1, stories: 1 });
  assert.equal(res.files[0].packId, 'sample_pack_v1');
  assert.deepEqual(res.taxonomy.map((t) => t.summary), ['9 códigos', '3 temas']);
}));

test('CA-5: validar un paquete de 2.000 ítems (leer, analizar y validar) tarda menos de 1 s', (t) => withRepo((repo) => {
  const file = repo.write('inbox/big_pack_v1.json', bigPack(2000));
  validateContent({ root: repo.root, inputs: [file] }); // calentamiento
  const t0 = performance.now();
  const res = validateContent({ root: repo.root, inputs: [file] });
  const ms = performance.now() - t0;
  t.diagnostic(`2.000 ítems: ${ms.toFixed(0)} ms`);
  assert.equal(res.exitCode, 0, JSON.stringify(res.files[0].errors.slice(0, 3)));
  assert.equal(res.files[0].counts.items, 2000);
  assert.ok(ms < 1000, `tardó ${ms.toFixed(0)} ms`);
}));

test('el tope de 5.000 ítems se rechaza sin recorrer el resto, y rápido', () => withRepo((repo) => {
  const file = repo.write('inbox/big_pack_v1.json', bigPack(5001));
  const t0 = performance.now();
  const res = validateContent({ root: repo.root, inputs: [file] });
  assert.ok(rules(res.files[0]).includes('items:LIST_SIZE'));
  assert.ok(performance.now() - t0 < 4000);
}));

// ---------- taxonomía ----------
test('taxonomía con ciclo de prerrequisitos: exit 1, no se validan paquetes y se dice por qué', () => withRepo((repo) => {
  const tax = loadTaxonomyFixtures().topics;
  tax.topics[0].prereq = [A]; // form → for_since → form
  repo.write('content/taxonomy/topics.json', tax);
  const file = repo.write('inbox/sample_pack_v1.json', loadSample());
  const res = validateContent({ root: repo.root, inputs: [file] });
  assert.equal(res.exitCode, 1);
  assert.equal(res.stoppedByTaxonomy, true);
  assert.equal(res.files.length, 0);
  assert.ok(res.taxonomy[1].errors.some((e) => e.rule === 'PREREQ_CYCLE'));
  const text = formatResult(res);
  assert.match(text.err.join('\n'), /no se validaron los paquetes/);
}));

test('taxonomía: archivo ausente, JSON roto o código duplicado → error con ruta, exit 1', () => withRepo((repo) => {
  const file = repo.write('inbox/sample_pack_v1.json', loadSample());
  fs.rmSync(path.join(repo.root, 'content/taxonomy/error_codes.json'));
  let res = validateContent({ root: repo.root, inputs: [file] });
  assert.deepEqual([res.exitCode, res.taxonomy[0].errors[0].rule], [1, 'FILE_MISSING']);
  repo.write('content/taxonomy/error_codes.json', '{ "schema": 1, "codes": [ ');
  res = validateContent({ root: repo.root, inputs: [file] });
  assert.equal(res.taxonomy[0].errors[0].rule, 'JSON_INVALID');
  const dup = loadTaxonomyFixtures().errorCodes;
  dup.codes.push(dup.codes[0]);
  repo.write('content/taxonomy/error_codes.json', dup);
  res = validateContent({ root: repo.root, inputs: [file] });
  assert.deepEqual(res.taxonomy[0].errors.map((e) => `${e.path}:${e.rule}`), ['codes[9].id:DUPLICATE']);
}));

// ---------- lectura de archivos ----------
test('JSON roto: error con línea y columna; vacío; BOM aceptado; demasiado grande', () => withRepo((repo) => {
  const bad = repo.write('inbox/a.json', '{\n  "schema": 1,\n  "pack_id": \n}');
  const r = readJsonFile(bad);
  assert.equal(r.rule, 'JSON_INVALID');
  assert.match(r.message, /línea \d+/);
  assert.match(readJsonFile(repo.write('inbox/f.json', '{\n  "a": [1,\n')).message, /línea \d+/); // termina antes de tiempo
  assert.equal(readJsonFile(repo.write('inbox/b.json', '')).rule, 'FILE_EMPTY');
  assert.equal(readJsonFile(repo.write('inbox/c.json', '   \n ')).rule, 'FILE_EMPTY');
  assert.deepEqual(readJsonFile(repo.write('inbox/d.json', '\uFEFF{"a":1}')), { ok: true, value: { a: 1 } });
  const big = path.join(repo.root, 'inbox/e.json');
  fs.writeFileSync(big, '');
  fs.truncateSync(big, MAX_FILE_BYTES + 1);
  assert.equal(readJsonFile(big).rule, 'FILE_TOO_BIG');
  assert.equal(readJsonFile(path.join(repo.root, 'nada.json')).rule, 'FILE_MISSING');
  assert.equal(readJsonFile(repo.inbox).rule, 'FILE_NOT_REGULAR');
  assert.deepEqual(lineColumn('ab\ncd', 4), { line: 2, column: 2 });
  assert.deepEqual(lineColumn('x', 99), { line: 1, column: 2 });
}));

test('un archivo que no se puede leer sale como error del archivo, no tumba el lote', () => withRepo((repo) => {
  const ok = repo.write('inbox/sample_pack_v1.json', loadSample());
  const bad = repo.write('inbox/roto_v1.json', '{ no es json');
  const res = validateContent({ root: repo.root, inputs: [ok, bad] });
  assert.equal(res.exitCode, 1);
  assert.equal(res.files.length, 2);
  assert.equal(res.files.find((f) => f.display === 'roto_v1.json').errors[0].rule, 'JSON_INVALID');
  assert.equal(res.files.find((f) => f.display === 'sample_pack_v1.json').ok, true);
}));

test('JSON que no es un objeto, o con __proto__ y anidación enorme, se rechaza sin romper nada', () => withRepo((repo) => {
  for (const [name, text] of [['arr', '[1,2]'], ['num', '3'], ['str', '"x"'], ['nul', 'null']]) {
    const res = validateContent({ root: repo.root, inputs: [repo.write(`inbox/${name}.json`, text)] });
    assert.deepEqual([res.exitCode, rules(res.files[0])[0]], [1, ':TYPE'], name);
  }
  const proto = JSON.parse(JSON.stringify(loadSample()).replace('"schema":1', '"schema":1,"__proto__":{"polluted":true}'));
  const res = validateContent({ root: repo.root, inputs: [repo.write('inbox/sample_pack_v1.json', `${JSON.stringify(loadSample()).replace('{"schema":1', '{"schema":1,"__proto__":{"polluted":true}')}`)] });
  assert.ok(rules(res.files[0]).includes('__proto__:UNKNOWN_FIELD'));
  assert.equal({}.polluted, undefined);
  assert.equal(proto.schema, 1);
  const deep = `{"schema":1,"tags":${'['.repeat(20000)}${']'.repeat(20000)}}`;
  const r2 = validateContent({ root: repo.root, inputs: [repo.write('inbox/deep_v1.json', deep)] });
  assert.equal(r2.exitCode, 1);
}));

test('carpetas: se ignora lo que no es paquete y se avisa; enlaces y subcarpetas no se siguen', () => withRepo((repo) => {
  repo.write('inbox/sample_pack_v1.json', loadSample());
  repo.write('inbox/informe.json', { resumen: 'x' });
  repo.write('inbox/notas.md', 'hola');
  repo.write('inbox/.oculto', 'x');
  fs.mkdirSync(path.join(repo.inbox, 'sub'));
  fs.symlinkSync(path.join(repo.inbox, 'sample_pack_v1.json'), path.join(repo.inbox, 'enlace.json'));
  const res = validateContent({ root: repo.root, inputs: [repo.inbox] });
  assert.equal(res.exitCode, 0);
  assert.equal(res.files.length, 1);
  const why = Object.fromEntries(res.skipped.map((s) => [s.display, s.reason]));
  assert.match(why['informe.json'], /no parece un paquete/);
  assert.match(why['notas.md'], /no es un archivo \.json/);
  assert.match(why.sub, /subcarpeta/);
  assert.match(why['enlace.json'], /enlace simbólico/);
  assert.equal(why['.oculto'], undefined);
  assert.match(formatResult(res).out.join('\n'), /– omitido informe\.json/);
}));

test('usos incorrectos: ruta inexistente, vacía, enlace explícito, carpeta sin paquetes → UsageError (exit 2)', () => withRepo((repo) => {
  const real = repo.write('inbox/sample_pack_v1.json', loadSample());
  const link = path.join(repo.root, 'link.json');
  fs.symlinkSync(real, link);
  repo.write('vacia/informe.json', { x: 1 });
  for (const bad of [path.join(repo.root, 'nada'), '', link, path.join(repo.root, 'vacia')]) {
    assert.throws(() => validateContent({ root: repo.root, inputs: [bad] }), UsageError, String(bad));
  }
  assert.throws(() => validateContent({ root: path.join(repo.root, 'no_existe'), inputs: [real] }), UsageError);
  assert.throws(() => validateContent({}), UsageError);
  assert.throws(() => collectCandidates([42]), UsageError);
}));

test('la misma ruta dada dos veces (o carpeta + archivo) se valida una sola vez; un archivo nombrado a mano nunca se omite', () => withRepo((repo) => {
  const f = repo.write('inbox/sample_pack_v1.json', loadSample());
  assert.equal(validateContent({ root: repo.root, inputs: [f, f, repo.inbox] }).files.length, 1);
  const odd = repo.write('inbox/informe.json', { resumen: 'x' });
  const res = validateContent({ root: repo.root, inputs: [repo.inbox, odd] }); // dado a mano: se trata como paquete y falla
  assert.equal(res.files.length, 2);
  assert.equal(res.exitCode, 1);
}));

// ---------- paquetes instalados y lotes ----------
test('sin rutas valida lo instalado; un instalado sano pasa; uno ilegible o mal nombrado es error', () => withRepo((repo) => {
  assert.equal(validateContent({ root: repo.root }).exitCode, 0); // vacío: solo taxonomía
  repo.write('content/packs/sample_pack_v1.json', loadSample());
  let res = validateContent({ root: repo.root });
  assert.deepEqual([res.exitCode, res.installedMode, res.files.length], [0, true, 1]);
  repo.write('content/packs/mal_nombre.json', { ...loadSample(), pack_id: 'otro_v1', items: [{ ...loadSample().items[0], id: 'g.otro.0001' }], lexicon: [], stories: [], topics: [A] });
  res = validateContent({ root: repo.root });
  assert.ok(res.files.find((f) => f.display === 'mal_nombre.json').errors.some((e) => e.rule === 'FILE_NAME'));
  repo.write('content/packs/roto.json', '{ x');
  res = validateContent({ root: repo.root });
  assert.equal(res.files.find((f) => f.display === 'roto.json').errors[0].rule, 'JSON_INVALID');
}));

test('al validar uno nuevo, un instalado ilegible bloquea (sin él no se comprueban ids únicos); un .json ajeno no', () => withRepo((repo) => {
  const f = repo.write('inbox/sample_pack_v1.json', loadSample());
  repo.write('content/packs/ajeno.json', { nota: 'x' });
  assert.equal(validateContent({ root: repo.root, inputs: [f] }).exitCode, 0);
  repo.write('content/packs/roto.json', '{ x');
  const res = validateContent({ root: repo.root, inputs: [f] });
  assert.equal(res.exitCode, 1);
  assert.equal(res.installedProblems[0].errors[0].rule, 'INSTALLED_UNREADABLE');
  repo.write('content/packs/roto.json', { items: [] }); // parece paquete pero sin pack_id
  assert.equal(validateContent({ root: repo.root, inputs: [f] }).installedProblems[0].errors[0].rule, 'INSTALLED_UNREADABLE');
}));

test('mismo pack_id instalado = reemplazo: no choca con su propia versión', () => withRepo((repo) => {
  repo.write('content/packs/sample_pack_v1.json', loadSample());
  const v2 = loadSample(); v2.version = 2;
  const res = validateContent({ root: repo.root, inputs: [repo.write('inbox/sample_pack_v1.json', v2)] });
  assert.deepEqual([res.exitCode, res.errorTotal], [0, 0]);
}));

test('un lote: dos paquetes nuevos con el mismo id de ítem chocan entre sí; el mismo pack_id dos veces es error', () => withRepo((repo) => {
  const one = bigPack(3, 'uno_v1');
  const two = bigPack(3, 'dos_v1'); // mismos ids g.big.0001…
  const res = validateContent({ root: repo.root, inputs: [repo.write('inbox/uno_v1.json', one), repo.write('inbox/dos_v1.json', two)] });
  assert.equal(res.exitCode, 1);
  assert.ok(res.files.every((f) => rules(f).includes('items[0].id:DUPLICATE_INSTALLED')));
  const twin = repo.write('inbox/copia_v1.json', bigPack(3, 'uno_v1'));
  const res2 = validateContent({ root: repo.root, inputs: [path.join(repo.inbox, 'uno_v1.json'), twin] });
  assert.ok(rules(res2.files[1]).includes('pack_id:DUPLICATE_PACK_ID'));
  assert.match(res2.files[1].errors.find((e) => e.rule === 'DUPLICATE_PACK_ID').message, /uno_v1\.json/);
}));

test('un instalado que el lote REEMPLAZA no cuenta para los demás paquetes del lote', () => withRepo((repo) => {
  repo.write('content/packs/viejo_v1.json', bigPack(3, 'viejo_v1')); // ids g.big.0001..3
  const nuevoViejo = bigPack(1, 'viejo_v1'); nuevoViejo.version = 2; nuevoViejo.items[0].id = 'g.viejo.0001';
  const otro = bigPack(3, 'otro_v1'); // reutiliza g.big.0001..3, que ya no existirán
  const res = validateContent({ root: repo.root, inputs: [repo.write('inbox/viejo_v1.json', nuevoViejo), repo.write('inbox/otro_v1.json', otro)] });
  assert.deepEqual([res.exitCode, res.errorTotal], [0, 0]);
  const solo = validateContent({ root: repo.root, inputs: [repo.write('inbox/otro_v1.json', otro)] }); // sin reemplazo SÍ choca
  assert.equal(solo.exitCode, 1);
}));

test('nombre de archivo ≠ pack_id: aviso fuera de content/packs, error dentro', () => withRepo((repo) => {
  const res = validateContent({ root: repo.root, inputs: [repo.write('inbox/otro_nombre.json', loadSample())] });
  assert.deepEqual([res.exitCode, res.files[0].warnings.map((w) => w.rule)], [0, ['FILE_NAME']]);
  assert.match(res.files[0].warnings[0].message, /sample_pack_v1\.json/);
  const inside = validateContent({ root: repo.root, inputs: [repo.write('content/packs/otro_nombre.json', loadSample())] });
  assert.deepEqual([inside.exitCode, rules(inside.files[0])], [1, ['pack_id:FILE_NAME']]);
}));

test('un tema activo con pocos ítems da AVISO (no error): exit 0, visible salvo con --quiet', () => withRepo((repo) => {
  const p = loadSample();
  p.items = p.items.filter((it) => it.topics[0] === 'gram.modals.no_to' || it.id <= 'g.samp.0003'); // for_since (activo) queda con 3 ítems
  p.stories = [];
  const file = repo.write('inbox/sample_pack_v1.json', p);
  const res = validateContent({ root: repo.root, inputs: [file] });
  assert.equal(res.exitCode, 0);
  assert.deepEqual(res.files[0].warnings.map((w) => w.rule).sort(), ['TOPIC_FEW_ITEMS', 'TOPIC_FEW_TYPES']);
  assert.match(formatResult(res).out.join('\n'), /⚠ sample_pack_v1\.json › topics\[0\]: .*\[TOPIC_FEW_ITEMS\]/);
  assert.doesNotMatch(formatResult(res, { quiet: true }).out.join('\n'), /⚠/);
}));

// ---------- salida ----------
test('la lista de problemas se recorta a 30 por archivo y --all la muestra completa', () => withRepo((repo) => {
  const p = bigPack(60);
  p.items.forEach((it) => { it.topics = ['gram.present_perfect.form']; }); // existe, pero no está en la lista del paquete: 1 error por ítem
  const res = validateContent({ root: repo.root, inputs: [repo.write('inbox/big_pack_v1.json', p)] });
  assert.equal(res.files[0].errorTotal, 60);
  const short = formatResult(res).out.join('\n');
  assert.equal((short.match(/✘ big_pack_v1\.json ›/g) || []).length, 30);
  assert.match(short, /… y 30 error\(es\) más \(usa --all/);
  assert.equal((formatResult(res, { all: true }).out.join('\n').match(/✘ big_pack_v1\.json ›/g) || []).length, 60);
}));

test('--quiet deja solo lo que falla y el resumen; si todo está bien no imprime paquetes', () => withRepo((repo) => {
  const ok = repo.write('inbox/sample_pack_v1.json', loadSample());
  const c = capture();
  assert.equal(main(['--root', repo.root, '-q', ok], c.io), 0);
  assert.deepEqual(c.out, ['✔ Todo en orden: 1 paquete validado, 0 avisos.']);
}));

test('parseArgs: opciones, --root=, -- y errores de uso', () => {
  assert.deepEqual(parseArgs(['-q', '--all', '--root=/x', 'a', '--', '--raro']), { help: false, quiet: true, all: true, root: '/x', inputs: ['a', '--raro'] });
  assert.deepEqual(parseArgs([]), { help: false, quiet: false, all: false, root: null, inputs: [] });
  assert.equal(parseArgs(['-h']).help, true);
  for (const bad of [['--nada'], ['--root'], ['--root='], ['-z']]) assert.throws(() => parseArgs(bad), UsageError, bad.join(' '));
  assert.deepEqual(parseArgs(undefined).inputs, []);
});

test('main: códigos 0/1/2, ayuda, y nunca imprime una traza', () => withRepo((repo) => {
  let c = capture();
  assert.equal(main(['--help'], c.io), 0);
  assert.match(c.out[0], /^Uso:/);
  c = capture();
  assert.equal(main(['--nada'], c.io), 2);
  assert.match(c.err.join('\n'), /Opción desconocida: --nada[\s\S]*--help/);
  c = capture();
  assert.equal(main(['--root', path.join(repo.root, 'content', 'taxonomy', 'topics.json')], c.io), 2); // un archivo, no carpeta
  assert.match(c.err[0], /La carpeta raíz no existe/);
  const p = loadSample(); delete p.version;
  c = capture();
  assert.equal(main(['--root', repo.root, repo.write('inbox/sample_pack_v1.json', p)], c.io), 1);
  assert.match(c.out.join('\n'), /✘ sample_pack_v1\.json — 1 error/);
  assert.match(c.err.join('\n'), /✘ 1 error en 1 archivo/);
  assert.doesNotMatch(c.err.join('\n'), /at .*\.mjs/);
}));

// ---------- el comando real ----------
test('el comando real: códigos de salida 0, 1 y 2', () => withRepo((repo) => {
  const ok = repo.write('inbox/sample_pack_v1.json', loadSample());
  assert.equal(spawnSync(process.execPath, [CLI, '--root', repo.root, ok]).status, 0);
  assert.equal(spawnSync(process.execPath, [CLI, '--root', repo.root, path.join(repo.root, 'nada')]).status, 2);
  assert.equal(spawnSync(process.execPath, [CLI, '--nada']).status, 2);
  const bad = repo.write('inbox/malo_v1.json', '{ x');
  assert.equal(spawnSync(process.execPath, [CLI, '--root', repo.root, bad]).status, 1);
}));

test('si quien lee la salida la cierra antes (| head), no hay traza y se conserva el código de salida', async () => {
  const repo = makeRepo();
  try {
    const bad = repo.write('inbox/malo_v1.json', { ...loadSample(), schema: 9 });
    const child = spawn(process.execPath, [CLI, '--root', repo.root, bad], { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.destroy(); // cerrado antes de que el proceso termine de arrancar
    let err = '';
    child.stderr.on('data', (d) => { err += d; });
    const code = await new Promise((resolve) => child.on('close', resolve));
    assert.equal(code, 1);
    assert.doesNotMatch(err, /EPIPE|node:events/);
  } finally { repo.cleanup(); }
});

// ---------- seguridad ----------
test('nunca escribe: el árbol queda idéntico después de validar (con y sin errores)', () => withRepo((repo) => {
  repo.write('content/packs/sample_pack_v1.json', loadSample());
  const bad = repo.write('inbox/malo_v1.json', { ...loadSample(), pack_id: 'malo_v1', version: 0 });
  const before = treeHash(repo.root);
  validateContent({ root: repo.root });
  validateContent({ root: repo.root, inputs: [bad] });
  main(['--root', repo.root, repo.inbox], capture().io);
  assert.equal(treeHash(repo.root), before);
}));

test('el repo real pasa: su taxonomía y sus paquetes instalados son válidos', () => {
  const res = validateContent({ root: REPO });
  assert.deepEqual(res.taxonomy.map((t) => t.ok), [true, true], JSON.stringify(res.taxonomy.map((t) => t.errors)));
  assert.equal(res.exitCode, 0, formatResult(res).out.join('\n'));
});
