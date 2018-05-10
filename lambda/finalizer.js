'use strict';

/**
 * Receive avg prices and decides which config works better.
 */
module.exports.handler = (event, context, callback) => {

    if (!Array.isArray(event) || !event.length) {
        const error = new Error('Wrong input ' + JSON.stringify(event));
        callback(error);
        throw error;  // TODO useless?
    }

    // clean up input event (too much data from previous steps)
    const stats = event.map(function (p) {
        return {
            'power': p.value,
            'stats': p.stats,
            'cost': p.stats.averagePrice // deprecated
        };
    });

    // sort by cost
    stats.sort(function (p1, p2) {
        return p1.stats.averagePrice - p2.stats.averagePrice;
    }
    );

    console.log(stats);  // logging is free, right?

    // just return th first one
    const cheapest = stats[0];

    // TODO check for same-cost configuration and improve selection?

    callback(null, cheapest);
    return Promise.resolve(cheapest);

};
