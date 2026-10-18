// Lector mínimo de CSS para las pruebas y herramientas del sistema de diseño (subparte 0.3).
// No es un parser completo: cubre el CSS de este repo (reglas, @media/@supports/@keyframes anidados,
// @font-face, @import). Sin dependencias.
//
//   stripComments(css)  → css sin comentarios
//   parseCss(css)       → [{ at, selector, body, decls }]   (una entrada por bloque de declaraciones)
//        at:     texto del @media/@supports/@keyframes que lo contiene (o null)
//        decls:  [{ prop, value, important }]
//        Las sentencias como "@import …;" salen con body '' y decls [].

export function stripComments(css) {
  return String(css).replace(/\/\*[\s\S]*?\*\//g, '');
}

export function parseDecls(body) {
  const out = [];
  let depth = 0;
  let cur = '';
  const flush = () => {
    const piece = cur.trim();
    cur = '';
    if (piece === '') return;
    const idx = piece.indexOf(':');
    if (idx <= 0) return;
    const prop = piece.slice(0, idx).trim();
    let value = piece.slice(idx + 1).trim();
    const important = /!\s*important\s*$/i.test(value);
    if (important) value = value.replace(/!\s*important\s*$/i, '').trim();
    out.push({ prop, value, important });
  };
  for (const ch of body) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ';' && depth === 0) flush();
    else cur += ch;
  }
  flush();
  return out;
}

const GROUP_AT = /^@(media|supports|keyframes|-webkit-keyframes|layer)\b/;

export function parseCss(src) {
  const css = stripComments(src);
  const rules = [];
  const stack = [];
  let buf = '';
  let i = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '{') {
      const prelude = buf.trim();
      buf = '';
      if (GROUP_AT.test(prelude)) {
        stack.push(prelude);
        i += 1;
        continue;
      }
      let depth = 1;
      let j = i + 1;
      while (j < css.length && depth > 0) {
        if (css[j] === '{') depth += 1;
        else if (css[j] === '}') depth -= 1;
        j += 1;
      }
      const body = css.slice(i + 1, j - 1);
      rules.push({ at: stack.length ? stack.join(' > ') : null, selector: prelude, body, decls: parseDecls(body) });
      i = j;
      continue;
    }
    if (ch === '}') {
      stack.pop();
      buf = '';
      i += 1;
      continue;
    }
    if (ch === ';' && buf.trim().startsWith('@')) {
      rules.push({ at: null, selector: buf.trim(), body: '', decls: [] });
      buf = '';
      i += 1;
      continue;
    }
    buf += ch;
    i += 1;
  }
  return rules;
}

// Todas las clases (.nombre) que aparecen en los selectores de un CSS.
export function classesInCss(css) {
  const found = new Set();
  for (const r of parseCss(css)) {
    if (r.selector.startsWith('@')) continue;
    for (const m of r.selector.matchAll(/\.([A-Za-z_][\w-]*)/g)) found.add(m[1]);
  }
  return found;
}
