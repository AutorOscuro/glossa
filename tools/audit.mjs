// @purpose: Auditoría estática del repo: patrones prohibidos, archivos demasiado largos e imports rotos; sale con 1 si hay hallazgos.
// Auditoría estática del repo (roadmap 4.3 pasada 1 y subparte 0.2).
// Uso:  node tools/audit.mjs [raíz]     → código de salida 1 si hay hallazgos.
// Como módulo: import { audit } from './audit.mjs';  audit(root) → { findings, filesScanned }
//   finding = { file, line, rule, message }
//
// Qué revisa:
//  - patrones prohibidos en código (.js .mjs .cjs .html): evaluación dinámica, escritura directa al documento,
//    asignación de HTML con datos variables, registros de consola de depuración, parada del depurador,
//    almacenamiento local fuera de lista blanca, marcas de pendiente sin ID de subparte;
//  - claves con forma real (gsk_, sk-, AIza, AKIA) en TODOS los archivos de texto (incluida docs/);
//  - archivos de código con más de MAX_LINES líneas;
//  - imports relativos que no resuelven a un archivo, o que piden un nombre que el destino no exporta;
//  - JSON inválido e IDs duplicados en content/;
//  - convención de la 0.9: todo .js .mjs .cjs .css y .html (salvo vendor/ y los `generados` de tools/repo-map.config.json)
//    lleva un comentario `@purpose: <para qué sirve>` en sus primeras 12 líneas (regla PURPOSE_FALTA, la misma que usa el mapa).
// Excepciones: `docs/` (documentación que cita los patrones como texto) y `vendor/` (terceros) no pasan
// por los patrones de código ni por el límite de líneas; sí por claves y por JSON.
// Nota: las expresiones se arman con join() para que este archivo no se marque a sí mismo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extractPurpose, requiresPurpose } from './repoMapParse.mjs';

export const MAX_LINES = 800;
// Rutas relativas (con "/") que pueden usar almacenamiento local del navegador (solo banderas triviales de UI).
export const LOCAL_STORAGE_ALLOW = [];

const w = (...parts) => parts.join('');
const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.json', '.md', '.webmanifest', '.txt', '.yml', '.yaml']);
const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.html']);
const SIZE_EXT = new Set(['.js', '.mjs', '.cjs', '.html', '.css']);
const SKIP_DIRS = new Set(['.git', 'node_modules']);

const LINE_RULES = [
  { rule: 'EVAL', re: new RegExp(w('(^|[^\\w.$])', 'ev', 'al', '\\s*\\(')), message: 'Función de evaluación dinámica de texto: prohibida.' },
  { rule: 'NEW_FUNCTION', re: new RegExp(w('\\bnew\\s+', 'Func', 'tion\\b')), message: 'Construcción de funciones desde texto: prohibida.' },
  { rule: 'DOCUMENT_WRITE', re: new RegExp(w('\\bdocument\\.wri', 'te(?:ln)?\\s*\\(')), message: 'Escritura directa al documento: prohibida.' },
  { rule: 'CONSOLE_LOG', re: new RegExp(w('\\bconsole\\.l', 'og\\b')), message: 'Registro de consola de ruido; usa console.error para errores reales.' },
  { rule: 'DEBUGGER', re: new RegExp(w('\\bdebug', 'ger\\b')), message: 'Parada del depurador olvidada.' },
  { rule: 'TODO_SIN_ID', re: new RegExp(w('\\b(TO', 'DO|FIX', 'ME)\\b(?!\\(\\s*(?:\\d+\\.\\d+|C\\d+)\\s*\\))')), message: 'Marca de pendiente sin ID de subparte; usa el formato MARCA(2.3).' },
];
const LOCAL_STORAGE_RE = new RegExp(w('\\blocal', 'Storage\\b'));

const KEY_RULES = [
  { name: 'gsk_', re: /(?<![A-Za-z0-9_])gsk_[A-Za-z0-9]{20,}/ },
  { name: 'sk-', re: /(?<![A-Za-z0-9_])sk-[A-Za-z0-9_-]{20,}/ },
  { name: 'AIza', re: /(?<![A-Za-z0-9_])AIza[0-9A-Za-z_-]{30,}/ },
  { name: 'AKIA', re: /(?<![A-Za-z0-9_])AKIA[0-9A-Z]{16}/ },
];

