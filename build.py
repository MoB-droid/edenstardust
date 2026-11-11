#!/usr/bin/env python3
"""Builds the website from the artifact sources.

  src/index.html     (login + dashboard, the "Stardust" artifact)  -> index.html
  src/seatplan.html  (the master "Seat Plan" artifact)              -> plan.html

The Seat Plan app is copied as-is. A few exact text swaps let it run outside claude.ai:
its saving goes through js/eden-shim.js (Supabase) and messages that mention Claude are reworded.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.min.js'

HEAD = (
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
    'body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
)


def swap(text, old, new, count=1):
    found = text.count(old)
    if found != count:
        sys.exit(f'build: expected {count}x {old[:60]!r}, found {found}')
    return text.replace(old, new)


def build_index():
    src = (ROOT / 'src/index.html').read_text(encoding='utf-8')
    (ROOT / 'index.html').write_text(HEAD + src + '\n</html>\n', encoding='utf-8')


def build_plan():
    s = (ROOT / 'src/seatplan.html').read_text(encoding='utf-8')
    # the artifact source is page content only (claude.ai adds the HTML wrapper): add it here too
    if not s.lstrip().lower().startswith('<!doctype'):
        s = HEAD + '</head>\n<body>\n' + s + '\n</body>\n</html>\n'
    # load Supabase and the shim before the app's own script
    s = swap(s, '<title>Seat Plan</title>',
             '<title>Seat Plan · EdenStardust</title>\n'
             f'<script src="{SUPABASE_JS}"></script>\n<script src="/js/eden-shim.js"></script>')
    # each plan keeps its own unsaved edits and undo history in the browser
    s = swap(s, 'LS = "edits:Seat Plan"', 'LS = (window.__edenLS || "edits:Seat Plan")')
    s = re.sub(r'(var EMBED = \{.*?\};\n)', r'\1if (window.__edenLS) EMBED.lskey = window.__edenLS;\n', s, count=1, flags=re.S)
    if 'EMBED.lskey = window.__edenLS' not in s:
        sys.exit('build: EMBED line not found')
    # uploaded plan pictures are private files: show them through signed links
    s = swap(s, 'href="\' + xesc(L.img) + \'"', 'href="\' + xesc(window.__blobUrl ? window.__blobUrl(L.img) : L.img) + \'"')
    s = swap(s, 'fetch(L.img)', 'fetch(window.__blobUrl ? window.__blobUrl(L.img) : L.img)')
    # loading from the internet can take longer than inside claude.ai
    s = swap(s, 'setTimeout(function () { fin(null); }, 4000);', 'setTimeout(function () { fin(null); }, 15000);')
    # wording: there is no Claude step on the website
    s = swap(s, 'Ask Claude to “process the new layout”.', 'Try a vector PDF of the floor plan.', 3)
    s = swap(s, 'upload the plan as a PDF, or ask Claude to “process the new layout”.', 'upload the plan as a PDF.')
    s = swap(s, 'add teams from an Excel or CSV file (Claude reads it)', 'add teams from an Excel or CSV file')
    s = swap(s, "progNote('Reading ' + file.name + ' with Claude…');", "progNote('Reading ' + file.name + '…');")
    (ROOT / 'plan.html').write_text(s, encoding='utf-8')


if __name__ == '__main__':
    build_index()
    build_plan()
    (ROOT / 'CNAME').write_text('edenstardust.com\n')
    (ROOT / '.nojekyll').touch()
    print('built index.html and plan.html')
