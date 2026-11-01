// @purpose: Prueba palabra por palabra de las listas del detector de errores: quitar una palabra de una lista debe hacer fallar una frase.
// Pruebas «palabra por palabra» del detector (1.6, cuarto 3, roturas intencionales). Una frase por cada palabra de cada lista de core/errorDetect.js:
// quitar UNA palabra de una lista debe hacer fallar una prueba (las roturas intencionales lo comprobaron: antes de este archivo sobrevivían ~1.300 de 1.973 variantes).
// Cada grupo: [línea del código, plantilla con ${w}, código, fragmento señalado | null = ese código NO debe aparecer, palabras].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectRules } from '../core/errorDetect.js';

const has = (s, code, frag) => detectRules(s).some((h) => h.code === code && (frag === null || h.text.toLowerCase() === frag.toLowerCase()));

const GROUPS = [
  [27, "${w} will went there.", "FUT.WILL_PAST", "${w} will went", "i you he she it we they"],
  [28, "${w} has 22 years old.", "LEX.CALQUE", "${w} has 22 years old", "i you he she we they"],
  [29, "Yesterday I didn't ${w} it.", "VRB.DOUBLE_PAST", "didn't ${w}", "went saw ate took came gave made got had did said told thought bought brought taught caught fought sought sold left met paid built felt kept slept wrote drove rode spoke broke chose forgot began ran swam sang drank knew grew threw flew drew wore tore stood understood heard lost sent lent spent meant led fed fell held sat woke became forgave hid won stole froze shook hung rang sank"],
  [31, "I have ${w} it.", "TNS.PERF_FORM", "have ${w}", "went saw ate took came gave did wrote drove rode spoke broke chose began ran swam sang drank knew grew threw flew drew wore tore fell woke became forgave hid stole froze shook rang sank was were"],
  [32, "I didn't ${w} it.", "VRB.DOUBLE_PAST", null, "speed proceed succeed exceed bleed breed embed indeed hundred sacred"],
  [33, "Yesterday I ${w} it.", "VRB.IRREG_REGULARIZE", "${w}", "leaved eated goed buyed taked maked gived comed writed runned speaked breaked choosed drinked knowed growed throwed thinked bringed teached catched selled telled feeled keeped sleeped forgetted getted builded losed drived rided sitted standed understanded begined heared falled holded meeted sended spended winned swimmed sanged flyed drawed weared stealed freezed cutted letted hitted shutted setted putted readed"],
  [34, "She made me to ${w}.", "CAUS.MAKE_ME_WORKS", "made me to ${w}", "go do eat buy see make take get have be speak talk say tell use learn study work play visit travel read write watch help find give bring meet send call stay live move leave try start stop ask answer cook drink sleep run walk swim drive ride pay spend wait know think change open close practice improve finish check attend join invite share clean wash sing dance sit cry laugh"],
  [35, "She doesn't ${w} it.", "VRB.THIRD_S_EXTRA", "doesn't ${w}", "goes does works lives likes wants needs loves makes takes comes says gets knows thinks plays studies swims runs eats sees speaks writes drinks sleeps helps tries uses starts"],
  [36, "She makes me ${w}.", "CAUS.MAKE_ME_WORKS", "makes me ${w}", "works goes cries forgets thinks wants needs studies feels remembers understands gets loves hates becomes learns wakes sleeps"],
  [37, "${w} can to go home.", "VRB.CAN_TO", null, "a an the this that my your his her our their tin real no"],
  [38, "${w} important to learn.", "SUBJ.OMIT", "${w} important", "is was are were"],
  [39, "He ${w} goes home.", "VRB.THIRD_S_EXTRA", "he ${w} goes", "can could should must will would might shall"],
  [40, "I have ${w} yesterday.", "TNS.PP_PS", null, "in on at since until till by from during after before for of with about to into over under between through within"],
  [41, "I have ${w} yesterday.", "TNS.PP_PS", null, "that which who when because if and but so while what why how where whether or then than although though until unless"],
  [42, "I have met him ${w} ago.", "TNS.PP_PS", "have met him ${w} ago", "second seconds minute minutes hour hours day days week weeks month months year years decade decades"],
  [43, "I have seen him last ${w}.", "TNS.PP_PS", "have seen him last ${w}", "night week month year summer winter weekend monday tuesday wednesday thursday friday saturday sunday"],
  [44, "I live here since ${w}.", "TNS.SINCE_FOR", "live here since ${w}", "january february march april may june july august september october november december"],
  [45, "I live here since ${w}.", "TNS.SINCE_FOR", "live here since ${w}", "monday tuesday wednesday thursday friday saturday sunday"],
  [56, "I ${w} to go.", "VRB.CAN_TO", "${w} to go", "can could cannot can't couldn't must mustn't should shouldn't might"],
  [78, "I have been ${w}.", "TNS.PERF_FORM", "have been ${w}", "study live wait learn try speak talk sleep think watch look"],
  [91, "I don't know ${w} nothing.", "NEG.DOUBLE", null, "because that if when while since and but so as whether why what which who or then than although though until unless where how"],
  [92, "I don't see nothing ${w} home.", "NEG.DOUBLE", "don't see nothing", "to about of else at for on in from with special more new like anymore yet again now today here there"],
  [93, "I don't ${w} no friends.", "NEG.DOUBLE", "don't ${w} no friends", "have has had got see saw want need know like found find take took make made speak understand hear heard"],
  [94, "I don't have no ${w} here.", "NEG.DOUBLE", null, "to thanks thank matter longer"],
  [113, "Is ${w} important to learn.", "SUBJ.OMIT", "is ${w} important", "very really so quite too extremely totally absolutely always never also not more"],
  [114, "Is ${w} to learn.", "SUBJ.OMIT", "is ${w}", "important necessary possible impossible difficult easy hard better worse normal common dangerous"],
  [115, "Is ${w}.", "SUBJ.OMIT", "is ${w}", "important necessary possible impossible"],
  [116, "Is easy ${w} you try.", "SUBJ.OMIT", "is easy", "to that for because when if"],
  [129, "She is good in ${w}.", "PREP.DEP", "good in ${w}", "math maths mathematics english spanish french science history sports languages physics chemistry biology music art cooking drawing writing football tennis swimming"],
  [130, "${w} good in math.", "PREP.DEP", "good in math", "am is are was were be being i'm you're he's she's we're they're"],
  [131, "She arrived to the ${w}.", "PREP.DEP", null, "sound news sight smell noise cheers applause music"],
  [132, "She arrived to ${w} house.", "PREP.DEP", "arrived to ${w} house", "the my his her our their your"],
  [140, "She is ${w} good in math.", "PREP.DEP", "good in math", "very really quite so"],
  [155, "I study everyday ${w} home.", "MECH.EVERYDAY", "everyday", "at in on before after because since"],
  [156, "It is ${w} everyday.", "MECH.EVERYDAY", null, "the an my your our their his her"],
  [161, "I study here since ${w} years.", "TNS.SINCE_FOR", "since ${w} years", "a an one two three four five six seven eight nine ten eleven twelve several few many couple half"],
  [162, "I study here since two ${w} years.", "TNS.SINCE_FOR", "since two ${w} years", "few couple of long lot little half an a about almost nearly over more than like"],
  [163, "We study since two years ${w} like it.", "TNS.SINCE_FOR", "since two years", "i we he she they it you and but in at on because now so with my"],
  [164, "${w} here since 2010.", "TNS.SINCE_FOR", "${w} here since 2010", "live lives work works study studies know knows am is are i'm you're we're they're learn learns stay stays"],
  [165, "I have ${w} here for 2010.", "TNS.SINCE_FOR", "have ${w} here for 2010", "lived worked studied known waited stayed been"],
  [166, "I have been ${w} for 2010.", "TNS.SINCE_FOR", "have been ${w} for 2010", "here there in at married single working living studying waiting learning"],
  [210, "I've ${w} go.", "FUT.AUX_MIX", "i've ${w} go", "will can could should must might shall"],
  [218, "I ${w} to go.", "GER.AVOID_TO", "${w} to go", "avoid avoids avoided avoiding enjoy enjoys enjoyed enjoying finish finishes finished finishing suggest suggests suggested suggesting mind minds minded imagine imagined imagining"],
  [223, "I left ${w} to go.", "GER.INF_AFTER_PREP", "${w} to go", "for without after before"],
  [224, "I use it for ${w} it.", "GER.INF_AFTER_PREP", "for ${w}", "learn buy see find improve speak understand meet make obtain have be know"],
  [225, "See the page for visit ${w}.", "GER.INF_AFTER_PREP", null, "hours hour days day time times information rights policy"],
  [248, "She ${w} it.", "VRB.THIRD_S_OMIT", "she ${w}", "go like want need have do know think work live play study speak come make take love eat see say get run write"],
  [249, "I ${w} she like pizza.", "VRB.THIRD_S_OMIT", null, "does did can could will would should must might may shall let make made help see watch hear that where what when why how who if whether rather wish"],
  [250, "I ${w} he go home.", "VRB.THIRD_S_OMIT", null, "suggest suggests suggested recommend recommended insist insisted demand demanded require required propose proposed request requested important essential vital necessary imperative"],
  [263, "${w} live she?", "Q.WORD_ORDER", "${w} live she", "where when why how"],
  [264, "Where ${w} he?", "Q.WORD_ORDER", "where ${w} he", "live lives go goes work works study studies come comes want wants like likes need needs stay stays play plays speak speaks think thinks know knows eat eats buy buys sleep sleeps arrive arrives"],
  [265, "Where live ${w}?", "Q.WORD_ORDER", "where live ${w}", "he she they we i you"],
  [272, "${w} you live?", "Q.AUX_OMIT", "${w} you live", "where what when why how"],
  [273, "Where ${w} live?", "Q.AUX_OMIT", "where ${w} live", "you he she they we i"],
  [274, "Where you ${w}?", "Q.AUX_OMIT", "where you ${w}", "live work study go come want like need do have think know say mean play eat buy feel"],
  [284, "He ${w} me to go.", "CAUS.MAKE_ME_WORKS", "${w} me to go", "make makes made making let lets letting"],
  [285, "She makes ${w} to go.", "CAUS.MAKE_ME_WORKS", "makes ${w} to go", "me him us them you"],
  [293, "They are ${w}.", "ADJ.PLURAL", "${w}", "awesomes beautifuls importants differents interestings difficults expensives impossibles fantastics nices"],
  [298, "I need ${w}.", "NOUN.COUNT_UNCOUNT", "${w}", "informations advices furnitures luggages homeworks equipments knowledges newses baggages"],
  [299, "She has many ${w}.", "NOUN.COUNT_UNCOUNT", "many ${w}", "luggage baggage furniture information advice homework equipment knowledge money traffic"],
  [300, "She has many ${w}.", "NOUN.COUNT_UNCOUNT", "many ${w}", "time person thing friend car book student problem day hour year word question"],
  [301, "She has much ${w}.", "NOUN.COUNT_UNCOUNT", "much ${w}", "people friends things books cars students problems children persons words hours days times years questions"],
  [312, "The ${w} play.", "NOUN.PLURAL_IRREG", "${w}", "childs womans foots feets tooths sheeps gooses lifes wifes"],
  [317, "It is more ${w}.", "ADJ.COMPARATIVE_DOUBLE", "more ${w}", "better best worse worst bigger biggest smaller smallest taller tallest easier easiest harder hardest faster fastest cheaper cheapest older oldest younger youngest longer longest higher highest lower lowest stronger strongest happier happiest nicer nicest larger largest quicker closer richer"],
  [322, "It is the most ${w}.", "ADJ.SUPERLATIVE", "the most ${w}", "big fast tall small old young long short hot cold rich poor high cheap large easy nice late hard"],
  [331, "I feel ${w}.", "ADJ.BORED_BORING", "i feel ${w}", "boring tiring confusing exciting annoying frightening embarrassing surprising disappointing depressing worrying shocking terrifying interesting"],
  [332, "I feel ${w} boring.", "ADJ.BORED_BORING", "i feel ${w} boring", "very so really too quite"],
  [341, "He ${w} English good.", "ADJ.ADV_CONFUSION", "${w} english good", "speak speaks spoke sing sings sang play plays played write writes swim swims cook cooks dance dances drive drives"],
  [342, "She sings good ${w} dances.", "ADJ.ADV_CONFUSION", "sings good", "and but at than"],
  [343, "He speaks ${w} good.", "ADJ.ADV_CONFUSION", "speaks ${w} good", "very really so"],
  [354, "It was ${w}.", "SPELL.GENERAL", "${w}", "yesterdey firts finaly cluidy paseed oportunity oportunitys oportunities begining beautifull becouse becuase recieve definately seperate tommorrow tomorow wich freind adress intresting"],
  [359, "It was ${w}.", "SPELL.ES_INTERFERENCE", "${w}", "semestre carrer diferent comunication necesary inteligent"],
  [368, "${w} agree with you.", "LEX.CALQUE", "${w} agree", "am is are i'm you're we're they're"],
  [369, "I have ${w} years old.", "LEX.CALQUE", "i have ${w} years old", "two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty"],
  [90, "I ${w} say nothing.", 'NEG.DOUBLE', "${w} say nothing", "don't doesn't didn't can't couldn't won't wouldn't shouldn't isn't aren't wasn't weren't haven't hasn't hadn't cannot not"],
  [90, "I ${w} not say nothing.", 'NEG.DOUBLE', "${w} not say nothing", "do does did"],
];

for (const [line, tpl, code, frag, words] of GROUPS) {
  test(`lista de errorDetect.js L${line}: cada palabra ${frag === null ? 'NO da' : 'da'} ${code}`, () => {
    for (const w of words.split(' ')) {
      const s = tpl.replaceAll('${w}', w);
      if (frag === null) assert.equal(has(s, code, null), false, `«${s}» no debe dar ${code}`);
      else assert.equal(has(s, code, frag.replaceAll('${w}', w)), true, `«${s}» debe dar ${code} sobre «${frag.replaceAll('${w}', w)}»`);
    }
  });
}
