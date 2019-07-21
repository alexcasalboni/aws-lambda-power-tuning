'use strict';

/**
 * Receive average cost and decide which power config wins.
 */
module.exports.handler = async(event, context) => {

    if (!Array.isArray(event) || !event.length) {
        throw new Error('Wrong input ' + JSON.stringify(event));
    }

    // extract from input event
    const stats = extractStatistics(event);

    // compute optimal configuration
    const optimal = findCheapest(stats);

    // TODO add more "optimal" strategies besides cheapest?

    return optimal;
};


const extractStatistics = (event) => {
    return event.map(p => {
        // handle empty results from executor
        if (p.stats && p.stats.averageDuration) {
            return {
                power: p.value,
                cost: p.stats.averagePrice,
                duration: p.stats.averageDuration,
            };
        }
    });
};

const findCheapest = (stats) => {
    // sort by cost
    stats.sort((p1, p2) => {
        return p1.cost - p2.cost;
    });

    // logging is free, right?
    console.log('Stats: ', stats);

    // just return the first one
    return stats[0];
};
