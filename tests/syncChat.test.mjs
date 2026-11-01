// @purpose: Pruebas de los bloques del chat de la 1.12-T2 (core/syncChat.js): armar, leer con tolerancia, validar por tipo y rechazar entradas hostiles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeChatBlock, parseChatBlock, validateChatPayload, ChatBlockError, BLOCK_KINDS, LIMITS } from '../core/syncChat.js';
import { createSync } from '../core/sync.js';
import { createMemoryDb, createMemoryDisk } from '../core/db.memory.js';
import { makeClock } from './_helpers.mjs';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const ERR = { original: "I didn't can to send it", code: 'VRB.CAN_TO', correction: "I couldn't send it", context: 'email', topics: ['gram.modals.can_could'], origin: 'transfer_es', kind: 'systematic', impact: 'high', itemId: null, ts: '2026-10-24T09:00:00.000Z', source: 'chat' };
const SAMPLES = {
  llevar_al_chat: { tema: 'gram.modals.can_could', item: 'item.0001', respuesta: 'I didn’t can go', errores: [{ code: 'VRB.CAN_TO', original: 'can to', correction: 'can' }], dominio: { pct: 42.5, banda: 'media' }, mensaje: '¿Por qué “can” no lleva «to»?' },
  errores: { errores: [ERR], temas: [{ id: 'gram.modals.can_could', estado: 'learning' }] },
  estado: { dia: '2026-10-25', areas: [{ area: 'grammar', pct: 30 }], temas: [{ id: 'gram.modals.can_could', pct: 40, banda: 'media' }], notas: 'ñandú 😀' },
  bitacora: { texto: 'Hoy: repasé 20 tarjetas.\nPendiente: modales.' },
};
const code = (r) => { assert.equal(r.ok, false); return r.error.code; };
const withBlock = (inner, head = '=== SOPHIA-EN-SYNC v1 ===', tail = '=== FIN ===') => `${head}\n${inner}\n${tail}`;
const body = (kind = 'bitacora', payload = SAMPLES.bitacora) => `tipo: ${kind}\ngenerado: 2026-10-25T12:00:00.000Z\n${JSON.stringify(payload)}`;

test('formato exacto de 8.14: cabecera, tipo, generado, JSON y cierre', () => {
  const b = makeChatBlock('bitacora', SAMPLES.bitacora, { now: NOW });
  const lines = b.split('\n');
  assert.equal(lines[0], '=== SOPHIA-EN-SYNC v1 ===');
  assert.equal(lines[1], 'tipo: bitacora');
  assert.equal(lines[2], 'generado: 2026-10-25T12:00:00.000Z');
  assert.equal(lines.at(-1), '=== FIN ===');
  assert.deepEqual(JSON.parse(lines.slice(3, -1).join('\n')), SAMPLES.bitacora);
});

for (const kind of BLOCK_KINDS) {
  test(`ida y vuelta sin pérdida: ${kind}`, () => {
    const r = parseChatBlock(makeChatBlock(kind, SAMPLES[kind], { now: NOW }));
    assert.equal(r.ok, true);
    assert.equal(r.kind, kind);
    assert.equal(r.generatedAt, '2026-10-25T12:00:00.000Z');
    assert.equal(r.others, 0);
    assert.deepEqual(r.payload, validateChatPayload(kind, SAMPLES[kind]).payload);
  });
}

test('el JSON del bloque lleva saltos de línea escapados: un texto con «=== FIN ===» no corta el bloque', () => {
  const texto = 'línea 1\n=== FIN ===\nlínea 3';
  const r = parseChatBlock(makeChatBlock('bitacora', { texto }, { now: NOW }));
  assert.equal(r.ok, true);
  assert.equal(r.payload.texto, texto);
});

test('makeChatBlock sin now usa la fecha de ahora; con Date o número', () => {
  assert.match(makeChatBlock('bitacora', SAMPLES.bitacora), /^=== SOPHIA-EN-SYNC v1 ===\ntipo: bitacora\ngenerado: \d{4}-\d\d-\d\dT/);
  assert.match(makeChatBlock('bitacora', SAMPLES.bitacora, { now: NOW.getTime() }), /generado: 2026-10-25T12:00:00.000Z/);
  assert.throws(() => makeChatBlock('bitacora', SAMPLES.bitacora, { now: 'ayer' }), (e) => e instanceof ChatBlockError && e.code === 'BAD_DATE');
});

