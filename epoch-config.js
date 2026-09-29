/**
 * The current epoch, in one place.
 *
 * ==> AT EACH EPOCH ROLLOVER: update these values. <==
 * Edit on GitHub is fine; main deploys to powbot.africa within two minutes.
 * Also, once the finished epoch is frozen as stats-epochN.json, run
 * `python scripts/build_merchants_seen.py` and commit merchants-seen.json,
 * so the homepage's "New this epoch" merchant list compares against it.
 *
 * All times are UTC. `end` is the planned end, shown on the homepage as
 * "Ends <date>". An epoch still closes when the maintainers close it, not on
 * a timer: past this date the page says it is closing soon.
 *
 * If stats.json ever carries an `epoch` object ({ name, start, end }), pages
 * prefer it over these values, so the exporter can become the source of truth
 * without another change here.
 */
window.POWBOT_EPOCH = {
    number: 6,
    name: 'Epoch 6',
    start: '2026-07-20T06:00:00Z',
    end: '2026-10-21T00:00:00Z',
    // The directory filter for "active this epoch" (members.html?filter=...)
    memberFilter: 'epoch6'
};
