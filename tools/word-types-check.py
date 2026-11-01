#!/usr/bin/env python3
# @purpose: Verificación opcional en Chromium real de los 6 tipos de palabra y colocación (2.5-T2) a 360 px: instrucción, frase con hueco accesible, apoyo en español, máscara, pista y veredicto en texto.
"""Verificación visual y de accesibilidad de `ui/exercises/textTypes.js` (subparte 2.5, tramo 2; Chromium pendiente desde T2, cerrado en el punto 6 de T4). NO forma parte de `npm run check`.

Reutiliza el servidor, la CSP y las medidas de `tools/text-answer-check.py` (misma página anfitriona, 360x640, 3 temas, texto «Normal» y «Muy grande»).
Cada tipo se prueba con una respuesta buena (`ok`) y una mala (`bad`): 6 tipos x 2 respuestas x 3 temas x 2 tamaños = 72 recorridos.
Para cada uno comprueba, ANTES de contestar:
  - la instrucción por defecto del tipo, el texto principal con su `lang` y, si hay hueco, `.ta__gap` con `role="img"` y nombre «hueco»,
  - el apoyo en español (`.ta__aside`) solo donde toca, la máscara («Ayuda visual») solo donde toca y que en `translate_word` NO se vea `prompt_en` (sería la respuesta),
  - el campo en inglés, sin mayúscula forzada, con nombre accesible y VACÍO;
y DESPUÉS de tocar «Comprobar»: un solo envío con el `result` y el `responseRaw` esperados, veredicto en texto, la respuesta correcta visible si falla, campo bloqueado y sin desbordes.
En `fill_verb` pide además la pista antes de contestar: el envío lleva `hint: true`.
Sale con 1 si algo falla y con 2 si Playwright no está instalado. Capturas: lanzarla con --out /tmp/word-types-shots, fuera del repo (TRAMPA-33).

Uso:  python3 tools/word-types-check.py [--out /tmp/word-types-shots]
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

# tipo -> lo que debe verse antes de contestar y las dos respuestas.
TYPES = {
    'fill_verb':        dict(instruction='Escribe el verbo en la forma correcta.', main='She', lang='en', gaps=1, aside=True, mask=False, hint='Verbo live',
                             ok='lives', bad='live', never=None),
    'translate_word':   dict(instruction='Traduce al inglés.', main='casa', lang='es', gaps=0, aside=False, mask=True, hint=None,
                             ok='house', bad='home', never='house'),
    'first_letter':     dict(instruction='Completa la palabra.', main='ladra', lang='es', gaps=0, aside=False, mask=True, hint=None,
                             ok='dog', bad='cat', never=None),
    'collocation_fill': dict(instruction='Completa la expresión.', main='She made a', lang='en', gaps=1, aside=True, mask=False, hint=None,
                             ok='decision', bad='choice', never=None),
    'def_to_word':      dict(instruction='¿Qué palabra es?', main='enseña', lang='es', gaps=0, aside=False, mask=False, hint=None,
                             ok='teacher', bad='student', never=None),
    'derive_form':      dict(instruction='Escribe la forma que falta.', main='Her', lang='en', gaps=1, aside=True, mask=False, hint=None,
                             ok='happiness', bad='joy', never=None),
}
CASES = [(t, a) for t in TYPES for a in ('ok', 'bad')]

HOST_JS = """
import { createWordType } from '/ui/exercises/textTypes.js';
const ITEMS = {
  fill_verb: { id: 'w1', type: 'fill_verb', prompt_es: 'Ella vive aquí.', prompt_en: 'She ___ here.', accept: ['lives'], distractors: [], error_codes: [],
    explain_es: 'Tercera persona: -s.', grammar_note_es: 'En presente simple, he/she/it lleva -s.', data: { hint: 'Verbo live', mask: 'none' } },
  translate_word: { id: 'w2', type: 'translate_word', prompt_es: 'casa', prompt_en: 'house', accept: ['house'], explain_es: 'house = casa.', data: { mask: 'length' } },
  first_letter: { id: 'w3', type: 'first_letter', prompt_es: 'Un animal doméstico que ladra.', accept: ['dog'], explain_es: 'dog = perro.' },
  collocation_fill: { id: 'w4', type: 'collocation_fill', prompt_es: 'Tomó la decisión de irse temprano.', prompt_en: 'She made a ___ to leave early.', accept: ['decision'], explain_es: 'make a decision.' },
  def_to_word: { id: 'w5', type: 'def_to_word', prompt_es: 'Persona que enseña en una escuela.', accept: ['teacher'], explain_es: 'teacher = profesor.' },
  derive_form: { id: 'w6', type: 'derive_form', prompt_es: 'Escribe el sustantivo de «happy».', prompt_en: 'Her ___ was obvious. (happy)', accept: ['happiness'], explain_es: 'happy → happiness.' },
};
window.__sent = [];
let current = null;
window.mountCase = (type) => {
  if (current) current.destroy();
  document.getElementById('slot').replaceChildren();
  window.__sent = [];
  current = createWordType(type).mount(document.getElementById('slot'), ITEMS[type],
    { doc: document, win: window, entry: { cardId: ITEMS[type].id + '#0' }, submit: async (a) => { window.__sent.push(a); return { status: 'saved' }; } });
  return true;
};
window.__ready = true;
"""


def run_case(browser, base, theme, size, type_, answer, out):
    problems = []
    notes = []
    want = TYPES[type_]
    ctx = browser.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda x: errors.append(f'pageerror: {x}'))
    page.goto(f'{base}/__host.html')
    page.evaluate(f"document.documentElement.setAttribute('data-theme', '{theme}'); document.documentElement.setAttribute('data-text-size', '{size}')")
    page.wait_for_function('window.__ready === true')
    page.evaluate(f"window.mountCase('{type_}')")
    page.wait_for_selector('.ta__answer input')
    tag = f'{type_}/{answer}/{theme}/{size}'
    base_mod.check_measure(page.evaluate(base_mod.MEASURE), f'{tag} inicial', problems)

    if page.locator('.ta__instruction').count() != 1 or page.locator('.ta__instruction').first.inner_text().strip() != want['instruction']:
        problems.append(f'{tag}: la instrucción debería decir «{want["instruction"]}»')
    prompt = page.locator('.ta__prompt')
    if prompt.count() != 1 or want['main'] not in prompt.first.inner_text() or prompt.first.get_attribute('lang') != want['lang']:
        problems.append(f'{tag}: el texto principal no es el esperado (lang {prompt.first.get_attribute("lang") if prompt.count() else None})')
    gaps = page.locator('.ta__gap')
    if gaps.count() != want['gaps']:
        problems.append(f'{tag}: se esperaban {want["gaps"]} hueco(s) y hay {gaps.count()}')
    for i in range(gaps.count()):
        if gaps.nth(i).get_attribute('role') != 'img' or gaps.nth(i).get_attribute('aria-label') != 'hueco':
            problems.append(f'{tag}: el hueco {i} no es accesible')
    if (page.locator('.ta__aside').count() == 1) != want['aside']:
        problems.append(f'{tag}: el apoyo en español {"falta" if want["aside"] else "sobra"}')
    if (page.locator('.ta__mask').count() == 1) != want['mask']:
        problems.append(f'{tag}: la máscara {"falta" if want["mask"] else "sobra"}')
    if want['never'] and want['never'] in page.locator('.ta').first.inner_text().lower():
        problems.append(f'{tag}: se ve «{want["never"]}» antes de contestar (es la respuesta)')
    field = page.locator('.ta__answer input')
    if page.get_by_label('Escribe tu respuesta', exact=True).count() != 1:
        problems.append(f'{tag}: el campo no tiene nombre accesible')
    if field.first.get_attribute('lang') != 'en' or field.first.get_attribute('autocapitalize') != 'off':
        problems.append(f'{tag}: el campo no es inglés sin mayúscula forzada')
    if field.first.input_value() != '':
        problems.append(f'{tag}: el campo no arranca vacío')
    page.screenshot(path=os.path.join(out, f'{type_}_{answer}_{theme}_{size}_1inicial.png'), full_page=True)

    used_hint = False
    if want['hint']:
        page.get_by_role('button', name='Ver pista').click()
        if want['hint'] not in page.locator('.ta__hint').inner_text():
            problems.append(f'{tag}: la pista no dice «{want["hint"]}»')
        used_hint = True
    text = want[answer]
    field.first.fill(text)
    page.get_by_role('button', name='Comprobar').click()
    page.wait_for_selector('.fb__verdict')
    page.wait_for_timeout(250)
    sent = page.evaluate('window.__sent')
    result = 'correct' if answer == 'ok' else 'wrong'
    if len(sent) != 1 or sent[0].get('result') != result or sent[0].get('responseRaw') != text or bool(sent[0].get('hint')) != used_hint:
        problems.append(f'{tag}: el envío no es el esperado ({sent})')
    verdict = page.locator('.fb__verdict').first.inner_text()
    if (result == 'correct' and 'Bien' not in verdict) or (result == 'wrong' and 'Todavía no' not in verdict):
        problems.append(f'{tag}: el veredicto no se lee en texto ({verdict!r})')
    correct = page.locator('.fb__correct')
    if result == 'wrong' and (correct.count() != 1 or want['ok'] not in correct.first.inner_text()):
        problems.append(f'{tag}: no se ve la respuesta correcta «{want["ok"]}»')
    if result == 'correct' and correct.count() != 0:
        problems.append(f'{tag}: acierto con «Respuesta:» a la vista')
    if page.locator('.ta__answer input:not([disabled])').count() != 0:
        problems.append(f'{tag}: el campo sigue activo tras enviar')
    notes.append(result + (', con pista' if used_hint else ''))
    base_mod.check_measure(page.evaluate(base_mod.MEASURE), f'{tag} corrección', problems)
    page.screenshot(path=os.path.join(out, f'{type_}_{answer}_{theme}_{size}_2corregido.png'), full_page=True)
    if errors:
        problems.append(f'{tag}: errores de consola {errors[:3]}')
    ctx.close()
    return problems, notes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='/tmp/word-types-shots')
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
        for type_, answer in CASES:
            for theme in THEMES:
                for size in SIZES:
                    total += 1
                    try:
                        problems, notes = run_case(browser, base, theme, size, type_, answer, args.out)
                    except Exception as exc:
                        problems, notes = [f'{type_}/{answer}/{theme}/{size}: el recorrido se interrumpió: {str(exc).splitlines()[0][:120]}'], []
                    failed += 1 if problems else 0
                    sys.stdout.write(f"{'✘' if problems else '✔'} {type_} {answer} {theme} {size}" + (f" — {' | '.join(problems)}" if problems else f" ({'; '.join(notes)})") + '\n')
        browser.close()
    srv.shutdown()
    sys.stdout.write(json.dumps({'casos': total, 'fallos': failed}, ensure_ascii=False) + '\n')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
