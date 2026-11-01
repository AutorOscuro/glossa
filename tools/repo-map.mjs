// @purpose: CLI del mapa del repositorio: `npm run map` regenera docs/REPO_MAP.md y sus huellas; `--check` compara el tree-hash y lista creados, modificados y eliminados (0.9-T1).
// Uso:  node tools/repo-map.mjs [--check] [--root <carpeta>] [--out <archivo>]
//   sin opciones   regenera el mapa y el archivo de huellas (solo escribe si el contenido cambia)
//   --check        imprime `OK <tree-hash>` (salida 0) o la lista `+ creado` / `~ modificado` / `- eliminado` (salida 1)
//   --root, --out  para pruebas; el archivo de huellas sale de --out cambiando `.md` por `.hashes`
// Salida: 0 correcto · 1 diferencias o mapa ilegible/ausente · 2 error de uso o de entrada/salida.
// Como módulo: generate, checkMap, buildMapText, analyzeFile, parseManual, loadConfig, main.
// Todo lo que está fuera de los bloques MANUAL se regenera; los bloques MANUAL se conservan literalmente (por nombre).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { shorten, parseModule, extractPurpose, requiresPurpose, countTests, lineCount, isBinary, describeJson, resolveSpec } from './repoMapParse.mjs';
import { MAP_FILE, HASHES_FILE, snapshot, hashLines, treeHash, parseHashLines, diffTrees, toRepoPath } from './repoMapTree.mjs';

export const FORMAT = 1;
export const CONFIG_FILE = 'tools/repo-map.config.json';
const MAX_HOPS = 6;
const MAX_KEYS = 10;
const MAX_LISTED = 200;
const ROOT_AREA = '(raíz)';
const JS_EXT = new Set(['.js', '.mjs', '.cjs']);
const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.py']);
const DATA_EXT = new Set(['.json', '.webmanifest']);
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Error esperado (entrada, configuración o marcas manuales mal formadas): sale con código 2. */
export class MapError extends Error {}

// ───────────────────────── bloques manuales ─────────────────────────
const T3 = 'Lo escribe 0.9-T3 (única investigación completa del repositorio).';
export const MANUAL_BLOCKS = [
  { name: 'delta', title: 'Delta del último tramo', body: ['_Pendiente. Cada tramo reemplaza este texto al entregar (≤ 25 líneas: una por archivo creado, modificado o eliminado, con el porqué; contratos tocados; trampas nuevas). El primero llega con 0.9-T3._'] },
  { name: 'como-encaja', title: 'Cómo encaja todo', body: [`_Pendiente. ${T3} Aquí van, en ≤ 60 líneas, las capas, el flujo de datos y quién llama a quién._`] },
  { name: 'servicios', title: 'Servicios cableados y pendientes de cablear', body: [`_Pendiente. ${T3}_`] },
  { name: 'convenciones', title: 'Convenciones y trampas', body: [`_Pendiente. ${T3} Es acumulativa: cada chat añade, nunca reescribe._`] },
  { name: 'comandos', title: 'Comandos y verificaciones', body: ['- `npm run map` regenera este mapa y `docs/REPO_MAP.hashes`.', '- `npm run map -- --check` imprime `OK <tree-hash>` o lista los archivos creados, modificados y eliminados (salida 1).', '_El resto de comandos lo completa 0.9-T3._'] },
];
const KNOWN_BLOCKS = new Set(MANUAL_BLOCKS.map((b) => b.name));
const OPEN_RE = /^<!--\s*MANUAL:inicio:([^\s>]+)\s*-->$/;
const CLOSE_RE = /^<!--\s*MANUAL:fin:([^\s>]+)\s*-->$/;