test('makeChatBlock rechaza tipo desconocido y contenido que no es objeto, con mensaje en español', () => {
  for (const [k, p, c] of [['otro', {}, 'BAD_KIND'], [undefined, {}, 'BAD_KIND'], ['bitacora', null, 'BAD_PAYLOAD'], ['bitacora', [], 'BAD_PAYLOAD'], ['bitacora', 'x', 'BAD_PAYLOAD']]) {
    assert.throws(() => makeChatBlock(k, p), (e) => e instanceof ChatBlockError && e.code === c && /[a-záéíóú]{4}/.test(e.friendly) && e.friendly === e.message, `${k} ${c}`);
  }
});

test('tolerancia: texto alrededor, vallas, citas, negritas, mayúsculas, espacios raros y CRLF', () => {
  const inner = body();
  const variantes = {
    'texto alrededor': `Claro, aquí tienes:\n\n${withBlock(inner)}\n\nAvísame si falta algo.`,
    'valla alrededor': `\`\`\`\n${withBlock(inner)}\n\`\`\``,
    'valla con lenguaje y valla dentro': `\`\`\`text\n${withBlock(`${body().split('\n').slice(0, 2).join('\n')}\n\`\`\`json\n${JSON.stringify(SAMPLES.bitacora)}\n\`\`\``)}\n\`\`\``,
    'virgulillas': `~~~\n${withBlock(inner)}\n~~~`,
    'cita': withBlock(inner).split('\n').map((l) => `> ${l}`).join('\n'),
    'negritas': withBlock(inner, '**=== SOPHIA-EN-SYNC v1 ===**', '**=== FIN ===**'),
    'minúsculas': withBlock(inner.replace('tipo:', 'TIPO:').replace('generado:', 'Generado:'), '=== sophia-en-sync V1 ===', '=== fin ==='),
    'espacios': withBlock(inner, '   ===  SOPHIA-EN-SYNC   v1  ===   ', '  ===FIN===  '),
    'NBSP y ancho cero': withBlock(inner, '=== SOPHIA-EN-SYNC\u00a0v1 ===\u200b', '\ufeff=== FIN ==='),
    'CRLF': withBlock(inner).replace(/\n/g, '\r\n'),
    'JSON en varias líneas': withBlock(`${inner.split('\n').slice(0, 2).join('\n')}\n${JSON.stringify(SAMPLES.bitacora, null, 4)}`),
    'tipo en negrita': withBlock(inner.replace('tipo: bitacora', '**tipo:** bitacora')),
    'generado antes del tipo': withBlock(`generado: 2026-10-25T12:00:00.000Z\ntipo: bitacora\n${JSON.stringify(SAMPLES.bitacora)}`),
    'líneas en blanco': withBlock(`\n\n${inner.replace('\n', '\n\n')}\n\n`),
  };
  for (const [nombre, txt] of Object.entries(variantes)) {
    const r = parseChatBlock(txt);
    assert.equal(r.ok, true, `${nombre}: ${r.ok ? '' : r.error.message}`);
    assert.deepEqual(r.payload, SAMPLES.bitacora, nombre);
    assert.equal(r.kind, 'bitacora', nombre);
  }
});

test('comillas curvas como comillas del JSON: se leen; un JSON bueno con comillas curvas dentro del texto se respeta', () => {
  const curvo = withBlock(`tipo: bitacora\n{ “texto”: “Hola” }`);
  assert.deepEqual(parseChatBlock(curvo).payload, { texto: 'Hola' });
  const dentro = parseChatBlock(makeChatBlock('bitacora', { texto: 'dijo “hola” y ’adiós’' }, { now: NOW }));
  assert.equal(dentro.payload.texto, 'dijo “hola” y ’adiós’');
  assert.deepEqual(parseChatBlock(withBlock('tipo: bitacora\n{ «texto»: «Hola» }')).payload, { texto: 'Hola' });
});

test('sin «generado:» se lee (generatedAt null); con fecha mala se rechaza', () => {
  const r = parseChatBlock(withBlock(`tipo: bitacora\n${JSON.stringify(SAMPLES.bitacora)}`));
  assert.equal(r.ok, true);
  assert.equal(r.generatedAt, null);
  assert.equal(code(parseChatBlock(withBlock(`tipo: bitacora\ngenerado: ayer\n${JSON.stringify(SAMPLES.bitacora)}`))), 'BAD_DATE');
  assert.equal(code(parseChatBlock(withBlock(`tipo: bitacora\ngenerado:\n${JSON.stringify(SAMPLES.bitacora)}`))), 'BAD_DATE');
  assert.equal(parseChatBlock(withBlock(`tipo: bitacora\ngenerado: 2026-10-25\n${JSON.stringify(SAMPLES.bitacora)}`)).generatedAt, '2026-10-25T00:00:00.000Z');
});

