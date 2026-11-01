// @purpose: Detector mecánico de errores comunes por reglas sobre palabras (sin IA ni red).
// Detector mecánico de errores comunes (subparte 1.6, cuarto 3, mitad A). Roadmap 1.6 y 7.10. Puro: sin DOM, sin base de datos, sin red, sin IA.
// Trabaja por REGLAS sobre una lista de palabras (no regex gigantes: lineales y sin riesgo de bloqueo). Prefiere NO avisar a avisar mal:
// cada regla lleva guardas contra frases correctas que se le parecen (el CA 3 pide cero falsos positivos).
//
//   detectRules(text) → hit[]                         sin catálogo; ordenado por posición. hit = { code, rule, text, from, to }
//   createErrorDetector({ catalog }) → { detect, classify, rules }   (congelado)
//     Lanza Error si algún código de las reglas no está en el catálogo (el catálogo y las reglas no se pueden desincronizar).
//     detect(text) → hit[]   igual, con `hint` (pista_corta_es del catálogo) y ordenado por prioridad: impacto del código ↓, orden de regla, posición.
//     classify(entries) → Promise<Array<veredicto | null>>   CONTRATO de core/errorHook.js: misma longitud y orden. Lee solo `original`.
//        veredicto = { code, origin, impact, topics:[primer tema del catálogo] } del hit de mayor prioridad; null si no hay ninguno.
//        Si hay varios errores en la frase, el hook solo anota el principal (un código por entrada): el resto está en detect().
//     rules → lista congelada de { id, code }.
// Texto no válido (no es texto) → sin hits. Se lee un máximo de MAX_TEXT caracteres.

