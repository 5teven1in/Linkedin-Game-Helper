(() => {
    'use strict';
    const KEY = 'lgh.batch.v1';
    const { slugFor, isLobby, discover, valid, isResultLink } = window.LGHQueue;
    const games = window.LGH.games;
    const origin = location.origin;
    let state = null;
    let storageAvailable = true;
    try {
        const saved = JSON.parse(sessionStorage.getItem(KEY));
        if (valid(saved, origin, games, Date.now())) state = saved;
        else sessionStorage.removeItem(KEY);
    } catch { storageAvailable = false; }
    let panel, message, startButton, stopButton;
    let solving = false;
    let navigating = false;
    let enteredAt = Date.now();
    let clickedStart = false;
    let currentPath = location.pathname;
    let note = '';
    const save = () => {
        try { sessionStorage.setItem(KEY, JSON.stringify(state)); return true; }
        catch { storageAvailable = false; note = '無法儲存進度，請允許此網站的 sessionStorage。'; return false; }
    };
    const onResultsPage = () => Boolean(state?.active && isResultLink(location.href, state.queue[state.index].url));
    const resultDocuments = () => {
        const docs = [document];
        for (const frame of document.querySelectorAll('iframe')) {
            try {
                const url = new URL(frame.src, location.href);
                if (url.origin === origin && url.pathname === '/preload/' && frame.getClientRects().length && frame.contentDocument) {
                    docs.push(frame.contentDocument);
                }
            } catch { /* Cross-origin frames are not result evidence. */ }
        }
        return docs;
    };
    const complete = () => (onResultsPage() && resultDocuments().some(doc => Boolean(doc.querySelector('#pr-game-results-settings-btn')))) ||
        Boolean(document.querySelector('.games-share-footer__share-btn')) ||
        [...document.querySelectorAll('a[href]')].some(link =>
            link.getClientRects().length > 0 && isResultLink(link.href, location.href));
    const listGames = () => discover([...document.querySelectorAll('a[href]')].map(a => a.href), origin, games);
    const finish = (status, detail) => {
        if (!state?.active || navigating) return;
        navigating = true;
        state.results.push({ slug: state.queue[state.index].slug, status, detail });
        state.index++;
        state.active = state.index < state.queue.length;
        if (!save()) { state.active = false; return; }
        location.assign(state.active ? state.queue[state.index].url : state.home);
    };
    const mount = () => {
        if (panel?.isConnected || !document.body) return;
        panel = document.createElement('div');
        panel.id = 'lgh-controls';
        const shadow = panel.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = `
            :host{position:fixed;right:20px;bottom:20px;z-index:2147483647;font:14px/1.5 system-ui,sans-serif;color:#182536}
            section{width:min(320px,calc(100vw - 64px));padding:16px;border:1px solid #a8b9cc;border-radius:14px;background:white;box-shadow:0 6px 28px #0003}
            strong{font-size:16px} p{white-space:pre-line;max-height:35vh;overflow:auto;margin:10px 0}
            button{font:inherit;padding:9px 12px;border:0;border-radius:8px;background:#0a66c2;color:white;cursor:pointer;margin:4px 6px 0 0}
            button:disabled{opacity:.5;cursor:default} button:focus-visible{outline:3px solid #e89500;outline-offset:3px}
            #stop{background:#526173}[hidden]{display:none}
        `;
        const section = document.createElement('section');
        section.setAttribute('aria-label', 'LinkedIn Game Helper');
        const title = document.createElement('strong');
        title.textContent = 'LinkedIn Game Helper';
        message = document.createElement('p');
        message.setAttribute('role', 'status');
        message.setAttribute('aria-live', 'polite');
        startButton = document.createElement('button');
        startButton.id = 'start';
        startButton.textContent = '一鍵完成所有遊戲';
        stopButton = document.createElement('button');
        stopButton.id = 'stop';
        stopButton.textContent = '停止';
        section.append(title, message, startButton, stopButton);
        shadow.append(style, section);
        startButton.addEventListener('click', () => {
            if (state?.active) return;
            const queue = isLobby(location.pathname) ? listGames() : discover([location.href], origin, games);
            if (!queue.length) return;
            state = { active: true, queue, index: 0, results: [], startedAt: Date.now(),
                home: isLobby(location.pathname) ? origin + location.pathname : origin + '/games/' };
            if (!save()) { state.active = false; return; }
            // Navigation may take several ticks. Keep the lobby from cancelling the
            // newly persisted batch while the first game is still loading.
            navigating = true;
            // Reload even the current game to start from a fresh puzzle and network payload.
            location.assign(queue[0].url);
        });
        stopButton.addEventListener('click', () => {
            state.active = false;
            if (!save()) sessionStorage.removeItem(KEY);
            // A reload also cancels a solver already dispatching input events.
            location.reload();
        });
        document.body.append(panel);
    };
    const render = () => {
        const lobby = isLobby(location.pathname);
        const supported = games.includes(slugFor(location.pathname));
        if (!lobby && !supported && !state?.active) { if (panel) panel.hidden = true; return; }
        mount();
        if (!panel) return;
        panel.hidden = false;
        startButton.hidden = Boolean(state?.active);
        startButton.textContent = lobby ? '一鍵完成所有遊戲' : '完成此遊戲';
        startButton.disabled = !storageAvailable || (lobby && !listGames().length);
        stopButton.hidden = !state?.active;
        const results = state?.results.map(r => `${r.slug}：${r.status === 'completed' ? '已完成' : r.detail}`).join('\n') || '';
        const text = state?.active
            ? `進度 ${state.index + 1}/${state.queue.length}：${state.queue[state.index].slug}\n${solving ? '正在解題…' : (window.LGH.waitingReason?.(state.queue[state.index].slug) || '等待遊戲載入…')}`
            : note || (lobby ? `已找到 ${listGames().length} 個支援遊戲。按一下依序完成。` : '按一下自動完成此遊戲。');
        const nextText = text + (results ? '\n\n' + results : '');
        if (message.textContent !== nextText) message.textContent = nextText;
    };
    const tick = () => {
        if (navigating) return;
        if (currentPath !== location.pathname) {
            currentPath = location.pathname;
            enteredAt = Date.now();
            clickedStart = false;
        }
        render();
        if (!state?.active) return;
        if (slugFor(location.pathname) !== state.queue[state.index]?.slug && !onResultsPage()) {
            state.active = false;
            note = '頁面已變更，批次操作已停止。';
            save();
            if (solving) location.reload();
            return;
        }
        if (complete()) { finish('completed'); return; }
        if (Date.now() - enteredAt > 90000) { finish('failed', '逾時，未確認完成'); return; }
        if (onResultsPage()) return;
        if (solving) return;
        if (!clickedStart) {
            const button = [...document.querySelectorAll('button')].find(el =>
                !el.disabled && el.getClientRects().length && /^(play|start|play now|start game|resume|continue game|開始|開始遊戲|玩遊戲|立即玩|繼續|繼續遊戲)$/i.test(el.textContent.trim()));
            if (button) { clickedStart = true; button.click(); return; }
        }
        const slug = state.queue[state.index].slug;
        if (window.LGH.ready(slug)) {
            solving = true;
            window.LGH.solve(slug).catch(error => {
                console.warn('[LGH] Solver failed:', error);
                finish('failed', '解題失敗，未確認完成');
            });
            // Keep solving=true until a confirmed result or timeout; never apply a solution twice.
            return;
        }

    };
    setInterval(tick, 400);
    tick();
})();
