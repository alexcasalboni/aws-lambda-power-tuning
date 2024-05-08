'use strict';

const utils = require('./utils');


module.exports.handler = async(event, context) => {
    const {lambdaConfigurations, currConfig, lambdaARN} = validateInputs(event);
    const currentIterator = lambdaConfigurations.iterator;
    const aliases = lambdaConfigurations.aliases || [];

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
    const updatedIterator = {
        index: (currentIterator.index + 1),
        count: currentIterator.count,
        continue: ((currentIterator.index + 1) < currentIterator.count),
    };
    const updatedLambdaConfigurations = {
        initConfigurations: ((updatedIterator.continue) ? lambdaConfigurations.initConfigurations : undefined),
        iterator: updatedIterator,
        aliases: aliases,
        powerValues: lambdaConfigurations.powerValues,
    };
    return updatedLambdaConfigurations;
};
function validateInputs(event) {
    if (!event.lambdaARN) {
        throw new Error('Missing or empty lambdaARN');
    }
    const lambdaARN = event.lambdaARN;
    if (!(event.lambdaConfigurations && event.lambdaConfigurations.iterator && event.lambdaConfigurations.initConfigurations)){
        throw new Error('Invalid iterator for initialization');
    }
    const iterator = event.lambdaConfigurations.iterator;
    if (!(iterator.index >= 0 && iterator.index < iterator.count)){
        throw new Error(`Invalid iterator index: ${iterator.index}`);
    }
    const lambdaConfigurations = event.lambdaConfigurations;
    const currIdx = iterator.index;
    const currConfig = lambdaConfigurations.initConfigurations[currIdx];
    if (!(currConfig && currConfig.powerValue)){
        throw new Error(`Invalid init configuration: ${currConfig}`);
    }
    return {lambdaConfigurations, currConfig, lambdaARN};
}
