// @purpose: Pruebas de la bitácora en texto plano de la 1.12-T3 (core/syncLog.js): formato, vacíos, límites, peor caso, validación y ida y vuelta por bloque.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLogText, LOG_LIMITS, AREA_LABELS } from '../core/syncLog.js';
import { AREAS } from '../core/contentRules.js';
import { localDay } from '../core/clock.js';
import { makeChatBlock, parseChatBlock, LIMITS as CHAT_LIMITS } from '../core/syncChat.js';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const log = (data, now = NOW) => buildLogText(data, { now });
const SECTIONS = ['QUÉ SE HIZO', 'DOMINIO POR ÁREA', 'ERRORES TOP (últimos 14 días)', 'PENDIENTES', 'DECISIONES'];

test('formato exacto: encabezado, cinco secciones fijas en orden, sin markdown', () => {
  const text = log({
    day: '2026-10-24',
    done: ['Repasé 20 tarjetas', 'Practiqué can/could'],
    areas: [{ area: 'gram', pct: 42.4, band: 'En progreso' }, { area: 'vocab', pct: 7 }],
    topErrors: [{ code: 'VRB.CAN_TO', title: 'Can + to', frequency: 5, impact: 'high' }, { code: 'SPELL.GENERAL', frequency: 1 }],
    pending: ['Repasar modales'],
    decisions: ['XP apagado'],
  });
  assert.equal(text, [
    'BITÁCORA DE ESTUDIO — 2026-10-24',
    'Generada: 2026-10-25T12:00:00.000Z',
    '',
    'QUÉ SE HIZO',
    '- Repasé 20 tarjetas',
    '- Practiqué can/could',
    '',
    'DOMINIO POR ÁREA',
    '- Gramática: 42 % (En progreso)',
    '- Vocabulario: 7 %',
    '',
    'ERRORES TOP (últimos 14 días)',
    '1. VRB.CAN_TO — Can + to: 5 veces · impacto alto',
    '2. SPELL.GENERAL: 1 vez',
    '',
    'PENDIENTES',
    '- Repasar modales',
    '',
    'DECISIONES',
    '- XP apagado',
  ].join('\n'));
  assert.doesNotMatch(text, /[*#`]/);
});

test('sin datos: las cinco secciones salen con «(nada registrado)» y el día es el local de now', () => {
  const text = log();
  const lines = text.split('\n');
  assert.equal(lines[0], `BITÁCORA DE ESTUDIO — ${localDay(NOW)}`); // el día LOCAL (en otra zona horaria no es el 25)
  for (const s of SECTIONS) assert.ok(lines.includes(s), s);
  assert.equal(lines.filter((l) => l === '- (nada registrado)').length, 5);
  assert.equal(buildLogText(undefined, { now: NOW }), text);
  assert.equal(log({ done: [], pending: [], decisions: [], areas: [], topErrors: [] }), text);
});

test('el día por defecto es el día LOCAL, no el UTC', () => {
  const late = new Date(2026, 9, 25, 23, 30); // 23:30 hora local del entorno
  assert.match(log({}, late).split('\n')[0], /2026-10-25$/);
  const early = new Date(2026, 9, 26, 0, 10);
  assert.match(log({}, early).split('\n')[0], /2026-10-26$/);
});

test('la ventana de errores se refleja en el encabezado de la sección', () => {
  assert.ok(log({ windowDays: 30 }).includes('ERRORES TOP (últimos 30 días)'));
  assert.ok(log({ windowDays: 1 }).includes('ERRORES TOP (últimos 1 días)'));
});

test('limpieza de texto: saltos y controles pasan a espacio, se recorta y se trunca con «…»', () => {
  const text = log({ done: ['  hola\nmundo\t\u0007fin  ', '   ', '', 'x'.repeat(LOG_LIMITS.line + 50)] });
  const lines = text.split('\n');
  assert.ok(lines.includes('- hola mundo fin'));
  const long = lines.find((l) => l.startsWith('- xxx'));
  assert.equal(long.length, 2 + LOG_LIMITS.line);
  assert.ok(long.endsWith('…'));
  assert.equal(lines.filter((l) => l.startsWith('- ')).filter((l) => l !== '- (nada registrado)').length, 2); // los vacíos no cuentan
  assert.doesNotMatch(text, /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029]/);
});

test('límites: más elementos de los permitidos se resumen con «… y N más»', () => {
  const many = (n) => Array.from({ length: n }, (_, i) => `e${i}`);
  const t = log({ done: many(LOG_LIMITS.items + 3), pending: many(LOG_LIMITS.items + 1), decisions: many(LOG_LIMITS.decisions + 5) });
  assert.ok(t.includes(`- e${LOG_LIMITS.items - 1}`) && !t.includes(`- e${LOG_LIMITS.items}\n`));
  assert.ok(t.includes('- … y 3 más'));
  assert.ok(t.includes('- … y 1 más'));
  assert.ok(t.includes('- … y 5 más'));
  const exact = log({ done: many(LOG_LIMITS.items) });
  assert.doesNotMatch(exact, /… y/);
  const areas = Array.from({ length: LOG_LIMITS.areas + 2 }, (_, i) => ({ area: `a${i}`, pct: i }));
  assert.ok(log({ areas }).includes('- … y 2 más'));
  const errs = Array.from({ length: LOG_LIMITS.topErrors + 2 }, (_, i) => ({ code: `C${i}`, frequency: i + 1 }));
  const et = log({ topErrors: errs });
  assert.ok(et.includes(`${LOG_LIMITS.topErrors}. C${LOG_LIMITS.topErrors - 1}`) && !et.includes(`${LOG_LIMITS.topErrors + 1}. `));
  assert.ok(et.includes('… y 2 más'));
});

test('peor caso: entradas gigantes nunca pasan de maxChars y siempre caben en un bloque bitacora', () => {
  const big = 'ñ'.repeat(5000);
  const worst = log({
    done: Array(500).fill(big), pending: Array(500).fill(big), decisions: Array(500).fill(big),
    areas: Array(500).fill({ area: 'y'.repeat(500), pct: 99.5, band: 'b'.repeat(500) }),
    topErrors: Array(500).fill({ code: 'c'.repeat(500), title: 't'.repeat(500), frequency: 99999, impact: 'high' }),
  });
  assert.ok(worst.length <= LOG_LIMITS.maxChars, `mide ${worst.length}`);
  assert.ok(LOG_LIMITS.maxChars < CHAT_LIMITS.maxLong);
  const block = makeChatBlock('bitacora', { texto: worst }, { now: NOW });
  const back = parseChatBlock(block);
  assert.equal(back.ok, true);
  assert.equal(back.payload.texto, worst);
});

test('áreas: etiquetas en español para las 12 áreas de la taxonomía; un área desconocida muestra su clave; el porcentaje se redondea', () => {
  for (const a of AREAS) assert.ok(typeof AREA_LABELS[a] === 'string' && AREA_LABELS[a] !== '', a);
  assert.deepEqual(Object.keys(AREA_LABELS).sort(), [...AREAS].sort());
  assert.ok(Object.isFrozen(AREA_LABELS) && Object.isFrozen(LOG_LIMITS));
  const t = log({ areas: [{ area: 'xyz', pct: 0 }, { area: 'spell', pct: 100 }, { area: 'pron', pct: 0.5 }, { area: 'med', pct: 42.5 }, { area: 'read', pct: 99.49 }] });
  for (const l of ['- xyz: 0 %', '- Ortografía: 100 %', '- Pronunciación: 1 %', '- Mediación: 43 %', '- Lectura: 99 %']) assert.ok(t.includes(l), l);
  assert.ok(log({ areas: [{ area: 'gram', pct: 10, band: '   ' }] }).includes('- Gramática: 10 %\n'));
});

test('errores top: singular y plural, impacto en español, título opcional; nunca lleva el texto de la persona', () => {
  const t = log({ topErrors: [
    { code: 'A.B', frequency: 1, impact: 'low' },
    { code: 'C.D', title: 'Título', frequency: 2, impact: 'mid' },
    { code: 'E.F', frequency: 3, impact: 'high' },
    { code: 'G.H', title: '   ', frequency: 4 },
  ] });
  for (const l of ['1. A.B: 1 vez · impacto bajo', '2. C.D — Título: 2 veces · impacto medio', '3. E.F: 3 veces · impacto alto', '4. G.H: 4 veces']) assert.ok(t.includes(l), l);
});

test('es determinista: los mismos datos dan exactamente el mismo texto', () => {
  const data = { done: ['a'], areas: [{ area: 'gram', pct: 5 }], topErrors: [{ code: 'X.Y', frequency: 2 }], pending: ['p'], decisions: ['d'] };
  assert.equal(log(data), log(structuredClone(data)));
});

test('no modifica los datos de entrada', () => {
  const data = Object.freeze({ done: Object.freeze(['a']), areas: Object.freeze([Object.freeze({ area: 'gram', pct: 5 })]), topErrors: Object.freeze([]) });
  assert.doesNotThrow(() => log(data));
});

test('datos mal formados lanzan Error en español (es un fallo de quien programa)', () => {
  const bads = [
    [null, /los datos deben ser un objeto/], [[], /los datos deben ser un objeto/], ['x', /los datos deben ser un objeto/],
    [{ otro: 1 }, /campo desconocido «otro»/],
    [{ done: 'x' }, /done debe ser una lista/], [{ done: [1] }, /done\[0\] debe ser un texto/], [{ pending: {} }, /pending debe ser una lista/], [{ decisions: [null] }, /decisions\[0\] debe ser un texto/],
    [{ areas: 'x' }, /areas debe ser una lista/], [{ areas: [null] }, /areas\[0\] necesita el campo area/], [{ areas: [{ area: '', pct: 1 }] }, /areas\[0\] necesita el campo area/],
    [{ areas: [{ area: 'gram', pct: -1 }] }, /areas\[0\]\.pct/], [{ areas: [{ area: 'gram', pct: 101 }] }, /areas\[0\]\.pct/], [{ areas: [{ area: 'gram', pct: NaN }] }, /areas\[0\]\.pct/], [{ areas: [{ area: 'gram', pct: '5' }] }, /areas\[0\]\.pct/],
    [{ topErrors: 'x' }, /topErrors debe ser una lista/], [{ topErrors: [null] }, /topErrors\[0\] necesita el campo code/], [{ topErrors: [{ code: ' ', frequency: 1 }] }, /topErrors\[0\] necesita el campo code/],
    [{ topErrors: [{ code: 'A', frequency: 0 }] }, /frequency/], [{ topErrors: [{ code: 'A', frequency: 1.5 }] }, /frequency/], [{ topErrors: [{ code: 'A', frequency: 1, impact: 'huge' }] }, /impact/],
    [{ day: '2026-13-40' }, /day debe tener la forma/], [{ day: '25/10/2026' }, /day debe tener la forma/], [{ day: 5 }, /day debe tener la forma/],
    [{ windowDays: 0 }, /windowDays/], [{ windowDays: 366 }, /windowDays/], [{ windowDays: 1.5 }, /windowDays/], [{ windowDays: '14' }, /windowDays/],
  ];
  for (const [data, re] of bads) assert.throws(() => log(data), re, JSON.stringify(data));
  assert.throws(() => buildLogText({}, { now: new Date('x') }), /la fecha no es válida/);
  assert.throws(() => buildLogText({}, { now: 'no es fecha' }), /la fecha no es válida/);
  assert.doesNotThrow(() => buildLogText({}, { now: NOW.getTime() }));
});

test('ida y vuelta por bloque: el texto multilínea sobrevive intacto', () => {
  const texto = log({ done: ['Hoy: “can/could” — ñandú 😀'], pending: ['Lo de mañana'] });
  const block = makeChatBlock('bitacora', { texto }, { now: NOW });
  const back = parseChatBlock(block);
  assert.equal(back.ok, true);
  assert.equal(back.kind, 'bitacora');
  assert.equal(back.payload.texto, texto);
});

// ---------- revisión 1.12-T3 ----------
test('cortar una línea larga nunca parte un emoji: no queda ningún sustituto suelto', () => {
  for (const pad of [0, 1]) {
    const text = log({ done: [`${'a'.repeat(pad)}${'😀'.repeat(300)}`] });
    assert.doesNotMatch(text, /[\ud800-\udbff](?![\udc00-\udfff])/, `pad ${pad}`);
    assert.doesNotMatch(text, /(?<![\ud800-\udbff])[\udc00-\udfff]/, `pad ${pad}`);
    const line = text.split('\n').find((l) => l.startsWith('- ') && l.includes('😀'));
    assert.ok(line.length - 2 <= LOG_LIMITS.line);
    assert.ok(line.endsWith('…'));
  }
});

test('day exige una fecha que exista: 2026-02-31 y 2026-04-31 se rechazan; 2028-02-29 (bisiesto) vale', () => {
  assert.throws(() => log({ day: '2026-02-31' }), /AAAA-MM-DD/);
  assert.throws(() => log({ day: '2026-04-31' }), /AAAA-MM-DD/);
  assert.throws(() => log({ day: '2027-02-29' }), /AAAA-MM-DD/);
  assert.throws(() => log({ day: '2026-00-10' }), /AAAA-MM-DD/);
  assert.ok(log({ day: '2028-02-29' }).startsWith('BITÁCORA DE ESTUDIO — 2028-02-29'));
});

// ---------- fronteras con números literales (si alguien cambia una constante, esto lo nota) ----------
const countLines = (text, start, end) => {
  const lines = text.split('\n');
  const from = lines.indexOf(start) + 1;
  const to = lines.indexOf(end, from);
  return lines.slice(from, to).filter((l) => l !== '');
};
const mk = (n, f) => Array.from({ length: n }, (_, i) => f(i));

test('topes con números literales: 20 de qué se hizo y pendientes, 15 decisiones, 30 áreas, 10 errores; justo en el tope no hay aviso y uno más avisa «y 1 más»', () => {
  assert.deepEqual([LOG_LIMITS.items, LOG_LIMITS.decisions, LOG_LIMITS.areas, LOG_LIMITS.topErrors, LOG_LIMITS.line, LOG_LIMITS.maxChars], [20, 15, 30, 10, 200, 19000]);
  const sections = { done: ['QUÉ SE HIZO', 'DOMINIO POR ÁREA', 20], decisions: ['DECISIONES', null, 15], pending: ['PENDIENTES', 'DECISIONES', 20] };
  for (const [key, [head, next, max]] of Object.entries(sections)) {
    const exact = log({ [key]: mk(max, (i) => `t${i}`) }).split('\n');
    const after = exact.slice(exact.indexOf(head) + 1);
    const block = next === null ? after : after.slice(0, after.indexOf(next));
    assert.equal(block.filter((l) => l.startsWith('- t')).length, max, key);
    assert.ok(!block.some((l) => l.includes('más')), `${key} justo en el tope no avisa`);
    const over = log({ [key]: mk(max + 1, (i) => `t${i}`) }).split('\n');
    const afterOver = over.slice(over.indexOf(head) + 1);
    const blockOver = next === null ? afterOver : afterOver.slice(0, afterOver.indexOf(next));
    assert.equal(blockOver.filter((l) => l.startsWith('- t')).length, max, key);
    assert.ok(blockOver.includes('- … y 1 más'), `${key} con uno de más avisa`);
  }
  const areasExact = countLines(log({ areas: mk(30, () => ({ area: 'gram', pct: 10 })) }), 'DOMINIO POR ÁREA', 'ERRORES TOP (últimos 14 días)');
  assert.equal(areasExact.length, 30);
  assert.ok(!areasExact.some((l) => l.includes('más')));
  const areasOver = countLines(log({ areas: mk(31, () => ({ area: 'gram', pct: 10 })) }), 'DOMINIO POR ÁREA', 'ERRORES TOP (últimos 14 días)');
  assert.equal(areasOver.length, 31);
  assert.equal(areasOver.at(-1), '- … y 1 más');
  const errsExact = countLines(log({ topErrors: mk(10, (i) => ({ code: `C${i}`, frequency: 1 })) }), 'ERRORES TOP (últimos 14 días)', 'PENDIENTES');
  assert.equal(errsExact.length, 10);
  assert.ok(!errsExact.some((l) => l.includes('más')));
  const errsOver = countLines(log({ topErrors: mk(11, (i) => ({ code: `C${i}`, frequency: 1 })) }), 'ERRORES TOP (últimos 14 días)', 'PENDIENTES');
  assert.equal(errsOver.length, 11);
  assert.equal(errsOver.at(-1), '… y 1 más');
});

test('una línea de exactamente 200 caracteres queda entera; con 201 se corta a 200 con «…»', () => {
  const exact = log({ done: ['a'.repeat(200)] }).split('\n').find((l) => l.startsWith('- a'));
  assert.equal(exact, `- ${'a'.repeat(200)}`);
  const over = log({ done: ['a'.repeat(201)] }).split('\n').find((l) => l.startsWith('- a'));
  assert.equal(over, `- ${'a'.repeat(199)}…`);
});

test('sin `day`, la bitácora usa el día LOCAL del momento (no el día UTC) en cualquier zona horaria', () => {
  const saved = process.env.TZ;
  try {
    const instant = new Date('2026-10-25T22:00:00.000Z'); // en Auckland ya es el 26; en Bogotá sigue el 25
    process.env.TZ = 'Pacific/Auckland';
    assert.ok(log({}, instant).startsWith('BITÁCORA DE ESTUDIO — 2026-10-26\n'));
    process.env.TZ = 'America/Bogota';
    assert.ok(log({}, instant).startsWith('BITÁCORA DE ESTUDIO — 2026-10-25\n'));
  } finally {
    if (saved === undefined) delete process.env.TZ; else process.env.TZ = saved;
  }
});

test('los espacios repetidos y los separadores de línea Unicode quedan en un solo espacio', () => {
  const t = buildLogText({ done: ['uno    dos\u2028tres\u2029cuatro'] }, { now: new Date('2026-10-25T12:00:00Z') });
  assert.match(t, /^- uno dos tres cuatro$/m);
});

test('los caracteres de control C1 y DEL no llegan a la bitácora', () => {
  const t = buildLogText({ pending: ['a\u007fb\u0085c\u009fd'] }, { now: new Date('2026-10-25T12:00:00Z') });
  assert.match(t, /^- a b c d$/m);
  assert.doesNotMatch(t, /[\u007f-\u009f]/);
});
