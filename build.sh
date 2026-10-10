#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
UUID=$(python3 -c "import json,sys;print(json.load(open('metadata.json'))['uuid'])")
glib-compile-schemas schemas/ 2>/dev/null || true
rm -f "$UUID.shell-extension.zip"
zip -r "$UUID.shell-extension.zip" \
    metadata.json \
    extension.js \
    prefs.js \
    modules/ \
    schemas/ \
    icons/ \
    >/dev/null
echo "Built $UUID.shell-extension.zip"