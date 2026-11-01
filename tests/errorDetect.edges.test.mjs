// @purpose: Pruebas de bordes del detector de errores: umbrales de distancia, cortes de frase y la misma frase en posiciones distintas.
// Pruebas de BORDES del detector (1.6, cuarto 3, roturas intencionales): umbrales de distancia, cortes de frase, ramas «y» / «o», y la misma frase en posiciones distintas.
// Completan a errorDetect.lists.test.mjs (palabra por palabra). Cada fila: [frase, código, fragmento exacto señalado | null = ese código NO debe aparecer].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createErrorDetector, detectRules } from '../core/errorDetect.js';

const CATALOG = createErrorCatalog(JSON.parse(fs.readFileSync(new URL('../content/taxonomy/error_codes.json', import.meta.url), 'utf8')));

const hits = (s, code) => detectRules(s).filter((h) => h.code === code);
const check = (rows) => {
  for (const [s, code, frag] of rows) {
    const h = hits(s, code);
    if (frag === null) assert.equal(h.length, 0, `«${s}» no debe dar ${code}`);
    else assert.ok(h.some((x) => x.text.toLowerCase() === frag.toLowerCase()), `«${s}» debe dar ${code} sobre «${frag}» (dio: ${JSON.stringify(h.map((x) => x.text))})`);
  }
};

test('can/could/must + to: distancia, determinante y verbo', () => check([
  ['I can to go.', 'VRB.CAN_TO', 'can to go'],
  ['I can to.', 'VRB.CAN_TO', null],
  ['I can to the store.', 'VRB.CAN_TO', null],
  ['The can to go.', 'VRB.CAN_TO', null],
]));

test('doble pasado: formas con did / didn\'t / didnt y la excepción de «used»', () => check([
  ['She didnt went home.', 'VRB.DOUBLE_PAST', 'didnt went'],
  ['She did not saw it.', 'VRB.DOUBLE_PAST', 'did not saw'],
  ['Did you went there?', 'VRB.DOUBLE_PAST', 'did you went'],
  ["I didn't asked him.", 'VRB.DOUBLE_PAST', "didn't asked"],
  ["I didn't was there.", 'VRB.DOUBLE_PAST', "didn't was"],
  ["They didn't were there.", 'VRB.DOUBLE_PAST', "didn't were"],
  ['Did you was there?', 'VRB.DOUBLE_PAST', null],
  ['Where did you used to live?', 'VRB.DOUBLE_PAST', null],
  ['I did not use it.', 'VRB.DOUBLE_PAST', null],
]));

test('perfecto mal formado: cada auxiliar, «not» en medio y «been + base»', () => check([
  ['He has went home.', 'TNS.PERF_FORM', 'has went'],
  ['She had went home.', 'TNS.PERF_FORM', 'had went'],
  ["I haven't went home.", 'TNS.PERF_FORM', "haven't went"],
  ["He hasn't went home.", 'TNS.PERF_FORM', "hasn't went"],
  ["She hadn't went home.", 'TNS.PERF_FORM', "hadn't went"],
  ["I've went home.", 'TNS.PERF_FORM', "i've went"],
  ['I have not went home.', 'TNS.PERF_FORM', 'have not went'],
  ['I have been studying here.', 'TNS.PERF_FORM', null],
  ['I have been told so.', 'TNS.PERF_FORM', null],
  ['I have gone home.', 'TNS.PERF_FORM', null],
]));

