(() => {
"use strict";

const sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const delayBetweenEvents = 70;
const minPuzzleInteractionDurationMs = 2200;

const waitForMinimumElapsed = async (startedAt, minimumMs) => {
    const elapsed = performance.now() - startedAt;
    if (elapsed < minimumMs) {
        await sleep(minimumMs - elapsed);
    }
}

// Use the game's displayed active time: wall-clock delays can include loading,
// paused time, or time spent with the tab in the background.
const waitForGameTimer = async (gameName, minimumSeconds = 3) => {
    const deadline = performance.now() + 15000;
    while (performance.now() < deadline) {
        const timer = document.querySelector('.timer-text');
        const match = timer?.textContent.trim().match(/^(\d+):(\d{2})$/);
        if (document.visibilityState === 'visible' && match &&
            Number(match[1]) * 60 + Number(match[2]) >= minimumSeconds) return;
        await sleep(100);
    }
    throw new Error(`${gameName} 計時未達 ${minimumSeconds} 秒，已停止，請確認遊戲正在前景執行`);
}

const mouseDownUp = async (node) => {
    if (node) node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(10);
    if (node) node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
}

const getTangoCells = (expectedCount) => {
    const indexedCells = Array.from(document.querySelectorAll('[data-cell-idx], [data-cell-index]'));
    const cellsByIndex = new Map();
    for (const cell of indexedCells) {
        const rawIndex = cell.getAttribute('data-cell-idx') ?? cell.getAttribute('data-cell-index');
        const index = Number(rawIndex);
        if (Number.isInteger(index) && !cellsByIndex.has(index)) {
            cellsByIndex.set(index, cell);
        }
    }

    const cellsInIndexOrder = Array.from({ length: expectedCount }, (_, index) => cellsByIndex.get(index));
    if (cellsInIndexOrder.every(Boolean)) return cellsInIndexOrder;

    const board = document.querySelector('[role="grid"]') ?? document.querySelector('#workspace');
    if (!board) return [];

    const gridCells = Array.from(board.querySelectorAll('[role="gridcell"]'));
    if (gridCells.length >= expectedCount) return gridCells.slice(0, expectedCount);

    const buttons = Array.from(board.querySelectorAll('button')).filter(button => !button.disabled);
    return buttons.length >= expectedCount ? buttons.slice(0, expectedCount) : [];
}

const waitForTangoCells = async (expectedCount, timeoutMs = 15000) => {
    const deadline = performance.now() + timeoutMs;
    let cells = [];
    while (performance.now() < deadline) {
        cells = getTangoCells(expectedCount);
        if (cells.length >= expectedCount) return cells;
        await sleep(100);
    }
    return cells;
}

const activateTangoCell = async (cell) => {
    if (!cell) return false;

    await mouseDownUp(cell);
    return true;
}

const mouseEnterLeave = async (nodes) => {
    if (!Array.isArray(nodes) || nodes.length === 0) return false;
    if (nodes.some(node => !node?.isConnected)) {
        console.warn("[Game Bot] Patches cell not found.");
        return false;
    }
    const fire = (el, type) => {
        const event = new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            buttons: 1 // 模擬滑鼠左鍵按下的狀態
        });
        el.dispatchEvent(event);
    };
    for (const [index, node] of nodes.entries()) {
        if (index === 0) {
            fire(node, 'mousedown');
            fire(node, 'mousemove');
        } else if (index === nodes.length - 1) {
            fire(node, 'mousemove');
            fire(node, 'mouseup');
        } else {
            fire(node, 'mousemove');
        }
        await sleep(10);
    }
    return true;
}

const getElementCenter = (el) => {
    const rect = el.getBoundingClientRect();
    return {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
    };
}

