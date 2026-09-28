// Visits: one row per proof-of-work visit instead of one per post.
//
// Epoch 6 rule (telegram-bot bot.py, classify_post): a project's first post at
// a merchant in an ISO week (UTC) is the "primary"; the same visit posted on
// the other platform that week is a "duplicate". So project + merchant + ISO
// week identifies one visit, holding at most one post per platform.
//
// Epoch 5 and older carry no classification, so their pairs are inferred: the
// nearest X and Nostr posts by the same project at the same merchant, at most
// PAIR_WINDOW_HOURS apart, each post used once. Most real pairs are minutes
// apart; the window stops a project's next-day visit from being folded in.
// Epoch 4 posts have a date only (read as midnight), so the same rule pairs
// them by day: same day is 0 hours apart, any other day at least 24.
(function () {
    const PLATFORMS = ['X', 'Nostr'];
    const PAIR_WINDOW_HOURS = 12;

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
    const merchantKey = sub => String(sub.merchant_name || '').trim().toLowerCase();
    const timeOf = sub => new Date(String(sub.timestamp).replace(' UTC', 'Z').replace(' ', 'T')).getTime();

    function newVisit(sub) {
        return { project: sub.project_name, merchant: sub.merchant_name, first: sub.timestamp, links: {}, posts: [] };
    }

    function addPost(visit, sub) {
        const platform = platformOf(sub);
        if (!visit.links[platform]) visit.links[platform] = sub.post_url;
        visit.posts.push(sub);
        if (String(sub.timestamp) < String(visit.first)) visit.first = sub.timestamp;
    }

    window.groupVisits = function (submissions) {
        const byKey = new Map();
        const visits = [];
        const unlabelled = new Map();   // project|merchant -> posts, paired by time below

        (submissions || []).forEach(sub => {
            if (sub.classification === 'primary' || sub.classification === 'duplicate') {
                const key = [sub.project_name, merchantKey(sub), isoWeek(sub.timestamp)].join('|');
                let visit = byKey.get(key);
                if (!visit) { visit = newVisit(sub); byKey.set(key, visit); visits.push(visit); }
                addPost(visit, sub);
            } else {
                const key = [sub.project_name, merchantKey(sub)].join('|');
                (unlabelled.get(key) || unlabelled.set(key, []).get(key)).push(sub);
            }
        });

        // Closest X-Nostr pairs first, so each post joins its nearest partner
        const limit = PAIR_WINDOW_HOURS * 60 * 60 * 1000;
        unlabelled.forEach(posts => {
            const xs = posts.filter(s => platformOf(s) === 'X');
            const ns = posts.filter(s => platformOf(s) === 'Nostr');
            const candidates = [];
            xs.forEach((x, i) => ns.forEach((n, j) => {
                const gap = Math.abs(timeOf(x) - timeOf(n));
                if (gap <= limit) candidates.push([gap, i, j]);
            }));
            candidates.sort((a, b) => a[0] - b[0]);
            const usedX = new Set(), usedN = new Set();
            candidates.forEach(([, i, j]) => {
                if (usedX.has(i) || usedN.has(j)) return;
                usedX.add(i); usedN.add(j);
                const visit = newVisit(xs[i]);
                addPost(visit, xs[i]); addPost(visit, ns[j]);
                visits.push(visit);
            });
            xs.forEach((x, i) => { if (!usedX.has(i)) { const v = newVisit(x); addPost(v, x); visits.push(v); } });
            ns.forEach((n, j) => { if (!usedN.has(j)) { const v = newVisit(n); addPost(v, n); visits.push(v); } });
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
