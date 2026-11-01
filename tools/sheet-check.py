#!/usr/bin/env python3
"""Verificación OPCIONAL de la hoja inferior en Chromium real con TOQUES de verdad (hito M0, BUG 3). NO forma parte de `npm run check`.

Sirve el repo, abre la galería (ui/styles/demo.html) emulando un teléfono táctil y arrastra el asa con eventos de toque del protocolo
del navegador. Prueba las DOS hojas de la galería (la fija de la 0.3 y la "Hoja con arrastre" de la biblioteca): un arrastre largo
cierra, uno corto vuelve a su sitio, un gesto rápido cierra, un toque descentrado dentro de la zona de 44 px también agarra, y la
zona de agarre mide al menos 44 px de alto. Requiere Python 3 + Playwright con Chromium. Uso:  python3 tools/sheet-check.py
"""
import functools, http.server, os, shutil, sys, tempfile, threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8774
failures = []


def check(ok, text):
    print(('✔ ' if ok else '✘ ') + text)
    if not ok:
        failures.append(text)


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('Playwright no está instalado: no probado en este entorno.', file=sys.stderr)
        return 0
    site = tempfile.mkdtemp(prefix='sophia-sheet-')
    shutil.copytree(ROOT, os.path.join(site, 'sophia'), ignore=shutil.ignore_patterns('node_modules', '.git'))

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    server = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Quiet, directory=site))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for index, name in ((0, 'hoja fija de la 0.3 ("Nivel de la tarjeta")'), (1, 'hoja real ("Hoja con arrastre")')):
            ctx = browser.new_context(viewport={'width': 412, 'height': 860}, has_touch=True, is_mobile=True, device_scale_factor=2.6)
            page = ctx.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(f'http://127.0.0.1:{PORT}/sophia/ui/styles/demo.html')
            page.wait_for_selector('button:has-text("Abrir hoja") >> nth=1')
            cdp = ctx.new_cdp_session(page)

            def opened():
                return page.evaluate("document.querySelectorAll('.sheet.is-open').length") == 1

            def open_sheet():
                page.locator('button:has-text("Abrir hoja")').nth(index).tap()
                page.wait_for_timeout(700)

            def grab_box():
                return page.evaluate("(()=>{const r=document.querySelector('.sheet.is-open .sheet__grab').getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()")

            def drag(dx_from_center, dy, steps, delay):
                x, y, w, h = grab_box()
                px, py = x + w / 2 + dx_from_center[0], y + h / 2 + dx_from_center[1]
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': px, 'y': py}]})
                for i in range(1, steps + 1):
                    cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': px, 'y': py + dy * i / steps}]})
                    page.wait_for_timeout(delay)
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
                page.wait_for_timeout(700)

            open_sheet()
            check(opened(), f'{name}: abre')
            check(grab_box()[3] >= 44, f'{name}: la zona de agarre mide {grab_box()[3]:.0f} px de alto (mínimo 44)')
            drag((0, 0), 30, 6, 30)
            check(opened(), f'{name}: un arrastre corto y lento (30 px) NO cierra y la hoja vuelve a su sitio')
            drag((0, 0), 220, 12, 20)
            check(not opened(), f'{name}: arrastrar el asa 220 px hacia abajo la CIERRA')
            open_sheet()
            drag((0, 0), 60, 3, 8)
            check(not opened(), f'{name}: un gesto rápido de 60 px la cierra')
            open_sheet()
            drag((0, 17), 200, 12, 20)  # dedo cerca del borde de abajo de la zona de agarre, lejos de la barrita
            check(not opened(), f'{name}: agarrando por la zona de agarre, no solo por la barrita, también cierra')
            check(not errors, f'{name}: sin errores de JavaScript ({errors})')
            ctx.close()
        browser.close()
    server.shutdown()
    shutil.rmtree(site, ignore_errors=True)
    print('\n' + ('TODO BIEN' if not failures else f'FALLOS: {len(failures)}'))
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
