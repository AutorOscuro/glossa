// @purpose: Pruebas de las reglas del detector mecánico de errores: frases con error y frases correctas parecidas.
// Pruebas del cuarto 3, mitad A de la 1.6: reglas del detector mecánico. Por regla: frases con error (deben dar ESE código) y frases correctas parecidas (no deben dar nada).
// La tabla grande de ≥ 40 frases reales y las 30 de control (CA 2 y 3) llega en la mitad B.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createErrorDetector, detectRules, RULE_LIST, MAX_TEXT } from '../core/errorDetect.js';
import { createErrorHook } from '../core/errorHook.js';
import { createErrors } from '../core/errors.js';
import { createMemoryDb } from '../core/db.memory.js';
import { makeClock } from './_helpers.mjs';

const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));
const D = createErrorDetector({ catalog: CATALOG });
const codes = (t) => [...new Set(detectRules(t).map((h) => h.code))];

const BAD = {
  'VRB.CAN_TO': ["I didn't can to send it", 'so I can to send it', 'He could to be studying', 'You must to go now'],
  'VRB.DOUBLE_PAST': ["She didn't went home", 'I did not saw him', 'What did you said?', "We didn't wanted it"],
  'VRB.IRREG_REGULARIZE': ['He leaved early', 'We eated pizza', 'I buyed a car', 'She goed there'],
  'TNS.PERF_FORM': ['I have went to Cali', 'She has took the bus', 'They had came late', 'I have been study here'],
  'NEG.DOUBLE': ["I don't know nothing", "She didn't see nobody", 'I never saw nothing', "I don't have no money", "We can't go nowhere"],
  'SUBJ.OMIT': ['Is very important to study.', 'Was difficult for me', 'He left because is raining', 'Is necessary that you come.'],
  'PREP.DEP': ["I'm interested about music", 'It depends of you', 'We discussed about it', 'He is good in math', 'I arrived to the airport'],
  'MECH.CAP_I': ['yesterday i went home', "i'm tired", 'Then i left'],
  'MECH.EVERYDAY': ['I study everyday.', 'I run everyday at six', 'We practice everyday before class'],
  'TNS.SINCE_FOR': ["I'm living here since two years", 'I live here since 2010', "I've lived here for 2010", 'She works here since January'],
  'TNS.PP_PS': ['I have seen her yesterday', 'We have met two days ago', "I've lost my keys last week"],
  'FUT.WILL_PAST': ['I will graduated in June', 'She will went tomorrow'],
  'FUT.AUX_MIX': ["I've will sit here", 'He has can go'],
  'GER.AVOID_TO': ['I avoid to speak English', 'She suggested to go home', 'He enjoys to read'],
  'GER.INF_AFTER_PREP': ['I use it for learn English', 'Before to leave, call me', 'He left without to say goodbye'],
  'VRB.THIRD_S_EXTRA': ['He can swims', "She doesn't works here", "It didn't goes well"],
  'VRB.THIRD_S_OMIT': ['She like pizza', 'He go to school', "He don't know"],
  'Q.WORD_ORDER': ['Where live she?', 'Why go they there?'],
  'Q.AUX_OMIT': ['Where you live?', 'What you want?'],
  'CAUS.MAKE_ME_WORKS': ['My boss makes me works late', 'She let me to go', 'It made them to cry'],
  'ADJ.PLURAL': ['The movies were awesomes', 'They are importants'],
  'NOUN.COUNT_UNCOUNT': ['I need informations', 'She gave me many advices', 'There are many luggage here', 'How many time do you wait?', 'Much people came'],
  'NOUN.PLURAL_IRREG': ['The childs play', 'Two sheeps'],
  'ADJ.COMPARATIVE_DOUBLE': ['This is more better', 'He is the most best'],
  'ADJ.SUPERLATIVE': ['She is the most tall', 'He is more big than me'],
  'ADJ.BORED_BORING': ['I feel boring', 'We felt so confusing'],
  'ADJ.ADV_CONFUSION': ['He speaks English very good.', 'She sings good and dances'],
  'SPELL.GENERAL': ['Yesterdey was fun', 'I finaly arrived'],
  'SPELL.ES_INTERFERENCE': ['This semestre is hard', 'My carrer is good'],
  'LEX.CALQUE': ['In the other hand, I agree', 'I am agree with you', 'I have 20 years old'],
};