const dragThroughCells = async (nodes) => {
    if (!nodes || nodes.length === 0) return;

    const firePointer = (target, type, coordinates, buttons = 1) => {
        if (!window.PointerEvent) return;
        target.dispatchEvent(new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            pointerId: 1,
            pointerType: "mouse",
            isPrimary: true,
            button: 0,
            buttons,
            ...coordinates,
        }));
    };

    const fireMouse = (target, type, coordinates, buttons = 1) => {
        target.dispatchEvent(new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0,
            buttons,
            ...coordinates,
        }));
    };

    const moveTo = async (coordinates) => {
        const target = document.elementFromPoint(coordinates.clientX, coordinates.clientY) || document;
        firePointer(target, "pointermove", coordinates);
        fireMouse(target, "mousemove", coordinates);
        firePointer(document, "pointermove", coordinates);
        fireMouse(document, "mousemove", coordinates);
        await sleep(20);
    };

    const points = nodes.map(getElementCenter);
    const startTarget = document.elementFromPoint(points[0].clientX, points[0].clientY) || nodes[0];
    firePointer(startTarget, "pointerover", points[0]);
    firePointer(startTarget, "pointerenter", points[0]);
    fireMouse(startTarget, "mouseover", points[0]);
    fireMouse(startTarget, "mouseenter", points[0]);
    firePointer(startTarget, "pointerdown", points[0]);
    fireMouse(startTarget, "mousedown", points[0]);
    await sleep(delayBetweenEvents);

    for (let i = 1; i < points.length; i++) {
        const from = points[i - 1];
        const to = points[i];
        const steps = 8;
        for (let step = 1; step <= steps; step++) {
            await moveTo({
                clientX: from.clientX + ((to.clientX - from.clientX) * step) / steps,
                clientY: from.clientY + ((to.clientY - from.clientY) * step) / steps,
            });
        }
        await sleep(delayBetweenEvents);
    }

    const endTarget = document.elementFromPoint(points[points.length - 1].clientX, points[points.length - 1].clientY) || nodes[nodes.length - 1];
    firePointer(endTarget, "pointerup", points[points.length - 1], 0);
    fireMouse(endTarget, "mouseup", points[points.length - 1], 0);
}

const solverBlueprintGamePuzzle = async (answer) => {
    const inp = document.querySelector('.pinpoint__input');
    if (inp.value) return;
    inp.value = answer;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(delayBetweenEvents);
    document.querySelector('.pinpoint__submit-btn').click();
}

const solverCrossClimbGamePuzzle = async (answer) => {
    document.querySelectorAll(".crossclimb__guess__inner").forEach((el, idx) => {
        const inps = el.querySelectorAll("input");
        const ans = answer[idx]?.word;
        if (!ans) return;
        inps.forEach((inp, idx) => {
            if (inp.value) return;
            inp.value = ans[idx];
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
        });
    });
}

const solveCrossClimbGamePuzzle = async (answer) => {
    // The first fill can complete the board, so wait before dispatching any
    // input. The second pass handles Crossclimb's later rearrangement phase.
    await waitForGameTimer('Crossclimb');
    await solverCrossClimbGamePuzzle(answer);
    await sleep(2500);
    await solverCrossClimbGamePuzzle(answer);
}

const solverLotkaGamePuzzle = async (answer) => {
    if (!Array.isArray(answer) || answer.length === 0) {
        console.warn('[Game Bot] Tango solution is empty.');
        return;
    }

    const cells = await waitForTangoCells(answer.length);
    if (cells.length < answer.length) {
        console.warn(`[Game Bot] Tango board not ready: found ${cells.length}/${answer.length} cells.`);
        return;
    }

    await sleep(2000);
    for (const [idx, ans] of answer.entries()) {
        await sleep(delayBetweenEvents);
        const cell = cells[idx];
        if (ans === "LotkaCellValue_ZERO") {
            await activateTangoCell(cell);
        }
        else if (ans === "LotkaCellValue_ONE") {
            await activateTangoCell(cell);
            await sleep(delayBetweenEvents);
            await activateTangoCell(cell);
        }
    }
}

const solverMiniSudokuGamePuzzle = async (answer) => {
    const cells = Array.from(document.querySelectorAll('.sudoku-cell'));
    if (cells.length !== answer.length) throw new Error('Mini Sudoku 棋盤與答案長度不符');
    const pending = cells.map((cell, idx) => ({ cell, idx })).filter(({ cell, idx }) =>
        !cell.classList.contains('sudoku-cell-prefilled') && cell.textContent.trim() !== String(answer[idx]));
    if (!pending.length) throw new Error('Mini Sudoku 棋盤已填滿，但尚未確認儲存成功');
    for (const [step, { cell, idx }] of pending.entries()) {
        await sleep(delayBetweenEvents);
        await mouseDownUp(cell);
        await sleep(delayBetweenEvents);
        if (step === pending.length - 1) await waitForGameTimer('Mini Sudoku');
        const button = document.querySelectorAll('.sudoku-input-button')[answer[idx] - 1];
        if (!cell.isConnected || !button || button.disabled) throw new Error('Mini Sudoku 輸入不可用');
        button.click();
    }
}

