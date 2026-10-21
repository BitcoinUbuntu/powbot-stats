/**
 * The current epoch, in one place.
 *
 * ==> AT EACH EPOCH ROLLOVER: update these values. <==
 * Edit on GitHub is fine; main deploys to powbot.africa within two minutes.
 * Also, once the finished epoch is frozen as stats-epochN.json, run
 * `python scripts/build_merchants_seen.py` and
 * `python scripts/build_merchants_index.py`, and commit merchants-seen.json
 * and merchants-index.json: the homepage's "New this epoch" merchant list
 * compares against the first, the Directory's Merchants tab reads the second.
 *
 * All times are UTC. `end` is the moment the epoch closes: midnight UTC at the
 * end of its last day, so an epoch whose last day is 21 October ends
 * '2026-10-22T00:00:00Z'. The homepage counts down to it, says "Final day" on
 * the last day, and from `end` on shows this epoch's results instead of live
 * stats, until the next epoch is set here. Move `end` if the close moves.
 *
 * `frozen`: set to true once this epoch's stats-epochN.json and
 * tracker-data-epochN.json are committed. The results page then reads those
 * copies, so it keeps showing this epoch after the bot moves on to the next.
 *
 * If stats.json ever carries an `epoch` object ({ name, start, end }), pages
 * prefer it over these values, so the exporter can become the source of truth
 * without another change here.
 */
window.POWBOT_EPOCH = {
    number: 6,
    name: 'Epoch 6',
    start: '2026-07-20T06:00:00Z',
    end: '2026-10-22T00:00:00Z',
    frozen: false,
    // The directory filter for "active this epoch" (members.html?filter=...)
    memberFilter: 'epoch6'
};
