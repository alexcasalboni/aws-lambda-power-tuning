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
    const {power, description} = await utils.getLambdaPower(lambdaARN);
    console.log(power, description);

    let initConfigurations = [];

    // reminder: configuration updates must run sequentially
    // (otherwise you get a ResourceConflictException)
    for (let powerValue of powerValues){
        const baseAlias = 'RAM' + powerValue;
        if (!onlyColdStarts){
            initConfigurations.push({powerValue: powerValue, alias: baseAlias});
        } else {
            for (let n of utils.range(num)){
                let alias = utils.buildAliasString(baseAlias, onlyColdStarts, n);
                // here we inject a custom description to force the creation of a new version
                // even if the power is the same, which will force a cold start
                initConfigurations.push({powerValue: powerValue, alias: alias, description: `${description} - ${alias}`});
            }
        }
    }
    // Publish another version to revert the Lambda Function to its original configuration
    initConfigurations.push({powerValue: power, description: description});

    return {
        initConfigurations: initConfigurations,
        iterator: {
            index: 0,
            count: initConfigurations.length,
            continue: true,
        },
        powerValues: powerValues,
    };
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
