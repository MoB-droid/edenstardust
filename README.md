# edenstardust

Website for [edenstardust.com](https://edenstardust.com), hosted on GitHub Pages from `main` (root folder).

| # | Folder / file | What it is |
|---|---------------|------------|
| 1 | `editor/` | the Seat Plan editor, the master copy, in parts (see `editor/MAP.md`) |
| 2 | `src/index.html` | login + dashboard source |
| 3 | `js/eden-shim.js` | connects the editor to the site's database |
| 4 | `tests/` | one tiny drawn test per rule (`node tests/run.js`) |
| 5 | `build.sh` | builds `index.html` and `plan.html`, checks the script, runs the tests |
| 6 | `index.html`, `plan.html` | built pages: never edit by hand |
