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
 * Supports both standard Lambda stats and LMI stats.
 */
module.exports.handler = async(event, context) => {

    // Flatten nested lmiStats from multi-instance-type Map output
    if (event.lmiStatsNested && !event.lmiStats) {
        event.lmiStats = event.lmiStatsNested.flat();
    }

    const hasStandardStats = Array.isArray(event.stats) && event.stats.length > 0;
    const hasLmiStats = Array.isArray(event.lmiStats) && event.lmiStats.length > 0;

    if (!hasStandardStats && !hasLmiStats) {
        throw new Error('Wrong input ' + JSON.stringify(event));
    }

    if (event.dryRun) {
        return console.log('[Dry-run] Skipping analysis');
    }

    const result = findOptimalConfiguration(event);

    if (event.includeOutputResults) {
        // add stats to final result
        if (hasStandardStats) {
            result.stats = event.stats.map(stat => ({
                value: stat.value,
                averagePrice: stat.averagePrice,
                averageDuration: stat.averageDuration,
            }));
        }
        if (hasLmiStats) {
            result.lmiStats = event.lmiStats
                .filter(stat => stat && stat.averageDuration)
                .map(stat => ({
                    type: 'lmi',
                    memoryPerVCpu: stat.memoryPerVCpu,
                    bestConcurrency: stat.bestConcurrency,
                    instanceType: stat.instanceType,
                    averagePrice: stat.averagePrice,
                    averageDuration: stat.averageDuration,
                }));
        }
    }

    return result;
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
    const onlyColdStarts = event.onlyColdStarts;
    const num = event.num;

    // also compute total cost of optimization state machine & lambda
    optimal.stateMachine = {};

    const standardStatsCount = (event.stats || []).length;
    optimal.stateMachine.executionCost = utils.stepFunctionsCost(standardStatsCount, onlyColdStarts, num);
    optimal.stateMachine.lambdaCost = stats
        .map((p) => p.totalCost)
        .reduce((a, b) => a + b, 0);

    // Build visualization URL
    const standardStats = stats.filter(s => s.type !== 'lmi');
    if (standardStats.length > 0) {
        optimal.stateMachine.visualization = utils.buildVisualizationURL(standardStats, visualizationURL);
    }

    // Build LMI visualization (per-memoryPerVCpu URLs with concurrency on x-axis)
    if (event.lmiStats && event.lmiStats.length > 0) {
        optimal.stateMachine.lmiVisualization = utils.buildLmiVisualizationURL(event.lmiStats, visualizationURL);
    }

    // Build combined visualization (standard + LMI on one page)
    if (visualizationURL) {
        const combinedBaseURL = visualizationURL.replace(/\/?$/, '/') + 'combined.html';
        const combinedURL = utils.buildCombinedVisualizationURL(event.stats, event.lmiStats, combinedBaseURL);
        if (combinedURL) {
            optimal.stateMachine.combinedVisualization = combinedURL;
        }
    }

    // the total cost of the optimal branch execution is not needed
    delete optimal.totalCost;

    return optimal;
};


const extractStatistics = (event) => {
    const allStats = [];

    // Standard Lambda stats
    if (event.stats && event.stats.length) {
        const standardStats = event.stats
            .filter(stat => stat && stat.averageDuration)
            .map(stat => ({
                type: 'standard',
                power: stat.value,
                cost: stat.averagePrice,
                duration: stat.averageDuration,
                totalCost: stat.totalCost,
            }));
        allStats.push(...standardStats);
    }

    // LMI stats
    if (event.lmiStats && event.lmiStats.length) {
        const lmiStats = event.lmiStats
            .filter(stat => stat && stat.averageDuration)
            .map(stat => ({
                type: 'lmi',
                power: stat.value, // memoryPerVCpu, used for ranking
                cost: stat.averagePrice,
                duration: stat.averageDuration,
                totalCost: stat.totalCost,
                memoryPerVCpu: stat.memoryPerVCpu,
                bestConcurrency: stat.bestConcurrency,
                instanceType: stat.instanceType,
            }));
        allStats.push(...lmiStats);
    }

    return allStats;
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
