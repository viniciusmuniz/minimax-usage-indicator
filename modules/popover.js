// Minimalist in-extension popover anchored below the indicator.
//
// We build it with St.Widget + Clutter.BoxLayout directly, sidestepping
// PopupMenu/MenuManager entirely. Reasons:
//  - In this user's GNOME 50.1 build, PopupMenu subclasses lose parent
//    signals (allocation-changed) and add_style_class_name is missing
//    on the St.BoxLayout actor, so the canonical menu path crashes.
//  - St.Widget works (we already use it for the top-bar label).
//
// The popover is a single St.Widget with three labels stacked vertically,
// positioned with set_position() below the anchor. It auto-dismisses on
// outside click or Escape, just like a real menu.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { _, _f } from './i18n.js';

const POPOVER_STYLE = `
    background-color: rgba(28, 28, 30, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 10px 14px;
    color: #f6f5f4;
    font-size: 12px;
    min-width: 220px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
`;

const TITLE_STYLE = 'font-weight: bold; font-size: 12px; margin-bottom: 6px; color: #ffffff;';
const LINE_STYLE = 'font-size: 12px; margin: 2px 0; color: #d8d6d2;';
const WARN_STYLE = 'font-size: 11px; margin-top: 6px; color: #f5c542;';
const HINT_STYLE = 'font-size: 10px; margin-top: 8px; color: #888; font-style: italic;';

function fmtMinutes(min) {
    if (min < 60) return _f('{m}m', { m: min });
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (m) return _f('{h}h {m}m', { h, m });
    return _f('{h}h', { h });
}

function colorWord(pct) {
    if (pct >= 95) return _('RED');
    if (pct >= 80) return _('YELLOW');
    return _('green');
}

export class QuotaPopover {
    constructor() {
        this._widget = new St.Widget({
            layout_manager: new Clutter.BoxLayout({
                orientation: Clutter.Orientation.VERTICAL,
            }),
            visible: false,
            reactive: true,
            opacity: 0,
        });
        this._widget.set_style(POPOVER_STYLE);

        this._title = new St.Label({ text: _('MiniMax Usage'), style: TITLE_STYLE });
        this._intervalLabel = new St.Label({ text: '', style: LINE_STYLE });
        this._weeklyLabel = new St.Label({ text: '', style: LINE_STYLE });
        this._warnLabel = new St.Label({ text: '', style: WARN_STYLE });
        this._hintLabel = new St.Label({
            text: _('Middle-click for Preferences  ·  Click again to close'),
            style: HINT_STYLE,
        });

        this._widget.add_child(this._title);
        this._widget.add_child(this._intervalLabel);
        this._widget.add_child(this._weeklyLabel);
        this._widget.add_child(this._warnLabel);
        this._widget.add_child(this._hintLabel);

        // Stage is resolved lazily on first open via anchor.get_stage() —
        // Clutter.Stage.get_default() does not exist in this GJS build,
        // and global.stage is undefined on this GNOME 50.1 environment.
        this._stage = null;
        this._onOutsideClick = null;
        this._onKeyPress = null;
        this._anchor = null;
        this._open = false;
    }

    isOpen() { return this._open; }

    toggle(anchor, state) {
        if (this._open) {
            this.close();
        } else {
            this.open(anchor, state);
        }
    }

    open(anchor, { quota, errorKey, lastSuccessPct }) {
        try {
            this._render({ quota, errorKey, lastSuccessPct });
            this._anchor = anchor;
            // Resolve the stage from the anchor. Clutter.Stage.get_default()
            // is not available in this GJS build, but every Clutter.Actor
            // has a get_stage() instance method that returns the stage it
            // is attached to.
            const stage = anchor.get_stage();
            if (!stage) {
                logError(new Error('anchor.get_stage() returned null'),
                    '[MiniMax] popover.open');
                return;
            }
            this._stage = stage;

            // Add to stage if not already attached. We add/remove on every
            // open/close rather than keeping it permanently attached, so the
            // popover doesn't intercept events when hidden.
            if (this._widget.get_parent() !== stage) {
                stage.add_child(this._widget);
            }
            this._position();
            this._widget.show();
            this._widget.ease({ opacity: 255, duration: 80, mode: Clutter.AnimationMode.EASE_OUT });
            this._open = true;

            // Dismiss on click outside the popover. Connect to the stage's
            // button-press-event so we catch every click.
            this._onOutsideClick = this._stage.connect('button-press-event',
                (_stage, event) => {
                    if (!this._open) return Clutter.EVENT_PROPAGATE;
                    if (this._eventInside(event)) return Clutter.EVENT_PROPAGATE;
                    this.close();
                    return Clutter.EVENT_PROPAGATE;
                });
            // Escape to close
            this._onKeyPress = this._stage.connect('key-press-event',
                (_stage, event) => {
                    if (this._open && event.get_key_symbol() === Clutter.KEY_Escape) {
                        this.close();
                        return Clutter.EVENT_STOP;
                    }
                    return Clutter.EVENT_PROPAGATE;
                });
        } catch (e) {
            logError(e, '[MiniMax] popover.open failed');
        }
    }

