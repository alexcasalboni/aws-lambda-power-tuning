'use strict';

const defaultStrategy = 'cost';
const optimizationStrategies = {
    cost: () => findCheapest,
    speed: () => findFastest,
};

/**
 * Receive average cost and decide which power config wins.
 */
module.exports.handler = async(event, context) => {

    if (!Array.isArray(event) || !event.length) {
        throw new Error('Wrong input ' + JSON.stringify(event));
    }

    return findOptimalConfiguration(event);
};

const getStrategy = (event) => {
    // extract strategy name or fallback to default (cost)
    return event[0].strategy || defaultStrategy;
};

const findOptimalConfiguration = (event) => {
    const stats = extractStatistics(event);
    const strategy = getStrategy(event);
    const optimizationFunction = optimizationStrategies[strategy]();
    return optimizationFunction(stats);
};


const extractStatistics = (event) => {
    // generate a list of objects with only the relevant data/stats
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
    console.log('Finding cheapest');

    // sort by cost
    stats.sort((p1, p2) => {
        return p1.cost - p2.cost;
    });

    console.log('Stats: ', stats);

    // just return the first one
    return stats[0];
};

const findFastest = (stats) => {
    console.log('Finding fastest');

    // sort by duration/speed
    stats.sort((p1, p2) => {
        return p1.duration - p2.duration;
    });

    console.log('Stats: ', stats);

    // just return the first one
    return stats[0];
};
