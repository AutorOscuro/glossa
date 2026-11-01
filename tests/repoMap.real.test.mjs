// @purpose: Pruebas del mapa contra el repo real: 100 % de archivos, oráculo de firmas contra los módulos importados de verdad (≥ 40), idempotencia y huellas, sin escribir en el repo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseModule } from '../tools/repoMapParse.mjs';
import { snapshot, treeHash, MAP_FILE, HASHES_FILE } from '../tools/repoMapTree.mjs';
import { buildMapText, loadConfig, parseHeader } from '../tools/repo-map.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'tools', 'repo-map.mjs');

/** Recorrido independiente del de la herramienta (readdir + lstat), con las mismas exclusiones documentadas. */
function independentWalk(dir, base = '') {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const lower = name.toLowerCase();
    if (['.git', 'node_modules', '__pycache__', '__macosx', '.ds_store', 'thumbs.db', 'desktop.ini'].includes(lower)) continue;
    const abs = path.join(dir, name);
    const st = fs.lstatSync(abs);
    if (st.isSymbolicLink()) continue;
    const rel = base ? `${base}/${name}` : name;
    if (st.isDirectory()) out.push(...independentWalk(abs, rel));
    else if (st.isFile() && !/\.(zip|pyc)$/i.test(name) && rel !== MAP_FILE && rel !== HASHES_FILE) out.push(rel.normalize('NFC'));
  }
  return out;
}

function mapOfRepo() {
  const entries = snapshot(ROOT);
  const cfg = loadConfig(ROOT);
  return { entries, cfg, built: buildMapText(entries, cfg) };
}