    close() {
        if (!this._open) return;
        this._open = false;
        const stage = this._stage;
        if (stage) {
            if (this._onOutsideClick) {
                stage.disconnect(this._onOutsideClick);
                this._onOutsideClick = null;
            }
            if (this._onKeyPress) {
                stage.disconnect(this._onKeyPress);
                this._onKeyPress = null;
            }
        }
        this._widget.ease({
            opacity: 0,
            duration: 80,
            mode: Clutter.AnimationMode.EASE_OUT,
            onComplete: () => {
                this._widget.hide();
                if (stage && this._widget.get_parent() === stage) {
                    stage.remove_child(this._widget);
                }
            },
        });
    }

    destroy() {
        // Detach handlers without depending on the stage being live.
        this._open = false;
        this._onOutsideClick = null;
        this._onKeyPress = null;
        const stage = this._stage;
        if (stage && this._widget.get_parent() === stage) {
            stage.remove_child(this._widget);
        }
        this._widget.destroy();
    }

    _position() {
        if (!this._anchor) return;
        // Anchor is in the top bar; the popover should appear just below
        // it, aligned to the anchor's left edge, but clamped to the screen.
        // We rely on the CSS min-width (220px) plus the natural content
        // size, which is already laid out by the time this runs because
        // the widget is on the stage and visible.
        const [ax, ay] = this._anchor.get_transformed_position();
        const ah = this._anchor.get_height();
        const stageW = this._stage.get_width();
        const pw = this._widget.get_width() || 240;
        const ph = this._widget.get_height() || 80;
        const margin = 6;
        let x = Math.round(ax);
        // If it would overflow right, slide it left.
        if (x + pw + margin > stageW) x = Math.max(margin, stageW - pw - margin);
        const y = Math.round(ay + ah + margin);
        this._widget.set_position(x, y);
    }

    _eventInside(event) {
        if (!this._anchor) return false;
        const [ex, ey] = event.get_coords();
        // Anchor box
        const [ax, ay] = this._anchor.get_transformed_position();
        const aw = this._anchor.get_width();
        const ah = this._anchor.get_height();
        if (ex >= ax && ex <= ax + aw && ey >= ay && ey <= ay + ah) return true;
        // Popover box
        const [px, py] = this._widget.get_transformed_position();
        const pw = this._widget.get_width();
        const ph = this._widget.get_height();
        if (ex >= px && ex <= px + pw && ey >= py && ey <= py + ph) return true;
        return false;
    }

    _render({ quota, errorKey, lastSuccessPct }) {
        if (errorKey) {
            this._title.text = _('MiniMax Usage');
            this._intervalLabel.text = errorKey;
            this._weeklyLabel.text = '';
            this._warnLabel.text = '';
            return;
        }
        if (!quota) {
            this._title.text = _('MiniMax Usage');
            this._intervalLabel.text = lastSuccessPct != null
                ? _f('Awaiting data — last seen: {pct}%', { pct: lastSuccessPct })
                : _('Awaiting first refresh…');
            this._weeklyLabel.text = '';
            this._warnLabel.text = '';
            return;
        }
        const { interval, weekly } = quota;
        const iPct = interval.total > 0
            ? Math.round((interval.used / interval.total) * 100) : 0;
        const wPct = weekly.total > 0
            ? Math.round((weekly.used / weekly.total) * 100) : 0;
        const model = quota.model_name ?? _('general');
        this._title.text = _f('MiniMax Usage  ·  {model}', { model });
        this._intervalLabel.text = _f(
            '5h:    {pct}% ({used}/{total})  ·  reset in {reset}',
            { pct: iPct, used: interval.used, total: interval.total,
              reset: fmtMinutes(interval.minutesRemaining) },
        );
        this._weeklyLabel.text = _f(
            'Week:  {pct}% ({used}/{total})  ·  reset in {reset}',
            { pct: wPct, used: weekly.used, total: weekly.total,
              reset: fmtMinutes(weekly.minutesRemaining) },
        );
        const warns = [];
        if (iPct >= 80) warns.push(_f('⚠ 5h at {color} threshold', { color: colorWord(iPct) }));
        if (wPct >= 80) warns.push(_f('⚠ Weekly at {color} threshold', { color: colorWord(wPct) }));
        this._warnLabel.text = warns.join('   ');
    }
}
