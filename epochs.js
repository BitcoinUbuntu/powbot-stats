/**
 * Every finished epoch, in one place, and the "Every epoch so far" block that
 * the homepage, the Epoch 5 page and the archive all draw from it.
 *
 * ==> TO ADD CONTEXT: give an epoch a `note` (one short sentence, plain
 *     text). It shows under that epoch's bar on every page. <==
 * ==> AT EACH EPOCH ROLLOVER: add the finished epoch here with its final
 *     approved-post total, and point `href` at its page or archive section. <==
 *
 * Totals are posts approved and are frozen once an epoch ends.
 */
(function () {
    'use strict';

    // Each note says how that epoch's rules differed: the ground rules (a real
    // payment, the merchant receiving sats directly) have held since Epoch 1.
    window.POWBOT_EPOCHS = [
        { name: 'Epoch 1', when: 'May 2025', posts: 81, href: 'archive.html#epoch-1',
            note: 'Proof-of-work videos begin, an idea from Hermann of Bitcoin Ekasi: film a real bitcoin payment at a merchant who receives the sats directly. Every post checked by hand.' },
        { name: 'Epoch 2', when: 'Aug 2025', posts: 298, href: 'archive.html#epoch-2',
            note: 'The same ground rules, with posts on Nostr as well as X. Still checked by hand.' },
        { name: 'Epoch 3', when: 'Nov 2025', posts: 604, href: 'archive.html#epoch-3',
            note: 'The last epoch checked by hand. The bot’s first trial followed in December.' },
        { name: 'Epoch 4', when: 'Dec 2025 to Mar 2026', posts: 187 + 1697, href: 'archive.html#epoch-4',
            note: 'The bot takes over: #spedn, a BTCMap link, the merchant’s Lightning address, a fixed location and the required video scenes. No posting limits.' },
        { name: 'Epoch 5', when: 'Mar to Jul 2026', posts: 1985, href: 'epoch5.html',
            note: 'The first limits: one post per merchant per platform a day, and from 7 April at most five merchants a day.' }
    ];

    // Shown with every copy of the block
    const RULES_NOTE = 'Each epoch ran under its own rules and reward guidelines, so the totals show how PoWBoT has grown rather than a like-for-like comparison.';

    const esc = (text) => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const num = (n) => Number(n || 0).toLocaleString('en-GB');

    /**
     * HTML for the block.
     *   id       heading id
     *   title    heading text
     *   intro    HTML sentence(s) before the rules note (the page's own summary)
     *   epochs   list to draw (defaults to POWBOT_EPOCHS)
     *   current  name of the epoch this page is about: solid bar, aria-current
     *   live     optional { name, when, posts, href, note } appended at the end
     */
    window.renderEpochBars = function ({ id = 'epochs-title', title = 'Every epoch so far', intro = '', epochs = window.POWBOT_EPOCHS, current = '', live = null } = {}) {
        const all = epochs.concat(live ? [Object.assign({ live: true }, live)] : []);
        const max = Math.max(1, ...all.map(e => e.posts || 0));

        const rows = all.map(e => {
            const isCurrent = e.live || e.name === current;
            const label = `${esc(e.name)}, ${esc(e.when)}: ${num(e.posts)} posts approved`;
            return `
                <li class="hb${isCurrent ? ' current' : ''}">
                    <a class="hb-row" href="${esc(e.href)}"${isCurrent && !e.live ? ' aria-current="page"' : ''} aria-label="${label}">
                        <span class="hb-label" aria-hidden="true"><span class="hb-name">${esc(e.name)}</span><span class="hb-when">${esc(e.when)}</span></span>
                        <span class="hb-track" aria-hidden="true"><span class="hb-bar" style="--w:${((e.posts || 0) / max).toFixed(4)}"></span><span class="hb-val num">${num(e.posts)}</span></span>
                    </a>
                    ${e.note ? `<p class="hb-note">${e.noteHtml ? e.note : esc(e.note)}</p>` : ''}
                </li>`;
        }).join('');

        return `
            <section class="section" aria-labelledby="${esc(id)}">
                <h2 id="${esc(id)}">${esc(title)}</h2>
                <p class="section-note">${intro} ${esc(RULES_NOTE)}</p>
                <ul class="hbars">${rows}</ul>
            </section>`;
    };

    window.epochsTotal = (list = window.POWBOT_EPOCHS) => list.reduce((s, e) => s + (e.posts || 0), 0);
})();
