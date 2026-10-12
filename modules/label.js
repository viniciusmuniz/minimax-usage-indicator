// Pure helper. Testable in plain Node (no GNOME deps).
// Builds the top-bar label string from a quota snapshot and a window key.
// When showCountdown is false, the countdown suffix is dropped.
//
// Time units follow the "human readable" rule:
//   < 60 min          → {m}m               e.g. "30m"
//   < 24 h, h:m mixed → {h}h {m}m          e.g. "1h 30m"
//   < 24 h, no min    → {h}h               e.g. "1h"
//   >= 24 h, d:h:m    → {d}d {h}h {m}m     e.g. "1d 1h 30m"
//   >= 24 h, no min   → {d}d {h}h          e.g. "1d 1h"
//   >= 24 h, exact    → {d}d               e.g. "2d"
//
// `t` is an optional translator. Pass the gettext lookup function to get
// the labels translated. In tests, t defaults to identity.
//
// The {pct}, {d}, {h}, {m} placeholders stay intact in the .po files —
// this function substitutes them at runtime, so translators don't have to
// worry about printf codes or locale-specific number formatting.

const identity = (s) => s;

function substitute(template, vars) {
    let out = template;
    for (const [k, v] of Object.entries(vars)) {
        out = out.replace(`{${k}}`, String(v));
    }
    return out;
}

function formatTime(min, t) {
    if (min < 60) return substitute(t('{m}m'), { m: min });
    const d = Math.floor(min / 1440);
    const h = Math.floor((min % 1440) / 60);
    const m = min % 60;
    if (d > 0) {
        if (h === 0 && m === 0) return substitute(t('{d}d'), { d });
        if (h === 0) return substitute(t('{d}d {m}m'),
            { d, m: String(m).padStart(2, '0') });
        if (m === 0) return substitute(t('{d}d {h}h'), { d, h });
        return substitute(t('{d}d {h}h {m}m'),
            { d, h, m: String(m).padStart(2, '0') });
    }
    if (m === 0) return substitute(t('{h}h'), { h });
    return substitute(t('{h}h {m}m'),
        { h, m: String(m).padStart(2, '0') });
}

export function labelFor(quota, windowKey, showCountdown = true, t = identity) {
    const w = quota[windowKey];
    if (!w || w.total <= 0) return '—';
    const pct = Math.round((w.used / w.total) * 100);
    if (!showCountdown) return substitute(t('{pct}%'), { pct });
    return substitute(t('{pct}% · {time}'),
        { pct, time: formatTime(w.minutesRemaining, t) });
}
