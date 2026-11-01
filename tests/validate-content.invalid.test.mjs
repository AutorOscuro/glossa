// @purpose: Comprueba que 25 paquetes inválidos (uno por regla) se rechazan con mensaje claro y que el comando sale con código distinto de 0.
// CA-2 de la 1.3: «25 paquetes inválidos (uno por regla) son rechazados con mensaje claro» y CA-4: el CLI sale con código ≠ 0.
// Cada caso parte del paquete de muestra (que pasa limpio), le rompe UNA regla y comprueba:
//   (1) que `validateContent` devuelve exactamente los errores esperados, con su ruta (`items[12].accept[0]`) y su código estable;
//   (2) que el mensaje dice algo útil (patrón `msg`);
//   (3) que el comando real (`node tools/validate-content.mjs`) sale con código 1 y deja el error en pantalla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateContent } from '../tools/validate-content.mjs';
import { makeRepo, loadSample, REPO } from './_samplePack.mjs';

const CLI = path.join(REPO, 'tools', 'validate-content.mjs');
const NAME = 'sample_pack_v1.json'; // se llama como su pack_id: así no hay aviso de nombre y cada caso prueba solo su regla

// Índices del paquete de muestra (ver tests/fixtures/sample_pack_v1.json).
const FIX = 0; // fix_error con distractor, tema for_since
const FIX2 = 1; // fix_error con contracciones 's
const CHOICE = 4; // choose_correct (choice) de 4 opciones, la correcta es la 1
const CLOZE = 14; // cloze_bank con 2 huecos