const HTML_ASSIGN_RE = new RegExp(w('\\.(?:inner', 'HTML|outer', 'HTML)\\s*(\\+?=)(?!=)\\s*(.*)$'));
const HTML_INSERT_RE = new RegExp(w('insertAdjacent', 'HTML\\s*\\((.*)$'));
const CONST_STRING_RE = /^(?:(['"])(?:\\.|(?!\1)[^\\])*\1|`[^`$\\]*`)\s*;?\s*(?:\/\/.*)?$/;

function toPosix(p) { return p.split(path.sep).join('/'); }

function walk(root) {
  const out = [];
  (function rec(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) rec(full); }
      else if (e.isFile()) out.push(toPosix(path.relative(root, full)));
    }
  })(root);
  return out;
}

// Archivos generados (sin @purpose) según tools/repo-map.config.json. Sin configuración legible no hay ninguno.
function generatedOf(root) {
  try {
    const list = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'repo-map.config.json'), 'utf8'))?.generados;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function lineOf(text, index) {
  let n = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) n += 1;
  return n;
}

function exportsOf(text) {
  const names = new Set();
  let wildcard = false;
  for (const m of text.matchAll(/^[ \t]*export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of text.matchAll(/^[ \t]*export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(',')) {
      const p = part.trim();
      if (p) names.add(p.includes(' as ') ? p.split(/\s+as\s+/)[1].trim() : p);
    }
  }
  for (const m of text.matchAll(/^[ \t]*export\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from/gm)) names.add(m[1]);
  if (/^[ \t]*export\s+\*\s+from/m.test(text)) wildcard = true;
  if (/^[ \t]*export\s+default\b/m.test(text)) names.add('default');
  return { names, wildcard };
}

function importedNames(clause) {
  const names = [];
  const c = clause.trim();
  if (c.startsWith('*')) return names; // import * as ns / export * from
  const brace = c.match(/\{([^}]*)\}/);
  const head = brace ? c.slice(0, brace.index).replace(/,\s*$/, '').trim() : c;
  if (head) names.push('default');
  if (brace) {
    for (const part of brace[1].split(',')) {
      const p = part.trim();
      if (p) names.push(p.split(/\s+as\s+/)[0].trim());
    }
  }
  return names;
}

function checkImports(root, rel, text, findings) {
  const specs = [];
  for (const m of text.matchAll(/^[ \t]*(import|export)\s+((?:type\s+)?[\w$*\s,{}]+?)\s+from\s+['"]([^'"]+)['"]/gm)) {
    specs.push({ spec: m[3], clause: m[2], index: m.index });
  }
  for (const m of text.matchAll(/^[ \t]*import\s+['"]([^'"]+)['"]/gm)) specs.push({ spec: m[1], clause: '', index: m.index });
  for (const m of text.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) specs.push({ spec: m[1], clause: '', index: m.index });
  for (const { spec, clause, index } of specs) {
    if (!spec.startsWith('.')) continue;
    const line = lineOf(text, index);
    const target = path.resolve(root, path.dirname(rel), spec);
    const inside = toPosix(path.relative(root, target));
    let isFile = false;
    try { isFile = fs.statSync(target).isFile(); } catch { isFile = false; }
    if (inside.startsWith('..') || !isFile) {
      findings.push({ file: rel, line, rule: 'IMPORT_ROTO', message: `El import '${spec}' no apunta a un archivo existente (¿falta la extensión?).` });
      continue;
    }
    if (!/\.(m?js|cjs)$/.test(target)) continue;
    const wanted = importedNames(clause);
    if (wanted.length === 0) continue;
    const { names, wildcard } = exportsOf(fs.readFileSync(target, 'utf8'));
    if (wildcard) continue;
    for (const n of wanted) {
      if (!names.has(n)) findings.push({ file: rel, line, rule: 'IMPORT_SIN_EXPORT', message: `'${spec}' no exporta '${n}'.` });
    }
  }
}

function checkCodeLines(rel, lines, findings) {
  lines.forEach((l, i) => {
    const line = i + 1;
    for (const r of LINE_RULES) if (r.re.test(l)) findings.push({ file: rel, line, rule: r.rule, message: r.message });
    if (LOCAL_STORAGE_RE.test(l) && !LOCAL_STORAGE_ALLOW.includes(rel)) {
      findings.push({ file: rel, line, rule: 'LOCAL_STORAGE', message: 'Almacenamiento local del navegador fuera de la lista blanca; los datos van a IndexedDB (core/db.js).' });
    }
    const a = l.match(HTML_ASSIGN_RE);
    if (a && !CONST_STRING_RE.test(a[2].trim())) {
      findings.push({ file: rel, line, rule: 'HTML_INTERPOLADO', message: 'Asignación de HTML que no es una cadena constante; usa h() o textContent (ui/dom.js).' });
    }
    const ins = l.match(HTML_INSERT_RE);
    if (ins && !/^\s*['"][a-z]+['"]\s*,\s*(['"])(?:\\.|(?!\1)[^\\])*\1\s*\)/.test(ins[1])) {
      findings.push({ file: rel, line, rule: 'HTML_INTERPOLADO', message: 'Inserción de HTML que no es una cadena constante; usa h() o textContent (ui/dom.js).' });
    }
  });
}

