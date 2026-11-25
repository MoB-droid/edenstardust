#!/usr/bin/env python3
"""Builds the website from its sources.

  src/index.html   (login + dashboard, the "Stardust" artifact)      -> index.html
  editor/          (the Seat Plan editor, the master copy, in parts)  -> plan.html
                                                                      -> dist/seatplan.html (artifact preview)

The editor parts are joined in this order: head.html, style.css, body.html, then every js/*.js sorted by name
(one script: the parts named NN-main-* are pieces of the one MAIN function, so they are not complete on their own).
A few exact text swaps then let the editor run outside claude.ai: its saving goes through js/eden-shim.js (Supabase)
and messages that mention Claude are reworded.
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
    '<link rel="icon" type="image/png" href="/favicon.png">\n<link rel="apple-touch-icon" href="/logo.png">\n'
)


def swap(text, old, new, count=1):
    found = text.count(old)
    if found != count:
        sys.exit(f'build: expected {count}x {old[:60]!r}, found {found}')
    return text.replace(old, new)


def build_index():
    src = (ROOT / 'src/index.html').read_text(encoding='utf-8')
    (ROOT / 'index.html').write_text(HEAD + src + '\n</html>\n', encoding='utf-8')


def editor_source():
    """The whole editor as one page (the text the Seat Plan artifact shows)."""
    ed = ROOT / 'editor'
    read = lambda f: (ed / f).read_text(encoding='utf-8')
    script = ''.join(f.read_text(encoding='utf-8') for f in sorted((ed / 'js').glob('*.js')))
    return (read('head.html') + '<style>\n' + read('style.css') + '</style>\n' + read('body.html')
            + '<script>\n' + script + '</script>\n')


def build_plan():
    s = editor_source()
    (ROOT / 'dist').mkdir(exist_ok=True)
    (ROOT / 'dist/seatplan.html').write_text(s, encoding='utf-8')
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
    s = swap(s, "progNote('Reading ' + fname + ' with Claude…');", "progNote('Reading ' + fname + '…');")
    (ROOT / 'plan.html').write_text(s, encoding='utf-8')


# what each editor part holds, for editor/MAP.md (a part with no entry here is described by its first comment line)
PART_NOTES = {
    'head.html': 'page title, fonts',
    'style.css': 'all the editor styling',
    'body.html': 'the page markup: plan frame, PROGRAM and ANALYSIS tables, buttons, dialogs',
    '01-layout-data.js': 'EMBED (the empty start layout), team colours, marker scale, chairs, renderLayout (draws the plan)',
    '10-main-view.js': 'MAIN starts here: zoom, fit, pan, row and desk highlight',
    '11-main-edit-save.js': 'drag a person, desk click, undo history, painting names and totals, save to the database, shading',
    '12-main-teams-markers.js': 'teams: moving, added teams, seat types (single, OSH), flag answers, team markers and where they may stand',
    '13-main-parked-relayout.js': 'parked markers of unseated teams, relayout (redraws everything after a change), seat summary per type',
    '14-main-analysis.js': 'ANALYSIS table (C3 element inventory), marker dragging, writing seats, moves and types to the database',
    '15-main-suggest.js': 'Suggest: seats every team following the rules',
    '16-main-export.js': 'Download layout (PNG picture with header) and Download program (Excel / CSV)',
    '17-main-title-upload.js': 'layout title, Upload layout, Delete program, CSV and Excel file loading',
    '18-main-program-read.js': 'reading a program table (columns, types), Upload program, HR seating files (rules D4), messy-table message',
    '19-main-sheet.js': 'Google Sheet as the program (Link sheet, Update), sheet tabs = milestones',
    '20-main-downloads-drop.js': 'download destinations (device / Google Drive), drag and drop of files, MAIN ends, START()',
}


def write_map():
    """editor/MAP.md: the index of the editor parts, rebuilt on every build so it never goes stale."""
    ed = ROOT / 'editor'
    rows, line = [], 1
    files = [ed / 'head.html', ed / 'style.css', ed / 'body.html'] + sorted((ed / 'js').glob('*.js'))
    for n, f in enumerate(files, 1):
        text = f.read_text(encoding='utf-8')
        note = PART_NOTES.get(f.name)
        if not note:
            m = re.search(r'^\s*// ---- (.+)$', text, flags=re.M)
            note = re.split(r'(?<=[a-z\)])[.:] ', m.group(1))[0].rstrip('.:') if m else ''
        fns = re.findall(r'^(?:  )?(?:async )?function ([A-Za-z_$][\w$]*)', text, flags=re.M)
        rows.append(f'| {n} | `{f.relative_to(ed).as_posix()}` | {len(text.splitlines())} | {note} | {", ".join(fns)} |')
    out = (
        '# Editor map\n\n'
        'Built by `build.py` on every build: do not edit by hand. Read this first, then open only the part you need.\n\n'
        '- The parts are joined in this order into one page (`plan.html` on the site, the Seat Plan artifact as preview).\n'
        '- Parts 01 to 09 are complete on their own (plan reading: desks, chairs, OSH, elements). The tests load them.\n'
        '- Parts 10 to 20 (`*-main-*`) are pieces of the one `MAIN` function (the page\'s behaviour): they share its variables.\n\n'
        '| # | Part | Lines | Holds | Functions |\n|---|------|-------|-------|-----------|\n' + '\n'.join(rows) + '\n'
    )
    (ed / 'MAP.md').write_text(out, encoding='utf-8')


if __name__ == '__main__':
    build_index()
    build_plan()
    write_map()
    (ROOT / 'CNAME').write_text('edenstardust.com\n')
    (ROOT / '.nojekyll').touch()
    print('built index.html and plan.html')
