#!/usr/bin/env python3
# @purpose: Verificación opcional en Chromium real del menú «⋯» de reporte (ui/reportMenu.js) y de «¿Por qué lo pensaste?» (ui/whyNote.js) bajo un panel de feedback con notas largas, a 360 px: sin desbordes, 44 px, estado con texto y foco que se conserva.
"""Verificación visual y de accesibilidad del menú de reporte (subparte 2.6, tramo 2, punto 2). NO forma parte de `npm run check`.

Monta el menú REAL (ui/reportMenu.js, con core/itemReport.js sobre la base en memoria) debajo del panel REAL (ui/feedbackPanel.js, estado «Todavía no.»
con las tres notas) en una página anfitriona inyectada en memoria, bajo la misma CSP de la app, a 360x640, en los 3 temas y con el texto en «Normal» y
«Muy grande». Casos: `corto` y `largo` (notas y palabras larguísimas). Para cada caso comprueba:
  - sin desbordes horizontales y objetivos táctiles de al menos 44 px (botón «⋯» y las dos opciones),
  - el botón «⋯» tiene nombre accesible y `aria-expanded` cambia al abrir y cerrar; la lista solo se ve abierta,
  - marcar «difícil» y «no me convence»: `aria-pressed`, texto del botón y aviso con texto (`role=status`), sin depender del color,
  - el foco sigue en el botón pulsado tras marcar (el menú no se vuelve a pintar),
  - quitar la marca vuelve al texto original y el reporte queda en la base (leído desde la página),
  - sin errores de consola.
Guarda capturas (por defecto en /tmp/report-menu-shots: fuera del repo, TRAMPA-33). Sale con código 1 si algo falla y con 2 si Playwright no está instalado.

Uso:  python3 tools/report-menu-check.py [--out /tmp/report-menu-shots]
"""
import argparse
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
CASES = ['corto', 'largo']

HOST_HTML = """<!doctype html>
<html lang="es" data-theme="aurora"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/ui/styles/tokens.css"><link rel="stylesheet" href="/ui/styles/themes.css">
<link rel="stylesheet" href="/ui/styles/base.css"><link rel="stylesheet" href="/ui/styles/components.css">
<link rel="stylesheet" href="/ui/styles/widgets.css"></head>
<body><div class="app-shell"><main class="app-main" id="slot"></main></div><script type="module" src="/__host.js"></script></body></html>"""

