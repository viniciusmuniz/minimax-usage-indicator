#!/usr/bin/env bash
# Regenerate po/minimax-usage-indicator.pot from the source files listed
# in po/POTFILES.in. Run this whenever you add, remove, or reword a
# translatable string in a .js file. Commit the regenerated .pot and
# notify translators so they can refresh their .po files.
#
# Requires GNU gettext (provides the `xgettext` command).
# On Debian/Ubuntu: sudo apt install gettext

set -euo pipefail
cd "$(dirname "$0")/.."

# xgettext's JavaScript scanner doesn't grok ESM `import` statements
# at the top of files in older releases. We work around this by
# stripping those lines into a separate pre-processor pass. The scanner
# only cares about _("...") / _n(...) / _f(...) calls anyway.
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Copy each source file to the scratch dir, replacing import-from
# statements with comment lines so xgettext doesn't choke on them.
mkdir -p "$TMPDIR/modules"
for f in $(cat po/POTFILES.in); do
    dest="$TMPDIR/$f"
    mkdir -p "$(dirname "$dest")"
    # Drop ESM import lines (they confuse xgettext's JS parser). We do
    # this conservatively — only the `import ... from '...';` form.
    sed -E "/^import .* from '.*';\$/d" "$f" > "$dest"
done

xgettext \
    --language=JavaScript \
    --from-code=UTF-8 \
    --keyword=_ \
    --keyword=_n:1,2 \
    --keyword=_f \
    --package-name=minimax-usage-indicator \
    --copyright-holder="MiniMax Usage Indicator contributors" \
    --msgid-bugs-address="https://github.com/viniciusmuniz/minimax-usage-indicator/issues" \
    --files-from=po/POTFILES.in \
    --directory="$TMPDIR" \
    --output=po/minimax-usage-indicator.pot

echo "Regenerated po/minimax-usage-indicator.pot"
echo "Next: review the diff, commit, and (if you maintain a .po) run msgmerge."