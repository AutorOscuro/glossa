// Pruebas de tools/check-structure.mjs: caso feliz, casos límite y entradas inválidas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
