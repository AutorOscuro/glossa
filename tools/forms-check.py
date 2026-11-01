#!/usr/bin/env python3
# @purpose: Verificación opcional en Chromium real de three_forms (2.5-T3) a 360 px: tres campos con nombre, filas por forma con veredicto en texto, forma cambiada y sin desbordes.
"""Verificación visual y de accesibilidad de `ui/exercises/threeForms.js` (subparte 2.5, tramo 3). NO forma parte de `npm run check`.

Reutiliza el servidor, la CSP y las medidas de `tools/text-answer-check.py` (misma página anfitriona, 360x640, 3 temas, texto «Normal» y «Muy grande»).
Casos:
  ok    las tres formas bien en la tarjeta del pasado (faceta 1): 3 campos con nombre, «Comprobar» envía `correct` con responseRaw «sing / sang / sung» y 3 filas `.tf__form`.
  swap  presente y participio bien y pasado «sung» (forma cambiada): la faceta 1 envía `wrong`, la fila del pasado dice «Todavía no» y «Esa es la forma del participio» EN TEXTO,
        las otras dos filas dicen «Bien».
  empty un campo vacío no envía nada y avisa en texto.
Sale con 1 si algo falla y con 2 si Playwright no está instalado. Capturas: lanzarla con --out /tmp/forms-shots, fuera del repo (TRAMPA-33).

Uso:  python3 tools/forms-check.py [--out /tmp/forms-shots]
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
CASES = ['ok', 'swap', 'empty']

HOST_JS = """
import { createThreeForms } from '/ui/exercises/threeForms.js';
const ITEM = { id: 'v.sing', type: 'three_forms', prompt_es: 'cantar', explain_es: 'Es un verbo irregular.', grammar_note_es: 'sing, sang, sung.',
  data: { forms: { present: 'sing', past: 'sang', participle: 'sung' }, hint: 'Patr\\u00f3n i-a-u' } };
window.__sent = [];
let current = null;
window.mountCase = () => {
  if (current) current.destroy();
  document.getElementById('slot').replaceChildren();
  window.__sent = [];
  current = createThreeForms().mount(document.getElementById('slot'), ITEM,
    { doc: document, win: window, entry: { cardId: 'v.sing#1', facet: 1 }, submit: async (a) => { window.__sent.push(a); return { status: 'saved' }; } });
  return true;
};
window.__ready = true;
"""


def run_case(browser, base, theme, size, case, out):
    problems = []
    notes = []
    ctx = browser.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda x: errors.append(f'pageerror: {x}'))
    page.goto(f'{base}/__host.html')
    page.evaluate(f"document.documentElement.setAttribute('data-theme', '{theme}'); document.documentElement.setAttribute('data-text-size', '{size}')")
    page.wait_for_function('window.__ready === true')
    page.evaluate("window.mountCase()")
    page.wait_for_selector('.ta__answer input')
    tag = f'{case}/{theme}/{size}'
    fields = page.locator('.ta__answer input')
    base_mod.check_measure(page.evaluate(base_mod.MEASURE), f'{tag} inicial', problems)
    if fields.count() != 3:
        problems.append(f'{tag}: se esperaban 3 campos y hay {fields.count()}')
    for name in ('Presente', 'Pasado', 'Participio'):
        if page.get_by_label(name, exact=True).count() != 1:
            problems.append(f'{tag}: el campo «{name}» no tiene nombre accesible')
    for i in range(fields.count()):
        if fields.nth(i).get_attribute('lang') != 'en' or fields.nth(i).get_attribute('autocapitalize') != 'off':
            problems.append(f'{tag}: el campo {i} no es inglés sin mayúscula forzada')
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_1inicial.png'), full_page=True)

    values = {'ok': ['sing', 'sang', 'sung'], 'swap': ['sing', 'sung', 'sung'], 'empty': ['sing', '', 'sung']}[case]
    for i, v in enumerate(values):
        fields.nth(i).fill(v)
    page.get_by_role('button', name='Comprobar').click()
    page.wait_for_timeout(300)
    sent = page.evaluate('window.__sent')
    if case == 'empty':
        if sent:
            problems.append(f'{tag}: un campo vacío envió {sent}')
        if 'Escribe las tres formas' not in page.locator('.ta__msg').inner_text():
            problems.append(f'{tag}: falta el aviso de campo vacío en texto')
        notes.append('vacío no envía')
    else:
        page.wait_for_selector('.tf__form')
        rows = page.locator('.tf__form')
        if rows.count() != 3:
            problems.append(f'{tag}: se esperaban 3 filas y hay {rows.count()}')
        want = 'correct' if case == 'ok' else 'wrong'
        if len(sent) != 1 or sent[0].get('result') != want or sent[0].get('responseRaw') != ' / '.join(values):
            problems.append(f'{tag}: el envío no es el esperado ({sent})')
        text = [rows.nth(i).inner_text() for i in range(rows.count())]
        if case == 'swap':
            if 'Todavía no' not in text[1] or 'Esa es la forma del participio' not in text[1]:
                problems.append(f'{tag}: la fila del pasado no explica la forma cambiada en texto ({text[1]})')
            if 'Bien' not in text[0] or 'Bien' not in text[2]:
                problems.append(f'{tag}: las otras formas deberían decir «Bien» ({text})')
        else:
            if any('Bien' not in t for t in text):
                problems.append(f'{tag}: todas las filas deberían decir «Bien» ({text})')
        if page.locator('.ta__answer input:not([disabled])').count() != 0:
            problems.append(f'{tag}: los campos siguen activos tras enviar')
        notes.append('envío y filas ok')
    base_mod.check_measure(page.evaluate(base_mod.MEASURE), f'{tag} corrección', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_2corregido.png'), full_page=True)
    if errors:
        problems.append(f'{tag}: errores de consola {errors[:3]}')
    ctx.close()
    return problems, notes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='/tmp/forms-shots')
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
