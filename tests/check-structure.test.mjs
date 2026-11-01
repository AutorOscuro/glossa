// @purpose: Pruebas de tools/check-structure.mjs: caso feliz, casos límite y entradas inválidas.
// Pruebas de tools/check-structure.mjs: caso feliz, casos límite y entradas inválidas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkStructure, REQUIRED_DIRS, REQUIRED_FILES } from '../tools/check-structure.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function cloneRepo() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sing-struct-'));
  fs.cpSync(REPO, tmp, {
    recursive: true,
    filter: (src) => !src.split(path.sep).includes('node_modules'),
  });
  return tmp;
}

test('repo limpio: sin problemas', () => {
  const r = checkStructure(REPO);
  assert.deepEqual(r.problems, []);
  assert.equal(r.ok, true);
});

test('detecta cada carpeta obligatoria faltante', () => {
  for (const d of REQUIRED_DIRS) {
    const tmp = cloneRepo();
    fs.rmSync(path.join(tmp, d), { recursive: true, force: true });
    const r = checkStructure(tmp);
    assert.equal(r.ok, false, `debería fallar sin ${d}/`);
    assert.ok(r.problems.some((p) => p.includes(`${d}/`)), `no mencionó ${d}/: ${r.problems}`);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('detecta cada archivo obligatorio faltante', () => {
  for (const f of REQUIRED_FILES) {
    const tmp = cloneRepo();
    fs.rmSync(path.join(tmp, f), { force: true });
    const r = checkStructure(tmp);
    assert.equal(r.ok, false, `debería fallar sin ${f}`);
    assert.ok(r.problems.some((p) => p.includes(f)), `no mencionó ${f}: ${r.problems}`);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('carpeta sin .gitkeep (vacía) y archivo vacío se marcan', () => {
  const tmp = cloneRepo();
  fs.rmSync(path.join(tmp, 'audio', '.gitkeep'));
  fs.writeFileSync(path.join(tmp, 'README.md'), '');
  const r = checkStructure(tmp);
  assert.ok(r.problems.some((p) => p.includes('audio/') && p.includes('vacía')));
  assert.ok(r.problems.some((p) => p.includes('README.md') && p.includes('vacío')));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('VERSION mal formada, estado sin secciones y contratos incompletos se marcan', () => {
  const tmp = cloneRepo();
  fs.writeFileSync(path.join(tmp, 'core/version.js'), "export const VERSION = 'abc';\n");
  fs.writeFileSync(path.join(tmp, 'PROJECT_STATE.md'), '# vacío de contenido útil\n');
  fs.writeFileSync(path.join(tmp, 'docs/CONTRACTS.md'), '### 8.1 solo uno\n');
  const r = checkStructure(tmp);
  assert.ok(r.problems.some((p) => p.includes('VERSION')));
  assert.ok(r.problems.some((p) => p.includes('Bugs conocidos')));
  assert.ok(r.problems.some((p) => p.includes('8.16')));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('entradas inválidas: raíz inexistente, vacía o no-string', () => {
  for (const bad of ['/ruta/que/no/existe', '', undefined, null, 42]) {
    const r = checkStructure(bad);
    assert.equal(r.ok, false);
    assert.equal(r.problems.length, 1);
  }
});

test('CLI: código 0 en repo limpio y 1 con salida en español si falta algo', () => {
  const script = path.join(REPO, 'tools', 'check-structure.mjs');
  const ok = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /Estructura del repo completa/);

  const tmp = cloneRepo();
  fs.rmSync(path.join(tmp, 'core/ai'), { recursive: true, force: true });
  const bad = spawnSync(process.execPath, [script, tmp], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Falta la carpeta: core\/ai\//);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('package.json: versión distinta, con dependencias, sin scripts o sin type module se marcan', () => {
  const tmp = cloneRepo();
  const file = path.join(tmp, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, JSON.stringify({ ...pkg, version: '9.9.9', dependencies: { x: '1' }, type: 'commonjs', scripts: { test: 'x' } }));
  const r = checkStructure(tmp);
  assert.ok(r.problems.some((p) => p.includes('versiones distintas')));
  assert.ok(r.problems.some((p) => p.includes('dependencias')));
  assert.ok(r.problems.some((p) => p.includes('"type": "module"')));
  assert.ok(r.problems.some((p) => p.includes('script: audit')));
  fs.writeFileSync(file, '{no es json');
  assert.ok(checkStructure(tmp).problems.some((p) => p.includes('no es JSON válido')));
  fs.rmSync(tmp, { recursive: true, force: true });
});

// Roadmap v1.4 (sección 0): PROJECT_STATE lleva la versión y el sha256 del roadmap del repo, y una sección "Contenido".
function withRoadmapLine(mutate) {
  const tmp = cloneRepo();
  const p = path.join(tmp, 'PROJECT_STATE.md');
  fs.writeFileSync(p, mutate(fs.readFileSync(p, 'utf8')));
  const r = checkStructure(tmp);
  fs.rmSync(tmp, { recursive: true, force: true });
  return r;
}

test('PROJECT_STATE: la línea de versión del roadmap coincide con docs/ROADMAP.md', () => {
  const road = fs.readFileSync(path.join(REPO, 'docs/ROADMAP.md'), 'utf8');
  const ver = road.match(/\*\*Versión del roadmap:\*\*\s*(\d+\.\d+)/)[1];
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(REPO, 'docs/ROADMAP.md'))).digest('hex');
  const state = fs.readFileSync(path.join(REPO, 'PROJECT_STATE.md'), 'utf8');
  assert.ok(state.includes(`Versión del roadmap: ${ver} (sha256 ${sha})`));
});

test('detecta versión o hash del roadmap distintos en PROJECT_STATE', () => {
  const badVer = withRoadmapLine((t) => t.replace(/Versión del roadmap: \d+\.\d+/, 'Versión del roadmap: 0.1'));
  assert.equal(badVer.ok, false);
  assert.ok(badVer.problems.some((p) => p.includes('versión del roadmap')), String(badVer.problems));
  const badSha = withRoadmapLine((t) => t.replace(/\(sha256 [0-9a-f]{64}\)/, `(sha256 ${'0'.repeat(64)})`));
  assert.equal(badSha.ok, false);
  assert.ok(badSha.problems.some((p) => p.includes('sha256')), String(badSha.problems));
});

test('detecta que falte la línea de versión del roadmap o esté mal formada', () => {
  const none = withRoadmapLine((t) => t.replace(/Versión del roadmap: .*\n?/, ''));
  assert.equal(none.ok, false);
  assert.ok(none.problems.some((p) => p.includes('Versión del roadmap')), String(none.problems));
  const short = withRoadmapLine((t) => t.replace(/\(sha256 [0-9a-f]{64}\)/, '(sha256 abc)'));
  assert.equal(short.ok, false);
  assert.ok(short.problems.some((p) => p.includes('<64 hex>')), String(short.problems));
});

test('detecta que falte la sección Contenido de PROJECT_STATE', () => {
  const r = withRoadmapLine((t) => t.replace(/^## \d+\. Contenido/m, '## 8. Otra cosa'));
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.includes('Contenido')), String(r.problems));
});

// 0.9-T3: el mapa del repositorio debe existir y estar al día (`repo-map --check` dentro de checkStructure).
function mapCase(mutate, opts) {
  const tmp = cloneRepo();
  mutate(tmp);
  const r = checkStructure(tmp, opts);
  fs.rmSync(tmp, { recursive: true, force: true });
  return r;
}
const stale = (r) => r.problems.filter((p) => p.includes('desactualizado'));

test('mapa: REPO_MAP.md y su archivo de huellas son obligatorios', () => {
  assert.ok(REQUIRED_FILES.includes('docs/REPO_MAP.md'));
  assert.ok(REQUIRED_FILES.includes('docs/REPO_MAP.hashes'));
  const r = mapCase((tmp) => fs.rmSync(path.join(tmp, 'docs/REPO_MAP.md')));
  assert.equal(r.ok, false);
  assert.ok(r.problems.includes('Falta el archivo: docs/REPO_MAP.md'), String(r.problems));
});

test('mapa: un archivo modificado, uno nuevo y uno eliminado dejan la estructura en rojo y se nombran', () => {
  const r = mapCase((tmp) => {
    fs.appendFileSync(path.join(tmp, 'core/version.js'), '\n// cambio\n');
    fs.writeFileSync(path.join(tmp, 'tests/zz-nuevo.txt'), 'x');
    fs.rmSync(path.join(tmp, 'tests/_helpers.mjs'));
  });
  assert.equal(r.ok, false);
  const [msg] = stale(r);
  assert.ok(msg, String(r.problems));
  assert.ok(msg.includes('npm run map'));
  assert.ok(msg.includes('+ tests/zz-nuevo.txt'), msg);
  assert.ok(msg.includes('~ core/version.js'), msg);
  assert.ok(msg.includes('- tests/_helpers.mjs'), msg);
});

test('mapa: editar un documento (p. ej. DECISIONS.md) sin regenerar el mapa también falla', () => {
  const r = mapCase((tmp) => fs.appendFileSync(path.join(tmp, 'DECISIONS.md'), '\nlínea nueva\n'));
  assert.ok(stale(r)[0]?.includes('~ DECISIONS.md'), String(r.problems));
});

test('mapa: editar un bloque manual del mapa NO invalida el hash', () => {
  const r = mapCase((tmp) => {
    const p = path.join(tmp, 'docs/REPO_MAP.md');
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('<!-- MANUAL:inicio:delta -->', '<!-- MANUAL:inicio:delta -->\nnota'));
  });
  assert.deepEqual(r.problems, []);
});

test('mapa: cabecera ilegible o huellas que no corresponden se informan con el remedio', () => {
  const bad = mapCase((tmp) => {
    const p = path.join(tmp, 'docs/REPO_MAP.md');
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/^<!-- repo-map:.*-->/, '<!-- roto -->'));
  });
  assert.ok(bad.problems.some((p) => p.startsWith('Mapa del repositorio:') && p.includes('npm run map')), String(bad.problems));
  const hashes = mapCase((tmp) => {
    fs.appendFileSync(path.join(tmp, 'core/version.js'), '\n// cambio\n');
    fs.appendFileSync(path.join(tmp, 'docs/REPO_MAP.hashes'), 'x/y 0000000000000000000000000000000000000000\n');
  });
  assert.ok(hashes.problems.some((p) => p.includes('REPO_MAP.hashes') && p.includes('npm run map')), String(hashes.problems));
});

test('mapa: con { map: false } no se comprueba; el repo real pasa con y sin él', () => {
  const r = mapCase((tmp) => fs.appendFileSync(path.join(tmp, 'core/version.js'), '\n// cambio\n'), { map: false });
  assert.deepEqual(r.problems, []);
  assert.deepEqual(checkStructure(REPO, { map: false }).problems, []);
  assert.deepEqual(checkStructure(REPO).problems, []);
});

test('mapa: la lista de cambios se acorta con muchos archivos', () => {
  const r = mapCase((tmp) => { for (let i = 0; i < 8; i += 1) fs.writeFileSync(path.join(tmp, `tests/zz-${i}.txt`), String(i)); });
  const msg = stale(r)[0] ?? '';
  assert.ok(msg.includes('… (+3)'), msg);
  assert.ok(msg.includes('tests/zz-4.txt') && !msg.includes('tests/zz-5.txt'), msg);
});

test('CLI: npm run check-structure sale con 1 y nombra el mapa viejo; con el mapa al día sale con 0', () => {
  const run = (cwd) => spawnSync(process.execPath, [path.join(REPO, 'tools/check-structure.mjs'), cwd], { encoding: 'utf8' });
  const tmp = cloneRepo();
  fs.appendFileSync(path.join(tmp, 'core/version.js'), '\n// cambio\n');
  const bad = run(tmp);
  fs.rmSync(tmp, { recursive: true, force: true });
  assert.equal(bad.status, 1);
  assert.ok(bad.stderr.includes('desactualizado'), bad.stderr);
  assert.equal(run(REPO).status, 0);
});
