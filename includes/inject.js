/**
 * Shared Header/Footer Injection
 * Loads common nav and footer from includes/ directory
 */

(function() {
    'use strict';

    const SUPPORT_URL = 'https://t.me/bitcoinubuntu';

    /**
     * Screen effects (the footer switch): the screen's texture, the shadow
     * under pixel type, and the globe's motion. Off puts .fx-off on <html>,
     * and the choice is remembered in this browser. Storage can be blocked
     * (private windows, strict settings), so every read and write is guarded
     * and the default is on. Applied straight away, before the includes load.
     */
    const FX_KEY = 'pb-screen-effects';
    let fxSaved = null;
    try { fxSaved = localStorage.getItem(FX_KEY); } catch (e) { /* default: on */ }
    if (fxSaved === 'off') document.documentElement.classList.add('fx-off');

    function showFx(on) {
        document.querySelectorAll('.fx-toggle').forEach(button => {
            button.setAttribute('aria-checked', String(on));
            const state = button.querySelector('.fx-state');
            if (state) state.textContent = on ? 'on' : 'off';
        });
    }

    function setFx(on) {
        document.documentElement.classList.toggle('fx-off', !on);
        try {
            if (on) localStorage.removeItem(FX_KEY);
            else localStorage.setItem(FX_KEY, 'off');
        } catch (e) { /* works for this visit, just not remembered */ }
        showFx(on);
        // The globe (globe.js) listens, to stop or restart its motion
        document.dispatchEvent(new CustomEvent('pb:fx', { detail: { on } }));
    }

    /**
     * Light or dark (the header switch). Dark is the default; light, once
     * chosen, is kept in this browser and applied before the first paint by
     * a snippet in each page's <head>. Choosing dark again clears it. The
     * browser's own bar colour (theme-color) follows too.
     */
    const THEME_KEY = 'pb-theme';
    const themeNow = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

    function showTheme() {
        const root = document.documentElement;
        const dark = themeNow() === 'dark';
        document.querySelectorAll('.theme-toggle').forEach(button => {
            button.setAttribute('aria-pressed', String(dark));
            button.title = dark ? 'Switch to light' : 'Switch to dark';
        });
        // The page's own colour for the browser's bar: the olive tag's colour
        // by default, the glass once light is chosen
        const night = getComputedStyle(root).getPropertyValue('--night').trim();
        document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
            if (meta.dataset.own === undefined) meta.dataset.own = meta.getAttribute('content');
            meta.setAttribute('content', !dark && night ? night : meta.dataset.own);
        });
    }

    function setTheme(mode) {
        const root = document.documentElement;
        try {
            if (mode === 'light') localStorage.setItem(THEME_KEY, 'light');
            else localStorage.removeItem(THEME_KEY);
        } catch (e) { /* works for this visit, just not remembered */ }
        if (mode === 'light') root.dataset.theme = 'light';
        else delete root.dataset.theme;
        showTheme();
        // The globe (globe.js) listens, to redraw in the new colours
        document.dispatchEvent(new CustomEvent('pb:theme', { detail: { mode } }));
    }

    function setupTheme(nav) {
        const button = nav && nav.querySelector('.theme-toggle');
        if (!button) return;
        showTheme();
        button.addEventListener('click', () => setTheme(themeNow() === 'dark' ? 'light' : 'dark'));
    }

    function setupFx(footer) {
        const button = footer && footer.querySelector('.fx-toggle');
        if (!button) return;
        showFx(!document.documentElement.classList.contains('fx-off'));
        button.addEventListener('click', () => setFx(document.documentElement.classList.contains('fx-off')));
    }

    /**
     * Load and inject navigation
     */
    async function loadNav() {
        const navContainer = document.getElementById('site-nav');
        if (!navContainer) return;

        try {
            const response = await fetch('includes/nav.html');
            const html = await response.text();
            navContainer.innerHTML = html;

            // Highlight current page
            highlightCurrentPage();

            // On a page with a parent, the wordmark goes back there
            setupBack(navContainer.querySelector('.site-nav .brand'));

            // Phone menu button
            setupMenu(navContainer.querySelector('.site-nav'));

            // Light or dark switch
            setupTheme(navContainer.querySelector('.site-nav'));
        } catch (error) {
            console.error('Failed to load navigation:', error);
        }
    }

    /**
     * Load and inject footer
     */
    async function loadFooter() {
        const footerContainer = document.getElementById('site-footer');
        if (!footerContainer) return;

        try {
            const response = await fetch('includes/footer.html');
            const html = await response.text();
            footerContainer.innerHTML = html;
            setupFx(footerContainer);

            // Update timestamp for all pages
            await updateTimestamp();
        } catch (error) {
            console.error('Failed to load footer:', error);
        }
    }

    /**
     * Update the timestamp in footer with latest stats data
     */
    async function updateTimestamp() {
        const updatedElement = document.getElementById('updated');
        if (!updatedElement) return;

        try {
            // Fetch the latest stats to get generated_at timestamp.
            // Cache-bust: without it the browser serves a stale stats.json and the
            // footer reports an old "Data updated" time on every page.
            //
            // The export regenerates this file every 5 minutes on the VPS. The
            // copy in this repo is only refreshed twice daily, because it is the
            // fallback rather than the live source - so the timestamp shown
            // depends on which one fetchLiveData reached.
            // Use fetchLiveData when the page has loaded data-source.js - it
            // prefers the VPS (regenerated every 5 min) and falls back to this
            // repo's twice-daily copy, so the footer shows the freshest
            // timestamp available. Otherwise fetch same-origin as before.
            //
            // inject.js is loaded by ELEVEN pages, most of which have no reason to
            // pull in data-source.js. Shared code must not assume an optional
            // dependency is present, or adding one here silently breaks the footer
            // everywhere else.
            const stats = (typeof fetchLiveData === 'function')
                ? await fetchLiveData('stats.json')
                : await (await fetch('stats.json?t=' + Date.now())).json();

            if (stats && stats.generated_at) {
                updatedElement.textContent = new Date(stats.generated_at).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC';
            }
        } catch (error) {
            console.error('Failed to update timestamp:', error);
            // Leave as "--" if we can't fetch stats
        }
    }

    /**
     * Highlight the current page in navigation
     */
    function highlightCurrentPage() {
        const currentPage = getCurrentPage();
        const links = document.querySelectorAll('nav a[data-page]');

        links.forEach(link => {
            const page = link.getAttribute('data-page');
            if (page === currentPage) {
                link.classList.add('current');
                link.setAttribute('aria-current', 'page');
            }
        });
    }

    /**
     * The wordmark's link goes home, except on the pages people reach from
     * elsewhere on the site (a profile, a merchant, a finished epoch, the
     * directory or tracker opened filtered, About and the other footer pages;
     * see DRILLDOWNS and ASIDES). There
     * it shows the back arrow in place of the bot head and goes back where
     * the visitor came from, or, arriving from outside the site, to the
     * page's parent below. It says where it goes (aria-label, and a tooltip).
     * Pages are matched by name, with or without ".html".
     */
    const PARENTS = {
        'profile': () => ({ href: 'members.html', label: 'Back to the directory' }),
        'profile-edit': () => {
            const id = new URLSearchParams(location.search).get('id');
            return id
                ? { href: 'profile.html?id=' + encodeURIComponent(id), label: 'Back to the profile' }
                : { href: 'members.html', label: 'Back to the directory' };
        },
        'merchant-profile': () => ({ href: 'index.html#merchants-title', label: 'Back to the merchants' }),
        'epoch5': () => ({ href: 'archive.html', label: 'Back to the archive' })
    };

    // Top-level pages that another page can open filtered: the directory for
    // one country, the tracker for one project. Opened that way from a page of
    // this site, they're a drill-down and get the back arrow too. Plain, or
    // arriving from outside, they keep the bot head.
    const DRILLDOWNS = ['members', 'tracker'];
    // Pages opened from the footer or a link on another page: from a page of
    // this site they get the back arrow; arriving from outside, the bot head
    const ASIDES = ['about', 'disclaimer'];

    // What to call each page in "Back to ..."
    const PAGE_NAMES = {
        index: 'the stats', members: 'the directory', tracker: 'the tracker', archive: 'the archive',
        epoch5: 'Epoch 5', profile: 'the profile', 'merchant-profile': 'the merchant',
        about: 'About', guidelines: 'the guidelines', disclaimer: 'the disclaimer'
    };
    const pageOf = path => path.split('/').pop().replace(/\.html$/, '') || 'index';

    // The page of this site the visitor came from, if any (not this page itself)
    function sitePageBefore() {
        let from;
        try { from = new URL(document.referrer); } catch (e) { return null; }
        if (from.origin !== location.origin) return null;
        if (from.pathname === location.pathname && from.search === location.search) return null;
        return PAGE_NAMES[pageOf(from.pathname)] ? from : null;
    }

    function setupBack(brand) {
        const page = pageOf(location.pathname);
        if (!brand) return;
        const from = sitePageBefore();
        const drilldown = from && ((DRILLDOWNS.includes(page) && location.search.length > 1) || ASIDES.includes(page));
        if (!PARENTS[page] && !drilldown) return;
        let { href, label } = PARENTS[page] ? PARENTS[page]() : {};
        // Never back into a page's own editor (profile -> edit -> profile)
        const origin = from && !(page === 'profile' && pageOf(from.pathname) === 'profile-edit') ? from : null;
        if (origin) {
            href = origin.href;
            label = `Back to ${PAGE_NAMES[pageOf(origin.pathname)]}`;
            // A plain click steps back in history, which also restores the
            // place on that page; opening in a new tab still follows the link
            brand.addEventListener('click', event => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                if (history.length > 1) { event.preventDefault(); history.back(); }
            });
        }
        brand.href = href;
        brand.setAttribute('aria-label', label);
        brand.title = label;
        brand.classList.add('is-back');
    }

    /**
     * Phone menu: the nav links fold behind a button below 820px.
     * A disclosure (button + aria-expanded), not an ARIA menu: the links stay
     * ordinary links in the tab order once the panel is open.
     */
    function setupMenu(nav) {
        if (!nav) return;
        const button = nav.querySelector('.nav-toggle');
        const panel = nav.querySelector('.nav-links');
        if (!button || !panel) return;

        function setOpen(open, { returnFocus = false } = {}) {
            nav.classList.toggle('is-open', open);
            button.setAttribute('aria-expanded', String(open));
            if (!open && returnFocus) button.focus();
        }

        button.addEventListener('click', (event) => {
            // detail is 0 when Enter or Space fired the click. Keyboard opens
            // skip the animation; it would only delay the next key press.
            nav.classList.toggle('no-anim', event.detail === 0);
            setOpen(!nav.classList.contains('is-open'));
        });

        // Choosing a link closes the panel (matters for same-page links)
        panel.addEventListener('click', (event) => {
            if (event.target.closest('a')) setOpen(false);
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && nav.classList.contains('is-open')) {
                setOpen(false, { returnFocus: true });
            }
        });

        // A tap anywhere outside the nav closes it
        document.addEventListener('click', (event) => {
            if (nav.classList.contains('is-open') && !nav.contains(event.target)) setOpen(false);
        });

        // Widening past phone size shows the links inline; reset the state
        // Keep in step with the nav's breakpoint in css/powbot.css
        const wide = window.matchMedia('(min-width: 820px)');
        const reset = () => { if (wide.matches) setOpen(false); };
        if (wide.addEventListener) wide.addEventListener('change', reset);
    }

    /**
     * Get current page identifier from URL
     */
    function getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.substring(path.lastIndexOf('/') + 1);

        // Map filenames to page identifiers (only for pages in nav)
        if (filename === '' || filename === 'index.html') return 'index';
        if (filename.startsWith('members')) return 'members';
        if (filename.startsWith('profile')) return 'members'; // Profile pages highlight Directory
        if (filename.startsWith('archive')) return 'archive';
        if (filename.startsWith('tracker')) return 'tracker';
        if (filename.startsWith('guidelines')) return 'guidelines';

        return null;
    }


    /**
     * Back (or forward) to a page whose content draws after its data loads,
     * like the homepage or the directory: the browser restores the scroll
     * position before that content exists, and lands at the top. So remember
     * the position on leaving, and on a back or forward visit return to it
     * once the page is tall enough. Stops if the visitor scrolls first, and
     * after 8 seconds.
     */
    (function keepPlaceOnReturn() {
        const key = 'pb-scroll:' + location.pathname + location.search;
        window.addEventListener('pagehide', () => {
            try { sessionStorage.setItem(key, String(Math.round(window.scrollY))); } catch (e) { /* not remembered */ }
        });
        const visit = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
        if (!visit || visit.type !== 'back_forward' || !window.ResizeObserver) return;
        let y = 0;
        try { y = Number(sessionStorage.getItem(key)) || 0; } catch (e) { return; }
        if (y <= 0) return;

        const inputs = ['wheel', 'touchstart', 'keydown', 'mousedown'];
        const watcher = new ResizeObserver(tryScroll);
        const timer = setTimeout(stop, 8000);
        function stop() {
            watcher.disconnect();
            clearTimeout(timer);
            inputs.forEach(type => window.removeEventListener(type, stop));
        }
        function tryScroll() {
            if (document.documentElement.scrollHeight - window.innerHeight < y) return;
            window.scrollTo(0, y);
            stop();
        }
        inputs.forEach(type => window.addEventListener(type, stop, { passive: true }));
        watcher.observe(document.body);
        tryScroll();
    })();

    /**
     * Collapsing a long list ("Show fewer", "Show top 10") removes rows above
     * the button, which would leave the reader floating far down the page.
     * Keep the button at the same place on screen instead: note where it is
     * before the page's own handler runs (capture phase, first) and scroll by
     * however far it moved once every handler has run (window bubble, last).
     * Expanding needs nothing: new rows appear below where you are reading.
     */
    const COLLAPSE_BUTTONS = '#lb-all, .list-more, .lb-more, .posts-more';
    let keepPlace = null;

    window.addEventListener('click', (event) => {
        const button = event.target.closest && event.target.closest(COLLAPSE_BUTTONS);
        keepPlace = (button && button.getAttribute('aria-expanded') === 'true')
            ? { button, top: button.getBoundingClientRect().top }
            : null;
    }, true);

    window.addEventListener('click', () => {
        if (!keepPlace) return;
        const { button, top } = keepPlace;
        keepPlace = null;
        if (!document.contains(button)) return;
        const moved = button.getBoundingClientRect().top - top;
        if (Math.abs(moved) > 1) window.scrollBy({ top: moved, left: 0, behavior: 'instant' });
    });

    /**
     * Leaderboard rows open from anywhere on the row, not only the name. The
     * name stays the real control (a button, for keyboards and screen
     * readers); a click elsewhere on the row presses it. Links and other
     * controls inside the row keep their own clicks, and selecting text in
     * the row doesn't toggle it.
     */
    document.addEventListener('click', (event) => {
        const row = event.target.closest && event.target.closest('.lb tr.lb-row');
        if (!row || event.target.closest('a, button, input, select, textarea, label')) return;
        if (String(window.getSelection && window.getSelection())) return;
        const toggle = row.querySelector('.row-toggle');
        if (toggle) toggle.click();
    });

    /**
     * Bar charts (.bars) read out one day at a time in the line above them
     * (.bars-readout): hover or drag, tap, or focus the chart and use the arrow
     * keys, Home and End. Each bar carries its text in data-label. The day is
     * picked by horizontal position, so thin bars on a phone are easy to hit.
     * Delegated from the document: charts are drawn after the data loads.
     */
    function barsParts(chart) {
        const bars = Array.from(chart.querySelectorAll('i[data-label]'));
        const readout = chart.previousElementSibling && chart.previousElementSibling.classList.contains('bars-readout')
            ? chart.previousElementSibling : null;
        if (readout && readout.dataset.initial === undefined) readout.dataset.initial = readout.textContent;
        return { bars, readout };
    }

    function selectBar(chart, index) {
        const { bars, readout } = barsParts(chart);
        if (!bars.length) return;
        const i = Math.max(0, Math.min(bars.length - 1, index));
        bars.forEach((bar, n) => bar.classList.toggle('sel', n === i));
        chart.dataset.sel = String(i);
        if (readout) readout.textContent = bars[i].dataset.label;
    }

    function clearBar(chart) {
        const { bars, readout } = barsParts(chart);
        bars.forEach(bar => bar.classList.remove('sel'));
        delete chart.dataset.sel;
        if (readout) readout.textContent = readout.dataset.initial;
    }

    function barAt(chart, clientX) {
        const { bars } = barsParts(chart);
        const box = chart.getBoundingClientRect();
        return Math.floor((clientX - box.left) / box.width * bars.length);
    }

    document.addEventListener('pointermove', (event) => {
        const chart = event.target.closest && event.target.closest('.bars');
        if (chart) selectBar(chart, barAt(chart, event.clientX));
    });
    document.addEventListener('pointerdown', (event) => {
        const chart = event.target.closest && event.target.closest('.bars');
        if (chart) selectBar(chart, barAt(chart, event.clientX));
        // Tapping anywhere else puts other charts back to their first line
        document.querySelectorAll('.bars[data-sel]').forEach(other => { if (other !== chart) clearBar(other); });
    });
    document.addEventListener('pointerout', (event) => {
        // A finger lifting also counts as "leaving": keep a tapped day on screen
        if (event.pointerType === 'touch') return;
        const chart = event.target.closest && event.target.closest('.bars');
        // Only when the pointer really leaves the chart, and not while it has keyboard focus
        if (chart && !chart.contains(event.relatedTarget) && document.activeElement !== chart) clearBar(chart);
    });
    document.addEventListener('keydown', (event) => {
        const chart = event.target.closest && event.target.closest('.bars');
        if (!chart) return;
        const { bars } = barsParts(chart);
        const current = chart.dataset.sel !== undefined ? Number(chart.dataset.sel) : bars.length - 1;
        const next = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: bars.length - 1 }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        selectBar(chart, next);
    });
    document.addEventListener('focusout', (event) => {
        const chart = event.target.closest && event.target.closest('.bars');
        if (chart) clearBar(chart);
    });

    /**
     * Section tabs (.subtabs, "On this page"): the tab for the section being
     * read gets aria-current, and CSS draws it [in brackets]. Sections can
     * render after the data loads, so the targets are looked up on every
     * check rather than once. A section counts as being read once its heading
     * has passed just under the sticky bars.
     */
    function setupSubtabs() {
        const bar = document.querySelector('.subtabs');
        if (!bar) return;
        const links = Array.from(bar.querySelectorAll('a[href^="#"]'));
        let queued = false;

        function update() {
            queued = false;
            const nav = document.getElementById('site-nav');
            const line = Math.max(nav ? nav.getBoundingClientRect().bottom : 0, bar.getBoundingClientRect().bottom) + 24;
            const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
            let current = links[0], currentTop = -Infinity;
            for (const link of links) {
                const target = document.getElementById(link.hash.slice(1));
                if (!target) continue;
                const top = target.getBoundingClientRect().top;
                // At the very bottom, the last section on screen counts even if
                // short. Headings side by side sit level: the first keeps the tab.
                if ((top <= line || (atEnd && top < window.innerHeight)) && top > currentTop + 1) {
                    current = link;
                    currentTop = top;
                }
            }
            links.forEach(link => {
                if (link === current) link.setAttribute('aria-current', 'true');
                else link.removeAttribute('aria-current');
            });
        }
        function queue() {
            if (queued) return;
            queued = true;
            requestAnimationFrame(update);
        }
        window.addEventListener('scroll', queue, { passive: true });
        window.addEventListener('resize', queue);
        // Sections fill in once the data loads: look again when the page grows
        // (a short page still loading counts as "at the end" otherwise)
        if (window.ResizeObserver) new ResizeObserver(queue).observe(document.body);
        update();
    }
    setupSubtabs();

    // Export support URL for use in other scripts
    window.SUPPORT_URL = SUPPORT_URL;

    // Export promise that resolves when includes are loaded
    window.includesLoaded = Promise.all([
        loadNav(),
        loadFooter()
    ]);

    // Load nav and footer when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            await window.includesLoaded;
        });
    }
})();