/** Lee los bloques manuales de un mapa anterior: Map nombre → líneas. Lanza MapError si las marcas están duplicadas, anidadas o sin cerrar. */
export function parseManual(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const blocks = new Map();
  let open = null;
  lines.forEach((line, i) => {
    const t = line.trim();
    const o = OPEN_RE.exec(t);
    const c = CLOSE_RE.exec(t);
    if (o) {
      if (open) throw new MapError(`Bloque manual anidado: «${o[1]}» empieza dentro de «${open.name}» (línea ${i + 1}).`);
      if (blocks.has(o[1])) throw new MapError(`Bloque manual duplicado: «${o[1]}» (línea ${i + 1}).`);
      open = { name: o[1], start: i };
    } else if (c) {
      if (!open) throw new MapError(`Marca de cierre sin inicio: «${c[1]}» (línea ${i + 1}).`);
      if (open.name !== c[1]) throw new MapError(`La marca de cierre «${c[1]}» (línea ${i + 1}) no corresponde al bloque abierto «${open.name}».`);
      blocks.set(open.name, lines.slice(open.start + 1, i));
      open = null;
    }
  });
  if (open) throw new MapError(`Bloque manual sin cerrar: «${open.name}» (línea ${open.start + 1}).`);
  return blocks;
}

/** Cabecera `<!-- repo-map: formato=1 tree-hash=<64 hex> archivos=<N> -->` en la primera línea. */
export function parseHeader(text) {
  const m = /^\uFEFF?<!-- repo-map: formato=(\d+) tree-hash=([0-9a-f]{64}) archivos=(\d+) -->/.exec(String(text));
  return m ? { formato: Number(m[1]), hash: m[2], files: Number(m[3]) } : null;
}

// ───────────────────────── configuración ─────────────────────────
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const allStrings = (o) => Object.values(o).every((v) => typeof v === 'string');

export function loadConfig(root) {
  const empty = { formato: FORMAT, areas: {}, propositos: {}, generados: [] };
  let text;
  try { text = fs.readFileSync(path.join(root, CONFIG_FILE), 'utf8'); } catch (e) {
    if (e.code === 'ENOENT') return empty;
    throw new MapError(`No se pudo leer ${CONFIG_FILE}: ${e.message}`);
  }
  let cfg;
  try { cfg = JSON.parse(text); } catch (e) { throw new MapError(`${CONFIG_FILE} no es JSON válido: ${e.message}`); }
  if (!isPlainObject(cfg) || cfg.formato !== FORMAT) throw new MapError(`${CONFIG_FILE}: debe ser un objeto con "formato": ${FORMAT}.`);
  const out = { ...empty, ...cfg };
  for (const key of ['areas', 'propositos']) {
    if (!isPlainObject(out[key]) || !allStrings(out[key])) throw new MapError(`${CONFIG_FILE}: "${key}" debe ser un objeto de textos.`);
  }
  if (!Array.isArray(out.generados) || !out.generados.every((g) => typeof g === 'string')) throw new MapError(`${CONFIG_FILE}: "generados" debe ser una lista de rutas.`);
  return out;
}

function patternRegex(pat) {
  let re = '';
  for (let i = 0; i < pat.length;) {
    if (pat.startsWith('**/', i)) {
      re += '(?:.*/)?';
      i += 3;
    } else if (pat.startsWith('**', i)) {
      re += '.*';
      i += 2;
    } else if (pat[i] === '*') {
      re += '[^/]*';
      i += 1;
    } else {
      re += pat[i].replace(/[.+?^${}()|[\]\\]/g, '\\$&');
      i += 1;
    }
  }
  return new RegExp(`^${re}$`);
}

/** Propósitos de la configuración: ruta exacta o patrón con `*` (un nivel) y `**` (varios); gana el primero que coincida. */
function purposeMatchers(propositos) {
  return Object.entries(propositos).map(([key, text]) => ({ key, text, exact: !key.includes('*'), re: key.includes('*') ? patternRegex(key) : null }));
}
const configPurpose = (rel, matchers) => matchers.find((m) => (m.exact ? m.key === rel : m.re.test(rel)))?.text ?? null;

