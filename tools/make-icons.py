#!/usr/bin/env python3
"""Genera los iconos de la PWA (subparte 0.6) a partir de la mascota "Chispa". OPCIONAL: los iconos ya están en icons/.

Escribe icons/icon.svg, icons/icon-maskable.svg y los PNG icon-192.png, icon-512.png e icon-maskable-512.png.
Requiere Python 3 + Playwright con Chromium (igual que tools/visual-check.py). Uso:  python3 tools/make-icons.py
Los colores son los del tema Aurora (ui/styles/themes.css); un SVG de icono no puede leer variables CSS del tema.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'icons')

BG, BG_GLOW, BODY, ACCENT2, ACCENT2_TEXT, INK = '#070a1d', '#232a6b', '#ffc107', '#8b5cf6', '#a78bfa', '#1b1400'


def mascot():
    # Geometría de createMascot() (viewBox 0 0 64 64), cara "happy".
    return f'''
  <line x1="32" y1="14" x2="32" y2="6" stroke="{ACCENT2_TEXT}" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="32" cy="5" r="3.4" fill="{ACCENT2}"/>
  <ellipse cx="22" cy="58" rx="7" ry="3.2" fill="{ACCENT2}"/>
  <ellipse cx="42" cy="58" rx="7" ry="3.2" fill="{ACCENT2}"/>
  <ellipse cx="32" cy="36" rx="25" ry="22" fill="{BODY}"/>
  <path d="M20 35 Q24 28 28 35" fill="none" stroke="{INK}" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M36 35 Q40 28 44 35" fill="none" stroke="{INK}" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M24 42 Q32 55 40 42 Z" fill="{INK}"/>'''


def svg(maskable):
    # any: esquinas redondeadas y mascota grande. maskable: fondo a sangre y mascota dentro de la zona segura (círculo central).
    scale = 4.5 if maskable else 5.6
    shift = 256 - 32 * scale
    shape = '<rect width="512" height="512" fill="url(#g)"/>' if maskable else '<rect width="512" height="512" rx="112" fill="url(#g)"/>'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs><radialGradient id="g" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="{BG_GLOW}"/><stop offset="1" stop-color="{BG}"/></radialGradient></defs>
  {shape}
  <g transform="translate({shift:.1f} {shift + 4:.1f}) scale({scale})">{mascot()}
  </g>
</svg>
'''


def main():
    os.makedirs(OUT, exist_ok=True)
    files = {'icon.svg': svg(False), 'icon-maskable.svg': svg(True)}
    for name, text in files.items():
        with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
            f.write(text)
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('Playwright no está instalado: se escribieron los SVG, faltan los PNG.', file=sys.stderr)
        return 1
    jobs = [('icon.svg', 'icon-192.png', 192), ('icon.svg', 'icon-512.png', 512), ('icon-maskable.svg', 'icon-maskable-512.png', 512)]
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for src, dst, size in jobs:
            page = browser.new_page(viewport={'width': size, 'height': size})
            html = f'<body style="margin:0;background:transparent"><div style="width:{size}px;height:{size}px">{files[src].replace("width=\"512\" height=\"512\"", f"width=\"{size}\" height=\"{size}\"")}</div></body>'
            page.set_content(html)
            page.screenshot(path=os.path.join(OUT, dst), omit_background=True, clip={'x': 0, 'y': 0, 'width': size, 'height': size})
            page.close()
        browser.close()
    print('Iconos escritos en', OUT)
    return 0


if __name__ == '__main__':
    sys.exit(main())
