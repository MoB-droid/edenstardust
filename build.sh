#!/usr/bin/env bash
# Builds the website from its sources (see build.py), then checks the result:
# the editor's script must parse, and every tiny rule test (tests/) must pass.
set -euo pipefail
cd "$(dirname "$0")"
python3 build.py
if command -v node >/dev/null; then
  cat editor/js/*.js > dist/editor.js
  node --check dist/editor.js
  node tests/run.js
else
  echo "node not found: script check and rule tests skipped"
fi
