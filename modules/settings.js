// Manual GSettings wrapper. Loads the schema from the extension's own
// schemas/ directory using the file's own location rather than the
// version-fragile GNOME Shell resource import path that some releases
// lack. This keeps the module self-contained across shell versions.

import Gio from 'gi://Gio';

const THIS_FILE = Gio.File.new_for_uri(import.meta.url);
const EXTENSION_DIR = THIS_FILE.get_parent().get_parent().get_path();
const SCHEMA_DIR = `${EXTENSION_DIR}/schemas`;

let _settings = null;

function loadSettingsSchema() {
    const [success, contents] = Gio.File.new_for_path(`${EXTENSION_DIR}/metadata.json`)
        .load_contents(null);
    if (!success) {
        throw new Error(`Failed to read metadata.json in ${EXTENSION_DIR}`);
    }
    const metadata = JSON.parse(new TextDecoder().decode(contents));
    const schemaName = metadata['settings-schema'];
    if (!schemaName) {
        throw new Error('metadata.json has no settings-schema field');
    }
    const defaultSource = Gio.SettingsSchemaSource.get_default();
    const extSource = Gio.SettingsSchemaSource.new_from_directory(
        SCHEMA_DIR, defaultSource, false,
    );
    const schemaObj = extSource.lookup(schemaName, true);
    if (!schemaObj) {
        throw new Error(`Schema ${schemaName} not found in ${SCHEMA_DIR}`);
    }
    return new Gio.Settings({ settings_schema: schemaObj });
}

export function getSettings() {
    if (!_settings) {
        _settings = loadSettingsSchema();
    }
    return _settings;
}