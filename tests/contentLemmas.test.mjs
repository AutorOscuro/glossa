// @purpose: Pruebas de la forma y la cobertura mínima de content/taxonomy/lemmas.json.
// Pruebas de content/taxonomy/lemmas.json (lote C10, roadmap 1.11 y Pista C).
// El archivo lo consumirá core/whitelist.js (subparte 1.11); aquí se comprueba su forma y su cobertura mínima.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const data = read('content/taxonomy/lemmas.json');

const POS = new Set(['noun', 'verb', 'adjective', 'adverb', 'preposition', 'pronoun', 'determiner', 'conjunction', 'interjection', 'numeral']);
const WORD = /^[a-z]{1,30}$/;
const MIN_LEMMAS = 3000;

// Devuelve la lista de problemas ([] = en orden). Se usa con el archivo real y con copias rotas a propósito.
function checkLemmas(d) {
  const bad = [];
  if (d?.schema !== 1) bad.push('schema distinto de 1');
  if (d?.source !== 'original') bad.push('source distinto de original');
  if (!Number.isInteger(d?.version) || d.version < 1) bad.push('version inválida');
  if (!Array.isArray(d?.bands) || d.bands.length === 0) bad.push('sin bands');
  if (!Array.isArray(d?.lemmas)) return [...bad, 'lemmas no es lista'];
  if (d.lemmas.length < MIN_LEMMAS) bad.push(`solo ${d.lemmas.length} lemas (mínimo ${MIN_LEMMAS})`);
  const seen = new Set();
  const bandsUsed = new Set();
  for (const e of d.lemmas) {
    const id = e?.lemma;
    if (typeof id !== 'string' || !WORD.test(id)) { bad.push(`lema inválido: ${JSON.stringify(id)}`); continue; }
    if (seen.has(id)) bad.push(`lema repetido: ${id}`);
    seen.add(id);
    if (!Array.isArray(e.pos) || e.pos.length === 0 || e.pos.some((p) => !POS.has(p)) || new Set(e.pos).size !== e.pos.length) bad.push(`${id}: pos inválida`);
    if (!d.bands?.includes(e.band)) bad.push(`${id}: banda inválida ${e.band}`); else bandsUsed.add(e.band);
    if (!Array.isArray(e.forms)) { bad.push(`${id}: forms no es lista`); continue; }
    if (new Set(e.forms).size !== e.forms.length) bad.push(`${id}: formas repetidas`);
    for (const f of e.forms) {
      if (typeof f !== 'string' || !WORD.test(f)) bad.push(`${id}: forma inválida ${JSON.stringify(f)}`);
      else if (f === id) bad.push(`${id}: la forma es igual al lema`);
    }
    for (const k of Object.keys(e)) if (!['lemma', 'pos', 'band', 'forms'].includes(k)) bad.push(`${id}: campo desconocido ${k}`);
  }
  for (const b of d.bands ?? []) if (!bandsUsed.has(b)) bad.push(`banda sin lemas: ${b}`);
  return bad;
}

// forma → lemas que la tienen (el lema mismo cuenta como forma)
function formMap(d) {
  const m = new Map();
  const add = (f, l) => { if (!m.has(f)) m.set(f, new Set()); m.get(f).add(l); };
  for (const e of d.lemmas) { add(e.lemma, e.lemma); for (const f of e.forms) add(f, e.lemma); }
  return m;
}
const map = formMap(data);
const has = (w) => map.has(w);
const lemmaOf = (w) => [...(map.get(w) ?? [])];

// ---------- el archivo real ----------
test('lemmas.json real: pasa todas las comprobaciones de forma (≥ 3.000 lemas, únicos, minúsculas, pos y bandas válidas)', () => {
  assert.deepEqual(checkLemmas(data), []);
  assert.ok(data.lemmas.length >= MIN_LEMMAS);
});

test('lemmas.json real: formas irregulares clave llevan a su lema', () => {
  const pairs = {
    am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
    has: 'have', had: 'have', having: 'have', does: 'do', did: 'do', done: 'do', doing: 'do',
    went: 'go', gone: 'go', goes: 'go', going: 'go', came: 'come', got: 'get', gotten: 'get', made: 'make', took: 'take', taken: 'take',
    gave: 'give', given: 'give', said: 'say', saw: 'see', seen: 'see', knew: 'know', known: 'know', thought: 'think', found: 'find', told: 'tell',
    left: 'leave', kept: 'keep', began: 'begin', begun: 'begin', became: 'become', brought: 'bring', wrote: 'write', written: 'write',
    sat: 'sit', stood: 'stand', heard: 'hear', met: 'meet', paid: 'pay', understood: 'understand', spoke: 'speak', spoken: 'speak',
    spent: 'spend', grew: 'grow', grown: 'grow', won: 'win', bought: 'buy', built: 'build', fell: 'fall', fallen: 'fall', sold: 'sell',
    broke: 'break', broken: 'break', ate: 'eat', eaten: 'eat', drank: 'drink', drunk: 'drink', slept: 'sleep', drove: 'drive', driven: 'drive',
    wore: 'wear', worn: 'wear', swam: 'swim', flew: 'fly', flown: 'fly', caught: 'catch', threw: 'throw', taught: 'teach', held: 'hold', lost: 'lose',
    chose: 'choose', chosen: 'choose', forgot: 'forget', forgotten: 'forget', sang: 'sing', sung: 'sing', rang: 'ring', shown: 'show',
    better: 'good', best: 'good', worse: 'bad', worst: 'bad', farther: 'far', further: 'far',
    men: 'man', women: 'woman', children: 'child', feet: 'foot', teeth: 'tooth', mice: 'mouse', wives: 'wife', knives: 'knife', lives: 'life',
    me: 'i', my: 'i', mine: 'i', myself: 'i', him: 'he', his: 'he', her: 'she', them: 'they', their: 'they', us: 'we', our: 'we', your: 'you', its: 'it',
    these: 'this', those: 'that', whom: 'who', whose: 'who',
    studies: 'study', studied: 'study', carried: 'carry', stopped: 'stop', running: 'run', swimming: 'swim', planned: 'plan', admitted: 'admit', preferred: 'prefer',
    dying: 'die', lying: 'lie', tying: 'tie', closer: 'close', biggest: 'big', happier: 'happy',
    potatoes: 'potato', tomatoes: 'tomato', heroes: 'hero', analyses: 'analysis', crises: 'crisis', halves: 'half',
  };
  const wrong = Object.entries(pairs).filter(([f, l]) => !lemmaOf(f).includes(l));
  assert.deepEqual(wrong, []);
});

