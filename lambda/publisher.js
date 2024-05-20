'use strict';

const utils = require('./utils');


module.exports.handler = async(event, context) => {
    const {lambdaConfigurations, currConfig, lambdaARN} = validateInputs(event);
    const currentIterator = lambdaConfigurations.iterator;
    // publish version & assign alias (if present)
    await utils.createPowerConfiguration(lambdaARN, currConfig.powerValue, currConfig.alias, currConfig.description);

    const result = {
        powerValues: lambdaConfigurations.powerValues,
        initConfigurations: lambdaConfigurations.initConfigurations,
        iterator: {
            index: (currentIterator.index + 1),
            count: currentIterator.count,
            continue: ((currentIterator.index + 1) < currentIterator.count),
        },
    };

    if (!result.iterator.continue) {
        // clean the list of configuration if we're done iterating
        delete result.initConfigurations;
    }

    return result;
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
        throw new Error(`Invalid init configuration: ${JSON.stringify(currConfig)}`);
    }
    return {lambdaConfigurations, currConfig, lambdaARN};
}
