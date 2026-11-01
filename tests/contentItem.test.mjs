// @purpose: Pruebas de la validación estricta del Item común (core/contentItem.js).
// Pruebas de core/contentItem.js (subparte 1.3, cuarto 1, mitad B): validación estricta del Item común (8.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateItem, checkItem, ITEM_ID_RE, MEDIA_AUDIO_RE, ambiguousContractionGaps } from '../core/contentItem.js';
import { createReport } from '../core/contentRules.js';
import { ITEM_TYPES } from '../core/contentTypes.js';

// El ejemplo literal del contrato 8.3 (sin puntos suspensivos).
const item = (over = {}) => ({
  id: 'g.pp.0001',
  type: 'fix_error',
  topics: ['gram.present_perfect.for_since'],
  level: 'A2',
  facet: null,
  prompt_es: 'Corrige el error en la oración.',
  prompt_en: "I'm living here since two years.",
  data: {},
  accept: ["I've lived here for two years.", 'I have lived here for two years.', "I've been living here for two years."],
  distractors: [{ text: 'I live here since two years.', code: 'TNS.SINCE_FOR' }],
  explain_es: "Con 'for' + duración usamos present perfect porque la situación empezó antes y sigue.",
  grammar_note_es: 'Si usas have/has + participio, hablas de algo que empezó antes y sigue.',
  nuance_es: null,
  situation: 'Presentarse con un nuevo vecino',
  error_codes: ['TNS.SINCE_FOR'],
  audio: null,
  image: null,
  needs_ai: false,
  source: 'original',
  version: 1,
  ...over,
});
const probs = (res) => res.errors.map((e) => `${e.path}:${e.rule}`);
const warns = (res) => res.warnings.map((e) => `${e.path}:${e.rule}`);
const codes = new Set(['TNS.SINCE_FOR', 'VRB.CAN_TO']);
const ctx = { errorCodes: codes };

test('el ítem de ejemplo del contrato 8.3 pasa limpio', () => {
  const res = validateItem(item(), ctx);
  assert.deepEqual([res.ok, res.errors, res.warnings], [true, [], []]);
});

test('mínimo válido: solo los obligatorios (tipo de elección)', () => {
  const min = { id: 'v.body.0001', type: 'mcq_en_es', topics: ['vocab.body'], level: 'A1', prompt_es: '¿Qué significa knee?', data: {}, explain_es: 'Knee es rodilla.', source: 'original', version: 1 };
  const res = validateItem(min, { dataSpecs: {} }); // sin especificación de familia: aquí solo se prueba el Item común (el `data` real, en contentData.test.mjs)
  assert.deepEqual([res.ok, res.errors, res.warnings], [true, [], []]);
});

test('cada campo obligatorio ausente se informa con su ruta', () => {
  for (const k of ['id', 'type', 'topics', 'level', 'prompt_es', 'data', 'explain_es', 'source', 'version']) {
    const it = item(); delete it[k];
    assert.ok(probs(validateItem(it, ctx)).includes(`${k}:REQUIRED`), k);
  }
});

test('los opcionales se pueden omitir uno a uno', () => {
  for (const k of ['facet', 'prompt_en', 'distractors', 'grammar_note_es', 'nuance_es', 'situation', 'error_codes', 'audio', 'image', 'needs_ai']) {
    const it = item(); delete it[k];
    assert.equal(validateItem(it, ctx).ok, true, k);
  }
});

test('id: formato y tope', () => {
  assert.ok(ITEM_ID_RE.test('g.pp.0001') && ITEM_ID_RE.test('vocab.body.knee') && !ITEM_ID_RE.test('G.PP.1') && !ITEM_ID_RE.test('gpp') && !ITEM_ID_RE.test('g.pp.0001#0'));
  for (const bad of ['G.pp.1', 'gpp', 'g.pp.0001#0', 'g..pp', 'g.pp 1', 'g.ñ', 'a'.repeat(101)]) assert.deepEqual(probs(validateItem(item({ id: bad }), ctx)), ['id:FORMAT'], bad);
  assert.deepEqual(probs(validateItem(item({ id: 7 }), ctx)), ['id:TYPE']);
});

