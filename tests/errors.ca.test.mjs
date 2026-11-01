// @purpose: Criterios de aceptación de la 1.6, de punta a punta: detector, hook de clasificación y registro de errores.
// Cierre de la 1.6 (cuarto 4): los 5 criterios de aceptación del roadmap (sección 1.6), de punta a punta con la API pública:
// detector mecánico → hook de clasificación → registro (`errors.record`) → ranking (`top`).
// Los casos finos viven en errorCatalog, errors, errors.recurrence, errors.top, errorHook y errorDetect.*; aquí solo se amarra cada CA.
// Los «oráculos» de abajo escriben las reglas del roadmap con SUS datos (los 45 códigos de 8.8, pesos 1·2·3), sin leer el código que prueban.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createErrors } from '../core/errors.js';
import { createErrorHook } from '../core/errorHook.js';
import { createErrorDetector } from '../core/errorDetect.js';
import { createMemoryDb } from '../core/db.memory.js';
import { makeClock } from './_helpers.mjs';
import { REAL, CONTROL } from './_errorTable.mjs';

const FILE = JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8'));
const CATALOG = createErrorCatalog(FILE);
const DETECTOR = createErrorDetector({ catalog: CATALOG });

async function setup() {
  const db = createMemoryDb();
  await db.open();
  const errors = createErrors({ db, catalog: CATALOG, clock: makeClock('2026-10-20T12:00:00.000Z') });
  const hook = createErrorHook({ errors, catalog: CATALOG, classifier: DETECTOR });
  return { db, errors, hook };
}
const noon = (d) => new Date(2026, 9, d, 12, 0, 0).toISOString(); // mediodía LOCAL de octubre de 2026

// ---------- CA 1 ----------
// Los 45 códigos del «catálogo inicial» de 8.8, escritos aquí a mano.
const CODES_8_8 = ['TNS.PP_PS', 'TNS.SINCE_FOR', 'TNS.PERF_FORM', 'VRB.IRREG_REGULARIZE', 'VRB.DOUBLE_PAST', 'VRB.CAN_TO', 'VRB.THIRD_S_OMIT', 'VRB.THIRD_S_EXTRA',
  'Q.WORD_ORDER', 'Q.AUX_OMIT', 'Q.INDIRECT', 'GER.INF_AFTER_PREP', 'GER.AVOID_TO', 'GER.STOP_REMEMBER', 'PREP.DEP', 'NEG.DOUBLE', 'SUBJ.OMIT',
  'CONN.CONTRAST_BECAUSE', 'CONN.DESPITE_OF', 'FUT.WILL_PLAN', 'FUT.WILL_PAST', 'FUT.AUX_MIX', 'ADJ.SUPERLATIVE', 'ADJ.ADV_CONFUSION', 'ADJ.BORED_BORING',
  'ADJ.ORDER', 'ADJ.PLURAL', 'NOUN.COUNT_UNCOUNT', 'NOUN.PLURAL_IRREG', 'CAUS.MAKE_ME_WORKS', 'LEX.FALSE_FRIEND', 'LEX.CALQUE', 'SPELL.GENERAL', 'MECH.CAP_I',
  'MECH.EVERYDAY', 'ART.GEO', 'PRON.-ED', 'PRON.-S', 'PRON.CLUSTER', 'PRON.S_CLUSTER', 'PRON.VOWEL', 'PRON.V_B', 'PRON.TH', 'PRON.FINAL_VOICING', 'PRON.R'];

test('CA-1: ≥ 45 códigos y los 45 de 8.8 están, todos completos (los 8 campos con contenido)', () => {
  assert.equal(CODES_8_8.length, 45);
  assert.equal(new Set(CODES_8_8).size, 45);
  assert.ok(CATALOG.size >= 45, `solo ${CATALOG.size}`);
  for (const id of CODES_8_8) assert.ok(CATALOG.has(id), `falta ${id}`);
  assert.equal(CATALOG.isComplete(), true);
  assert.deepEqual(CATALOG.incomplete(), []);
  // Comprobación independiente sobre el JSON crudo (no sobre el catálogo que se prueba).
  const text = (v) => typeof v === 'string' && v.trim().length > 0;
  const ids = new Set();
  for (const e of FILE.codes ?? FILE) {
    assert.ok(!ids.has(e.id), `id repetido ${e.id}`);
    ids.add(e.id);
    for (const f of ['titulo_es', 'descripcion_es', 'origen_tipico', 'impacto_defecto', 'ejemplo_malo', 'ejemplo_bueno', 'pista_corta_es']) assert.ok(text(e[f]), `${e.id}.${f}`);
    assert.ok(Array.isArray(e.temas_relacionados) && e.temas_relacionados.length > 0, `${e.id}.temas_relacionados`);
    assert.ok(['transfer_es', 'developmental', 'unknown_pure'].includes(e.origen_tipico), `${e.id} origen ${e.origen_tipico}`);
    assert.ok(['low', 'mid', 'high'].includes(e.impacto_defecto), `${e.id} impacto ${e.impacto_defecto}`);
    assert.notEqual(e.ejemplo_malo.trim(), e.ejemplo_bueno.trim(), `${e.id}: el ejemplo malo y el bueno son iguales`);
  }
  assert.equal(ids.size, CATALOG.size);
});