const GOOD = [
  // can/could/must + to legítimos o parecidos
  'I can do it', 'It is a must to see', 'I would like to go', 'You have to go now', 'I want to be able to swim', 'She used to live here',
  // did + pasado correcto
  "She didn't go home", 'What did you say?', 'Everything I did went wrong', 'What he did was wrong', 'I did my homework', "I didn't need it", 'Did you read it?',
  // negación
  "I can't believe nothing happened", "I didn't go because nothing was open", "I don't know anything", "It's not nothing", "I don't know. Nothing happened", "He didn't say no to the offer", 'I have nothing',
  // sujeto
  'Is it important?', 'It is very important to study.', 'Is true love possible?', 'Is this the one?', 'He stayed because it was raining',
  // preposiciones
  "I'm interested in music", 'It depends on you', 'We discussed it', 'He is good at math', 'He is good in bed', 'We arrived to find it closed', 'I arrived at the airport',
  // mecánica
  'I went home', "I'm tired. i.e. very tired", 'Everyday life is hard', 'An everyday task', 'We practice every day',
  // since/for
  "I've lived here for two years", 'I have lived here since 2010', 'I have been preparing for 2024', "She has been sick since Monday", 'It has been three years since I saw her', 'I have known him since two years ago', 'I have a ticket for Monday',
  // perfecto
  'I have seen her', 'She has been here since yesterday', 'I have been told that yesterday was fine', 'I have no idea what happened last night', 'I have notes from last week',
  // futuro
  'I will graduate in June', 'The will left everything to her', 'I will need it', 'The will says so', 'The can leaks', 'My tin can works', 'I will succeed',
  // gerundio
  'I avoid speaking English', 'She suggested going home', 'She suggested to John that he go', 'He finished to applause', 'Before leaving, call me', 'I use it for learning English', 'I use it to learn English',
  // tercera persona
  'He can swim', "She doesn't work here", 'She likes pizza', 'Does he have a car?', 'It is important that he go', 'Let it go',
  // preguntas
  'Where do you live?', 'How come you did not call?', 'What you need is love', 'Where does she live?',
  // causativas, adjetivos, sustantivos
  'My boss makes me work late', 'She made me tired', 'She made us drinks', 'They are awesome', 'I need information', 'There is a lot of luggage', 'How many times do you wait?', 'Many people came', 'The children play', 'Two sheep',
  'This is better', 'He is the best', 'She is the tallest', 'He is bigger than me', 'He goes to the most high school in town', 'The most important thing', 'I feel tired', 'It feels relaxing', 'He speaks English very well.', 'She plays good music', 'He speaks good English',
  'In my opinion, it is fine', 'On the other hand, I agree', 'I agree with you', 'I am 20 years old', 'I have 20 years of experience', 'Yesterday was fun', 'I finally arrived',
];

for (const [code, phrases] of Object.entries(BAD)) {
  test(`detecta ${code}`, () => {
    for (const p of phrases) assert.ok(codes(p).includes(code), `«${p}» debía dar ${code} y dio [${codes(p).join(', ')}]`);
  });
}

test('frases correctas parecidas: no dispara nada', () => {
  for (const p of GOOD) assert.deepEqual(codes(p), [], `«${p}» es correcta y dio [${codes(p).join(', ')}]`);
});

test('cada regla tiene un código del catálogo y todas las reglas de BAD existen', () => {
  for (const r of RULE_LIST) assert.ok(CATALOG.has(r.code), r.id);
  const used = new Set(RULE_LIST.map((r) => r.code));
  for (const c of Object.keys(BAD)) assert.ok(used.has(c), `ninguna regla da ${c}`);
  assert.equal(new Set(RULE_LIST.map((r) => r.id)).size, RULE_LIST.length);
});

