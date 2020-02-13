'use strict';

const utils = require('./utils');

const visualizationURL = process.env.visualizationURL;

const defaultStrategy = 'cost';
const defaultBalancedWeight = 0.5;
const optimizationStrategies = {
    cost: () => findCheapest,
    speed: () => findFastest,
    balanced: () => findBalanced,
};

/**
 * Receive average cost and decide which power config wins.
 */
module.exports.handler = async(event, context) => {

    if (!Array.isArray(event.stats) || !event.stats.length) {
        throw new Error('Wrong input ' + JSON.stringify(event));
    }

    if (event.dryRun) {
        return console.log('[Dry-run] Skipping analysis');
    }

    return findOptimalConfiguration(event);
};

const getStrategy = (event) => {
    // extract strategy name or fallback to default (cost)
    return event.strategy || defaultStrategy;
};

const getBalancedWeight = (event) => {
    // extract weight used by balanced strategy or fallback to default (0.5)
    let weight = event.balancedWeight;
    if (typeof weight === 'undefined') {
        weight = defaultBalancedWeight;
    }
    // weight must be between 0 and 1
    return Math.min(Math.max(weight, 0.0), 1.0);
};

const findOptimalConfiguration = (event) => {
    const stats = extractStatistics(event);
    const strategy = getStrategy(event);
    const balancedWeight = getBalancedWeight(event);
    const optimizationFunction = optimizationStrategies[strategy]();
    const optimal = optimizationFunction(stats, balancedWeight);

    // also compute total cost of optimization state machine & lambda
    optimal.stateMachine = {};
    optimal.stateMachine.executionCost = utils.stepFunctionsCost(event.stats.length);
    optimal.stateMachine.lambdaCost = stats
        .map((p) => p.totalCost)
        .reduce((a, b) => a + b, 0);
    optimal.stateMachine.visualization = utils.buildVisualizationURL(stats, visualizationURL);

    // the total cost of the optimal branch execution is not needed
    delete optimal.totalCost;

    return optimal;
};


const extractStatistics = (event) => {
    // generate a list of objects with only the relevant data/stats
    return event.stats
    // handle empty results from executor
        .filter(stat => stat && stat.averageDuration)
        .map(stat => ({
            power: stat.value,
            cost: stat.averagePrice,
            duration: stat.averageDuration,
            totalCost: stat.totalCost,
        }));
};

const findCheapest = (stats) => {
    console.log('Finding cheapest');

    // sort by cost
    stats.sort((p1, p2) => {
        if (p1.cost === p2.cost) {
            // return fastest if same cost
            return p1.duration - p2.duration;
        }
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
        if (p1.duration === p2.duration) {
            // return cheapest if same speed
            return p1.cost - p2.cost;
        }
        return p1.duration - p2.duration;
    });

    console.log('Stats: ', stats);

    // just return the first one
    return stats[0];
};

const findBalanced = (stats, weight) => {
    // choose a balanced configuration, weight is a number between 0 and 1 that express trade-off
    // between cost and time (0 = min time, 1 = min cost)
    console.log('Finding balanced configuration with balancedWeight = ', weight);


    // compute max cost and max duration
    const maxCost = Math.max(...stats.map(x => x['cost']));
    const maxDuration = Math.max(...stats.map(x => x['duration']));

    // formula for balanced value of a configuration ( value is minimized )
    const getValue = x => weight * x['cost'] / maxCost + (1 - weight) * x['duration'] / maxDuration;

    // sort stats by value
    stats.sort((x, y) => getValue(x) - getValue(y));

    console.log('Stats: ', stats);

    // just return the first one
    return stats[0];
};
