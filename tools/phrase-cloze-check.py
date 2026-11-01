#!/usr/bin/env python3
# @purpose: Verificación opcional en Chromium real de la tarjeta phrase_cloze a 360 px: sin desbordes, textos largos con salto, hueco leído por el lector de pantalla y objetivos táctiles.
"""Verificación visual y de accesibilidad de `phrase_cloze` (subparte 2.2, tramo 4). NO forma parte de `npm run check`.

Monta la tarjeta REAL (ui/exercises/phraseCloze.js, con sus insignias y la hoja del «?») en una página anfitriona que se
inyecta en memoria (no hay archivos nuevos que publicar) bajo la misma CSP de la app, a 360x640, en los 3 temas y con el
texto en «Normal» y «Muy grande». Para cada caso comprueba:
  - sin desbordes horizontales (documento ni elementos),
  - objetivos táctiles de al menos 44 px (botones y campos),
  - el hueco tiene nombre accesible «hueco» según el navegador (rol img),
  - el micrófono está deshabilitado y la nota «disponible pronto» se ve,
  - tras responder con una errata («almost»): corrección, aviso ortográfico y la hoja del «?» siguen dentro de la pantalla,
  - sin errores de consola.
Guarda capturas. Sale con código 1 si algo falla y con 2 si Playwright no está instalado.

Uso:  python3 tools/phrase-cloze-check.py [--out shots]
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
CASES = ['dialogo', 'largo', 'simple']

HOST_HTML = """<!doctype html>
<html lang="es" data-theme="aurora"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/ui/styles/tokens.css"><link rel="stylesheet" href="/ui/styles/themes.css">
<link rel="stylesheet" href="/ui/styles/base.css"><link rel="stylesheet" href="/ui/styles/components.css">
<link rel="stylesheet" href="/ui/styles/widgets.css"></head>
<body><div class="app-shell"><main class="app-main" id="slot"></main></div><script type="module" src="/__host.js"></script></body></html>"""

HOST_JS = """
import { createPhraseCloze } from '/ui/exercises/phraseCloze.js';
const LONG = 'supercalifragilisticoespialidosoextraordinariamenteinterminable'.repeat(2);
const ITEMS = {
  dialogo: { id: 'd', type: 'phrase_cloze', prompt_es: 'No pude enviarlo.', situation: 'Hablar con un compañero de trabajo',
    grammar_note_es: 'Couldn\\u2019t es la forma negativa del pasado de can.', nuance_es: 'En la conversación casi siempre se usa la forma contraída.',
    explain_es: 'Usa couldn\\u2019t para algo que no fue posible en el pasado.',
    data: { text: 'No, I ___ send it.', answers: [['couldn\\u2019t', 'could not']], key_es: 'no pude', key_en: 'couldn\\u2019t', turns: [
      { who: 'A', es: '\\u00bfPudiste enviar el correo?', en: 'Did you send the email?' },
      { who: 'B', es: 'No, no pude enviarlo.', en: 'No, I ___ send it.' }] } },
  largo: { id: 'l', type: 'phrase_cloze', prompt_es: 'Necesito ' + LONG + ' para la reuni\\u00f3n de ma\\u00f1ana con todo el equipo de dise\\u00f1o y producto.',
    situation: 'Una situaci\\u00f3n con un nombre muy largo: ' + LONG,
    grammar_note_es: 'Regla muy larga. ' + 'Esta explicaci\\u00f3n sigue y sigue para probar que el texto se parte en varias l\\u00edneas sin salirse de la pantalla. '.repeat(3) + LONG,
    nuance_es: 'Matiz largo: ' + 'se usa en contextos formales y tambi\\u00e9n informales, seg\\u00fan la regi\\u00f3n. '.repeat(3),
    explain_es: 'Explicaci\\u00f3n larga. ' + LONG,
    data: { text: 'I need ' + LONG + ' for the meeting tomorrow with the whole design and product team, and I ___ it ready.', answers: [['have']], key_es: 'Necesito', key_en: 'I need' } },
  simple: { id: 's', type: 'phrase_cloze', prompt_es: 'Ella vive aqu\\u00ed.', data: { text: 'She ___ here.', answers: [['lives']], key_es: 'vive', key_en: 'lives' } },
};
const card = { id: 'c1#0', itemId: 'c1', facet: 0, topics: ['t'], state: 2, due: '2026-11-27T12:00:00.000Z', stability: 10, difficulty: 5, reps: 3, lapses: 0, last_review: '2026-10-20T12:00:00.000Z', suspended: false, leech: false, fav: false, created: '2026-10-01T12:00:00.000Z' };
const cards = { now: () => new Date('2026-10-27T12:00:00.000Z'), read: async () => ({ ...card }),
  setFav: async (id, fav) => { card.fav = fav; return { status: 'saved', card: { ...card } }; },
  ensureSpell: async () => ({ status: 'created' }) };
