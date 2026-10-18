#!/usr/bin/env python3
"""Verificación OPCIONAL del service worker en Chromium real (subparte 0.6). NO forma parte de `npm run check`.

Copia el repo a una carpeta temporal bajo /sophia/ (como lo serviría GitHub Pages en una subcarpeta), lo sirve por http,
registra sw.js y comprueba: precache completo, recarga SIN conexión, ruta profunda sin conexión, que las APIs externas
no se interceptan, que una versión nueva queda EN ESPERA sin recargar la página, que SKIP_WAITING la activa y borra la
caché vieja, y que una subida a medias (sw.js nuevo con asset-manifest viejo) NO se instala.
Requiere Python 3 + Playwright con Chromium. Sale con código 1 si algo falla.   Uso:  python3 tools/pwa-check.py
Parte 1: sw.js por separado (se registra a mano). Parte 2 (mitad B): el registro REAL desde app/main.js: apagado por defecto
en 127.0.0.1, ?sw=on lo enciende, ?sw=off lo limpia, aviso "Actualizar" con versión nueva (sin recarga hasta tocar el botón).
"""
import functools
import http.server
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8765
failures = []


def check(ok, text):
    print(('✔ ' if ok else '✘ ') + text)
    if not ok:
        failures.append(text)


def wait_until(page, js, timeout=5000):
    """Espera a que una expresión async del navegador sea verdadera; devuelve su último valor."""
    end = time.time() + timeout / 1000
    value = None
    while time.time() < end:
        try:
            value = page.evaluate(js)
        except Exception:  # la página se está recargando: se reintenta
            value = None
        if value:
            return value
        page.wait_for_timeout(150)
    return value


