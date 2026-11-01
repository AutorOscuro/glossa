// @purpose: Ayudante de la auditoría de cadenas sin culpa (2.6-T3): extrae los literales de texto de un archivo (sin comentarios) y detecta lenguaje de culpa o castigo.
// 2.6-T3, punto 4 del encargo. Lo usan tests/noBlame26.test.mjs; no contiene pruebas.
import fs from 'node:fs';

// Cada regla se aplica al texto en minúsculas y sin tildes. `sin culpa` es una negación permitida y se quita antes de mirar.
export const BLAME_RULES = Object.freeze([
  ['incorrecto/a', /\bincorrect[oa]s?\b/],
  ['equivocar', /\bequivoc/],
  ['fallaste', /\bfalla(ste|ron|s)\b/],
  ['cometiste', /\bcometiste\b/],
  ['tu error', /\btus? (error|errores)\b/],
  ['error tuyo', /\b(error|errores) tuy[oa]s?\b/],
  ['culpa', /\bculpa\b/],
  ['mal', /\bmal(a|o|as|os)?\b/],
  ['insulto', /\b(torpe|tont[oa]|estupid[oa]|inutil|vago)\b/],
  ['castigo', /\b(castigo|penaliz|fracas)/],
  ['deber', /\b(deberias|tienes que|siempre fallas|nunca aprendes)\b/],
]);

const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function blameHits(text) {
  const t = fold(String(text)).replace(/\bsin culpa\b/g, '');
  return BLAME_RULES.filter(([, re]) => re.test(t)).map(([name]) => name);
}

// Literales de cadena de un archivo JS (comillas simples, dobles y plantillas), ignorando comentarios.
export function stringLiterals(source) {
  const out = [];
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i];
    const d = source[i + 1];
    if (c === '/' && d === '/') { while (i < n && source[i] !== '\n') i += 1; continue; }
    if (c === '/' && d === '*') { const e = source.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      let j = i + 1; let buf = '';
      while (j < n && source[j] !== c) {
        if (source[j] === '\\') { buf += source[j + 1] ?? ''; j += 2; continue; }
        if (c === '`' && source[j] === '$' && source[j + 1] === '{') { // salta la expresión ${…}
          let depth = 1; j += 2;
          while (j < n && depth > 0) { if (source[j] === '{') depth += 1; else if (source[j] === '}') depth -= 1; j += 1; }
          buf += ' '; continue;
        }
        if (c !== '`' && source[j] === '\n') break;
        buf += source[j]; j += 1;
      }
      out.push(buf); i = j + 1; continue;
    }
    if (c === '/' && /[=(,:;!&|?{}\[]\s*$/.test(source.slice(Math.max(0, i - 3), i))) { // literal de regex: se salta
      let j = i + 1; let cls = false;
      while (j < n && (source[j] !== '/' || cls) && source[j] !== '\n') { if (source[j] === '\\') j += 1; else if (source[j] === '[') cls = true; else if (source[j] === ']') cls = false; j += 1; }
      i = j + 1; continue;
    }
    i += 1;
  }
  return out;
}

export function scanFile(path) {
  const src = fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const hits = [];
  for (const s of stringLiterals(src)) { const h = blameHits(s); if (h.length) hits.push({ path, text: s.slice(0, 90), rules: h }); }
  return hits;
}