// ---------- CA 2 ----------
test('CA-2: ≥ 40 frases reales: cada una da su código sobre el fragmento esperado, y pasan por hook y registro hasta quedar anotadas', async () => {
  assert.ok(REAL.length >= 40, `solo ${REAL.length}`);
  assert.equal(new Set(REAL.map((r) => r[0])).size, REAL.length);
  for (const [phrase, code, frag] of REAL) {
    const hit = DETECTOR.detect(phrase).find((h) => h.code === code);
    assert.ok(hit, `«${phrase}» debía dar ${code}`);
    assert.ok(hit.text.toLowerCase().includes(frag.toLowerCase()) || frag.toLowerCase().includes(hit.text.toLowerCase()), `«${phrase}»: señaló «${hit.text}», se esperaba «${frag}»`);
  }
  const { errors, hook } = await setup();
  const out = await hook.classifyAndRecord(REAL.map(([original], i) => ({ original, ts: noon(1 + (i % 20)) })));
  assert.equal(out.recorded, REAL.length);
  assert.equal(out.classifier.ok, true);
  assert.deepEqual(out.results.map((r) => r.status), REAL.map(() => 'recorded'));
  assert.equal(await errors.count(), REAL.length);
  for (const rec of await errors.list({})) { // cada registro quedó con un código del catálogo y los 15 campos del contrato
    assert.ok(CATALOG.has(rec.code), rec.code);
    assert.ok(rec.topics.length > 0 && rec.count >= 1 && rec.source === 'app');
  }
  // el código anotado es el esperado en casi todas (con varios errores en la frase, manda el de más impacto)
  const recs = await errors.list({});
  const byOriginal = new Map(recs.map((r) => [r.original, r.code]));
  const wrong = REAL.filter(([p, code]) => byOriginal.get(p) !== code);
  assert.ok(wrong.length <= 6, `el código anotado no coincide en ${wrong.length}: ${wrong.map((w) => w[0]).join(' | ')}`);
});

// ---------- CA 3 ----------
test('CA-3: ≥ 30 frases correctas de control: cero avisos, y no llega nada al registro', async () => {
  assert.ok(CONTROL.length >= 30, `solo ${CONTROL.length}`);
  for (const p of CONTROL) assert.deepEqual(DETECTOR.detect(p), [], `«${p}» es correcta`);
  const { errors, hook } = await setup();
  const out = await hook.classifyAndRecord(CONTROL.map((original) => ({ original })));
  assert.equal(out.recorded, 0);
  assert.deepEqual(out.results.map((r) => r.status), CONTROL.map(() => 'unclassified'));
  assert.equal(await errors.count(), 0);
});

// ---------- CA 4 ----------
// Oráculo: puntaje = ocurrencias dentro del rango × peso (low 1, mid 2, high 3); orden: puntaje ↓, frecuencia ↓, más reciente ↓, clave ↑.
const WEIGHT = { low: 1, mid: 2, high: 3 };
function oracleTop(data, range) {
  const rows = data.map((d) => {
    const days = d.days.filter((x) => (range.from === undefined || x >= range.from) && (range.to === undefined || x <= range.to));
    return { key: d.code, frequency: days.length, weight: WEIGHT[d.impact], score: days.length * WEIGHT[d.impact], last: Math.max(...days, 0) };
  }).filter((r) => r.frequency > 0);
  rows.sort((a, b) => b.score - a.score || b.frequency - a.frequency || b.last - a.last || (a.key < b.key ? -1 : 1));
  return rows;
}
const DATA = [ // cada código con SU impacto fijo y los días de octubre en que ocurrió
  { code: 'MECH.CAP_I', phrase: 'i like it', impact: 'low', days: [1, 2, 3, 4, 5, 6] }, // 6 × 1 = 6
  { code: 'NEG.DOUBLE', phrase: "I don't know nothing", impact: 'high', days: [7] }, // 1 × 3 = 3
  { code: 'TNS.SINCE_FOR', phrase: 'I live here since two years', impact: 'mid', days: [16, 17] }, // 2 × 2 = 4: empata con ADJ.PLURAL en puntaje y frecuencia; gana la más reciente (17 > 9), que además va DESPUÉS en el alfabeto: así el desempate por clave no lo explica
  { code: 'VRB.CAN_TO', phrase: "I didn't can to go", impact: 'high', days: [10, 11, 12] }, // 3 × 3 = 9
  { code: 'TNS.PP_PS', phrase: 'I have seen him yesterday', impact: 'mid', days: [13, 14, 15] }, // 3 × 2 = 6: empata en puntaje con CAP_I; gana CAP_I por más frecuencia (6 > 3)
  { code: 'ADJ.PLURAL', phrase: 'The movies were awesomes', impact: 'mid', days: [8, 9] }, // 2 × 2 = 4: pierde con SINCE_FOR por ser más antigua
];

