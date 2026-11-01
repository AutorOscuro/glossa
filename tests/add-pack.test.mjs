// @purpose: Pruebas del comando add-pack (tools/add-pack.mjs): instalación de paquetes y seguridad, sobre un repo temporal.
// Pruebas de tools/add-pack.mjs (subparte 1.3, cuarto 4, mitad 4B): CA 6 de la 1.3 y la seguridad. Repo temporal en os.tmpdir().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { planAddPack, applyPlan, addPack, formatAddPack, parseArgs, main, UsageError } from '../tools/add-pack.mjs';
import { validateIndex } from '../core/content.js';
import { loadSample, makeRepo, treeHash, REPO } from './_samplePack.mjs';

const CLI = path.join(REPO, 'tools', 'add-pack.mjs');
// segundo paquete válido: mismos contenidos con otro pack_id e ids de ítem/palabra/historia distintos
const second = (id = 'segundo_v1', version = 1) => JSON.parse(JSON.stringify(loadSample()).replaceAll('g.samp.', 'g.seg.').replaceAll('vocab.time.deadline', 'vocab.time.deadline_seg').replaceAll('story.a1.0001', 'story.seg.0001').replace('sample_pack_v1', id).replace(/"version": 1,\n/, `"version": ${version},\n`));
const withVersion = (pack, version, mut) => { const p = structuredClone(pack); p.version = version; if (mut) mut(p); return p; };
const io = () => { const o = { out: [], err: [] }; o.o = (l) => o.out.push(l); o.e = (l) => o.err.push(l); return o; };
const run = (repo, argv) => { const x = io(); const code = main(argv, { out: x.o, err: x.e }, repo.root); return { code, out: x.out.join('\n'), err: x.err.join('\n') }; };
const idx = (repo) => JSON.parse(fs.readFileSync(path.join(repo.root, 'content', 'index.json'), 'utf8'));
const installed = (repo, id) => path.join(repo.packs, `${id}.json`);
const add = (repo, ...inputs) => addPack({ root: repo.root, inputs: inputs.map((i) => (path.isAbsolute(i) ? i : path.join(repo.inbox, i))), cwd: repo.root });

test('el paquete de muestra se agrega: se copia con formato estable y el índice queda correcto', () => {
  const repo = makeRepo();
  try {
    repo.write('inbox/sample_pack_v1.json', loadSample());
    const r = add(repo, 'sample_pack_v1.json');
    assert.deepEqual([r.ok, r.exitCode, r.actions[0].action], [true, 0, 'add']);
    const text = fs.readFileSync(installed(repo, 'sample_pack_v1'), 'utf8');
    assert.equal(text, `${JSON.stringify(loadSample(), null, 2)}\n`);
    const index = idx(repo);
    assert.equal(validateIndex(index).ok, true);
    assert.deepEqual(index.packs.map((e) => [e.pack_id, e.version, e.path, e.items_count, e.topics]), [['sample_pack_v1', 1, 'content/packs/sample_pack_v1.json', 21, loadSample().topics]]);
    assert.equal(index.packs[0].size_kb, Math.ceil(Buffer.byteLength(text) / 1024));
    assert.deepEqual(fs.readdirSync(repo.packs), ['sample_pack_v1.json'], 'sin temporales');
  } finally { repo.cleanup(); }
});

test('repetir el comando no cambia nada (huella idéntica) y dice que no había nada que hacer', () => {
  const repo = makeRepo();
  try {
    repo.write('inbox/sample_pack_v1.json', loadSample());
    add(repo, 'sample_pack_v1.json');
    const before = treeHash(repo.root);
    const r = add(repo, 'sample_pack_v1.json');
    assert.deepEqual([r.ok, r.actions[0].action, r.writes.length, r.index.action], [true, 'unchanged', 0, 'unchanged']);
    assert.equal(treeHash(repo.root), before);
    assert.match(formatAddPack(r).out.join('\n'), /nada que hacer/);
  } finally { repo.cleanup(); }
});