// ───────────────────────── análisis de un archivo ─────────────────────────
const extOf = (rel) => {
  const base = rel.slice(rel.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? '' : base.slice(dot).toLowerCase();
};
const areaOf = (rel) => (rel.includes('/') ? rel.slice(0, rel.indexOf('/')) : ROOT_AREA);
const oneLine = (s, max = 300) => shorten(s, max);

function groupOf(rel) {
  if (/\.test\.mjs$/.test(rel)) return 'test';
  const ext = extOf(rel);
  if (CODE_EXT.has(ext)) return 'code';
  return DATA_EXT.has(ext) ? 'data' : 'other';
}

/** Referencias locales de un .html (`<script src>`, `<link href>`) o .css (`@import`). */
function localRefs(text, ext) {
  const refs = [];
  if (ext === '.html') {
    const plain = text.replace(/<!--[\s\S]*?-->/g, '');
    for (const m of plain.matchAll(/<script\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) refs.push(m[1] ?? m[2]);
    for (const m of plain.matchAll(/<link\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) refs.push(m[1] ?? m[2]);
  } else {
    const plain = text.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of plain.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)/gi)) refs.push(m[1]);
  }
  return refs.map((r) => r.replace(/[?#].*$/, '')).filter((r) => r !== '' && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(r));
}

/** Resumen de un archivo: tamaño, líneas, propósito, exports, imports, pruebas y JSON según su tipo. */
export function analyzeFile(entry, ctx) {
  const rel = entry.path;
  const group = groupOf(rel);
  const ext = extOf(rel);
  const rec = { path: rel, area: areaOf(rel), group, size: entry.size, generated: ctx.generated.has(rel), binary: isBinary(entry.buf), lines: null, ownPurpose: null, cfgPurpose: configPurpose(rel, ctx.matchers), exports: [], imports: [], tests: 0, json: null, notes: [] };
  const text = rec.binary ? '' : entry.buf.toString('utf8').replace(/\r\n?/g, '\n');
  if (!rec.binary) { rec.lines = lineCount(text); rec.ownPurpose = extractPurpose(text); }
  rec.missingPurpose = requiresPurpose(rel, ctx.cfg) && rec.ownPurpose === null;
  if (group === 'data') rec.json = rec.binary ? { ok: false } : describeJson(text);
  if (group === 'test') rec.tests = countTests(text);
  if (rec.binary || (group !== 'code' && group !== 'test')) return rec;
  if (JS_EXT.has(ext) || group === 'test') {
    try {
      const m = parseModule(text);
      rec.exports = m.exports;
      rec.imports = m.imports.map((i) => i.spec);
    } catch (e) { rec.notes.push(`⚠ no se pudo analizar: ${oneLine(e.message, 60)}`); }
  } else if (ext === '.html' || ext === '.css') {
    const up = '../'.repeat(rel.split('/').length - 1);
    rec.imports = localRefs(text, ext).map((r) => (r.startsWith('/') ? `./${up}${r.slice(1)}` : `./${r}`));
  }
  return rec;
}

// ───────────────────────── firmas y reexportaciones ─────────────────────────
function target(from, spec, fileSet) {
  const r = resolveSpec(from, spec, fileSet);
  return r.bare ? { ext: spec } : r.missing ? { ext: `${r.target} (no existe)` } : { file: r.target };
}

/** Sigue una reexportación hasta su definición (máx. 6 saltos, con guardia contra ciclos). */
function follow(file, name, ctx, seen, hops) {
  const exps = ctx.exportsOf.get(file);
  const key = `${file}\u0000${name}`;
  if (!exps) return { how: 'opaque', file };
  if (seen.has(key)) return { how: 'loop', file };
  seen.add(key);
  const direct = exps.find((e) => e.name === name && e.kind !== 'star');
  if (direct && direct.kind !== 'reexport') return { how: 'found', file, exp: direct };
  const hops1 = hops + 1;
  if (hops1 > MAX_HOPS) return { how: 'deep', file };
  const next = direct ? [{ from: direct.from, name: direct.imported }] : name === 'default' ? [] : exps.filter((e) => e.kind === 'star').map((e) => ({ from: e.from, name }));
  for (const n of next) {
    const t = target(file, n.from, ctx.fileSet);
    if (t.ext) { if (direct) return { how: 'external', spec: t.ext }; continue; }
    const r = follow(t.file, n.name, ctx, seen, hops1);
    if (r.how !== 'unknown') return r;
  }
  return { how: 'unknown', file };
}

/** Texto de cada export para el mapa; las reexportaciones muestran la firma real de su origen. */
function exportTexts(rec, ctx) {
  return rec.exports.map((e) => {
    if (e.kind === 'star' || e.kind === 'namespace') {
      const t = target(rec.path, e.from, ctx.fileSet);
      const where = t.ext ?? t.file;
      return e.kind === 'star' ? `* ← ${where}` : `${e.name} (* ← ${where})`;
    }
    if (e.kind !== 'reexport') return e.signature;
    const t = target(rec.path, e.from, ctx.fileSet);
    if (t.ext) return `${e.name} ← ${t.ext}`;
    const r = follow(t.file, e.imported, ctx, new Set([`${rec.path}\u0000${e.name}`]), 0);
    if (r.how === 'found') return `${r.exp.name === e.name ? '' : `${e.name} = `}${r.exp.signature} ← ${r.file}`;
    if (r.how === 'external') return `${e.name} ← ${r.spec}`;
    return `${e.name} ← ${r.file}${r.how === 'loop' || r.how === 'deep' ? ' (cadena sin resolver)' : ''}`;
  });
}

function importTexts(rec, ctx) {
  const inRepo = new Set();
  const other = new Set();
  for (const spec of rec.imports) {
    const t = target(rec.path, spec, ctx.fileSet);
    if (t.file) inRepo.add(t.file); else other.add(t.ext);
  }
  return [...[...inRepo].sort(byCodeUnit), ...[...other].sort(byCodeUnit)];
}

// ───────────────────────── render del mapa ─────────────────────────
const code = (p) => (p.includes('`') ? `\`\` ${p} \`\`` : `\`${p}\``);
const join = (...parts) => parts.filter((p) => p !== null && p !== undefined && p !== '').join(' · ');

function purposeField(rec) {
  const cfg = rec.cfgPurpose ? `propósito: ${oneLine(rec.cfgPurpose)}` : null;
  if (rec.ownPurpose !== null) return `@purpose: ${oneLine(rec.ownPurpose)}`;
  return rec.missingPurpose ? join('⚠ sin @purpose', cfg) : cfg;
}

function renderCode(rec, ctx) {
  if (rec.binary) return `- ${join(code(rec.path), `${rec.size} B`, 'binario', purposeField(rec))}`;
  const ex = exportTexts(rec, ctx);
  const im = importTexts(rec, ctx);
  return `- ${join(code(rec.path), `${rec.lines} l`, rec.group === 'test' ? `${rec.tests} pruebas` : null, rec.generated ? 'generado' : null, purposeField(rec),
    ex.length ? `exporta: ${ex.join('; ')}` : null, im.length ? `importa: ${im.join(', ')}` : null, ...rec.notes)}`;
}

function jsonField(j) {
  if (!j.ok) return '⚠ JSON inválido';
  if (j.kind === 'array') return `lista de ${j.length}`;
  if (j.kind === 'scalar') return 'valor simple';
  return `claves: ${j.keys.slice(0, MAX_KEYS).join(', ')}${j.keys.length > MAX_KEYS ? `, … (${j.keys.length} en total)` : ''}`;
}

function renderData(rec) {
  const purpose = rec.cfgPurpose ? `propósito: ${oneLine(rec.cfgPurpose)}` : null;
  return `- ${join(code(rec.path), `${rec.size} B`, jsonField(rec.json), rec.generated ? 'generado' : null, purpose)}`;
}

function renderOther(rec) {
  const shape = rec.binary ? 'binario' : rec.size === 0 ? 'vacío' : `${rec.lines} l`;
  return `- ${join(code(rec.path), `${rec.size} B`, shape, rec.generated ? 'generado' : null, rec.cfgPurpose ? `propósito: ${oneLine(rec.cfgPurpose)}` : null)}`;
}

function areaStats(recs) {
  const codeish = recs.filter((r) => r.group === 'code' || r.group === 'test');
  return {
    files: recs.length,
    codeLines: codeish.reduce((n, r) => n + (r.lines ?? 0), 0),
    tests: recs.reduce((n, r) => n + r.tests, 0),
    missing: recs.filter((r) => r.missingPurpose).length,
    broken: recs.filter((r) => (r.json && !r.json.ok) || r.notes.length > 0).length,
  };
}

const NOTICE = [
  '> Generado por `npm run map` (`tools/repo-map.mjs`). **No edites a mano nada fuera de los bloques manuales:** se regenera. Los bloques manuales van entre `<!-- MANUAL:inicio:nombre -->` y `<!-- MANUAL:fin:nombre -->` y se conservan tal cual.',
  '> Comprobación (< 2 s): `npm run map -- --check` imprime `OK <tree-hash>` o lista los archivos creados, modificados y eliminados. Si el mapa se equivoca, corrige la línea y anótalo en el Delta como «Mapa corregido».',
  '>',
  '> **Leyenda.** Campos separados por « · »: `N l` = líneas, `N B` = bytes. `exporta:` separa las firmas con «; » porque los parámetros ya llevan comas: `nombre(params)`, `async nombre(params)`, `nombre*(params)` (generadora), `class X extends Y, constructor(a, b) {m(), static s(), get g}`, `NOMBRE = valor` (valor abreviado), `default = …`.',
  '> Reexportaciones: `firma ← ruta` (la firma real está en la ruta de origen), `alias = firma ← ruta` si se renombró, `* ← ruta` si reexporta todo. `importa:` muestra rutas del repo, `node:…` o URL; «(no existe)» = el destino no está en el repo. `⚠` = algo que revisar (sin `@purpose`, JSON inválido, archivo sin analizar).',
];

function renderArea(name, recs, cfg, ctx) {
  const st = areaStats(recs);
  const out = [`## Área: ${name}`, ''];
  if (cfg.areas[name]) out.push(`> ${oneLine(cfg.areas[name], 400)}`, '');
  out.push(`${st.files} archivos · ${st.codeLines} líneas de código`, '');
  const groups = [['code', 'Código', renderCode], ['test', 'Pruebas', renderCode], ['data', 'Datos (JSON)', renderData], ['other', 'Otros archivos', renderOther]];
  for (const [g, title, fn] of groups) {
    const list = recs.filter((r) => r.group === g);
    if (list.length === 0) continue;
    out.push(`### ${title}`, '');
    if (g === 'test') out.push('_«N pruebas» es un conteo estático de `test()` e `it()`; las pruebas generadas en bucles suman más al ejecutarse._', '');
    for (const r of list) out.push(fn(r, ctx));
    out.push('');
  }
  return out;
}

/** Texto completo del mapa. `blocks`: Map de bloques manuales de un mapa anterior (o vacío). */
export function renderMap({ records, cfg, blocks, hash, ctx }) {
  const out = [`<!-- repo-map: formato=${FORMAT} tree-hash=${hash} archivos=${records.length} -->`, '# Mapa del repositorio', '', ...NOTICE, ''];
  for (const b of MANUAL_BLOCKS) out.push(`## ${b.title}`, `<!-- MANUAL:inicio:${b.name} -->`, ...(blocks.get(b.name) ?? b.body), `<!-- MANUAL:fin:${b.name} -->`, '');
  for (const [name, lines] of blocks) {
    if (!KNOWN_BLOCKS.has(name)) out.push(`## Manual: ${name}`, `<!-- MANUAL:inicio:${name} -->`, ...lines, `<!-- MANUAL:fin:${name} -->`, '');
  }
  const areas = [...new Set(records.map((r) => r.area))].sort((a, b) => (a === ROOT_AREA ? -1 : b === ROOT_AREA ? 1 : byCodeUnit(a, b)));
  const perArea = new Map(areas.map((a) => [a, records.filter((r) => r.area === a)]));
  out.push('## Índice de áreas', '', '| Área | Archivos | Líneas de código | Descripción |', '|---|---|---|---|');
  for (const a of areas) {
    const st = areaStats(perArea.get(a));
    out.push(`| ${a} | ${st.files} | ${st.codeLines} | ${oneLine(cfg.areas[a] ?? '—', 400).replace(/\|/g, '\\|')} |`);
  }
  const t = areaStats(records);
  out.push('', '## Totales', '', `- Archivos: ${t.files} en ${areas.length} áreas.`, `- Líneas de código (código y pruebas): ${t.codeLines}.`,
    `- Pruebas (conteo estático de \`test()\` e \`it()\`): ${t.tests}.`, `- Sin \`@purpose\` (obligatorio): ${t.missing}.`);
  if (t.broken > 0) out.push(`- Con aviso ⚠ (JSON inválido o sin analizar): ${t.broken}.`);
  out.push('');
  for (const a of areas) out.push(...renderArea(a, perArea.get(a), cfg, ctx));
  while (out[out.length - 1] === '') out.pop();
  return `${out.join('\n')}\n`;
}

/** Analiza todos los archivos y arma el texto del mapa. Devuelve también los avisos de la configuración. */
export function buildMapText(entries, cfg, oldBlocks = new Map()) {
  const fileSet = new Set(entries.map((e) => e.path));
  const ctx = { cfg, fileSet, generated: new Set(cfg.generados), matchers: purposeMatchers(cfg.propositos), exportsOf: new Map() };
  const records = entries.map((e) => analyzeFile(e, ctx));
  for (const r of records) if (JS_EXT.has(extOf(r.path)) || r.group === 'test') ctx.exportsOf.set(r.path, r.exports);
  const warnings = [];
  for (const m of ctx.matchers) if (m.exact && !fileSet.has(m.key)) warnings.push(`Configuración: «${m.key}» (propositos) no coincide con ningún archivo.`);
  for (const g of cfg.generados) if (!fileSet.has(g)) warnings.push(`Configuración: «${g}» (generados) no coincide con ningún archivo.`);
  const areas = new Set(records.map((r) => r.area));
  for (const a of areas) if (!cfg.areas[a]) warnings.push(`Configuración: el área «${a}» no tiene descripción.`);
  for (const a of Object.keys(cfg.areas)) if (!areas.has(a)) warnings.push(`Configuración: el área «${a}» no tiene archivos.`);
  for (const name of oldBlocks.keys()) if (!KNOWN_BLOCKS.has(name)) warnings.push(`Bloque manual desconocido «${name}»: se conserva en «## Manual: ${name}».`);
  const hash = treeHash(entries);
  const text = renderMap({ records, cfg, blocks: oldBlocks, hash, ctx });
  return { text, hash, records, warnings, missingPurpose: records.filter((r) => r.missingPurpose).length };
}

// ───────────────────────── entrada/salida ─────────────────────────
function readIfExists(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw new MapError(`No se pudo leer ${file}: ${e.message}`);
  }
}

function writeIfChanged(file, content) {
  if (readIfExists(file) === content) return false;
  const tmp = `${file}.tmp-${process.pid}`;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }); } catch (cleanup) { process.stderr.write(`No se pudo borrar ${tmp}: ${cleanup.message}\n`); }
    throw new MapError(`No se pudo escribir ${file}: ${e.message}`);
  }
  return true;
}

