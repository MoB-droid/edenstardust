#!/usr/bin/env bash
# Builds the website from its sources (see build.py), then checks that the editor's script parses.
# The rules (reading a plan, seating, reading programs) are not here: they run on the server, from the private repo.
set -euo pipefail
cd "$(dirname "$0")"
python3 build.py
if command -v node >/dev/null; then
  cat editor/js/*.js > dist/editor.js
  node --check dist/editor.js && echo "editor script: ok"
else
  echo "node not found: script check skipped"
fi
