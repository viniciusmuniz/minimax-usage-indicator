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
    assert.equal(labelFor(q, 'interval'), '33% · 1h');
});

test('shows days+hours when minutesRemaining >= 24h', () => {
    const q = { interval: { used: 1, total: 100, minutesRemaining: 3600 } }; // 60h
    assert.equal(labelFor(q, 'interval'), '1% · 2d 12h');
});

test('shows days+minutes when hours are zero but minutes remain', () => {
    const q = { interval: { used: 1, total: 100, minutesRemaining: 1445 } }; // 24h 5m
    assert.equal(labelFor(q, 'interval'), '1% · 1d 05m');
});

test('collapses to days-only when minutesRemaining is a whole number of days', () => {
    const q = { interval: { used: 1, total: 100, minutesRemaining: 2880 } }; // 48h
    assert.equal(labelFor(q, 'interval'), '1% · 2d');
});

test('collapses trailing zero minutes even when days are present', () => {
    const q = { interval: { used: 1, total: 100, minutesRemaining: 1500 } }; // 25h
    assert.equal(labelFor(q, 'interval'), '1% · 1d 1h');
});

test('zero-pads minutes inside a day+hour format', () => {
    const q = { interval: { used: 1, total: 100, minutesRemaining: 1530 } }; // 25h 30m
    assert.equal(labelFor(q, 'interval'), '1% · 1d 1h 30m');
});