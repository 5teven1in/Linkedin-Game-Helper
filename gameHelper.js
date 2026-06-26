const overrideXhr = (window, callback) => {
    const _open = window.XMLHttpRequest.prototype.open;
    const _setRequestHeader = window.XMLHttpRequest.prototype.setRequestHeader;
    const REQUEST_HEADERS_PROP = 'chromane_request_headers';
    window.XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
        let headers = this[REQUEST_HEADERS_PROP];
        if (!headers) {
            headers = {};
            this[REQUEST_HEADERS_PROP] = headers;
        }
        headers[name] = value;
        return _setRequestHeader.apply(this, arguments);
    };
    window.XMLHttpRequest.prototype.open = function (method, requestUrl) {
        this.addEventListener('load', () => {
            const responseStatus = this.status;
            const responseType = this.responseType;
            const requestHeaders = this[REQUEST_HEADERS_PROP] || {};
            if (responseType === 'blob') {
                const blob = this.response;
                const reader = new FileReader();
                reader.onload = (event) => {
                    const response = event.target?.result;
                    const message = {
                        name: 'xhr_response_captured',
                        data: {
                            status: responseStatus,
                            responseText: response,
                            requestUrl: requestUrl,
                            responseUrl: this.responseURL,
                            requestHeaders: requestHeaders,
                        },
                    };
                    callback(message);
                };
                reader.readAsText(blob);
            }
        });
        return _open.apply(this, arguments);
    };
};

const onElementReady = (selector, callback) => {
    const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
            observer.disconnect();
            callback(el);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

const sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const delayBetweenEvents = 70;
const minPuzzleInteractionDurationMs = 1500;

const waitForMinimumElapsed = async (startedAt, minimumMs) => {
    const elapsed = performance.now() - startedAt;
    if (elapsed < minimumMs) {
        await sleep(minimumMs - elapsed);
    }
}

const mouseDownUp = async (node) => {
    if (node) node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(10);
    if (node) node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
}

const mouseEnterLeave = async (nodes) => {
    if (!nodes || nodes.length === 0) return;
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
        inps = el.querySelectorAll("input");
        ans = answer[idx].word;
        inps.forEach((inp, idx) => {
            if (inp.value) return;
            inp.value = ans[idx];
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
        });
    });
}

const solverLotkaGamePuzzle = async (answer) => {
    await sleep(2000);
    for (const [idx, ans] of answer.entries()) {
        await sleep(delayBetweenEvents);
        const cell = document.querySelector(`div[data-cell-idx="${idx}"]`);
        if (ans === "LotkaCellValue_ZERO") {
            mouseDownUp(cell);
        }
        else if (ans === "LotkaCellValue_ONE") {
            mouseDownUp(cell);
            await sleep(delayBetweenEvents);
            mouseDownUp(cell);
        }
    }
}

