#!/usr/bin/env python3
# @purpose: Verificación opcional en Chromium real de trap_translate y translate_bank (2.5-T3) a 360 px: banco que inserta palabras, objetivos táctiles, aviso de trampa en texto y sin desbordes.
"""Verificación visual y de accesibilidad de `ui/exercises/translateTypes.js` (subparte 2.5, tramo 3). NO forma parte de `npm run check`.

Reutiliza el servidor, la CSP y las medidas de `tools/text-answer-check.py` (misma página anfitriona, 360x640, 3 temas, texto «Normal» y «Muy grande»).
Casos:
  bank  (translate_bank): el grupo «Banco de palabras» existe, cada botón mide al menos 44 px, tocar palabras las pone en el campo, un banco con una palabra larguísima no desborda,
        y tras «Comprobar» el banco queda deshabilitado.
  trap  (trap_translate): escribir el error típico da «Todavía no», muestra el aviso `.ta__trap` EN TEXTO (no solo color) con la pista del catálogo, y la respuesta correcta.
Sale con 1 si algo falla y con 2 si Playwright no está instalado. Capturas: lanzarla con --out /tmp/translate-shots, fuera del repo (TRAMPA-33).

Uso:  python3 tools/translate-check.py [--out /tmp/translate-shots]
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
CASES = ['bank', 'trap']

HOST_JS = """
import { createTranslateType } from '/ui/exercises/translateTypes.js';
const LONGWORD = 'incomprehensibilidadinterminable'.repeat(2);
const ITEMS = {
  bank: { id: 'b', type: 'translate_bank', prompt_es: 'Tengo veinte a\\u00f1os y vivo con mi familia en una casa muy grande.',
    accept: ['I am 20 years old.'], explain_es: 'La edad se dice con to be.',
    data: { bank: ['I', 'am', 'have', '20', 'years', 'old', 'a', 'the', 'live', 'with', LONGWORD, 'family', 'house', 'big'] } },
  trap: { id: 't', type: 'trap_translate', prompt_es: 'Tengo veinte a\\u00f1os.', accept: ['I am 20 years old.', 'I am twenty years old.'],
    distractors: [{ text: 'I have 20 years.', code: 'LEX.HAVE_AGE' }], explain_es: 'La edad se dice con to be.', data: {} },
};
const catalog = { has: (c) => c === 'LEX.HAVE_AGE', hint: () => 'La edad usa \\u00abbe\\u00bb, no \\u00abhave\\u00bb.' };
window.__sent = [];
let current = null;
window.mountCase = (name) => {
  if (current) current.destroy();
  document.getElementById('slot').replaceChildren();
  window.__sent = [];
  current = createTranslateType(ITEMS[name].type, { catalog: () => catalog }).mount(document.getElementById('slot'), ITEMS[name],
    { doc: document, win: window, submit: async (a) => { window.__sent.push(a); return { status: 'saved' }; } });
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
    page.evaluate(f"window.mountCase('{case}')")
    page.wait_for_selector('.ta__answer input')
    tag = f'{case}/{theme}/{size}'
    field = page.locator('.ta__answer input').first

    base_mod.check_measure(page.evaluate(base_mod.MEASURE), f'{tag} inicial', problems)
    if field.get_attribute('lang') != 'en':
        problems.append(f'{tag}: el campo no responde en inglés')
    if page.locator('.ta__instruction').inner_text().strip() == '':
        problems.append(f'{tag}: falta la instrucción')
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_1inicial.png'), full_page=True)

    if case == 'bank':
        group = page.locator('.ta__bank')
        if group.count() != 1 or group.get_attribute('role') != 'group' or not (group.get_attribute('aria-label') or '').strip():
            problems.append(f'{tag}: el banco no es un grupo con nombre accesible')
        words = page.locator('.ta__bank button')
        if words.count() != 14:
            problems.append(f'{tag}: se esperaban 14 palabras y hay {words.count()}')
        for w in ('I', 'am', '20'):
            page.locator('.ta__bank button', has_text=w).first.click()
        value = field.input_value()
        if value != 'I am 20':
            problems.append(f'{tag}: el banco insertó «{value}» y se esperaba «I am 20»')
        check_after = base_mod.MEASURE
        base_mod.check_measure(page.evaluate(check_after), f'{tag} con palabras', problems)
        field.fill('I am 20 years old.')
        page.get_by_role('button', name='Comprobar').click()
        page.wait_for_selector('.fb__verdict')
        page.wait_for_timeout(200)
        sent = page.evaluate('window.__sent')
        if len(sent) != 1 or sent[0].get('result') != 'correct':
            problems.append(f'{tag}: el acierto no se envió bien ({sent})')
        if page.locator('.ta__bank button:not([disabled])').count() != 0:
            problems.append(f'{tag}: el banco sigue activo tras enviar')
        notes.append('banco ok')
    else:
        field.fill('I have 20 years.')
        page.get_by_role('button', name='Comprobar').click()
        page.wait_for_selector('.fb__verdict')
        page.wait_for_timeout(250)
        verdict = page.locator('.fb__verdict').inner_text()
        trap = page.locator('.ta__trap')
        if 'Todavía no' not in verdict:
            problems.append(f'{tag}: la trampa no da «Todavía no» ({verdict[:30]})')
        if trap.count() != 1 or 'I have 20 years.' not in trap.inner_text() or 'be' not in trap.inner_text():
            problems.append(f'{tag}: falta el aviso de la trampa en texto')
        sent = page.evaluate('window.__sent')
        if len(sent) != 1 or sent[0].get('errorCodes') != ['LEX.HAVE_AGE']:
            problems.append(f'{tag}: el código de la trampa no viajó ({sent})')
        if page.locator('.fb__correct').count() != 1:
            problems.append(f'{tag}: no muestra la respuesta correcta')
        notes.append('trampa ok')
    base_mod.check_measure(page.evaluate(base_mod.MEASURE), f'{tag} corrección', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_2corregido.png'), full_page=True)
    if errors:
        problems.append(f'{tag}: errores de consola {errors[:3]}')
    ctx.close()
    return problems, notes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='/tmp/translate-shots')
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
