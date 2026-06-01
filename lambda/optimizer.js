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

    // LMI configurations cannot be auto-applied (MVP safety measure)
    if (analysis && analysis.type === 'lmi') {
        console.log(`[LMI] Optimal config: memoryPerVCpu=${analysis.memoryPerVCpu}, ` +
            `concurrency=${analysis.bestConcurrency}, instanceType=${analysis.instanceType}`);
        return console.log('[LMI] Auto-optimization not supported for LMI configurations');
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
