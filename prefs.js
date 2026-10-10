import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import { initI18n, _ } from './modules/i18n.js';
import { getSettings } from './modules/settings.js';
import { getApiKey, setApiKey, clearApiKey } from './modules/secrets.js';

const PRIMARY_WINDOW_OPTIONS = [
    ['auto',     'Auto (most critical)'],
    ['interval', '5h interval'],
    ['weekly',   'Weekly'],
];

export default class MiniMaxUsagePrefs {
    constructor() {
        initI18n();
        // Translate the option labels now that the domain is bound.
        PRIMARY_WINDOW_OPTIONS[0][1] = _('Auto (most critical)');
        PRIMARY_WINDOW_OPTIONS[1][1] = _('5h interval');
        PRIMARY_WINDOW_OPTIONS[2][1] = _('Weekly');
    }

    fillPreferencesWindow(window) {
        const settings = getSettings();
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({ title: _('MiniMax API') });
        page.add(group);

        // API key row
        const keyRow = new Adw.PasswordEntryRow({ title: _('API Key') });
        const statusLabel = new Gtk.Label({ label: '', xalign: 0 });
        statusLabel.add_css_class('dim-label');
        statusLabel.set_margin_top(6);

        function setStatus(text, isError = false) {
            statusLabel.label = text;
            statusLabel.remove_css_class('error');
            statusLabel.remove_css_class('success');
            if (text) statusLabel.add_css_class(isError ? 'error' : 'success');
        }

        async function loadStored() {
            keyRow._populating = true;
            try {
                const key = await getApiKey();
                if (key) {
                    keyRow.text = key;
                    setStatus(_('Stored key loaded.'));
                } else {
                    setStatus(_('No key stored yet.'));
                }
            } catch (e) {
                console.error('Failed to load API key:', e);
                setStatus(_('Failed to read keyring — see logs'), true);
            } finally {
                keyRow._populating = false;
            }
        }
        loadStored();

        group.add(keyRow);
        group.add(statusLabel);

        const buttonBox = new Gtk.Box({ spacing: 6, margin_top: 6 });
        const saveBtn = new Gtk.Button({ label: _('Save'), halign: Gtk.Align.START });
        saveBtn.add_css_class('suggested-action');
        saveBtn.connect('clicked', async () => {
            const value = keyRow.text;
            if (!value) {
                setStatus(_('Cannot save an empty key.'), true);
                return;
            }
            saveBtn.sensitive = false;
            try {
                await setApiKey(value);
                setStatus(_('Saved to GNOME Keyring.'));
            } catch (e) {
                console.error('Failed to save API key:', e);
                setStatus(_('Save failed — see logs'), true);
            } finally {
                saveBtn.sensitive = true;
            }
        });

        const reloadBtn = new Gtk.Button({ label: _('Reload stored') });
        reloadBtn.connect('clicked', () => { loadStored(); });

        const clearBtn = new Gtk.Button({ label: _('Clear stored API key') });
        clearBtn.add_css_class('destructive-action');
        clearBtn.connect('clicked', async () => {
            clearBtn.sensitive = false;
            keyRow._populating = true;
            try {
                await clearApiKey();
                keyRow.text = '';
                setStatus(_('Stored key cleared.'));
            } catch (e) {
                console.error('Failed to clear API key:', e);
                setStatus(_('Clear failed — see logs'), true);
            } finally {
                keyRow._populating = false;
                clearBtn.sensitive = true;
            }
        });

        buttonBox.append(saveBtn);
        buttonBox.append(reloadBtn);
        buttonBox.append(clearBtn);
        group.add(buttonBox);

        window.add(page);

        // Behaviour group
        const beh = new Adw.PreferencesGroup({ title: _('Behavior') });
        page.add(beh);

        const intervalSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 60, upper: 3600, step_increment: 60,
                value: settings.get_int('refresh-interval'),
            }),
        });
        settings.bind('refresh-interval', intervalSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        const intervalRow = new Adw.ActionRow({ title: _('Refresh interval (seconds)') });
        intervalRow.add_suffix(intervalSpin);
        intervalRow.set_activatable_widget(intervalSpin);
        beh.add(intervalRow);

        const primaryCombo = new Gtk.DropDown({
            model: Gtk.StringList.new(PRIMARY_WINDOW_OPTIONS.map(([, l]) => l)),
        });
        const initialIdx = PRIMARY_WINDOW_OPTIONS.findIndex(
            ([k]) => k === settings.get_string('primary-window'),
        );
        if (initialIdx >= 0) primaryCombo.set_selected(initialIdx);
        primaryCombo.connect('notify::selected', () => {
            const idx = primaryCombo.get_selected();
            const [val] = PRIMARY_WINDOW_OPTIONS[idx];
            settings.set_string('primary-window', val);
        });
        const primaryRow = new Adw.ActionRow({ title: _('Top bar shows') });
        primaryRow.add_suffix(primaryCombo);
        primaryRow.set_activatable_widget(primaryCombo);
        beh.add(primaryRow);

        // Display group
        const disp = new Adw.PreferencesGroup({ title: _('Display') });
        page.add(disp);

        const showWeekly = new Adw.SwitchRow({
            title: _('Show weekly window'),
            subtitle: _('Display the weekly usage window in the dropdown menu'),
        });
        settings.bind('show-weekly', showWeekly, 'active', Gio.SettingsBindFlags.DEFAULT);
        disp.add(showWeekly);

        const showCountdown = new Gtk.SwitchRow({
            title: _('Show countdown'),
            subtitle: _('Display a countdown timer in the top bar'),
        });
        settings.bind('show-countdown', showCountdown, 'active', Gio.SettingsBindFlags.DEFAULT);
        disp.add(showCountdown);

        window.add(page);
    }
}