const solverQueensGamePuzzle = async (answer) => {
    let n = Math.max(...answer.map(x => x.col));
    await sleep(2000);
    n += 1;
    const interactionStartedAt = performance.now();
    for (let i = 0; i < n; i++) {
        const cell = document.querySelector(`div[data-cell-idx="${i * n + answer[i].col}"]`);
        await mouseDownUp(cell);
        await sleep(delayBetweenEvents);
        if (i === n - 1) {
            await waitForMinimumElapsed(interactionStartedAt, minPuzzleInteractionDurationMs);
        }
        await mouseDownUp(cell);
    }
}

const solverTrailGamePuzzle = async (answer) => {
    await sleep(2000);
    const interactionStartedAt = performance.now();
    for (const [idx, ans] of answer.entries()) {
        const cell = document.querySelector(`div[data-cell-idx="${ans}"]`);
        if (idx === answer.length - 1) {
            await waitForMinimumElapsed(interactionStartedAt, minPuzzleInteractionDurationMs);
        }
        await mouseDownUp(cell);
        await sleep(10);
    }
}

const solverPatchesGamePuzzle = async (answer) => {
    await sleep(2000);
    const interactionStartedAt = performance.now();
    for (const [idx, ans] of answer.entries()) {
        const cellIdxes = ans?.cellIdxes;
        if (!Array.isArray(cellIdxes) || cellIdxes.length === 0) {
            console.warn("[Game Bot] Invalid Patches cell indexes.", cellIdxes);
            continue;
        }
        const block = cellIdxes.map(cellIdx => document.querySelector(`div[data-cell-idx="${cellIdx}"]`));
        if (block.some(node => !node?.isConnected)) {
            console.warn("[Game Bot] Patches cell not found.", cellIdxes);
            continue;
        }
        if (idx === answer.length - 1) {
            await waitForMinimumElapsed(interactionStartedAt, minPuzzleInteractionDurationMs);
        }
        await mouseEnterLeave(block);
        await sleep(delayBetweenEvents);
    }
}

const solverWendGamePuzzle = async (answer) => {
    await sleep(2000);
    for (const ans of answer) {
        const block = ans.sequencingIndex.map(idx => document.querySelector(`[data-cell-idx="${idx}"]`));
        if (block.some(node => !node)) {
            console.warn("[Game Bot] Wend cell not found.", ans.sequencingIndex);
            continue;
        }
        console.log("[Game Bot]", ans.sequencingIndex);
        await dragThroughCells(block);
        await sleep(delayBetweenEvents);
    }
}

const parseJsonValueForKey = (text, key) => {
    const normalizedText = text.replace(/\\"/g, '"');
    const keyIndex = normalizedText.indexOf(`"${key}"`);
    if (keyIndex === -1) return null;

    const colonIndex = normalizedText.indexOf(":", keyIndex);
    if (colonIndex === -1) return null;

    // Do not consume an unrelated array when this field is null or a reference.
    const valueStart = normalizedText.slice(colonIndex + 1).search(/\S/);
    if (valueStart === -1 || !'[{'.includes(normalizedText[colonIndex + 1 + valueStart])) return null;

    const startIndex = colonIndex + 1 + valueStart;
    const openChar = normalizedText[startIndex];
    const closeChar = openChar === "[" ? "]" : "}";
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = startIndex; i < normalizedText.length; i++) {
        const char = normalizedText[i];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
        } else if (char === openChar) {
            depth++;
        } else if (char === closeChar) {
            depth--;
            if (depth === 0) {
                return JSON.parse(normalizedText.slice(startIndex, i + 1));
            }
        }
    }

    return null;
}

// Capture puzzle payloads without changing the response delivered to LinkedIn.
const puzzles = new Map();
const collectPuzzles = (value) => {
    if (!value || typeof value !== 'object') return;
    if (value.gamePuzzle) {
        for (const [key, puzzle] of Object.entries(value.gamePuzzle)) {
            if (puzzle) puzzles.set(key, puzzle);
        }
    }
    for (const child of Object.values(value)) collectPuzzles(child);
};
const capture = (url, text) => {
    if (!String(url).includes('/voyager/api/')) return;
    try { collectPuzzles(JSON.parse(text)); } catch { /* Non-JSON response. */ }
};
const nativeOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (...args) {
    if (!this.__lghObserved) {
        this.__lghObserved = true;
        this.addEventListener('load', async () => {
            try {
                if (this.responseType === 'blob') capture(this.responseURL, await this.response.text());
                else if (this.responseType === 'json') collectPuzzles(this.response);
                else if (!this.responseType || this.responseType === 'text') capture(this.responseURL, this.responseText);
            } catch { /* Ignore unrelated requests. */ }
        });
    }
    return nativeOpen.apply(this, args);
};
const nativeFetch = window.fetch;
window.fetch = async function (...args) {
    const response = await nativeFetch.apply(this, args);
    if (response.url.includes('/voyager/api/')) {
        response.clone().text().then(text => capture(response.url, text)).catch(() => {});
    }
    return response;
};