const solverMiniSudokuGamePuzzle = async (answer) => {
    for (const [idx, cell] of document.querySelectorAll(".sudoku-cell").entries()) {
        if (cell.classList.contains("sudoku-cell-prefilled")) continue;
        await sleep(delayBetweenEvents);
        mouseDownUp(cell);
        await sleep(delayBetweenEvents);
        document.querySelectorAll(".sudoku-input-button")[answer[idx] - 1].click();
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
        const block = ans.cellIdxes.map(idx => document.querySelector(`div[data-cell-idx="${idx}"]`));
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

    const valueStart = normalizedText.slice(colonIndex + 1).search(/[\[{]/);
    if (valueStart === -1) return null;

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

overrideXhr(window, (data) => {
    if (data.data.requestUrl.includes("queryId=voyagerIdentityDashGames.")) {
        const response_data = JSON.parse(data.data.responseText);
        if (response_data?.included?.[0] && "gamePuzzle" in response_data.included[0])
            console.log("[Game Bot] Detected game puzzle data.");
        else
            return;
        const gamePuzzle = response_data.included[0].gamePuzzle;
        const gameName = Object.keys(gamePuzzle).find(key => gamePuzzle[key] !== null);
        switch (gameName) {
            case "blueprintGamePuzzle":
                console.log("[Game Bot]", gamePuzzle.blueprintGamePuzzle.solutions[0]);
                onElementReady(".pr-game-web__aux-controls", () => {
                    if (document.querySelector(".games-share-footer__share-btn")) return;
                    solverBlueprintGamePuzzle(gamePuzzle.blueprintGamePuzzle.solutions[0]);
                });
                break;
            case "crossClimbGamePuzzle":
                gamePuzzle.crossClimbGamePuzzle.rungs.forEach((x) => console.log("[Game Bot]", x.word));
                onElementReady(".pr-game-web__aux-controls", async () => {
                    if (document.querySelector(".games-share-footer__share-btn")) return;
                    solverCrossClimbGamePuzzle(gamePuzzle.crossClimbGamePuzzle.rungs);
                    await sleep(2500);
                    solverCrossClimbGamePuzzle(gamePuzzle.crossClimbGamePuzzle.rungs);
                });
                break;
            case "lotkaGamePuzzle":
                console.log("[Game Bot] The solution of lotkaGamePuzzle is not here.");
                break;
            case "miniSudokuGamePuzzle":
                for (let i = 0; i < 6; i++) console.log("[Game Bot]", gamePuzzle.miniSudokuGamePuzzle.solution.slice(6 * i, 6 * i + 6));
                onElementReady(".pr-game-web__aux-controls", () => {
                    if (document.querySelector(".games-share-footer__share-btn")) return;
                    solverMiniSudokuGamePuzzle(gamePuzzle.miniSudokuGamePuzzle.solution);
                });
                break;
            case "queensGamePuzzle":
                console.log("[Game Bot] The solution of queensGamePuzzle is not here.");
                break;
            case "trailGamePuzzle":
                console.log("[Game Bot] The solution of trailGamePuzzle is not here.");
                break;
        }
    }
});

let pollingTimeoutId = null;

const trySolveGamePuzzle = () => {
    const targetElement = document.querySelector("#rehydrate-data");
    if (targetElement) {
        let answer = [];
        let match = null;
        const gameName = window.location.pathname.slice("/games/".length).split("/")[0];
        switch (gameName) {
            case "tango":
                match = targetElement.text.match(/"solution\\":(.*)}},\\"gameState\\"/);
                answer = match ? JSON.parse(match[1].replaceAll("\\", "")) : [];
                console.log("[Game Bot]", answer);
                solverLotkaGamePuzzle(answer);
                break;
            case "queens":
                match = targetElement.text.match(/"solution\\":(.*),\\"colorGrid\\"/);
                answer = match ? JSON.parse(match[1].replaceAll("\\", "")) : [];
                console.log("[Game Bot]", answer);
                solverQueensGamePuzzle(answer);
                break;
            case "zip":
                match = targetElement.text.match(/"solution\\":(.*),\\"walls\\"/);
                answer = match ? JSON.parse(match[1]) : [];
                console.log("[Game Bot]", answer);
                solverTrailGamePuzzle(answer);
                break;
            case "patches":
                match = targetElement.text.match(/"solution\\":(.*)}},\\"gameState\\"/);
                answer = match ? JSON.parse(match[1].replaceAll("\\", "")) : [];
                console.log("[Game Bot]", answer);
                solverPatchesGamePuzzle(answer);
                break;
            case "wend":
                answer = parseJsonValueForKey(targetElement.text, "solutionWords") || [];
                console.log("[Game Bot]", answer);
                solverWendGamePuzzle(answer);
                break;
            default:
                break;
        }
        clearTimeout(pollingTimeoutId);
        pollingTimeoutId = null;
    } else {
        pollingTimeoutId = setTimeout(trySolveGamePuzzle, 200);
    }
}

const startPolling = () => {
    if (pollingTimeoutId === null) {
        trySolveGamePuzzle();
    }
}

startPolling();
