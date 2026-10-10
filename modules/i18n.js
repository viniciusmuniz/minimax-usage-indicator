// gettext i18n wrapper. Translates strings via GNU gettext, looks up .mo
// files in the extension's own locale/ directory.
//
// Usage:
//   import { _, _f, initI18n } from './i18n.js';
//   initI18n();                       // call once at module load
//   label.set_text(_('Save'));        // simple translation
//   label.set_text(_f('{pct}% used', { pct: 42 }));   // with substitution
//
// Adding a new language: drop a .po file in po/ and run build.sh. No
// JS changes needed.

import Gettext from 'gi://Gettext';
import Gio from 'gi://Gio';

// import.meta.url points to this file (modules/i18n.js), so two parents
// up is the extension root. The .mo files live in <root>/locale/<lang>/...
const THIS_FILE = Gio.File.new_for_uri(import.meta.url);
const EXTENSION_DIR = THIS_FILE.get_parent().get_parent().get_path();
const LOCALE_DIR = `${EXTENSION_DIR}/locale`;

// Must match metadata.json → gettext-domain AND the .po / .mo filenames
const DOMAIN = 'minimax-usage-indicator';

let _initialized = false;

/** Bind the gettext domain to our local locale/ directory. Idempotent. */
export function initI18n() {
    if (_initialized) return;
    Gettext.bindtextdomain(DOMAIN, LOCALE_DIR);
    Gettext.bind_textdomain_codeset(DOMAIN, 'UTF-8');
    Gettext.textdomain(DOMAIN);
    _initialized = true;
}

/** Translate a simple message. */
export function _(msgid) {
    return Gettext.gettext(msgid);
}

/** Look up the translated template without substituting variables.
 *  Used by helpers that need to do their own placeholder substitution
 *  (e.g. modules/label.js, which substitutes in JS so .po files keep
 *  plain `{name}` placeholders). */
export function gettext(msgid) {
    return Gettext.gettext(msgid);
}

/** Pick the right plural form for `n` copies. */
export function _n(singular, plural, n) {
    return Gettext.ngettext(singular, plural, n);
}

/** Translate a message with named placeholders, e.g. {pct}, {name}.
 *  The .po file keeps the placeholder tokens intact; we substitute
 *  them in JS so translators don't have to worry about printf codes. */
export function _f(msgid, vars) {
    let result = Gettext.gettext(msgid);
    for (const [key, val] of Object.entries(vars)) {
        result = result.replace(`{${key}}`, String(val));
    }
    return result;
}