test('type: desconocido (con sugerencia), integrador y no-texto', () => {
  let res = validateItem(item({ type: 'fix_eror' }), ctx);
  assert.deepEqual(probs(res), ['type:UNKNOWN_TYPE']); assert.match(res.errors[0].message, /fix_error/);
  res = validateItem(item({ type: 'inventado_total' }), ctx);
  assert.deepEqual(probs(res), ['type:UNKNOWN_TYPE']); assert.doesNotMatch(res.errors[0].message, /quisiste/);
  for (const t of ['simulacro', 'daily_session', 'weekly_mission', 'detective_errors']) {
    res = validateItem(item({ type: t }), ctx);
    assert.deepEqual(probs(res), ['type:INTEGRATOR_TYPE'], t); assert.match(res.errors[0].message, /sesi/i);
  }
  for (const t of [5, null, {}, ['fix_error'], 'constructor', '__proto__', '']) assert.ok(probs(validateItem(item({ type: t }), ctx)).some((p) => p.startsWith('type:')), String(t));
});

test('topics: al menos uno, sin repetidos, ids de tema', () => {
  assert.deepEqual(probs(validateItem(item({ topics: [] }), ctx)), ['topics:LIST_SIZE']);
  assert.deepEqual(probs(validateItem(item({ topics: ['gram.a', 'gram.a'] }), ctx)), ['topics[1]:DUPLICATE']);
  assert.deepEqual(probs(validateItem(item({ topics: ['Gram.A'] }), ctx)), ['topics[0]:FORMAT']);
  assert.deepEqual(probs(validateItem(item({ topics: 'gram.a' }), ctx)), ['topics:TYPE']);
  assert.deepEqual(probs(validateItem(item({ topics: ['gram.a', 'gram.b', 'gram.c', 'gram.d', 'gram.e', 'gram.f'] }), ctx)), ['topics:LIST_SIZE']);
});

test('con ctx.topicIds, un tema que no existe es UNKNOWN_TOPIC (y sin ctx no se comprueba)', () => {
  const topicIds = new Set(['gram.present_perfect.for_since']);
  assert.equal(validateItem(item(), { ...ctx, topicIds }).ok, true);
  const res = validateItem(item({ topics: ['gram.present_perfect.for_since', 'gram.no_existe'] }), { ...ctx, topicIds });
  assert.deepEqual(probs(res), ['topics[1]:UNKNOWN_TOPIC']);
  assert.equal(validateItem(item({ topics: ['gram.no_existe'] }), ctx).ok, true);
});

test('level, facet, version', () => {
  assert.deepEqual(probs(validateItem(item({ level: 'A3' }), ctx)), ['level:ENUM']);
  for (const f of [0, 1, 2, null]) assert.equal(validateItem(item({ facet: f }), ctx).ok, true, String(f));
  for (const f of [3, -1]) assert.deepEqual(probs(validateItem(item({ facet: f }), ctx)), ['facet:RANGE'], String(f));
  assert.deepEqual(probs(validateItem(item({ facet: '0' }), ctx)), ['facet:TYPE']);
  for (const v of [0, 10000]) assert.deepEqual(probs(validateItem(item({ version: v }), ctx)), ['version:RANGE'], String(v));
  assert.deepEqual(probs(validateItem(item({ version: 1.5 }), ctx)), ['version:TYPE']);
});

test('source: solo original o ai_generated_unverified (chequeo anti-derechos)', () => {
  assert.equal(validateItem(item({ source: 'ai_generated_unverified' }), ctx).ok, true);
  for (const s of ['copied', 'Original', 'oxford', '', null, 1]) assert.ok(probs(validateItem(item({ source: s }), ctx)).some((p) => p.startsWith('source:')), String(s));
  assert.deepEqual(probs(validateItem(item({ source: 'oxford' }), ctx)), ['source:ENUM']);
});

