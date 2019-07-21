'use strict';

const utils = require('./utils');

const minRAM = parseInt(process.env.minRAM);
const minCost = parseFloat(process.env.minCost);
const powerValues = process.env.powerValues.split(',');

/**
 * Execute the given function N times in series or in parallel.
 * Then compute execution statistics (averate cost and duration).
 */
module.exports.handler = async (event, context) => {
    // read input from event
    const {lambdaARN, value, num, enableParallel, payload} = extractDataFromInput(event);

    validateInput(lambdaARN, value, num);  // may throw

    if (powerValues.indexOf(""+value) === -1) {
        // throw new Error("type: " + typeof (""+value) + "powerValue: " + powerValues + ", value: "+ value + ", index: "+ powerValues.indexOf(value));
        console.log("Not executing for " + value);
        return "Not executing for " + value;
    }

    const lambdaAlias = 'RAM' + value;
    let results;

    if (enableParallel) {
        results = await runInParallel(num, lambdaARN, lambdaAlias, payload);
    } else {
        results = await runInSeries(num, lambdaARN, lambdaAlias, payload);
    }

    return computeStatistics(results, value);
};

const validateInput = (lambdaARN, value, num) => {
    if (!lambdaARN) {
        throw new Error('Missing or empty lambdaARN');
    }
    if (!value || isNaN(value)) {
        throw new Error('Invalid value: ' + value);
    }
    if (!num || isNaN(num)) {
        throw new Error('Invalid num: ' + num);
    }
}

const extractDataFromInput = (event) => {
    return {
        lambdaARN: event.lambdaARN,
        value: parseInt(event.value),
        num: parseInt(event.num),
        enableParallel: !!event.parallelInvocation,
        payload: convertPayload(event.payload),
    };
}

const convertPayload = (payload) => {
    if (typeof payload !== 'string' && typeof payload !== 'undefined') {
        console.log('Converting payload to string from ', typeof payload);
        payload = JSON.stringify(payload);
    }
    return payload;
}

const runInParallel = async (num, lambdaARN, lambdaAlias, payload) => {
    const results = [];
    // run all invocations in parallel ...
    const invocations = utils.range(num).map(async () => {
        const data = await utils.invokeLambda(lambdaARN, lambdaAlias, payload);
        results.push(data);
    });
    // ... and wait for results
    await Promise.all(invocations);
    return results;
};

const runInSeries = async (num, lambdaARN, lambdaAlias, payload) => {
    const results = [];
    for (let i=0; i<num; i++) {
        // run invocations in series
        const data = await utils.invokeLambda(lambdaARN, lambdaAlias, payload);
        results.push(data);
    }
    return results;
}

const computeStatistics = (results, value) => {
    // use results (which include logs) to compute average duration ...
    const averageDuration = utils.computeAverageDuration(results);
    console.log("Average duration: ", averageDuration);
    // ... and overall statistics
    const stats = utils.computeStats(minCost, minRAM, value, averageDuration);
    console.log("Stats: ", stats);
    return stats;
}