test('varios bloques: se lee el primero y se cuenta cuántos más venían', () => {
  const a = makeChatBlock('bitacora', { texto: 'uno' }, { now: NOW });
  const b = makeChatBlock('bitacora', { texto: 'dos' }, { now: NOW });
  const r = parseChatBlock(`${a}\n\ntexto\n\n${b}\n${b}`);
  assert.equal(r.payload.texto, 'uno');
  assert.equal(r.others, 2);
});

test('cada fallo de estructura da su código y un mensaje en español', () => {
  const ok = makeChatBlock('bitacora', SAMPLES.bitacora, { now: NOW });
  const casos = [
    [undefined, 'NO_TEXT'], [null, 'NO_TEXT'], [42, 'NO_TEXT'], ['', 'NO_TEXT'], ['   \n ', 'NO_TEXT'],
    ['hola, esto no es un bloque', 'NO_BLOCK'],
    [ok.replace('=== FIN ===', ''), 'NO_END'],
    [ok.replace('SOPHIA-EN-SYNC v1', 'SOPHIA-EN-SYNC'), 'BAD_VERSION'],
    [ok.replace('SOPHIA-EN-SYNC v1', 'SOPHIA-EN-SYNC v0'), 'BAD_VERSION'],
    [ok.replace('SOPHIA-EN-SYNC v1', 'SOPHIA-EN-SYNC v2'), 'NEWER_VERSION'],
    [ok.replace('SOPHIA-EN-SYNC v1', 'SOPHIA-EN-SYNC v1.5'), 'NEWER_VERSION'],
    [ok.replace('tipo: bitacora\n', ''), 'BAD_KIND'],
    [ok.replace('tipo: bitacora', 'tipo: inventado'), 'BAD_KIND'],
    [ok.replace('tipo: bitacora', 'tipo:'), 'BAD_KIND'],
    [withBlock('tipo: bitacora\nsolo texto, sin JSON'), 'NO_JSON'],
    [withBlock('tipo: bitacora\n} {'), 'NO_JSON'],
    [withBlock('tipo: bitacora\n{ "texto": }'), 'BAD_JSON'],
    [withBlock('tipo: bitacora\n{ "texto": "a", }'), 'BAD_JSON'],
    [withBlock("tipo: bitacora\n{ 'texto': 'a' }"), 'BAD_JSON'],
    [withBlock('tipo: bitacora\n{ "texto": "a" } y { "b": 1 }'), 'BAD_JSON'],
    [`${'x'.repeat(LIMITS.maxTextChars + 1)}`, 'TOO_BIG'],
    [withBlock(`tipo: bitacora\n{"texto":"${'x'.repeat(LIMITS.maxTextChars)}"}`), 'TOO_BIG'],
  ];
  for (const [txt, c] of casos) {
    const r = parseChatBlock(txt);
    assert.equal(code(r), c, String(txt).slice(0, 60));
    assert.ok(r.error.message.length > 15 && /[a-záéíóú]{3}/.test(r.error.message), r.error.message);
  }
});

test('parseChatBlock nunca lanza, aunque le den cualquier cosa', () => {
  for (const x of [undefined, null, NaN, {}, [], () => {}, Symbol('s'), 10n, '=== SOPHIA-EN-SYNC v1 ===', '=== FIN ===', '{', '"', '\u0000', '=== SOPHIA-EN-SYNC v1 ===\n=== FIN ===']) {
    assert.doesNotThrow(() => parseChatBlock(x));
    assert.equal(parseChatBlock(x).ok, false);
  }
});

test('el contenido tiene que ser un objeto', () => {
  assert.equal(code(parseChatBlock(withBlock('tipo: bitacora\n[1, 2]'))), 'NO_JSON');
  assert.equal(code(parseChatBlock(withBlock('tipo: bitacora\n{}'))), 'BAD_PAYLOAD');
});

