// Pure helper. Testable in plain Node (no GNOME deps).
// Used by panel.js to decide what the top-bar number means.

export function pickCriticalWindow(quota, primaryWindow = null) {
    if (primaryWindow === 'interval' || primaryWindow === 'weekly') {
        return primaryWindow;
    }
    const a = quota.interval?.minutesRemaining ?? Infinity;
    const b = quota.weekly?.minutesRemaining ?? Infinity;
    return a <= b ? 'interval' : 'weekly';
}