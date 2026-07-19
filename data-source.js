/**
 * Where live dashboard data comes from.
 *
 * Two sources, deliberately:
 *
 *   PRIMARY   https://api.powbot.africa/data/   regenerated every 5 minutes
 *                                               straight from the bot's database
 *   FALLBACK  same-origin (GitHub Pages)        published hourly via git
 *
 * The fallback is the point, not an afterthought. Before this, the dashboard
 * survived the VPS being down for free, because its data was baked into a static
 * site on GitHub's CDN. Fetching from a single 3.44 EUR/month box that also runs
 * the bot, the profile API and Caddy would throw that away - unless a failure
 * quietly lands back on the repo copy. Stale numbers beat an empty page.
 *
 * ONLY the two genuinely live files are routed through the VPS. members.json and
 * the frozen stats-epoch*.json / tracker-data-epoch5.json archives change via git
 * anyway, so sending them through the VPS would add a dependency for no
 * freshness - and would mean a VPS outage took out the member directory and all
 * history too, not just current-epoch numbers.
 */

const DATA_BASE = 'https://api.powbot.africa/data/';

// How long to wait on the VPS before giving up and using the repo copy. A host
// that hangs is worse than one that refuses - without this, an unreachable box
// would leave the dashboard spinning instead of falling back.
const DATA_TIMEOUT_MS = 4000;

/**
 * Fetch a live data file, preferring the VPS and falling back to the repo copy.
 * Returns parsed JSON. Throws only if BOTH sources fail.
 */
async function fetchLiveData(filename) {
    const bust = 't=' + Date.now();

    // 1. Try the VPS.
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), DATA_TIMEOUT_MS);
        try {
            const res = await fetch(DATA_BASE + filename + '?' + bust, {
                signal: controller.signal,
                cache: 'no-store'
            });
            if (res.ok) {
                return await res.json();
            }
            console.warn('[data] ' + filename + ': VPS returned ' + res.status + ', falling back');
        } finally {
            clearTimeout(timer);
        }
    } catch (err) {
        console.warn('[data] ' + filename + ': VPS unreachable (' + err.name + '), falling back');
    }

    // 2. Fall back to the copy published in this repo.
    const res = await fetch(filename + '?' + bust);
    if (!res.ok) {
        throw new Error('Both sources failed for ' + filename + ' (repo returned ' + res.status + ')');
    }
    return await res.json();
}

// Available to inline page scripts and to tracker.js alike.
window.fetchLiveData = fetchLiveData;