function collectIds(data, rel, ids, findings) {
  const groups = [];
  if (Array.isArray(data)) groups.push(['topics', data]);
  else if (data && typeof data === 'object') {
    for (const k of ['topics', 'items', 'lexicon', 'stories']) if (Array.isArray(data[k])) groups.push([k, data[k]]);
  }
  for (const [kind, arr] of groups) {
    for (const el of arr) {
      if (!el || typeof el !== 'object' || typeof el.id !== 'string') continue;
      const key = `${kind}\u0000${el.id}`;
      if (ids.has(key)) {
        findings.push({ file: rel, line: 0, rule: 'ID_DUPLICADO', message: `ID duplicado '${el.id}' (${kind}); ya existe en ${ids.get(key)}.` });
      } else ids.set(key, rel);
    }
  }
}

export function audit(root) {
  const findings = [];
  if (typeof root !== 'string' || root === '' || !fs.existsSync(root)) {
    return { findings: [{ file: String(root), line: 0, rule: 'RAIZ', message: 'La carpeta raíz no existe.' }], filesScanned: 0 };
  }
  const ids = new Map();
  const purposeCfg = { generados: generatedOf(root) };
  let filesScanned = 0;
  for (const rel of walk(root)) {
    const ext = path.extname(rel).toLowerCase();
    if (!TEXT_EXT.has(ext)) continue;
    let text;
    try { text = fs.readFileSync(path.join(root, rel), 'utf8'); } catch (e) {
      findings.push({ file: rel, line: 0, rule: 'LECTURA', message: `No se pudo leer el archivo: ${e.message}` });
      continue;
    }
    filesScanned += 1;
    const isDocs = rel.startsWith('docs/');
    const isVendor = rel.startsWith('vendor/');
    const lines = text.split('\n');
    lines.forEach((l, i) => {
      for (const k of KEY_RULES) {
        if (k.re.test(l)) findings.push({ file: rel, line: i + 1, rule: 'CLAVE', message: `Posible clave de API con forma ${k.name}…; las claves no van en el repo.` });
      }
    });
    if (ext === '.json' || ext === '.webmanifest') {
      try {
        const data = JSON.parse(text);
        if (rel.startsWith('content/') && path.basename(rel) !== 'index.json') collectIds(data, rel, ids, findings);
      } catch (e) {
        findings.push({ file: rel, line: 0, rule: 'JSON_INVALIDO', message: `JSON inválido: ${e.message}` });
      }
    }
    if (requiresPurpose(rel, purposeCfg) && extractPurpose(text) === null) {
      findings.push({ file: rel, line: 0, rule: 'PURPOSE_FALTA', message: 'Falta el comentario @purpose: <para qué sirve> en las primeras 12 líneas (convención de la 0.9).' });
    }
    if (isDocs || isVendor) continue;
    if (SIZE_EXT.has(ext)) {
      const n = lines.length - (lines[lines.length - 1] === '' ? 1 : 0);
      if (n > MAX_LINES) findings.push({ file: rel, line: 0, rule: 'ARCHIVO_LARGO', message: `Tiene ${n} líneas (máximo ${MAX_LINES}); pártelo.` });
    }
    if (CODE_EXT.has(ext)) {
      checkCodeLines(rel, lines, findings);
      checkImports(root, rel, text, findings);
    }
  }
  findings.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line || (a.rule < b.rule ? -1 : 1)));
  return { findings, filesScanned };
}

function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(process.argv[2] ?? path.join(here, '..'));
  const { findings, filesScanned } = audit(root);
  if (findings.length === 0) {
    process.stdout.write(`✔ Auditoría: 0 hallazgos (${filesScanned} archivos revisados).\n`);
    return 0;
  }
  process.stderr.write(`✘ Auditoría: ${findings.length} hallazgo(s) en ${filesScanned} archivos revisados:\n`);
  for (const f of findings) {
    process.stderr.write(`  ${f.file}${f.line ? `:${f.line}` : ''}  [${f.rule}] ${f.message}\n`);
  }
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main();
}