const registry = {
    pinpoint: { key: 'blueprintGamePuzzle', field: 'solutions', selector: '.pinpoint__input', solve: a => solverBlueprintGamePuzzle(a[0]) },
    crossclimb: { key: 'crossClimbGamePuzzle', field: 'rungs', selector: '.crossclimb__guess__inner input', solve: solveCrossClimbGamePuzzle },
    'mini-sudoku': { key: 'miniSudokuGamePuzzle', field: 'solution', selector: '.sudoku-cell', solve: solverMiniSudokuGamePuzzle },
    tango: { key: 'lotkaGamePuzzle', field: 'solution', selector: '[data-cell-idx], [data-cell-index], [role="gridcell"]', solve: solverLotkaGamePuzzle },
    queens: { key: 'queensGamePuzzle', field: 'solution', selector: '[data-cell-idx]', solve: solverQueensGamePuzzle },
    zip: { key: 'trailGamePuzzle', field: 'solution', selector: '[data-cell-idx]', solve: solverTrailGamePuzzle },
    patches: { key: 'patchesGamePuzzle', field: 'solution', selector: '[data-cell-idx]', solve: solverPatchesGamePuzzle },
    wend: { key: 'wendGamePuzzle', field: 'solutionWords', selector: '[data-cell-idx]', solve: solverWendGamePuzzle },
};
// Como removes both the hydration element and its global after mounting React.
// Capture before the board is ready, rather than reading them only from ready().
const hydrationAnswers = new Map();
const scannedPayloads = new WeakMap();
let hydrationPath = location.pathname;
const captureHydration = () => {
    if (location.pathname !== hydrationPath) {
        hydrationPath = location.pathname;
        hydrationAnswers.clear();
        puzzles.clear();
    }
    const slug = window.LGHQueue.slugFor(hydrationPath);
    const spec = registry[slug];
    if (!spec || hydrationAnswers.has(slug)) return;
    // Voyager can deliver the initial response as embedded JSON, without XHR.
    for (const node of document.querySelectorAll('code[id^="bpr-guid-"]')) {
        const text = node.textContent;
        if (!text || scannedPayloads.get(node) === text) continue;
        try {
            collectPuzzles(JSON.parse(text));
            scannedPayloads.set(node, text);
        } catch { /* Wait for the rest of a streamed JSON payload. */ }
    }
    const data = document.querySelector('#rehydrate-data');
    const chunks = window.__como_rehydration__;
    for (const text of [data?.textContent, Array.isArray(chunks) ? chunks.join('') : null]) {
        if (!text) continue;
        try {
            const answer = parseJsonValueForKey(text, spec.field);
            if (Array.isArray(answer) && answer.length) {
                hydrationAnswers.set(slug, answer);
                return;
            }
        } catch { /* The parser may still be streaming this element. */ }
    }
};
new MutationObserver(captureHydration).observe(document, { childList: true, subtree: true, characterData: true });
captureHydration();
const getAnswer = (slug) => {
    const spec = registry[slug];
    if (!spec) return null;
    captureHydration();
    const cached = puzzles.get(spec.key)?.[spec.field];
    if (cached) return cached;
    return hydrationAnswers.get(slug) || null;
};
window.LGH = Object.freeze({
    games: Object.keys(registry),
    waitingReason: slug => !getAnswer(slug)?.length ? '等待解答資料…' : '等待棋盤或開始遊戲…',
    ready: slug => Boolean(registry[slug] && document.querySelector(registry[slug].selector) && getAnswer(slug)?.length),
    solve: async slug => {
        const answer = getAnswer(slug);
        if (!answer?.length) throw new Error('找不到遊戲解答');
        await registry[slug].solve(answer);
    },
});
})();
