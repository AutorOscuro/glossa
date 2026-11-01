#!/usr/bin/env python3
# @purpose: Verificación opcional en Chromium real de fix_error, transform, keyword_transform, join_sentences y pronoun_placement (2.5-T4) a 360 px: etiquetas y avisos en texto, envío único y sin desbordes.
"""Verificación visual y de accesibilidad de `ui/exercises/fixError.js` y `ui/exercises/transformTypes.js` (subparte 2.5, tramo 4). NO forma parte de `npm run check`.

Reutiliza el servidor, la CSP y las medidas de `tools/text-answer-check.py` (misma página anfitriona, 360x640, 3 temas, texto «Normal» y «Muy grande»).
La página anfitriona inyecta un detector fijo (`can to`) para que la pista del detector sea determinista; el resto es la pantalla REAL.
Casos (cada uno escribe una respuesta, toca «Comprobar» y mira el veredicto, el envío y los avisos EN TEXTO):
  fix_ok       fix_error con la corrección buena: `correct`, sin avisos.
  fix_same     fix_error dejando la oración igual: `wrong` y «No cambiaste nada» (solo ese aviso).
  fix_detect   fix_error con otro «can to»: `wrong` y la pista del detector en `.ta__detect`.
  tran_long    transform con instrucción, oración y respuesta larguísimas: sin desbordes, sin etiqueta de clave.
  kw_missing   keyword_transform sin la palabra clave: etiqueta «Palabra clave: taller» y aviso «palabra clave».
  join_missing join_sentences sin el conector: etiqueta «Conector: because» y aviso «conector» (sin «palabra clave»).
  join_ok      join_sentences con el conector: `correct`, sin avisos.
  pron_trap    pronoun_placement con la trampa «Pick up it.»: `wrong`, aviso `.ta__trap`, sin etiqueta ni aviso de clave.
En todos: campo en inglés sin mayúscula forzada y con nombre accesible, un solo envío, campo bloqueado tras enviar, avisos con role="note", sin errores de consola.
Sale con 1 si algo falla y con 2 si Playwright no está instalado. Capturas: lanzarla con --out /tmp/transform-shots, fuera del repo (TRAMPA-33).

Uso:  python3 tools/transform-check.py [--out /tmp/transform-shots]
"""
import argparse
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('text_answer_check', os.path.join(HERE, 'text-answer-check.py'))
base_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base_mod)

THEMES = base_mod.THEMES
SIZES = base_mod.SIZES
NOTES = ['.ta__unchanged', '.ta__trap', '.ta__kwmissing', '.ta__detect']

# texto escrito, veredicto esperado, avisos que DEBEN estar (clase, texto que debe contener) y etiqueta de clave esperada (o None).
CASES = {
    'fix_ok':       dict(text='She can swim.', result='correct', notes=[], label=None),
    'fix_same':     dict(text='She can to swim.', result='wrong', notes=[('.ta__unchanged', 'No cambiaste nada')], label=None),
    'fix_detect':   dict(text='She can to run fast.', result='wrong', notes=[('.ta__detect', 'can to')], label=None),
    'tran_long':    dict(text='Se me ocurre esta respuesta tan larga y tan equivocada ' + 'incomprehensibilities' * 6, result='wrong', notes=[], label=None),
    'kw_missing':   dict(text='She is bigger than me.', result='wrong', notes=[('.ta__kwmissing', 'palabra clave')], label='Palabra clave: taller'),
    'join_missing': dict(text='We stayed home. It rained.', result='wrong', notes=[('.ta__kwmissing', 'conector')], label='Conector: because'),
    'join_ok':      dict(text='We stayed home because it rained.', result='correct', notes=[], label='Conector: because'),
    'pron_trap':    dict(text='Pick up it.', result='wrong', notes=[('.ta__trap', 'Pick up it.')], label=None),
}

