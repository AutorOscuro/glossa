// @purpose: Tabla de ≥ 80 respuestas de la familia de texto (2.5-T5) con las del diagnóstico: veredicto, código detectado y entrada para errors.record, con detector, catálogo y compare reales.
// Cada fila: [tipo, accept, escrito, veredicto esperado, código esperado del PRIMER aviso (null = ninguno), trozo `original` esperado de la entrada (null = no hay entrada)].
// El oráculo de cada fila lo escribió una persona leyendo el diagnóstico (roadmap 7.10), no sale de ejecutar el código. Donde el detector calla a propósito («prefiere no avisar a avisar mal») la fila lo dice con null.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createErrors } from '../core/errors.js';
import { createMemoryDb } from '../core/db.memory.js';
import { gradeText } from '../core/textAnswer.js';
import { gradeFix } from '../core/fixError.js';
import { withDetection, errorEntries } from '../core/textErrors.js';
import { createDetectSource } from '../ui/exercises/detectSource.js';
import { makeClock } from './_helpers.mjs';

const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
const DETECT = createDetectSource({ catalog: CATALOG });
const ERRORS = createErrors({ db: createMemoryDb(), catalog: CATALOG, clock: makeClock() });

const W = 'wrong'; const C = 'correct'; const A = 'almost';
const ROWS = [
  // ---- irregulares regularizados (diagnóstico: «leaved», «eated», «paseed») ----
  ['fill_verb', 'left', 'leaved', W, 'VRB.IRREG_REGULARIZE', 'leaved'],
  ['fill_verb', 'ate', 'eated', W, 'VRB.IRREG_REGULARIZE', 'eated'],
  ['fill_verb', 'bought', 'buyed', W, 'VRB.IRREG_REGULARIZE', 'buyed'],
  ['fill_verb', 'went', 'goed', W, 'VRB.IRREG_REGULARIZE', 'goed'],
  ['fill_verb', 'took', 'taked', W, 'VRB.IRREG_REGULARIZE', 'taked'],
  ['fill_verb', 'wrote', 'writed', W, 'VRB.IRREG_REGULARIZE', 'writed'],
  ['fill_verb', 'ran', 'runned', W, 'VRB.IRREG_REGULARIZE', 'runned'],
  ['fill_verb', 'drank', 'drinked', W, 'VRB.IRREG_REGULARIZE', 'drinked'],
  ['fill_verb', 'told', 'telled', W, 'VRB.IRREG_REGULARIZE', 'telled'],
  ['fill_verb', 'slept', 'sleeped', W, 'VRB.IRREG_REGULARIZE', 'sleeped'],
  ['fill_verb', 'left', 'left', C, null, null],
  ['fill_verb', 'ate', 'ate', C, null, null],
  ['fill_verb', 'went', '  Went  ', C, null, null],
  ['fill_verb', 'bought', 'BOUGHT', C, null, null],
  ['fill_verb', 'passed', 'paseed', A, null, null],
  ['fill_verb', 'passed', 'pased', A, null, null],
  ['fill_verb', 'left', 'stayed', W, null, null],
  ['fill_verb', 'ate', 'drank', W, null, null],
  // ---- «didn't went» y pasado doblado ----
  ['fix_error', "She didn't go home.", "She didn't went home.", W, 'VRB.DOUBLE_PAST', "didn't went"],
  ['fix_error', 'I did not see him.', 'I did not saw him.', W, 'VRB.DOUBLE_PAST', 'did not saw'],
  ['fix_error', 'What did you say?', 'What did you said?', W, 'VRB.DOUBLE_PAST', 'did you said'],
  ['fix_error', "We didn't want it.", "We didn't wanted it.", W, 'VRB.DOUBLE_PAST', "didn't wanted"],
  ['fix_error', "She didn't go home.", "She didn't go home.", C, null, null],
  ['fix_error', 'I did not see him.', 'I did not see him.', C, null, null],
  ['fix_error', "We didn't want it.", 'We did not want it.', C, null, null],
  ['fix_error', "She didn't go home.", "She didn't goes home.", W, 'VRB.THIRD_S_EXTRA', "didn't goes"],
  // ---- can/could + to (el error más frecuente del diagnóstico) ----
  ['fix_error', 'She can swim.', 'She can to swim.', W, 'VRB.CAN_TO', 'can to swim'],
  ['fix_error', "I couldn't send it.", "I didn't can to send it.", W, 'VRB.CAN_TO', 'can to send'],
  ['fix_error', 'I can send it.', 'so I can to send it.', W, 'VRB.CAN_TO', 'can to send'],
  ['fix_error', 'He could be studying.', 'He could to be studying.', W, 'VRB.CAN_TO', 'could to be'],
  ['fix_error', 'You must go now.', 'You must to go now.', W, 'VRB.CAN_TO', 'must to go'],
  ['fix_error', 'She can swim.', 'She can swim.', C, null, null],
  ['fix_error', 'He could be studying.', 'He could be studying.', C, null, null],
  ['fix_error', 'She can swim.', 'She cans swim.', W, null, null],
  ['fix_error', 'She wants to swim.', 'She wants to swim.', C, null, null],
  // ---- tiempos perfectos ----
  ['fix_error', 'I have gone to Cali.', 'I have went to Cali.', W, 'TNS.PERF_FORM', 'have went'],
  ['fix_error', 'She has taken the bus.', 'She has took the bus.', W, 'TNS.PERF_FORM', 'has took'],
  ['fix_error', 'They had come late.', 'They had came late.', W, 'TNS.PERF_FORM', 'had came'],
  ['fix_error', 'I have been studying here.', 'I have been study here.', W, 'TNS.PERF_FORM', 'have been study'],
  ['fix_error', 'I have gone to Cali.', 'I have gone to Cali.', C, null, null],
  ['fix_error', 'She has taken the bus.', 'She has taken the bus.', C, null, null],
  ['fix_error', 'I have been studying here.', 'I have been studying here.', C, null, null],
  // ---- for / since ----
  ['fix_error', "I've lived here for two years.", "I'm living here since two years.", W, 'TNS.SINCE_FOR', 'since two years'],
  ['fix_error', 'I have lived here since 2010.', 'I live here since 2010.', W, 'TNS.SINCE_FOR', 'live here since 2010'],
  ['fix_error', 'She has worked here since January.', 'She works here since January.', W, 'TNS.SINCE_FOR', 'works here since January'],
  ['fix_error', "I've lived here for two years.", "I've lived here for two years.", C, null, null],
  ['fix_error', 'She has worked here since January.', 'She has worked here since January.', C, null, null],
  // ---- doble negación y sujeto omitido ----
  ['fix_error', "I don't know anything.", "I don't know nothing.", W, 'NEG.DOUBLE', "don't know nothing"],
  ['fix_error', "She didn't see anybody.", "She didn't see nobody.", W, 'NEG.DOUBLE', "didn't see nobody"],
  ['fix_error', "I don't have any money.", "I don't have no money.", W, 'NEG.DOUBLE', "don't have no money"],
  ['fix_error', "I don't know anything.", "I don't know anything.", C, null, null],
  ['fix_error', "I know nothing.", "I know nothing.", C, null, null],
  ['fix_error', 'It is very important to study.', 'Is very important to study.', W, 'SUBJ.OMIT', 'Is very important'],
  ['fix_error', 'It was difficult for me.', 'Was difficult for me.', W, 'SUBJ.OMIT', 'Was difficult'],
  ['fix_error', 'It is very important to study.', 'It is very important to study.', C, null, null],
  // ---- gerundio / infinitivo ----
  ['fix_error', 'I avoid speaking.', 'I avoid to speak.', W, 'GER.AVOID_TO', 'avoid to speak'],
  ['fix_error', 'He suggested going.', 'He suggested to go.', W, 'GER.AVOID_TO', 'suggested to go'],
  ['fix_error', 'I avoid speaking.', 'I avoid speaking.', C, null, null],
  ['fix_error', 'I want to speak.', 'I want to speak.', C, null, null],
  // ---- preposiciones dependientes ----
  ['fix_error', "I'm interested in music.", "I'm interested about music.", W, 'PREP.DEP', 'interested about'],
  ['fix_error', 'He is good at math.', 'He is good in math.', W, 'PREP.DEP', 'good in math'],
  ['fix_error', 'I arrived at the airport.', 'I arrived to the airport.', W, 'PREP.DEP', 'arrived to the airport'],
  ['fix_error', "I'm interested in music.", "I'm interested in music.", C, null, null],
  ['fix_error', 'He is good at math.', 'He is good at math.', C, null, null],
  ['fix_error', 'I arrived at the airport.', 'I arrived at the airport.', C, null, null],
  // ---- preguntas ----
  ['fix_error', 'Where does she live?', 'Where live she?', W, 'Q.WORD_ORDER', 'Where live she'],
  ['fix_error', 'Where does she live?', 'Where does she live?', C, null, null],
  // ---- conectores, futuros, causativas ----
  ['fix_error', 'Despite the rain we went out.', 'Despite of the rain we went out.', W, 'CONN.DESPITE_OF', 'Despite of'],
  ['fix_error', 'Despite the rain we went out.', 'Despite the rain we went out.', C, null, null],
  ['fix_error', 'I will graduate in June.', 'I will graduated in June.', W, 'FUT.WILL_PAST', 'I will graduated'],
  ['fix_error', 'I will graduate in June.', 'I will graduate in June.', C, null, null],
  ['fix_error', 'It makes me work.', 'It makes me works.', W, 'CAUS.MAKE_ME_WORKS', 'makes me works'],
  ['fix_error', 'He can swim.', 'He can swims.', W, 'VRB.THIRD_S_EXTRA', 'He can swims'],
  // ---- contables, adjetivos, mecánica ----
  ['fix_error', 'I carry a lot of luggage.', 'I carry many luggages.', W, 'NOUN.COUNT_UNCOUNT', 'luggages'],
  ['fix_error', 'It is the highest mountain.', 'It is the most high mountain.', W, 'ADJ.SUPERLATIVE', 'the most high'],
  ['fix_error', 'He is taller than me.', 'He is more taller than me.', W, 'ADJ.COMPARATIVE_DOUBLE', 'more taller'],
  ['fix_error', 'Yesterday I went home.', 'yesterday i went home.', C, null, null], // compare no distingue mayúsculas: la «i» minúscula no se califica
  ['fix_error', 'I study every day.', 'I study everyday.', W, 'MECH.EVERYDAY', 'everyday'],
  // ---- «casi»: errata de una letra NO es lo mismo que error de gramática ----
  ['fix_error', 'He has written it.', 'He has writen it.', A, null, null],
  ['fix_error', 'I passed the exam.', 'I pased the exam.', A, null, null],
  ['fix_error', 'Yesterday I passed the exam.', 'Yesterday I paseed the exam.', A, null, null],
  // ---- traducción de frase (la misma lógica base, sin trampa) ----
  ['translate_bank', 'She can swim.', 'She can to swim.', W, 'VRB.CAN_TO', 'can to swim'],
  ['translate_bank', 'I did not see him.', 'I did not saw him.', W, 'VRB.DOUBLE_PAST', 'did not saw'],
  ['translate_bank', 'We ate pizza.', 'We eated pizza.', W, 'VRB.IRREG_REGULARIZE', 'eated'],
  ['translate_bank', 'I have been studying.', 'I have been study.', W, 'TNS.PERF_FORM', 'have been study'],
  ['translate_bank', 'She can swim.', 'She can swim.', C, null, null],
  ['translate_bank', 'We ate pizza.', 'We ate pizza.', C, null, null],
  // ---- variantes y contracciones aceptadas (CA 1) ----
  ['fill_verb', ["don't", 'do not'], 'do not', C, null, null],
  ['fill_verb', ["don't", 'do not'], "don't", C, null, null],
  ['fill_verb', ["I'm", 'I am'], 'I am', C, null, null],
  ['fill_verb', ["isn't", 'is not'], 'is not', C, null, null],
  ['fill_verb', ['a lot', 'lots'], 'lots', C, null, null],
];

