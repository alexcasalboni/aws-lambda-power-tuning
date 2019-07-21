'use strict';

const utils = require('./utils');

const minRAM = parseInt(process.env.minRAM);
const minCost = parseFloat(process.env.minCost);
const powerValues = process.env.powerValues.split(',');

/**
 * Execute given function N times in parallel, until every invokation is over.
 */
module.exports.handler = async (event, context) => {

    // read input from event
    const lambdaARN = event.lambdaARN;
    const value = parseInt(event.value);
    const num = parseInt(event.num);
    const enableParallel = !!event.parallelInvocation;
    var payload = event.payload;

    if (!lambdaARN) {
        throw new Error('Missing or empty lambdaARN');
    }
    if (!value || isNaN(value)) {
        throw new Error('Invalid value: ' + value);
    }
    if (!num || isNaN(num)) {
        throw new Error('Invalid num: ' + num);
    }
    if (powerValues.indexOf(event.value) === -1) {
        console.log("Not executing for " + value);
        return "Not executing for " + value;
    }

    if (typeof payload !== 'string' && typeof payload !== 'undefined') {
        console.log('Converting payload to string from ', typeof payload);
        payload = JSON.stringify(payload);
    }

    const lambdaAlias = 'RAM' + value;
    const results = [];

    if (enableParallel) {
        const invocations = utils.range(num).map(async () => {
            return await utils.invokeLambda(lambdaARN, lambdaAlias, payload);
        });
        // run all invocations in parallel and wait for results
        results.concat(await Promise.all(invocations));
    } else {
        for (let i=0; i<num; i++) {
            // run invocations one by one
            const data = await utils.invokeLambda(lambdaARN, lambdaAlias, payload);
            results.push(data);
        }
    }

    // use results (which include logs) to compute average duration ...
    const averageDuration = utils.computeAverageDuration(results);
    console.log("Average duration: ", averageDuration);
    // ... and overall statistics
    const stats = utils.computeStats(minCost, minRAM, value, averageDuration);
    console.log("Stats: ", stats);
    return stats;

};