test('hostil: __proto__, constructor y prototype en cualquier nivel se rechazan sin contaminar nada', () => {
  const casos = [
    '{ "__proto__": { "polluted": true }, "texto": "a" }',
    '{ "texto": "a", "constructor": { "prototype": { "polluted": true } } }',
    '{ "texto": "a", "prototype": 1 }',
  ];
  for (const j of casos) assert.equal(code(parseChatBlock(withBlock(`tipo: bitacora\n${j}`))), 'HOSTILE', j);
  const profundo = `{"errores":[{"original":"a","code":"X","topics":["t"],"extra":{"a":{"__proto__":{"p":1}}}}]}`;
  assert.equal(code(parseChatBlock(withBlock(`tipo: errores\n${profundo}`))), 'HOSTILE');
  const enLista = '{"errores":[{"original":"a","code":"X","topics":[{"__proto__":1}]}]}';
  assert.equal(code(parseChatBlock(withBlock(`tipo: errores\n${enLista}`))), 'HOSTILE');
  assert.equal({}.polluted, undefined);
  assert.equal(Object.prototype.polluted, undefined);
});

test('hostil: demasiada profundidad o demasiados elementos', () => {
  const hondo = `{"texto":"a","x":${'['.repeat(LIMITS.maxDepth + 1)}${']'.repeat(LIMITS.maxDepth + 1)}}`;
  assert.equal(code(parseChatBlock(withBlock(`tipo: bitacora\n${hondo}`))), 'HOSTILE');
  const justo = `{"texto":"a","x":${'['.repeat(LIMITS.maxDepth - 1)}${']'.repeat(LIMITS.maxDepth - 1)}}`;
  assert.equal(code(parseChatBlock(withBlock(`tipo: bitacora\n${justo}`))), 'BAD_PAYLOAD'); // pasa el escaneo; `x` no es un campo de bitácora
  const ancho = `{"texto":"a","x":[${new Array(LIMITS.maxNodes).fill('0').join(',')}]}`;
  assert.equal(code(parseChatBlock(withBlock(`tipo: bitacora\n${ancho}`))), 'HOSTILE');
});

test('validación por tipo: campos desconocidos, tipos mal y límites', () => {
  const v = (k, p) => validateChatPayload(k, p);
  assert.equal(v('bitacora', { texto: 'a', clave: 'x' }).ok, false);
  assert.match(v('bitacora', { texto: 'a', aiKey: 'x' }).error.message, /aiKey/);
  assert.equal(v('bitacora', { texto: '   ' }).ok, false);
  assert.equal(v('bitacora', { texto: 5 }).ok, false);
  assert.equal(v('bitacora', { texto: 'x'.repeat(LIMITS.maxLong) }).ok, true);
  assert.equal(v('bitacora', { texto: 'x'.repeat(LIMITS.maxLong + 1) }).ok, false);
  assert.equal(v('llevar_al_chat', {}).ok, true);
  assert.equal(v('llevar_al_chat', { dominio: { pct: 101 } }).ok, false);
  assert.equal(v('llevar_al_chat', { dominio: { pct: -1 } }).ok, false);
  assert.equal(v('llevar_al_chat', { dominio: { pct: 0 } }).ok, true);
  assert.equal(v('llevar_al_chat', { dominio: { pct: 100 } }).ok, true);
  assert.equal(v('llevar_al_chat', { dominio: { pct: NaN } }).ok, false);
  assert.equal(v('llevar_al_chat', { dominio: { pct: '5' } }).ok, false);
  assert.equal(v('llevar_al_chat', { dominio: { pct: 5, x: 1 } }).ok, false);
  assert.equal(v('llevar_al_chat', { dominio: 5 }).ok, false);
  assert.equal(v('llevar_al_chat', { errores: new Array(LIMITS.maxShortErrors).fill({ code: 'A', original: 'b' }) }).ok, true);
  assert.equal(v('llevar_al_chat', { errores: new Array(LIMITS.maxShortErrors + 1).fill({ code: 'A', original: 'b' }) }).ok, false);
  assert.equal(v('llevar_al_chat', { errores: [{ code: 'A' }] }).ok, false);
  assert.equal(v('llevar_al_chat', { errores: [7] }).ok, false);
  assert.equal(v('llevar_al_chat', { mensaje: 'm'.repeat(LIMITS.maxLong + 1) }).ok, false);
  assert.equal(v('llevar_al_chat', { tema: 't'.repeat(201) }).ok, false);
  assert.equal(v('llevar_al_chat', { respuesta: 'r'.repeat(LIMITS.maxString + 1) }).ok, false);
  assert.equal(v('estado', { dia: '2026-13-45' }).ok, false);
  assert.equal(v('estado', { dia: '25/10/2026' }).ok, false);
  assert.equal(v('estado', { dia: '2026-10-25' }).ok, true);
  assert.equal(v('estado', { areas: [{ area: 'x', pct: 200 }] }).ok, false);
  assert.equal(v('estado', { areas: [{ pct: 20 }] }).ok, false);
  assert.equal(v('estado', { areas: [{ area: 'x', pct: 20, extra: 1 }] }).ok, false);
  assert.equal(v('estado', { temas: [{ id: 'con espacio', pct: 3 }] }).ok, false);
  assert.equal(v('estado', { temas: [{ id: 'a.b', pct: 3 }, { id: 'c' }] }).ok, true);
  assert.equal(v('estado', { temas: [{ id: 'a', pct: 101 }] }).ok, false);
  assert.equal(v('estado', { temas: new Array(LIMITS.maxTopics + 1).fill({ id: 'a' }) }).ok, false);
});