test('doble negación: distancia máxima, cortes y «no one»', () => check([
  ["I don't want to really say nothing.", 'NEG.DOUBLE', "don't want to really say nothing"],
  ["I don't want to really ever say nothing.", 'NEG.DOUBLE', null],
  ["I don't ask for nothing.", 'NEG.DOUBLE', "don't ask for nothing"],
  ['It was not really for nothing.', 'NEG.DOUBLE', null],
  ["I don't know because nothing.", 'NEG.DOUBLE', null],
  ["I don't know no one.", 'NEG.DOUBLE', "don't know no one"],
  ["I don't see nobody.", 'NEG.DOUBLE', "don't see nobody"],
  ["I don't go nowhere.", 'NEG.DOUBLE', "don't go nowhere"],
  ["I don't see nothing.", 'NEG.DOUBLE', "don't see nothing"],
  ['She is not saying nothing.', 'NEG.DOUBLE', 'not saying nothing'],
  ['Did you do nothing?', 'NEG.DOUBLE', null],
  ['I do not know nothing.', 'NEG.DOUBLE', 'do not know nothing'],
  ['She does not know nothing.', 'NEG.DOUBLE', 'does not know nothing'],
  ['He did not see nothing.', 'NEG.DOUBLE', 'did not see nothing'],
]));

test('doble negación: una sola señal por frase', () => {
  assert.equal(hits("I don't have no money nothing.", 'NEG.DOUBLE').length, 1);
});

test('sujeto omitido: adjetivo fuerte al final, adjetivo débil y «because is»', () => check([
  ['Is important.', 'SUBJ.OMIT', 'Is important'],
  ['Is easy.', 'SUBJ.OMIT', null],
  ['Is important in life.', 'SUBJ.OMIT', null],
  ['Is hard to say.', 'SUBJ.OMIT', 'Is hard'],
  ['He stayed because is cold.', 'SUBJ.OMIT', 'because is'],
  ['He stayed because it is cold.', 'SUBJ.OMIT', null],
]));

test('preposición dependiente: pares exactos, «arrive to», «good in»', () => check([
  ['I am interested about music.', 'PREP.DEP', 'interested about'],
  ['I am interested on music.', 'PREP.DEP', 'interested on'],
  ['It depend of you.', 'PREP.DEP', 'depend of'],
  ['It depends of you.', 'PREP.DEP', 'depends of'],
  ['It depended of you.', 'PREP.DEP', 'depended of'],
  ['It is depending of you.', 'PREP.DEP', 'depending of'],
  ['We discuss about it.', 'PREP.DEP', 'discuss about'],
  ['We discussed about it.', 'PREP.DEP', 'discussed about'],
  ['He discusses about it.', 'PREP.DEP', 'discusses about'],
  ['We are discussing about it.', 'PREP.DEP', 'discussing about'],
  ['It is similar than mine.', 'PREP.DEP', 'similar than'],
  ['According with the book.', 'PREP.DEP', 'According with'],
  ['She is responsible of it.', 'PREP.DEP', 'responsible of'],
  ['She is capable to do it.', 'PREP.DEP', 'capable to'],
  ['I arrived to the airport.', 'PREP.DEP', 'arrived to the airport'],
  ['We arrive to the airport.', 'PREP.DEP', 'arrive to the airport'],
  ['He arrives to the airport.', 'PREP.DEP', 'arrives to the airport'],
  ['We are arriving to the airport.', 'PREP.DEP', 'arriving to the airport'],
  ['I arrived to the.', 'PREP.DEP', null],
  ['I arrived to a house.', 'PREP.DEP', null],
  ['She is good in fixing cars.', 'PREP.DEP', 'good in fixing'],
  ['She is good in during the war.', 'PREP.DEP', null],
  ['Very good in math.', 'PREP.DEP', null],
  ['Good in math.', 'PREP.DEP', null],
]));

test('«i» minúscula: excepciones «(i)», «i.e.» y «i.» de lista; una sola señal por frase', () => {
  check([
    ['Use option (i) here.', 'MECH.CAP_I', null],
    ['It works, i.e. it is fine.', 'MECH.CAP_I', null],
    ['i. First item.', 'MECH.CAP_I', null],
    ['He said i.', 'MECH.CAP_I', 'i'],
    ['He and i went.', 'MECH.CAP_I', 'i'],
    ["i've been there.", 'MECH.CAP_I', "i've"],
    ["i'll go.", 'MECH.CAP_I', "i'll"],
    ["i'd go.", 'MECH.CAP_I', "i'd"],
  ]);
  assert.equal(hits('i went and i left.', 'MECH.CAP_I').length, 1);
});