test('un lote con 1 paquete inválido entre 3 no escribe NINGÚN archivo', () => {
  const repo = makeRepo();
  try {
    repo.write('inbox/sample_pack_v1.json', loadSample());
    repo.write('inbox/segundo_v1.json', second());
    const bad = second('tercero_v1'); bad.items.forEach((it, i) => { it.id = `g.ter.${String(i + 1).padStart(4, '0')}`; }); bad.items[0].accept = null;
    repo.write('inbox/tercero_v1.json', bad);
    const before = treeHash(repo.root);
    const r = add(repo, repo.inbox);
    assert.deepEqual([r.ok, r.exitCode, r.written], [false, 1, []]);
    assert.equal(treeHash(repo.root), before);
    assert.equal(fs.existsSync(path.join(repo.root, 'content', 'index.json')), false);
    assert.match(formatAddPack(r).err.join('\n'), /No se escribió nada/);
  } finally { repo.cleanup(); }
});

test('versión mayor reemplaza; menor y misma-distinta fallan sin escribir; --force con --reason lo permite', () => {
  const repo = makeRepo();
  try {
    const v1 = loadSample();
    repo.write('inbox/sample_pack_v1.json', v1);
    add(repo, 'sample_pack_v1.json');
    const v2 = withVersion(v1, 2, (p) => { p.items = p.items.slice(1); });
    repo.write('inbox/v2/sample_pack_v1.json', v2);
    const up = add(repo, 'v2');
    assert.deepEqual([up.ok, up.actions[0].action, up.actions[0].from, up.index.action], [true, 'replace', 1, 'update']);
    assert.equal(JSON.parse(fs.readFileSync(installed(repo, 'sample_pack_v1'), 'utf8')).version, 2);
    assert.deepEqual([idx(repo).packs[0].version, idx(repo).packs[0].items_count], [2, 20]);
    assert.match(formatAddPack(up).out.join('\n'), /v1 → v2/);

    repo.write('inbox/v2b/sample_pack_v1.json', withVersion(v2, 2, (p) => { p.title_es = 'Otro título'; }));
    const before = treeHash(repo.root);
    const low = add(repo, 'sample_pack_v1.json'); // v1 sobre v2
    assert.deepEqual([low.ok, low.errors[0].code], [false, 'VERSION_LOWER']);
    const same = add(repo, 'v2b');
    assert.deepEqual([same.ok, same.errors[0].code], [false, 'VERSION_SAME_DIFFERENT']);
    assert.equal(treeHash(repo.root), before);
    assert.match(formatAddPack(same).err.join('\n'), /sube la versión/);

    assert.throws(() => addPack({ root: repo.root, inputs: [path.join(repo.inbox, 'v2b')], cwd: repo.root, force: true }), UsageError);
    const forced = addPack({ root: repo.root, inputs: [path.join(repo.inbox, 'v2b')], cwd: repo.root, force: true, reason: 'prueba' });
    assert.deepEqual([forced.ok, forced.actions[0].forced], [true, true]);
    assert.equal(JSON.parse(fs.readFileSync(installed(repo, 'sample_pack_v1'), 'utf8')).title_es, 'Otro título');
  } finally { repo.cleanup(); }
});

test('--dry-run no toca el disco pero informa lo que haría', () => {
  const repo = makeRepo();
  try {
    repo.write('inbox/sample_pack_v1.json', loadSample());
    const before = treeHash(repo.root);
    const x = run(repo, ['--root', repo.root, '--dry-run', path.join(repo.inbox, 'sample_pack_v1.json')]);
    assert.equal(x.code, 0);
    assert.match(x.out, /sample_pack_v1 — nuevo/);
    assert.match(x.out, /simulación/);
    assert.doesNotMatch(x.out, /Siguientes pasos/);
    assert.equal(treeHash(repo.root), before);
  } finally { repo.cleanup(); }
});

