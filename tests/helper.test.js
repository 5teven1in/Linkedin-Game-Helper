const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const queue = require('../queue');

function boot({ slug = 'wend', hydration = null, chunks, embedded = [] } = {}) {
    let observer, board = false;
    const requests = [];
    class XHR {
        open() { requests.push(this); }
        addEventListener(_, fn) { this.loaded = fn; }
    }
    const context = {
        window: { LGHQueue: queue, __como_rehydration__: chunks, fetch: async () => ({ url: '' }) },
        location: { pathname: `/games/${slug}/` },
        document: { querySelector: selector => selector === '#rehydrate-data' ? hydration : board ? {} : null,
            querySelectorAll: () => embedded },
        XMLHttpRequest: XHR,
        MutationObserver: class { constructor(fn) { observer = fn; } observe() {} },
        console,
    };
    vm.runInNewContext(fs.readFileSync(require.resolve('../gameHelper'), 'utf8'), context);
    return {
        api: context.window.LGH,
        setHydration(text) { hydration = { textContent: text }; observer(); },
        mountBoard() { hydration = null; delete context.window.__como_rehydration__; board = true; observer(); },
        navigate(slug) { context.location.pathname = `/games/${slug}/`; observer(); },
        async response(value) { const xhr = new XHR(); xhr.open(); xhr.responseType = 'json'; xhr.response = value; await xhr.loaded(); },
    };
}
const words = [{ sequencingIndex: [0, 1, 2] }];
test('captures initial Wend hydration before React removes data and mounts board', () => {
    const app = boot({ hydration: { textContent: JSON.stringify({ solutionWords: words }) } });
    assert.equal(app.api.ready('wend'), false);
    app.mountBoard();
    assert.equal(app.api.ready('wend'), true);
});
test('captures hydration inserted after document_start and before board appears', () => {
    const app = boot();
    app.setHydration(JSON.stringify({ solutionWords: words }));
    app.mountBoard();
    assert.equal(app.api.ready('wend'), true);
});
test('retries incomplete streamed hydration and captures escaped payload', () => {
    const app = boot();
    app.setHydration('{"solutionWords":[');
    app.setHydration(JSON.stringify(JSON.stringify({ solutionWords: words })));
    app.mountBoard();
    assert.equal(app.api.ready('wend'), true);
});
test('retains Como hydration chunks after LinkedIn deletes the global', () => {
    const raw = `0:${JSON.stringify({ solutionWords: words })}\n`;
    const app = boot({ chunks: [raw.slice(0, 20), raw.slice(20)] });
    app.mountBoard();
    assert.equal(app.api.ready('wend'), true);
});
test('does not use an unrelated array after a null solution', () => {
    const app = boot({ hydration: { textContent: '{"solutionWords":null,"other":[1,2]}' } });
    app.mountBoard();
    assert.equal(app.api.ready('wend'), false);
});
test('does not carry a solution across SPA game navigation', () => {
    const app = boot({ slug: 'zip', hydration: { textContent: '{"solution":[0,1,2]}' } });
    app.mountBoard();
    assert.equal(app.api.ready('zip'), true);
    app.navigate('queens');
    assert.equal(app.api.ready('queens'), false);
    assert.equal(app.api.ready('zip'), false);
});
test('network puzzle keys reach each corresponding solver', async () => {
    for (const [slug, key, field] of [
        ['wend', 'wendGamePuzzle', 'solutionWords'], ['zip', 'trailGamePuzzle', 'solution'],
        ['tango', 'lotkaGamePuzzle', 'solution'], ['queens', 'queensGamePuzzle', 'solution'],
        ['patches', 'patchesGamePuzzle', 'solution'],
    ]) {
        const app = boot({ slug });
        app.mountBoard();
        await app.response({ data: { gamePuzzle: { [key]: { [field]: [1] } } } });
        assert.equal(app.api.ready(slug), true, slug);
    }
});
test('waiting message distinguishes missing answers from an unmounted board', () => {
    const app = boot();
    assert.equal(app.api.waitingReason('wend'), '等待解答資料…');
    app.setHydration(JSON.stringify({ solutionWords: words }));
    assert.equal(app.api.waitingReason('wend'), '等待棋盤或開始遊戲…');
});
test('reads initial Voyager puzzle from embedded bpr JSON without any network request', () => {
    const app = boot({ slug: 'mini-sudoku', embedded: [{ textContent: JSON.stringify({
        included: [{ gamePuzzle: { miniSudokuGamePuzzle: { solution: [1, 2, 3] } } }],
    }) }] });
    app.mountBoard();
    assert.equal(app.api.ready('mini-sudoku'), true);
});