test('textos: obligatorios, sin HTML ni vacío ni demasiado largos; multilínea solo en explicaciones', () => {
  assert.deepEqual(probs(validateItem(item({ prompt_es: '' }), ctx)), ['prompt_es:TEXT_EMPTY']);
  assert.deepEqual(probs(validateItem(item({ prompt_en: '<b>x</b>' }), ctx)), ['prompt_en:TEXT_HTML']);
  assert.deepEqual(probs(validateItem(item({ prompt_es: 'x'.repeat(601) }), ctx)), ['prompt_es:TEXT_TOO_LONG']);
  assert.deepEqual(probs(validateItem(item({ prompt_es: 'uno\ndos' }), ctx)), ['prompt_es:TEXT_CONTROL']);
  assert.equal(validateItem(item({ explain_es: 'uno\ndos' }), ctx).ok, true);
  assert.deepEqual(probs(validateItem(item({ explain_es: 'x'.repeat(2001) }), ctx)), ['explain_es:TEXT_TOO_LONG']);
  assert.deepEqual(probs(validateItem(item({ explain_es: '' }), ctx)), ['explain_es:TEXT_EMPTY']);
  assert.deepEqual(probs(validateItem(item({ grammar_note_es: '' }), ctx)), ['grammar_note_es:TEXT_EMPTY']);
  assert.deepEqual(probs(validateItem(item({ situation: 'a\u200Bb' }), ctx)), ['situation:TEXT_INVISIBLE']);
  assert.deepEqual(probs(validateItem(item({ nuance_es: '&amp;' }), ctx)), ['nuance_es:TEXT_HTML']);
  assert.equal(validateItem(item({ prompt_en: null, nuance_es: null, grammar_note_es: null, situation: null }), ctx).ok, true);
});

test('accept: lista de textos con ruta exacta, sin repetidos', () => {
  assert.deepEqual(probs(validateItem(item({ accept: ['ok', '<i>x</i>'] }), ctx)), ['accept[1]:TEXT_HTML']);
  assert.deepEqual(probs(validateItem(item({ accept: ['ok', 'ok'] }), ctx)), ['accept[1]:DUPLICATE']);
  assert.deepEqual(probs(validateItem(item({ accept: [''] }), ctx)), ['accept[0]:TEXT_EMPTY']);
  assert.deepEqual(probs(validateItem(item({ accept: 'ok' }), ctx)), ['accept:TYPE']);
  assert.deepEqual(probs(validateItem(item({ accept: Array.from({ length: 51 }, (_, i) => `r${i}`) }), ctx)), ['accept:LIST_SIZE']);
  assert.deepEqual(warns(validateItem(item({ accept: ['I am here.', 'i am here'] }), ctx)), ['accept[1]:ACCEPT_DUPLICATE']);
});

test('accept es obligatorio y no vacío SOLO en los tipos que se escriben', () => {
  for (const t of Object.keys(ITEM_TYPES)) {
    const needs = ITEM_TYPES[t].acceptRequired;
    const base = { type: t, needs_ai: !ITEM_TYPES[t].auto || false };
    for (const acc of [undefined, null, []]) {
      const it = item({ ...base }); if (acc === undefined) delete it.accept; else it.accept = acc;
      const hit = probs(validateItem(it, ctx)).includes('accept:ACCEPT_REQUIRED');
      assert.equal(hit, needs, `${t} con accept=${JSON.stringify(acc)}`);
    }
  }
});

