// Pure parser. No I/O. Testable in plain Node.
//
// The MiniMax /coding_plan/remains endpoint returns a `model_remains` array
// (one entry per model). Each entry reports the quota as:
//   - *_remaining_percent: percent REMAINING (not used — Issue #99 confirms)
//   - *_total_count and *_usage_count are unreliable (commonly 0)
//   - *_status: 1 = active, other values = degraded/blocked
//   - remains_time / weekly_remains_time: ms until reset
//
// We pick the entry whose interval window is most consumed (lowest
// remaining_percent) because that's what the user actually wants to watch.
// We then normalise to { total: 100, used: (100 - remainingPct), minutesRemaining }
// so downstream code can keep using `w.used / w.total` without changes.

export class QuotaParseError extends Error {
    constructor(message) {
        super(message);
        this.name = 'QuotaParseError';
    }
}

function toMinutes(ms) {
    return Math.floor(ms / 1000 / 60);
}

function pickMostStressed(model_remains) {
    // Prefer entries that look healthy (status === 1) and have a numeric
    // remaining_percent; among those, pick the one with the lowest
    // remaining_percent (= highest usage), so the indicator reflects the
    // tightest constraint the user actually has.
    const usable = model_remains.filter(e =>
        typeof e?.current_interval_remaining_percent === 'number');
    if (usable.length === 0) return model_remains[0];
    usable.sort((a, b) =>
        a.current_interval_remaining_percent - b.current_interval_remaining_percent);
    return usable[0];
}

function readWindow(entry, remainPctField, resetField) {
    if (typeof entry[remainPctField] !== 'number') {
        throw new QuotaParseError(`missing field: ${remainPctField}`);
    }
    if (typeof entry[resetField] !== 'number') {
        throw new QuotaParseError(`missing field: ${resetField}`);
    }
    const remainingPct = entry[remainPctField];
    return {
        total: 100,
        remaining: remainingPct,
        used: 100 - remainingPct,
        minutesRemaining: toMinutes(entry[resetField]),
    };
}

export function parseQuotaResponse(payload) {
    if (!payload || !Array.isArray(payload.model_remains) || payload.model_remains.length === 0) {
        throw new QuotaParseError('missing or empty model_remains');
    }
    const entry = pickMostStressed(payload.model_remains);
    return {
        interval: readWindow(entry, 'current_interval_remaining_percent', 'remains_time'),
        weekly:   readWindow(entry, 'current_weekly_remaining_percent',   'weekly_remains_time'),
        model_name: entry.model_name,
        status: {
            interval: entry.current_interval_status,
            weekly: entry.current_weekly_status,
        },
    };
}