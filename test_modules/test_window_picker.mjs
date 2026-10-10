import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickCriticalWindow } from '../modules/window-picker.js';

test('returns interval when 5h is closer to reset', () => {
    const quota = {
        interval: { minutesRemaining: 60 },
        weekly:   { minutesRemaining: 6000 },
    };
    assert.equal(pickCriticalWindow(quota), 'interval');
});

test('returns weekly when weekly is closer to reset', () => {
    const quota = {
        interval: { minutesRemaining: 6000 },
        weekly:   { minutesRemaining: 60 },
    };
    assert.equal(pickCriticalWindow(quota), 'weekly');
});

test('tie-break favors interval', () => {
    const quota = {
        interval: { minutesRemaining: 100 },
        weekly:   { minutesRemaining: 100 },
    };
    assert.equal(pickCriticalWindow(quota), 'interval');
});

test('respects primaryWindow override', () => {
    const quota = {
        interval: { minutesRemaining: 60 },
        weekly:   { minutesRemaining: 6000 },
    };
    assert.equal(pickCriticalWindow(quota, 'weekly'), 'weekly');
});