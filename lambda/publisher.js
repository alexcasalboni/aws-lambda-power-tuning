'use strict';

const utils = require('./utils');

module.exports.handler = async(event, context) => {
    const iterator = event.powerValues.iterator;
    const initConfigurations = event.powerValues.initConfigurations;
    const aliases = event.powerValues.aliases || [];
    const currIdx = iterator.index;
    const currConfig = initConfigurations[currIdx];
    currConfig.lambdaARN = event.lambdaARN;


    const {envVars} = await utils.getLambdaPower(currConfig.lambdaARN);
    // Alias may not exist when we are reverting the Lambda function to its original configuration
    if (typeof currConfig.alias !== 'undefined'){
        envVars.LambdaPowerTuningForceColdStart = currConfig.alias;
    } else {
        delete envVars.LambdaPowerTuningForceColdStart;
    }

    // publish version & assign alias (if present)
    await utils.createPowerConfiguration(currConfig.lambdaARN, currConfig.powerValue, currConfig.alias, envVars);
    if (typeof currConfig.alias !== 'undefined') {
        // keep track of all aliases
        aliases.push(currConfig.alias);
    }

    // update iterator
    iterator.index++;
    iterator.continue = (iterator.index < iterator.count);
    if (!iterator.continue) {
        delete event.powerValues.initConfigurations;
    }
    event.powerValues.aliases = aliases;
    return event.powerValues;
};
