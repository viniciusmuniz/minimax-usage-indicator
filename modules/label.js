// Pure helper. Testable in plain Node (no GNOME deps).
// Builds the top-bar label string from a quota snapshot and a window key.
// When showCountdown is false, the countdown suffix is dropped.
//
// `t` is an optional translator. Pass the gettext lookup function to get
// the labels translated. In tests, t defaults to identity.
//
// The {pct}, {h}, {m} placeholders stay intact in the .po files — this
// function substitutes them at runtime, so translators don't have to
// worry about printf codes or locale-specific number formatting.

const identity = (s) => s;

function substitute(template, vars) {
    let out = template;
    for (const [k, v] of Object.entries(vars)) {
        out = out.replace(`{${k}}`, String(v));
    }
    return out;
}

export function labelFor(quota, windowKey, showCountdown = true, t = identity) {
    const w = quota[windowKey];
    if (!w || w.total <= 0) return '—';
    const pct = Math.round((w.used / w.total) * 100);
    if (!showCountdown) return substitute(t('{pct}%'), { pct });
    const h = Math.floor(w.minutesRemaining / 60);
    const m = String(w.minutesRemaining % 60).padStart(2, '0');
    return substitute(t('{pct}% · {h}h {m}m'), { pct, h, m });
}