test('IDs duplicados contra un paquete ya instalado se detectan (y nada se escribe)', () => {
  const repo = makeRepo();
  try {
    repo.write('inbox/sample_pack_v1.json', loadSample());
    add(repo, 'sample_pack_v1.json');
    const clash = JSON.parse(JSON.stringify(loadSample()).replace('sample_pack_v1', 'choque_v1'));
    repo.write('inbox/x/choque_v1.json', clash);
    const before = treeHash(repo.root);
    const r = add(repo, 'x');
    assert.deepEqual([r.ok, r.exitCode], [false, 1]);
    assert.ok(r.validation.files[0].errors.some((e) => e.rule === 'DUPLICATE_INSTALLED'));
    assert.equal(treeHash(repo.root), before);
  } finally { repo.cleanup(); }
});

test('lote de varios paquetes: índice ordenado por pack_id y entradas ajenas se conservan', () => {
  const repo = makeRepo();
  try {
    repo.write('inbox/segundo_v1.json', second('zeta_v1'));
    add(repo, 'segundo_v1.json');
    repo.write('inbox/sample_pack_v1.json', loadSample());
    const r = add(repo, 'sample_pack_v1.json');
    assert.equal(r.ok, true);
    assert.deepEqual(idx(repo).packs.map((e) => e.pack_id), ['sample_pack_v1', 'zeta_v1']);
  } finally { repo.cleanup(); }
});

test('rutas con .. y nombres raros: el destino sale del pack_id, nunca de la ruta dada', () => {
  const repo = makeRepo();
  try {
    repo.write('inbox/..%2Fescape.json', loadSample());
    const odd = path.join(repo.inbox, '..%2Fescape.json');
    const r = add(repo, odd);
    assert.equal(r.ok, true);
    assert.deepEqual(fs.readdirSync(repo.packs), ['sample_pack_v1.json']);
    const evil = JSON.parse(JSON.stringify(loadSample()).replace('sample_pack_v1', '../../evil'));
    repo.write('inbox/e/evil.json', evil);
    const before = treeHash(repo.root);
    const bad = add(repo, 'e');
    assert.equal(bad.ok, false);
    assert.equal(treeHash(repo.root), before);
    assert.equal(fs.existsSync(path.join(repo.root, '..', 'evil.json')), false);
    assert.throws(() => planAddPack({ root: repo.root, inputs: [path.join(repo.inbox, '..', '..', 'no_existe')], cwd: repo.root }), UsageError);
  } finally { repo.cleanup(); }
});

test('enlaces simbólicos: no se siguen (entrada, destino y carpeta content/packs)', () => {
  const repo = makeRepo();
  try {
    repo.write('inbox/real.json', loadSample());
    fs.symlinkSync(path.join(repo.inbox, 'real.json'), path.join(repo.inbox, 'enlace.json'));
    assert.throws(() => add(repo, path.join(repo.inbox, 'enlace.json')), UsageError);
    // destino que ya existe como enlace
    const outside = path.join(repo.root, 'fuera.json'); fs.writeFileSync(outside, '{}');
    fs.symlinkSync(outside, installed(repo, 'sample_pack_v1'));
    const r = add(repo, 'real.json'); // el instalado es un enlace: se rechaza, no se sigue
    assert.equal(r.ok, false);
    assert.equal(fs.readFileSync(outside, 'utf8'), '{}');
    fs.rmSync(installed(repo, 'sample_pack_v1'));
    // content/packs es un enlace
    fs.rmSync(repo.packs, { recursive: true });
    fs.mkdirSync(path.join(repo.root, 'otro'));
    fs.symlinkSync(path.join(repo.root, 'otro'), repo.packs);
    assert.throws(() => add(repo, 'real.json'), UsageError);
    assert.deepEqual(fs.readdirSync(path.join(repo.root, 'otro')), []);
  } finally { repo.cleanup(); }
});

