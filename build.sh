#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
UUID=$(python3 -c "import json,sys;print(json.load(open('metadata.json'))['uuid'])")
# Compile schemas locally so we can reference them during development,
# but don't ship the compiled artifact in the zip. GNOME 45+ packages
# must ship only the .gschema.xml source — glib-compile-schemas runs
# at install time on the user's system. (EGO-P-006)
glib-compile-schemas schemas/ 2>/dev/null || true
rm -f "$UUID.shell-extension.zip"
zip -r "$UUID.shell-extension.zip" \
    metadata.json \
    extension.js \
    prefs.js \
    modules/ \
    schemas/ \
    icons/ \
    -x 'schemas/gschemas.compiled' \
    >/dev/null
echo "Built $UUID.shell-extension.zip"