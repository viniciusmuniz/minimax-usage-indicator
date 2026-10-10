// GSettings wrapper. Loads the schema from the extension's own
// schemas/ directory.
//
// We hardcode the schema id (it must match metadata.json's
// settings-schema field) rather than reading metadata.json at
// runtime. This avoids the synchronous-file-IO linter warning
// (EGO-X-004) that the GNOME extensions review tool flags.

import Gio from 'gi://Gio';

const THIS_FILE = Gio.File.new_for_uri(import.meta.url);
const EXTENSION_DIR = THIS_FILE.get_parent().get_parent().get_path();
const SCHEMA_DIR = `${EXTENSION_DIR}/schemas`;

// MUST match metadata.json → settings-schema
const SCHEMA_NAME = 'org.gnome.shell.extensions.minimax-usage';

let _settings = null;

export function getSettings() {
    if (!_settings) {
        const defaultSource = Gio.SettingsSchemaSource.get_default();
        const extSource = Gio.SettingsSchemaSource.new_from_directory(
            SCHEMA_DIR, defaultSource, false,
        );
        const schemaObj = extSource.lookup(SCHEMA_NAME, true);
        if (!schemaObj) {
            throw new Error(`Schema ${SCHEMA_NAME} not found in ${SCHEMA_DIR}`);
        }
        _settings = new Gio.Settings({ settings_schema: schemaObj });
    }
    return _settings;
}