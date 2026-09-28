/**
 * The current epoch, in one place.
 *
 * ==> AT EACH EPOCH ROLLOVER: update these values. <==
 * Edit on GitHub is fine; main deploys to powbot.africa within two minutes.
 *
 * All times are UTC. `end` is the planned end and is shown as "around <date>",
 * because an epoch closes when the maintainers close it, not on a timer.
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