/** Rutas del mapa y de las huellas, y qué excluir del recorrido (siempre el mapa y las huellas del propio repo). */
function locations(root, outArg) {
  const out = path.resolve(outArg ?? path.join(root, MAP_FILE));
  const hashes = out.replace(/\.md$/i, '') + '.hashes';
  const exclude = new Set([MAP_FILE, HASHES_FILE]);
  for (const f of [out, hashes]) {
    const rel = path.relative(root, f);
    if (rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)) exclude.add(toRepoPath(rel));
  }
  return { out, hashes, exclude: [...exclude] };
}

/** Regenera el mapa y las huellas. No toca nada si hay marcas manuales mal formadas. */
export function generate({ root, out: outArg }) {
  const loc = locations(root, outArg);
  const cfg = loadConfig(root);
  const old = readIfExists(loc.out);
  const blocks = old === null ? new Map() : parseManual(old);
  const entries = snapshot(root, { exclude: loc.exclude });
  const built = buildMapText(entries, cfg, blocks);
  const hashesChanged = writeIfChanged(loc.hashes, hashLines(entries));
  const mapChanged = writeIfChanged(loc.out, built.text);
  return { changed: mapChanged || hashesChanged, hash: built.hash, files: entries.length, warnings: built.warnings, missingPurpose: built.missingPurpose, out: loc.out };
}