test('everyday: al final, antes de preposición de la lista y con adjetivo/artículo delante', () => check([
  ['I study everyday.', 'MECH.EVERYDAY', 'everyday'],
  ['I study everyday at six.', 'MECH.EVERYDAY', 'everyday'],
  ['Everyday I study.', 'MECH.EVERYDAY', null],
  ['I study everyday English.', 'MECH.EVERYDAY', null],
]));

test('since / for: puntos en el tiempo y duraciones', () => check([
  ['I live here since 1999.', 'TNS.SINCE_FOR', 'live here since 1999'],
  ['I live here since yesterday.', 'TNS.SINCE_FOR', 'live here since yesterday'],
  ['I live here since last week.', 'TNS.SINCE_FOR', 'live here since last week'],
  ['I live here since last night.', 'TNS.SINCE_FOR', 'live here since last night'],
  ['I work here since last month.', 'TNS.SINCE_FOR', 'work here since last month'],
  ['I study here since last year and like it.', 'TNS.SINCE_FOR', 'study here since last year'],
  ['I live here since last Monday.', 'TNS.SINCE_FOR', 'live here since last monday'],
  ["I've lived here for last week.", 'TNS.SINCE_FOR', "i've lived here for last week"],
  ['She has worked here for last year.', 'TNS.SINCE_FOR', 'has worked here for last year'],
  ['I live here since last time.', 'TNS.SINCE_FOR', null],
  ['I work here since 12 years.', 'TNS.SINCE_FOR', 'since 12 years'],
  ['I work here since 5 years.', 'TNS.SINCE_FOR', 'since 5 years'],
  ["I've lived here for 2010.", 'TNS.SINCE_FOR', "i've lived here for 2010"],
  ['He has lived here for 2010.', 'TNS.SINCE_FOR', 'has lived here for 2010'],
  ['She had lived here for 2010.', 'TNS.SINCE_FOR', 'had lived here for 2010'],
  ['I have worked in Cali for 2010.', 'TNS.SINCE_FOR', 'have worked in cali for 2010'],
  ['I have been in Cali for 2010.', 'TNS.SINCE_FOR', 'have been in cali for 2010'],
  ['I have been busy for 2010.', 'TNS.SINCE_FOR', null],
  ['I have lived and worked here for 2010.', 'TNS.SINCE_FOR', null],
  ['I have waited lived here for 2010.', 'TNS.SINCE_FOR', null],
  ['I live in the city since 2010.', 'TNS.SINCE_FOR', 'live in the city since 2010'],
  ['I live there. Nice since 2010.', 'TNS.SINCE_FOR', null],
  ['I have worked there. Cali for 2010.', 'TNS.SINCE_FOR', null],
  ['I work here since two almost nearly over years.', 'TNS.SINCE_FOR', 'since two almost nearly over years'],
  ['I work here since two almost nearly over a years.', 'TNS.SINCE_FOR', null],
  ['I work since two years and then stay.', 'TNS.SINCE_FOR', 'since two years'],
  ['I work since two years ago.', 'TNS.SINCE_FOR', null],
  ['I work since two years.', 'TNS.SINCE_FOR', 'since two years'],
]));

test('since / for: una sola señal cuando hay dos verbos en presente', () => {
  assert.equal(hits('I live and work here since 2010.', 'TNS.SINCE_FOR').length, 1);
});

test('pretérito perfecto con marca de pasado: alcance de 4 palabras y cortes', () => check([
  ['I have seen my friend yesterday.', 'TNS.PP_PS', 'have seen my friend yesterday'],
  ['I have seen my best friend yesterday.', 'TNS.PP_PS', null],
  ['I have seen it. Yesterday was nice.', 'TNS.PP_PS', null],
  ['He has seen it yesterday.', 'TNS.PP_PS', 'has seen it yesterday'],
  ["I've seen him last Friday.", 'TNS.PP_PS', "i've seen him last friday"],
  ['I have seen him last time.', 'TNS.PP_PS', null],
  ['We have met two days ago.', 'TNS.PP_PS', 'have met two days ago'],
]));

