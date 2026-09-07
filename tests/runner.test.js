const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const queue = require('../queue');
const origin = 'https://www.linkedin.com';
function boot({ state, completed = false, ready = true, fail = false, path = '/games/zip/', blockedStorage = false, resultHref = null, resultVisible = true, frames = [] } = {}) {
    const saved = { value: JSON.stringify(state || null) };
    let tick, now = 1000, solves = 0, reloads = 0;
    const navigations = [];
    const elements = {};
    const element = (tag) => ({
        isConnected: true,
        set innerHTML(_) { throw new Error('LinkedIn does not permit this HTML sink'); },
        set id(value) { elements['#' + value] = this; },
        setAttribute() {}, append() {},
        attachShadow: () => element('shadow'),
        addEventListener(type, fn) { this[type] = fn; },
    });
    const context = {
        window: { LGHQueue: queue, LGH: { games: ['zip', 'queens'], ready: () => ready,
            solve: async () => { solves++; if (fail) throw new Error('test'); } } },
        location: { origin, pathname: path, href: origin + path, assign: url => navigations.push(url), reload: () => reloads++ },
        sessionStorage: { getItem: () => saved.value, setItem: (_, value) => { if (blockedStorage) throw new Error('blocked'); saved.value = value; }, removeItem: () => { saved.value = 'null'; } },
        document: { body: { append() {} },
            createElement: tag => element(tag),
            querySelector: () => completed ? {} : null,
            querySelectorAll: selector => selector === 'a[href]' ? [{ href: origin + '/games/zip/', getClientRects: () => [1] }, { href: origin + '/games/queens/', getClientRects: () => [1] }, ...(resultHref ? [{ href: resultHref, getClientRects: () => resultVisible ? [1] : [] }] : [])] : [] },
        URL, Date: { now: () => now }, console: { warn() {} }, setInterval: fn => { tick = fn; },
    };
    const queryAll = context.document.querySelectorAll;
    context.document.querySelectorAll = selector => selector === 'iframe' ? frames : queryAll(selector);
    vm.runInNewContext(fs.readFileSync(require.resolve('../gameRunner'), 'utf8'), context);
    return { saved, elements, navigations, tick: () => tick(), setTime: value => { now = value; },
        get solves() { return solves; }, get reloads() { return reloads; } };
}
const running = () => ({ active: true, queue: queue.discover(['/games/zip/', '/games/queens/'], origin, ['zip', 'queens']), index: 0, results: [], startedAt: 1000, home: origin + '/games/' });
test('lobby starts a persisted queue only on click', () => {
    const app = boot({ path: '/game' });
    assert.equal(app.solves, 0);
    app.elements['#start'].click();
    assert.equal(JSON.parse(app.saved.value).queue.length, 2);
    assert.deepEqual(app.navigations, [origin + '/games/zip/']);
});
test('does not solve individual games without explicit activation', () => assert.equal(boot().solves, 0));
test('applies a solution once and waits for real completion', () => {
    const app = boot({ state: running() });
    app.tick(); app.tick();
    assert.equal(app.solves, 1);
    assert.equal(app.navigations.length, 0);
});
test('completion persists once even before browser navigation finishes', () => {
    const app = boot({ state: running(), completed: true });
    app.tick(); app.tick();
    assert.equal(app.solves, 0);
    assert.deepEqual(app.navigations, [origin + '/games/queens/']);
    assert.equal(JSON.parse(app.saved.value).results.length, 1);
    assert.equal(JSON.parse(app.saved.value).active, true);
});
test('last result returns to lobby and ends the batch', () => {
    const state = running(); state.index = 1;
    const app = boot({ state, path: '/games/queens/', completed: true });
    assert.deepEqual(app.navigations, [origin + '/games/']);
    assert.equal(JSON.parse(app.saved.value).active, false);
});
test('automatic navigation to current results page records completion and continues batch', () => {
    const app = boot({ state: running(), path: '/games/zip/results/', completed: true });
    assert.equal(app.solves, 0);
    assert.equal(JSON.parse(app.saved.value).results[0].status, 'completed');
    assert.deepEqual(app.navigations, [origin + '/games/queens/']);
});
test('results route alone waits for rendered results rather than cancelling or solving', () => {
    const app = boot({ state: running(), path: '/games/zip/results/' });
    app.tick();
    assert.equal(JSON.parse(app.saved.value).active, true);
    assert.equal(app.solves, 0);
    assert.deepEqual(app.navigations, []);
});
test('another game results route stops the batch without crediting completion', () => {
    const app = boot({ state: running(), path: '/games/queens/results/', completed: true });
    assert.equal(JSON.parse(app.saved.value).active, false);
    assert.deepEqual(JSON.parse(app.saved.value).results, []);
});
test('recognizes a rendered result inside the visible same-origin preload frame', () => {
    const frame = { src: origin + '/preload/?_bprMode=vanilla', getClientRects: () => [1],
        contentDocument: { querySelector: () => ({}) } };
    const app = boot({ state: running(), path: '/games/zip/results/', frames: [frame] });
    assert.deepEqual(app.navigations, [origin + '/games/queens/']);
});
test('hidden and foreign frames do not supply completion evidence', () => {
    for (const frame of [
        { src: 'https://example.com/preload/', getClientRects: () => [1] },
        { src: origin + '/preload/', getClientRects: () => [] },
    ]) {
        frame.contentDocument = { querySelector: () => ({}) };
        const app = boot({ state: running(), path: '/games/zip/results/', frames: [frame] });
        assert.deepEqual(app.navigations, []);
    }
});
test('timeout records failure instead of success and advances', () => {
    const app = boot({ state: running(), ready: false });
    app.setTime(92000); app.tick();
    assert.equal(JSON.parse(app.saved.value).results[0].status, 'failed');
    assert.deepEqual(app.navigations, [origin + '/games/queens/']);
});
test('stop persists inactive state and reloads to cancel in-flight inputs', () => {
    const app = boot({ state: running() });
    app.elements['#stop'].click();
    assert.equal(JSON.parse(app.saved.value).active, false);
    assert.equal(app.reloads, 1);
});
test('manual navigation outside the queued game cancels batch', () => {
    const app = boot({ state: running(), path: '/games/queens/' });
    assert.equal(JSON.parse(app.saved.value).active, false);
    assert.equal(app.solves, 0);
});
test('solver rejection is recorded and advances once', async () => {
    const app = boot({ state: running(), fail: true });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(JSON.parse(app.saved.value).results[0].status, 'failed');
    assert.equal(app.navigations.length, 1);
});
test('storage failure prevents navigation', () => {
    const app = boot({ path: '/games/', blockedStorage: true });
    app.elements['#start'].click();
    assert.equal(app.navigations.length, 0);
});

