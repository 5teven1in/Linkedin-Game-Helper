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

const mouseDownUp = async (node) => {
    if (node) node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(delayBetweenEvents);
    if (node) node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
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
    for (const [idx, cell] of document.querySelectorAll(".lotka-cell").entries()) {
        if (cell.classList.contains("lotka-cell--locked")) continue;
        await sleep(delayBetweenEvents);
        const ans = answer[idx];
        if (ans === "ZERO") {
            mouseDownUp(cell);
        }
        else if (ans === "ONE") {
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
    await sleep(500);
    n += 1;
    for (const [idx, cell] of document.querySelectorAll(".queens-cell-with-border").entries()) {
        if (answer.find(x => x.row === Math.floor(idx / n) && x.col === (idx % n))) {
            await mouseDownUp(cell);
            await sleep(delayBetweenEvents);
            await mouseDownUp(cell);
        }
    }
}

const solverTrailGamePuzzle = async (answer) => {
    await sleep(1000);
    for (const ans of answer) {
        const cell = document.querySelector(`div[data-cell-idx="${ans}"]`);
        await mouseDownUp(cell);
        await sleep(10);
    }
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
                const n = Math.floor(gamePuzzle.lotkaGamePuzzle.solution.length ** 0.5);
                for (let i = 0; i < n; i++) console.log("[Game Bot]", gamePuzzle.lotkaGamePuzzle.solution.slice(n * i, n * i + n));
                onElementReady(".pr-game-web__aux-controls", () => {
                    if (document.querySelector(".games-share-footer__share-btn")) return;
                    solverLotkaGamePuzzle(gamePuzzle.lotkaGamePuzzle.solution);
                });
                break;
            case "miniSudokuGamePuzzle":
                for (let i = 0; i < 6; i++) console.log("[Game Bot]", gamePuzzle.miniSudokuGamePuzzle.solution.slice(6 * i, 6 * i + 6));
                onElementReady(".pr-game-web__aux-controls", () => {
                    if (document.querySelector(".games-share-footer__share-btn")) return;
                    solverMiniSudokuGamePuzzle(gamePuzzle.miniSudokuGamePuzzle.solution);
                });
                break;
            case "queensGamePuzzle":
                gamePuzzle.queensGamePuzzle.solution.forEach((x) => console.log("[Game Bot]", x.col));
                onElementReady(".pr-game-web__aux-controls", () => {
                    if (document.querySelector(".games-share-footer__share-btn")) return;
                    solverQueensGamePuzzle(gamePuzzle.queensGamePuzzle.solution);
                });
                break;
            case "trailGamePuzzle":
                console.log("[Game Bot] The solution of trailGamePuzzle is not here.");
                break;
        }
    }
});

let pollingTimeoutId = null;

const trySolveTrailGamePuzzle = () => {
    const targetElement = document.querySelector("#rehydrate-data");
    if (targetElement) {
        const match = targetElement.text.match(/"solution\\":(\[[\d,]+\])/);
        const answer = match ? JSON.parse(match[1]) : [];
        console.log("[Game Bot]", answer);
        solverTrailGamePuzzle(answer);
        clearTimeout(pollingTimeoutId);
        pollingTimeoutId = null;
    } else {
        pollingTimeoutId = setTimeout(trySolveTrailGamePuzzle, 200);
    }
}

const startPolling = () => {
    if (pollingTimeoutId === null) {
        trySolveTrailGamePuzzle();
    }
}

startPolling();