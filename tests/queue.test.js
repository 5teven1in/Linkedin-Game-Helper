const { test } = require('node:test');
const assert = require('node:assert/strict');
const { discover, valid, slugFor, isLobby } = require('../queue');
const origin = 'https://www.linkedin.com';
const games = ['queens', 'zip'];
test('supports singular/plural lobbies and game paths, excludes other routes', () => {
    for (const path of ['/game', '/game/', '/games', '/games/']) assert.ok(isLobby(path));
    assert.equal(slugFor('/games/queens/'), 'queens');
    assert.equal(slugFor('/game/zip'), 'zip');
    assert.equal(slugFor('/games/queens/results'), null);
    assert.equal(isLobby('/games/queens'), false);
});
test('discovers supported games in DOM order, deduplicates, strips tracking, rejects other origins', () => {
    assert.deepEqual(discover(['/games/zip/?x=1', '/games/zip', '/games/queens/',
        'https://evil.example/games/zip', '/games/unknown', '/feed', 'javascript:alert(1)'], origin, games),
    [{ slug: 'zip', url: origin + '/games/zip/' }, { slug: 'queens', url: origin + '/games/queens/' }]);
});
const now = Date.now();
const state = () => ({ active: true, queue: discover(['/games/zip'], origin, games), index: 0, results: [], startedAt: now, home: origin + '/games/' });
test('accepts running and finished queues', () => {
    assert.ok(valid(state(), origin, games, now));
    assert.ok(valid({ ...state(), index: 1, active: false }, origin, games, now));
});
test('rejects stale, malformed and redirected persisted state', () => {
    for (const changed of [null, { index: -1 }, { index: 2 }, { startedAt: now - 1800001 },
        { startedAt: now + 1000 }, { home: 'https://evil.example/games/' }, { results: null },
        { queue: [{ slug: 'zip', url: 'https://evil.example/games/zip' }] },
        { queue: [{ slug: 'queens', url: origin + '/games/zip' }] }]) {
        assert.equal(valid(changed === null ? null : { ...state(), ...changed }, origin, games, now), false);
    }
});

test('matches live Wend results link and rejects unrelated or foreign result URLs', () => {
    const { isResultLink } = require('../queue');
    const current = origin + '/games/wend/';
    for (const href of [origin + '/games/wend/results/', '/games/wend/results', 'results/?tracking=1']) {
        assert.ok(isResultLink(href, current));
    }
    for (const href of ['/games/zip/results/', 'https://evil.example/games/wend/results/', '/games/wend/', '/games/wend/results/archive']) {
        assert.equal(isResultLink(href, current), false);
    }
});