test('slow first navigation does not cancel the persisted batch on the lobby', () => {
    const app = boot({ path: '/games/' });
    app.elements['#start'].click();
    app.tick();
    app.tick();
    const saved = JSON.parse(app.saved.value);
    assert.equal(saved.active, true);
    assert.equal(saved.index, 0);
    assert.deepEqual(saved.results, []);
    assert.equal(app.navigations.length, 1);
});

test('revisited completed board advances without solving when only its results link exists', () => {
    const app = boot({ state: running(), resultHref: origin + '/games/zip/results/' });
    assert.equal(app.solves, 0);
    assert.equal(JSON.parse(app.saved.value).results[0].status, 'completed');
    assert.deepEqual(app.navigations, [origin + '/games/queens/']);
});
test('hidden or other-game result links do not mark the current puzzle completed', () => {
    for (const options of [
        { resultHref: origin + '/games/queens/results/' },
        { resultHref: origin + '/games/zip/results/', resultVisible: false },
    ]) {
        const app = boot({ state: running(), ...options });
        assert.equal(app.solves, 1);
        assert.equal(app.navigations.length, 0);
    }
});

test('builds working controls without innerHTML under LinkedIn HTML restrictions', () => {
    const app = boot({ path: '/games/' });
    assert.equal(app.elements['#start'].textContent, '一鍵完成所有遊戲');
    app.elements['#start'].click();
    assert.equal(JSON.parse(app.saved.value).active, true);
});
