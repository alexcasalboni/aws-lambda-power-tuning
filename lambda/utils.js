const AWS = require('aws-sdk');

// local reference to this module
const utils = module.exports;

/**
 * Check whether a Lambda Alias exists or not, and return its data.
 */
module.exports.checkLambdaAlias = function (lambdaARN, alias) {
    // console.log('Checking alias ', alias);
    const params = {
        FunctionName: lambdaARN,
        Name: alias,
    };
    const lambda = new AWS.Lambda();
    return lambda.getAlias(params).promise();
};

/**
 * Update a given Lambda Function's memory size (always $LATEST version).
 */
module.exports.setLambdaPower = function (lambdaARN, value) {
    // console.log('Setting power to ', value);
    const params = {
        FunctionName: lambdaARN,
        MemorySize: parseInt(value),
    };
    const lambda = new AWS.Lambda();
    return lambda.updateFunctionConfiguration(params).promise();
};

/**
 * Publish a new Lambda Version (version number will be returned).
 */
module.exports.publishLambdaVersion = function (lambdaARN /*, alias*/) {
    // console.log('Publishing version for ', alias);
    const params = {
        FunctionName: lambdaARN,
    };
    const lambda = new AWS.Lambda();
    return lambda.publishVersion(params).promise();
};

/**
 * Delete a given Lambda Version.
 */
module.exports.deleteLambdaVersion = function (lambdaARN, version) {
    // console.log('Deleting version ', version);
    const params = {
        FunctionName: lambdaARN,
        Qualifier: version,
    };
    const lambda = new AWS.Lambda();
    return lambda.deleteFunction(params).promise();
};

/**
 * Create a new Lambda Alias and associate it with the given Lambda Version.
 */
module.exports.createLambdaAlias = function (lambdaARN, alias, version) {
    // console.log('Creating Alias ', alias);
    const params = {
        FunctionName: lambdaARN,
        FunctionVersion: version,
        Name: alias,
    };
    const lambda = new AWS.Lambda();
    return lambda.createAlias(params).promise();
};

/**
 * Delete a given Lambda Alias.
 */
module.exports.deleteLambdaAlias = function (lambdaARN, alias) {
    // console.log('Deleting alias ', alias);
    const params = {
        FunctionName: lambdaARN,
        Name: alias,
    };
    const lambda = new AWS.Lambda();
    return lambda.deleteAlias(params).promise();
};

/**
 * Invoke a given Lambda Function:Alias with payload and return its logs.
 */
module.exports.invokeLambda = function (lambdaARN, alias, payload) {
    // console.log('Invoking alias ', alias);
    const params = {
        FunctionName: lambdaARN,
        Qualifier: alias,
        Payload: payload,
        LogType: 'Tail',  // will return logs
    };
    const lambda = new AWS.Lambda();
    return lambda.invoke(params).promise();
};

/**
 * Compute average price and returns with average duration, given a RAM value and an average duration.
 */
module.exports.computeStats = function (minCost, minRAM, value, averageDuration) {
    // console.log('avg duration: ', averageDuration);
    // compute official price per 100ms
    const pricePer100ms = value * minCost / minRAM;
    // console.log('price for 100ms: ', pricePer100ms);
    // quantize price to upper 100ms (billed duration) and compute avg price
    const averagePrice = Math.ceil(averageDuration / 100) * pricePer100ms;
    // console.log('avg price: ', averagePrice);
    return Promise.resolve({ "averagePrice": averagePrice, "averageDuration": averageDuration });
};

/**
 * Copute average duration
 */
module.exports.computeAverageDuration = function (results) {

    if (!results || !results.length) {
        return 0;
    }

    // 20% of durations will be discarted (trimmed mean)
    const toBeDiscarded = parseInt(results.length * 20 / 100);

    // build a list of floats by parsing logs
    const durations = results.map(function (result) {
        const log = utils.base64decode(result.LogResult || '');
        return utils.extractDuration(log);
    });

    /**
     * Simply add the two given numbers (used to reduce a list).
     */
    function _add(a, b) {
        return a + b;
    }

    // compute trimmed mean (discard 20% of low/high values)
    const averageDuration = durations
        .sort()  // sort numerically
        .slice(toBeDiscarded, -toBeDiscarded)  // discard first/last values
        .reduce(_add, 0)  // sum all together
        / (results.length - 2 * toBeDiscarded)  // divide by N
        ;

    return Promise.resolve(averageDuration);
};

/**
 * Extract duration (in ms) from a given Lambda's CloudWatch log.
 */
module.exports.extractDuration = function (log) {
    // extract duration from log (anyone can suggest a regex?)
    const durationSplit = log.split('\tDuration: ');
    if (durationSplit.length < 2) return 0;

    const durationStr = durationSplit[1].split(' ms')[0];
    return parseFloat(durationStr);
};

/**
 * Encode a given string to base64.
 */
module.exports.base64decode = function (str) {
    return new Buffer(str, 'base64').toString();
};

/**
 * Generate a list of size n.
 */
module.exports.range = function (n) {
    if (n === null || typeof n === 'undefined') {
        n = -1;
    }
    return Array.from(Array(n).keys());
};