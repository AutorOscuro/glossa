#!/usr/bin/env python3
"""Verificación visual opcional (subparte 0.3). NO forma parte de `npm run check`.

Abre una página del repo en Chromium sin interfaz, con la CSP del roadmap (8.16) puesta, a 360x640 y 412x915,
en los 3 temas, y comprueba: sin desbordes horizontales, ningún objetivo táctil < 44 px, sin errores de consola.
Guarda capturas de página completa. Sale con código 1 si algo falla.

Requiere Python 3 + Playwright con Chromium (en los chats constructores suele estar instalado; si no, se omite
y se declara en el reporte como "no probado en este entorno").

Uso:
  python3 tools/visual-check.py                          # galería: /ui/styles/demo.html
  python3 tools/visual-check.py /index.html --out shots  # otra página (usa ?tema=<nombre> si la página lo admite)
"""
import argparse
import functools
import http.server
import json
import os
import socketserver
import sys
import threading

CSP = "default-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'"
SIZES = [(360, 640), (412, 915)]
THEMES = ['aurora', 'neo', 'claro']

MEASURE = """() => {
  const vw = document.documentElement.clientWidth;
  const out = {vw, scrollW: document.documentElement.scrollWidth, small: [], over: []};
  for (const el of document.querySelectorAll('button, input, a, .chip, .btn')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue;
    const inlineLink = el.tagName === 'A' && el.closest('p');
    if (!inlineLink && (r.height < 43.5 || r.width < 43.5)) {
      out.small.push([el.tagName, (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20), Math.round(r.width), Math.round(r.height)]);
    }
  }
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width && r.right > vw + 0.5) out.over.push([el.tagName, String(el.className), Math.round(r.right)]);
  }
  return out;
}"""


def serve(root):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=root, **k)

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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('page', nargs='?', default='/ui/styles/demo.html')
    ap.add_argument('--out', default='visual-shots')
    args = ap.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.stderr.write('Playwright no está instalado: verificación visual omitida.\n')
        return 2

    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    os.makedirs(args.out, exist_ok=True)
    srv = serve(root)
    base = f'http://127.0.0.1:{srv.server_address[1]}{args.page}'
    failed = 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for (w, h) in SIZES:
            for theme in THEMES:
                ctx = browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True)
                page = ctx.new_page()
                errors = []
                page.on('console', lambda m, e=errors: e.append(m.text) if m.type in ('error', 'warning') else None)
                page.on('pageerror', lambda x, e=errors: e.append(f'pageerror: {x}'))
                page.goto(f'{base}?tema={theme}')
                page.wait_for_load_state('networkidle')
                m = page.evaluate(MEASURE)
                page.screenshot(path=os.path.join(args.out, f'{w}_{theme}.png'), full_page=True)
                problems = []
                if m['scrollW'] > m['vw']:
                    problems.append(f"desborde horizontal ({m['scrollW']} > {m['vw']})")
                if m['over']:
                    problems.append(f"elementos fuera de pantalla: {m['over'][:3]}")
                if m['small']:
                    problems.append(f"objetivos táctiles < 44 px: {m['small'][:3]}")
                if errors:
                    problems.append(f'errores de consola: {errors[:3]}')
                status = '✘' if problems else '✔'
                failed += 1 if problems else 0
                sys.stdout.write(f'{status} {w}x{h} {theme}' + (f" — {'; '.join(problems)}" if problems else '') + '\n')
                ctx.close()
        browser.close()
    srv.shutdown()
    sys.stdout.write(json.dumps({'fallos': failed}, ensure_ascii=False) + '\n')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