test('errores: normaliza, fuerza source «chat», exige forma y respeta los límites', () => {
  const v = (e, extra = {}) => validateChatPayload('errores', { errores: [e], ...extra });
  const mini = v({ original: '  can to  ', code: 'VRB.CAN_TO' });
  assert.deepEqual(mini.payload.errores[0], { original: 'can to', code: 'VRB.CAN_TO', topics: [], itemId: null, source: 'chat' });
  assert.equal(v({ original: 'a', code: 'X', source: 'app' }).ok, false);
  assert.equal(v({ original: 'a', code: 'X', source: 'chat' }).ok, true);
  assert.equal(v({ original: 'a', code: 'X', id: 'err_1' }).ok, false);
  assert.equal(v({ original: 'a', code: 'X', count: 3 }).ok, false);
  assert.equal(v({ code: 'X' }).ok, false);
  assert.equal(v({ original: 'a' }).ok, false);
  assert.equal(v({ original: '', code: 'X' }).ok, false);
  assert.equal(v({ original: 'a'.repeat(LIMITS.maxOriginal), code: 'X' }).ok, true);
  assert.equal(v({ original: 'a'.repeat(LIMITS.maxOriginal + 1), code: 'X' }).ok, false);
  assert.equal(v({ original: 'a', code: 'con espacio' }).ok, false);
  assert.equal(v({ original: 'a', code: 'X'.repeat(61) }).ok, false);
  assert.equal(v({ original: 'a', code: 'X', origin: 'otro' }).ok, false);
  assert.equal(v({ original: 'a', code: 'X', kind: 'otro' }).ok, false);
  assert.equal(v({ original: 'a', code: 'X', impact: 'otro' }).ok, false);
  for (const o of ['transfer_es', 'developmental', 'unknown_pure']) assert.equal(v({ original: 'a', code: 'X', origin: o }).ok, true);
  for (const o of ['slip', 'systematic']) assert.equal(v({ original: 'a', code: 'X', kind: o }).ok, true);
  for (const o of ['low', 'mid', 'high']) assert.equal(v({ original: 'a', code: 'X', impact: o }).ok, true);
  assert.equal(v({ original: 'a', code: 'X', ts: 'ayer' }).ok, false);
  assert.equal(v({ original: 'a', code: 'X', ts: 5 }).ok, false);
  assert.equal(v({ original: 'a', code: 'X', topics: 'a' }).ok, false);
  assert.equal(v({ original: 'a', code: 'X', topics: ['a b'] }).ok, false);
  assert.equal(v({ original: 'a', code: 'X', topics: new Array(21).fill('a') }).ok, false);
  assert.equal(v({ original: 'a', code: 'X', topics: new Array(20).fill('a') }).ok, true);
  assert.equal(v({ original: 'a', code: 'X', itemId: 'item 1' }).ok, false);
  assert.equal(v({ original: 'a', code: 'X', itemId: 'item.1' }).payload.errores[0].itemId, 'item.1');
  assert.equal(v({ original: 'a', code: 'X', itemId: null }).payload.errores[0].itemId, null);
  assert.equal(v(5).ok, false);
  assert.equal(v(null).ok, false);
  assert.equal(validateChatPayload('errores', { errores: [] }).ok, false);
  assert.equal(validateChatPayload('errores', {}).ok, false);
  assert.equal(validateChatPayload('errores', { errores: 'x' }).ok, false);
  assert.equal(validateChatPayload('errores', { errores: new Array(LIMITS.maxErrors).fill({ original: 'a', code: 'X' }) }).ok, true);
  assert.equal(validateChatPayload('errores', { errores: new Array(LIMITS.maxErrors + 1).fill({ original: 'a', code: 'X' }) }).ok, false);
  assert.equal(v({ original: 'a', code: 'X' }, { temas: [{ id: 'a', estado: 'known' }] }).ok, true);
  assert.equal(v({ original: 'a', code: 'X' }, { temas: [{ id: 'a' }] }).ok, false);
  assert.equal(v({ original: 'a', code: 'X' }, { temas: [{ id: 'a b', estado: 'known' }] }).ok, false);
  assert.equal(v({ original: 'a', code: 'X' }, { temas: [{ id: 'a', estado: 'known', x: 1 }] }).ok, false);
  assert.equal(v({ original: 'a', code: 'X' }, { otro: 1 }).ok, false);
  assert.match(v({ original: 'a', code: 'X', origin: 'otro' }).error.message, /errores\[0\]\.origin/);
});