HOST_JS = """
import { createFixError } from '/ui/exercises/fixError.js';
import { createTransformType } from '/ui/exercises/transformTypes.js';
const LONG_ES = 'extraordinariamenteinterminablementecomplicadoparaleerenunapantallapequena'.repeat(2);
const LONG_EN = 'Incomprehensibilities'.repeat(6);
const ITEMS = {
  fix_ok: { id: 'f1', type: 'fix_error', prompt_es: 'Corrige el error en la oraci\\u00f3n.', prompt_en: 'She can to swim.', accept: ['She can swim.'], distractors: [], error_codes: ['VRB.CAN_TO'],
    explain_es: 'Despu\\u00e9s de \\u00abcan\\u00bb va el verbo solo.', grammar_note_es: 'can + verbo sin to.' },
  tran_long: { id: 't1', type: 'transform', prompt_es: 'Reescribe. ' + LONG_ES, accept: ['It is hard.'], distractors: [], error_codes: [],
    explain_es: 'Explicaci\\u00f3n larga. ' + LONG_ES, grammar_note_es: 'Regla larga. ' + LONG_ES,
    data: { source: LONG_EN + ' is difficult to understand.', instruction_es: 'Reescribe la oraci\\u00f3n con otras palabras. ' + LONG_ES, keyword: null } },
  kw_missing: { id: 'k1', type: 'keyword_transform', prompt_es: 'Usa la palabra clave.', accept: ['She is taller than me.'], distractors: [], error_codes: [],
    explain_es: 'Comparativo corto: -er.', data: { source: 'I am not as tall as her.', instruction_es: 'Reescribe con \\u00abtaller\\u00bb.', keyword: 'taller' } },
  join_missing: { id: 'j1', type: 'join_sentences', prompt_es: 'Une las oraciones.', accept: ['We stayed home because it rained.', 'Because it rained, we stayed home.'], distractors: [], error_codes: [],
    explain_es: 'because explica la causa.', data: { source: 'It rained. We stayed home.', instruction_es: null, keyword: 'because' } },
  pron_trap: { id: 'p1', type: 'pronoun_placement', prompt_es: 'Cambia el objeto por un pronombre.', prompt_en: 'Pick up the box.', accept: ['Pick it up.'],
    distractors: [{ text: 'Pick up it.', code: 'PRN.PHRASAL_SPLIT' }], error_codes: [], explain_es: 'El pronombre va en medio.' },
};
ITEMS.fix_same = ITEMS.fix_ok; ITEMS.fix_detect = ITEMS.fix_ok; ITEMS.join_ok = ITEMS.join_missing;
const detect = (t) => (/can to/i.test(t) ? [{ code: 'VRB.CAN_TO', hint: 'Parece que usaste \\u00abcan to\\u00bb: despu\\u00e9s de can va el verbo solo.' }] : []);
const catalog = { has: (c) => c === 'PRN.PHRASAL_SPLIT', get: () => null, hint: () => 'Con un pronombre, la part\\u00edcula va despu\\u00e9s.' };
window.__sent = [];
let current = null;
window.mountCase = (name) => {
  if (current) current.destroy();
  document.getElementById('slot').replaceChildren();
  window.__sent = [];
  const item = ITEMS[name];
  const ui = item.type === 'fix_error' ? createFixError({ detect, catalog }) : createTransformType(item.type, { detect, catalog });
  current = ui.mount(document.getElementById('slot'), item,
    { doc: document, win: window, entry: { cardId: item.id + '#0' }, submit: async (a) => { window.__sent.push(a); return { status: 'saved' }; } });
  return true;
};
window.__ready = true;
"""