test('pretérito perfecto con marca de pasado: una sola señal', () => {
  assert.equal(hits('I have seen him yesterday last week.', 'TNS.PP_PS').length, 1);
});

test('will + pasado: posición de «will» y sujeto', () => check([
  ['I will went.', 'FUT.WILL_PAST', 'I will went'],
  ['Then I will went there.', 'FUT.WILL_PAST', 'I will went'],
  ['She will wanted it.', 'FUT.WILL_PAST', 'She will wanted'],
  ['The will went.', 'FUT.WILL_PAST', null],
  ['Will went.', 'FUT.WILL_PAST', null],
]));

test('have + modal + verbo: cada auxiliar', () => check([
  ['He has can go.', 'FUT.AUX_MIX', 'has can go'],
  ['I have will go.', 'FUT.AUX_MIX', 'have will go'],
  ['He had can go.', 'FUT.AUX_MIX', 'had can go'],
  ['He has can.', 'FUT.AUX_MIX', null],
]));

test('infinitivo tras preposición: «instead of to» y «for visit»', () => check([
  ['I stayed instead of to go out.', 'GER.INF_AFTER_PREP', 'of to go'],
  ['I think of to go home.', 'GER.INF_AFTER_PREP', null],
  ['I use it for visit new words.', 'GER.INF_AFTER_PREP', 'for visit'],
  ['Check the hours for visit hours.', 'GER.INF_AFTER_PREP', null],
]));

test('tercera persona sobrante: auxiliares, «has» y sujeto de can/will', () => check([
  ['She doesnt works here.', 'VRB.THIRD_S_EXTRA', 'doesnt works'],
  ["They don't works here.", 'VRB.THIRD_S_EXTRA', "don't works"],
  ['She does not works here.', 'VRB.THIRD_S_EXTRA', 'does not works'],
  ['She did not goes there.', 'VRB.THIRD_S_EXTRA', 'did not goes'],
  ["She doesn't has it.", 'VRB.THIRD_S_EXTRA', "doesn't has"],
  ['She does not has it.', 'VRB.THIRD_S_EXTRA', 'does not has'],
  ['He can swims.', 'VRB.THIRD_S_EXTRA', 'he can swims'],
  ['He will goes there.', 'VRB.THIRD_S_EXTRA', 'he will goes'],
  ['She should goes there.', 'VRB.THIRD_S_EXTRA', 'she should goes'],
  ['The will says so.', 'VRB.THIRD_S_EXTRA', null],
  ['The can leaks.', 'VRB.THIRD_S_EXTRA', null],
  ['My brother will goes there.', 'VRB.THIRD_S_EXTRA', null],
  ['Can goes home?', 'VRB.THIRD_S_EXTRA', null],
]));

test('tercera persona omitida: subjuntivo y «don\'t»', () => check([
  ['She like pizza.', 'VRB.THIRD_S_OMIT', 'She like'],
  ["He don't know.", 'VRB.THIRD_S_OMIT', "He don't"],
  ['I suggest he go home.', 'VRB.THIRD_S_OMIT', null],
  ['It is important that she go home.', 'VRB.THIRD_S_OMIT', null],
  ['I think he go home.', 'VRB.THIRD_S_OMIT', 'he go'],
]));

test('preguntas: empiezan la frase; «how come» no cuenta', () => check([
  ['Where live she?', 'Q.WORD_ORDER', 'Where live she'],
  ['Well. Where live she?', 'Q.WORD_ORDER', 'Where live she'],
  ['I ask where live she.', 'Q.WORD_ORDER', null],
  ['How come he works?', 'Q.WORD_ORDER', null],
  ['Where you live?', 'Q.AUX_OMIT', 'Where you live'],
  ['I know where you live.', 'Q.AUX_OMIT', null],
  ['Where you live.', 'Q.AUX_OMIT', null],
]));