def app_flow(p):
    """Parte 2 (mitad B): app/main.js + swRegister.js + aviso de actualización en Chromium real."""
    site = tempfile.mkdtemp(prefix='sophia-site2-')
    work = os.path.join(site, 'sophia')
    shutil.copytree(ROOT, work, ignore=shutil.ignore_patterns('node_modules', '.git'))

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    server = http.server.ThreadingHTTPServer(('127.0.0.1', PORT + 1), functools.partial(Quiet, directory=site))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{PORT + 1}/sophia/index.html'
    regs = "navigator.serviceWorker.getRegistrations().then(r=>r.length)"
    names = "caches.keys().then(k=>k.filter(n=>n.startsWith('sophia-shell-')))"
    browser = p.chromium.launch()
    ctx = browser.new_context()
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base)
    page.wait_for_selector('h1')
    page.wait_for_timeout(800)
    check(page.evaluate(regs) == 0, 'DESARROLLO (127.0.0.1): main.js NO registra el service worker')
    check(page.evaluate("document.querySelector('link[rel=manifest]').getAttribute('href')") == 'manifest.webmanifest', 'index.html enlaza el manifest')

    page.goto(base + '?sw=on')
    page.wait_for_selector('h1')
    check(bool(wait_until(page, "navigator.serviceWorker.getRegistration().then(r=>!!(r&&r.active))")), '?sw=on: main.js registra el SW y se activa')
    first = wait_until(page, "[...document.querySelectorAll('.toast')].map(t=>t.textContent).join('|')")
    check('Lista para usar sin conexión' in (first or ''), 'primera visita: aviso "Lista para usar sin conexión." y NINGÚN aviso de actualización')
    check(page.evaluate("document.querySelectorAll('.update-notice').length") == 0, 'primera visita: sin aviso de actualización')
    old = wait_until(page, f"{names}.then(k=>k.length===1&&k[0])")
    page.reload()
    page.wait_for_selector('h1')
    check(page.evaluate('!!navigator.serviceWorker.controller'), 'tras recargar, la página queda controlada')

    # Versión nueva: se cambia un archivo y se reconstruye; la app abierta debe avisar SIN recargar.
    with open(os.path.join(work, 'ui', 'dom.js'), 'a', encoding='utf-8') as f:
        f.write('\n// cambio de prueba (0.6B)\n')
    subprocess.run(['node', 'tools/build-manifest.mjs'], cwd=work, check=True, capture_output=True)
    new = json.load(open(os.path.join(work, 'asset-manifest.json'), encoding='utf-8'))['cacheVersion']
    page.evaluate("window.__marca='sin-recarga'")
    page.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update())")
    got = wait_until(page, "document.querySelector('.update-notice')?.textContent", 8000)
    check(bool(got) and 'Actualizar' in got and 'Ahora no' in got, f'versión nueva: aparece el aviso con "Actualizar" y "Ahora no" ({got!r})')
    check(page.evaluate('window.__marca') == 'sin-recarga', 'el aviso NO recargó la página')
    page.wait_for_timeout(1200)
    check(page.evaluate('window.__marca') == 'sin-recarga' and page.evaluate("document.querySelectorAll('.update-notice').length") == 1, 'sigue el aviso, sin recarga automática, tras esperar')
    page.click('.update-notice button:has-text("Ahora no")')
    check(page.evaluate("document.querySelectorAll('.update-notice').length") == 0, '"Ahora no" oculta el aviso')
    check(len(page.evaluate(names)) == 2, 'mientras tanto conviven la caché vieja y la nueva')

    page.reload()
    page.wait_for_selector('h1')
    got = wait_until(page, "document.querySelector('.update-notice')?.textContent", 8000)
    check(bool(got), 'al volver a abrir, el aviso reaparece (la versión sigue en espera)')
    page.evaluate("window.__marca='antes-de-actualizar'")
    page.click('.update-notice button:has-text("Actualizar")')
    swapped = wait_until(page, "window.__marca===undefined", 8000)
    check(bool(swapped), 'tras tocar "Actualizar" la página se recarga (una vez)')
    page.wait_for_selector('h1')
    page.wait_for_timeout(800)
    left = wait_until(page, f"{names}.then(k=>k.length===1&&k)")
    check(left == [new], f'queda solo la caché nueva {new}')
    check(page.evaluate("document.querySelectorAll('.update-notice').length") == 0, 'tras actualizar no queda aviso')
    ctx.set_offline(True)
    page.reload()
    page.wait_for_selector('h1')
    check(page.inner_text('h1') == 'Hoy', 'SIN CONEXIÓN con la versión nueva: recarga y muestra "Hoy"')
    ctx.set_offline(False)

    page.goto(base + '?sw=off')
    page.wait_for_selector('h1')
    cleaned = wait_until(page, f"Promise.all([{regs},{names}.then(k=>k.length)]).then(([a,b])=>a===0&&b===0)")
    check(bool(cleaned), '?sw=off: se deshace el registro y se borran las cachés (modo desarrollo)')
    check(not errors, f'sin errores de JavaScript en la página ({errors[:2]})')
    browser.close()
    server.shutdown()
    shutil.rmtree(site, ignore_errors=True)


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('Playwright no está instalado: no probado en este entorno.', file=sys.stderr)
        return 0
    site = tempfile.mkdtemp(prefix='sophia-site-')
    work = os.path.join(site, 'sophia')
    shutil.copytree(ROOT, work, ignore=shutil.ignore_patterns('node_modules', '.git'))

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    server = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Quiet, directory=site))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{PORT}/sophia/index.html?sw=on'  # ?sw=on: en 127.0.0.1 el modo desarrollo apaga el SW por defecto
    manifest = json.load(open(os.path.join(work, 'asset-manifest.json'), encoding='utf-8'))
    shell = "caches.keys().then(k=>k.filter(n=>n.startsWith('sophia-shell-')))"

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context()
        page = ctx.new_page()
        page.goto(url)
        page.wait_for_selector('h1')
        info = page.evaluate("""async()=>{const reg=await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;
          const names=await caches.keys();const c=await caches.open(names[0]);return {scope:reg.scope,names,entries:(await c.keys()).length}}""")
        check(info['entries'] == len(manifest['files']) and info['names'] == [manifest['cacheVersion']], f"precache completo: {info['entries']}/{len(manifest['files'])} archivos en {info['names']}")
        check(info['scope'].endswith('/sophia/'), f"el alcance sigue la subcarpeta ({info['scope']})")
        page.reload()
        page.wait_for_selector('h1')
        check(page.evaluate('!!navigator.serviceWorker.controller'), 'tras recargar, la página queda controlada por el SW')
        ctx.set_offline(True)
        page.reload()
        page.wait_for_selector('h1')
        check(page.inner_text('h1') == 'Hoy', 'SIN CONEXIÓN: la app recarga y muestra "Hoy"')
        page.goto(url + '#/mapa')
        page.wait_for_selector('h1')
        check(page.inner_text('h1') == 'Mapa', 'SIN CONEXIÓN: ruta profunda #/mapa')
        check(page.evaluate("fetch('ui/dom.js').then(r=>r.status)") == 200, 'SIN CONEXIÓN: archivos del shell salen de la caché')
        check(page.evaluate("fetch('https://api.example.com/x').then(()=>false).catch(()=>true)"), 'SIN CONEXIÓN: una API externa NO se intercepta (falla como la red)')
        ctx.set_offline(False)

        with open(os.path.join(work, 'ui', 'dom.js'), 'a', encoding='utf-8') as f:
            f.write('\n// cambio de prueba\n')
        subprocess.run(['node', 'tools/build-manifest.mjs'], cwd=work, check=True, capture_output=True)
        new = json.load(open(os.path.join(work, 'asset-manifest.json'), encoding='utf-8'))['cacheVersion']
        check(new != manifest['cacheVersion'], f'un cambio de contenido cambia la caché ({new})')
        page.evaluate("window.__marca='sin-recarga'")
        waiting = page.evaluate("navigator.serviceWorker.getRegistration().then(async r=>{await r.update();return null})")
        wait_until(page, "navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)")
        state = page.evaluate("navigator.serviceWorker.getRegistration().then(r=>({waiting:!!r.waiting,marca:window.__marca}))")
        check(state['waiting'], 'la versión nueva se instala y queda EN ESPERA')
        check(state['marca'] == 'sin-recarga', 'la página NO se recargó sola (no se corta una sesión de estudio)')
        check(len(page.evaluate(shell)) == 2, 'conviven la caché vieja y la nueva mientras se espera')
        page.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.waiting.postMessage({type:'SKIP_WAITING'}))")
        gone = wait_until(page, f"{shell}.then(k=>k.length===1&&k)")
        check(gone == [new], 'tras SKIP_WAITING queda solo la caché nueva (la vieja se borra)')
        reply = page.evaluate("new Promise(r=>{navigator.serviceWorker.addEventListener('message',e=>r(e.data),{once:true});navigator.serviceWorker.controller.postMessage({type:'GET_VERSION'})})")
        check(reply.get('cacheVersion') == new, 'GET_VERSION responde la versión nueva')

        sw_path = os.path.join(work, 'sw.js')
        text = open(sw_path, encoding='utf-8').read().replace(new, 'sophia-shell-0.5.0-deadbeef')
        open(sw_path, 'w', encoding='utf-8').write(text)
        page.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update().catch(()=>{}))")
        page.wait_for_timeout(2000)
        half = page.evaluate("navigator.serviceWorker.getRegistration().then(r=>({waiting:!!r.waiting}))")
        check(not half['waiting'] and page.evaluate(shell) == [new], 'SUBIDA A MEDIAS (sw.js nuevo, manifest viejo): no se instala y sigue la versión buena')
        browser.close()
        app_flow(p)
    server.shutdown()
    shutil.rmtree(site, ignore_errors=True)
    print('\n' + ('TODO BIEN' if not failures else f'FALLOS: {len(failures)}'))
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