test('createErrorDetector exige catálogo y lanza si un código de regla no existe', () => {
  assert.throws(() => createErrorDetector(), /catálogo/);
  assert.throws(() => createErrorDetector({ catalog: { has: () => false, get: () => null } }), /no está en el catálogo/);
});

test('hit: texto y posición exactos, con pista del catálogo', () => {
  const h = D.detect("I didn't can to send it")[0];
  assert.equal(h.code, 'VRB.CAN_TO');
  assert.equal(h.text, 'can to send');
  assert.equal("I didn't can to send it".slice(h.from, h.to), h.text);
  assert.equal(h.hint, CATALOG.hint('VRB.CAN_TO'));
  assert.ok(Object.isFrozen(h));
});

test('prioridad: impacto alto antes que bajo, aunque el bajo esté antes en la frase', () => {
  const hits = D.detect('yesterday i said I can to go');
  assert.deepEqual(hits.map((h) => h.code), ['VRB.CAN_TO', 'MECH.CAP_I']);
});

test('entradas hostiles no lanzan ni dan hits', () => {
  for (const x of [null, undefined, 5, {}, [], '', '   ', '¿¿??!!', '\u0000\u202e']) assert.deepEqual(detectRules(x), []);
  assert.deepEqual(detectRules('a'.repeat(100000)), []);
  const long = `${'word '.repeat(MAX_TEXT)}I can to go`;
  assert.deepEqual(detectRules(long), []); // más allá del tope no se lee
  const t0 = Date.now();
  detectRules("don't ".repeat(300) + 'nothing');
  assert.ok(Date.now() - t0 < 500);
});

test('apóstrofes tipográficos y mayúsculas se tratan igual', () => {
  assert.ok(codes('I didn’t CAN TO send it').includes('VRB.CAN_TO'));
  assert.ok(codes('She DIDN’T WENT home').includes('VRB.DOUBLE_PAST'));
});

test('classify: contrato del hook (mismo tamaño y orden, null sin veredicto)', async () => {
  const v = await D.classify([{ original: "I didn't can to send it" }, { original: 'I can do it' }, { original: null }, null, { original: 'yesterday i went' }]);
  assert.equal(v.length, 5);
  assert.equal(v[0].code, 'VRB.CAN_TO');
  assert.equal(v[0].origin, CATALOG.get('VRB.CAN_TO').origen_tipico);
  assert.equal(v[0].impact, 'high');
  assert.deepEqual(v[0].topics, [CATALOG.get('VRB.CAN_TO').temas_relacionados[0]]);
  assert.equal(v[1], null);
  assert.equal(v[2], null);
  assert.equal(v[3], null);
  assert.equal(v[4].code, 'MECH.CAP_I');
  await assert.rejects(() => D.classify('no es lista'));
});

test('enchufado al hook: anota el código y respeta el explícito', async () => {
  const db = createMemoryDb(); await db.open();
  const errors = createErrors({ db, catalog: CATALOG, clock: makeClock('2026-10-15T14:00:00.000Z') });
  const hook = createErrorHook({ errors, catalog: CATALOG, classifier: D });
  const r = await hook.classifyAndRecord([{ original: "I didn't can to send it", ts: '2026-10-15T13:00:00.000Z' }, { original: 'I can do it' }, { original: 'She leaved', code: 'LEX.CALQUE', ts: '2026-10-15T13:01:00.000Z' }]);
  assert.deepEqual(r.results.map((x) => x.status), ['recorded', 'unclassified', 'recorded']);
  assert.equal(r.results[0].result.record.code, 'VRB.CAN_TO');
  assert.equal(r.results[0].result.record.impact, 'high');
  assert.equal(r.results[2].result.record.code, 'LEX.CALQUE'); // el explícito gana (por defecto ni se consulta)
  assert.equal(r.classifier.sent, 2);
});

test('determinista y sin efectos: misma frase, mismo resultado', () => {
  const a = JSON.stringify(D.detect("yesterday i didn't can to go everyday"));
  assert.equal(a, JSON.stringify(D.detect("yesterday i didn't can to go everyday")));
});