test('causativas: «to» o verbo en tercera persona tras el objeto', () => check([
  ['He makes me to go.', 'CAUS.MAKE_ME_WORKS', 'makes me to go'],
  ['She makes me works late.', 'CAUS.MAKE_ME_WORKS', 'makes me works'],
  ['She makes me happy.', 'CAUS.MAKE_ME_WORKS', null],
]));

test('contable / incontable: «many», «much» y plurales inventados', () => check([
  ['She has many luggage.', 'NOUN.COUNT_UNCOUNT', 'many luggage'],
  ['She has few furniture.', 'NOUN.COUNT_UNCOUNT', 'few furniture'],
  ['She has several advice.', 'NOUN.COUNT_UNCOUNT', 'several advice'],
  ['She has many time.', 'NOUN.COUNT_UNCOUNT', 'many time'],
  ['She has much people.', 'NOUN.COUNT_UNCOUNT', 'much people'],
  ['She has a few friends.', 'NOUN.COUNT_UNCOUNT', null],
  ['She has little time.', 'NOUN.COUNT_UNCOUNT', null],
]));

test('comparativo y superlativo dobles', () => check([
  ['It is more better.', 'ADJ.COMPARATIVE_DOUBLE', 'more better'],
  ['It is the most best.', 'ADJ.COMPARATIVE_DOUBLE', 'most best'],
  ['It is the most big thing.', 'ADJ.SUPERLATIVE', 'the most big'],
  ['It is more big than mine.', 'ADJ.SUPERLATIVE', 'more big than'],
  ['It is more big.', 'ADJ.SUPERLATIVE', null],
  ['It is the most old fashioned thing.', 'ADJ.SUPERLATIVE', null],
  ['It is the most old school thing.', 'ADJ.SUPERLATIVE', null],
]));

test('aburrido / aburrido: sujeto y verbo de «feel»', () => check([
  ['You feel boring.', 'ADJ.BORED_BORING', 'You feel boring'],
  ['We felt boring.', 'ADJ.BORED_BORING', 'We felt boring'],
  ['I am feeling boring.', 'ADJ.BORED_BORING', null],
  ['They feel boring.', 'ADJ.BORED_BORING', null],
]));

test('adverbio / adjetivo: final de frase', () => check([
  ['He speaks English very good.', 'ADJ.ADV_CONFUSION', 'speaks English very good'],
  ['He speaks good English.', 'ADJ.ADV_CONFUSION', null],
  ['He plays good in the park.', 'ADJ.ADV_CONFUSION', null],
]));

test('calcos: «have/has + edad», «in the other hand», «am agree»', () => check([
  ['I have 22 years old.', 'LEX.CALQUE', 'I have 22 years old'],
  ['I have 22 years.', 'LEX.CALQUE', 'I have 22 years'],
  ['I have 22 years of experience.', 'LEX.CALQUE', null],
  ['She has twenty years old.', 'LEX.CALQUE', 'She has twenty years old'],
  ['In the other hand, I agree.', 'LEX.CALQUE', 'In the other hand'],
  ['I am agree.', 'LEX.CALQUE', 'am agree'],
  ["I'm agree.", 'LEX.CALQUE', "I'm agree"],
]));