/** Compara el tree-hash actual con la cabecera del mapa; si difiere, lista creados, modificados y eliminados. */
export function checkMap({ root, out: outArg }) {
  const loc = locations(root, outArg);
  const entries = snapshot(root, { exclude: loc.exclude });
  const hash = treeHash(entries);
  const mapText = readIfExists(loc.out);
  if (mapText === null) return { ok: false, hash, problem: `No existe el mapa (${path.relative(root, loc.out) || loc.out}). Ejecuta npm run map.` };
  const head = parseHeader(mapText);
  if (!head || head.formato !== FORMAT) return { ok: false, hash, problem: 'La cabecera del mapa es ilegible o de otro formato. Ejecuta npm run map.' };
  if (head.hash === hash) return { ok: true, hash };
  const hashesText = readIfExists(loc.hashes);
  if (hashesText === null) return { ok: false, hash, problem: `El mapa está desactualizado y falta ${path.basename(loc.hashes)} para listar los cambios. Ejecuta npm run map.` };
  if (treeHash(hashesText) !== head.hash) return { ok: false, hash, problem: `${path.basename(loc.hashes)} no corresponde a la cabecera del mapa. Ejecuta npm run map.` };
  return { ok: false, hash, diff: diffTrees(parseHashLines(hashesText), entries) };
}

