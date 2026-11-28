# Usage: python3 scripts/logo.py <out-dir>  (writes docs/icon*.svg, public/favicon.svg, and maskable.svg into out-dir)
# Generates the "t" logo SVGs. Glyph drawn on a 100-unit tile.
TOP = 'M29 16H48V35H66V53H29Z'
FOLD = 'M29 35H48L62 53H48Z'
BOT = 'M29 54H48V64A8 8 0 0 0 60.6 70.6L71.5 86A27 27 0 0 1 29 64Z'
DARK = dict(bg='#0B112A', top=('#14B8A6', '#10B981'), bot=('#A3E635', '#84CC16'))
LIGHT = dict(bg='#F8FAFC', top=('#84CC16', '#A3E635'), bot=('#0D9488', '#14B8A6'))

def defs(p, c):
    return (f'<linearGradient id="{p}t" x1="29" y1="16" x2="66" y2="53" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="{c["top"][0]}"/><stop offset="1" stop-color="{c["top"][1]}"/></linearGradient>'
            f'<linearGradient id="{p}b" x1="29" y1="54" x2="71" y2="90" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="{c["bot"][0]}"/><stop offset="1" stop-color="{c["bot"][1]}"/></linearGradient>'
            f'<linearGradient id="{p}s" x1="0" y1="54" x2="0" y2="62" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>')

def glyph(p):
    return (f'<path d="{TOP}" fill="url(#{p}t)"/><path d="{FOLD}" fill="#000" fill-opacity=".16"/>'
            f'<path d="{BOT}" fill="url(#{p}b)"/><path d="M29 54H48V62H29Z" fill="url(#{p}s)"/>')

def icon(c, scale=1.0, rx=0, outline=None, size=512):
    k = size / 100
    tr = f'translate(50 50) scale({scale}) translate(-50 -53.5)'
    o = f'<rect x="1.5" y="1.5" width="97" height="97" rx="{rx-1.5}" fill="none" stroke="{outline}" stroke-width="1.6" stroke-opacity=".7"/>' if outline else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="{size}" height="{size}"><defs>{defs("g", c)}</defs>'
            f'<rect width="100" height="100" rx="{rx}" fill="{c["bg"]}"/>{o}<g transform="{tr}">{glyph("g")}</g></svg>')

def favicon():
    # Follows the browser's colour scheme.
    css = ('<style>.l{display:inline}.d{display:none}@media (prefers-color-scheme: dark){.l{display:none}.d{display:inline}}</style>')
    def tile(c, cls, p, outline=None):
        o = f'<rect x="2" y="2" width="96" height="96" rx="20" fill="none" stroke="{outline}" stroke-width="2.5"/>' if outline else ''
        return f'<g class="{cls}"><rect width="100" height="100" rx="22" fill="{c["bg"]}"/>{o}<g transform="translate(50 50) scale(1.12) translate(-50 -53.5)">{glyph(p)}</g></g>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{css}<defs>{defs("l", LIGHT)}{defs("d", DARK)}</defs>'
            f'{tile(LIGHT, "l", "l", "#E2E8F0")}{tile(DARK, "d", "d", "#14B8A6")}</svg>')

import sys
out = sys.argv[1]
open('docs/icon.svg', 'w').write(icon(DARK, 0.92))
open('docs/icon-light.svg', 'w').write(icon(LIGHT, 0.92))
open(f'{out}/maskable.svg', 'w').write(icon(DARK, 0.78))
open('public/favicon.svg', 'w').write(favicon())
open(f'{out}/mock-light.svg', 'w').write(icon(LIGHT, 1, 22, '#E2E8F0'))
open(f'{out}/mock-dark.svg', 'w').write(icon(DARK, 1, 22, '#14B8A6'))