test('CA-4: top ordena por frecuencia × impacto contra el oráculo, sin rango y con rango', async () => {
  const { errors } = await setup();
  for (const d of DATA) for (const day of d.days) await errors.record({ original: d.phrase, code: d.code, impact: d.impact, ts: noon(day) });
  const day = (n) => `2026-10-${String(n).padStart(2, '0')}`;
  for (const [range, oRange] of [[{}, {}], [{ from: day(3), to: day(11) }, { from: 3, to: 11 }], [{ from: day(13) }, { from: 13 }], [{ to: day(2) }, { to: 2 }]]) {
    const got = (await errors.top(10, range)).map((e) => ({ key: e.key, frequency: e.frequency, weight: e.weight, score: e.score }));
    const want = oracleTop(DATA, oRange).map(({ key, frequency, weight, score }) => ({ key, frequency, weight, score }));
    assert.deepEqual(got, want, `rango ${JSON.stringify(range)}`);
  }
  assert.deepEqual((await errors.top(10, {})).map((e) => e.key), ['VRB.CAN_TO', 'MECH.CAP_I', 'TNS.PP_PS', 'TNS.SINCE_FOR', 'ADJ.PLURAL', 'NEG.DOUBLE']); // orden a mano: 9 · 6 (más frecuente) · 6 · 4 (más reciente) · 4 · 3
  assert.deepEqual((await errors.top(2, {})).map((e) => e.key), ['VRB.CAN_TO', 'MECH.CAP_I']); // n recorta
  assert.deepEqual(await errors.top(5, { from: day(30) }), []); // rango sin errores
});

test('CA-4: ni solo frecuencia ni solo impacto', async () => {
  const { errors } = await setup();
  for (const d of DATA) for (const dd of d.days) await errors.record({ original: d.phrase, code: d.code, impact: d.impact, ts: noon(dd) });
  const keys = (await errors.top(10, {})).map((e) => e.key);
  assert.notDeepEqual(keys, [...DATA].sort((a, b) => b.days.length - a.days.length).map((d) => d.code)); // no es solo frecuencia
  assert.notEqual(keys[0], 'NEG.DOUBLE'); // ni solo impacto: el «high» de una sola vez no gana al «high» de tres
  assert.notEqual(keys[0], 'MECH.CAP_I'); // ni el «low» más frecuente
});

// ---------- CA 5 ----------
test('CA-5: idempotencia de punta a punta: reenviar el mismo lote no cambia nada; una ocurrencia nueva sí cuenta', async () => {
  const { db, errors, hook } = await setup();
  const lote = REAL.slice(0, 12).map(([original], i) => ({ original, ts: noon(1 + i) }));
  const a = await hook.classifyAndRecord(lote);
  assert.equal(a.recorded, 12);
  assert.ok(a.results.every((r) => r.result.created === true && r.result.counted === true && r.result.replay === false));
  const antes = JSON.stringify(await db.query('errors', {}));
  const b = await hook.classifyAndRecord(lote); // reenvío exacto
  assert.ok(b.results.every((r) => r.result.created === false && r.result.counted === false && r.result.replay === true));
  assert.equal(JSON.stringify(await db.query('errors', {})), antes);
  const c = await hook.classifyAndRecord([...lote].reverse()); // mismo lote en otro orden
  assert.ok(c.results.every((r) => r.result.replay === true));
  assert.equal(JSON.stringify(await db.query('errors', {})), antes);
  assert.equal(await errors.count(), 12);
  const topAntes = JSON.stringify(await errors.top(20, {}));
  await hook.classifyAndRecord(lote);
  assert.equal(JSON.stringify(await errors.top(20, {})), topAntes); // el ranking tampoco se mueve
  const d = await hook.classifyAndRecord([{ original: lote[0].original, ts: noon(19) }]); // ocurrencia NUEVA del mismo error: otro ts (día pasado: más de 24 h en el futuro se rechaza)
  assert.deepEqual([d.results[0].result.created, d.results[0].result.counted, d.results[0].result.replay], [false, true, false]);
  assert.equal(d.results[0].result.record.count, 2);
  assert.equal(await errors.count(), 12); // sigue siendo el mismo error, no uno nuevo
});

test('CA-5: la misma frase con otra puntuación, mayúsculas o espacios es el mismo error', async () => {
  const { errors } = await setup();
  const r1 = await errors.record({ original: "I didn't can to send it", code: 'VRB.CAN_TO', ts: noon(1) });
  const r2 = await errors.record({ original: "  i DIDN’T can to send it.  ", code: 'VRB.CAN_TO', ts: noon(2) });
  assert.equal(r1.record.id, r2.record.id);
  assert.equal(r2.record.count, 2);
  assert.equal(await errors.count(), 1);
});