// La misma frase con 1, 2 o 3 palabras delante: ninguna regla debe depender de que el error caiga en una posición par o impar.
const PER_RULE = {
  'VRB.CAN_TO': 'You must to go now.', 'VRB.DOUBLE_PAST': "She didn't went home.", 'VRB.IRREG_REGULARIZE': 'We eated pizza.',
  'TNS.PERF_FORM': 'I have went to Cali.', 'NEG.DOUBLE': "I don't know nothing.", 'SUBJ.OMIT': 'Is very important to study.',
  'PREP.DEP': "I'm interested about music.", 'MECH.CAP_I': 'then i left.', 'MECH.EVERYDAY': 'I run everyday at six.',
  'TNS.SINCE_FOR': 'I live here since 2010.', 'TNS.PP_PS': 'I have seen her yesterday.', 'FUT.WILL_PAST': 'I will graduated in June.',
  'FUT.AUX_MIX': 'He has can go.', 'GER.AVOID_TO': 'I avoid to speak English.', 'GER.INF_AFTER_PREP': 'He left without to say goodbye.',
  'VRB.THIRD_S_EXTRA': 'He can swims.', 'VRB.THIRD_S_OMIT': 'She like pizza.', 'Q.WORD_ORDER': 'Where live she?', 'Q.AUX_OMIT': 'Where you live?',
  'CAUS.MAKE_ME_WORKS': 'My boss makes me works late.', 'ADJ.PLURAL': 'They are importants.', 'NOUN.COUNT_UNCOUNT': 'I need informations.',
  'NOUN.PLURAL_IRREG': 'The childs play.', 'ADJ.COMPARATIVE_DOUBLE': 'This is more better.', 'ADJ.SUPERLATIVE': 'She is the most tall.',
  'ADJ.BORED_BORING': 'I feel boring.', 'ADJ.ADV_CONFUSION': 'He speaks English very good.', 'SPELL.GENERAL': 'I finaly arrived.',
  'SPELL.ES_INTERFERENCE': 'My carrer is good.', 'LEX.CALQUE': 'I have 20 years old.', 'CONN.DESPITE_OF': 'Despite of the rain, we left.',
};
test('cada regla se activa con 0, 1, 2 y 3 palabras delante', () => {
  for (const [code, sentence] of Object.entries(PER_RULE)) {
    for (const prefix of ['', 'Ok. ', 'Ok well. ', 'Ok so well. ']) {
      const s = prefix + sentence;
      assert.ok(hits(s, code).length >= 1, `«${s}» debe dar ${code}`);
    }
  }
});

// ── Segunda tanda de roturas: las 55 variantes que seguían vivas tras las pruebas por lista. Cada fila sale de una búsqueda diferencial (frase donde el original y la variante rota dan distinto).
test('doble negación: «do/does/did» sin «not» no cuentan; contracciones con otros auxiliares; cortes de frase', () => check([
  ['I do see nothing.', 'NEG.DOUBLE', null],
  ['She does see nothing.', 'NEG.DOUBLE', null],
  ['He did see nothing.', 'NEG.DOUBLE', null],
  ['I did not nothing.', 'NEG.DOUBLE', 'did not nothing'],
  ["She doesn't have no friends.", 'NEG.DOUBLE', "doesn't have no friends"],
  ["He didn't have no money.", 'NEG.DOUBLE', "didn't have no money"],
  ["I haven't got no time.", 'NEG.DOUBLE', "haven't got no time"],
  ["She hasn't got no time.", 'NEG.DOUBLE', "hasn't got no time"],
  ["He hadn't got no time.", 'NEG.DOUBLE', "hadn't got no time"],
  ["I don't have no.", 'NEG.DOUBLE', null],
  ["I don't know no one home.", 'NEG.DOUBLE', null],
]));

test('doble negación: una sola señal aunque haya dos «nothing» / «no one» en el alcance', () => {
  assert.deepEqual(hits("I don't see nothing else nobody.", 'NEG.DOUBLE').map((h) => h.text), ["don't see nothing"]);
  assert.deepEqual(hits("I don't know no one else no one.", 'NEG.DOUBLE').map((h) => h.text), ["don't know no one"]);
});

