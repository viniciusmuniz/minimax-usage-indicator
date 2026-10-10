#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
UUID=$(python3 -c "import json,sys;print(json.load(open('metadata.json'))['uuid'])")
DOMAIN=$(python3 -c "import json,sys;print(json.load(open('metadata.json'))['gettext-domain'])")

# Compile schemas locally so we can reference them during development,
# but don't ship the compiled artifact in the zip. GNOME 45+ packages
# must ship only the .gschema.xml source — glib-compile-schemas runs
# at install time on the user's system. (EGO-P-006)
glib-compile-schemas schemas/ 2>/dev/null || true

# Compile every .po in po/ into locale/<lang>/LC_MESSAGES/<domain>.mo.
# msgfmt is part of the gettext package. Missing msgfmt is non-fatal —
# the build still produces a working extension (just untranslated) and
# the user can install gettext and re-run.
if command -v msgfmt >/dev/null 2>&1; then
    rm -rf locale/
    for po in po/*.po; do
        lang=$(basename "$po" .po)
        mkdir -p "locale/$lang/LC_MESSAGES"
        msgfmt -o "locale/$lang/LC_MESSAGES/$DOMAIN.mo" "$po"
    done
    echo "Compiled $(ls po/*.po | wc -l) .po files into locale/"
else
    echo "warning: msgfmt not found — skipping translations (install gettext to enable)"
    rm -rf locale/
fi

rm -f "$UUID.shell-extension.zip"
zip -r "$UUID.shell-extension.zip" \
    metadata.json \
    extension.js \
    prefs.js \
    modules/ \
    schemas/ \
    icons/ \
    locale/ \
    -x 'schemas/gschemas.compiled' \
    >/dev/null
echo "Built $UUID.shell-extension.zip"