test('si la escritura falla a mitad, se deshace todo: el repo queda como estaba', () => {
  const repo = makeRepo();
  try {
    repo.write('inbox/sample_pack_v1.json', loadSample());
    repo.write('inbox/segundo_v1.json', second());
    add(repo, 'sample_pack_v1.json');
    const before = treeHash(repo.root);
    let n = 0;
    const plan = planAddPack({ root: repo.root, inputs: [path.join(repo.inbox, 'segundo_v1.json')], cwd: repo.root });
    assert.equal(plan.writes.length, 2);
    assert.throws(() => applyPlan(plan, { rename: (a, b) => { n += 1; if (n === 2) throw new Error('disco lleno'); fs.renameSync(a, b); } }), /Se deshizo todo/);
    assert.equal(treeHash(repo.root), before);
    const r = addPack({ root: repo.root, inputs: [path.join(repo.inbox, 'segundo_v1.json')], cwd: repo.root, io: { rename: () => { throw new Error('x'); } } });
    assert.deepEqual([r.ok, r.exitCode], [false, 1]);
    assert.match(formatAddPack(r).err.join('\n'), /Se deshizo todo/);
    assert.equal(treeHash(repo.root), before);
  } finally { repo.cleanup(); }
});

test('un índice existente dañado o inválido no se pisa: uso incorrecto y nada escrito', () => {
  const repo = makeRepo();
  try {
    repo.write('inbox/sample_pack_v1.json', loadSample());
    repo.write('content/index.json', '{ roto');
    let before = treeHash(repo.root);
    assert.throws(() => add(repo, 'sample_pack_v1.json'), /index\.json/);
    repo.write('content/index.json', { schema: 9, packs: [] });
    assert.throws(() => add(repo, 'sample_pack_v1.json'), /no es válido/);
    assert.equal(treeHash(repo.root), before = treeHash(repo.root));
    assert.deepEqual(fs.readdirSync(repo.packs), []);
  } finally { repo.cleanup(); }
});

test('un paquete instalado ilegible o sin versión da error sin escribir', () => {
  const repo = makeRepo();
  try {
    repo.write('inbox/sample_pack_v1.json', loadSample());
    repo.write('content/packs/sample_pack_v1.json', '{ roto');
    const before = treeHash(repo.root);
    const r = add(repo, 'sample_pack_v1.json');
    assert.equal(r.ok, false);
    assert.equal(treeHash(repo.root), before);
  } finally { repo.cleanup(); }
});

test('carpeta con un informe y otros archivos: se ignoran avisando; sin paquetes → uso incorrecto', () => {
  const repo = makeRepo();
  try {
    repo.write('inbox/sample_pack_v1.json', loadSample());
    repo.write('inbox/informe.json', { resumen: 'ok' });
    repo.write('inbox/INFORME.md', '# informe');
    const x = run(repo, ['--root', repo.root, repo.inbox]);
    assert.equal(x.code, 0);
    assert.match(x.out, /informe\.json/);
    assert.deepEqual(fs.readdirSync(repo.packs), ['sample_pack_v1.json']);
    repo.write('vacia/leeme.md', 'x');
    const y = run(repo, ['--root', repo.root, path.join(repo.root, 'vacia')]);
    assert.equal(y.code, 2);
  } finally { repo.cleanup(); }
});

test('argumentos: sin rutas, opción desconocida, valores que faltan, --force sin --reason y --help', () => {
  const repo = makeRepo();
  try {
    assert.equal(run(repo, ['--root', repo.root]).code, 2);
    assert.equal(run(repo, ['--rara']).code, 2);
    assert.equal(run(repo, ['--root']).code, 2);
    assert.equal(run(repo, ['--root', repo.root, '--force', 'x.json']).code, 2);
    assert.equal(run(repo, ['--root', path.join(repo.root, 'nada'), 'x.json']).code, 2);
    const h = run(repo, ['--help']);
    assert.deepEqual([h.code, /add-pack/.test(h.out)], [0, true]);
    assert.deepEqual(parseArgs(['-q', 'a', '--dry-run']), { inputs: ['a'], dryRun: true, quiet: true, force: false, reason: undefined, root: undefined, help: false });
  } finally { repo.cleanup(); }
});

test('--quiet solo muestra lo que falla y el resumen; el éxito imprime los siguientes pasos', () => {
  const repo = makeRepo();
  try {
    repo.write('inbox/sample_pack_v1.json', loadSample());
    const x = run(repo, ['--root', repo.root, '--quiet', path.join(repo.inbox, 'sample_pack_v1.json')]);
    assert.equal(x.code, 0);
    assert.match(x.out, /npm run build/);
    assert.match(x.out, /core\/version\.js/);
  } finally { repo.cleanup(); }
});