export const MAX_TEXT = 2000;
const TOKEN_RE = /[a-zà-ÿ0-9]+(?:['-][a-zà-ÿ0-9]+)*|[.,;:!?()"]/gi;
const set = (s) => new Set(s.split(' '));

function tokenize(input) {
  const text = input.slice(0, MAX_TEXT).replace(/[\u2019\u2018\u02BC\u00B4`]/g, "'").replace(/[\u201C\u201D]/g, '"');
  const tk = [];
  for (const m of text.matchAll(TOKEN_RE)) tk.push({ w: m[0].toLowerCase(), raw: m[0], from: m.index, to: m.index + m[0].length, word: /[a-zà-ÿ0-9]/i.test(m[0][0]) });
  return { text, tk };
}

// ---------- listas ----------
const PRON = set('i you he she it we they');
const SUBJ_PRON = set('i you he she we they');
const IRREG_PAST = set('went saw ate took came gave made got had did said told thought bought brought taught caught fought sought sold left met paid built felt kept slept wrote drove rode spoke broke chose forgot began ran swam sang drank knew grew threw flew drew wore tore stood understood heard lost sent lent spent meant led fed fell held sat woke became forgave hid won stole froze shook hung rang sank');
// pasados que NO coinciden con el participio: sirven para «have went», «has took»…
const PAST_NOT_PART = set('went saw ate took came gave did wrote drove rode spoke broke chose began ran swam sang drank knew grew threw flew drew wore tore fell woke became forgave hid stole froze shook rang sank was were');
const ED_EXC = set('speed proceed succeed exceed bleed breed embed indeed hundred sacred');
const BAD_PAST = set('leaved eated goed buyed taked maked gived comed writed runned speaked breaked choosed drinked knowed growed throwed thinked bringed teached catched selled telled feeled keeped sleeped forgetted getted builded losed drived rided sitted standed understanded begined heared falled holded meeted sended spended winned swimmed sanged flyed drawed weared stealed freezed cutted letted hitted shutted setted putted readed');
const BASE_VERBS = set('go do eat buy see make take get have be speak talk say tell use learn study work play visit travel read write watch help find give bring meet send call stay live move leave try start stop ask answer cook drink sleep run walk swim drive ride pay spend wait know think change open close practice improve finish check attend join invite share clean wash sing dance sit cry laugh');
const THIRD = set('goes does works lives likes wants needs loves makes takes comes says gets knows thinks plays studies swims runs eats sees speaks writes drinks sleeps helps tries uses starts');
const CAUS_THIRD = set('works goes cries forgets thinks wants needs studies feels remembers understands gets loves hates becomes learns wakes sleeps');
const DET = set('a an the this that my your his her our their tin real no');
const COP = set('is was are were');
const MODALS = set('can could should must will would might shall');
const PREP = set('in on at since until till by from during after before for of with about to into over under between through within');
const CLAUSE_BREAK = set('that which who when because if and but so while what why how where whether or then than although though until unless');
const UNITS = set('second seconds minute minutes hour hours day days week weeks month months year years decade decades');
const LAST_UNITS = set('night week month year summer winter weekend monday tuesday wednesday thursday friday saturday sunday');
const MONTHS = set('january february march april may june july august september october november december');
const WEEKDAYS = set('monday tuesday wednesday thursday friday saturday sunday');

function isEd(v) { return /^[a-z]{3,}ed$/.test(v) && !ED_EXC.has(v); }
const isPastWrong = (v, neg) => IRREG_PAST.has(v) || (neg && (v === 'was' || v === 'were')) || isEd(v);

// ---------- reglas ----------
// Cada regla recibe un contexto y llama a add(primerToken, últimoToken).
const RULES = [];
const rule = (id, code, run) => RULES.push({ id, code, run });

rule('can_to', 'VRB.CAN_TO', (c, add) => {
  const M = set("can could cannot can't couldn't must mustn't should shouldn't might");
  for (let i = 0; i < c.n; i += 1) {
    if (M.has(c.w(i)) && c.w(i + 1) === 'to' && c.isWord(i + 2) && !DET.has(c.w(i + 2)) && !DET.has(c.w(i - 1))) add(i, i + 2);
  }
});

rule('double_past', 'VRB.DOUBLE_PAST', (c, add) => {
  for (let i = 0; i < c.n; i += 1) {
    const a = c.w(i);
    let j; let neg = false;
    if (a === "didn't" || a === 'didnt') { j = i + 1; neg = true; } else if (a === 'did' && c.w(i + 1) === 'not') { j = i + 2; neg = true; } else if (a === 'did' && PRON.has(c.w(i + 1))) j = i + 2;
    else continue;
    const v = c.w(j);
    if (c.isWord(j) && v !== 'used' && isPastWrong(v, neg)) add(i, j);
  }
});

rule('irreg_regularize', 'VRB.IRREG_REGULARIZE', (c, add) => {
  for (let i = 0; i < c.n; i += 1) if (BAD_PAST.has(c.w(i))) add(i, i);
});

rule('perf_form', 'TNS.PERF_FORM', (c, add) => {
  const BEEN_BASE = set('study live wait learn try speak talk sleep think watch look');
  for (let i = 0; i < c.n; i += 1) {
    const a = c.w(i);
    if (!(a === 'have' || a === 'has' || a === 'had' || a === "haven't" || a === "hasn't" || a === "hadn't" || /^[a-z]+'ve$/.test(a))) continue;
    let j = i + 1;
    if (c.w(j) === 'not') j += 1;
    if (c.isWord(j) && PAST_NOT_PART.has(c.w(j))) add(i, j);
    else if (c.w(j) === 'been' && BEEN_BASE.has(c.w(j + 1))) add(i, j + 1);
  }
});

rule('neg_double', 'NEG.DOUBLE', (c, add) => {
  const NEG = set("don't doesn't didn't can't couldn't won't wouldn't shouldn't isn't aren't wasn't weren't haven't hasn't hadn't cannot never not do does did");
  const BLOCK = set('because that if when while since and but so as whether why what which who or then than although though until unless where how');
  const FOLLOW = set('to about of else at for on in from with special more new like anymore yet again now today here there');
  const NOVERB = set('have has had got see saw want need know like found find take took make made speak understand hear heard');
  const NOEXC = set('to thanks thank matter longer');
  const ok = (k) => !c.isWord(k) || FOLLOW.has(c.w(k));
  for (let i = 0; i < c.n; i += 1) {
    const a = c.w(i);
    if (!NEG.has(a)) continue;
    // «do/does/did» solo cuentan seguidos de «not» (para no tomar la pregunta «did you do nothing?» por una frase afirmativa)
    if ((a === 'do' || a === 'does' || a === 'did') && c.w(i + 1) !== 'not') continue;
    const first = (a === 'do' || a === 'does' || a === 'did') ? i + 2 : i + 1;
    if (set("don't doesn't didn't haven't hasn't hadn't").has(a) && NOVERB.has(c.w(first)) && c.w(first + 1) === 'no' && c.isWord(first + 2) && !NOEXC.has(c.w(first + 2)) && c.w(first + 2) !== 'one') { add(i, first + 2); continue; }
    for (let j = first + (a === 'not' ? 1 : 0); j <= i + 5 && c.isWord(j); j += 1) {
      const x = c.w(j);
      if (BLOCK.has(x) || (a === 'not' && x === 'for')) break;
      if ((x === 'nothing' || x === 'nobody' || x === 'nowhere') && ok(j + 1)) { add(i, j); break; }
      if (x === 'no' && c.w(j + 1) === 'one' && ok(j + 2)) { add(i, j + 1); break; }
    }
  }
});

rule('subj_omit', 'SUBJ.OMIT', (c, add) => {
  const INTENS = set('very really so quite too extremely totally absolutely always never also not more');
  const ADJ = set('important necessary possible impossible difficult easy hard better worse normal common dangerous');
  const STRONG = set('important necessary possible impossible');
  const AFTER = set('to that for because when if');
  for (let i = 0; i < c.n; i += 1) {
    if (c.starts(i) && COP.has(c.w(i))) {
      const adjIdx = INTENS.has(c.w(i + 1)) ? i + 2 : i + 1;
      const adj = c.w(adjIdx);
      const nxt = c.w(adjIdx + 1);
      if (ADJ.has(adj) && (AFTER.has(nxt) || (STRONG.has(adj) && !c.isWord(adjIdx + 1)))) add(i, adjIdx);
    }
    if (c.w(i) === 'because' && COP.has(c.w(i + 1))) add(i, i + 1);
  }
});

rule('prep_dep', 'PREP.DEP', (c, add) => {
  const SKILL = set('math maths mathematics english spanish french science history sports languages physics chemistry biology music art cooking drawing writing football tennis swimming');
  const BE = set("am is are was were be being 'm 's 're i'm you're he's she's we're they're");
  const NOT_ARRIVE = set('sound news sight smell noise cheers applause music');
  const THE = set('the my his her our their your');
  const PAIRS = [[set('interested'), set('about on')], [set('depend depends depended depending'), set('of')], [set('discuss discusses discussed discussing'), set('about')],
    [set('similar'), set('than')], [set('according'), set('with')], [set('responsible'), set('of')], [set('capable'), set('to')]];
  for (let i = 0; i < c.n; i += 1) {
    const a = c.w(i); const b = c.w(i + 1);
    for (const [first, second] of PAIRS) if (first.has(a) && second.has(b)) add(i, i + 1);
    if (/^arriv(e|es|ed|ing)$/.test(a) && b === 'to' && THE.has(c.w(i + 2)) && c.isWord(i + 3) && !NOT_ARRIVE.has(c.w(i + 3))) add(i, i + 3);
    if (a === 'good' && b === 'in' && (SKILL.has(c.w(i + 2)) || (/^[a-z]{3,}ing$/.test(c.w(i + 2)) && c.w(i + 2) !== 'during'))) {
      if (BE.has(c.w(i - 1)) || (set('very really quite so').has(c.w(i - 1)) && BE.has(c.w(i - 2)))) add(i, i + 2);
    }
  }
});

rule('cap_i', 'MECH.CAP_I', (c, add) => {
  for (let i = 0; i < c.n; i += 1) {
    const t = c.tk[i];
    if (!(t.raw === 'i' || /^i'(m|ve|ll|d)$/.test(t.raw))) continue;
    if (t.raw === 'i' && ((c.w(i - 1) === '(' && c.w(i + 1) === ')') || (c.w(i + 1) === '.' && (c.w(i + 2) === 'e' || c.starts(i))))) continue; // «(i)», «i.e.», «i. Primero»
    add(i, i); return;
  }
});

rule('everyday', 'MECH.EVERYDAY', (c, add) => {
  const NEXT = set('at in on before after because since');
  const PREV = set('the an my your our their his her');
  for (let i = 0; i < c.n; i += 1) if (c.w(i) === 'everyday' && !PREV.has(c.w(i - 1)) && (!c.isWord(i + 1) || NEXT.has(c.w(i + 1)))) add(i, i);
});

rule('since_for', 'TNS.SINCE_FOR', (c, add) => {
  const QUANT = set('a an one two three four five six seven eight nine ten eleven twelve several few many couple half');
  const MID = set('few couple of long lot little half an a about almost nearly over more than like');
  const OK_NEXT = set('i we he she they it you and but in at on because now so with my');
  const PRESENT = set("live lives work works study studies know knows am is are i'm you're we're they're learn learns stay stays");
  const DUR = set('lived worked studied known waited stayed been');
  const BEEN_NEXT = set('here there in at married single working living studying waiting learning');
  const POINT = (k) => /^(19|20)\d\d$/.test(c.w(k)) || MONTHS.has(c.w(k)) || WEEKDAYS.has(c.w(k)) || c.w(k) === 'yesterday' || (c.w(k) === 'last' && LAST_UNITS.has(c.w(k + 1)));
  const POINT_END = (k) => (c.w(k) === 'last' ? k + 1 : k); // «last week» ocupa dos palabras: el señalamiento cubre la expresión completa
  for (let i = 0; i < c.n; i += 1) {
    const a = c.w(i);
    if (a === 'since' && (QUANT.has(c.w(i + 1)) || /^\d{1,2}$/.test(c.w(i + 1)))) {
      let j = i + 2;
      while (j <= i + 4 && MID.has(c.w(j))) j += 1;
      if (UNITS.has(c.w(j)) && (!c.isWord(j + 1) || OK_NEXT.has(c.w(j + 1)))) add(i, j);
    }
    // presente + since + punto: «I live here since 2010»
    if (a === 'since' && POINT(i + 1)) {
      for (let k = i - 1; k >= Math.max(0, i - 4) && c.isWord(k); k -= 1) if (PRESENT.has(c.w(k))) { add(k, POINT_END(i + 1)); break; }
    }
    // perfecto + for + punto: «I've lived here for 2010»
    if (a === 'for' && POINT(i + 1)) {
      for (let k = i - 1; k >= Math.max(0, i - 3) && c.isWord(k); k -= 1) {
        const v = c.w(k);
        if (DUR.has(v) && (v !== 'been' || BEEN_NEXT.has(c.w(k + 1)))) {
          const aux = c.w(k - 1);
          if (aux === 'have' || aux === 'has' || aux === 'had' || /^[a-z]+'ve$/.test(aux)) add(k - 1, POINT_END(i + 1));
          break;
        }
      }
    }
  }
});

rule('pp_ps', 'TNS.PP_PS', (c, add) => {
  for (let i = 0; i < c.n; i += 1) {
    const a = c.w(i);
    if (!(a === 'have' || a === 'has' || /^[a-z]+'ve$/.test(a))) continue;
    for (let j = i + 1; j <= i + 4 && c.isWord(j); j += 1) {
      const x = c.w(j);
      if (PREP.has(x) || CLAUSE_BREAK.has(x)) break;
      if (x === 'yesterday' || (x === 'last' && LAST_UNITS.has(c.w(j + 1))) || (x === 'ago' && UNITS.has(c.w(j - 1)))) { add(i, x === 'last' ? j + 1 : j); break; }
    }
  }
});

rule('will_past', 'FUT.WILL_PAST', (c, add) => {
  for (let i = 1; i < c.n; i += 1) if (c.w(i) === 'will' && PRON.has(c.w(i - 1)) && c.isWord(i + 1) && (IRREG_PAST.has(c.w(i + 1)) || isEd(c.w(i + 1)))) add(i - 1, i + 1);
});

rule('aux_mix', 'FUT.AUX_MIX', (c, add) => {
  const M = set('will can could should must might shall');
  for (let i = 0; i < c.n; i += 1) {
    const a = c.w(i);
    if ((a === 'have' || a === 'has' || a === 'had' || /^[a-z]+'ve$/.test(a)) && M.has(c.w(i + 1)) && BASE_VERBS.has(c.w(i + 2))) add(i, i + 2);
  }
});

rule('avoid_to', 'GER.AVOID_TO', (c, add) => {
  const V = set('avoid avoids avoided avoiding enjoy enjoys enjoyed enjoying finish finishes finished finishing suggest suggests suggested suggesting mind minds minded imagine imagined imagining');
  for (let i = 0; i < c.n; i += 1) if (V.has(c.w(i)) && c.w(i + 1) === 'to' && BASE_VERBS.has(c.w(i + 2))) add(i, i + 2);
});

rule('inf_after_prep', 'GER.INF_AFTER_PREP', (c, add) => {
  const P = set('for without after before');
  const FOR_VERBS = set('learn buy see find improve speak understand meet make obtain have be know');
  const VISIT_NOUN = set('hours hour days day time times information rights policy');
  for (let i = 0; i < c.n; i += 1) {
    const a = c.w(i);
    if ((P.has(a) || (a === 'of' && c.w(i - 1) === 'instead')) && c.w(i + 1) === 'to' && BASE_VERBS.has(c.w(i + 2))) add(i, i + 2);
    else if (a === 'for' && (FOR_VERBS.has(c.w(i + 1)) || (c.w(i + 1) === 'visit' && !VISIT_NOUN.has(c.w(i + 2))))) add(i, i + 1);
  }
});

rule('third_s_extra', 'VRB.THIRD_S_EXTRA', (c, add) => {
  const NEGS = set("doesn't doesnt didn't don't");
  for (let i = 0; i < c.n; i += 1) {
    const a = c.w(i);
    if (NEGS.has(a) && (THIRD.has(c.w(i + 1)) || c.w(i + 1) === 'has')) add(i, i + 1);
    else if ((a === 'does' || a === 'did') && c.w(i + 1) === 'not' && (THIRD.has(c.w(i + 2)) || c.w(i + 2) === 'has')) add(i, i + 2);
    else if (MODALS.has(a) && THIRD.has(c.w(i + 1)) && c.isWord(i - 1)) {
      // «will» y «can» también son sustantivos (el testamento, la lata): con ellos hace falta un sujeto claro
      const p = c.w(i - 1);
      if (a === 'will' ? PRON.has(p) : a === 'can' ? !DET.has(p) : true) add(i - 1, i + 1);
    }
  }
});

rule('third_s_omit', 'VRB.THIRD_S_OMIT', (c, add) => {
  const VERBS = set('go like want need have do know think work live play study speak come make take love eat see say get run write');
  const SKIP = set('does did can could will would should must might may shall let make made help see watch hear that where what when why how who if whether rather wish');
  const TRIG = set('suggest suggests suggested recommend recommended insist insisted demand demanded require required propose proposed request requested important essential vital necessary imperative');
  for (let i = 0; i < c.n; i += 1) {
    const a = c.w(i);
    if (a !== 'he' && a !== 'she') continue;
    if (c.w(i + 1) === "don't") { add(i, i + 1); continue; }
    if (!VERBS.has(c.w(i + 1)) || SKIP.has(c.w(i - 1))) continue;
    let subjunctive = false;
    for (let k = i - 1; k >= 0 && !/^[.!?]$/.test(c.w(k)); k -= 1) if (TRIG.has(c.w(k))) { subjunctive = true; break; }
    if (!subjunctive) add(i, i + 1);
  }
});

rule('q_word_order', 'Q.WORD_ORDER', (c, add) => {
  const WH = set('where when why how');
  const QV = set('live lives go goes work works study studies come comes want wants like likes need needs stay stays play plays speak speaks think thinks know knows eat eats buy buys sleep sleeps arrive arrives');
  const QP = set('he she they we i you');
  for (let i = 0; i < c.n; i += 1) {
    if (c.starts(i) && WH.has(c.w(i)) && QV.has(c.w(i + 1)) && QP.has(c.w(i + 2)) && !(c.w(i) === 'how' && c.w(i + 1) === 'come')) add(i, i + 2);
  }
});

rule('q_aux_omit', 'Q.AUX_OMIT', (c, add) => {
  const WH = set('where what when why how');
  const QP = set('you he she they we i');
  const V = set('live work study go come want like need do have think know say mean play eat buy feel');
  for (let i = 0; i < c.n; i += 1) {
    if (c.starts(i) && WH.has(c.w(i)) && QP.has(c.w(i + 1)) && V.has(c.w(i + 2))) {
      let k = i; while (k < c.n && !/^[.!?]$/.test(c.w(k))) k += 1;
      if (c.w(k) === '?') add(i, i + 2);
    }
  }
});

rule('caus', 'CAUS.MAKE_ME_WORKS', (c, add) => {
  const MK = set('make makes made making let lets letting');
  const OBJ = set('me him us them you');
  for (let i = 0; i < c.n; i += 1) {
    if (!MK.has(c.w(i)) || !OBJ.has(c.w(i + 1))) continue;
    if ((c.w(i + 2) === 'to' && BASE_VERBS.has(c.w(i + 3))) || CAUS_THIRD.has(c.w(i + 2))) add(i, c.w(i + 2) === 'to' ? i + 3 : i + 2);
  }
});

rule('adj_plural', 'ADJ.PLURAL', (c, add) => {
  const L = set('awesomes beautifuls importants differents interestings difficults expensives impossibles fantastics nices');
  for (let i = 0; i < c.n; i += 1) if (L.has(c.w(i))) add(i, i);
});

rule('noun_count', 'NOUN.COUNT_UNCOUNT', (c, add) => {
  const PL = set('informations advices furnitures luggages homeworks equipments knowledges newses baggages');
  const UNC = set('luggage baggage furniture information advice homework equipment knowledge money traffic');
  const SING = set('time person thing friend car book student problem day hour year word question');
  const MUCH_PL = set('people friends things books cars students problems children persons words hours days times years questions');
  for (let i = 0; i < c.n; i += 1) {
    const a = c.w(i); const b = c.w(i + 1);
    if (PL.has(a)) add(i, i);
    else if ((a === 'many' || a === 'few' || a === 'several') && UNC.has(b)) add(i, i + 1);
    else if (a === 'many' && SING.has(b)) add(i, i + 1);
    else if (a === 'much' && MUCH_PL.has(b)) add(i, i + 1);
  }
});

rule('noun_plural', 'NOUN.PLURAL_IRREG', (c, add) => {
  const L = set('childs womans foots feets tooths sheeps gooses lifes wifes');
  for (let i = 0; i < c.n; i += 1) if (L.has(c.w(i))) add(i, i);
});

rule('comparative', 'ADJ.COMPARATIVE_DOUBLE', (c, add) => {
  const L = set('better best worse worst bigger biggest smaller smallest taller tallest easier easiest harder hardest faster fastest cheaper cheapest older oldest younger youngest longer longest higher highest lower lowest stronger strongest happier happiest nicer nicest larger largest quicker closer richer');
  for (let i = 0; i < c.n; i += 1) if ((c.w(i) === 'more' || c.w(i) === 'most') && L.has(c.w(i + 1))) add(i, i + 1);
});

rule('superlative', 'ADJ.SUPERLATIVE', (c, add) => {
  const MONO = set('big fast tall small old young long short hot cold rich poor high cheap large easy nice late hard');
  const NOT_NEXT = set('school fashioned');
  for (let i = 0; i < c.n; i += 1) {
    if (c.w(i) === 'the' && c.w(i + 1) === 'most' && MONO.has(c.w(i + 2)) && !NOT_NEXT.has(c.w(i + 3))) add(i, i + 2);
    else if (c.w(i) === 'more' && MONO.has(c.w(i + 1)) && c.w(i + 2) === 'than') add(i, i + 2);
  }
});

rule('bored_boring', 'ADJ.BORED_BORING', (c, add) => {
  const ING = set('boring tiring confusing exciting annoying frightening embarrassing surprising disappointing depressing worrying shocking terrifying interesting');
  const INTENS = set('very so really too quite');
  for (let i = 0; i < c.n; i += 1) {
    if (!(c.w(i) === 'i' || c.w(i) === 'we' || c.w(i) === 'you') || !set('feel felt feeling').has(c.w(i + 1))) continue;
    const j = INTENS.has(c.w(i + 2)) ? i + 3 : i + 2;
    if (ING.has(c.w(j))) add(i, j);
  }
});

rule('adv_good', 'ADJ.ADV_CONFUSION', (c, add) => {
  const V = set('speak speaks spoke sing sings sang play plays played write writes swim swims cook cooks dance dances drive drives');
  const END = set('and but at than');
  const INTENS = set('very really so');
  for (let i = 0; i < c.n; i += 1) {
    if (!V.has(c.w(i))) continue;
    let j = i + 1;
    if (c.isWord(j) && !PREP.has(c.w(j)) && !DET.has(c.w(j)) && !INTENS.has(c.w(j)) && c.w(j) !== 'good') j += 1; // un complemento: «speaks English»
    if (INTENS.has(c.w(j))) j += 1;
    if (c.w(j) === 'good' && (!c.isWord(j + 1) || END.has(c.w(j + 1)))) add(i, j);
  }
});

rule('spell', 'SPELL.GENERAL', (c, add) => {
  const L = set('yesterdey firts finaly cluidy paseed oportunity oportunitys oportunities begining beautifull becouse becuase recieve definately seperate tommorrow tomorow wich freind adress intresting');
  for (let i = 0; i < c.n; i += 1) if (L.has(c.w(i))) add(i, i);
});

rule('spell_es', 'SPELL.ES_INTERFERENCE', (c, add) => {
  const L = set('semestre carrer diferent comunication necesary inteligent');
  for (let i = 0; i < c.n; i += 1) if (L.has(c.w(i))) add(i, i);
});

rule('despite_of', 'CONN.DESPITE_OF', (c, add) => {
  for (let i = 0; i < c.n; i += 1) if (c.w(i) === 'despite' && c.w(i + 1) === 'of') add(i, i + 1);
});

rule('calque', 'LEX.CALQUE', (c, add) => {
  const AM = set("am is are i'm you're we're they're");
  const NUMW = set('two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty');
  for (let i = 0; i < c.n; i += 1) {
    if (c.w(i) === 'in' && c.w(i + 1) === 'the' && c.w(i + 2) === 'other' && c.w(i + 3) === 'hand') add(i, i + 3);
    if (AM.has(c.w(i)) && c.w(i + 1) === 'agree') add(i, i + 1);
    if (SUBJ_PRON.has(c.w(i)) && (c.w(i + 1) === 'have' || c.w(i + 1) === 'has') && (/^\d{1,2}$/.test(c.w(i + 2)) || NUMW.has(c.w(i + 2))) && c.w(i + 3) === 'years' && (c.w(i + 4) === 'old' || !c.isWord(i + 4))) add(i, c.w(i + 4) === 'old' ? i + 4 : i + 3);
  }
});

export const RULE_LIST = Object.freeze(RULES.map((r) => Object.freeze({ id: r.id, code: r.code })));

function context(tk) {
  const n = tk.length;
  return {
    tk, n,
    w: (i) => (i >= 0 && i < n ? tk[i].w : ''),
    isWord: (i) => i >= 0 && i < n && tk[i].word,
    starts: (i) => i === 0 || /^[.!?]$/.test(tk[i - 1].w),
  };
}

function run(input) {
  if (typeof input !== 'string' || input.trim() === '') return [];
  const { text, tk } = tokenize(input);
  const c = context(tk);
  const hits = [];
  RULES.forEach((r, order) => {
    try {
      r.run(c, (a, b) => { const x = tk[a]; const y = tk[Math.min(b, tk.length - 1)]; if (x && y) hits.push({ code: r.code, rule: r.id, text: text.slice(x.from, y.to), from: x.from, to: y.to, order }); });
    } catch { /* una regla rota no tumba a las demás */ }
  });
  return hits;
}

export function detectRules(text) {
  return run(text).sort((a, b) => a.from - b.from || a.order - b.order).map(({ order, ...h }) => Object.freeze(h));
}

const WEIGHT = { high: 3, mid: 2, low: 1 };

export function createErrorDetector({ catalog } = {}) {
  if (!catalog || typeof catalog.has !== 'function' || typeof catalog.get !== 'function') throw new Error('createErrorDetector: falta el catálogo de errores (core/errorCatalog.js)');
  for (const r of RULES) if (!catalog.has(r.code)) throw new Error(`createErrorDetector: la regla "${r.id}" usa el código ${r.code}, que no está en el catálogo`);

  function detect(text) {
    return run(text).map((h) => ({ ...h, entry: catalog.get(h.code) }))
      .sort((a, b) => (WEIGHT[b.entry.impacto_defecto] ?? 1) - (WEIGHT[a.entry.impacto_defecto] ?? 1) || a.order - b.order || a.from - b.from)
      .map(({ order, entry, ...h }) => Object.freeze({ ...h, hint: entry.pista_corta_es }));
  }

  async function classify(entries) {
    if (!Array.isArray(entries)) throw new TypeError('classify: entries debe ser una lista');
    return entries.map((e) => {
      try {
        const best = detect(e && typeof e === 'object' ? e.original : null)[0];
        if (!best) return null;
        const entry = catalog.get(best.code);
        const v = { code: best.code, origin: entry.origen_tipico, impact: entry.impacto_defecto };
        if (entry.temas_relacionados.length > 0) v.topics = [entry.temas_relacionados[0]];
        return v;
      } catch { return null; }
    });
  }

  return Object.freeze({ detect, classify, rules: RULE_LIST });
}