// ───────────────────────── línea de comandos ─────────────────────────
const USAGE = 'Uso: node tools/repo-map.mjs [--check] [--root <carpeta>] [--out <archivo>]\n';

export function parseArgs(argv) {
  const opts = { check: false, root: null, out: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const eq = /^--(root|out)=(.*)$/.exec(a);
    if (a === '--check') opts.check = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (eq) opts[eq[1]] = eq[2];
    else if (a === '--root' || a === '--out') {
      if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) throw new MapError(`Falta el valor de ${a}.`);
      opts[a.slice(2)] = argv[i + 1];
      i += 1;
    } else throw new MapError(`Opción desconocida: ${a}`);
  }
  return opts;
}

const defaultIo = { out: (s) => process.stdout.write(s), err: (s) => process.stderr.write(s) };

function printDrift(diff, io) {
  const rows = [...diff.created.map((p) => `+ ${p} (creado)`), ...diff.modified.map((p) => `~ ${p} (modificado)`), ...diff.deleted.map((p) => `- ${p} (eliminado)`)];
  io.out(`${rows.slice(0, MAX_LISTED).join('\n')}\n`);
  if (rows.length > MAX_LISTED) io.out(`… y ${rows.length - MAX_LISTED} más\n`);
  io.err(`El mapa está desactualizado: ${diff.created.length} creados, ${diff.modified.length} modificados, ${diff.deleted.length} eliminados. Ejecuta npm run map.\n`);
}