function crossclimbRun({ timerStart = 0, frozen = false, visible = true } = {}) {
    let now = 0;
    const inputs = Array.from({ length: 4 }, () => ({
        value: '',
        dispatchEvent() { this.changedAt = now; },
    }));
    const row = { querySelectorAll: selector => selector === 'input' ? inputs : [] };
    const context = {
        window: { LGHQueue: queue, fetch: async () => ({ url: '' }) },
        location: { pathname: '/games/crossclimb/' },
        document: { visibilityState: visible ? 'visible' : 'hidden',
            querySelector: selector => selector === '#rehydrate-data' ? { textContent: '{"rungs":[{"word":"HARD"}]}' } :
                selector === '.timer-text' ? { textContent: '0:' + String(frozen ? 1 : Math.floor(Math.max(0, now - timerStart) / 1000)).padStart(2, '0') } :
                selector === '.crossclimb__guess__inner input' ? inputs[0] : null,
            querySelectorAll: selector => selector === '.crossclimb__guess__inner' ? [row] : [] },
        XMLHttpRequest: class { open() {} }, MutationObserver: class { observe() {} },
        Event: class {}, performance: { now: () => now },
        setTimeout: (resolve, ms) => { now += ms; resolve(); }, console,
    };
    vm.runInNewContext(fs.readFileSync(require.resolve('../gameHelper'), 'utf8'), context);
    return { run: () => context.window.LGH.solve('crossclimb'), inputs };
}
test('Crossclimb waits until displayed time exceeds two seconds before any input', async () => {
    const app = crossclimbRun({ timerStart: 5000 });
    await app.run();
    assert.ok(app.inputs.every(input => input.changedAt >= 8000));
});
test('Crossclimb with a frozen timer never enters an answer', async () => {
    const app = crossclimbRun({ frozen: true });
    await assert.rejects(app.run(), /Crossclimb 計時未達 3 秒/);
    assert.ok(app.inputs.every(input => input.value === ''));
});

function sudokuRun({ timerStart = 0, frozen = false, filled = false, visible = true } = {}) {
    let now = 0;
    const clicks = [];
    const cells = [1, 2].map(() => ({ textContent: filled ? '1' : '', isConnected: true,
        classList: { contains: () => false }, dispatchEvent() {} }));
    const buttons = [1, 2].map(value => ({ disabled: false, click() { clicks.push({ value, now }); } }));
    const context = {
        window: { LGHQueue: queue, fetch: async () => ({ url: '' }) },
        location: { pathname: '/games/mini-sudoku/' },
        document: { visibilityState: visible ? 'visible' : 'hidden',
            querySelector: selector => selector === '#rehydrate-data' ? { textContent: '{"solution":[1,1]}' } :
                selector === '.timer-text' ? { textContent: '0:' + String(frozen ? 1 : Math.floor(Math.max(0, now - timerStart) / 1000)).padStart(2, '0') } : null,
            querySelectorAll: selector => selector === '.sudoku-cell' ? cells : selector === '.sudoku-input-button' ? buttons : [] },
        XMLHttpRequest: class { open() {} }, MutationObserver: class { observe() {} },
        MouseEvent: class {}, performance: { now: () => now },
        setTimeout: (resolve, ms) => { now += ms; resolve(); }, console,
    };
    vm.runInNewContext(fs.readFileSync(require.resolve('../gameHelper'), 'utf8'), context);
    return { run: () => context.window.LGH.solve('mini-sudoku'), clicks };
}
test('Sudoku waits for page time even when timer starts late', async () => {
    const app = sudokuRun({ timerStart: 5000 });
    await app.run();
    assert.equal(app.clicks.length, 2);
    assert.ok(app.clicks[0].now < 5000);
    assert.ok(app.clicks[1].now >= 8000);
});
test('Sudoku with frozen timer never submits final cell', async () => {
    const app = sudokuRun({ frozen: true });
    await assert.rejects(app.run(), /計時未達/);
    assert.equal(app.clicks.length, 1);
});
test('Sudoku in background never submits final cell', async () => {
    const app = sudokuRun({ visible: false });
    await assert.rejects(app.run(), /計時未達/);
    assert.equal(app.clicks.length, 1);
});
test('Sudoku filled unsaved board is not replayed', async () => {
    const app = sudokuRun({ filled: true });
    await assert.rejects(app.run(), /棋盤已填滿/);
    assert.equal(app.clicks.length, 0);
});