test('distractors: textos con código existente; un distractor igual a una respuesta válida es un error', () => {
  assert.deepEqual(probs(validateItem(item({ distractors: [{ text: 'x', code: 'NOPE.CODE' }] }), ctx)), ['distractors[0].code:UNKNOWN_CODE']);
  assert.deepEqual(probs(validateItem(item({ distractors: [{ text: 'x', code: 'minus' }] }), ctx)), ['distractors[0].code:FORMAT']);
  assert.deepEqual(probs(validateItem(item({ distractors: [{ text: 'x' }] }), ctx)), []);
  assert.deepEqual(probs(validateItem(item({ distractors: [{ text: 'x', code: null }] }), ctx)), []);
  assert.deepEqual(probs(validateItem(item({ distractors: [{ code: 'TNS.SINCE_FOR' }] }), ctx)), ['distractors[0].text:REQUIRED']);
  assert.deepEqual(probs(validateItem(item({ distractors: [{ text: 'x', code: 'TNS.SINCE_FOR', otro: 1 }] }), ctx)), ['distractors[0].otro:UNKNOWN_FIELD']);
  assert.deepEqual(probs(validateItem(item({ distractors: 'x' }), ctx)), ['distractors:TYPE']);
  // igual a una aceptada (aunque cambien mayúsculas, puntuación final y contracción)
  assert.deepEqual(probs(validateItem(item({ distractors: [{ text: 'i HAVE lived here for two years', code: 'TNS.SINCE_FOR' }] }), ctx)), ['distractors[0].text:DISTRACTOR_IS_ANSWER']);
  assert.deepEqual(probs(validateItem(item({ distractors: [{ text: "I have been living here for two years!", code: 'TNS.SINCE_FOR' }] }), ctx)), ['distractors[0].text:DISTRACTOR_IS_ANSWER']);
});

test('error_codes: lista de códigos existentes, sin repetidos', () => {
  assert.deepEqual(probs(validateItem(item({ error_codes: ['NOPE.X'] }), ctx)), ['error_codes[0]:UNKNOWN_CODE']);
  assert.deepEqual(probs(validateItem(item({ error_codes: ['TNS.SINCE_FOR', 'TNS.SINCE_FOR'] }), ctx)), ['error_codes[1]:DUPLICATE']);
  assert.deepEqual(probs(validateItem(item({ error_codes: ['tns'] }), ctx)), ['error_codes[0]:FORMAT']);
  assert.equal(validateItem(item({ error_codes: ['NOPE.X'] })).ok, true); // sin catálogo no se comprueba la existencia
  assert.equal(validateItem(item({ error_codes: [] }), ctx).ok, true);
});

test('needs_ai: los tipos que solo se califican con IA deben declararlo', () => {
  const bare = { ...ctx, dataSpecs: {} }; // aquí solo importa needs_ai; el `data` de own_sentence_word se prueba en contentData.test.mjs
  const open = { type: 'own_sentence_word', accept: undefined, distractors: undefined, error_codes: undefined };
  const base = item(open); delete base.accept; delete base.distractors; delete base.error_codes;
  assert.deepEqual(probs(validateItem({ ...base, needs_ai: false }, bare)), ['needs_ai:AI_REQUIRED']);
  const noField = { ...base }; delete noField.needs_ai;
  assert.deepEqual(probs(validateItem(noField, bare)), ['needs_ai:AI_REQUIRED']);
  assert.equal(validateItem({ ...base, needs_ai: true }, bare).ok, true);
  assert.deepEqual(probs(validateItem(item({ needs_ai: 'sí' }), ctx)), ['needs_ai:TYPE']);
  assert.equal(validateItem(item({ needs_ai: true }), ctx).ok, true); // un autocalificable puede MEJORAR con IA
});