HOST_JS = """
import { h } from '/ui/dom.js';
import { feedbackNodes } from '/ui/feedbackPanel.js';
import { reportMenu } from '/ui/reportMenu.js';
import { createItemReport } from '/core/itemReport.js';
import { createMemoryDb } from '/core/db.memory.js';
import { whyNote } from '/ui/whyNote.js';
import { createWhyNote } from '/core/whyNote.js';
import { createEvents } from '/core/events.js';
const LONG = 'supercalifragilisticoespialidosoextraordinariamenteinterminable'.repeat(2);
const ITEMS = {
  corto: { id: 'a1', explain_es: 'Usa el pasado simple.', grammar_note_es: 'Con yesterday va el pasado simple.', nuance_es: 'En conversación se acorta.' },
  largo: { id: 'a2', explain_es: 'Explicaci\\u00f3n larga. ' + LONG, grammar_note_es: 'Regla muy larga. ' + 'Esta explicaci\\u00f3n sigue y sigue. '.repeat(4),
    nuance_es: 'Matiz largo: ' + 'se usa en contextos formales y tambi\\u00e9n informales. '.repeat(3) + LONG },
};
let report = null; let current = null;
window.mountCase = async (name) => {
  const db = createMemoryDb(); await db.open();
  report = createItemReport({ db });
  window.__report = report;
  const events = createEvents({ db });
  window.__events = events;
  const item = ITEMS[name];
  const slot = document.getElementById('slot');
  const why = whyNote({ h, why: createWhyNote({ events }), entry: { itemId: item.id, topics: ['gram.past_simple'], exerciseType: 'fill_verb' }, item });
  slot.replaceChildren(...feedbackNodes({ h, result: 'wrong', item, answer: 'She went home yesterday', why, report: reportMenu({ h, itemId: item.id, report }) }));
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
    page.wait_for_selector('.fb__report-option[aria-disabled=false]', state='attached')
    tag = f'{case}/{theme}/{size}'
    toggle = page.get_by_role('button', name='Más opciones de este ejercicio')
    if toggle.count() != 1:
        problems.append(f'{tag}: el botón «⋯» no tiene el nombre accesible esperado')
        ctx.close()
        return problems, notes

    # 1) Cerrado: la lista no se ve.
    if page.locator('.fb__report-list').is_visible():
        problems.append(f'{tag}: la lista está visible con el menú cerrado')
    check_measure(page.evaluate(MEASURE), f'{tag} cerrado', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_1cerrado.png'), full_page=True)

    # 2) Abrir.
    toggle.click()
    if toggle.get_attribute('aria-expanded') != 'true' or not page.locator('.fb__report-list').is_visible():
        problems.append(f'{tag}: al abrir, aria-expanded no es true o la lista no se ve')
    check_measure(page.evaluate(MEASURE), f'{tag} abierto', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_2abierto.png'), full_page=True)

    # 3) Marcar los dos tipos; foco y texto.
    hard = page.get_by_role('button', name='Marcar como difícil')
    hard.click()
    page.wait_for_selector('.fb__report-option[aria-pressed=true]')
    page.wait_for_function("!document.querySelector('.fb__report-option[aria-disabled=true]')")
    if page.evaluate("document.activeElement && document.activeElement.classList.contains('fb__report-option')") is not True:
        problems.append(f'{tag}: el foco no sigue en la opción pulsada')
    if 'difícil' not in page.locator('.fb__report-status').inner_text():
        problems.append(f'{tag}: el aviso de «difícil» no sale con texto')
    doubt = page.get_by_role('button', name='No me convence esta frase')
    doubt.click()
    page.wait_for_function('document.querySelectorAll(".fb__report-option[aria-pressed=true]").length === 2')
    page.wait_for_function("!document.querySelector('.fb__report-option[aria-disabled=true]')")
    saved = page.evaluate("window.__report.get('" + {'corto': 'a1', 'largo': 'a2'}[case] + "')")
    if not saved or not saved.get('hard') or not saved.get('doubt'):
        problems.append(f'{tag}: el reporte no quedó guardado en la base ({saved})')
    check_measure(page.evaluate(MEASURE), f'{tag} dos marcas', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_3marcado.png'), full_page=True)

    # 4) Quitar la marca de «difícil».
    page.get_by_role('button', name='Quitar la marca de difícil').click()
    page.wait_for_function('document.querySelectorAll(".fb__report-option[aria-pressed=true]").length === 1')
    if page.get_by_role('button', name='Marcar como difícil').count() != 1:
        problems.append(f'{tag}: al quitar la marca el botón no vuelve a «Marcar como difícil»')
    notes.append('marcar, quitar y base OK')

    # 5) «¿Por qué lo pensaste?»: va antes del menú «⋯», se abre, guarda la nota y deja el foco en «Guardar nota».
    order = page.evaluate("[...document.querySelectorAll('.fb__why, .fb__report')].map((n) => n.className)")
    if order != ['fb__why', 'fb__report']:
        problems.append(f'{tag}: el orden del final del feedback no es «¿Por qué lo pensaste?» y luego «⋯» ({order})')
    why_toggle = page.get_by_role('button', name='¿Por qué lo pensaste?')
    if why_toggle.count() != 1 or why_toggle.get_attribute('aria-expanded') != 'false' or page.locator('.fb__why-body').is_visible():
        problems.append(f'{tag}: «¿Por qué lo pensaste?» debe empezar cerrado y con aria-expanded=false')
    why_toggle.click()
    if why_toggle.get_attribute('aria-expanded') != 'true' or not page.locator('.fb__why-field').is_visible():
        problems.append(f'{tag}: al abrir la nota, aria-expanded no es true o el campo no se ve')
    if page.evaluate("document.querySelector('.fb__why-field').labels.length") != 1:
        problems.append(f'{tag}: el campo de la nota no tiene su etiqueta asociada')
    check_measure(page.evaluate(MEASURE), f'{tag} nota abierta', problems)
    page.fill('.fb__why-field', 'Creí que con yesterday iba el presente ' + 'y dudé mucho. ' * 6)
    page.get_by_role('button', name='Guardar nota').click()
    page.wait_for_function("document.querySelector('.fb__why-status').textContent.length > 0 && document.querySelector('.fb__why-save').getAttribute('aria-disabled') === 'false'")
    if 'Anotado' not in page.locator('.fb__why-status').inner_text():
        problems.append(f'{tag}: el aviso de la nota guardada no sale con texto')
    if page.evaluate("document.activeElement && document.activeElement.classList.contains('fb__why-save')") is not True:
        problems.append(f'{tag}: el foco no sigue en «Guardar nota»')
    note = page.evaluate("window.__events.since(0).then((l) => l.filter((e) => e.type === 'note').map((e) => [e.itemId, e.responseRaw.slice(0, 12), e.topics.join()]))")
    expected = {'corto': 'a1', 'largo': 'a2'}[case]
    if len(note) != 1 or note[0][0] != expected or note[0][2] != 'gram.past_simple':
        problems.append(f'{tag}: la nota no quedó como evento note en la base ({note})')
    check_measure(page.evaluate(MEASURE), f'{tag} nota guardada', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_4nota.png'), full_page=True)
    notes.append('nota OK')

    if errors:
        problems.append(f'{tag}: errores de consola {errors[:3]}')
    ctx.close()
    return problems, notes

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='/tmp/report-menu-shots')
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