// { rule: regla principal (una distinta por caso), mutate(pack, repo?), expect: ['ruta:CÓDIGO', …] (exacto), msg: patrón del mensaje principal }
const CASES = [
  { name: 'schema distinto de 1', rule: 'ENUM(schema)', mutate: (p) => { p.schema = 2; }, expect: ['schema:ENUM'], msg: /debe ser uno de: 1/ },
  { name: 'pack_id con mayúsculas y guion', rule: 'FORMAT(pack_id)', mutate: (p) => { p.pack_id = 'Gram-X'; }, expect: ['pack_id:FORMAT'], msg: /id de paquete/ },
  { name: 'version 0', rule: 'RANGE(version)', mutate: (p) => { p.version = 0; }, expect: ['version:RANGE'], msg: /entre 1 y 9999/ },
  { name: 'fecha inexistente (30 de febrero)', rule: 'FORMAT(created)', mutate: (p) => { p.created = '2026-02-30'; }, expect: ['created:FORMAT'], msg: /fecha real/ },
  { name: 'falta un campo obligatorio', rule: 'REQUIRED', mutate: (p) => { delete p.title_es; }, expect: ['title_es:REQUIRED'], msg: /falta este campo/ },
  { name: 'campo desconocido en la raíz', rule: 'UNKNOWN_FIELD', mutate: (p) => { p.tags = ['x']; }, expect: ['tags:UNKNOWN_FIELD'], msg: /campo desconocido/ },
  { name: 'paquete vacío', rule: 'PACK_EMPTY', mutate: (p) => { p.items = []; delete p.lexicon; delete p.stories; }, expect: [':PACK_EMPTY'], msg: /no trae ejercicios/ },
  { name: 'id de ítem repetido en el paquete', rule: 'DUPLICATE', mutate: (p) => { p.items[1].id = p.items[0].id; }, expect: ['items[1].id:DUPLICATE'], msg: /ya existe en items\[0\]/ },
  { name: 'tema que no existe en topics.json', rule: 'UNKNOWN_TOPIC', mutate: (p) => { p.topics.push('gram.no.existe'); p.items[0].topics = ['gram.no.existe']; },
    expect: ['items[0].topics[0]:UNKNOWN_TOPIC', 'topics[2]:UNKNOWN_TOPIC'], msg: /no existe en content\/taxonomy\/topics\.json/ },
  { name: 'tema existente pero fuera de la lista del paquete', rule: 'ITEM_TOPIC_NOT_IN_PACK', mutate: (p) => { p.items[0].topics = ['gram.present_perfect.form']; }, expect: ['items[0].topics[0]:ITEM_TOPIC_NOT_IN_PACK'], msg: /no está en la lista topics/ },
  { name: 'tipo mal escrito (con sugerencia)', rule: 'UNKNOWN_TYPE', mutate: (p) => { p.items[FIX].type = 'fix_eror'; }, expect: ['items[0].type:UNKNOWN_TYPE'], msg: /¿quisiste decir "fix_error"\?/ },
  { name: 'integrador usado como ítem', rule: 'INTEGRATOR_TYPE', mutate: (p) => { p.items[FIX].type = 'daily_session'; }, expect: ['items[0].type:INTEGRATOR_TYPE'], msg: /sesión que arma la app/ },
  { name: 'tipo que se escribe sin accept', rule: 'ACCEPT_REQUIRED', mutate: (p) => { p.items[FIX].accept = null; }, expect: ['items[0].accept:ACCEPT_REQUIRED'], msg: /necesita al menos una respuesta válida/ },
  { name: 'tipo solo-IA sin needs_ai', rule: 'AI_REQUIRED', mutate: (p) => { Object.assign(p.items[FIX], { type: 'own_sentence_word', data: { target: 'deadline' }, accept: null, distractors: [], error_codes: [] }); },
    expect: ['items[0].needs_ai:AI_REQUIRED'], msg: /solo se califica con IA/ },
  { name: 'distractor igual a una respuesta válida', rule: 'DISTRACTOR_IS_ANSWER', mutate: (p) => { p.items[FIX].distractors[0].text = "I've lived here for two years."; },
    expect: ['items[0].distractors[0].text:DISTRACTOR_IS_ANSWER'], msg: /igual a una respuesta válida/ },
  { name: "contracción ambigua sin su forma completa ('s)", rule: 'CONTRACTION_PAIR_MISSING', mutate: (p) => { p.items[FIX2].accept = ["She's worked at the bank since 2019.", "She's been working at the bank since 2019."]; },
    expect: ['items[1].accept[0]:CONTRACTION_PAIR_MISSING', 'items[1].accept[1]:CONTRACTION_PAIR_MISSING'], msg: /agrega también la forma expandida/ },
  { name: 'código de error que no existe en el catálogo', rule: 'UNKNOWN_CODE', mutate: (p) => { p.items[FIX].distractors[0].code = 'TNS.NO_EXISTE'; },
    expect: ['items[0].distractors[0].code:UNKNOWN_CODE'], msg: /no existe en content\/taxonomy\/error_codes\.json/ },
  { name: 'opción incorrecta sin distractor', rule: 'CHOICE_DISTRACTOR_MISSING', mutate: (p) => { p.items[CHOICE].distractors = p.items[CHOICE].distractors.filter((d) => d.text !== 'live'); },
    expect: ['items[4].data.options[0]:CHOICE_DISTRACTOR_MISSING'], msg: /no tiene su distractor con code/ },
  { name: 'HTML en un texto', rule: 'TEXT_HTML', mutate: (p) => { p.items[FIX].explain_es = 'Usa <b>for</b> con una duración.'; }, expect: ['items[0].explain_es:TEXT_HTML'], msg: /no puede llevar HTML/ },
  { name: 'carácter de control (tabulador)', rule: 'TEXT_CONTROL', mutate: (p) => { p.items[FIX].prompt_es = 'Corrige\tla oración.'; }, expect: ['items[0].prompt_es:TEXT_CONTROL'], msg: /caracteres de control/ },
  { name: 'texto demasiado largo', rule: 'TEXT_TOO_LONG', mutate: (p) => { p.items[FIX].prompt_en = 'a'.repeat(601); }, expect: ['items[0].prompt_en:TEXT_TOO_LONG'], msg: /supera 600 caracteres/ },
  { name: 'carácter invisible (ancho cero)', rule: 'TEXT_INVISIBLE', mutate: (p) => { p.items[FIX].explain_es = 'Usa for\u200B con una duración.'; }, expect: ['items[0].explain_es:TEXT_INVISIBLE'], msg: /caracteres invisibles/ },
  { name: 'source distinto de original (anti-derechos)', rule: 'ENUM(source)', mutate: (p) => { p.items[FIX].source = 'cita_de_pelicula'; }, expect: ['items[0].source:ENUM'], msg: /original, ai_generated_unverified/ },
  { name: 'correct fuera de rango en data', rule: 'RANGE(data)', mutate: (p) => { p.items[CHOICE].data.correct = 9; }, expect: ['items[4].data.correct:RANGE'], msg: /entero 0–7/ },
  { name: 'huecos y respuestas que no coinciden en un cloze', rule: 'CLOZE_BLANKS_MISMATCH', mutate: (p) => { p.items[CLOZE].data.answers = [['since']]; }, expect: ['items[14].data.answers:CLOZE_BLANKS_MISMATCH'], msg: /2 hueco\(s\) y answers tiene 1 lista\(s\)/ },
  { name: 'campo desconocido dentro de data', rule: 'UNKNOWN_FIELD(data)', mutate: (p) => { p.items[12].data.extra = 1; }, expect: ['items[12].data.extra:UNKNOWN_FIELD'], msg: /campo desconocido/ },
  { name: 'ruta de audio con ..', rule: 'FORMAT(audio)', mutate: (p) => { p.items[FIX].audio = 'audio/../secreto.mp3'; }, expect: ['items[0].audio:FORMAT'], msg: /ruta como audio\// },
  { name: 'palabra cuyo id no empieza por su familia', rule: 'LEX_FAMILY_MISMATCH', mutate: (p) => { p.lexicon[0].family = 'vocab.body'; }, expect: ['lexicon[0].id:LEX_FAMILY_MISMATCH'], msg: /debe empezar por la familia/ },
  { name: 'pregunta de historia que no es de lectura ni de escucha', rule: 'STORY_QUESTION_TYPE', mutate: (p) => { Object.assign(p.stories[0].questions[0], { type: 'mcq_en_es', data: { options: ['Dos años', 'Dos meses', 'Dos días'], correct: 0 } }); },
    expect: ['stories[0].questions[0].type:STORY_QUESTION_TYPE'], msg: /lectura o de escucha/ },
  { name: 'id que ya existe en OTRO paquete instalado', rule: 'DUPLICATE_INSTALLED',
    setup: (repo) => { const other = loadSample(); other.pack_id = 'otro_paquete_v1'; other.items = [{ ...structuredClone(other.items[0]), id: 'g.samp.0003' }]; other.lexicon = []; other.stories = []; other.topics = ['gram.present_perfect.for_since']; repo.write('content/packs/otro_paquete_v1.json', other); },
    mutate: () => {}, expect: ['items[2].id:DUPLICATE_INSTALLED'], msg: /ya existe en el paquete instalado otro_paquete_v1/ },
];

const lines = (r) => r.errors.map((e) => `${e.path}:${e.rule}`).sort();

test('hay al menos 25 casos y cada uno rompe una regla DISTINTA', () => {
  assert.ok(CASES.length >= 25, `solo ${CASES.length} casos`);
  const rules = CASES.map((c) => c.rule);
  assert.equal(new Set(rules).size, rules.length, 'una regla repetida');
});

for (const c of CASES) {
  test(`inválido: ${c.name} → ${c.rule}`, () => {
    const repo = makeRepo();
    try {
      if (c.setup) c.setup(repo);
      const pack = loadSample();
      c.mutate(pack);
      const file = repo.write(`inbox/${NAME}`, pack);
      // (1) y (2): el resultado y el mensaje
      const res = validateContent({ root: repo.root, inputs: [file] });
      assert.equal(res.exitCode, 1);
      assert.deepEqual(lines(res.files[0]), [...c.expect].sort(), `errores inesperados: ${JSON.stringify(res.files[0].errors)}`);
      const main = res.files[0].errors.find((e) => `${e.path}:${e.rule}` === c.expect[0]);
      assert.match(main.message, c.msg);
      // (3): el comando real sale con 1 y muestra la ruta exacta con el nombre del archivo
      const cli = spawnSync(process.execPath, [CLI, '--root', repo.root, file], { encoding: 'utf8' });
      assert.equal(cli.status, 1, cli.stderr);
      const first = c.expect[0].split(':');
      assert.ok(cli.stdout.includes(`${NAME} › ${first[0] === '' ? '(raíz)' : first[0]}:`), `no muestra la ruta exacta:\n${cli.stdout}`);
      assert.ok(cli.stdout.includes(`[${first.slice(1).join(':')}]`));
      assert.match(cli.stderr, /✘ \d+ error/);
    } finally { repo.cleanup(); }
  });
}

test('control: el paquete de muestra SIN romper no da ningún error ni aviso (así cada caso solo prueba su regla)', () => {
  const repo = makeRepo();
  try {
    const file = repo.write(`inbox/${NAME}`, loadSample());
    const res = validateContent({ root: repo.root, inputs: [file] });
    assert.deepEqual([res.exitCode, res.errorTotal, res.warningTotal], [0, 0, 0]);
    const cli = spawnSync(process.execPath, [CLI, '--root', repo.root, file], { encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stdout + cli.stderr);
    assert.match(cli.stdout, /✔ Todo en orden: 1 paquete validado, 0 avisos\./);
  } finally { repo.cleanup(); }
});
