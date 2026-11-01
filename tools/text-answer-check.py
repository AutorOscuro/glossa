#!/usr/bin/env python3
# @purpose: Verificación opcional en Chromium real de la entrada de texto (2.5-T1) a 360 px: atributos del teclado, sin desbordes, textos largos, vacío sin envío y errata con aviso ortográfico.
"""Verificación visual y de accesibilidad de la entrada de texto (`ui/exercises/textAnswer.js`, subparte 2.5, tramo 1). NO forma parte de `npm run check`.

Monta la pantalla REAL en una página anfitriona inyectada en memoria bajo la misma CSP de la app, a 360x640, en los 3 temas y con el
texto en «Normal» y «Muy grande». Para cada caso comprueba:
  - el campo tiene los atributos del teclado móvil (sin autocorrección ni mayúscula forzada) y el `lang` que toca,
  - sin desbordes horizontales y objetivos táctiles de al menos 44 px,
  - «Comprobar» con el campo vacío no envía y avisa,
  - tras responder con una errata («almost»): corrección, aviso ortográfico y tarjeta de deletreo dentro de la pantalla,
  - «No sé» en otra montura: respuesta visible y sin lenguaje de fallo,
  - sin errores de consola.
Guarda capturas (TRAMPA-33: lanzarla con --out /tmp/text-answer-shots, fuera del repo). Sale con 1 si algo falla y con 2 si Playwright no está instalado.

Uso:  python3 tools/text-answer-check.py [--out /tmp/text-answer-shots]
"""
import argparse
import functools
import http.server
import json
import os
import socketserver
import sys
import threading

CSP = ("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; "
       "object-src 'none'; base-uri 'none'; form-action 'none'")
THEMES = ['aurora', 'neo', 'claro']
SIZES = ['normal', 'xlarge']
CASES = ['simple', 'largo', 'es']

HOST_HTML = """<!doctype html>
<html lang="es" data-theme="aurora"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/ui/styles/tokens.css"><link rel="stylesheet" href="/ui/styles/themes.css">
<link rel="stylesheet" href="/ui/styles/base.css"><link rel="stylesheet" href="/ui/styles/components.css">
<link rel="stylesheet" href="/ui/styles/widgets.css"></head>
<body><div class="app-shell"><main class="app-main" id="slot"></main></div><script type="module" src="/__host.js"></script></body></html>"""

HOST_JS = """
import { createTextAnswer } from '/ui/exercises/textAnswer.js';
const LONG = 'supercalifragilisticoespialidosoextraordinariamenteinterminable'.repeat(2);
const ITEMS = {
  simple: { id: 's', type: 'fill_verb', prompt_es: 'Ella vive aqu\\u00ed.', situation: 'Hablar de d\\u00f3nde vives', explain_es: 'Tercera persona: -s.',
    grammar_note_es: 'En presente simple, he/she/it lleva -s.', nuance_es: 'Se usa para hechos estables.', accept: ['lives'], data: { hint: 'Verbo live', mask: 'first_letter' } },
  largo: { id: 'l', type: 'fill_verb', prompt_es: 'Necesito ' + LONG + ' para la reuni\\u00f3n de ma\\u00f1ana con todo el equipo de dise\\u00f1o y producto.',
    situation: 'Una situaci\\u00f3n con un nombre muy largo: ' + LONG, explain_es: 'Explicaci\\u00f3n larga. ' + LONG,
    grammar_note_es: 'Regla muy larga. ' + 'Esta explicaci\\u00f3n sigue y sigue para probar que el texto se parte en varias l\\u00edneas. '.repeat(3) + LONG,
    nuance_es: 'Matiz largo: ' + 'se usa en contextos formales y tambi\\u00e9n informales. '.repeat(3),
    accept: ['have prepared', 'have prepared it'], data: { hint: 'Present perfect de prepare. ' + LONG, mask: 'length' } },
  es: { id: 'e', type: 'translate_word', prompt_es: 'Traduce al espa\\u00f1ol: house', accept: ['casa'], data: { mask: 'length' } },
};
const card = { id: 'c1#0', itemId: 'c1', facet: 0, topics: ['t'], state: 2, due: '2026-11-27T12:00:00.000Z', stability: 10, difficulty: 5, reps: 3, lapses: 0, last_review: '2026-10-20T12:00:00.000Z', suspended: false, leech: false, fav: false, created: '2026-10-01T12:00:00.000Z' };
window.__spell = [];
window.__sent = [];
const cards = { now: () => new Date('2026-10-31T12:00:00.000Z'), read: async () => ({ ...card }),
  setFav: async (id, fav) => { card.fav = fav; return { status: 'saved', card: { ...card } }; },
  ensureSpell: async (f) => { window.__spell.push(f); return { status: 'created' }; } };
let current = null;
window.mountCase = (name) => {
  if (current) current.destroy();
  document.getElementById('slot').replaceChildren();
  window.__sent = [];
  window.__spell = [];
  current = createTextAnswer(name === 'es' ? { answerLang: 'es' } : {}).mount(document.getElementById('slot'), ITEMS[name],
    { doc: document, win: window, cards, entry: { cardId: 'c1#0' }, submit: async (a) => { window.__sent.push(a); return { status: 'saved', dueLabel: 'Repaso en 3 sem' }; } });
  return true;
};
window.__ready = true;
"""


