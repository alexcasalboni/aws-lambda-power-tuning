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

    let lambdaFunctionsToSet = [];

    // reminder: configuration updates must run sequentially
    // (otherwise you get a ResourceConflictException)
    for (let powerValue of powerValues){
        const baseAlias = 'RAM' + powerValue;
        if (!onlyColdStarts){
            lambdaFunctionsToSet.push({lambdaARN: lambdaARN, powerValue: powerValue, envVars: envVars, alias: baseAlias});
        } else {
            for (let n of utils.range(num)){
                let alias = utils.buildAliasString(baseAlias, onlyColdStarts, n);
                const currentEnvVars = {
                    ...envVars,
                };
                // set Env Var to a unique value to force version publishing
                currentEnvVars.LambdaPowerTuningForceColdStart = alias;
                // here we inject a custom env variable to force the creation of a new version
                // even if the power is the same, which will force a cold start
                lambdaFunctionsToSet.push({lambdaARN: lambdaARN, powerValue: powerValue, envVars: currentEnvVars, alias: alias});
            }
        }
    }
    lambdaFunctionsToSet.push({lambdaARN: lambdaARN, powerValue: power, envVars: envVars});

    const returnObj = {
        initConfigurations: lambdaFunctionsToSet,
        iterator: {
            index: 0,
            count: lambdaFunctionsToSet.length,
            continue: true,
        },
        powerValues: powerValues
    }
    return returnObj;
};

module.exports.versionPublisher = async(event, context) => {
    const iterator = event.powerValues.iterator;
    const initConfigurations = event.powerValues.initConfigurations;
    const aliases = event.powerValues.aliases || [];
    const currIdx = iterator.index;
    const currConfig = initConfigurations[currIdx];

    // publish version & assign alias
    await utils.createPowerConfiguration(currConfig.lambdaARN, currConfig.powerValue, currConfig.alias, currConfig.envVars);
    if(typeof currConfig.alias !== 'undefined'){
        // keep track of all aliases
        aliases.push(currConfig.alias);
    }

    // update iterator
    iterator.index++;
    iterator.continue = (iterator.index < iterator.count);
    if(!iterator.continue){
        delete event.powerValues.initConfigurations;
    }
    event.powerValues.aliases = aliases;
    return event.powerValues;
}


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
