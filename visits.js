// Visits: one row per proof-of-work visit instead of one per post.
//
// Epoch 6 rule (telegram-bot bot.py, classify_post): a project's first post at
// a merchant in an ISO week (UTC) is the "primary"; the same visit posted on
// the other platform that week is a "duplicate". So project + merchant + ISO
// week identifies one visit, holding at most one post per platform.
//
// Posts with no classification (Epoch 5 and older, where every post stood on
// its own) are never paired: each is its own visit.
(function () {
    const PLATFORMS = ['X', 'Nostr'];

    function platformOf(sub) {
        const p = String(sub.platform || '').toLowerCase();
        if (p === 'x' || p === 'twitter') return 'X';
        if (p === 'nostr') return 'Nostr';
        const url = String(sub.post_url || '').toLowerCase();
        return url.includes('x.com') || url.includes('twitter.com') ? 'X' : 'Nostr';
    }

    // "2026-09-28 18:35:12 UTC" -> "2026-W39"
    function isoWeek(ts) {
        const d = new Date(String(ts).slice(0, 10) + 'T00:00:00Z');
        const day = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - day);           // Thursday of this week
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
        return `${d.getUTCFullYear()}-W${week}`;
    }

    // Tracker submissions -> visits, newest first. Pass approved posts only.
    // Each visit: { project, merchant, first (earliest timestamp), links: {X, Nostr}, posts }
    window.groupVisits = function (submissions) {
        const byKey = new Map();
        const visits = [];
        (submissions || []).forEach(sub => {
            const paired = sub.classification === 'primary' || sub.classification === 'duplicate';
            const key = paired
                ? [sub.project_name, String(sub.merchant_name || '').trim().toLowerCase(), isoWeek(sub.timestamp)].join('|')
                : null;
            let visit = key ? byKey.get(key) : null;
            if (!visit) {
                visit = { project: sub.project_name, merchant: sub.merchant_name, first: sub.timestamp, links: {}, posts: [] };
                if (key) byKey.set(key, visit);
                visits.push(visit);
            }
            const platform = platformOf(sub);
            if (!visit.links[platform]) visit.links[platform] = sub.post_url;
            visit.posts.push(sub);
            if (String(sub.timestamp) < String(visit.first)) visit.first = sub.timestamp;
        });
        return visits.sort((a, b) => String(b.first).localeCompare(String(a.first)));
    };

    const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

    // The X and Nostr links for a visit, always in the same two slots so they
    // line up down a list. `context` names the visit for screen readers
    // ("Bitbiashara at Flo Salon"), since the visible text is only "X".
    window.visitLinks = function (visit, context) {
        const slots = PLATFORMS.map(p => visit.links[p]
            ? `<a class="visit-link" href="${attr(visit.links[p])}" target="_blank" rel="noopener" aria-label="Watch on ${p}${context ? ': ' + attr(context) : ''}">${p}</a>`
            : '<span class="visit-link is-empty" aria-hidden="true"></span>');
        return `<span class="visit-links">${slots.join('')}</span>`;
    };
})();