def run_case(browser, base, theme, size, case, out):
    problems = []
    notes = []
    want = CASES[case]
    ctx = browser.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda x: errors.append(f'pageerror: {x}'))
    page.goto(f'{base}/__host.html')
    page.evaluate(f"document.documentElement.setAttribute('data-theme', '{theme}'); document.documentElement.setAttribute('data-text-size', '{size}')")
    page.wait_for_function('window.__ready === true')
    page.evaluate(f"window.mountCase('{case}')")
    page.wait_for_selector('.ta__answer input')
    tag = f'{case}/{theme}/{size}'
    field = page.locator('.ta__answer input')
    base_mod.check_measure(page.evaluate(base_mod.MEASURE), f'{tag} inicial', problems)

    if field.count() != 1:
        problems.append(f'{tag}: se esperaba 1 campo y hay {field.count()}')
    if page.get_by_label('Escribe tu respuesta', exact=True).count() != 1:
        problems.append(f'{tag}: el campo no tiene nombre accesible')
    if field.first.get_attribute('lang') != 'en' or field.first.get_attribute('autocapitalize') != 'off':
        problems.append(f'{tag}: el campo no es inglés sin mayúscula forzada')
    if field.first.input_value() != '':
        problems.append(f'{tag}: el campo no arranca vacío ({field.first.input_value()!r})')
    if page.locator('.ta__instruction').count() != 1 or page.locator('.ta__prompt--error, .ta__prompt--source').count() != 1:
        problems.append(f'{tag}: faltan la instrucción o la oración base')
    label = page.locator('.ta__keyword')
    if want['label'] is None:
        if label.count() != 0:
            problems.append(f'{tag}: no debería haber etiqueta de clave ({label.first.inner_text()!r})')
    elif label.count() != 1 or label.first.inner_text().strip() != want['label']:
        problems.append(f'{tag}: la etiqueta debería decir «{want["label"]}» ({[label.nth(i).inner_text() for i in range(label.count())]})')
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_1inicial.png'), full_page=True)

    field.first.fill(want['text'])
    page.get_by_role('button', name='Comprobar').click()
    page.wait_for_selector('.fb__verdict')
    page.wait_for_timeout(250)
    sent = page.evaluate('window.__sent')
    if len(sent) != 1 or sent[0].get('result') != want['result'] or sent[0].get('responseRaw') != want['text']:
        problems.append(f'{tag}: el envío no es el esperado ({sent})')
    verdict = page.locator('.fb__verdict').first.inner_text()
    if want['result'] == 'correct' and 'Bien' not in verdict or want['result'] == 'wrong' and 'Todavía no' not in verdict:
        problems.append(f'{tag}: el veredicto no se lee en texto ({verdict!r})')
    present = {cls for cls, _ in want['notes']}
    for cls, needle in want['notes']:
        node = page.locator(cls)
        if node.count() != 1:
            problems.append(f'{tag}: falta el aviso {cls}')
        else:
            text = node.first.inner_text()
            if needle.lower() not in text.lower():
                problems.append(f'{tag}: el aviso {cls} no dice «{needle}» ({text!r})')
            if node.first.get_attribute('role') != 'note':
                problems.append(f'{tag}: el aviso {cls} no tiene role="note"')
    for cls in NOTES:
        if cls not in present and page.locator(cls).count() != 0:
            problems.append(f'{tag}: sobra el aviso {cls} ({page.locator(cls).first.inner_text()!r})')
    if case == 'join_missing' and 'palabra clave' in page.locator('.ta__kwmissing').first.inner_text().lower():
        problems.append(f'{tag}: join_sentences habla de «palabra clave» en vez de «conector»')
    if page.locator('.ta__answer input:not([disabled])').count() != 0:
        problems.append(f'{tag}: el campo sigue activo tras enviar')
    if want['result'] == 'wrong' and page.locator('.fb__correct').count() != 1:
        problems.append(f'{tag}: no se ve la respuesta correcta')
    notes.append(f"{want['result']}, {len(want['notes'])} aviso(s)")
    base_mod.check_measure(page.evaluate(base_mod.MEASURE), f'{tag} corrección', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_2corregido.png'), full_page=True)
    if errors:
        problems.append(f'{tag}: errores de consola {errors[:3]}')
    ctx.close()
    return problems, notes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='/tmp/transform-shots')
    args = ap.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.stderr.write('Playwright no está instalado: verificación omitida (no probado en este entorno).\n')
        return 2
    base_mod.HOST_JS = HOST_JS
    root = os.path.abspath(os.path.join(HERE, '..'))
    os.makedirs(args.out, exist_ok=True)
    srv = base_mod.serve(root)
    base = f'http://127.0.0.1:{srv.server_address[1]}'
    failed = 0
    total = 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        sys.stdout.write(f'Chromium {browser.version}\n')
        for case in CASES:
            for theme in THEMES:
                for size in SIZES:
                    total += 1
                    try:
                        problems, notes = run_case(browser, base, theme, size, case, args.out)
                    except Exception as exc:
                        problems, notes = [f'{case}/{theme}/{size}: el recorrido se interrumpió: {str(exc).splitlines()[0][:120]}'], []
                    failed += 1 if problems else 0
                    sys.stdout.write(f"{'✘' if problems else '✔'} {case} {theme} {size}" + (f" — {' | '.join(problems)}" if problems else f" ({'; '.join(notes)})") + '\n')
        browser.close()
    srv.shutdown()
    sys.stdout.write(json.dumps({'casos': total, 'fallos': failed}, ensure_ascii=False) + '\n')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