test('audio e image: ruta bajo audio/ o images/, sin escapar de la carpeta', () => {
  assert.ok(MEDIA_AUDIO_RE.test('audio/story.a1.0001.s1.mp3'));
  assert.equal(validateItem(item({ audio: 'audio/g.pp.0001.mp3' }), ctx).ok, true);
  assert.equal(validateItem(item({ image: 'images/knee.webp' }), ctx).ok, true);
  for (const a of ['g.pp.0001.mp3', '/audio/x.mp3', 'audio/../x.mp3', 'audio/a..b.mp3', 'audio/x.exe', 'audio/dir/x.mp3', 'http://x.com/a.mp3', 'audio/X.mp3', 'audio/x y.mp3']) {
    assert.deepEqual(probs(validateItem(item({ audio: a }), ctx)), ['audio:FORMAT'], a);
  }
  assert.deepEqual(probs(validateItem(item({ image: 'images/../x.png' }), ctx)), ['image:FORMAT']);
  assert.deepEqual(probs(validateItem(item({ audio: 3 }), ctx)), ['audio:TYPE']);
});

test('data: debe ser un objeto; sin especificación de la familia solo se comprueba eso', () => {
  const bare = { ...ctx, dataSpecs: {} };
  for (const d of [null, [], 'x', 3, true]) assert.ok(probs(validateItem(item({ data: d }), bare)).some((p) => p.startsWith('data:')), JSON.stringify(d));
  assert.deepEqual(probs(validateItem(item({ data: null }), bare)), ['data:TYPE']);
  assert.deepEqual(probs(validateItem(item({ data: [] }), bare)), ['data:TYPE']);
  assert.equal(validateItem(item({ data: { cualquier: { cosa: 1 } } }), bare).ok, true);
});

test('data: si el contexto trae la especificación de la familia, se aplica con su ruta', async () => {
  const { obj, text, list } = await import('../core/contentRules.js');
  const dataSpecs = { choice: obj({ options: list(text(), { min: 2, max: 6 }), correct: text() }) };
  const mcq = (data) => item({ type: 'mcq_en_es', data, accept: undefined });
  const ok = mcq({ options: ['rodilla', 'codo'], correct: 'rodilla' }); delete ok.accept;
  assert.equal(validateItem(ok, { ...ctx, dataSpecs }).ok, true);
  const bad = mcq({ options: ['rodilla'], correct: '<b>' }); delete bad.accept;
  assert.deepEqual(probs(validateItem(bad, { ...ctx, dataSpecs })), ['data.options:LIST_SIZE', 'data.correct:TEXT_HTML']);
  const other = item({ data: { lo_que_sea: 1 } }); // fix_error: su familia no tiene especificación en este ctx
  assert.equal(validateItem(other, { ...ctx, dataSpecs }).ok, true);
});

test("contracciones ambiguas: 's y 'd obligan a listar también la forma expandida (decisión del Administrador)", () => {
  const acc = (list) => validateItem(item({ accept: list, distractors: [] }), ctx);
  assert.deepEqual(probs(acc(["He's happy."])), ['accept[0]:CONTRACTION_PAIR_MISSING']);
  assert.match(acc(["He's happy."]).errors[0].message, /he is|he has/i);
  assert.equal(acc(["He's happy.", 'He is happy.']).ok, true);
  assert.equal(acc(["He's gone.", 'He has gone.']).ok, true);
  assert.deepEqual(probs(acc(["I'd go.", "I'd go there."])), ['accept[0]:CONTRACTION_PAIR_MISSING', 'accept[1]:CONTRACTION_PAIR_MISSING']);
  assert.equal(acc(["I'd go.", 'I would go.']).ok, true);
  assert.equal(acc(["I'd gone.", 'I had gone.']).ok, true);
  assert.equal(acc(["She'd come.", 'she would come']).ok, true); // mayúsculas y puntuación final no importan
  assert.equal(acc(["It's here.", 'It is here.']).ok, true);
  assert.equal(acc(["What's up?", 'What is up?']).ok, true);
  assert.equal(acc(["He\u2019s here.", 'He is here.']).ok, true); // apóstrofo curvo (ya lleva aviso aparte)
  assert.deepEqual(probs(acc(["He\u2019s here."])), ['accept[0]:CONTRACTION_PAIR_MISSING']);
  // dos contracciones en la misma respuesta: la expandida debe cubrir ambas
  assert.equal(acc(["He's sure she's right.", 'He is sure she is right.']).ok, true);
  assert.equal(acc(["He's sure she's right.", 'He is sure she has right.']).ok, true);
  assert.deepEqual(probs(acc(["He's sure she's right.", 'He is sure she\'s right.'])), ['accept[0]:CONTRACTION_PAIR_MISSING', 'accept[1]:CONTRACTION_PAIR_MISSING']);
});

