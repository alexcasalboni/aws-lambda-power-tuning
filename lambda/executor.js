'use strict';

const utils = require('./utils');

const minRAM = parseInt(process.env.minRAM);
const minCost = parseFloat(process.env.minCost);

/**
 * Execute given function N times in parallel, until every invokation is over.
 */
module.exports.handler = (event, context, callback) => {
  
    const enableParallel = event.parallelInvocation || false;
    const lambdaARN = event.lambdaARN;
    const value = parseInt(event.value);
    const lambdaAlias = "RAM" + value;  // last one
    const payload = event.payload;
    const num = event.num;

    if (!lambdaARN) {
        throw new Error("Missing or empty lambdaARN");
    }

    if (!num) {
        throw new Error("Invalid num: " + num);
    }

    // create list of promises (same params)
    const invocations = utils.range(num).map(function() {
        return utils.invokeLambda.bind(null, lambdaARN, lambdaAlias, payload);
    });

    // initialize promise
    var queue = Promise.resolve();
    var seriesResults = [];

    if (enableParallel) {
        // invoke in parallel
        queue = Promise.all(invocations);
    } else {
        // invoke in series
        invocations.forEach(function(invocation) {
            queue = queue
                .then(invocation)
                .then(function(result) {
                    seriesResults.push(result);
                    return Promise.resolve(null);  // null result!
                });
        });
    }

    // proceed with aggregation and cost computation
    queue
        .then(function(parallelresults) {
            // aggregate results (either parallel or series)
            return utils.computeAverageDuration(parallelresults || seriesResults);
        })
        .then(utils.computeAveragePrice.bind(null, minCost, minRAM, value))  // compute price
        .then(function(price) {
            callback(null, {
                value: value,
                price: price,
            });
        })
        .catch(console.error.bind(console));
};