test('el contenido leído es una copia limpia: no comparte nada con el texto y no trae campos de más', () => {
  const r = parseChatBlock(makeChatBlock('errores', { errores: [{ ...ERR, source: undefined }] }, { now: NOW }));
  assert.equal(Object.getPrototypeOf(r.payload), Object.prototype);
  assert.deepEqual(Object.keys(r.payload.errores[0]).sort(), ['code', 'context', 'correction', 'impact', 'itemId', 'kind', 'origin', 'original', 'source', 'topics', 'ts']);
});

test('createSync ofrece makeChatBlock (con su reloj) y parseChatBlock con los nombres de 8.15, sin tocar la base', async () => {
  const db = createMemoryDb({ disk: createMemoryDisk(), clock: makeClock() });
  await db.open();
  const clock = { now: () => new Date('2026-01-02T03:04:05.000Z') };
  const sync = createSync({ db, clock });
  const b = sync.makeChatBlock('bitacora', SAMPLES.bitacora);
  assert.match(b, /generado: 2026-01-02T03:04:05.000Z/);
  assert.match(sync.makeChatBlock('bitacora', SAMPLES.bitacora, { now: NOW }), /generado: 2026-10-25T12:00:00.000Z/);
  assert.deepEqual(sync.parseChatBlock(b).payload, SAMPLES.bitacora);
  const sinBase = createSync({});
  assert.equal(sinBase.parseChatBlock(b).ok, true);
  assert.match(sinBase.makeChatBlock('bitacora', SAMPLES.bitacora), /^=== SOPHIA-EN-SYNC v1 ===/);
});

test('bloque con indentación de 2 espacios y errores normalizados al armar (source «chat», textos recortados)', () => {
  const b = makeChatBlock('errores', { errores: [{ original: '  can to  ', code: 'X' }] }, { now: NOW });
  const lines = b.split('\n');
  assert.equal(lines[3], '{');
  assert.equal(lines[4], '  "errores": [');
  assert.ok(b.includes('"source": "chat"'));
  assert.ok(b.includes('"original": "can to"'));
  assert.throws(() => makeChatBlock('llevar_al_chat', []), (e) => e.code === 'BAD_PAYLOAD');
  assert.throws(() => makeChatBlock('llevar_al_chat', [1]), (e) => e.code === 'BAD_PAYLOAD');
});

test('tolerancia, más casos: vallas dentro del bloque, lenguaje, CR suelto, NBSP en el JSON, comillas alemanas, tipo con mayúsculas', () => {
  const j = JSON.stringify(SAMPLES.bitacora);
  const casos = {
    'valla antes del tipo': withBlock(`\`\`\`json\ntipo: bitacora\n${j}\n\`\`\``),
    'virgulillas dentro': withBlock(`~~~\ntipo: bitacora\n${j}\n~~~`),
    'CR suelto': withBlock(body()).replace(/\n/g, '\r'),
    'NBSP en el JSON': withBlock(`tipo: bitacora\n{\u00a0"texto":\u00a0"${SAMPLES.bitacora.texto.replace(/\n/g, '\\n')}"\u00a0}`),
    'comillas alemanas': withBlock(`tipo: bitacora\n{ „texto“: „${SAMPLES.bitacora.texto.replace(/\n/g, '\\n')}“ }`),
    'tipo con mayúsculas': withBlock(`tipo: BITACORA\n${j}`),
    'BOM al inicio': `\ufeff${withBlock(body())}`,
  };
  for (const [n, txt] of Object.entries(casos)) {
    const r = parseChatBlock(txt);
    assert.equal(r.ok, true, `${n}: ${r.ok ? '' : r.error.message}`);
    assert.deepEqual(r.payload, SAMPLES.bitacora, n);
  }
});