test("contracciones: lo que NO es ambiguo no exige nada (posesivo, don't, I'm, let's, texto sin contracción)", () => {
  const acc = (list) => validateItem(item({ accept: list, distractors: [] }), ctx);
  for (const s of ["John's book.", "My sister's car is red.", "I don't know.", "I'm here.", "They're here.", "I've lived here.", "Let's go.", "It's", 'I have it.']) {
    if (s === "It's") continue;
    assert.equal(acc([s]).ok, true, s);
  }
  assert.deepEqual(probs(acc(["It's"])), ['accept[0]:CONTRACTION_PAIR_MISSING']);
});

test('ambiguousContractionGaps(lista) devuelve los índices sin pareja (reutilizable por los `data` del cuarto 2)', () => {
  assert.deepEqual(ambiguousContractionGaps(["He's here.", 'He is here.']), []);
  assert.deepEqual(ambiguousContractionGaps(["He's here.", "She'd go."]), [0, 1]);
  assert.deepEqual(ambiguousContractionGaps(['no hay nada', 5, null]), []);
  assert.deepEqual(ambiguousContractionGaps('no es lista'), []);
});

test('campos desconocidos: error (validación estricta)', () => {
  assert.deepEqual(probs(validateItem(item({ extra: 1 }), ctx)), ['extra:UNKNOWN_FIELD']);
  assert.deepEqual(probs(validateItem(item({ HTML: '<b>' }), ctx)), ['HTML:UNKNOWN_FIELD']);
});

test('checkItem escribe en un informe existente con una ruta base', () => {
  const r = createReport();
  checkItem(r, 'items[12]', item({ accept: ['ok', '<b>'] }), ctx);
  const res = r.result();
  assert.deepEqual(probs(res), ['items[12].accept[1]:TEXT_HTML']);
});

test('entradas que no son objeto, y objetos hostiles: nunca lanzan', () => {
  for (const bad of [null, undefined, 5, 'x', true, [], () => 1, Symbol('s')]) {
    const res = validateItem(bad, ctx);
    assert.equal(res.ok, false, String(typeof bad));
    assert.ok(res.errors.length >= 1);
  }
  const hostile = new Proxy({}, { get() { throw new Error('boom'); }, ownKeys() { throw new Error('boom'); } });
  assert.doesNotThrow(() => validateItem(hostile, ctx));
  assert.equal(validateItem(hostile, ctx).ok, false);
  const getter = item(); Object.defineProperty(getter, 'accept', { enumerable: true, get() { throw new Error('boom'); } });
  assert.doesNotThrow(() => validateItem(getter, ctx));
  const evil = item({ accept: [{ toString() { throw new Error('x'); } }] });
  assert.doesNotThrow(() => validateItem(evil, ctx));
  assert.doesNotThrow(() => validateItem(JSON.parse('{"__proto__": {"x": 1}, "id": "a.b"}'), ctx));
});

test('no modifica la entrada', () => {
  const it = item(); const before = JSON.stringify(it);
  validateItem(it, ctx); validateItem(item({ accept: ["He's"] }), ctx);
  assert.equal(JSON.stringify(it), before);
});