test('CLI real: código de salida 0 al agregar y 1 si hay error; el repo real no se toca', () => {
  const repo = makeRepo();
  try {
    repo.write('inbox/sample_pack_v1.json', loadSample());
    const ok = spawnSync(process.execPath, [CLI, '--root', repo.root, path.join(repo.inbox, 'sample_pack_v1.json')], { encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stderr);
    assert.ok(fs.existsSync(installed(repo, 'sample_pack_v1')));
    repo.write('inbox/malo_v1.json', { pack_id: 'malo_v1' });
    const bad = spawnSync(process.execPath, [CLI, '--root', repo.root, path.join(repo.inbox, 'malo_v1.json')], { encoding: 'utf8' });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /No se escribió nada/);
    assert.equal(fs.existsSync(path.join(REPO, 'content', 'packs', 'sample_pack_v1.json')), false);
  } finally { repo.cleanup(); }
});

test('lo instalado por add-pack pasa validate-content (una sola implementación)', () => {
  const repo = makeRepo();
  try {
    repo.write('inbox/sample_pack_v1.json', loadSample());
    repo.write('inbox/segundo_v1.json', second());
    assert.equal(add(repo, repo.inbox).ok, true);
    const v = spawnSync(process.execPath, [path.join(REPO, 'tools', 'validate-content.mjs'), '--root', repo.root, '--quiet'], { encoding: 'utf8' });
    assert.equal(v.status, 0, v.stdout + v.stderr);
  } finally { repo.cleanup(); }
});

// ---------- CA 7: docs/ADD_PACK.md existe y sus comandos funcionan tal cual están escritos ----------
test('docs/ADD_PACK.md: existe, el script está en package.json y cada comando del documento se ejecuta', () => {
  const doc = fs.readFileSync(path.join(REPO, 'docs', 'ADD_PACK.md'), 'utf8');
  assert.ok(doc.split('\n').length <= 45, 'cabe en una página');
  const scripts = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).scripts;
  assert.equal(scripts['add-pack'], 'node tools/add-pack.mjs');
  const cmds = [...doc.matchAll(/`(npm run [^`]+)`/g)].map((m) => m[1]);
  assert.ok(cmds.some((c) => c.includes('add-pack -- --dry-run')) && cmds.some((c) => c.includes('add-pack -- lote1')) && cmds.includes('npm run build'));
  for (const c of cmds) { const name = c.split(' ')[2]; assert.ok(scripts[name], `el script ${name} existe`); }
  const repo = makeRepo();
  try {
    repo.write('lote1/sample_pack_v1.json', loadSample());
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    for (const c of cmds.filter((x) => x.includes('add-pack'))) {
      // mismo comando, solo apuntado a un repo temporal (--root) y con la carpeta de ejemplo en su sitio
      const args = c.replace(/^npm /, '').replace(/lote1/g, path.join(repo.root, 'lote1')).split(' ');
      const r = spawnSync(npm, [...args, '--root', repo.root], { cwd: REPO, encoding: 'utf8' });
      assert.equal(r.status, 0, `${c}\n${r.stdout}${r.stderr}`);
    }
    assert.ok(fs.existsSync(installed(repo, 'sample_pack_v1')), 'el paso 3 instaló el paquete');
    // los mensajes citados en el documento existen de verdad
    const sources = [...fs.readdirSync(path.join(REPO, 'core')).filter((f) => f.endsWith('.js')).map((f) => path.join(REPO, 'core', f)), path.join(REPO, 'tools', 'add-pack.mjs'), path.join(REPO, 'tools', 'contentFs.mjs'), path.join(REPO, 'tools', 'validate-content.mjs')];
    const code = sources.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    for (const msg of ['VERSION_SAME_DIFFERENT', 'VERSION_LOWER', 'DUPLICATE_INSTALLED', 'UNKNOWN_TOPIC', 'UNKNOWN_CODE', 'JSON_INVALID', 'TOPIC_FEW_ITEMS']) assert.ok(code.includes(msg), msg);
  } finally { repo.cleanup(); }
});