test('«tipo:» y «generado:» repetidos: manda el primero', () => {
  const j = JSON.stringify(SAMPLES.bitacora);
  const r = parseChatBlock(withBlock(`tipo: bitacora\ngenerado: 2026-01-01\ngenerado: 2027-01-01\n${j}`));
  assert.equal(r.generatedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(parseChatBlock(withBlock(`tipo: bitacora\ntipo: estado\n${j}`)).kind, 'bitacora');
});

test('mensajes que dicen qué falta (no solo el código)', () => {
  const ok = makeChatBlock('bitacora', SAMPLES.bitacora, { now: NOW });
  assert.match(parseChatBlock(ok.replace('SOPHIA-EN-SYNC v1', 'SOPHIA-EN-SYNC')).error.message, /falta la versión/);
  assert.match(parseChatBlock(ok.replace('tipo: bitacora\n', '')).error.message, /falta la línea «tipo:»/);
  assert.match(parseChatBlock(ok.replace('v1', 'v7')).error.message, /más nueva/);
  assert.match(parseChatBlock(ok.replace('v1', 'v0')).error.message, /v0/);
  assert.match(parseChatBlock(ok.replace('generado: 2026-10-25T12:00:00.000Z', 'generado:')).error.message, /generado/);
});

test('límites en el borde exacto: texto, nodos y profundidad', () => {
  const ok = makeChatBlock('bitacora', SAMPLES.bitacora, { now: NOW });
  assert.equal(parseChatBlock(ok + ' '.repeat(LIMITS.maxTextChars - ok.length)).ok, true);
  assert.equal(code(parseChatBlock(`${ok}${' '.repeat(LIMITS.maxTextChars - ok.length + 1)}`)), 'TOO_BIG');
  // raíz (1) + el texto (1) + la lista x (1) + n ceros = maxNodes exactos: pasa el escaneo (y la validación lo rechaza por el campo x)
  const n = LIMITS.maxNodes - 3;
  assert.equal(code(parseChatBlock(withBlock(`tipo: bitacora\n{"texto":"a","x":[${new Array(n).fill('0').join(',')}]}`))), 'BAD_PAYLOAD');
  assert.equal(code(parseChatBlock(withBlock(`tipo: bitacora\n{"texto":"a","x":[${new Array(n + 1).fill('0').join(',')}]}`))), 'HOSTILE');
});

test('hostil: «constructor» solo, a cualquier nivel, también se rechaza', () => {
  assert.equal(code(parseChatBlock(withBlock('tipo: bitacora\n{"texto":"a","constructor":1}'))), 'HOSTILE');
  assert.equal(code(parseChatBlock(withBlock('tipo: bitacora\n{"texto":"a","x":[{"constructor":1}]}'))), 'HOSTILE');
  assert.equal(code(parseChatBlock(withBlock('tipo: bitacora\n{"texto":"a","__proto__":1}'))), 'HOSTILE');
  assert.equal(code(parseChatBlock(withBlock('tipo: bitacora\n{"texto":"a","prototype":1}'))), 'HOSTILE');
});

test('entradas nulas dentro de las listas y objetos no hacen lanzar: se rechazan con mensaje', () => {
  const casos = [
    ['errores', { errores: [null] }], ['errores', { errores: [{ original: 'a', code: 'X' }], temas: [null] }],
    ['estado', { areas: [null] }], ['estado', { temas: [null] }], ['estado', { areas: [5] }], ['estado', { temas: ['x'] }],
    ['llevar_al_chat', { errores: [null] }], ['llevar_al_chat', { dominio: null }], ['llevar_al_chat', { dominio: [] }],
  ];
  for (const [k, p] of casos) {
    let r;
    assert.doesNotThrow(() => { r = validateChatPayload(k, p); }, `${k} ${JSON.stringify(p)}`);
    assert.equal(r.ok, false);
    assert.match(r.error.message, /objeto/, `${k} ${JSON.stringify(p)}`);
  }
});

test('el día de «estado» tiene que ser AAAA-MM-DD exacto', () => {
  for (const d of ['2026-10-5', 'Oct 5 2026', '2026/10/05', '20261005']) assert.equal(validateChatPayload('estado', { dia: d }).ok, false, d);
});

test('los nombres de campo raros salen sin caracteres de control y recortados en el mensaje', () => {
  const r = validateChatPayload('bitacora', { texto: 'a', ['x\u0001y\n']: 1 });
  assert.equal(r.ok, false);
  assert.ok(!/[\u0000-\u001f]/.test(r.error.message));
  const largo = validateChatPayload('bitacora', { texto: 'a', ['k'.repeat(5000)]: 1 });
  assert.ok(largo.error.message.length < 200);
});

test('estado: dia con un día que no existe (2026-02-31) se rechaza igual que 2026-13-45', () => {
  for (const d of ['2026-02-31', '2026-04-31', '2027-02-29']) assert.equal(validateChatPayload('estado', { dia: d }).ok, false, d);
  assert.equal(validateChatPayload('estado', { dia: '2028-02-29' }).ok, true);
});

// ---------- Administrador, 2026-10-26: un bloque pegado como cita no se lee, pero se avisa con amabilidad ----------
const QUOTE_TEXT = "Parece una cita: quita los '>' y vuelve a pegar.";
const quoteAll = (text, mark = '> ') => text.split('\n').map((l) => mark + l).join('\n');

test('cita: un bloque con «> » en cada línea da BAD_JSON con el aviso amable y no se lee', () => {
  for (const kind of BLOCK_KINDS) {
    const block = makeChatBlock(kind, SAMPLES[kind], { now: NOW });
    const r = parseChatBlock(quoteAll(block));
    assert.equal(code(r), 'BAD_JSON', kind);
    assert.equal(r.error.message, QUOTE_TEXT, kind);
  }
});

test('cita: con «>» pegado, con sangría o anidada («> > ») también avisa; con texto alrededor también', () => {
  const block = makeChatBlock('errores', SAMPLES.errores, { now: NOW });
  for (const mark of ['>', '  > ', '> > ', '>\t']) {
    const r = parseChatBlock(`Aquí va lo que me mandó el chat:\n${quoteAll(block, mark)}\nGracias`);
    assert.equal(code(r), 'BAD_JSON', JSON.stringify(mark));
    assert.equal(r.error.message, QUOTE_TEXT, JSON.stringify(mark));
  }
});

test('cita: solo avisa cuando el JSON ya falló; un bloque bueno nunca recibe el aviso', () => {
  const block = makeChatBlock('bitacora', SAMPLES.bitacora, { now: NOW });
  assert.equal(parseChatBlock(block).ok, true);
  // La tolerancia de citas sigue valiendo solo para las marcas (tipo/generado/inicio/fin), no para el JSON.
  const marcas = block.split('\n').map((l, i, all) => (i === 0 || i === 1 || i === all.length - 1 ? `> ${l}` : l)).join('\n');
  assert.equal(parseChatBlock(marcas).ok, true);
  // Un JSON roto sin ninguna línea de cita conserva el mensaje de siempre.
  const roto = withBlock(`tipo: bitacora\n{ "texto": }`);
  const r = parseChatBlock(roto);
  assert.equal(code(r), 'BAD_JSON');
  assert.notEqual(r.error.message, QUOTE_TEXT);
  assert.match(r.error.message, /no es un JSON válido/);
});

test('cita: una sola línea de cita dentro de un JSON roto basta para avisar; un «>» dentro de un texto válido no molesta', () => {
  const r = parseChatBlock(withBlock(`tipo: bitacora\n{\n> "texto": "x"\n}`));
  assert.equal(code(r), 'BAD_JSON');
  assert.equal(r.error.message, QUOTE_TEXT);
  const ok = parseChatBlock(makeChatBlock('bitacora', { texto: 'a > b\n> c' }, { now: NOW }));
  assert.equal(ok.ok, true);
  assert.equal(ok.payload.texto, 'a > b\n> c');
});

test('cita: un «>» en medio de una línea (una flecha, una comparación) o una cita fuera del bloque no activan el aviso', () => {
  const flecha = parseChatBlock(withBlock('tipo: bitacora\n{ "texto": "ir -> volver", }'));
  assert.equal(code(flecha), 'BAD_JSON');
  assert.notEqual(flecha.error.message, QUOTE_TEXT);
  const fuera = parseChatBlock(`> Esto lo dijo el chat:\n${withBlock('tipo: bitacora\n{ "texto": }')}\n> Fin de la cita`);
  assert.equal(code(fuera), 'BAD_JSON');
  assert.notEqual(fuera.error.message, QUOTE_TEXT);
});
