import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuotaResponse } from '../modules/parser.js';

const base = {
    model_remains: [
        {
            model_name: 'general',
            current_interval_remaining_percent: 82,
            current_interval_status: 1,
            remains_time: 86_400_000,
            current_weekly_remaining_percent: 50,
            current_weekly_status: 1,
            weekly_remains_time: 604_800_000,
        },
    ],
};

test('derives used = 100 - remaining_percent', () => {
    const q = parseQuotaResponse(base);
    assert.equal(q.interval.total, 100);
    assert.equal(q.interval.remaining, 82);
    assert.equal(q.interval.used, 18);     // 100 - 82
    assert.equal(q.weekly.used, 50);       // 100 - 50
});

test('derives minutesRemaining from remains_time', () => {
    const q = parseQuotaResponse(base);
    assert.equal(q.interval.minutesRemaining, 1440);    // 86_400_000 / 1000 / 60
    assert.equal(q.weekly.minutesRemaining, 10080);     // 604_800_000 / 1000 / 60
});

test('picks the most-stressed (lowest remaining_percent) entry', () => {
    const payload = {
        model_remains: [
            { model_name: 'general', current_interval_remaining_percent: 90,
              remains_time: 60_000, current_interval_status: 1,
              current_weekly_remaining_percent: 90, weekly_remains_time: 60_000,
              current_weekly_status: 1 },
            { model_name: 'video',   current_interval_remaining_percent: 20,
              remains_time: 60_000, current_interval_status: 1,
              current_weekly_remaining_percent: 20, weekly_remains_time: 60_000,
              current_weekly_status: 1 },
        ],
    };
    const q = parseQuotaResponse(payload);
    assert.equal(q.model_name, 'video');
    assert.equal(q.interval.used, 80);     // 100 - 20
});

test('skips entries missing remaining_percent and falls back to first usable', () => {
    const payload = {
        model_remains: [
            { model_name: 'broken' },                       // no fields at all
            { model_name: 'general', current_interval_remaining_percent: 70,
              remains_time: 1, current_interval_status: 1,
              current_weekly_remaining_percent: 70, weekly_remains_time: 1,
              current_weekly_status: 1 },
        ],
    };
    const q = parseQuotaResponse(payload);
    assert.equal(q.model_name, 'general');
    assert.equal(q.interval.used, 30);
});

test('exposes interval and weekly status fields', () => {
    const q = parseQuotaResponse(base);
    assert.equal(q.status.interval, 1);
    assert.equal(q.status.weekly, 1);
});

test('throws on missing model_remains', () => {
    assert.throws(() => parseQuotaResponse({}), /model_remains/);
});

test('throws on empty model_remains', () => {
    assert.throws(() => parseQuotaResponse({ model_remains: [] }), /model_remains/);
});

test('throws when selected entry has no remaining_percent', () => {
    const payload = {
        model_remains: [{ model_name: 'x', remains_time: 1 }],
    };
    assert.throws(() => parseQuotaResponse(payload), /remaining_percent/);
});