function grade(row) {
  const [type, accept, typed] = row;
  const item = { type, accept: [].concat(accept), situation: 'En el aeropuerto', prompt_en: type === 'fix_error' ? 'Texto con error.' : undefined };
  if (type === 'fix_error') return { item, g: withDetection(gradeFix(item, typed, { detect: DETECT }), { detect: DETECT }) };
  return { item, g: withDetection(gradeText(item, typed, {}), { detect: DETECT }) };
}

test('la tabla tiene al menos 80 respuestas y cubre los errores del diagnóstico', () => {
  assert.ok(ROWS.length >= 80, `hay ${ROWS.length} filas`);
  const codes = new Set(ROWS.map((r) => r[4]).filter(Boolean));
  for (const c of ['VRB.CAN_TO', 'VRB.DOUBLE_PAST', 'VRB.IRREG_REGULARIZE', 'TNS.PERF_FORM', 'TNS.SINCE_FOR', 'NEG.DOUBLE', 'SUBJ.OMIT', 'GER.AVOID_TO', 'PREP.DEP', 'Q.WORD_ORDER']) assert.ok(codes.has(c), `falta ${c}`);
  assert.ok(ROWS.filter((r) => r[3] === C).length >= 20, 'debe haber al menos 20 respuestas correctas (cero falsos positivos)');
});

