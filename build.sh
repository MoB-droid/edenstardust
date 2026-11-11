#!/usr/bin/env bash
# Builds the website from the artifact sources (see build.py).
set -euo pipefail
cd "$(dirname "$0")"
python3 build.py
