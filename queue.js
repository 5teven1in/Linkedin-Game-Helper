((root) => {
    'use strict';
    const slugFor = path => path.match(/^\/games?\/([^/]+)\/?$/)?.[1] || null;
    const isLobby = path => /^\/games?\/?$/.test(path);
    const discover = (links, origin, supported) => {
        const seen = new Set();
        return links.flatMap(href => {
            try {
                const url = new URL(href, origin);
                const slug = slugFor(url.pathname);
                if (url.origin !== origin || !supported.includes(slug) || seen.has(slug)) return [];
                seen.add(slug);
                return [{ slug, url: url.origin + url.pathname }];
            } catch { return []; }
        });
    };
    // Completed boards expose a "View results" link when revisited, even when
    // the share footer is absent. Only accept the current game's result URL.
    const isResultLink = (href, currentUrl) => {
        try {
            const current = new URL(currentUrl);
            if (!slugFor(current.pathname)) return false;
            const target = new URL(href, current);
            return target.origin === current.origin &&
                target.pathname.replace(/\/$/, '') === current.pathname.replace(/\/$/, '') + '/results';
        } catch { return false; }
    };
    const valid = (state, origin, supported, now = Date.now()) => Boolean(
        state && Array.isArray(state.queue) && state.queue.length > 0 &&
        state.queue.length <= supported.length &&
        Number.isInteger(state.index) && state.index >= 0 && state.index <= state.queue.length &&
        typeof state.active === 'boolean' && (!state.active || state.index < state.queue.length) && Array.isArray(state.results) &&
        Number.isFinite(state.startedAt) && now >= state.startedAt && now - state.startedAt < 30 * 60 * 1000 &&
        state.queue.every(item => discover([item.url], origin, supported)[0]?.slug === item.slug) &&
        new Set(state.queue.map(item => item.slug)).size === state.queue.length &&
        (() => { try { const url = new URL(state.home); return url.origin === origin && isLobby(url.pathname); } catch { return false; } })()
    );
    const api = { slugFor, isLobby, discover, valid, isResultLink };
    if (typeof module !== 'undefined') module.exports = api;
    else root.LGHQueue = Object.freeze(api);
})(globalThis);