test('CA-3: el mapa del repo real lista el 100 % de los archivos (cruce con un recorrido independiente)', () => {
  const { built, entries } = mapOfRepo();
  const walked = independentWalk(ROOT).sort();
  assert.ok(walked.length > 250, `se esperaban más de 250 archivos, hay ${walked.length}`);
  const text = built.text;
  const listed = [...text.slice(text.indexOf('## Índice de áreas')).matchAll(/^- (?:`` (.+?) ``|`([^`]+)`)/gm)].map((m) => m[1] ?? m[2]).sort();
  assert.deepEqual(listed, walked);
  assert.equal(entries.length, walked.length);
  assert.equal(parseHeader(text).files, walked.length);
  assert.equal(parseHeader(text).hash, treeHash(entries));
});

test('CA-1: idempotencia sobre el repo real (dos corridas, mismo texto) y sin avisos de configuración', () => {
  const a = mapOfRepo().built;
  const b = mapOfRepo().built;
  assert.equal(a.text, b.text);
  assert.deepEqual(a.warnings, [], 'la configuración real no debe dar avisos');
  assert.ok(!a.text.includes(ROOT) && !a.text.includes('\r'));
});

test('CA-1: la CLI sobre el repo real escribe solo en --out y deja el repo intacto', () => {
  const before = treeHash(snapshot(ROOT));
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repomap-real-'));
  try {
    const out = path.join(outDir, 'mapa.md');
    const r1 = spawnSync(process.execPath, [CLI, '--root', ROOT, '--out', out], { encoding: 'utf8' });
    assert.equal(r1.status, 0, r1.stderr);
    const text1 = fs.readFileSync(out, 'utf8');
    const r2 = spawnSync(process.execPath, [CLI, '--root', ROOT, '--out', out], { encoding: 'utf8' });
    assert.match(r2.stdout, /Mapa sin cambios/);
    assert.equal(fs.readFileSync(out, 'utf8'), text1);
    const chk = spawnSync(process.execPath, [CLI, '--check', '--root', ROOT, '--out', out], { encoding: 'utf8' });
    assert.equal(chk.status, 0, chk.stdout + chk.stderr);
    assert.match(chk.stdout, /^OK [0-9a-f]{64}\n$/);
    assert.equal(treeHash(snapshot(ROOT)), before, 'el repo no cambió');
  } finally { fs.rmSync(outDir, { recursive: true, force: true }); }
});

// ───────────── CA-4: oráculo de firmas contra módulos reales ─────────────
function listModules() {
  const out = [];
  const add = (dir, deep) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (e.isDirectory() && deep) add(`${dir}/${e.name}`, deep);
      else if (e.isFile() && /\.js$/.test(e.name)) out.push(`${dir}/${e.name}`);
    }
  };
  add('core', true);
  add('ui/components', false);
  add('app', false);
  out.push('ui/dom.js');
  return out.filter((f) => f !== 'app/main.js' && f !== 'app/boot-check.js').sort();
}

/** Parámetros de una función según su texto real: entre el primer paréntesis y su pareja (o el único parámetro de una flecha). */
function realParams(fn) {
  const text = Function.prototype.toString.call(fn);
  const bare = /^(?:async\s+)?([\p{L}_$][\p{L}\p{N}_$]*)\s*=>/u.exec(text);
  if (bare) return bare[1];
  const open = text.indexOf('(');
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i += 1) {
    const c = text[i];
    if (quote) { if (c === '\\') i += 1; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') { depth -= 1; if (depth === 0) return text.slice(open + 1, i); }
  }
  return null;
}
const norm = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ').replace(/,\s*$/, '').trim();

test('CA-4: las exportaciones del mapa coinciden con las de ≥ 40 módulos reales (nombres, clases y parámetros de funciones)', { timeout: 120000 }, async () => {
  let imported = 0;
  let functionsChecked = 0;
  const skipped = [];
  const problems = [];
  for (const rel of listModules()) {
    let mod;
    try { mod = await import(pathToFileURL(path.join(ROOT, rel)).href); } catch (e) { skipped.push(`${rel}: ${e.message}`); continue; }
    imported += 1;
    const parsed = parseModule(fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n?/g, '\n')).exports;
    if (parsed.some((e) => e.kind === 'star')) continue;
    const actual = Object.keys(mod).sort();
    const expected = parsed.map((e) => e.name).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) { problems.push(`${rel}: nombres reales [${actual}] ≠ mapa [${expected}]`); continue; }
    for (const e of parsed) {
      const value = mod[e.name];
      if (e.kind === 'class' && !/^class\b/.test(Function.prototype.toString.call(value))) problems.push(`${rel}: ${e.name} no es una clase`);
      if (e.kind !== 'function' || typeof value !== 'function') continue;
      const m = /\((.*)\)$/s.exec(e.signature);
      if (!m || m[1].endsWith('…')) continue;
      const real = realParams(value);
      functionsChecked += 1;
      if (real === null || norm(real) !== norm(m[1])) problems.push(`${rel}: ${e.name}(${m[1]}) ≠ real (${real})`);
    }
  }
  assert.deepEqual(problems, []);
  assert.ok(imported >= 40, `solo se importaron ${imported} módulos; omitidos: ${skipped.join(' | ')}`);
  assert.ok(functionsChecked >= 100, `solo se compararon ${functionsChecked} funciones`);
});

test('CA-4: en el mapa real, las reexportaciones muestran la firma de su origen (ui/components/index.js, core/srs.js)', () => {
  const text = mapOfRepo().built.text;
  const line = (rel) => text.split('\n').find((l) => l.startsWith(`- \`${rel}\``));
  assert.match(line('ui/components/index.js'), /createButton\(opts = \{\}\) ← ui\/components\/button\.js/);
  assert.match(line('core/srs.js'), /isLeech\(card, threshold = DEFAULT_LEECH_THRESHOLD\) ← core\/srsLeech\.js/);
  assert.match(line('vendor/ts-fsrs/index.mjs'), /^- `vendor\/ts-fsrs\/index\.mjs` · \d+ l · propósito: /);
  assert.match(line('asset-manifest.json'), /generado/);
});