MEASURE = """() => {
  const vw = document.documentElement.clientWidth;
  const out = { vw, scrollW: document.documentElement.scrollWidth, small: [], over: [] };
  for (const el of document.querySelectorAll('button, input, .btn')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.height < 43.5 || r.width < 43.5) out.small.push([el.tagName, (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20), Math.round(r.width), Math.round(r.height)]);
  }
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > vw + 0.5 || r.left < -0.5)) out.over.push([el.tagName, String(el.className).slice(0, 30), Math.round(r.left), Math.round(r.right)]);
  }
  return out;
}"""


def serve(root):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=root, **k)

        def do_GET(self):
            path = self.path.split('?')[0]
            if path in ('/__host.html', '/__host.js'):
                body = (HOST_HTML if path.endswith('.html') else HOST_JS).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8' if path.endswith('.html') else 'text/javascript; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.send_header('Content-Security-Policy', CSP)
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                self.wfile.write(body)
                return
            super().do_GET()

        def end_headers(self):
            self.send_header('Content-Security-Policy', CSP)
            self.send_header('Cache-Control', 'no-store')
            super().end_headers()

        def log_message(self, *a):
            pass

    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def check_measure(m, label, problems):
    if m['scrollW'] > m['vw']:
        problems.append(f"{label}: desborde horizontal ({m['scrollW']} > {m['vw']})")
    if m['over']:
        problems.append(f"{label}: elementos fuera de pantalla {m['over'][:3]}")
    if m['small']:
        problems.append(f"{label}: objetivos táctiles < 44 px {m['small'][:3]}")


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
    page.wait_for_selector('.pc__badges:not(.pc__badges--loading)')
    tag = f'{case}/{theme}/{size}'
    field = page.locator('.ta__answer input').first

    # 1) Estado inicial y atributos del teclado móvil (CA 6).
    check_measure(page.evaluate(MEASURE), f'{tag} inicial', problems)
    attrs = field.evaluate("e => ({ ac: e.getAttribute('autocapitalize'), cr: e.getAttribute('autocorrect'), sc: e.getAttribute('spellcheck'), au: e.getAttribute('autocomplete'), lang: e.getAttribute('lang') })")
    want_lang = 'es' if case == 'es' else 'en'
    if attrs['ac'] != 'off' or attrs['cr'] != 'off' or attrs['sc'] != 'false' or attrs['au'] != 'off':
        problems.append(f'{tag}: el campo no desactiva la autocorrección o la mayúscula ({attrs})')
    if attrs['lang'] != want_lang:
        problems.append(f"{tag}: lang del campo {attrs['lang']}, se esperaba {want_lang}")
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_1inicial.png'), full_page=True)

    # 2) Vacío no se envía (CA 3): también con solo espacios.
    field.fill('   ')
    page.get_by_role('button', name='Comprobar').click()
    page.wait_for_timeout(150)
    if page.evaluate('window.__sent.length') != 0:
        problems.append(f'{tag}: una respuesta vacía se envió')
    if page.locator('.ta__msg').inner_text().strip() == '':
        problems.append(f'{tag}: la respuesta vacía no avisa')
    check_measure(page.evaluate(MEASURE), f'{tag} vacío', problems)

    # 3) Pista (si hay) y respuesta con errata → corrección + aviso ortográfico (CA 2).
    hint = page.get_by_role('button', name='Ver pista')
    if hint.count():
        hint.click()
        check_measure(page.evaluate(MEASURE), f'{tag} pista', problems)
    typo = {'simple': 'liives', 'largo': 'have preparred', 'es': 'cassa'}[case]
    field.fill(typo)
    page.get_by_role('button', name='Comprobar').click()
    page.wait_for_selector('.fb__verdict')
    page.wait_for_timeout(250)
    verdict = page.locator('.fb__verdict').inner_text()
    notes.append(f'veredicto: {verdict[:30]}')
    sent = page.evaluate('window.__sent')
    if len(sent) != 1:
        problems.append(f'{tag}: se esperaba 1 envío y hubo {len(sent)}')
    elif case != 'largo' and sent[0].get('result') != 'almost':
        problems.append(f"{tag}: la errata dio {sent[0].get('result')}, no almost")
    if sent and case != 'largo' and page.locator('.ta__spell').count() != 1:
        problems.append(f'{tag}: falta el aviso ortográfico')
    check_measure(page.evaluate(MEASURE), f'{tag} corrección', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_2correccion.png'), full_page=True)

    # 4) «No sé» en una montura nueva: muestra la respuesta, sin tono de fallo.
    page.evaluate(f"window.mountCase('{case}')")
    page.wait_for_selector('.pc__badges:not(.pc__badges--loading)')
    page.get_by_role('button', name='No sé').nth(0).click()
    page.wait_for_selector('.fb__verdict')
    page.wait_for_timeout(200)
    if 'Todavía no' in page.locator('.fb__verdict').inner_text():
        problems.append(f'{tag}: «No sé» usa lenguaje de fallo')
    if page.locator('.fb__correct').count() != 1:
        problems.append(f'{tag}: «No sé» no muestra la respuesta')
    check_measure(page.evaluate(MEASURE), f'{tag} no sé', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_3nose.png'), full_page=True)

    if errors:
        problems.append(f'{tag}: errores de consola {errors[:3]}')
    ctx.close()
    return problems, notes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='/tmp/text-answer-shots')
    args = ap.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.stderr.write('Playwright no está instalado: verificación omitida (no probado en este entorno).\n')
        return 2
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    os.makedirs(args.out, exist_ok=True)
    srv = serve(root)
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
                    except Exception as exc:  # un paso que no se puede hacer (p. ej. un botón fuera de pantalla) también es un fallo
                        problems, notes = [f'{case}/{theme}/{size}: el recorrido se interrumpió: {str(exc).splitlines()[0][:120]}'], []
                    failed += 1 if problems else 0
                    sys.stdout.write(f"{'✘' if problems else '✔'} {case} {theme} {size}" + (f" — {' | '.join(problems)}" if problems else f" ({'; '.join(notes)})") + '\n')
        browser.close()
    srv.shutdown()
    sys.stdout.write(json.dumps({'casos': total, 'fallos': failed}, ensure_ascii=False) + '\n')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
