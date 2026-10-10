// Top-bar button + label + color thresholds. UI only.
//
// On left-click: refreshes quota and toggles a small in-extension popover
// anchored below the indicator. On middle-click: opens Preferences.
//
// We build the popover ourselves with St.Widget + Clutter.BoxLayout (see
// modules/popover.js) rather than using PopupMenu, because in this GNOME
// 50.1 environment PopupMenu subclasses lose parent signals
// (allocation-changed) and St.BoxLayout.add_style_class_name is missing.
// The hand-rolled popover is small, only depends on widgets that work,
// and behaves like a normal extension menu.

import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Button } from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { pickCriticalWindow } from './window-picker.js';
import { labelFor } from './label.js';
import { gettext } from './i18n.js';
import { QuotaPopover } from './popover.js';

export function colorForPct(pct) {
    if (pct >= 95) return 'red';
    if (pct >= 80) return 'yellow';
    return 'green';
}

const PanelIndicator = GObject.registerClass(
class PanelIndicator extends Button {
    _init() {
        super._init(0.5, 'MiniMaxUsageIndicator', true);
        this._onPrimaryClick = null;
        this._onMiddleClick = null;
        this._label = new St.Label({
            text: '⚙',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'minimax-usage-label',
        });
        this.add_child(this._label);
        this.connect('button-press-event', this._onButtonPress.bind(this));
    }

    setLabel(text) {
        this._label.text = text;
    }

    setLabelStyle(style) {
        this._label.style = style;
    }

    setPrimaryClickCallback(cb) {
        this._onPrimaryClick = cb;
    }

    setMiddleClickCallback(cb) {
        this._onMiddleClick = cb;
    }

    _onButtonPress(actor, event) {
        const button = event.get_button();
        if (button === Clutter.BUTTON_PRIMARY && this._onPrimaryClick) {
            this._onPrimaryClick();
            return Clutter.EVENT_STOP;
        }
        if (button === Clutter.BUTTON_MIDDLE && this._onMiddleClick) {
            this._onMiddleClick();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }
});

export class PanelHost {
    constructor({ primaryWindow, onRefreshNow, onPrefs, settings }) {
        this._primaryWindow = primaryWindow;
        this._onRefreshNow = onRefreshNow;
        this._onPrefs = onPrefs;
        this._settings = settings;
        this._button = null;
        this._errorKey = null;
        this._lastQuota = null;
        this._lastSuccessPct = null;
        this._popover = new QuotaPopover();
    }

    enable() {
        this._button = new PanelIndicator();
        this._button.setPrimaryClickCallback(() => this._onPrimaryClick());
        this._button.setMiddleClickCallback(() => {
            this._popover.close();
            this._onPrefs?.();
        });
        Main.panel.addToStatusArea('minimax-usage-indicator', this._button, 0, 'right');
    }

    disable() {
        this._popover?.destroy();
        this._popover = null;
        if (!this._button) return;
        const name = 'minimax-usage-indicator';
        // In GNOME 50.1 the public remove API is missing on Main.panel in this
        // build. Try the renamed (GNOME 45+) and legacy names, then fall back
        // to the private status-area dict. Never throw from disable(): doing
        // so marks the whole extension as errored in the Extensions manager.
        try {
            if (typeof Main.panel.removeStatusArea === 'function') {
                Main.panel.removeStatusArea(name);
            } else if (typeof Main.panel.removeFromStatusArea === 'function') {
                Main.panel.removeFromStatusArea(name);
            } else if (Main.panel._statusArea && Main.panel._statusArea[name]) {
                Main.panel._statusArea[name].destroy();
                delete Main.panel._statusArea[name];
            }
        } catch (e) {
            logError(e, '[MiniMax] disable() could not remove from panel');
        }
        try { this._button.destroy(); } catch (_) { /* already torn down */ }
        this._button = null;
    }

    setPrimaryWindow(key) {
        this._primaryWindow = key;
    }

    setError(icon, text) {
        this._errorKey = text;
        this._lastQuota = null;
        if (this._button) {
            this._button.setLabel(icon);
            this._button.setLabelStyle('color: #ff5555;');
        }
        if (this._popover?.isOpen()) {
            this._popover.open(this._button, {
                quota: null, errorKey: text, lastSuccessPct: this._lastSuccessPct,
            });
        }
    }

    update(quota) {
        this._lastQuota = quota;
        this._errorKey = null;
        if (!quota) {
            if (this._button) {
                this._button.setLabel('⚙');
                this._button.setLabelStyle('color: #888;');
            }
            return;
        }
        const windowKey = pickCriticalWindow(quota, this._primaryWindow);
        const showCountdown = this._settings?.get_boolean('show-countdown') ?? true;
        const text = labelFor(quota, windowKey, showCountdown, gettext);
        const w = quota[windowKey];
        const pct = w.total > 0 ? Math.round((w.used / w.total) * 100) : 0;
        this._lastSuccessPct = pct;
        const color = colorForPct(pct);
        const cssColor = color === 'red' ? '#ff5555'
            : color === 'yellow' ? '#f5c542'
            : '#5fd75f';
        if (this._button) {
            this._button.setLabel(text);
            this._button.setLabelStyle(`color: ${cssColor};`);
        }
        // If the popover is open, refresh its content too so the user
        // sees the just-fetched numbers without closing/reopening.
        if (this._popover?.isOpen()) {
            this._popover.open(this._button, {
                quota, errorKey: null, lastSuccessPct: this._lastSuccessPct,
            });
        }
    }

    _onPrimaryClick() {
        try {
            // Refresh first, then toggle. If the popover was closed, opening
            // it after the refresh shows fresh data. If it was open, we close
            // it and start a refresh in the background for next time.
            if (this._popover.isOpen()) {
                this._popover.close();
                Promise.resolve(this._onRefreshNow?.());
                return;
            }
            Promise.resolve(this._onRefreshNow?.())
                .finally(() => {
                    try {
                        if (!this._button) return;
                        this._popover.open(this._button, {
                            quota: this._lastQuota,
                            errorKey: this._errorKey,
                            lastSuccessPct: this._lastSuccessPct,
                        });
                    } catch (e) {
                        logError(e, '[MiniMax] popover.open failed');
                    }
                });
        } catch (e) {
            logError(e, '[MiniMax] _onPrimaryClick failed');
        }
    }
}