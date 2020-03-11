'use strict';

const utils = require('./utils');

/**
 * Optionally auto-optimize based on the optimal power value.
 */
module.exports.handler = async(event, context) => {

    const {lambdaARN, analysis, autoOptimize, autoOptimizeAlias, dryRun} = event;

    const optimalValue = (analysis || {}).power;

    if (dryRun) {
        return console.log('[Dry-run] Not optimizing');
    }

    validateInput(lambdaARN, optimalValue); // may throw

    if (!autoOptimize) {
        return console.log('Not optimizing');
    }

    if (!autoOptimizeAlias) {
        // only update $LATEST power
        await utils.setLambdaPower(lambdaARN, optimalValue);
    } else {
        // create/update alias
        await utils.createPowerConfiguration(lambdaARN, optimalValue, autoOptimizeAlias);
    }

    return 'OK';
};

const validateInput = (lambdaARN, optimalValue) => {
    if (!lambdaARN) {
        throw new Error('Missing or empty lambdaARN');
    }
    if (!optimalValue) {
        throw new Error('Missing or empty optimal value');
    }
};
