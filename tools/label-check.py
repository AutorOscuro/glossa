#!/usr/bin/env python3
"""Verificación OPCIONAL (hito M0, BUG 1) en Chromium real: ninguna etiqueta de botón segmentado ni de la barra inferior se parte
por la mitad ni se corta, con los 4 tamaños de texto y anchos de 360 y 412 px. NO forma parte de `npm run check`. Uso: python3 tools/label-check.py"""
import functools, http.server, os, shutil, sys, tempfile, threading
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8775
failures = []

JS = """() => {
  const out = [];
  for (const el of document.querySelectorAll('.segmented__item')) {
    const words = el.textContent.trim().split(/\\s+/).length;
    const r = document.createRange(); r.selectNodeContents(el);
    const lines = new Set([...r.getClientRects()].map(x => Math.round(x.top))).size;
    out.push({what: 'segmentado «' + el.textContent.trim() + '»', bad: el.scrollWidth > el.clientWidth + 1 || lines > words});
  }
  for (const el of document.querySelectorAll('.bottom-nav__label')) {
    out.push({what: 'barra «' + el.textContent.trim() + '»', bad: el.scrollWidth > el.clientWidth + 1});
  }
  return out;
}"""

def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('Playwright no está instalado: no probado en este entorno.', file=sys.stderr); return 0
    site = tempfile.mkdtemp(prefix='sophia-label-')
    shutil.copytree(ROOT, os.path.join(site, 'sophia'), ignore=shutil.ignore_patterns('node_modules', '.git'))
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    server = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Quiet, directory=site))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width in (360, 412):
            for size in ('small', 'normal', 'large', 'xlarge'):
                ctx = browser.new_context(viewport={'width': width, 'height': 860}, has_touch=True, is_mobile=True)
                page = ctx.new_page()
                page.goto(f'http://127.0.0.1:{PORT}/sophia/index.html#/ajustes')
                page.wait_for_timeout(1500)
                page.evaluate("s => document.documentElement.setAttribute('data-text-size', s)", size)
                page.wait_for_timeout(200)
                res = page.evaluate(JS)
                if not any(r['what'].startswith('segmentado') for r in res):
                    failures.append(f'{width}px/{size}: no se encontró ningún botón segmentado (¿la vista no cargó?)')
                for r in res:
                    ok = not r['bad']
                    print(('✔ ' if ok else '✘ ') + f"{width}px · {size} · {r['what']}")
                    if not ok: failures.append(f"{width}px · {size} · {r['what']}")
                ctx.close()
        browser.close()
    server.shutdown()
    print('TODO BIEN' if not failures else f'{len(failures)} fallo(s)')
    return 1 if failures else 0

if __name__ == '__main__':
    sys.exit(main())
