#!/usr/bin/env bash
# Builds the live page (index.html) from the artifact source (src/index.html).
set -euo pipefail
cd "$(dirname "$0")"
{
  printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  printf '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%%}[hidden]{display:none!important}</style>\n'
  cat src/index.html
  printf '\n</html>\n'
} > index.html
echo "edenstardust.com" > CNAME
touch .nojekyll
