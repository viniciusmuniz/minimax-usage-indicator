// Pure helper. Testable in plain Node (no GNOME deps).
// Builds the top-bar label string from a quota snapshot and a window key.
// When showCountdown is false, the countdown suffix is dropped.

export function labelFor(quota, windowKey, showCountdown = true) {
    const w = quota[windowKey];
    if (!w || w.total <= 0) return '—';
    const pct = Math.round((w.used / w.total) * 100);
    if (!showCountdown) return `${pct}%`;
    const h = Math.floor(w.minutesRemaining / 60);
    const m = w.minutesRemaining % 60;
    return `${pct}% · ${h}h ${String(m).padStart(2, '0')}m`;
}