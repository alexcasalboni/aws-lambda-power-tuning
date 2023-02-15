'use strict';

const utils = require('./utils');
const defaultPowerValues = process.env.defaultPowerValues.split(',');

/**
 * Initialize versions & aliases so we can execute everything in parallel.
 */
module.exports.handler = async(event, context) => {

    const {
        lambdaARN,
        num,
        powerValues,
        onlyColdStarts,
    } = extractDataFromInput(event);

    validateInput(lambdaARN, num); // may throw

    // fetch initial $LATEST value so we can reset it later
    const {power, envVars} = await utils.getLambdaPower(lambdaARN);

    // reminder: configuration updates must run sequentially
    // (otherwise you get a ResourceConflictException)
    for (let value of powerValues){
        let baseAlias = 'RAM' + value;
        if (onlyColdStarts) {
            for (let n of utils.range(num)){
                let alias = utils.buildAliasString(baseAlias, onlyColdStarts, n);
                // here we inject a custom env variable to force the creation of a new version
                // even if the power is the same, which will force a cold start
                envVars.LambdaPowerTuningForceColdStart = alias;
                await utils.createPowerConfiguration(lambdaARN, value, alias, envVars);
            }
        } else {
            await utils.createPowerConfiguration(lambdaARN, value, baseAlias, envVars);
        }
    }

    delete envVars.LambdaPowerTuningForceColdStart;
    // restore power and env variables to initial state
    await utils.setLambdaPower(lambdaARN, power, envVars);

    return powerValues;
};

const extractDataFromInput = (event) => {
    return {
        lambdaARN: event.lambdaARN,
        num: parseInt(event.num, 10),
        powerValues: extractPowerValues(event),
        onlyColdStarts: !!event.onlyColdStarts,
    };
};

const extractPowerValues = (event) => {
    var powerValues = event.powerValues; // could be undefined

    // auto-generate all possible values if ALL
    if (powerValues === 'ALL') {
        powerValues = utils.allPowerValues();
    }

    // use default list of values (defined at deploy-time) if not provided
    if (!powerValues || powerValues.length === 0) {
        powerValues = defaultPowerValues;
    }

    return powerValues;
};

const validateInput = (lambdaARN, num) => {
    if (!lambdaARN) {
        throw new Error('Missing or empty lambdaARN');
    }
    if (!num || num < 5) {
        throw new Error('Missing num or num below 5');
    }
};