/** Punto de entrada: devuelve el código de salida (0, 1 o 2). */
export function main(argv, io = defaultIo) {
  try {
    const opts = parseArgs(argv);
    if (opts.help) { io.out(USAGE); return 0; }
    const root = path.resolve(opts.root ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new MapError(`La carpeta raíz no existe: ${root}`);
    if (opts.check) {
      const r = checkMap({ root, out: opts.out });
      if (r.ok) { io.out(`OK ${r.hash}\n`); return 0; }
      if (r.problem) io.err(`${r.problem}\n`); else printDrift(r.diff, io);
      return 1;
    }
    const r = generate({ root, out: opts.out });
    for (const w of r.warnings) io.err(`Aviso: ${w}\n`);
    io.out(`${r.changed ? 'Mapa regenerado' : 'Mapa sin cambios'}: ${r.files} archivos · tree-hash ${r.hash.slice(0, 12)}\n`);
    if (r.missingPurpose > 0) io.out(`${r.missingPurpose} archivos de código sin @purpose (marcados con ⚠ en el mapa).\n`);
    return 0;
  } catch (e) {
    io.err(`${e instanceof MapError ? '' : 'Error: '}${e.message}\n`);
    if (e instanceof MapError && /^(Opción desconocida|Falta el valor)/.test(e.message)) io.err(USAGE);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
