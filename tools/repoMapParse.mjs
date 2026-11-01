// @purpose: Analizadores del mapa del repositorio: máscara de comentarios y cadenas, exports con firma, imports, @purpose, pruebas y JSON (0.9-T1).
// Solo texto → datos (sin DOM ni E/S): se prueba con Node. Límites conocidos y aceptados:
//  - JavaScript estándar (sin TypeScript ni JSX);
//  - una «/» después de «)», «]» o «}» se toma como división (nunca como expresión regular);
//  - el fin de una declaración sin «;» se decide por una heurística de saltos de línea (línea siguiente en columna 0).
//  - una expresión regular de más de 2000 caracteres se toma como división, y las plantillas con «${ }» anidadas a más de 100 niveles se tratan como texto (guardas contra recorridos cuadráticos y desbordes de pila).
// El oráculo contra los módulos reales de core/ vive en tests/repoMap.real.test.mjs.

const WS = /\s/;
const isIdStart = (c) => c !== undefined && /[\p{L}_$]/u.test(c);
const isIdPart = (c) => c !== undefined && /[\p{L}\p{N}_$]/u.test(c);
const keepNewline = (c) => (c === '\n' || c === '\r' ? c : ' ');
const REGEX_AFTER_WORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
const MAX_PARAMS = 160;
const MAX_KEYS = 10;
const MAX_NEST = 100; // plantillas con «${ }» anidadas: más allá se tratan como texto (evita desbordar la pila)
const MAX_REGEX = 2000; // una expresión regular más larga se toma como división (evita recorridos cuadráticos)
const CONTINUATION = new Set([...'=,([{+-*/%&|^!~?:<>.']);

