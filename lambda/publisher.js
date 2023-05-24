'use strict';

const utils = require('./utils');


module.exports.handler = async(event, context) => {
    const {iterator, aliases, currConfig, lambdaARN} = validateInputs(event);
    const {envVars} = await utils.getLambdaPower(lambdaARN);
    // Alias may not exist when we are reverting the Lambda function to its original configuration
    if (typeof currConfig.alias !== 'undefined'){
        envVars.LambdaPowerTuningForceColdStart = currConfig.alias;
    } else {
        delete envVars.LambdaPowerTuningForceColdStart;
    }

    // publish version & assign alias (if present)
    await utils.createPowerConfiguration(lambdaARN, currConfig.powerValue, currConfig.alias, envVars);
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
function validateInputs(event) {
    if (!event.lambdaARN) {
        throw new Error('Missing or empty lambdaARN');
    }
    const lambdaARN = event.lambdaARN;
    if (!(event.powerValues && event.powerValues.iterator && event.powerValues.initConfigurations)){
        throw new Error('Invalid input');
    }
    const iterator = event.powerValues.iterator;
    if (!(iterator.index >= 0 && iterator.index < iterator.count)){
        throw new Error('Invalid iterator input');
    }
    const initConfigurations = event.powerValues.initConfigurations;
    const aliases = event.powerValues.aliases || [];
    const currIdx = iterator.index;
    const currConfig = initConfigurations[currIdx];
    if (!(currConfig && currConfig.powerValue)){
        throw new Error('Invalid configuration');
    }
    return {iterator, aliases, currConfig, lambdaARN};
}
