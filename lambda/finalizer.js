'use strict';

/**
 * Receive avg prices and decides which config works better.
 */
module.exports.handler = (event, context) => {

    if (!Array.isArray(event) || !event.length) {
        throw new Error('Wrong input ' + JSON.stringify(event));
    }

    // clean up input event (too much data from previous steps)
    const stats = event.map(p => {
        if (p.stats && p.stats.averageDuration) {  // handle empty results from executor
            return {
                'power': p.value,
                'cost': p.stats.averagePrice,
                'duration': p.stats.averageDuration
            };
        }
    });

    // sort by cost
    stats.sort((p1, p2) => {
        return p1.cost - p2.cost;
    });

    console.log(stats);  // logging is free, right?

    // just return th first one
    const cheapest = stats[0];

    // TODO check for same-cost configuration and improve selection?

    return cheapest;
};