test('fuzz: 1000 ítems mutados al azar no lanzan y siempre devuelven un informe coherente', () => {
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const junk = [null, undefined, 0, -1, 1.5, NaN, Infinity, '', ' ', 'x', '<b>', 'a\u0000b', [], {}, [[]], { a: 1 }, true, () => 1, 'x'.repeat(5000), ["He's"], [{ text: 1 }]];
  const keys = Object.keys(item());
  for (let n = 0; n < 1000; n += 1) {
    const it = item();
    for (let m = 0; m < 1 + Math.floor(rnd() * 4); m += 1) {
      const k = keys[Math.floor(rnd() * keys.length)];
      const v = junk[Math.floor(rnd() * junk.length)];
      if (rnd() < 0.2) delete it[k]; else it[k] = v;
    }
    const res = validateItem(it, ctx);
    assert.equal(res.ok, res.errorTotal === 0);
    for (const p of [...res.errors, ...res.warnings]) assert.ok(typeof p.path === 'string' && typeof p.rule === 'string' && typeof p.message === 'string');
  }
});

test("contracciones: 'they'd', 'we'd' y 'you'd' también son ambiguas; un nombre que acaba en it/he NO lo es (Kit's)", () => {
  const acc = (list) => validateItem(item({ accept: list, distractors: [] }), ctx);
  assert.deepEqual(probs(acc(["They'd go."])), ['accept[0]:CONTRACTION_PAIR_MISSING']);
  assert.deepEqual(probs(acc(["We'd go."])), ['accept[0]:CONTRACTION_PAIR_MISSING']);
  assert.deepEqual(probs(acc(["You'd go."])), ['accept[0]:CONTRACTION_PAIR_MISSING']);
  assert.equal(acc(["They'd go.", 'They would go.']).ok, true);
  for (const s of ["Kit's bike is red.", "Whit's car.", "Rhett's dog."]) assert.equal(acc([s]).ok, true, s);
});

test('accept: dos respuestas idénticas dan UN error (DUPLICATE) y ningún aviso extra', () => {
  const res = validateItem(item({ accept: ['ok', 'ok'] }), ctx);
  assert.deepEqual([probs(res), warns(res)], [['accept[1]:DUPLICATE'], []]);
});

test('límites de lista: 20 distractores sí, 21 no; 10 códigos de error sí, 11 no', () => {
  const d = (n) => Array.from({ length: n }, (_, i) => ({ text: `mal ${i}`, code: null }));
  assert.equal(validateItem(item({ distractors: d(20) }), ctx).ok, true);
  assert.deepEqual(probs(validateItem(item({ distractors: d(21) }), ctx)), ['distractors:LIST_SIZE']);
  assert.equal(validateItem(item({ error_codes: Array.from({ length: 10 }, (_, i) => `TNS.C${i}`) }), ctx).errors.filter((e) => e.rule === 'LIST_SIZE').length, 0);
  assert.ok(probs(validateItem(item({ error_codes: Array.from({ length: 11 }, (_, i) => `TNS.C${i}`) }), ctx)).includes('error_codes:LIST_SIZE'));
});

test('audio e image: todas las extensiones permitidas, y no más', () => {
  for (const e of ['mp3', 'ogg', 'm4a', 'wav']) assert.equal(validateItem(item({ audio: `audio/x.${e}` }), ctx).ok, true, e);
  for (const e of ['png', 'jpg', 'jpeg', 'webp', 'svg']) assert.equal(validateItem(item({ image: `images/x.${e}` }), ctx).ok, true, e);
  for (const e of ['flac', 'aac', 'mp4']) assert.deepEqual(probs(validateItem(item({ audio: `audio/x.${e}` }), ctx)), ['audio:FORMAT'], e);
  for (const e of ['gif', 'bmp', 'exe']) assert.deepEqual(probs(validateItem(item({ image: `images/x.${e}` }), ctx)), ['image:FORMAT'], e);
  assert.deepEqual(probs(validateItem(item({ image: 'images/a..b.png' }), ctx)), ['image:FORMAT']);
});
