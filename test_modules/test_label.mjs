import { test } from 'node:test';
import assert from 'node:assert/strict';
import { labelFor } from '../modules/label.js';

const quota = {
    interval: { used: 50, total: 100, minutesRemaining: 90 }, // 50%, 1h 30m
    weekly:   { used: 200, total: 1000, minutesRemaining: 60 }, // 20%, 1h 0m
};

test('returns percentage and countdown by default', () => {
    assert.equal(labelFor(quota, 'interval'), '50% · 1h 30m');
});

test('drops countdown when showCountdown=false', () => {
    assert.equal(labelFor(quota, 'interval', false), '50%');
});

test('pads minutes to two digits', () => {
    const q = {
        interval: { used: 1, total: 100, minutesRemaining: 65 }, // 1h 05m
    };
    assert.equal(labelFor(q, 'interval'), '1% · 1h 05m');
});

test('returns em-dash when window missing', () => {
    assert.equal(labelFor({ interval: null }, 'interval'), '—');
});

test('returns em-dash when total is zero', () => {
    const q = { interval: { used: 0, total: 0, minutesRemaining: 0 } };
    assert.equal(labelFor(q, 'interval'), '—');
});

test('rounds percentage to nearest integer', () => {
    const q = {
        interval: { used: 33, total: 100, minutesRemaining: 60 },
    };
    assert.equal(labelFor(q, 'interval'), '33% · 1h 00m');
});