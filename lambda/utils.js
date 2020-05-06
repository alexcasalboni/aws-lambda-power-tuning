'use strict';

const AWS = require('aws-sdk');

// local reference to this module
const utils = module.exports;

// cost of 6+N state transitions (AWS Step Functions)
module.exports.stepFunctionsCost = (nPower) => +(0.000025 * (6 + nPower)).toFixed(5);


module.exports.allPowerValues = () => {
    const increment = 64;
    const powerValues = [];
    for (let value = 128; value <= 3008; value += increment) {
        powerValues.push(value);
    }
    return powerValues;
};

/**
 * Check whether a Lambda Alias exists or not, and return its data.
 */
module.exports.getLambdaAlias = (lambdaARN, alias) => {
    console.log('Checking alias ', alias);
    const params = {
        FunctionName: lambdaARN,
        Name: alias,
    };
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    return lambda.getAlias(params).promise();
};

/**
 * Return true if alias exist, false if it doesn't.
 */
module.exports.verifyAliasExistance = async(lambdaARN, alias) => {
    try {
        await utils.getLambdaAlias(lambdaARN, alias);
        return true;
    } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
            // OK, the alias isn't supposed to exist
            console.log('OK, even if missing alias ');
            return false;
        } else {
            console.log('error during alias check:');
            throw error; // a real error :)
        }
    }
};

/**
 * Update power, publish new version, and create/update alias.
 */
module.exports.createPowerConfiguration = async(lambdaARN, value, alias) => {
    try {
        await utils.setLambdaPower(lambdaARN, value);
        const {Version} = await utils.publishLambdaVersion(lambdaARN);
        const aliasExists = await utils.verifyAliasExistance(lambdaARN, alias);
        if (aliasExists) {
            await utils.updateLambdaAlias(lambdaARN, alias, Version);
        } else {
            await utils.createLambdaAlias(lambdaARN, alias, Version);
        }
    } catch (error) {
        if (error.message && error.message.includes('Alias already exists')) {
            // shouldn't happen, but nothing we can do in that case
            console.log('OK, even if: ', error);
        } else {
            console.log('error during config creation for value ' + value);
            throw error; // a real error :)
        }
    }
};

/**
 * Retrieve a given Lambda Function's memory size (always $LATEST version)
 */
module.exports.getLambdaPower = async(lambdaARN) => {
    console.log('Getting current power value');
    const params = {
        FunctionName: lambdaARN,
        Qualifier: '$LATEST',
    };
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    const config = await lambda.getFunctionConfiguration(params).promise();
    return config.MemorySize;
};

/**
 * Update a given Lambda Function's memory size (always $LATEST version).
 */
module.exports.setLambdaPower = (lambdaARN, value) => {
    console.log('Setting power to ', value);
    const params = {
        FunctionName: lambdaARN,
        MemorySize: parseInt(value, 10),
    };
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    return lambda.updateFunctionConfiguration(params).promise();
};

/**
 * Publish a new Lambda Version (version number will be returned).
 */
module.exports.publishLambdaVersion = (lambdaARN /*, alias*/) => {
    console.log('Publishing new version');
    const params = {
        FunctionName: lambdaARN,
    };
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    return lambda.publishVersion(params).promise();
};

/**
 * Delete a given Lambda Version.
 */
module.exports.deleteLambdaVersion = (lambdaARN, version) => {
    console.log('Deleting version ', version);
    const params = {
        FunctionName: lambdaARN,
        Qualifier: version,
    };
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    return lambda.deleteFunction(params).promise();
};

/**
 * Create a new Lambda Alias and associate it with the given Lambda Version.
 */
module.exports.createLambdaAlias = (lambdaARN, alias, version) => {
    console.log('Creating Alias ', alias);
    const params = {
        FunctionName: lambdaARN,
        FunctionVersion: version,
        Name: alias,
    };
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    return lambda.createAlias(params).promise();
};

/**
 * Create a new Lambda Alias and associate it with the given Lambda Version.
 */
module.exports.updateLambdaAlias = (lambdaARN, alias, version) => {
    console.log('Updating Alias ', alias);
    const params = {
        FunctionName: lambdaARN,
        FunctionVersion: version,
        Name: alias,
    };
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    return lambda.updateAlias(params).promise();
};

/**
 * Delete a given Lambda Alias.
 */
