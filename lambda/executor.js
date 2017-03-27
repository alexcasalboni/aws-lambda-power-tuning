'use strict';

const AWS = require('aws-sdk');
const lambda = new AWS.Lambda();

const minRAM = parseInt(process.env.minRAM);
const minCost = parseFloat(process.env.minCost);

let range = n => Array.from(Array(n).keys());

/**
 * Execute given function N times in parallel, until every invokation is over.
 */
module.exports.handler = (event, context, callback) => {
  
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

    const params = {
        FunctionName: lambdaARN, 
        Qualifier: lambdaAlias,
        Payload: payload,
        LogType: "Tail",  // will return logs
    };

    // create list of promises (same params)
    const invocations = range(num).map(function() {
        return lambda.invoke(params).promise();
    });

    Promise
        .all(invocations)  // invoke in parallel
        .then(aggregateResults.bind(null, num))  // aggregate results
        .then(computePrice.bind(null, value))  // compute price
        .then(function(price) {
            callback(null, {
                value: value,
                price: price,
            });
        })
        .catch(console.error.bind(console));

};

function aggregateResults(num, results) {

    // 20% of durations will be discarted (trimmed mean)
    const toBeDiscarded = parseInt(num * 20 / 100);

    // build a list of floats by parsing logs
    const durations = results.map(function(result) {
        const log = base64decode(result.LogResult);
        return extractDuration(log);
    })

    // compute trimmed mean (discard 20% of low/high values)
    const averageDuration = durations
        .sort()  // sort numerically
        .slice(toBeDiscarded, -toBeDiscarded)  // discard first/last values
        .reduce(add, 0)  // sum all together
        / (num - 2 * toBeDiscarded)  // divide by N
    ;

    return Promise.resolve(averageDuration);

}

function computePrice(value, averageDuration) {
    console.log("avg duration: ", averageDuration);
    // compute official price per 100ms
    const pricePer100ms = value * minCost / minRAM;
    console.log("price for 100ms: ", pricePer100ms);
    // quantize price to upper 100ms (billed duration) and compute avg price
    const averagePrice = Math.ceil(averageDuration / 100) * pricePer100ms;
    console.log("avg price: ", averagePrice);
    return Promise.resolve(averagePrice);
}


function add(a, b) {
    return a + b;
}


function base64decode(str) {
    return new Buffer(str, 'base64').toString();
}


function extractDuration(log) {
    // extract duration from log (anyone can suggest a regex?)
    const durationStr = log.split('\tDuration: ')[1].split(' ms')[0];
    return parseFloat(durationStr);
}