test('bordes sueltos de otras reglas (adjetivo fuerte seguido de palabra, «(i …)», edad, subjuntivo, causativas, «feeling», «Despite of»)', () => check([
  ['Is important now.', 'SUBJ.OMIT', null],
  ['Well (i think so).', 'MECH.CAP_I', 'i'],
  ['I have 22 years old.', 'TNS.PP_PS', null],
  ['Suggest he go home.', 'VRB.THIRD_S_OMIT', null],
  ['She makes Mary to go.', 'CAUS.MAKE_ME_WORKS', null],
  ['She makes me to the park.', 'CAUS.MAKE_ME_WORKS', null],
  ['I feeling boring.', 'ADJ.BORED_BORING', 'I feeling boring'],
  ['Despite of the rain, we left.', 'CONN.DESPITE_OF', 'Despite of'],
]));

test('orden de las señales: por posición y, si empatan, por orden de regla', () => {
  assert.deepEqual(detectRules('yesterday i said I can to go').map((h) => h.code), ['MECH.CAP_I', 'VRB.CAN_TO']);
  assert.deepEqual(detectRules("i've lived here for 2010").map((h) => `${h.code}:${h.text}`), ["MECH.CAP_I:i've", "TNS.SINCE_FOR:i've lived here for 2010"]);
});

test('orden de detect(): primero el impacto, luego la regla y la posición', () => {
  const det = createErrorDetector({ catalog: CATALOG });
  assert.deepEqual(det.detect('yesterday i said I can to go').map((h) => h.code), ['VRB.CAN_TO', 'MECH.CAP_I']);
  assert.deepEqual(det.detect("i've lived here for 2010").map((h) => h.code), ['TNS.SINCE_FOR', 'MECH.CAP_I']);
  assert.deepEqual(det.detect("He don't goes.").map((h) => h.code), ['VRB.THIRD_S_EXTRA', 'VRB.THIRD_S_OMIT']);
});

test('createErrorDetector exige un catálogo con has() y get()', () => {
  assert.throws(() => createErrorDetector({}), /falta el catálogo/);
  assert.throws(() => createErrorDetector({ catalog: { has() { return true; } } }), /falta el catálogo/);
  assert.throws(() => createErrorDetector({ catalog: { get() { return null; } } }), /falta el catálogo/);
});

test('since last week: el señalamiento cubre la expresión completa (from/to), con mayúsculas, comillas curvas, emoji y fin de texto', () => {
  const span = (s) => { const h = hits(s, 'TNS.SINCE_FOR'); assert.equal(h.length, 1, `«${s}»: ${h.length} señales`); return s.slice(h[0].from, h[0].to); };
  assert.equal(span('I live here since last week.'), 'live here since last week');
  assert.equal(span('I LIVE HERE SINCE LAST WEEK.'), 'LIVE HERE SINCE LAST WEEK');
  assert.equal(span('I live here since last week'), 'live here since last week'); // sin punto final
  assert.equal(span('😀 I live here since last week 😀'), 'live here since last week');
  assert.equal(span('I live here since last week, and I like it.'), 'live here since last week');
  assert.equal(span('I\u2019ve lived here for last week.'), 'I\u2019ve lived here for last week'); // comilla curva en «I've»
  assert.equal(span('I live here since last   week.'), 'live here since last   week'); // espacios de más
  assert.equal(span('I live here since yesterday.'), 'live here since yesterday'); // los puntos de una palabra no cambian
  assert.equal(span('I live here since 2010.'), 'live here since 2010');
  check([
    ['I live here since last', 'TNS.SINCE_FOR', null], // «last» sin unidad: no es un punto en el tiempo
    ['I live here since last, honestly.', 'TNS.SINCE_FOR', null],
    ['I have lived here since last week.', 'TNS.SINCE_FOR', null], // correcta: perfecto + since
    ['I have lived here for a week.', 'TNS.SINCE_FOR', null], // correcta: perfecto + for + duración
  ]);
  const edge = `${'x '.repeat(996)}I live since last week`; // la unidad cae pasado MAX_TEXT: no debe romper ni señalar a medias
  assert.doesNotThrow(() => detectRules(edge));
  for (const h of hits(edge, 'TNS.SINCE_FOR')) assert.ok(h.to <= 2000 && h.from < h.to);
});