let current = null;
window.mountCase = (name) => {
  if (current) current.destroy();
  document.getElementById('slot').replaceChildren();
  current = createPhraseCloze().mount(document.getElementById('slot'), ITEMS[name],
    { doc: document, win: window, cards, entry: { cardId: 'c1#0' }, submit: async () => ({ status: 'saved', dueLabel: 'Repaso en 3 sem' }) });
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

    # 1) Estado inicial.
    check_measure(page.evaluate(MEASURE), f'{tag} inicial', problems)
    gaps = page.get_by_role('img', name='hueco').count()
    if gaps < 1:
        problems.append(f'{tag}: el lector de pantalla no encuentra ningún «hueco» (rol img)')
    notes.append(f'huecos con nombre «hueco»: {gaps}')
    mic = page.get_by_role('button', name='Decir la respuesta')
    if mic.count() != 1 or not mic.is_disabled():
        problems.append(f'{tag}: el micrófono no está deshabilitado')
    if page.get_by_text('disponible pronto').count() < 1:
        problems.append(f'{tag}: falta el aviso «disponible pronto»')
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_1inicial.png'), full_page=True)

    # 2) Hoja del «?».
    help_btn = page.locator('.pc__badges button:not(.pc__fav)').first
    if help_btn.count():
        help_btn.click()
    page.wait_for_timeout(350)
    if page.locator('[role="dialog"]').count():
        check_measure(page.evaluate(MEASURE), f'{tag} hoja «?»', problems)
        page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_2hoja.png'))
        page.keyboard.press('Escape')
        page.wait_for_timeout(350)
    else:
        problems.append(f'{tag}: no se pudo abrir la hoja del «?»')

    # 3) Dos pistas y respuesta con errata → corrección + aviso ortográfico.
    page.get_by_role('button', name='Ver pista').click()
    page.get_by_role('button', name='Otra pista').click()
    if page.get_by_role('button', name='Sin más pistas').count() != 1:
        problems.append(f'{tag}: la pista no llega a «Sin más pistas» tras 2 niveles')
    typo = {'dialogo': 'could nott', 'largo': 'havve', 'simple': 'liives'}[case]
    page.locator('.pc__answer input').first.fill(typo)
    page.get_by_role('button', name='Comprobar').click()
    page.wait_for_selector('.fb__verdict')
    page.wait_for_timeout(200)
    verdict = page.locator('.fb__verdict').inner_text()
    notes.append(f'veredicto: {verdict[:30]}')
    check_measure(page.evaluate(MEASURE), f'{tag} corrección', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_3correccion.png'), full_page=True)

    # 4) Corazón: se puede marcar y avisa su estado.
    heart = page.get_by_role('button', name='Marcar como favorita')
    if heart.count() == 1:
        heart.click()
        page.wait_for_timeout(150)
        if page.get_by_role('button', name='Quitar de favoritas').count() != 1:
            problems.append(f'{tag}: el corazón no cambió a «Quitar de favoritas»')
    else:
        problems.append(f'{tag}: no hay corazón «Marcar como favorita»')

    if errors:
        problems.append(f'{tag}: errores de consola {errors[:3]}')
    ctx.close()
    return problems, notes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='phrase-cloze-shots')
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
