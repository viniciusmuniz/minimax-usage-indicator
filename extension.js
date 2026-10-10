// Orchestrator. Wires modules together. Owns the refresh timer and error matrix.

import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { getSettings } from './modules/settings.js';
import {
    fetchQuota,
    QuotaAuthError,
    QuotaRateLimitError,
    QuotaServerError,
    QuotaNetworkError,
    QuotaParseError,
} from './modules/api.js';
import { getApiKey } from './modules/secrets.js';
import { PanelHost } from './modules/panel.js';
import {
    DEFAULT_REFRESH_SECONDS,
    MIN_REFRESH_SECONDS,
    MAX_REFRESH_SECONDS,
} from './modules/constants.js';

export default class MiniMaxUsageExtension extends Extension {
    enable() {
        this._settings = getSettings();
        this._panel = new PanelHost({
            primaryWindow: this._settings.get_string('primary-window'),
            onRefreshNow: () => this._refreshOnce(true),
            onPrefs: () => this._openPrefs(),
            settings: this._settings,
        });
        this._panel.enable();
        // Propagate 'primary-window' setting changes to the panel so the label
        // reflects the new choice on the next refresh.
        this._settings.connect('changed::primary-window', () => {
            this._panel.setPrimaryWindow(this._settings.get_string('primary-window'));
        });
        this._scheduleNext();
        // Fire an immediate first refresh; if no key, _refreshOnce shows ⚙.
        this._refreshOnce(true);
    }

    disable() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        this._panel?.disable();
        this._panel = null;
        this._settings = null;
    }

    _scheduleNext() {
        const sec = Math.max(
            MIN_REFRESH_SECONDS,
            Math.min(MAX_REFRESH_SECONDS, this._settings.get_int('refresh-interval') || DEFAULT_REFRESH_SECONDS),
        );
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, sec, () => {
            this._refreshOnce(false);
            this._scheduleNext();
            return GLib.SOURCE_REMOVE;
        });
    }

    async _refreshOnce(_showResult) {
        let key;
        try {
            key = await getApiKey();
        } catch (e) {
            logError(e);
            this._panel.setError('⚠', 'Keyring unavailable — see logs');
            return { ok: false, error: e };
        }
        if (!key) {
            this._panel.setError('⚙', 'No API key — open Preferences');
            return { ok: false };
        }
        try {
            const quota = await fetchQuota(key);
            this._panel.update(quota);
            return { ok: true };
        } catch (e) {
            this._handleError(e);
            return { ok: false, error: e };
        }
    }

    _handleError(e) {
        if (e instanceof QuotaAuthError) {
            this._panel.setError('🔑', 'Invalid API key — open Preferences');
        } else if (e instanceof QuotaRateLimitError) {
            this._panel.setError('⏳', `Rate limited, retry in ${e.retryAfterSec}s`);
        } else if (e instanceof QuotaServerError) {
            this._panel.setError('⚠', `MiniMax API unavailable (HTTP ${e.status})`);
        } else if (e instanceof QuotaNetworkError) {
            this._panel.setError('⚠', 'Network error');
        } else if (e instanceof QuotaParseError) {
            this._panel.setError('⚠', 'API response changed — see logs');
        } else {
            this._panel.setError('⚠', 'Unknown error');
            logError(e);
        }
    }

    _openPrefs() {
        Main.extensionManager.openExtensionPrefs(this.uuid, '', {});
    }
}