test('lemmas.json real: cobertura de palabras muy comunes (funcionales y de 1K)', () => {
  const core = `the be to of and a in that have i it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us
  because between without another around before never always sometimes during against among beyond except toward upon whether either neither rather quite almost enough already maybe perhaps indeed instead although unless until while whenever wherever therefore besides however
  mother father brother sister friend family school teacher student house home room door window kitchen table chair bed car bus train street city country world water food bread milk rice apple coffee tea breakfast lunch dinner
  head face eye ear nose mouth hand arm leg foot heart body doctor hospital phone computer money job work office company
  monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december
  zero one two three four five six seven eight nine ten twenty hundred thousand million first second third
  happy sad angry tired hungry big small old young new good bad hot cold fast slow easy hard early late
  many much few little more most less least every each both several
  can could will would shall should may might must ought cannot`.split(/\s+/).filter(Boolean);
  const missing = [...new Set(core)].filter((w) => !has(w));
  assert.deepEqual(missing, []);
});

test('lemmas.json real: palabras de 1K están en la banda 1K y los modales no llevan formas inventadas', () => {
  const band = new Map(data.lemmas.map((e) => [e.lemma, e]));
  for (const w of ['the', 'be', 'have', 'go', 'people', 'water', 'happy', 'zero']) assert.equal(band.get(w)?.band, '1K', w);
  for (const w of ['could', 'would', 'shall', 'should', 'may', 'might', 'must', 'ought']) assert.deepEqual(band.get(w)?.forms, [], w);
  for (const bad of ['musts', 'musting', 'musted', 'mays', 'shoulds', 'singed', 'wifes', 'shelfs', 'copyying', 'travelling']) assert.equal(has(bad), false, bad);
});

test('lemmas.json real: las formas ambiguas son pocas y ninguna lleva a más de 4 lemas', () => {
  const amb = [...map.entries()].filter(([, ls]) => ls.size > 1);
  assert.ok(amb.length <= 150, `hay ${amb.length} formas ambiguas`);
  for (const [f, ls] of amb) assert.ok(ls.size <= 4, `${f}: ${[...ls]}`);
  for (const f of ['left', 'found', 'saw', 'lay', 'leaves', 'lives']) assert.ok(lemmaOf(f).length >= 1, f);
  assert.deepEqual(lemmaOf('left').sort(), ['leave', 'left']);
});

// ---------- el comprobador detecta fallos (copias rotas a propósito) ----------
const clone = () => structuredClone(data);
const mutate = (fn) => { const d = clone(); fn(d); return checkLemmas(d); };
test('comprobador de lemmas: detecta lema repetido, mayúsculas, pos/banda inválida, formas repetidas o iguales al lema y pocos lemas', () => {
  assert.deepEqual(checkLemmas(clone()), []);
  assert.ok(mutate((d) => d.lemmas.push({ ...d.lemmas[0] })).some((p) => p.startsWith('lema repetido')));
  assert.ok(mutate((d) => { d.lemmas[10].lemma = 'Water'; }).some((p) => p.startsWith('lema inválido')));
  assert.ok(mutate((d) => { d.lemmas[10].pos = ['sustantivo']; }).some((p) => p.endsWith('pos inválida')));
  assert.ok(mutate((d) => { d.lemmas[10].band = '9K'; }).some((p) => p.includes('banda inválida')));
  assert.ok(mutate((d) => { d.lemmas[10].forms = ['aa', 'aa']; }).some((p) => p.endsWith('formas repetidas')));
  assert.ok(mutate((d) => { d.lemmas[10].forms = [d.lemmas[10].lemma]; }).some((p) => p.includes('igual al lema')));
  assert.ok(mutate((d) => { d.lemmas[10].forms = ['Go']; }).some((p) => p.includes('forma inválida')));
  assert.ok(mutate((d) => { d.lemmas = d.lemmas.slice(0, 2999); }).some((p) => p.startsWith('solo ')));
  assert.ok(mutate((d) => { d.lemmas[10].extra = 1; }).some((p) => p.includes('campo desconocido')));
  assert.ok(mutate((d) => { d.bands.push('4K'); }).some((p) => p.startsWith('banda sin lemas')));
  assert.ok(mutate((d) => { d.schema = 2; }).some((p) => p.startsWith('schema')));
});