/** Colapsa espacios y recorta con «…» (salida estable y de una sola línea). */
export function shorten(text, max) {
  const s = String(text).replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Enmascara comentarios, cadenas, plantillas y expresiones regulares sin cambiar longitudes ni saltos de línea.
 * `code`: sin comentarios y con el interior de las cadenas en blanco (las comillas se conservan), para seguir la estructura.
 * `clean`: solo sin comentarios (las cadenas se conservan), para mostrar firmas.
 */
export function maskSource(src) {
  const n = src.length;
  const code = src.split('');
  const clean = src.split('');
  const blank = (arr, a, b) => { for (let k = a; k < b; k += 1) arr[k] = keepNewline(src[k]); };
  let prevCh = '';
  let prevPrev = '';
  let prevWord = '';
  let nest = 0;
  const setPrev = (ch, word = '') => { prevPrev = prevCh; prevCh = ch; prevWord = word; };

  const regexAllowed = () => {
    if (prevCh === '') return true;
    if (prevCh === 'a') return REGEX_AFTER_WORDS.has(prevWord);
    if (prevCh === '0' || prevCh === '"') return false;
    if (prevCh === ')' || prevCh === ']' || prevCh === '}') return false;
    if (prevCh === '+' || prevCh === '-') return prevPrev !== prevCh;
    return true;
  };

  function endOfString(i) {
    const q = src[i];
    let k = i + 1;
    while (k < n) {
      const c = src[k];
      if (c === '\\') { k += 2; continue; }
      if (c === q) return k + 1;
      if (c === '\n') return k;
      k += 1;
    }
    return n;
  }

  function endOfRegex(i) {
    let k = i + 1;
    let inClass = false;
    while (k < n) {
      const c = src[k];
      if (c === '\n' || k - i > MAX_REGEX) return -1;
      if (c === '\\') { k += 2; continue; }
      if (inClass) { if (c === ']') inClass = false; } else if (c === '[') inClass = true;
      else if (c === '/') {
        k += 1;
        while (k < n && /[a-z]/i.test(src[k])) k += 1;
        return k;
      }
      k += 1;
    }
    return -1;
  }

  function scan(start, inExpr) {
    let i = start;
    let braces = 0;
    while (i < n) {
      const ch = src[i];
      const nx = src[i + 1];
      if (ch === '/' && nx === '/') {
        let j = src.indexOf('\n', i);
        if (j < 0) j = n;
        blank(code, i, j); blank(clean, i, j); i = j; continue;
      }
      if (ch === '/' && nx === '*') {
        let j = src.indexOf('*/', i + 2);
        j = j < 0 ? n : j + 2;
        blank(code, i, j); blank(clean, i, j); i = j; continue;
      }
      if (ch === '"' || ch === "'") {
        const j = endOfString(i);
        const closed = j - 1 > i && src[j - 1] === ch;
        blank(code, i + 1, closed ? j - 1 : j);
        setPrev('"'); i = j; continue;
      }
      if (ch === '`') {
        let k = i + 1;
        let closedAt = -1;
        while (k < n) {
          const c = src[k];
          if (c === '\\') { k += 2; continue; }
          if (c === '`') { closedAt = k; break; }
          if (c === '$' && src[k + 1] === '{') {
            if (nest >= MAX_NEST) { k += 2; continue; }
            setPrev('(');
            nest += 1;
            k = scan(k + 2, true);
            nest -= 1;
            continue;
          }
          k += 1;
        }
        blank(code, i + 1, closedAt < 0 ? n : closedAt);
        setPrev('"'); i = closedAt < 0 ? n : closedAt + 1; continue;
      }
      if (ch === '/') {
        if (regexAllowed()) {
          const j = endOfRegex(i);
          if (j > 0) { blank(code, i, j); setPrev('"'); i = j; continue; }
        }
        setPrev('/'); i += 1; continue;
      }
      if (inExpr) {
        if (ch === '{') braces += 1;
        else if (ch === '}') { if (braces === 0) return i + 1; braces -= 1; }
      }
      if (isIdStart(ch)) {
        let j = i + 1;
        while (j < n && isIdPart(src[j])) j += 1;
        setPrev('a', src.slice(i, j)); i = j; continue;
      }
      if (ch >= '0' && ch <= '9') {
        let j = i + 1;
        while (j < n && /[\w.]/.test(src[j])) j += 1;
        setPrev('0'); i = j; continue;
      }
      if (!WS.test(ch)) setPrev(ch);
      i += 1;
    }
    return n;
  }

  scan(0, false);
  return { code: code.join(''), clean: clean.join('') };
}

function depthMap(code) {
  const depth = new Int32Array(code.length);
  let d = 0;
  for (let i = 0; i < code.length; i += 1) {
    depth[i] = d;
    const c = code[i];
    if (c === '{' || c === '(' || c === '[') d += 1;
    else if ((c === '}' || c === ')' || c === ']') && d > 0) d -= 1;
  }
  return depth;
}

function matchClose(code, open) {
  let d = 0;
  for (let k = open; k < code.length; k += 1) {
    const c = code[k];
    if (c === '{' || c === '(' || c === '[') d += 1;
    else if (c === '}' || c === ')' || c === ']') { d -= 1; if (d === 0) return k; }
  }
  return -1;
}

function prevSigChar(code, i) {
  let k = i - 1;
  while (k >= 0 && WS.test(code[k])) k -= 1;
  return k >= 0 ? code[k] : '';
}

function atLineStart(code, i) {
  let k = i - 1;
  while (k >= 0 && (code[k] === ' ' || code[k] === '\t')) k -= 1;
  return k < 0 || code[k] === '\n';
}

function isStatementStart(code, i) {
  const p = prevSigChar(code, i);
  if (p === '' || p === ';' || p === '}') return true;
  if (CONTINUATION.has(p)) return false;
  return atLineStart(code, i);
}

/** ¿Empieza una sentencia nueva en la línea siguiente (columna 0, no continuación)? */
function breakAhead(code, k) {
  let j = k;
  while (j < code.length && WS.test(code[j])) j += 1;
  if (j >= code.length) return true;
  if (!(j === 0 || code[j - 1] === '\n') || !/[\p{L}_$@]/u.test(code[j])) return false;
  const p = prevSigChar(code, k);
  return !CONTINUATION.has(p);
}

/** Fin del inicializador que empieza en `from`: «;» o «,» de profundidad 0, cierre ajeno, o ruptura de línea. */
function initializerEnd(code, from) {
  let d = 0;
  for (let k = from; k < code.length; k += 1) {
    const c = code[k];
    if (c === '{' || c === '(' || c === '[') d += 1;
    else if (c === '}' || c === ')' || c === ']') { if (d === 0) return k; d -= 1; }
    else if (d === 0 && (c === ';' || c === ',')) return k;
    else if (d === 0 && c === '\n' && breakAhead(code, k + 1)) return k;
  }
  return code.length;
}

function splitTop(raw, sep) {
  const parts = [];
  let d = 0;
  let cur = '';
  for (const ch of raw) {
    if ('{[('.includes(ch)) d += 1;
    else if ('}])'.includes(ch)) d -= 1;
    if (ch === sep && d === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

function topLevelIndex(s, ch) {
  let d = 0;
  for (let k = 0; k < s.length; k += 1) {
    const c = s[k];
    if ('{[('.includes(c)) d += 1;
    else if ('}])'.includes(c)) d -= 1;
    else if (c === ch && d === 0) return k;
  }
  return -1;
}

/** Nombres enlazados por un patrón de desestructuración (`{ a, b: c, d = 1, ...r }`). */
function patternNames(raw) {
  const out = [];
  for (let part of splitTop(raw, ',')) {
    part = part.trim().replace(/^\.\.\./, '');
    const eq = topLevelIndex(part, '=');
    if (eq >= 0) part = part.slice(0, eq);
    const colon = topLevelIndex(part, ':');
    if (colon >= 0) part = part.slice(colon + 1);
    part = part.trim();
    if (/^[{[]/.test(part)) out.push(...patternNames(part.slice(1, -1)));
    else if (/^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(part)) out.push(part);
  }
  return out;
}

function normParams(raw) {
  return shorten(raw.replace(/,\s*$/, ''), MAX_PARAMS);
}

/** Texto de firma de un export (una sola línea). */
export function describe(name, info) {
  if (info.kind === 'function') return `${info.async ? 'async ' : ''}${name}${info.generator ? '*' : ''}(${info.params})`;
  if (info.kind === 'class') {
    const ext = info.extendsText ? ` extends ${info.extendsText}` : '';
    const ctor = info.ctor !== null ? `, constructor(${info.ctor})` : '';
    const shown = info.members.slice(0, 12).join(', ') + (info.members.length > 12 ? ', …' : '');
    return `class ${name}${ext}${ctor}${info.members.length ? ` {${shown}}` : ''}`;
  }
  return info.summary ? `${name} ${info.summary}` : name;
}

/**
 * Analiza un módulo ES.
 * @returns {{exports: Array<{name:string, kind:string, signature:string, line:number, from?:string, imported?:string}>,
 *            imports: Array<{spec:string, kind:'static'|'dynamic'|'reexport'}>}}
 */
export function parseModule(src) {
  const { code, clean } = maskSource(src);
  const n = code.length;
  const depth = depthMap(code);
  const newlines = [];
  for (let k = 0; k < n; k += 1) if (src[k] === '\n') newlines.push(k);
  const lineOf = (idx) => {
    let lo = 0;
    let hi = newlines.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (newlines[mid] < idx) lo = mid + 1; else hi = mid; }
    return lo + 1;
  };
  const skipWs = (k) => { let j = k; while (j < n && WS.test(code[j])) j += 1; return j; };
  const wordAt = (k, w) => code.startsWith(w, k) && !isIdPart(code[k + w.length]) && !isIdPart(code[k - 1]);
  const readIdent = (k) => {
    if (!isIdStart(code[k])) return '';
    let j = k + 1;
    while (j < n && isIdPart(code[j])) j += 1;
    return code.slice(k, j);
  };
  const readQuoted = (q) => {
    const e = code.indexOf(code[q], q + 1);
    return { value: src.slice(q + 1, e < 0 ? n : e), end: e < 0 ? n : e + 1 };
  };
  const parseParams = (k) => {
    const c = matchClose(code, k);
    return c < 0 ? null : { params: normParams(clean.slice(k + 1, c)), end: c + 1 };
  };

  function objectKeys(open) {
    const closeIdx = matchClose(code, open);
    if (closeIdx < 0) return [];
    const keys = [];
    let k = open + 1;
    const nextComma = (from) => {
      let d = 0;
      for (let j = from; j < closeIdx; j += 1) {
        const c = code[j];
        if (c === '{' || c === '(' || c === '[') d += 1;
        else if (c === '}' || c === ')' || c === ']') d -= 1;
        else if (c === ',' && d === 0) return j + 1;
      }
      return closeIdx;
    };
    while (k < closeIdx) {
      k = skipWs(k);
      if (k >= closeIdx) break;
      let label = '';
      let j = k;
      if (code.startsWith('...', k)) {
        label = `...${readIdent(k + 3)}`;
      } else {
        for (const m of ['async', 'get', 'set']) {
          if (wordAt(j, m)) {
            const a = skipWs(j + m.length);
            if (/[\p{L}_$"'`[*]/u.test(code[a] ?? '')) j = a;
          }
        }
        if (code[j] === '*') j = skipWs(j + 1);
        if (code[j] === '[') label = '[…]';
        else if (code[j] === '"' || code[j] === "'") label = readQuoted(j).value;
        else label = readIdent(j);
      }
      if (label) keys.push(label);
      k = Math.max(nextComma(j), k + 1);
    }
    return keys;
  }

  function objectSummary(open) {
    const keys = objectKeys(open);
    if (keys.length === 0) return '= {}';
    const shown = keys.slice(0, MAX_KEYS).join(', ');
    return `= { ${shown}${keys.length > MAX_KEYS ? `, … +${keys.length - MAX_KEYS}` : ''} }`;
  }

  function summarizeValue(s, e) {
    const text = code.slice(s, e).trim();
    if (text === '') return null;
    const c0 = code[s];
    if (c0 === '"' || c0 === "'") {
      const q = code.indexOf(c0, s + 1);
      if (q >= 0 && code.slice(q + 1, e).trim() === '') return `= ${c0}${shorten(src.slice(s + 1, q), 40)}${c0}`;
      return null;
    }
    if (c0 === '`') return null;
    if (/^-?\d[\w.]*$/.test(text) || /^(true|false|null|undefined)$/.test(text)) return `= ${text}`;
    if (c0 === '{') return objectSummary(s);
    const frozen = /^Object\.(?:freeze|seal)\s*\(\s*\{/.exec(text);
    if (frozen) return objectSummary(s + frozen[0].length - 1);
    if (c0 === '[') return '= […]';
    const made = /^new\s+([\p{L}_$][\p{L}\p{N}_$.]*)/u.exec(text);
    if (made) return `= new ${made[1]}`;
    const call = /^([\p{L}_$][\p{L}\p{N}_$.]*)\s*\(/u.exec(text);
    if (call && matchClose(code, s + call[0].length - 1) === s + text.length - 1) return `= ${call[1]}(…)`;
    return null;
  }

  function parseFunction(k, isAsync) {
    let p = skipWs(k + 8);
    let generator = false;
    if (code[p] === '*') { generator = true; p = skipWs(p + 1); }
    const name = readIdent(p);
    p = skipWs(p + name.length);
    if (code[p] !== '(') return null;
    const par = parseParams(p);
    if (!par) return null;
    const q = skipWs(par.end);
    let end = par.end;
    if (code[q] === '{') { const c = matchClose(code, q); end = c < 0 ? n : c + 1; }
    return { name, info: { kind: 'function', async: isAsync, generator, params: par.params }, end };
  }

  function classMembers(open, closeIdx) {
    let k = open + 1;
    let ctor = null;
    const members = [];
    const notName = (c) => c === '(' || c === '=' || c === ';' || c === '}';
    while (k < closeIdx) {
      k = skipWs(k);
      if (k >= closeIdx) break;
      if (code[k] === ';') { k += 1; continue; }
      let p = k;
      let isStatic = false;
      let kind = 'method';
      if (wordAt(p, 'static')) {
        const a = skipWs(p + 6);
        if (!notName(code[a])) { isStatic = true; p = a; }
      }
      if (isStatic && code[p] === '{') { const c = matchClose(code, p); k = c < 0 ? closeIdx : c + 1; continue; }
      if (wordAt(p, 'async')) { const a = skipWs(p + 5); if (!notName(code[a])) p = a; }
      if (code[p] === '*') p = skipWs(p + 1);
      for (const w of ['get', 'set']) {
        if (wordAt(p, w)) { const a = skipWs(p + w.length); if (!notName(code[a])) { kind = w; p = a; } }
      }
      let name = '';
      let isPrivate = false;
      if (code[p] === '#') { isPrivate = true; name = `#${readIdent(p + 1)}`; p += name.length; }
      else if (code[p] === '[') { const c = matchClose(code, p); name = '[…]'; p = c < 0 ? closeIdx : c + 1; }
      else if (code[p] === '"' || code[p] === "'") { const q = readQuoted(p); name = q.value; p = q.end; }
      else { name = readIdent(p); p += name.length; }
      p = skipWs(p);
      if (code[p] === '(') {
        const par = parseParams(p);
        if (!par) break;
        const q = skipWs(par.end);
        let endM = par.end;
        if (code[q] === '{') { const c = matchClose(code, q); endM = c < 0 ? closeIdx : c + 1; }
        if (name === 'constructor' && !isStatic) ctor = par.params;
        else if (!isPrivate && name) members.push(`${isStatic ? 'static ' : ''}${kind === 'method' ? `${name}()` : `${kind} ${name}`}`);
        k = Math.max(endM, k + 1);
        continue;
      }
      if (!isPrivate && name) members.push(`${isStatic ? 'static ' : ''}${name}`);
      k = Math.max(initializerEnd(code, p), k + 1);
    }
    return { ctor, members };
  }

  function parseClass(k) {
    let p = skipWs(k + 5);
    let name = '';
    if (!wordAt(p, 'extends')) name = readIdent(p);
    p = skipWs(p + name.length);
    let extendsText = null;
    if (wordAt(p, 'extends')) {
      const from = skipWs(p + 7);
      let d = 0;
      let q = from;
      while (q < n) {
        const c = code[q];
        if (c === '(' || c === '[') d += 1;
        else if (c === ')' || c === ']') d -= 1;
        else if (c === '{' && d === 0) break;
        q += 1;
      }
      extendsText = shorten(clean.slice(from, q), 60);
      p = q;
    }
    if (code[p] !== '{') return null;
    const c = matchClose(code, p);
    if (c < 0) return null;
    const { ctor, members } = classMembers(p, c);
    return { name, info: { kind: 'class', extendsText, ctor, members }, end: c + 1 };
  }

  function describeInitializer(s, e) {
    let p = s;
    let isAsync = false;
    if (wordAt(p, 'async')) {
      const a = skipWs(p + 5);
      const id = readIdent(a);
      if (wordAt(a, 'function') || code[a] === '(' || (id && code.startsWith('=>', skipWs(a + id.length)))) { isAsync = true; p = a; }
    }
    if (wordAt(p, 'function')) { const f = parseFunction(p, isAsync); if (f) return f.info; }
    if (code[p] === '(') {
      const par = parseParams(p);
      if (par && code.startsWith('=>', skipWs(par.end))) return { kind: 'function', async: isAsync, generator: false, params: par.params };
    }
    const id = readIdent(p);
    if (id && code.startsWith('=>', skipWs(p + id.length))) return { kind: 'function', async: isAsync, generator: false, params: id };
    if (wordAt(p, 'class')) { const c = parseClass(p); if (c) return c.info; }
    return { kind: 'value', summary: summarizeValue(s, e) };
  }

  function parseVarDecl(k, kwLen) {
    const items = [];
    let p = skipWs(k + kwLen);
    for (;;) {
      let names = [];
      if (code[p] === '{' || code[p] === '[') {
        const c = matchClose(code, p);
        if (c < 0) break;
        names = patternNames(clean.slice(p + 1, c));
        p = skipWs(c + 1);
      } else {
        const id = readIdent(p);
        if (!id) break;
        names = [id];
        p = skipWs(p + id.length);
      }
      let info = { kind: 'value', summary: null };
      let end = p;
      if (code[p] === '=' && code[p + 1] !== '=') {
        const start = skipWs(p + 1);
        end = initializerEnd(code, start);
        if (names.length === 1) info = describeInitializer(start, end);
      }
      for (const nm of names) items.push({ name: nm, info });
      if (code[end] === ',') { p = skipWs(end + 1); continue; }
      return { items, end: code[end] === ';' ? end + 1 : end };
    }
    return { items, end: p };
  }

  function parseDeclaration(k, word) {
    if (word === 'const' || word === 'let' || word === 'var') return parseVarDecl(k, word.length);
    if (word === 'class') {
      const c = parseClass(k);
      return c ? { items: [{ name: c.name, info: c.info }], end: c.end } : null;
    }
    let p = k;
    let isAsync = false;
    if (word === 'async') {
      p = skipWs(k + 5);
      if (!wordAt(p, 'function')) return null;
      isAsync = true;
    }
    const f = parseFunction(p, isAsync);
    return f ? { items: [{ name: f.name, info: f.info }], end: f.end } : null;
  }

  function parseClause(raw) {
    const out = [];
    const open = raw.indexOf('{');
    const outside = open >= 0 ? raw.slice(0, open) + raw.slice(raw.indexOf('}') + 1) : raw;
    for (const piece of outside.split(',')) {
      const t = piece.trim();
      const star = /^\*\s*as\s+([\p{L}_$][\p{L}\p{N}_$]*)$/u.exec(t);
      if (star) out.push({ local: star[1], imported: '*' });
      else if (/^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(t)) out.push({ local: t, imported: 'default' });
    }
    if (open >= 0) {
      for (const piece of raw.slice(open + 1, raw.indexOf('}')).split(',')) {
        const m = /^\s*([^\s]+)(?:\s+as\s+([^\s]+))?\s*$/.exec(piece);
        if (m) out.push({ local: m[2] ?? m[1], imported: m[1] });
      }
    }
    return out;
  }

  const exportsList = [];
  const importsList = [];
  const decls = new Map();
  const bindings = new Map();
  const unquote = (s) => s.replace(/^["']|["']$/g, '');

  function parseImport(k) {
    const side = /import\s*(['"])/y;
    side.lastIndex = k;
    let m = side.exec(code);
    if (m) { const s = readQuoted(k + m[0].length - 1); return { spec: s.value, end: s.end, list: [] }; }
    const re = /import\b([^;'"`]*?)\bfrom\s*(['"])/y;
    re.lastIndex = k;
    m = re.exec(code);
    if (!m) return null;
    const s = readQuoted(k + m[0].length - 1);
    return { spec: s.value, end: s.end, list: parseClause(code.slice(k + 6, k + 6 + m[1].length)) };
  }

  function addExportDecl(k, word, line) {
    const d = parseDeclaration(k, word);
    if (!d) return k;
    for (const it of d.items) {
      decls.set(it.name, it.info);
      exportsList.push({ name: it.name, kind: it.info.kind, signature: describe(it.name, it.info), line });
    }
    return d.end;
  }

  function parseExportDefault(k, line) {
    let p = skipWs(k + 7);
    const w = wordAt(p, 'async') ? 'async' : wordAt(p, 'function') ? 'function' : wordAt(p, 'class') ? 'class' : '';
    if (w) {
      const d = parseDeclaration(p, w);
      if (d && d.items.length === 1) {
        const { name, info } = d.items[0];
        exportsList.push({ name: 'default', kind: info.kind, signature: name ? `default = ${describe(name, info)}` : describe('default', info), line });
        return d.end;
      }
    }
    const end = initializerEnd(code, p);
    const info = describeInitializer(p, end);
    const summary = info.kind === 'value' ? summarizeValue(p, end) : null;
    let signature;
    if (info.kind !== 'value') signature = describe('default', info);
    else if (summary) signature = `default ${summary}`;
    else signature = `default = ${shorten(clean.slice(p, end), 40)}`;
    exportsList.push({ name: 'default', kind: info.kind, signature, line });
    return code[end] === ';' ? end + 1 : end;
  }

  function parseExportNamed(k, line) {
    const closeIdx = matchClose(code, k);
    if (closeIdx < 0) return n;
    const names = splitTop(clean.slice(k + 1, closeIdx), ',').map((t) => t.trim()).filter(Boolean).map((t) => {
      const m = /^(.+?)\s+as\s+(.+)$/.exec(t);
      return m ? { local: unquote(m[1].trim()), exported: unquote(m[2].trim()) } : { local: unquote(t), exported: unquote(t) };
    });
    let end = closeIdx + 1;
    const a = skipWs(end);
    if (wordAt(a, 'from')) {
      const q = skipWs(a + 4);
      const s = readQuoted(q);
      for (const nm of names) exportsList.push({ name: nm.exported, kind: 'reexport', signature: nm.exported, line, from: s.value, imported: nm.local });
      importsList.push({ spec: s.value, kind: 'reexport' });
      end = s.end;
    } else {
      for (const nm of names) exportsList.push({ name: nm.exported, kind: 'pending', signature: nm.exported, line, local: nm.local });
    }
    return end;
  }

  function parseExportStar(k, line) {
    let p = skipWs(k + 1);
    let alias = '';
    if (wordAt(p, 'as')) { p = skipWs(p + 2); alias = readIdent(p); p = skipWs(p + alias.length); }
    if (!wordAt(p, 'from')) return p;
    const s = readQuoted(skipWs(p + 4));
    exportsList.push(alias
      ? { name: alias, kind: 'namespace', signature: `${alias} (* ← ${s.value})`, line, from: s.value, imported: '*' }
      : { name: '*', kind: 'star', signature: '*', line, from: s.value, imported: '*' });
    importsList.push({ spec: s.value, kind: 'reexport' });
    return s.end;
  }

  function parseExport(i) {
    const line = lineOf(i);
    const k = skipWs(i + 6);
    if (wordAt(k, 'default')) return parseExportDefault(k, line);
    if (code[k] === '{') return parseExportNamed(k, line);
    if (code[k] === '*') return parseExportStar(k, line);
    for (const w of ['async', 'function', 'class', 'const', 'let', 'var']) if (wordAt(k, w)) return addExportDecl(k, w, line);
    return k;
  }

  let consumed = 0;
  const STATEMENT_RE = /(?<![\w$.])(export|import|function|async|class|const|let|var)(?![\w$])/g;
  for (const m of code.matchAll(STATEMENT_RE)) {
    const i = m.index;
    if (i < consumed || depth[i] !== 0 || !isStatementStart(code, i)) continue;
    const w = m[1];
    if (w === 'export') { consumed = parseExport(i); continue; }
    if (w === 'import') {
      const after = skipWs(i + 6);
      if (code[after] === '(' || code[after] === '.') continue;
      const imp = parseImport(i);
      if (imp) {
        importsList.push({ spec: imp.spec, kind: 'static' });
        for (const b of imp.list) bindings.set(b.local, { from: imp.spec, imported: b.imported });
        consumed = imp.end;
      }
      continue;
    }
    const d = parseDeclaration(i, w);
    if (d) { for (const it of d.items) decls.set(it.name, it.info); consumed = d.end; }
  }

  for (const m of code.matchAll(/(?<![\w$.])import\s*\(\s*(['"`])/g)) {
    const s = readQuoted(m.index + m[0].length - 1);
    if (m[1] === '`' && s.value.includes('${')) continue;
    importsList.push({ spec: s.value, kind: 'dynamic' });
  }

  const finalExports = exportsList.map((e) => {
    if (e.kind !== 'pending') return e;
    const info = decls.get(e.local);
    const { local, ...rest } = e;
    if (info) return { ...rest, kind: info.kind, signature: describe(e.name, info) };
    const b = bindings.get(local);
    if (b) return { ...rest, kind: 'reexport', from: b.from, imported: b.imported };
    return { ...rest, kind: 'value' };
  });
  return { exports: finalExports, imports: importsList };
}

export const parseExports = (src) => parseModule(src).exports;
export const parseImports = (src) => parseModule(src).imports;

/** `@purpose: …` en un comentario de las primeras 12 líneas (// , /* , *, <!-- o #). */
export function extractPurpose(src, limit = 12) {
  const re = /(?:\/\/|\/\*+|\*|<!--|#)\s*@purpose:\s*(.*?)\s*(?:\*\/|-->)?\s*$/;
  for (const line of String(src).split('\n', limit)) {
    const m = re.exec(line);
    if (m && m[1].trim() !== '') return m[1].replace(/\s+/g, ' ').trim();
  }
  return null;
}

const PURPOSE_EXT = new Set(['.js', '.mjs', '.cjs', '.css', '.html']);

/** ¿Debe llevar `@purpose`? Código de la app y herramientas, salvo `vendor/` y los generados de la configuración. */
export function requiresPurpose(rel, config = {}) {
  const dot = rel.lastIndexOf('.');
  const ext = dot < 0 ? '' : rel.slice(dot).toLowerCase();
  if (!PURPOSE_EXT.has(ext)) return false;
  if (rel.startsWith('vendor/')) return false;
  return !(config.generados ?? []).includes(rel);
}

/** Pruebas declaradas de forma estática: llamadas directas a test() o it() (no cuenta describe ni `.test(` de expresiones regulares). */
export function countTests(src) {
  const { code } = maskSource(src);
  return (code.match(/(?<![\w$.])(?:test|it)(?:\.(?:skip|todo|only))?\s*\(/g) ?? []).length;
}

export function lineCount(text) {
  if (text === '') return 0;
  const parts = text.split('\n');
  return text.endsWith('\n') ? parts.length - 1 : parts.length;
}

export function isBinary(buf) {
  const end = Math.min(buf.length, 8000);
  for (let k = 0; k < end; k += 1) if (buf[k] === 0) return true;
  return false;
}

/** Resumen de un JSON: forma y claves de primer nivel (o largo si es lista). */
export function describeJson(text) {
  let value;
  try { value = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text); } catch (e) { return { ok: false, error: String(e.message).slice(0, 80) }; }
  if (Array.isArray(value)) return { ok: true, kind: 'array', length: value.length, keys: [] };
  if (value !== null && typeof value === 'object') return { ok: true, kind: 'object', length: Object.keys(value).length, keys: Object.keys(value) };
  return { ok: true, kind: 'scalar', length: 0, keys: [] };
}

/** Resuelve una ruta relativa de import contra el conjunto de archivos; devuelve null si el destino no existe. */
export function resolveSpec(fromRel, spec, fileSet) {
  if (!/^\.{1,2}\//.test(spec)) return { bare: true, target: spec };
  const parts = fromRel.split('/').slice(0, -1);
  for (const seg of spec.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop(); else parts.push(seg);
  }
  const base = parts.join('/');
  for (const cand of [base, `${base}.js`, `${base}.mjs`, `${base}/index.js`]) if (fileSet.has(cand)) return { bare: false, target: cand };
  return { bare: false, target: base, missing: true };
}