test('tabla: veredicto, primer código y trozo registrado coinciden con el oráculo, y cada entrada la acepta errors.prepare', () => {
  const bad = [];
  ROWS.forEach((row, i) => {
    const [type, accept, typed, result, code, original] = row;
    const { item, g } = grade(row);
    const entries = errorEntries(item, g, { catalog: CATALOG });
    const first = Array.isArray(g.hits) && g.hits.length > 0 ? g.hits[0].code : null;
    const tag = `#${i + 1} ${type} «${typed}»`;
    if (g.result !== result) bad.push(`${tag}: veredicto ${g.result} ≠ ${result}`);
    if (first !== code) bad.push(`${tag}: código ${first} ≠ ${code}`);
    if (original === null) { if (entries.length !== 0) bad.push(`${tag}: no debía registrar y registró ${entries.map((e) => e.code)}`); } else if (entries[0]?.original !== original) bad.push(`${tag}: original «${entries[0]?.original}» ≠ «${original}»`);
    if (result !== W && g.errorCodes.some((c) => c === code && code !== null)) bad.push(`${tag}: un acierto o casi no debe llevar código de gramática`);
    for (const e of entries) {
      try { ERRORS.prepare({ ...e, itemId: 'tabla' }); } catch (err) { bad.push(`${tag}: errors.prepare rechaza la entrada (${err.message})`); }
      if (e.correction !== [].concat(accept)[0] && !([].concat(accept)).includes(e.correction)) bad.push(`${tag}: la corrección «${e.correction}» no es una respuesta aceptada`);
    }
  });
  assert.deepEqual(bad, []);
});

test('cero falsos positivos: ninguna respuesta correcta de la tabla produce aviso ni entrada', () => {
  for (const row of ROWS.filter((r) => r[3] === C)) {
    const { item, g } = grade(row);
    assert.equal((g.hits ?? []).length, 0, `«${row[2]}» avisó`);
    assert.deepEqual(errorEntries(item, g, { catalog: CATALOG }), []);
  }
});