module.exports.deleteLambdaAlias = (lambdaARN, alias) => {
    console.log('Deleting alias ', alias);
    const params = {
        FunctionName: lambdaARN,
        Name: alias,
    };
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    return lambda.deleteAlias(params).promise();
};

/**
 * Invoke a given Lambda Function:Alias with payload and return its logs.
 */
module.exports.invokeLambda = (lambdaARN, alias, payload) => {
    console.log('Invoking alias ', alias);
    const params = {
        FunctionName: lambdaARN,
        Qualifier: alias,
        Payload: payload,
        LogType: 'Tail', // will return logs
    };
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    return lambda.invoke(params).promise();
};

/**
 * Compute average price and returns with average duration.
 */
module.exports.computePrice = (minCost, minRAM, value, duration) => {
    // compute official price per 100ms
    const pricePer100ms = value * minCost / minRAM;
    // quantize price to upper 100ms (billed duration) and compute avg price
    return Math.ceil(duration / 100) * pricePer100ms;
};

module.exports.parseLogAndExtractDurations = (data) => {
    return data.map(log => {
        const logString = utils.base64decode(log.LogResult || '');
        return utils.extractDuration(logString);
    });
};

/**
 * Copute average duration
 */
module.exports.computeTotalCost = (minCost, minRAM, value, durations) => {
    if (!durations || !durations.length) {
        return 0;
    }

    // compute corresponding cost for each durationo
    const costs = durations.map(duration => utils.computePrice(minCost, minRAM, value, duration));

    // sum all together
    return costs.reduce((a, b) => a + b, 0);
};

/**
 * Copute average duration
 */
module.exports.computeAverageDuration = (durations) => {
    if (!durations || !durations.length) {
        return 0;
    }

    // 20% of durations will be discarted (trimmed mean)
    const toBeDiscarded = parseInt(durations.length * 20 / 100, 10);

    const newN = durations.length - 2 * toBeDiscarded;

    // compute trimmed mean (discard 20% of low/high values)
    const averageDuration = durations
        .sort() // sort numerically
        .slice(toBeDiscarded, -toBeDiscarded) // discard first/last values
        .reduce((a, b) => a + b, 0) // sum all together
        / newN
    ;

    return averageDuration;
};

/**
 * Extract duration (in ms) from a given Lambda's CloudWatch log.
 */
module.exports.extractDuration = (log) => {
    // extract duration from log (anyone can suggest a regex?)
    const durationSplit = log.split('\tDuration: ');
    if (durationSplit.length < 2) return 0;

    const durationStr = durationSplit[1].split(' ms')[0];
    return parseFloat(durationStr);
};

/**
 * Encode a given string to base64.
 */
module.exports.base64decode = (str) => {
    return Buffer.from(str, 'base64').toString();
};

/**
 * Generate a list of size n.
 */
module.exports.range = (n) => {
    if (n === null || typeof n === 'undefined') {
        n = -1;
    }
    return Array.from(Array(n).keys());
};

module.exports.regionFromARN = (arn) => {
    if (typeof arn !== 'string' || arn.split(':').length !== 7) {
        throw new Error('Invalid ARN: ' + arn);
    }
    return arn.split(':')[3];
};

module.exports.lambdaClientFromARN = (lambdaARN) => {
    const region = this.regionFromARN(lambdaARN);
    return new AWS.Lambda({region});
};

/**
 * Generate a URL with encoded stats.
 * Note: the URL hash is never sent to the server.
 */
module.exports.buildVisualizationURL = (stats, baseURL) => {

    function encode(inputList, EncodeType = null) {
        EncodeType = EncodeType || Float32Array;
        inputList = new EncodeType(inputList);
        inputList = new Uint8Array(inputList.buffer);
        return Buffer.from(inputList).toString('base64');
    }

    // sort by power
    stats.sort((p1, p2) => {
        return p1.power - p2.power;
    });

    const sizes = stats.map(p => p.power);
    const times = stats.map(p => p.duration);
    const costs = stats.map(p => p.cost);

    const hash = [
        encode(sizes, Int16Array),
        encode(times),
        encode(costs),
    ].join(';');

    return baseURL + '#' + hash;
};

/**
 * Using the prices supplied via prices.json,
 * to figure what the base price is for the
 * supplied lambda's region
 */
module.exports.baseCostForRegion = (region) => {
    const prices = JSON.parse(process.env.baseCosts);
    if (prices[region]) {
        return prices[region];
    }
    console.log(region + ' not found in base price map, using default: ' + prices['default']);
    return prices['default'];
};
